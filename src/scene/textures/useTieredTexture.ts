import { useEffect, useRef, useState } from 'react';
import { LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { TIERS, type TextureRef, type Tier } from '../../core/catalog/schema';

export interface TextureLoaderLike {
  loadAsync(url: string): Promise<Texture>;
}

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
 * isCancelled is checked before each load and after it; a cancelled result is disposed, never shown.
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
    const t = await tryLoad(loader, baseUrl + ref.tiers[tier]!);
    if (!t) return false;
    if (isCancelled()) {
      t.dispose();
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
  const committed = useRef<Texture | null>(null);

  // Dispose a texture only once React has committed its replacement (or null), so the renderer never draws a disposed one.
  useEffect(() => {
    const previous = committed.current;
    committed.current = texture;
    if (previous && previous !== texture) previous.dispose();
  }, [texture]);
  useEffect(
    () => () => {
      committed.current?.dispose();
      committed.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    void loadBestTier(
      ref,
      opts.maxTier,
      import.meta.env.BASE_URL,
      new TextureLoader(),
      (t) => {
        t.colorSpace = opts.srgb ? SRGBColorSpace : NoColorSpace;
        t.wrapS = RepeatWrapping;
        t.anisotropy = 8;
        t.generateMipmaps = opts.mipmaps !== false;
        t.minFilter = opts.mipmaps === false ? LinearFilter : LinearMipmapLinearFilter;
        t.needsUpdate = true;
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
