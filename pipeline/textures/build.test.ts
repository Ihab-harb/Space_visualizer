import { describe, expect, it } from 'vitest';
import { assertValidImagery, COMMITTED_TIERS, LAYER_JOBS, texturePath, tiersFor, validate } from './build';
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
    expect(relief).toHaveLength(4);
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

const W = 72;
const H = 36;
const inBox = (x: number, y: number, b: { lonMin: number; lonMax: number; latMin: number; latMax: number }) => {
  const lon = ((x + 0.5) / W) * 360 - 180;
  const lat = 90 - ((y + 0.5) / H) * 180;
  const lonOk = b.lonMax <= 180 ? lon >= b.lonMin && lon <= b.lonMax : lon >= b.lonMin || lon <= b.lonMax - 360;
  return lonOk && lat >= b.latMin && lat <= b.latMax;
};
function moonColour(mariaLon: [number, number], highlandsLon: [number, number]): Uint8Array {
  const rgb = new Uint8Array(W * H * 3).fill(150);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (inBox(x, y, { lonMin: mariaLon[0], lonMax: mariaLon[1], latMin: 10, latMax: 40 })) rgb.fill(60, (y * W + x) * 3, (y * W + x) * 3 + 3);
    if (inBox(x, y, { lonMin: highlandsLon[0], lonMax: highlandsLon[1], latMin: -20, latMax: 20 })) rgb.fill(200, (y * W + x) * 3, (y * W + x) * 3 + 3);
  }
  return rgb;
}
function moonDem(minLon: number, minLat: number): Float32Array {
  const raw = new Float32Array(W * H).fill(20000);
  const x = Math.floor(((minLon + 180) / 360) * W);
  const y = Math.floor(((90 - minLat) / 180) * H);
  raw[y * W + x] = 3000;
  raw[H * W - 1 - 5 * W] = 40000;
  return raw;
}

describe('Moon validations', () => {
  const color = LAYER_JOBS.find((j) => j.body === 'moon' && j.layer === 'color')!;
  const dem = LAYER_JOBS.find((j) => j.body === 'moon' && j.layer === 'normal')!;
  it('passes a correctly oriented colour map and rejects a flipped one', () => {
    expect(() => validate(color, moonColour([-60, -20], [150, 200]), W, H)).not.toThrow();
    expect(() => validate(color, moonColour([150, 200], [-60, -20]), W, H)).toThrow(/moon colour orientation check failed/);
  });
  it('passes a minimum inside South Pole-Aitken (including past the antimeridian) and rejects a northern one', () => {
    expect(() => validate(dem, moonDem(-170, -50), W, H)).not.toThrow();
    expect(() => validate(dem, moonDem(170, -50), W, H)).not.toThrow();
    expect(() => validate(dem, moonDem(-170, 50), W, H)).toThrow(/South Pole–Aitken/);
    expect(() => validate(dem, moonDem(0, -50), W, H)).toThrow(/South Pole–Aitken/);
  });
  it('rejects a DEM whose range is clamped (signed/unsigned misread)', () => {
    expect(() => validate(dem, new Float32Array(W * H).fill(20000), W, H)).toThrow(/elevation range/);
  });
});
