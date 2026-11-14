import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { horizonsVectorUrl, moonChunkUrl, parseHorizonsVector, parseHorizonsVectorTable } from './horizons';

// Trimmed from a real response (Jupiter body centre, 2000-01-01 12:00 TDB, ecliptic J2000, Sun centre).
const RESULT = [
  '*******************************************************************************',
  '            JDTDB,            Calendar Date (TDB),                      X,                      Y,                      Z,',
  '$$SOE',
  '2451545.000000000, A.D. 2000-Jan-01 12:00:00.0000,  5.985676246570644E+08,  4.396046799481729E+08, -1.522686167298746E+07,',
  '$$EOE',
].join('\n');

describe('Horizons helpers', () => {
  it('parses the vector line', () => {
    expect(parseHorizonsVector(RESULT)).toEqual([5.985676246570644e8, 4.396046799481729e8, -1.522686167298746e7]);
  });
  it('throws when there is no ephemeris block', () => {
    expect(() => parseHorizonsVector('No ephemeris for target "Mars" prior to A.D. 1600')).toThrow(/\$\$SOE/);
  });
  it('builds a quoted-parameter URL', () => {
    const url = new URL(horizonsVectorUrl('5', 2451545));
    expect(url.searchParams.get('COMMAND')).toBe("'5'");
    expect(url.searchParams.get('CENTER')).toBe("'500@10'");
    expect(url.searchParams.get('TLIST')).toBe("'2451545'");
  });
  it('parses every row of a vector table', () => {
    const rows = parseHorizonsVectorTable(readFileSync('pipeline/fixtures/horizons-moon-vectors.txt', 'utf8'));
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual({ jdTdb: 2451545.125, positionKm: [-2.845529015106648e5, -2.827751439206651e5, 3.613377054107668e4] });
  });
  it('throws on a non-numeric row', () => {
    expect(() => parseHorizonsVectorTable(['$$SOE', '2451545.0, A.D., abc, 1, 2,', '$$EOE'].join('\n'))).toThrow(/not numeric/);
  });
  it('throws on an empty field', () => {
    expect(() => parseHorizonsVectorTable(['$$SOE', '2451545.0, A.D., , 1, 2,', '$$EOE'].join('\n'))).toThrow(/not numeric/);
  });
  it('moonChunkUrl has CENTER 500@399 and COMMAND 301', () => {
    const url = new URL(moonChunkUrl(2451545, 2451555, 180));
    expect(url.searchParams.get('COMMAND')).toBe("'301'");
    expect(url.searchParams.get('CENTER')).toBe("'500@399'");
    expect(url.searchParams.get('START_TIME')).toBe("'JD 2451545'");
    expect(url.searchParams.get('STOP_TIME')).toBe("'JD 2451555'");
    expect(url.searchParams.get('STEP_SIZE')).toBe("'180 m'");
    expect(url.searchParams.get('REF_PLANE')).toBe("'ECLIPTIC'");
  });
});
