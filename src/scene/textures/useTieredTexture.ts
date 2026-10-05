import { useEffect, useRef, useState } from 'react';
import { LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { TIERS, type TextureRef, type Tier } from '../../core/catalog/schema';

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
 * isCancelled is checked before each load and after it; a cancelled result is released, never shown.
 */
export async function loadBestTier(
  ref: TextureRef,
  maxTier: Tier,
  baseUrl: string,
  loader: TextureLoaderLike,
  onTexture: (t: Texture, tier: Tier) => void,
  isCancelled: () => boolean = () => false,
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
  const [texture, setTexture] = useState<Texture | null>(null);
  const owned = useRef(new Set<Texture>());

  // Release a texture only once React has committed its replacement (or null), so the renderer never draws a released one.
  useEffect(() => {
    for (const t of [...owned.current]) {
      if (t === texture) continue;
      owned.current.delete(t);
      getSharedCache().release(t);
    }
  }, [texture]);
  useEffect(() => {
    const held = owned.current;
    return () => {
      for (const t of held) getSharedCache().release(t);
      held.clear();
    };
  }, []);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    void loadBestTier(
      ref,
      opts.maxTier,
      import.meta.env.BASE_URL,
      getSharedCache().loaderFor({ srgb: opts.srgb, mipmaps: opts.mipmaps }),
      (t) => {
        owned.current.add(t);
        setTexture(t);
      },
      () => cancelled,
    );
    return () => {
      cancelled = true;
      setTexture(null);
    };
  }, [ref, opts.maxTier, opts.srgb, opts.mipmaps]);
  return texture;
}
