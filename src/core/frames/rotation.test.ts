import { describe, expect, it } from 'vitest';
import { makeEarth } from '../../test/fixtures';
import { DEG, RAD, normalizeDeg360 } from '../math/angles';
import { column } from '../math/mat3';
import { OBLIQUITY_J2000_DEG } from '../units';
import { bodyFixedToEquatorial, eclipticToEquatorial, equatorialToEcliptic, orientationAngles, poleEcliptic, type RotationTerms } from './rotation';

const earth = makeEarth().rotation!;
const eps = OBLIQUITY_J2000_DEG * DEG;

// From NAIF pck00011.tpc (BODY499_* and BODY4_NUT_PREC_ANGLES, MAX_PHASE_DEGREE = 2).
const mars: RotationTerms = {
  poleRa: [317.269202, -0.10927547, 0],
  poleDec: [54.432516, -0.05827105, 0],
  pm: [176.049863, 350.891982443297, 0],
  nutPrecRa: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.000068, 0.000238, 0.000052, 0.000009, 0.419057],
  nutPrecDec: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.000051, 0.000141, 0.000031, 0.000005, 1.591274],
  nutPrecPm: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.000145, 0.000157, 0.00004, 0.000001, 0.000001, 0.584542],
  nutPrecAngles: [
    [190.72646643, 15917.10818695, 0], [21.4689247, 31834.27934054, 0], [332.86082793, 19139.89694742, 0],
    [394.93256437, 38280.79631835, 0], [189.6327156, 41215158.1842005, 12.711923222], [121.46893664, 660.22803474, 0],
    [231.05028581, 660.9912354, 0], [251.37314025, 1320.50145245, 0], [217.98635955, 38279.9612555, 0],
    [196.19729402, 19139.83628608, 0], [198.991226, 19139.4819985, 0], [226.292679, 38280.8511281, 0],
    [249.663391, 57420.7251593, 0], [266.18351, 76560.636795, 0], [79.398797, 0.5042615, 0],
    [122.433576, 19139.9407476, 0], [43.058401, 38280.8753272, 0], [57.663379, 57420.7517205, 0],
    [79.476401, 76560.6495004, 0], [166.325722, 0.5042615, 0], [129.071773, 19140.0328244, 0],
    [36.352167, 38281.0473591, 0], [56.668646, 57420.929536, 0], [67.364003, 76560.2552215, 0],
    [104.79268, 95700.4387578, 0], [95.391654, 0.5042615, 0],
  ],
};

// From pck00011.tpc: BODY899_* with N = 357.85 + 52.316 T (first BODY8 angle).
const neptune: RotationTerms = {
  poleRa: [299.36, 0, 0], poleDec: [43.46, 0, 0], pm: [249.978, 541.1397757, 0],
  nutPrecRa: [0.7], nutPrecDec: [-0.51], nutPrecPm: [-0.48], nutPrecAngles: [[357.85, 52.316, 0]],
};

describe('IAU rotation models', () => {
  it("puts Earth's J2000 pole at ecliptic (0, sin eps, cos eps)", () => {
    const p = poleEcliptic(earth, 2451545.0);
    expect(p[0]).toBeCloseTo(0, 12);
    expect(p[1]).toBeCloseTo(Math.sin(eps), 12);
    expect(p[2]).toBeCloseTo(Math.cos(eps), 12);
  });

  it("places Earth's prime meridian at RA = 90 + alpha0 + W (280.147 deg at J2000)", () => {
    const x = column(bodyFixedToEquatorial(earth, 2451545.0), 0);
    expect(normalizeDeg360(Math.atan2(x[1], x[0]) * RAD)).toBeCloseTo(280.147, 9);
    expect(x[2]).toBeCloseTo(0, 12);
  });

  it('advances W by the daily rate', () => {
    expect(orientationAngles(earth, 2451546.0).wDeg).toBeCloseTo(191.1326235, 7);
  });

  it("applies Neptune's N-angle terms", () => {
    const a = orientationAngles(neptune, 2451545.0);
    expect(a.raDeg).toBeCloseTo(299.3337391, 6);
    expect(a.decDeg).toBeCloseTo(42.950359, 6);
  });

  it("applies Mars' large long-period terms (pole ~ RA 317.68, Dec 52.89 at J2000)", () => {
    const a = orientationAngles(mars, 2451545.0);
    expect(a.raDeg).toBeCloseTo(317.681, 2);
    expect(a.decDeg).toBeCloseTo(52.886, 2);
  });

  it('round-trips ecliptic and equatorial vectors', () => {
    const v = [0.3, -0.4, 0.86] as const;
    const back = equatorialToEcliptic(eclipticToEquatorial(v));
    back.forEach((c, i) => expect(c).toBeCloseTo(v[i]!, 14));
  });
});
