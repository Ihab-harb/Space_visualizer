import { describe, expect, it } from 'vitest';
import { realDetails } from '../../test/realData';
import { featureEntries, featureEntry, formatLatLon, formatRecordPosition, isUnknownFeature, quoteSizeKm, searchFeatures, sizesDiffer, tidyQuote } from './featureModel';

describe('featureEntries', () => {
  it('lists landmarks in rank order, then the rest largest first', () => {
    const d = realDetails('mars');
    const e = featureEntries(d);
    expect(e.slice(0, d.landmarks.length).map((x) => x.id)).toEqual(d.landmarks.map((l) => l.id));
    expect(e.slice(0, d.landmarks.length).map((x) => x.landmark?.rank)).toEqual(d.landmarks.map((_, i) => i));
    const rest = e.slice(d.landmarks.length);
    expect(rest.every((x) => x.landmark === null)).toBe(true);
    for (let i = 1; i < rest.length; i++) expect(rest[i - 1]!.diameterKm!).toBeGreaterThanOrEqual(rest[i]!.diameterKm!);
  });

  it('lists a landmark that is also in the 200 once, with its quote', () => {
    const d = realDetails('mars');
    const e = featureEntries(d);
    expect(e.filter((x) => x.id === 'olympus-mons')).toHaveLength(1);
    expect(featureEntry(d, 'olympus-mons')!.landmark!.quote.text).toContain('Olympus Mons stands');
    const inBoth = d.landmarks.filter((l) => d.features!.items.some((f) => f.id === l.id)).length;
    expect(e).toHaveLength(d.landmarks.length + d.features!.items.length - inBoth);
  });

  it('includes a landmark below the size cut', () => {
    const d = realDetails('moon');
    const tycho = featureEntry(d, 'tycho')!;
    expect(tycho.landmark).not.toBeNull();
    expect(tycho.diameterKm).toBeCloseTo(85.294);
    expect(tycho.positionKind).toBe('gazetteer');
    expect(tycho.positionText).toBe(formatLatLon(-43.2958, 348.7847));
  });

  it('handles a body with landmarks and no features (Earth)', () => {
    const e = featureEntries(realDetails('earth'));
    expect(e).toHaveLength(43);
    expect(e[0]).toMatchObject({ id: 'grand-canyon', positionKind: 'names-database', positionSourceId: 'usgs-gnis', positionText: '36.112764° N, 113.9960696° W', diameterKm: null, typeMeaning: null });
    expect(e.find((x) => x.id === 'hudson-bay')).toMatchObject({ type: 'Bay', positionSourceId: 'nrcan-cgndb', positionText: '60.0° N, 86.0° W' });
  });

  it('returns [] for a body with neither', () => {
    expect(featureEntries(realDetails('jupiter'))).toEqual([]);
    expect(featureEntry(realDetails('jupiter'), 'x')).toBeNull();
    expect(featureEntry(null, 'x')).toBeNull();
  });

  it('gives a Latin type its meaning', () => {
    expect(featureEntry(realDetails('mars'), 'olympus-mons')!.typeMeaning).toEqual({ text: 'Mountain', sourceId: 'usgs-gazetteer-descriptor-terms' });
    expect(featureEntry(realDetails('moon'), 'tycho')!.typeMeaning).toBeNull();
  });
});

describe('searchFeatures', () => {
  const moon = featureEntries(realDetails('moon'));
  it('finds "Tycho" from "tycho" and "  TYCHO", and "Brontë" from "bronte"', () => {
    expect(searchFeatures(moon, 'tycho').map((e) => e.id)).toContain('tycho');
    expect(searchFeatures(moon, '  TYCHO').map((e) => e.id)).toContain('tycho');
    const fake = [{ ...moon[0]!, name: 'Brontë', id: 'bronte' }];
    expect(searchFeatures(fake, 'bronte')).toHaveLength(1);
  });
  it('returns everything for an empty query and [] for no match', () => {
    expect(searchFeatures(moon, '')).toEqual(moon);
    expect(searchFeatures(moon, '   ')).toEqual(moon);
    expect(searchFeatures(moon, 'zzzzqq')).toEqual([]);
  });
});

describe('formatLatLon', () => {
  it('formats a position', () => {
    expect(formatLatLon(-14.0059, 301.4123)).toBe('14.0° S, 301.4° E');
    expect(formatLatLon(0, 0)).toBe('0.0° N, 0.0° E');
  });
});

