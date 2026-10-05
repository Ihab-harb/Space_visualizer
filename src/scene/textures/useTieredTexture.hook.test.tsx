// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { TextureRef } from '../../core/catalog/schema';
import { TextureCache, TextureCacheContext, useTieredTexture, type TextureLoaderLike } from './useTieredTexture';

/** Let pending promise chains (loadBestTier's awaits) settle. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function deferredLoader() {
  const waiting = new Map<string, (t: Texture) => void>();
  let disposed = 0;
  const loader: TextureLoaderLike = {
    loadAsync: (url) =>
      new Promise<Texture>((resolve) => {
        waiting.set(url, (t) => resolve(t));
      }),
  };
  const resolve = async (url: string) => {
    const t = new Texture();
    t.addEventListener('dispose', () => disposed++);
    await act(async () => {
      waiting.get(url)!(t);
      await flush();
    });
    return t;
  };
  return { loader, resolve, disposedCount: () => disposed, pending: () => [...waiting.keys()] };
}

const oneTier: TextureRef = { tiers: { '1k': 'a_1k.webp' }, sourceId: 'x' };
const twoTiers: TextureRef = { tiers: { '1k': 'b_1k.webp', '2k': 'b_2k.webp' }, sourceId: 'x' };

describe('useTieredTexture', () => {
  it('keeps showing the current texture while a new tier loads', async () => {
    const d = deferredLoader();
    const cache = new TextureCache(d.loader);
    const wrapper = ({ children }: { children: React.ReactNode }) => <TextureCacheContext.Provider value={cache}>{children}</TextureCacheContext.Provider>;
    const { result, rerender } = renderHook(({ max }: { max: '1k' | '2k' }) => useTieredTexture(twoTiers, { maxTier: max, srgb: true }), { wrapper, initialProps: { max: '1k' } });
    const first = await d.resolve('/b_1k.webp');
    expect(result.current).toBe(first);
    rerender({ max: '2k' });
    expect(result.current).toBe(first); // not blanked while 2k loads
  });

  it('releases a texture as many times as it acquired it', async () => {
    const d = deferredLoader();
    const cache = new TextureCache(d.loader);
    const wrapper = ({ children }: { children: React.ReactNode }) => <TextureCacheContext.Provider value={cache}>{children}</TextureCacheContext.Provider>;
    const { rerender, unmount } = renderHook(({ max }: { max: '1k' | '2k' }) => useTieredTexture(oneTier, { maxTier: max, srgb: true }), { wrapper, initialProps: { max: '1k' } });
    await d.resolve('/a_1k.webp');
    rerender({ max: '2k' }); // re-acquires the same cached 1k texture
    await act(async () => {
      await flush();
    });
    unmount();
    expect(cache.size).toBe(0);
    expect(d.disposedCount()).toBe(1);
  });
});
