import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGmKernel } from './naifGm';

const text = readFileSync('pipeline/fixtures/gm_de440.tpc', 'utf8');

describe('parseGmKernel', () => {
  it('reads BODY399_GM and BODY301_GM (km^3/s^2), handling D and E exponents', () => {
    const gm = parseGmKernel(text);
    expect(gm.get(399)).toBeCloseTo(398600.435507, 5);
    expect(gm.get(301)).toBeCloseTo(4902.800118, 5);
    expect(gm.get(3)).toBeCloseTo(403503.23562548, 5);
    expect(gm.get(10)).toBeCloseTo(1.3271244004127942e11, -3);
  });

  it('ignores variables that are not a body GM', () => {
    expect([...parseGmKernel(text).keys()].sort((a, b) => a - b)).toEqual([3, 10, 301, 399]);
  });
});
