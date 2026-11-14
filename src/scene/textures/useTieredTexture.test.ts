import { Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { TextureRef } from '../../core/catalog/schema';
import { loadBestTier, pendingTextures, TextureCache, tierChain, type TextureLoaderLike } from './useTieredTexture';

const ref: TextureRef = { tiers: { '1k': 'a_1k', '2k': 'a_2k', '4k': 'a_4k', '8k': 'a_8k' }, sourceId: 'x' };
const loader = (ok: string[]): TextureLoaderLike => ({
  loadAsync: async (url) => {
    if (!ok.some((o) => url.endsWith(o))) throw new Error(`404 ${url}`);
    const t = new Texture();
    t.name = url;
    return t;
  },
});

describe('tiered textures', () => {
  it('lists tiers up to the maximum', () => {
    expect(tierChain(ref, '2k')).toEqual(['1k', '2k']);
    expect(tierChain({ tiers: { '2k': 'b' }, sourceId: 'x' }, '8k')).toEqual(['2k']);
  });
  it('shows the lowest tier first, then the best tier that exists (HD missing locally)', async () => {
    const shown: string[] = [];
    const best = await loadBestTier(ref, '8k', '/', loader(['a_1k', 'a_2k']), (_t, tier) => shown.push(tier));
    expect(shown).toEqual(['1k', '2k']);
    expect(best).toBe('2k');
    expect(pendingTextures()).toBe(0);
  });
  it('falls back to the 4k tier when 8k fails', async () => {
    const shown: string[] = [];
    const best = await loadBestTier(ref, '8k', '/', loader(['a_1k', 'a_4k']), (_t, tier) => shown.push(tier));
    expect(shown).toEqual(['1k', '4k']);
    expect(best).toBe('4k');
  });
  it('with skipFirstPaint shows only the highest tier that loads, falling back downward', async () => {
    const shown: string[] = [];
    expect(await loadBestTier(ref, '8k', '/', loader(['a_1k', 'a_2k']), (_t, tier) => shown.push(tier), undefined, { skipFirstPaint: true })).toBe('2k');
    expect(shown).toEqual(['2k']);
    shown.length = 0;
    expect(await loadBestTier(ref, '2k', '/', loader(['a_1k']), (_t, tier) => shown.push(tier), undefined, { skipFirstPaint: true })).toBe('1k');
    expect(shown).toEqual(['1k']);
    await expect(loadBestTier(ref, '4k', '/', loader([]), () => undefined, undefined, { skipFirstPaint: true })).resolves.toBeNull();
    expect(pendingTextures()).toBe(0);
  });
  it('stops loading once cancelled, disposes late results and leaves nothing pending', async () => {
    let calls = 0;
    let cancelled = false;
    const disposed: Texture[] = [];
    const counting: TextureLoaderLike = {
      loadAsync: async () => {
        calls++;
        const t = new Texture();
        t.addEventListener('dispose', () => disposed.push(t));
        cancelled = true; // cancelled while the first load is in flight
        return t;
      },
    };
    const shown: string[] = [];
    const best = await loadBestTier(ref, '8k', '/', counting, (_t, tier) => shown.push(tier), () => cancelled);
    expect(calls).toBe(1);
    expect(shown).toEqual([]);
    expect(best).toBeNull();
    expect(disposed).toHaveLength(1);
    expect(pendingTextures()).toBe(0);
  });
  it('does not start any load when already cancelled', async () => {
    let calls = 0;
    const l: TextureLoaderLike = { loadAsync: async () => (calls++, new Texture()) };
    await loadBestTier(ref, '8k', '/', l, () => undefined, () => true);
    expect(calls).toBe(0);
  });
  it('never throws when every tier fails', async () => {
    await expect(loadBestTier(ref, '4k', '/', loader([]), () => undefined)).resolves.toBeNull();
    expect(pendingTextures()).toBe(0);
  });
});

describe('texture cache', () => {
  const countingLoader = () => {
    const loaded: Texture[] = [];
    const l: TextureLoaderLike = {
      loadAsync: async () => {
        const t = new Texture();
        loaded.push(t);
        return t;
      },
    };
    return { l, loaded };
  };
  const track = (t: Texture) => {
    const d = { n: 0 };
    t.addEventListener('dispose', () => d.n++);
    return d;
  };

  it('shares one load and one Texture between concurrent consumers, disposing after the last release', async () => {
    const { l, loaded } = countingLoader();
    const cache = new TextureCache(l);
    const [a, b] = await Promise.all([cache.acquire('/n.webp', { srgb: true }), cache.acquire('/n.webp', { srgb: true })]);
    expect(loaded).toHaveLength(1);
    expect(a).toBe(b);
    const d = track(a);
    cache.release(a);
    expect(d.n).toBe(0);
    cache.release(b);
    expect(d.n).toBe(1);
    expect(cache.size).toBe(0);
  });
  it('keeps separate entries for different colour spaces and mipmap settings', async () => {
    const { l, loaded } = countingLoader();
    const cache = new TextureCache(l);
    const [a, b, c] = await Promise.all([
      cache.acquire('/n.webp', { srgb: true }),
      cache.acquire('/n.webp', { srgb: false }),
      cache.acquire('/n.webp', { srgb: true, mipmaps: false }),
    ]);
    expect(loaded).toHaveLength(3);
    expect(new Set([a, b, c]).size).toBe(3);
    expect(a.colorSpace).toBe('srgb');
    expect(b.colorSpace).toBe('');
    expect(c.generateMipmaps).toBe(false);
  });
  it('releases through loadBestTier when cancelled, and the pending counter returns to 0', async () => {
    const { l } = countingLoader();
    const cache = new TextureCache(l);
    const keep = await cache.acquire('/a_1k', { srgb: true });
    const d = track(keep);
    let cancelled = false;
    const inner = cache.loaderFor({ srgb: true });
    const gate: TextureLoaderLike = {
      loadAsync: async (url) => {
        const t = await inner.loadAsync(url);
        cancelled = true;
        return t;
      },
      release: inner.release,
    };
    const best = await loadBestTier(ref, '8k', '/', gate, () => undefined, () => cancelled);
    expect(best).toBeNull();
    expect(d.n).toBe(0);
    cache.release(keep);
    expect(d.n).toBe(1);
    expect(pendingTextures()).toBe(0);
  });
  it('drops a failed load so a later acquire retries', async () => {
    let calls = 0;
    const cache = new TextureCache({ loadAsync: async () => (++calls === 1 ? Promise.reject(new Error('404')) : new Texture()) });
    await expect(cache.acquire('/x', { srgb: true })).rejects.toThrow();
    await expect(cache.acquire('/x', { srgb: true })).resolves.toBeInstanceOf(Texture);
    expect(calls).toBe(2);
  });
});
