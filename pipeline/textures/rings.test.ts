import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildRingBands, parseRingSheet, ringProfile } from './rings';

const saturnRows = parseRingSheet(readFileSync('pipeline/fixtures/satringfact.html', 'utf8'));
const uranusRows = parseRingSheet(readFileSync('pipeline/fixtures/uranringfact.html', 'utf8'));

describe('parseRingSheet (NSSDCA)', () => {
  it('reads Saturn edges, ranges and superscript exponents', () => {
    expect(saturnRows.find((r) => r.name === 'B inner edge')).toMatchObject({ radiusKm: 91975, opticalDepth: 1.45, albedo: 0.5 });
    expect(saturnRows.find((r) => r.name === 'D inner edge')?.opticalDepth).toBeCloseTo(1e-5, 10);
    expect(saturnRows.find((r) => r.name === 'Cassini division')).toMatchObject({ radiusKm: undefined, opticalDepth: 0.05 });
  });
  it('reads Uranus radii, widths and approximate values', () => {
    expect(uranusRows.find((r) => r.name === 'Epsilon')).toMatchObject({ radiusKm: 51149, widthKm: 58, opticalDepth: 1.4, albedo: 18 });
    expect(uranusRows.find((r) => r.name === 'Lambda')?.opticalDepth).toBeCloseTo(0.1, 9);
  });
});

describe('buildRingBands and ringProfile', () => {
  const saturn = buildRingBands(saturnRows, { albedoUnit: 1, minOpticalDepth: 0.01 });
  it('pairs edges and fills the Cassini division between B and A', () => {
    expect(saturn.map((b) => b.name)).toEqual(['C', 'B', 'Cassini division', 'A', 'F ring']);
    expect(saturn.find((b) => b.name === 'Cassini division')).toMatchObject({ innerKm: 117507, outerKm: 122340 });
  });
  it('places the F ring illustrative width inward of its cited radius (139,826 km is the outer edge)', () => {
    expect(saturn.find((b) => b.name === 'F ring')).toMatchObject({ innerKm: 139776, outerKm: 139826 });
    expect(ringProfile(saturn, { width: 2048, tint: [1, 1, 1] }).outerKm).toBe(139826);
  });
  it('rejects an empty band list instead of producing NaN profiles', () => {
    expect(() => ringProfile([], { width: 2048, tint: [1, 1, 1] })).toThrow(/no ring bands/);
  });
  it('makes the B ring opaque and the Cassini division nearly clear', () => {
    const { rgba, innerKm, outerKm } = ringProfile(saturn, { width: 2048, tint: [0.85, 0.78, 0.66] });
    const alphaAt = (r: number) => rgba[Math.floor(((r - innerKm) / (outerKm - innerKm)) * 2047) * 4 + 3]!;
    expect(alphaAt(105000)).toBeGreaterThan(180);
    expect(alphaAt(119900)).toBeLessThan(30);
    expect(innerKm).toBe(74658);
  });
  it('builds faint, dark Uranian rings from radius and width', () => {
    const uranus = buildRingBands(uranusRows, { albedoUnit: 1e-3, minOpticalDepth: 0.01 });
    expect(uranus.map((b) => b.name)).toContain('Epsilon');
    expect(uranus.some((b) => b.name.startsWith('R/2003'))).toBe(false);
    const { rgba, innerKm, outerKm } = ringProfile(uranus, { width: 2048, tint: [0.5, 0.5, 0.5] });
    const i = Math.floor(((51149 - innerKm) / (outerKm - innerKm)) * 2047) * 4;
    expect(rgba[i + 3]!).toBeGreaterThan(80);
    expect(rgba[i]!).toBeLessThan(40);
  });
});
