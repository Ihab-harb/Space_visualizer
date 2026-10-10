import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AtmosphereSchema, MagnetosphereSchema, type Atmosphere } from '../../src/core/details/schema';
import { planetSheetSpec, planetSheetUrl } from './registry';
import {
  PLANET_ATMOSPHERE_HEADING,
  PLANET_SHEET_IDS,
  SUN_COMPOSITION_HEADING,
  parseComposition,
  parseMagnetosphere,
  parseSunField,
  sheetText,
} from './nssdcPlanetSheet';

const planet = (id: string) => sheetText(readFileSync(`pipeline/fixtures/planets/${id}fact.html`, 'utf8'));
const sun = sheetText(readFileSync('pipeline/fixtures/sun-factsheet.html', 'utf8'));
const atm = (id: string) => parseComposition(planet(id), PLANET_ATMOSPHERE_HEADING, id);
const gases = (a: Atmosphere | null) =>
  a && { major: a.major.map((g) => [g.formula, g.amount, g.uncertainty]), minor: a.minor.map((g) => [g.formula, g.amount]) };

describe('sheetText', () => {
  it('inlines sub/sup and decodes entities', () => {
    expect(sheetText('<pre>CO<sub>2</sub> &lt;40 10<span><sup>6</sup></span></pre>')).toContain('CO2 <40 106');
  });
});

describe('registry', () => {
  it('builds the per-planet source', () => {
    expect(PLANET_SHEET_IDS).toHaveLength(8);
    expect(planetSheetUrl('mars')).toBe('https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html');
    expect(planetSheetSpec('mars', 'Mars')).toMatchObject({
      id: 'nssdca-mars-fact-sheet',
      title: 'Mars Fact Sheet (D. R. Williams)',
      publisher: 'NASA Goddard Space Flight Center, NSSDCA',
      license: 'NASA public domain (NASA media usage guidelines)',
    });
  });
});

describe('parseComposition', () => {
  it('parses Mars (missing separator)', () => {
    expect(gases(atm('mars'))).toEqual({
      major: [['CO2', 95.1, null], ['N2', 2.59, null], ['Ar', 1.94, null], ['O2', 0.16, null], ['CO', 0.06, null]],
      minor: [['H2O', 210], ['NO', 100], ['Ne', 2.5], ['HDO', 0.85], ['Kr', 0.3], ['Xe', 0.08]],
    });
  });
  it('parses Venus (amount first)', () => {
    expect(gases(atm('venus'))!.major).toEqual([['CO2', 96.5, null], ['N2', 3.5, null]]);
  });
  it('parses Earth (formula-only CH4, note lines)', () => {
    const a = atm('earth');
    expect(gases(a)!.minor).toEqual([['Ar', 9340], ['CO2', 420], ['Ne', 18.18], ['He', 5.24], ['CH4', 1.94], ['Kr', 1.14], ['H2', 0.55]]);
    expect(a!.note!.text).toMatch(/Water is highly variable/);
    expect(a!.minor[4]!.name).toBe('Methane');
  });
  it('parses Jupiter (uncertainties, varies with pressure)', () => {
    expect(gases(atm('jupiter'))).toEqual({
      major: [['H2', 89.8, 2.0], ['He', 10.2, 2.0]],
      minor: [['CH4', 3000], ['NH3', 260], ['HD', 28], ['C2H6', 5.8], ['H2O', 4]],
    });
    expect(atm('jupiter')!.note!.text).toMatch(/^Aerosols: Ammonia ice/);
  });
  it('parses Saturn (names broken across lines)', () => {
    expect(gases(atm('saturn'))!.minor).toEqual([['CH4', 4500], ['NH3', 125], ['HD', 110], ['C2H6', 7]]);
    expect(atm('saturn')!.minor[1]!.name).toBe('Ammonia');
  });
  it('parses Uranus and Neptune', () => {
    expect(gases(atm('uranus'))!.major.map((g) => g[0])).toEqual(['H2', 'He', 'CH4']);
    expect(gases(atm('neptune'))!.major).toEqual([['H2', 80.0, 3.2], ['He', 19.0, 3.2], ['CH4', 1.5, 0.5]]);
  });
  it('gives Mercury an exosphere note and no gases', () => {
    const a = atm('mercury');
    expect(a).toMatchObject({ major: [], minor: [] });
    expect(a!.note!.text).toMatch(/surface bounded exosphere/);
    expect(a!.note!.text.startsWith('(')).toBe(false);
  });
  it('parses the Sun photosphere', () => {
    expect(gases(parseComposition(sun, SUN_COMPOSITION_HEADING, 's'))).toEqual({
      major: [['H', 90.965, null], ['He', 8.889, null]],
      minor: [['O', 774], ['C', 330], ['Ne', 112], ['N', 102], ['Fe', 43], ['Mg', 35], ['Si', 32], ['S', 15]],
    });
  });
  it('returns null without the heading and throws on unrecognised entries', () => {
    expect(parseComposition('nothing here', PLANET_ATMOSPHERE_HEADING, 'x')).toBeNull();
    expect(() =>
      parseComposition('Atmospheric composition (by volume):\n    Major: ??? 5 parts\n', PLANET_ATMOSPHERE_HEADING, 'x'),
    ).toThrow(/Unrecognised atmosphere entry/);
  });
  it('produces schema-valid atmospheres for all eight planets and the Sun', () => {
    for (const id of PLANET_SHEET_IDS) expect(AtmosphereSchema.safeParse(atm(id)).success, id).toBe(true);
    expect(AtmosphereSchema.safeParse(parseComposition(sun, SUN_COMPOSITION_HEADING, 's')).success).toBe(true);
  });
});

