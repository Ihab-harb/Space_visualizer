import { describe, expect, it } from 'vitest';
import { interiorKind, interiorPalette, layerColours, type InteriorKind } from './interiorPalette';
import { makeEarth, makeJupiter, makeMoon, makeSun } from '../../test/fixtures';

/** Hue in degrees, saturation and relative luminance of a linear RGB triple (via sRGB for hue/saturation). */
function hsl(rgb: readonly [number, number, number]) {
  const s = rgb.map((c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)) as [number, number, number];
  const max = Math.max(...s);
  const min = Math.min(...s);
  const d = max - min;
  let h = 0;
  if (d > 1e-9) {
    if (max === s[0]) h = ((s[1] - s[2]) / d) % 6;
    else if (max === s[1]) h = (s[2] - s[0]) / d + 2;
    else h = (s[0] - s[1]) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const sat = d < 1e-9 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return { h, sat, lum, chroma: d };
}

describe('interiorPalette', () => {
  it('rocky crust and mantle are earth tones: warm hue, muted, dark near the surface', () => {
    const crust = hsl(interiorPalette('solid', 0.01, 'rocky').rgb);
    const mantle = hsl(interiorPalette('unknown', 0.25, 'rocky').rgb);
    for (const c of [crust, mantle]) {
      expect(c.h).toBeGreaterThanOrEqual(10);
      expect(c.h).toBeLessThanOrEqual(40);
    }
    expect(crust.lum).toBeLessThan(0.1);
  });

  it('a liquid metal core glows amber', () => {
    const c = interiorPalette('liquid', 0.6, 'rocky');
    const { h, chroma } = hsl(c.rgb);
    expect(h).toBeGreaterThanOrEqual(25);
    expect(h).toBeLessThanOrEqual(45);
    expect(chroma).toBeGreaterThan(0.6);
    expect(c.glow).toBeGreaterThan(interiorPalette('solid', 0.2, 'rocky').glow);
  });

  it('a solid inner core is near white and the brightest rocky layer', () => {
    const core = interiorPalette('solid', 0.95, 'rocky');
    const { chroma, lum } = hsl(core.rgb);
    expect(chroma).toBeLessThan(0.15);
    expect(lum).toBeGreaterThan(0.75);
    expect(core.glow).toBeGreaterThan(interiorPalette('liquid', 0.6, 'rocky').glow);
  });

  it('plasma runs from orange near the surface to near white at the centre', () => {
    const top = hsl(interiorPalette('plasma', 0.05, 'star').rgb);
    const centre = hsl(interiorPalette('plasma', 0.95, 'star').rgb);
    expect(top.h).toBeGreaterThanOrEqual(10);
    expect(top.h).toBeLessThanOrEqual(40);
    expect(top.chroma).toBeGreaterThan(0.6);
    expect(centre.lum).toBeGreaterThan(0.75);
  });

  it('giant hydrogen layers run from blue to violet', () => {
    const outer = hsl(interiorPalette('unknown', 0.05, 'gas-giant').rgb);
    const deeper = hsl(interiorPalette('liquid', 0.5, 'gas-giant').rgb);
    expect(outer.h).toBeGreaterThanOrEqual(210);
    expect(outer.h).toBeLessThanOrEqual(240);
    expect(deeper.h).toBeGreaterThan(outer.h);
    expect(deeper.h).toBeLessThanOrEqual(290);
    const ice = hsl(interiorPalette('unknown', 0.05, 'ice-giant').rgb);
    expect(ice.h).toBeGreaterThanOrEqual(190);
    expect(ice.h).toBeLessThanOrEqual(240);
  });

  it('deeper is brighter in every family, and glow never falls with depth', () => {
    const cases: Array<[Parameters<typeof interiorPalette>[0], InteriorKind]> = [
      ['solid', 'rocky'], ['unknown', 'rocky'], ['liquid', 'rocky'], ['plasma', 'star'], ['unknown', 'gas-giant'], ['liquid', 'ice-giant'],
    ];
    for (const [state, kind] of cases) {
      let prev = interiorPalette(state, 0, kind);
      for (let d = 0.1; d <= 1.0001; d += 0.1) {
        const next = interiorPalette(state, d, kind);
        expect(hsl(next.rgb).lum, `${state} ${kind} at ${d.toFixed(1)}`).toBeGreaterThanOrEqual(hsl(prev.rgb).lum - 1e-9);
        expect(next.glow).toBeGreaterThanOrEqual(prev.glow - 1e-9);
        prev = next;
      }
    }
  });

  it('clamps depth and never returns NaN', () => {
    for (const d of [-1, 2, Number.NaN]) {
      const c = interiorPalette('solid', d, 'rocky');
      expect(c.rgb.every((x) => Number.isFinite(x) && x >= 0 && x <= 1)).toBe(true);
      expect(Number.isFinite(c.glow)).toBe(true);
    }
  });
});

describe('interiorKind', () => {
  it('maps the Sun to star, rocky bodies to rocky and the giants by their ices', () => {
    expect(interiorKind(makeSun())).toBe('star');
    expect(interiorKind(makeEarth())).toBe('rocky');
    expect(interiorKind(makeMoon())).toBe('rocky');
    expect(interiorKind(makeJupiter())).toBe('gas-giant');
    expect(interiorKind({ ...makeJupiter(), id: 'uranus' })).toBe('ice-giant');
    expect(interiorKind({ ...makeJupiter(), id: 'neptune' })).toBe('ice-giant');
  });
});

describe('layerColours', () => {
  it('keeps one family across a thick layer and brightens downward', () => {
    // The Moon's mantle: solid from near the surface to 0.2 of the radius. Its bottom must stay rock, not turn core-white.
    const { top, bottom } = layerColours('solid', 0.97, 0.2, 'rocky');
    expect(bottom.rgb).not.toEqual(interiorPalette('solid', 0.8, 'rocky').rgb);
    expect(bottom.glow).toBeLessThan(1);
    expect(bottom.rgb[1]).toBeGreaterThan(top.rgb[1]);
  });
});
