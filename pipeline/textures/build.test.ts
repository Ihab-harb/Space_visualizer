import { describe, expect, it } from 'vitest';
import { COMMITTED_TIERS, LAYER_JOBS, texturePath, tiersFor } from './build';
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
  it('names texture files predictably', () => {
    expect(texturePath('earth', 'color', '2k')).toBe('textures/earth/color_2k.webp');
  });
  it('labels derived and adjusted layers', () => {
    for (const j of LAYER_JOBS.filter((x) => x.kind === 'normal' || x.desaturate)) expect(j.derivation, `${j.body}/${j.layer}`).toBeTruthy();
  });
});