describe('parseMagnetosphere', () => {
  it('parses Jupiter', () => {
    expect(parseMagnetosphere(planet('jupiter'), 'j')).toMatchObject({
      kind: 'dipole', strengthGaussR3: { value: 4.3 }, tiltDeg: { value: 9.4 }, tiltLongitudeDeg: { value: 200.1 },
      offsetRadii: { value: 0.119 }, referenceRadiusKm: { value: 71398 }, surfaceFieldGauss: { min: 4.0, max: 13.0 }, dipolePole: null,
    });
  });
  it('parses Earth (no tilt, geocentric dipole)', () => {
    expect(parseMagnetosphere(planet('earth'), 'e')).toMatchObject({
      tiltDeg: null, tiltLongitudeDeg: null, dipolePole: { latDeg: 80.65, lonDegE: 287.32 }, referenceRadiusKm: { value: 6378 },
    });
  });
  it('parses the other planets', () => {
    expect(parseMagnetosphere(planet('saturn'), 's')!.tiltDeg!.value).toBe(0);
    expect(parseMagnetosphere(planet('neptune'), 'n')!.tiltLongitudeDeg!.value).toBe(288);
    expect(parseMagnetosphere(planet('mercury'), 'm')).toMatchObject({
      strengthGaussR3: { value: 0.002 }, offsetRadii: { value: 0.17 }, referenceRadiusKm: { value: 2440 },
    });
    expect(parseMagnetosphere(planet('uranus'), 'u')).not.toBeNull();
  });
  it('returns null for Mars and Venus', () => {
    expect(parseMagnetosphere(planet('mars'), 'x')).toBeNull();
    expect(parseMagnetosphere(planet('venus'), 'x')).toBeNull();
  });
  it('produces schema-valid dipoles', () => {
    for (const id of ['mercury', 'earth', 'jupiter', 'saturn', 'uranus', 'neptune']) {
      expect(MagnetosphereSchema.safeParse(parseMagnetosphere(planet(id), id)).success, id).toBe(true);
    }
  });
});

describe('parseSunField', () => {
  it('builds the field note', () => {
    const f = parseSunField(sun, 's');
    expect(f.note.text).toMatch(/Polar field 1–2 G.*Sunspots 3000 G/);
    expect(f.note.text).toMatch(/Ephemeral \(unipolar\) active regions 20 G$/);
    expect(MagnetosphereSchema.safeParse(f).success).toBe(true);
  });
});
