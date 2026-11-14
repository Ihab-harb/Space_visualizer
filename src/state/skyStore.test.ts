import { beforeEach, describe, expect, it } from 'vitest';
import { useSkyStore } from './skyStore';

const valid = {
  schemaVersion: 1,
  generatedAt: '2026-10-04T12:00:00.000Z',
  sources: [],
  bodies: { sky: { color: { tiers: { '2k': 'textures/sky/color_2k.webp', '4k': 'textures/sky/color_4k.webp' }, sourceId: 'nasa-svs-deep-star-maps' } } },
};

describe('skyStore', () => {
  beforeEach(() => useSkyStore.setState({ ref: null, status: 'idle' }));
  it('loads the sky texture reference from imagery.json', async () => {
    await useSkyStore.getState().load(async () => valid);
    expect(useSkyStore.getState()).toMatchObject({ status: 'ready', ref: { sourceId: 'nasa-svs-deep-star-maps' } });
  });
  it('falls back quietly when the file is missing or invalid', async () => {
    await useSkyStore.getState().load(async () => {
      throw new Error('404');
    });
    expect(useSkyStore.getState()).toMatchObject({ status: 'missing', ref: null });
    await useSkyStore.getState().load(async () => ({ schemaVersion: 2 }));
    expect(useSkyStore.getState().status).toBe('missing');
  });
});
