import { describe, expect, it } from 'vitest';
import type { Body } from '../core/catalog/schema';
import { makeEarth, makeJupiter, makeSun } from '../test/fixtures';
import { buildNarrative, type NarrativePart } from './narrative';

const text = (parts: NarrativePart[]) => parts.map((p) => p.text).join('');
const stats = { fromSunKm: 7.8e8, fromEarthKm: 6.3e8, lightTimeS: 2100, sourceId: 'jpl-approx-pos' };

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
});
