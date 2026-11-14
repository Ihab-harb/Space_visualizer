import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMoonExosphere, parseMoonFactSheet } from './nssdcMoonSheet';

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

describe('parseMoonExosphere', () => {
  const html = readFileSync('pipeline/fixtures/moonfact.html', 'utf8');
  const exo = parseMoonExosphere(html, 'nssdca-moon-fact-sheet');
  const get = (name: string) => exo.numberDensity!.find((g) => g.name === name)!;

  it('reads the night composition as upper-limit number densities', () => {
    expect(exo.kind).toBe('exosphere');
    expect(exo.major).toEqual([]);
    expect(exo.minor).toEqual([]);
    expect(exo.basis).toBe('night, particles per cubic cm');
    expect(exo.numberDensity).toHaveLength(9);
    expect(get('Helium 4')).toEqual({ name: 'Helium 4', formula: '⁴He', amount: 40000, unit: 'cm⁻³', upperLimit: true, sourceId: 'nssdca-moon-fact-sheet' });
    expect(get('Argon 40').amount).toBe(30000);
    expect(get('Hydrogen').formula).toBe('H2');
    expect(get('Carbon Dioxide').amount).toBe(1000);
    expect(get('Methane').amount).toBe(1000);
  });

  it("puts the sheet's caveats and the trace and possible entries in the note, not as numbers", () => {
    const text = exo.note!.text;
    expect(text).toContain('Composition of the tenuous lunar atmosphere is poorly known and variable, these are estimates of the upper limits of the nighttime ambient atmosphere composition.');
    expect(text).toContain('Daytime levels were difficult to measure due to heating and outgassing of Apollo surface experiments.');
    expect(text).toContain('Trace: Oxygen (O⁺), Aluminum (Al⁺), Silicon (Si⁺)');
    expect(text).toContain('Possible: Phosphorus (P⁺), Sodium (Na⁺), Magnesium (Mg⁺)');
    expect(exo.numberDensity!.some((g) => /Oxygen|Sodium/.test(g.name))).toBe(false);
    expect(exo.note!.sourceId).toBe('nssdca-moon-fact-sheet');
  });

  it('throws when the composition block is missing', () => {
    expect(() => parseMoonExosphere('<pre>nothing here</pre>', 's')).toThrow(/Estimated Composition/);
  });
});
