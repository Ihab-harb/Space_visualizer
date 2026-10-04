import { useEffect, useState } from 'react';
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

/** Lowest tier first for a fast first paint, then the highest tier that loads (missing local HD tiers fall back). */
export async function loadBestTier(ref: TextureRef, maxTier: Tier, baseUrl: string, loader: TextureLoaderLike, onTexture: (t: Texture, tier: Tier) => void): Promise<Tier | null> {
  const chain = tierChain(ref, maxTier);
  let shownIndex = -1;
  for (let i = 0; i < chain.length && shownIndex < 0; i++) {
    const t = await tryLoad(loader, baseUrl + ref.tiers[chain[i]!]!);
    if (t) {
      onTexture(t, chain[i]!);
      shownIndex = i;
    }
  }
  if (shownIndex < 0) return null;
  for (let i = chain.length - 1; i > shownIndex; i--) {
    const t = await tryLoad(loader, baseUrl + ref.tiers[chain[i]!]!);
    if (t) {
      onTexture(t, chain[i]!);
      return chain[i]!;
    }
  }
  return chain[shownIndex]!;
}

export function useTieredTexture(ref: TextureRef | undefined, opts: { maxTier: Tier; srgb: boolean; mipmaps?: boolean }): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null);
  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    let current: Texture | null = null;
    void loadBestTier(ref, opts.maxTier, import.meta.env.BASE_URL, new TextureLoader(), (t) => {
      if (cancelled) {
        t.dispose();
        return;
      }
      t.colorSpace = opts.srgb ? SRGBColorSpace : NoColorSpace;
      t.wrapS = RepeatWrapping;
      t.anisotropy = 8;
      t.generateMipmaps = opts.mipmaps !== false;
      t.minFilter = opts.mipmaps === false ? LinearFilter : LinearMipmapLinearFilter;
      t.needsUpdate = true;
      current?.dispose();
      current = t;
      setTexture(t);
    });
    return () => {
      cancelled = true;
      current?.dispose();
    };
  }, [ref, opts.maxTier, opts.srgb, opts.mipmaps]);
  return texture;
}
