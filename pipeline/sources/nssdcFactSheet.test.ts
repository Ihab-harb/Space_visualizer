import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFactCell, parsePlanetFactSheet, parseSunFactSheet, parseSunNumber, planetFact, sunFact } from './nssdcFactSheet';

describe('parseFactCell', () => {
  it.each([
    ['12,104', 12104],
    ['0.384*', 0.384],
    ['-5832.5', -5832.5],
    ['Yes', true],
    ['No', false],
    ['Unknown*', undefined],
    ['Unknown', undefined],
    ['', undefined],
  ])('%s -> %s', (raw, expected) => {
    expect(parseFactCell(raw)).toBe(expected);
  });
  it('rejects unrecognized text', () => {
    expect(() => parseFactCell('lots')).toThrow(/Unrecognized/);
  });
});

describe('planetary fact sheet', () => {
  const sheet = parsePlanetFactSheet(readFileSync('pipeline/fixtures/planet-factsheet.html', 'utf8'));
  it('reads the columns', () => {
    expect(sheet.columns).toEqual(['MERCURY', 'VENUS', 'EARTH', 'MOON', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE', 'PLUTO']);
  });
  it('reads values by row prefix and column', () => {
    expect(planetFact(sheet, 'Mass', 'JUPITER')).toBe(1898);
    expect(planetFact(sheet, 'Diameter', 'EARTH')).toBe(12756);
    expect(planetFact(sheet, 'Rotation Period', 'VENUS')).toBe(-5832.5);
    expect(planetFact(sheet, 'Ring System?', 'SATURN')).toBe(true);
    expect(planetFact(sheet, 'Orbital Eccentricity', 'MERCURY')).toBe(0.206);
  });
  it('keeps unknown values as undefined', () => {
    expect(planetFact(sheet, 'Surface Pressure', 'JUPITER')).toBeUndefined();
  });
  it('throws for missing rows or columns', () => {
    expect(() => planetFact(sheet, 'Colour', 'JUPITER')).toThrow(/row "Colour"/);
    expect(() => planetFact(sheet, 'Mass', 'VULCAN')).toThrow(/column "VULCAN"/);
  });
});

describe('sun fact sheet', () => {
  const sheet = parseSunFactSheet(readFileSync('pipeline/fixtures/sun-factsheet.html', 'utf8'));
  it('reads labelled values', () => {
    expect(parseSunNumber(sunFact(sheet, 'Mass ('))).toBe(1988400);
    expect(parseSunNumber(sunFact(sheet, 'Volumetric mean radius'))).toBe(695700);
    expect(parseSunNumber(sunFact(sheet, 'Absolute magnitude'))).toBe(4.83);
    expect(parseSunNumber(sunFact(sheet, 'Sidereal rotation period'))).toBe(609.12);
    expect(sunFact(sheet, 'Spectral type')).toBe('G2 V');
  });
  it('throws for a missing label', () => {
    expect(() => sunFact(sheet, 'Favourite colour')).toThrow(/Favourite colour/);
  });
});
