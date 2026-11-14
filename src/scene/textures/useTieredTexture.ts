import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { TIERS, type TextureRef, type Tier } from '../../core/catalog/schema';
import { availableRef } from './availableTiers';

export interface TextureLoaderLike {
  loadAsync(url: string): Promise<Texture>;
  /** Called instead of texture.dispose() when a loaded texture is no longer wanted (shared loaders ref-count it). */
  release?(url: string, texture: Texture): void;
}

export interface TextureProps {
  srgb: boolean;
  mipmaps?: boolean;
}

interface CacheEntry {
  promise: Promise<Texture>;
  refs: number;
}

function configureTexture(t: Texture, props: TextureProps): void {
  t.colorSpace = props.srgb ? SRGBColorSpace : NoColorSpace;
  t.wrapS = RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = props.mipmaps !== false;
  t.minFilter = props.mipmaps === false ? LinearFilter : LinearMipmapLinearFilter;
  t.needsUpdate = true;
}

/**
 * Ref-counted texture cache keyed by URL + colour space + mipmaps. Concurrent consumers share one load and one
 * Texture; the Texture is disposed when its last consumer releases it.
 */
export class TextureCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly byTexture = new WeakMap<Texture, { key: string; entry: CacheEntry }>();

  constructor(private readonly loader: TextureLoaderLike) {}

  get size(): number {
    return this.entries.size;
  }

  acquire(url: string, props: TextureProps): Promise<Texture> {
    const key = `${url}|${props.srgb ? 'srgb' : 'linear'}|${props.mipmaps === false ? 'nomip' : 'mip'}`;
    let entry = this.entries.get(key);
    if (!entry) {
      const created: CacheEntry = {
        refs: 0,
        promise: this.loader.loadAsync(url).then(
          (t) => {
            configureTexture(t, props);
            this.byTexture.set(t, { key, entry: created });
            return t;
          },
          (err: unknown) => {
            if (this.entries.get(key) === created) this.entries.delete(key);
            throw err;
          },
        ),
      };
      this.entries.set(key, created);
      entry = created;
    }
    entry.refs++;
    return entry.promise;
  }

  /** Drop one consumer of this texture; dispose it when none remain. Unknown textures are disposed directly. */
  release(texture: Texture): void {
    const owner = this.byTexture.get(texture);
    if (!owner) {
      texture.dispose();
      return;
    }
    if (--owner.entry.refs > 0) return;
    if (this.entries.get(owner.key) === owner.entry) this.entries.delete(owner.key);
    this.byTexture.delete(texture);
    texture.dispose();
  }

  /** A TextureLoaderLike view of this cache for loadBestTier. */
  loaderFor(props: TextureProps): TextureLoaderLike {
    return { loadAsync: (url) => this.acquire(url, props), release: (_url, t) => this.release(t) };
  }
}

/** Lets tests supply their own cache; null means the shared app-wide cache. */
export const TextureCacheContext = createContext<TextureCache | null>(null);

let sharedCache: TextureCache | null = null;
const getSharedCache = (): TextureCache => (sharedCache ??= new TextureCache(new TextureLoader()));

let pending = 0;
const listeners = new Set<() => void>();
const setPending = (delta: number) => {
  pending += delta;
  listeners.forEach((cb) => cb());
};
export const pendingTextures = () => pending;
export function subscribePending(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function tierChain(ref: TextureRef, maxTier: Tier): Tier[] {
  const max = TIERS.indexOf(maxTier);
  return TIERS.filter((t, i) => i <= max && ref.tiers[t] !== undefined);
}

async function tryLoad(loader: TextureLoaderLike, url: string): Promise<Texture | null> {
  setPending(1);
  try {
    return await loader.loadAsync(url);
  } catch {
    return null;
  } finally {
    setPending(-1);
  }
}

/**
 * Lowest tier first for a fast first paint, then the highest tier that loads (missing local HD tiers fall back).
 * With skipFirstPaint (the consumer already shows a texture, so a tier change), only the highest tier that loads is
 * shown, falling back downward. isCancelled is checked before each load and after it; a cancelled result is released,
 * never shown.
 */
export async function loadBestTier(
  ref: TextureRef,
  maxTier: Tier,
  baseUrl: string,
  loader: TextureLoaderLike,
  onTexture: (t: Texture, tier: Tier) => void,
  isCancelled: () => boolean = () => false,
  options: { skipFirstPaint?: boolean } = {},
): Promise<Tier | null> {
  const chain = tierChain(ref, maxTier);
  const attempt = async (tier: Tier): Promise<boolean> => {
    if (isCancelled()) return false;
    const url = baseUrl + ref.tiers[tier]!;
    const t = await tryLoad(loader, url);
    if (!t) return false;
    if (isCancelled()) {
      if (loader.release) loader.release(url, t);
      else t.dispose();
      return false;
    }
    onTexture(t, tier);
    return true;
  };
  if (options.skipFirstPaint) {
    for (let i = chain.length - 1; i >= 0 && !isCancelled(); i--) if (await attempt(chain[i]!)) return chain[i]!;
    return null;
  }
  let shownIndex = -1;
  for (let i = 0; i < chain.length && shownIndex < 0 && !isCancelled(); i++) {
    if (await attempt(chain[i]!)) shownIndex = i;
  }
  if (shownIndex < 0) return null;
  for (let i = chain.length - 1; i > shownIndex && !isCancelled(); i--) {
    if (await attempt(chain[i]!)) return chain[i]!;
  }
  return chain[shownIndex]!;
}

export function useTieredTexture(ref: TextureRef | undefined, opts: { maxTier: Tier; srgb: boolean; mipmaps?: boolean }): Texture | null {
  const cache = useContext(TextureCacheContext) ?? getSharedCache();
  const [texture, setTexture] = useState<Texture | null>(null);
  /** How many times this consumer acquired each texture from the cache. */
  const owned = useRef(new Map<Texture, number>());
  /** The ref whose texture this consumer last received (it stays on screen until a replacement commits). */
  const shownFor = useRef<TextureRef | null>(null);

  const releaseAll = useCallback(
    (t: Texture) => {
      const n = owned.current.get(t) ?? 0;
      owned.current.delete(t);
      for (let i = 0; i < n; i++) cache.release(t);
    },
    [cache],
  );

  // Release textures only after React has committed their replacement (or null), so nothing on screen is released.
  useEffect(() => {
    for (const t of [...owned.current.keys()]) if (t !== texture) releaseAll(t);
  }, [texture, releaseAll]);
  useEffect(
    () => () => {
      for (const t of [...owned.current.keys()]) releaseAll(t);
    },
    [releaseAll],
  );

  useEffect(() => {
    if (!ref) {
      shownFor.current = null;
      setTexture(null);
      return;
    }
    let cancelled = false;
    // A tier change for the image already on screen skips the lowest-tier first paint (no 4k -> 1k -> 2k flash).
    const skipFirstPaint = shownFor.current === ref;
    void loadBestTier(
      availableRef(ref),
      opts.maxTier,
      import.meta.env.BASE_URL,
      cache.loaderFor({ srgb: opts.srgb, mipmaps: opts.mipmaps }),
      (t) => {
        owned.current.set(t, (owned.current.get(t) ?? 0) + 1);
        shownFor.current = ref;
        setTexture(t);
      },
      () => cancelled,
      { skipFirstPaint },
    );
    return () => {
      cancelled = true; // the current texture stays on screen until a replacement arrives
    };
  }, [ref, opts.maxTier, opts.srgb, opts.mipmaps, cache]);
  return texture;
}