describe('formatRecordPosition', () => {
  it('adds hemisphere letters and keeps the record digits', () => {
    expect(formatRecordPosition('36.112764, -113.9960696')).toBe('36.112764° N, 113.9960696° W');
    expect(formatRecordPosition('-29.1510582, 89.2533842')).toBe('29.1510582° S, 89.2533842° E');
    expect(formatRecordPosition('-77.5, 162.0')).toBe('77.5° S, 162.0° E');
    expect(formatRecordPosition('10.0, 20.0')).toBe('10.0° N, 20.0° E');
  });
  it('reads the text forms of the other names databases (NOAA, GEBCO, NRCan, LINZ) as written', () => {
    expect(formatRecordPosition('-8.25, 118')).toBe('8.25° S, 118° E'); // NOAA Tambora: a whole-number longitude
    expect(formatRecordPosition('-0.3194, -21.47372')).toBe('0.3194° S, 21.47372° W'); // GEBCO Mid-Atlantic Ridge
    expect(formatRecordPosition('60.0, -86.0')).toBe('60.0° N, 86.0° W'); // NRCan Hudson Bay
    expect(formatRecordPosition('-43.595348, 170.141926')).toBe('43.595348° S, 170.141926° E'); // LINZ Aoraki/Mount Cook
    expect(formatRecordPosition('11.373333, 142.591667 (GEBCO name: Challenger Deep)')).toBe('11.373333° N, 142.591667° E (GEBCO name: Challenger Deep)');
  });
  it('keeps a trailing note and leaves other text alone', () => {
    expect(formatRecordPosition('1.5, -2.5 (GNIS name: X)')).toBe('1.5° N, 2.5° W (GNIS name: X)');
    expect(formatRecordPosition('about 10 km east')).toBe('about 10 km east');
  });
});

describe('isUnknownFeature', () => {
  const mars = realDetails('mars');
  it('is true only for ready details that do not know the id', () => {
    expect(isUnknownFeature(mars, 'nope')).toBe(true);
    expect(isUnknownFeature(mars, 'olympus-mons')).toBe(false);
    expect(isUnknownFeature(realDetails('moon'), 'olympus-mons')).toBe(true);
  });
  it('keeps the id while details are not ready or nothing is selected', () => {
    expect(isUnknownFeature(null, 'nope')).toBe(false);
    expect(isUnknownFeature(undefined, 'nope')).toBe(false);
    expect(isUnknownFeature(mars, null)).toBe(false);
  });
});

describe('tidyQuote', () => {
  it('removes a stray space before punctuation only', () => {
    expect(tidyQuote('a bright spot , with rays . (see this )')).toBe('a bright spot, with rays. (see this)');
    expect(tidyQuote('Nothing to change here.')).toBe('Nothing to change here.');
  });
});

describe('quoteSizeKm and sizesDiffer', () => {
  it('reads a width stated in km with "diameter", "across" or "wide"', () => {
    expect(quoteSizeKm('Its circular shape and size (2100 km or 1302 miles in diameter) make Artemis the largest corona.')).toBe(2100);
    expect(quoteSizeKm('At 280 km diameter, Mead is the largest impact crater on Venus.')).toBe(280);
    expect(quoteSizeKm("Mare Humorum is a small circular mare on the lunar nearside, about 825 kilometres across.")).toBe(825);
    expect(quoteSizeKm('The basin is 1,550 kilometers wide.')).toBe(1550);
    expect(quoteSizeKm('With a diameter of 3.44 kilometers (2.14 miles), Pingualuit Crater holds a lake.')).toBe(3.44);
  });
  it('ignores a height, a depth, a length in other units and a sentence with no figure', () => {
    expect(quoteSizeKm('The summit rises 22 km above the plains.')).toBeNull();
    expect(quoteSizeKm('The Mariana Trench stretches 2,500 kilometers (1,500 miles) in an arc that is edged by islands.')).toBeNull();
    expect(quoteSizeKm('Mount Etna is the most active volcano in Europe.')).toBeNull();
  });
  it('differs only beyond half a percent, and never without a card size', () => {
    expect(sizesDiffer('about 825 kilometres across', 419.669)).toBe(true);
    expect(sizesDiffer('about 2,300 km across', 2299.162)).toBe(false);
    expect(sizesDiffer('about 825 kilometres across', null)).toBe(false);
    expect(sizesDiffer('a volcano', 100)).toBe(false);
  });
});
