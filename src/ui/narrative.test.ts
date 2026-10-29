import { describe, expect, it } from 'vitest';
import type { Body } from '../core/catalog/schema';
import { makeEarth, makeJupiter, makeMoon, makeSun } from '../test/fixtures';
import { makeJupiterDetails, makeMarsDetails, makeSunDetails } from '../test/detailsFixtures';
import { buildNarrative, type NarrativePart } from './narrative';

const text = (parts: NarrativePart[]) => parts.map((p) => p.text).join('');
const stats = { fromSunKm: 7.8e8, fromEarthKm: 6.3e8, fromParentKm: null, lightTimeS: 2100, sourceId: 'jpl-approx-pos', phase: null };

describe('buildNarrative', () => {
  it('builds cited sentences from facts and live values only', () => {
    const parts = buildNarrative(makeJupiter(), stats);
    expect(text(parts)).toMatch(/Jupiter/);
    const values = parts.filter((p) => p.kind === 'value');
    expect(values.length).toBeGreaterThanOrEqual(3);
    for (const v of values) expect(v.kind === 'value' && v.sourceId.length > 0).toBe(true);
    expect(text(parts)).not.toMatch(/NaN|undefined/);
  });
  it('drops a sentence when its fact is missing', () => {
    const j = makeJupiter();
    const noTemp: Body = { ...j, facts: { ...j.facts, meanTemperatureC: undefined, lengthOfDayHours: undefined } };
    expect(text(buildNarrative(noTemp, stats))).not.toMatch(/temperature|day lasts/i);
  });
  it('describes Earth by its distance from the Sun, and the Sun by its distance from Earth', () => {
    expect(text(buildNarrative(makeEarth(), { ...stats, fromEarthKm: null, lightTimeS: null }))).toMatch(/from the Sun/);
    expect(text(buildNarrative(makeSun(), { ...stats, fromSunKm: null }))).toMatch(/from Earth/);
  });

  describe('with details', () => {
    const mars: Body = { ...makeJupiter(), id: 'mars', name: 'Mars' };
    const sentenceCount = (parts: NarrativePart[]) => text(parts).split(/(?<=[.])\s+/).filter(Boolean).length;
    it('adds the atmosphere and field sentence between the orbit and live sentences', () => {
      const parts = buildNarrative(mars, stats, { details: makeMarsDetails() });
      expect(text(parts)).toMatch(/atmosphere is 95\.1% carbon dioxide; it has no global magnetic field/);
      expect(text(parts)).toMatch(/Right now it is/);
      expect(sentenceCount(parts)).toBeLessThanOrEqual(3);
      expect(text(parts)).not.toMatch(/A day lasts/);
      for (const p of parts) if (p.kind === 'value') expect(p.sourceId.length).toBeGreaterThan(0);
    });
    it('lowercases a multi-word gas name', () => {
      const details = makeMarsDetails();
      details.atmosphere!.major[0]!.name = 'Carbon Dioxide';
      expect(text(buildNarrative(mars, stats, { details }))).toMatch(/95\.1% carbon dioxide/);
    });
    it('describes a tilted dipole field', () => {
      expect(text(buildNarrative(makeJupiter(), stats, { details: makeJupiterDetails() }))).toMatch(/tilted 9\.4° from its spin axis/);
    });
    it('says the field is aligned with the spin axis when the tilt is 0, keeping the citation', () => {
      const details = makeJupiterDetails();
      if (details.magnetosphere.kind === 'dipole') details.magnetosphere.tiltDeg = { value: 0, sourceId: 'nssdca-saturn-fact-sheet' };
      const parts = buildNarrative(makeJupiter(), stats, { details });
      expect(text(parts)).toMatch(/its magnetic field is aligned with its spin axis/);
      expect(text(parts)).not.toMatch(/tilted 0/);
      expect(parts.some((p) => p.kind === 'value' && p.sourceId === 'nssdca-saturn-fact-sheet')).toBe(true);
    });
    it('says photosphere for the Sun and omits the field part when there is no summary', () => {
      const t = text(buildNarrative(makeSun(), stats, { details: makeSunDetails() }));
      expect(t).toMatch(/Its photosphere is 90\.965% hydrogen\./);
      expect(t).not.toMatch(/magnetic/);
    });
    it('is unchanged without details', () => {
      expect(buildNarrative(makeJupiter(), stats, { details: null })).toEqual(buildNarrative(makeJupiter(), stats));
    });
    it('says the Moon orbits Earth with a km distance and no AU', () => {
      const moonStats = { fromSunKm: 1.5e8, fromEarthKm: 384400, fromParentKm: 384400, lightTimeS: 1.28, sourceId: 'jpl-horizons', phase: null };
      const t = text(buildNarrative(makeMoon(), moonStats, { parent: makeEarth() }));
      expect(t).toContain('The Moon orbits Earth every 27.3 days at an average 384,400 km.');
      expect(t).not.toMatch(/AU/);
      expect(t).not.toMatch(/circles the Sun/);
    });
  });
});
