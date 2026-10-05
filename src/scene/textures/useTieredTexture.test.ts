import { Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { TextureRef } from '../../core/catalog/schema';
import { loadBestTier, pendingTextures, tierChain, type TextureLoaderLike } from './useTieredTexture';

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
  it('falls back to the middle tier when the highest fails', async () => {
    const shown: string[] = [];
    const best = await loadBestTier(ref, '8k', '/', loader(['a_1k', 'a_2k']), (_t, tier) => shown.push(tier));
    expect(shown).toEqual(['1k', '2k']);
    expect(best).toBe('2k');
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
