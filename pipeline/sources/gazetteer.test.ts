import { describe, expect, it } from 'vitest';
import { FeaturesSchema } from '../../src/core/details/schema';
import { GAZETTEER_TARGETS, gazetteerSpec, gazetteerUrl, selectFeatures } from './gazetteer';

const row = (o: Record<string, string>): Record<string, string> => ({
  name: 'X', clean_name: 'X', approvaldt: '1973/01/01 00:00:00', origin: 'o', diameter: '1',
  center_lon: '10', center_lat: '5', type: 'Crater, craters', approval: 'Adopted by IAU', ...o,
});

const rows = [
  row({ name: 'Olympus Mons', clean_name: 'Olympus Mons', diameter: '648.9', center_lon: '226.2', center_lat: '18.65', type: 'Mons, montes', origin: ' Classical albedo feature ' }),
  row({ clean_name: 'Wrap', diameter: '300', center_lon: '360', approvaldt: '' }),
  row({ clean_name: 'Gone', diameter: '900', approval: 'Dropped' }),
  row({ clean_name: 'Zero', diameter: '0' }),
  row({ clean_name: 'Small', diameter: '2' }),
];

describe('selectFeatures', () => {
  const f = selectFeatures(rows, 'usgs-gazetteer-mars', 2);

  it('counts approved features and applies the limit', () => {
    expect(f.totalApproved).toEqual({ value: 4, sourceId: 'usgs-gazetteer-mars' });
    expect(f.items.map((i) => i.name)).toEqual(['Olympus Mons', 'Wrap']);
    expect(f.thresholdKm).toBe(300);
    expect(f.sourceId).toBe('usgs-gazetteer-mars');
  });

  it('normalises fields', () => {
    expect(f.items[0]).toEqual({
      name: 'Olympus Mons', type: 'Mons', latDeg: 18.65, lonDegE: 226.2, diameterKm: 648.9,
      origin: 'Classical albedo feature', approvedYear: 1973,
    });
    expect(f.items[1].lonDegE).toBe(0);
    expect(f.items[1].approvedYear).toBeNull();
  });

  it('passes the schema', () => {
    expect(FeaturesSchema.safeParse(f).success).toBe(true);
  });

  it('breaks diameter ties by name', () => {
    const t = selectFeatures([row({ clean_name: 'B', diameter: '5' }), row({ clean_name: 'A', diameter: '5' })], 's');
    expect(t.items.map((i) => i.name)).toEqual(['A', 'B']);
  });
});

describe('gazetteer source', () => {
  it('builds url and spec', () => {
    const url = 'https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MARS_nomenclature_center_pts.zip';
    expect(gazetteerUrl(GAZETTEER_TARGETS.mars)).toBe(url);
    expect(gazetteerSpec('mars', 'Mars')).toEqual({
      id: 'usgs-gazetteer-mars',
      title: 'Mars nomenclature (feature centre points), Gazetteer of Planetary Nomenclature',
      publisher: 'USGS Astrogeology Science Center / IAU Working Group for Planetary System Nomenclature',
      url,
      license: 'Public domain (USGS)',
    });
  });
});
