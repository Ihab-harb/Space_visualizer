import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseApproxPos } from './jplApproxPos';

const html = readFileSync('pipeline/fixtures/approx_pos.html', 'utf8');

describe('parseApproxPos (JPL Approximate Positions of the Planets)', () => {
  const data = parseApproxPos(html);

  it('parses Table 1 elements and rates', () => {
    expect(data.table1.Mercury.elements).toEqual({ a: 0.38709927, e: 0.20563593, I: 7.00497902, L: 252.2503235, varpi: 77.45779628, Omega: 48.33076593 });
    expect(data.table1.Neptune.rates).toEqual({ a: 0.00026291, e: 0.00005105, I: 0.00035372, L: 218.45945325, varpi: -0.32241464, Omega: -0.00508664 });
    expect(data.table1['EM Bary'].elements.Omega).toBe(0);
  });

  it('parses Table 2a and the Table 2b extra terms', () => {
    expect(data.table2a['EM Bary'].elements.Omega).toBe(-5.11260389);
    expect(data.table2b.Jupiter).toEqual({ b: -0.00012452, c: 0.0606406, s: -0.35635438, f: 38.35125 });
    expect(data.table2b.Mars).toBeUndefined();
  });

  it('parses nominal errors and converts 1000 km to km', () => {
    expect(data.nominalErrors.Neptune.table1).toEqual({ longitudeArcsec: 10, latitudeArcsec: 1, distanceKm: 200000 });
    expect(data.nominalErrors.Uranus.table2).toEqual({ longitudeArcsec: 2000, latitudeArcsec: 30, distanceKm: 8000000 });
    expect(data.nominalErrors['EM Bary'].table1.latitudeArcsec).toBe(8);
  });

  it('fails loudly when the page layout changes', () => {
    expect(() => parseApproxPos('<html><body></body></html>')).toThrow(/Table 1/);
  });
});
