import { describe, expect, it } from 'vitest';
import { eclipticToEquatorial, equatorialToEcliptic } from '../../core/frames/rotation';
import { eclipticDirToSkyUv, eclipticToEquatorialColumns, skyTier } from './skyMath';

const DEG = Math.PI / 180;
const fromRaDec = (raDeg: number, decDeg: number) =>
  equatorialToEcliptic([Math.cos(decDeg * DEG) * Math.cos(raDeg * DEG), Math.cos(decDeg * DEG) * Math.sin(raDeg * DEG), Math.sin(decDeg * DEG)]);

describe('sky mapping', () => {
  it('puts Vega at its texel (RA increases to the left, RA 0h in the centre column)', () => {
    const [u, v] = eclipticDirToSkyUv(fromRaDec(279.2347, 38.7837));
    expect(u).toBeCloseTo(1.5 - 279.2347 / 360, 9);
    expect(v).toBeCloseTo(0.5 + 38.7837 / 180, 9);
  });
  it('puts RA 0h, Dec 0 in the centre and the north celestial pole at the top', () => {
    const [u, v] = eclipticDirToSkyUv(fromRaDec(0, 0));
    expect(u).toBeCloseTo(0.5, 9);
    expect(v).toBeCloseTo(0.5, 9);
    expect(eclipticDirToSkyUv(fromRaDec(0, 90))[1]).toBeCloseTo(1, 9);
  });
  it('gives the shader the same rotation as the core frames', () => {
    const [c0, c1, c2] = eclipticToEquatorialColumns();
    const v = [0.3, -0.5, 0.81] as const;
    const expected = eclipticToEquatorial([...v]);
    for (let i = 0; i < 3; i++) expect(c0[i]! * v[0] + c1[i]! * v[1] + c2[i]! * v[2]).toBeCloseTo(expected[i]!, 12);
  });
  it('uses the committed sky tiers unless 8k is asked for', () => {
    expect(skyTier('1k')).toBe('2k');
    expect(skyTier('2k')).toBe('4k');
    expect(skyTier('4k')).toBe('4k');
    expect(skyTier('8k')).toBe('8k');
  });
});
