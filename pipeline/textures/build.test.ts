import { describe, expect, it } from 'vitest';
import { assertValidImagery, COMMITTED_TIERS, LAYER_JOBS, texturePath, tiersFor } from './build';
import { PRODUCTS } from './manifest';

describe('texture recipes', () => {
  it('covers every planet and the sky with official products', () => {
    const bodies = new Set(LAYER_JOBS.map((j) => j.body));
    for (const b of ['earth', 'mars', 'mercury', 'jupiter', 'saturn', 'uranus', 'neptune']) expect(bodies.has(b), b).toBe(true);
    for (const j of LAYER_JOBS) expect(PRODUCTS[j.product], j.product).toBeDefined();
  });
  it('produces only committed tiers without --hd, and never upsizes past the source in HD', () => {
    const earthColor = LAYER_JOBS.find((j) => j.body === 'earth' && j.layer === 'color')!;
    expect(tiersFor(earthColor, { hd: false, sourceWidth: 21600 })).toEqual(COMMITTED_TIERS);
    expect(tiersFor(earthColor, { hd: true, sourceWidth: 21600 })).toEqual(['1k', '2k', '4k', '8k']);
    const opal = LAYER_JOBS.find((j) => j.body === 'jupiter' && j.layer === 'color')!;
    expect(tiersFor(opal, { hd: true, sourceWidth: 3600 })).toEqual(['1k', '2k']);
  });
  it('never builds a tier wider than the source, keeping 1k as the floor', () => {
    const opal = LAYER_JOBS.find((j) => j.body === 'jupiter' && j.layer === 'color')!;
    expect(tiersFor(opal, { hd: true, sourceWidth: 721 })).toEqual(['1k']);
    expect(tiersFor(opal, { hd: false, sourceWidth: 721 })).toEqual(['1k']);
    expect(tiersFor(opal, { hd: true, sourceWidth: 1800 })).toEqual(['1k']);
    expect(tiersFor(opal, { hd: true, sourceWidth: 3600 })).toEqual(['1k', '2k']);
    expect(tiersFor(opal, { hd: false, sourceWidth: 3600 })).toEqual(['1k', '2k']);
  });
  it('builds the Venus radar layer at 1k, 2k and a local 4k from the 18775 px mosaic', () => {
    const radar = LAYER_JOBS.find((j) => j.body === 'venus' && j.layer === 'radar')!;
    expect(radar).toMatchObject({ product: 'venus-radar', kind: 'gray', maxTier: '4k' });
    expect(radar.derivation).toMatch(/not visible light/);
    expect(tiersFor(radar, { hd: true, sourceWidth: 18775 })).toEqual(['1k', '2k', '4k']);
    expect(tiersFor(radar, { hd: false, sourceWidth: 18775 })).toEqual(['1k', '2k']);
  });
  it('labels exaggerated relief as illustrative', () => {
    const relief = LAYER_JOBS.filter((j) => j.layer === 'normal');
    expect(relief).toHaveLength(3);
    for (const j of relief) expect(j.illustrative, j.body).toBe(true);
  });
  it('rejects an invalid imagery file before it is written', () => {
    expect(() => assertValidImagery({ schemaVersion: 1, generatedAt: 'x', sources: [], bodies: { sky: { color: { tiers: { '2k': null }, sourceId: 's' } } } } as never)).toThrow();
  });
  it('names texture files predictably', () => {
    expect(texturePath('earth', 'color', '2k')).toBe('textures/earth/color_2k.webp');
  });
  it('labels derived and adjusted layers', () => {
    for (const j of LAYER_JOBS.filter((x) => x.kind === 'normal' || x.desaturate)) expect(j.derivation, `${j.body}/${j.layer}`).toBeTruthy();
  });
});
