import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMoonMeanElements } from './jplSatElem';

describe('parseMoonMeanElements', () => {
  it('reads the Moon row and the page warning', () => {
    expect(parseMoonMeanElements(readFileSync('pipeline/fixtures/jpl-sat-elem-moon.html', 'utf8'))).toEqual({
      epoch: '2000-01-01.5', aKm: 384400, e: 0.0554, argPeriDeg: 318.15, meanAnomalyDeg: 135.27, iDeg: 5.16, nodeDeg: 125.08,
      siderealPeriodDays: 27.322, apsisPeriodYears: 5.997, nodePeriodYears: 18.6, hasEphemerisWarning: true,
    });
  });

  it('throws when there is no Moon row', () => {
    expect(() => parseMoonMeanElements('<table><tr><td>Phobos</td><td>401</td></tr></table>')).toThrow(/no Moon row/);
  });
});
