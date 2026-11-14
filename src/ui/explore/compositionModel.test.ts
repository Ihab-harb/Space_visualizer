import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BodyDetails } from '../../core/details/schema';
import { makeEarth, makeSun } from '../../test/fixtures';
import { compositionModel, compositionPreview } from './compositionModel';

const real = (id: string): BodyDetails => JSON.parse(readFileSync(`public/data/solar-system/details/${id}.json`, 'utf8')) as BodyDetails;
const body = (id: string) => ({ ...makeEarth(), id });

describe('compositionModel', () => {
  it('ranks Earth on one log axis, longest first, keeping each source unit', () => {
    const model = compositionModel(body('earth'), real('earth'))!;
    expect(model.title).toBe('Atmosphere · by volume, dry air');
    expect(model.axis).toBe('ppm');
    expect(model.bars).toHaveLength(9);
    expect(model.bars[0]!.name).toBe('Nitrogen');
    expect(model.bars[0]!.formula).toBe('N₂');
    expect(model.bars[0]!.label).toBe('78.08 %');
    expect(model.bars.at(-1)!.name).toBe('Hydrogen');
    expect(model.bars.find((b) => b.formula === 'CO₂')!.label).toBe('420 ppm');
    const logs = model.bars.map((b) => b.logValue);
    expect([...logs].sort((a, b) => b - a)).toEqual(logs);
    expect(model.bars[0]!.logValue).toBeCloseTo(Math.log10(780800), 9);
    expect(model.ticks[0]).toEqual({ value: 0.1, label: '0.1' });
    expect(model.ticks.at(-1)).toEqual({ value: 1_000_000, label: '1,000,000' });
    expect(model.note?.sourceId).toBe('nssdca-earth-fact-sheet');
  });

  it('puts percent and ppm on the same axis (1 % = 10,000 ppm)', () => {
    const model = compositionModel(body('earth'), real('earth'))!;
    const ar = model.bars.find((b) => b.formula === 'Ar')!; // 9340 ppm sits below O2 (209,500 ppm)
    const o2 = model.bars.find((b) => b.formula === 'O₂')!;
    expect(o2.logValue).toBeCloseTo(Math.log10(209500), 9);
    expect(ar.logValue).toBeCloseTo(Math.log10(9340), 9);
  });

  it('charts the Moon exosphere on its own axis, every bar an upper limit', () => {
    const model = compositionModel(body('moon'), real('moon'))!;
    expect(model.axis).toBe('per-cm3');
    expect(model.title).toBe('Exosphere · particles per cm³ (upper limits)');
    expect(model.bars.length).toBeGreaterThan(0);
    expect(model.bars.every((b) => b.upperLimit && b.unit === 'cm⁻³')).toBe(true);
    expect(model.bars[0]!.label).toBe('40,000 per cm³');
    expect(model.bars[0]!.logValue).toBeCloseTo(Math.log10(40000), 9);
    expect(model.ticks[0]!.value).toBeLessThan(1000);
    expect(model.ticks.at(-1)!.value).toBeGreaterThanOrEqual(40000);
  });

  it('titles the Sun chart Photosphere', () => {
    const model = compositionModel(makeSun(), real('sun'))!;
    expect(model.title).toBe('Photosphere');
    expect(model.bars[0]!.name).toBe('Hydrogen');
  });

  it('carries uncertainty', () => {
    const details = real('earth');
    details.atmosphere!.major[0]!.uncertainty = 0.5;
    expect(compositionModel(body('earth'), details)!.bars[0]!.uncertainty).toBe(0.5);
  });

  it('returns null for a note-only body and for no atmosphere', () => {
    expect(compositionModel(body('mercury'), real('mercury'))).toBeNull();
    expect(compositionModel(body('earth'), { ...real('earth'), atmosphere: null })).toBeNull();
  });
});

describe('compositionPreview', () => {
  it('shows the top two gases with their sources', () => {
    const details = real('earth');
    const parts = compositionPreview(compositionModel(body('earth'), details), details).parts;
    const text = parts.map((p) => p.text).join('');
    expect(text).toContain('N₂ 78.08 %');
    expect(text).toContain('O₂ 20.95 %');
    expect(text).not.toContain('Ar');
    expect(parts.filter((p) => p.sourceId)).toHaveLength(2);
  });

  it('shows the cited note for a note-only body', () => {
    const details = real('mercury');
    const parts = compositionPreview(compositionModel(body('mercury'), details), details).parts;
    expect(parts).toEqual([{ text: details.atmosphere!.note!.text, sourceId: 'nssdca-mercury-fact-sheet' }]);
  });

  it('says No atmosphere when the body has none', () => {
    const details = { ...real('earth'), atmosphere: null };
    expect(compositionPreview(null, details).parts).toEqual([{ text: 'No atmosphere' }]);
  });

  it('marks exosphere gases as upper limits', () => {
    const details = real('moon');
    const text = compositionPreview(compositionModel(body('moon'), details), details).parts.map((p) => p.text).join('');
    expect(text).toContain('upper limit');
  });

  it('cites No atmosphere with the surface-pressure fact when it is 0 bar, else leaves it uncited', () => {
    const details = { ...real('earth'), atmosphere: null };
    const airless = { ...makeEarth(), facts: { ...makeEarth().facts, surfacePressureBar: { value: 0, sourceId: 'nssdca-planetary-fact-sheet' } } };
    expect(compositionPreview(null, details, airless).parts).toEqual([{ text: 'No atmosphere', sourceId: 'nssdca-planetary-fact-sheet' }]);
    expect(compositionPreview(null, details, makeEarth()).parts).toEqual([{ text: 'No atmosphere' }]);
  });
});
