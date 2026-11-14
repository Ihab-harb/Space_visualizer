import { describe, expect, it } from 'vitest';
import { argmaxLonLat, assertElevationRange, calibrateMask, meanInBox, normalMapFromHeight, rangeOf, rollColumns, sampleEquirect, thresholdMask } from './derive';

const W = 8;
const H = 4;
const grid = (f: (x: number, y: number) => number) => {
  const a = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a[y * W + x] = f(x, y);
  return a;
};
const opts = { radiusM: 1000, metersPerUnit: 1, strength: 1 };

describe('normalMapFromHeight', () => {
  it('encodes flat ground as straight up', () => {
    const n = normalMapFromHeight(grid(() => 5), W, H, opts);
    expect([...n.slice(0, 3)]).toEqual([128, 128, 255]);
  });
  it('tilts away from ground rising to the east (R < 128)', () => {
    const n = normalMapFromHeight(grid((x) => x * 50), W, H, opts);
    const i = (1 * W + 3) * 3;
    expect(n[i]!).toBeLessThan(128);
    expect(Math.abs(n[i + 1]! - 128)).toBeLessThanOrEqual(1);
  });
  it('tilts away from ground rising to the north (G < 128)', () => {
    const n = normalMapFromHeight(grid((_, y) => (H - y) * 50), W, H, opts);
    const i = (1 * W + 3) * 3;
    expect(n[i + 1]!).toBeLessThan(128);
    expect(Math.abs(n[i]! - 128)).toBeLessThanOrEqual(1);
  });
});

describe('equirect helpers', () => {
  it('samples by longitude/latitude with column 0 at −180° and row 0 at +90°', () => {
    const v = grid((x, y) => x * 10 + y);
    expect(sampleEquirect(v, W, H, -179, 80)).toBe(0);
    expect(sampleEquirect(v, W, H, 179, -80)).toBe(73);
    expect(sampleEquirect(v, W, H, 0, 0)).toBe(42);
  });
  it('finds the maximum location', () => {
    const v = grid((x, y) => (x === 6 && y === 1 ? 99 : 0));
    expect(argmaxLonLat(v, W, H)).toEqual({ lonDeg: 112.5, latDeg: 22.5, value: 99 });
  });
  it('rolls columns east by whole pixels', () => {
    const v = Float32Array.from({ length: W }, (_, i) => i);
    expect([...rollColumns(v, W, 1, 1, 90)]).toEqual([6, 7, 0, 1, 2, 3, 4, 5]);
  });
});

describe('range and mask checks', () => {
  it('reports ranges and enforces elevation sanity', () => {
    const v = Float32Array.from([-8000, 0, 21000]);
    expect(rangeOf(v)).toEqual({ min: -8000, max: 21000 });
    expect(() => assertElevationRange('mars', v, { minBelow: -5000, maxAbove: 15000 })).not.toThrow();
    expect(() => assertElevationRange('mars', Float32Array.from([0, 60000]), { minBelow: -5000, maxAbove: 15000 })).toThrow(/mars elevation range 0 .. 60000 m fails sanity check/);
  });
  it('calibrates a water mask from known land and water points', () => {
    const v = grid((x) => (x < 4 ? 200 : 10)); // west half bright (land), east half dark (water)
    const cal = calibrateMask(v, W, H, [{ lonDeg: -100, latDeg: 0 }], [{ lonDeg: 100, latDeg: 0 }]);
    expect(cal).toEqual({ threshold: 105, waterAbove: false });
    const mask = thresholdMask(v, cal.threshold, cal.waterAbove);
    expect(mask[0]).toBe(0);
    expect(mask[7]).toBe(255);
  });
  it('refuses to calibrate when land and water overlap', () => {
    const v = grid(() => 50);
    expect(() => calibrateMask(v, W, H, [{ lonDeg: -100, latDeg: 0 }], [{ lonDeg: 100, latDeg: 0 }])).toThrow(/cannot separate land from water/);
  });
});

describe('meanInBox', () => {
  const w = 360;
  const h = 180;
  const v = new Float32Array(w * h).fill(10);
  // Bright 10 degree box at 0..10 E, 60..70 N: columns 180..189, rows 20..29.
  for (let y = 20; y < 30; y++) for (let x = 180; x < 190; x++) v[y * w + x] = 100;
  it('averages only the pixels inside the box and is far above the global mean', () => {
    const box = meanInBox(v, w, h, { lonMin: 0, lonMax: 10, latMin: 60, latMax: 70 });
    expect(box).toBeCloseTo(100, 5);
    expect(box).toBeGreaterThan(5 * rangeOf(v).min);
    expect(meanInBox(v, w, h, { lonMin: -180, lonMax: 180, latMin: -90, latMax: 90 })).toBeCloseTo(10 + (90 * 100) / (w * h), 5);
  });
  it('treats the box edges as inclusive', () => {
    // lonMax 11 reaches the pixel whose west edge is at 10 E: one extra column of dim pixels over 10 rows.
    const wide = meanInBox(v, w, h, { lonMin: 0, lonMax: 10.5, latMin: 60, latMax: 70 });
    expect(wide).toBeLessThan(100);
    expect(wide).toBeCloseTo((100 * 100 + 10 * 10) / 110, 5);
  });
});
