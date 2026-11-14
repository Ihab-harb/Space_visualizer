// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TextureRef, Tier } from '../../core/catalog/schema';
import { TextureCache, TextureCacheContext, useTieredTexture, type TextureLoaderLike } from './useTieredTexture';

// The HD tiers of the three-tier ref below count as present in the build.
vi.mock('virtual:local-tiers', () => ({ LOCAL_HD_FILES: ['c_4k.webp'] }));

/** Let pending promise chains (loadBestTier's awaits) settle. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function deferredLoader() {
  const waiting = new Map<string, (t: Texture) => void>();
  const requests: string[] = [];
  const disposed = new Set<Texture>();
  const loader: TextureLoaderLike = {
    loadAsync: (url) =>
      new Promise<Texture>((resolve) => {
        requests.push(url);
        waiting.set(url, (t) => resolve(t));
      }),
  };
  const resolve = async (url: string) => {
    const t = new Texture();
    t.name = url;
    t.addEventListener('dispose', () => disposed.add(t));
    const done = waiting.get(url);
    if (!done) throw new Error(`no pending load for ${url}; requests: ${requests.join(', ')}`);
    waiting.delete(url);
    await act(async () => {
      done(t);
      await flush();
    });
    return t;
  };
  return { loader, resolve, requests, disposed, disposedCount: () => disposed.size, pending: () => [...waiting.keys()] };
}

const oneTier: TextureRef = { tiers: { '1k': 'a_1k.webp' }, sourceId: 'x' };
const twoTiers: TextureRef = { tiers: { '1k': 'b_1k.webp', '2k': 'b_2k.webp' }, sourceId: 'x' };
const threeTiers: TextureRef = { tiers: { '1k': 'c_1k.webp', '2k': 'c_2k.webp', '4k': 'c_4k.webp' }, sourceId: 'x' };

function setup(ref: TextureRef, initial: Tier, strict = false) {
  const d = deferredLoader();
  const cache = new TextureCache(d.loader);
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const inner = <TextureCacheContext.Provider value={cache}>{children}</TextureCacheContext.Provider>;
    return strict ? <StrictMode>{inner}</StrictMode> : inner;
  };
  const shown: Array<Texture | null> = [];
  const hook = renderHook(
    ({ max }: { max: Tier }) => {
      const t = useTieredTexture(ref, { maxTier: max, srgb: true });
      shown.push(t);
      return t;
    },
    { wrapper, initialProps: { max: initial } },
  );
  return { d, cache, shown, ...hook };
}

describe('useTieredTexture', () => {
  it('keeps showing the current texture while a new tier loads', async () => {
    const { d, result, rerender } = setup(twoTiers, '1k');
    const first = await d.resolve('/b_1k.webp');
    expect(result.current).toBe(first);
    rerender({ max: '2k' });
    expect(result.current).toBe(first); // not blanked while 2k loads
  });

  it('releases a texture as many times as it acquired it', async () => {
    const { d, cache, rerender, unmount } = setup(oneTier, '1k');
    await d.resolve('/a_1k.webp');
    rerender({ max: '2k' }); // re-acquires the same cached 1k texture
    await act(async () => {
      await flush();
    });
    unmount();
    expect(cache.size).toBe(0);
    expect(d.disposedCount()).toBe(1);
  });

  it('upgrades from a non-lowest tier without ever showing the lowest tier again', async () => {
    const { d, shown, result, rerender } = setup(threeTiers, '2k');
    const low = await d.resolve('/c_1k.webp');
    const mid = await d.resolve('/c_2k.webp');
    expect(result.current).toBe(mid);
    expect(d.disposed.has(low)).toBe(true); // the first paint was released once 2k committed
    const before = shown.length;
    rerender({ max: '4k' });
    await act(async () => {
      await flush();
    });
    expect(d.pending()).toEqual(['/c_4k.webp']); // straight to the highest wanted tier
    expect(result.current).toBe(mid);
    const high = await d.resolve('/c_4k.webp');
    expect(result.current).toBe(high);
    expect(shown.slice(before).every((t) => t === mid || t === high)).toBe(true);
    expect(d.requests.filter((u) => u === '/c_1k.webp')).toHaveLength(1);
    expect(d.disposed.has(mid)).toBe(true);
    expect(d.disposed.has(high)).toBe(false);
  });

  it('downgrades 4k to 2k directly, keeping 4k on screen until 2k commits', async () => {
    const { d, shown, result, rerender } = setup(threeTiers, '4k');
    await d.resolve('/c_1k.webp');
    const high = await d.resolve('/c_4k.webp');
    expect(result.current).toBe(high);
    const before = shown.length;
    rerender({ max: '2k' });
    await act(async () => {
      await flush();
    });
    expect(d.pending()).toEqual(['/c_2k.webp']);
    expect(d.disposed.has(high)).toBe(false);
    const mid = await d.resolve('/c_2k.webp');
    expect(result.current).toBe(mid);
    expect(shown.slice(before).every((t) => t === high || t === mid)).toBe(true);
    expect(d.disposed.has(high)).toBe(true);
  });

  it('falls back downward when the highest wanted tier fails, still without the lowest-tier first paint', async () => {
    const d = deferredLoader();
    const failing: TextureLoaderLike = {
      loadAsync: (url) => (url === '/c_4k.webp' ? Promise.reject(new Error('404')) : d.loader.loadAsync(url)),
    };
    const cache = new TextureCache(failing);
    const wrapper = ({ children }: { children: React.ReactNode }) => <TextureCacheContext.Provider value={cache}>{children}</TextureCacheContext.Provider>;
    const { result, rerender } = renderHook(({ max }: { max: Tier }) => useTieredTexture(threeTiers, { maxTier: max, srgb: true }), { wrapper, initialProps: { max: '2k' as Tier } });
    await d.resolve('/c_1k.webp');
    const mid = await d.resolve('/c_2k.webp');
    rerender({ max: '4k' });
    await act(async () => {
      await flush();
    });
    // 4k failed; 2k is cached and on screen, so it is re-acquired from the cache without a new request.
    expect(result.current).toBe(mid);
    expect(d.requests).toEqual(['/c_1k.webp', '/c_2k.webp']);
    expect(d.disposed.has(mid)).toBe(false);
  });

  it('under StrictMode (mount, unmount, mount) keeps cache references balanced and never disposes what is shown', async () => {
    const { d, cache, result, rerender, unmount } = setup(twoTiers, '1k', true);
    const low = await d.resolve('/b_1k.webp');
    expect(result.current).toBe(low);
    expect(d.disposed.has(low)).toBe(false);
    expect(cache.size).toBe(1);
    rerender({ max: '2k' });
    await act(async () => {
      await flush();
    });
    const mid = await d.resolve('/b_2k.webp');
    expect(result.current).toBe(mid);
    expect(d.disposed.has(mid)).toBe(false);
    expect(d.disposed.has(low)).toBe(true);
    expect(cache.size).toBe(1);
    unmount();
    expect(cache.size).toBe(0);
    expect(d.disposed.has(mid)).toBe(true);
  });
});
