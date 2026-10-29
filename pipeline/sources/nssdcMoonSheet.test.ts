import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMoonFactSheet } from './nssdcMoonSheet';

const sheet = parseMoonFactSheet(readFileSync('pipeline/fixtures/moonfact.html', 'utf8'));

describe('parseMoonFactSheet', () => {
  it('reads the Moon column', () => {
    expect(sheet.get('Semimajor axis')).toBe(0.3844);
    expect(sheet.get('Synodic period')).toBe(29.53);
    expect(sheet.get('Volumetric mean radius')).toBe(1737.4);
    expect(sheet.get('Mass')).toBe(0.07346);
  });

  it('drops units and the asterisk from labels and takes the Moon value, not the Earth value', () => {
    expect(sheet.get('Perigee')).toBe(0.3633);
    expect(sheet.get('Apogee')).toBe(0.4055);
    expect(sheet.get('Mean density')).toBe(3344);
  });

  it('reads the first number of a range', () => {
    expect(sheet.get('Inclination to Earth equator')).toBe(18.28);
  });
});
