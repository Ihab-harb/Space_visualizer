import { describe, expect, it } from 'vitest';
import { horizonsVectorUrl, parseHorizonsVector } from './horizons';

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
});
