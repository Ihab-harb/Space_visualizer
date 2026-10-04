import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePckAssignments, radiiFor, rotationModelFor } from './naifPck';

const pck = parsePckAssignments(readFileSync('pipeline/fixtures/pck00011.tpc', 'utf8'));

describe('parsePckAssignments', () => {
  it('handles lists, scalars, +=, D exponents and skips text blocks and strings', () => {
    const text = [
      'BODY1_IGNORED = ( 9 9 9 )', // before any \\begindata: comment area
      'Data blocks follow a \\begindata token. Example: KEYWORD = VALUE', // prose, not a data block
      '        \\begindata', // indented tokens are real (pck00011 uses them)
      'BODY5_A = ( 1.5D0, -2 )',
      'BODY5_A += ( 3 )',
      "BODY5_NAME = 'JUPITER'",
      'BODY5_MAX_PHASE_DEGREE = 2',
      '\\begintext',
      'BODY5_B = ( 7 )',
    ].join('\n');
    const m = parsePckAssignments(text);
    expect(m.get('BODY5_A')).toEqual([1.5, -2, 3]);
    expect(m.get('BODY5_MAX_PHASE_DEGREE')).toEqual([2]);
    expect(m.has('BODY5_NAME')).toBe(false);
    expect(m.has('BODY5_B')).toBe(false);
    expect(m.has('BODY1_IGNORED')).toBe(false);
  });
});

describe('rotationModelFor (pck00011)', () => {
  it('reads the Sun without periodic terms', () => {
    expect(rotationModelFor(pck, 10)).toEqual({
      poleRa: [286.13, 0, 0], poleDec: [63.87, 0, 0], pm: [84.176, 14.1844, 0],
      nutPrecRa: [], nutPrecDec: [], nutPrecPm: [], nutPrecAngles: [],
    });
  });
  it('reads Jupiter with its 15 angle pairs', () => {
    const j = rotationModelFor(pck, 599);
    expect(j.pm).toEqual([284.95, 870.536, 0]);
    expect(j.nutPrecRa).toHaveLength(15);
    expect(j.nutPrecAngles.length).toBeGreaterThanOrEqual(15);
    expect(j.nutPrecAngles[10]).toEqual([99.360714, 4850.4046, 0]);
  });
  it('groups Mars angles in threes (MAX_PHASE_DEGREE = 2)', () => {
    const m = rotationModelFor(pck, 499);
    expect(m.nutPrecAngles).toHaveLength(26);
    expect(m.nutPrecAngles[4]).toEqual([189.6327156, 41215158.1842005, 12.711923222]);
    expect(m.nutPrecDec[19]).toBe(1.591274);
  });
  it("reads Neptune's N angle and Mercury's angles from the barycentre system", () => {
    expect(rotationModelFor(pck, 899).nutPrecAngles[0]).toEqual([357.85, 52.316, 0]);
    expect(rotationModelFor(pck, 199).nutPrecAngles[0]![0]).toBe(174.7910857);
  });
});

describe('radiiFor', () => {
  it('reads equatorial and polar radii', () => {
    expect(radiiFor(pck, 699)).toEqual({ equatorialRadiusKm: 60268, polarRadiusKm: 54364 });
    expect(radiiFor(pck, 399)).toEqual({ equatorialRadiusKm: 6378.1366, polarRadiusKm: 6356.7519 });
  });
  it('throws for unknown bodies', () => {
    expect(() => radiiFor(pck, 123456)).toThrow(/BODY123456_RADII/);
  });
});
