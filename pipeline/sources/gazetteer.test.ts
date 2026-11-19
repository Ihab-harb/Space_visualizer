import { describe, expect, it } from 'vitest';
import { FeaturesSchema } from '../../src/core/details/schema';
import { GAZETTEER_TARGETS, dedupeRows, gazetteerSpec, gazetteerUrl, findFeature, selectFeatures } from './gazetteer';

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

describe('selectFeatures rounding', () => {
  it('rounds coordinates to 1e-4 deg and diameter to 1e-3 km', () => {
    const f = selectFeatures([row({ center_lat: '57.540000000000006', center_lon: '150.39000000000001', diameter: '12.3456789' })], 's');
    expect(f.items[0]).toMatchObject({ latDeg: 57.54, lonDegE: 150.39, diameterKm: 12.346 });
  });
});

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
      id: 'olympus-mons',
    });
    expect(f.items[1].lonDegE).toBe(0);
    expect(f.items[1].approvedYear).toBeNull();
  });

  it('passes the schema', () => {
    expect(FeaturesSchema.safeParse(f).success).toBe(true);
  });

  it('returns an empty, schema-valid result when nothing is approved', () => {
    const e = selectFeatures([], 's');
    expect(e).toEqual({ totalApproved: { value: 0, sourceId: 's' }, thresholdKm: 0, sourceId: 's', items: [] });
    expect(FeaturesSchema.safeParse(e).success).toBe(true);
  });

  it('breaks diameter ties by name', () => {
    const t = selectFeatures([row({ clean_name: 'B', diameter: '5' }), row({ clean_name: 'A', diameter: '5' })], 's');
    expect(t.items.map((i) => i.name)).toEqual(['A', 'B']);
  });
});

describe('one row per feature', () => {
  const link = (n: number) => `http://planetarynames.wr.usgs.gov/Feature/${n}`;
  it('keeps one row per feature and refills to the limit', () => {
    const pair = [
      row({ clean_name: 'Dup', diameter: '241.449999999999989', link: link(1) }),
      row({ clean_name: 'Dup', diameter: '241.000000000000000', link: link(1) }),
    ];
    const rs = [...pair, row({ clean_name: 'B', diameter: '50', link: link(2) }), row({ clean_name: 'C', diameter: '40', link: link(3) }), row({ clean_name: 'D', diameter: '30', link: link(4) })];
    const f = selectFeatures(rs, 's', 3);
    expect(f.items.map((i) => i.name)).toEqual(['Dup', 'B', 'C']);
    expect(f.items[0]!.diameterKm).toBe(241.45);
    expect(new Set(f.items.map((i) => i.id)).size).toBe(3);
    expect(f.totalApproved.value).toBe(4);
  });
  it('keeps the first row when the diameters have equally many decimals', () => {
    const kept = dedupeRows([row({ clean_name: 'T', link: link(5), center_lon: '1' }), row({ clean_name: 'T', link: link(5), center_lon: '2' })]);
    expect(kept).toHaveLength(1);
    expect(kept[0]!.center_lon).toBe('1');
  });
  it('gives two features that share a name distinct ids', () => {
    const f = selectFeatures([
      row({ clean_name: 'X', diameter: '9', type: 'Crater, craters', link: link(6) }),
      row({ clean_name: 'X', diameter: '8', type: 'Mons, montes', link: link(7) }),
    ], 's');
    expect(f.items.map((i) => i.id)).toEqual(['x', 'x-mons']);
    expect(f.totalApproved.value).toBe(2);
  });
  it('finds a feature below the size cut by exact name', () => {
    const rs = [row({ clean_name: 'Tycho', diameter: '85.294', link: link(8) }), row({ clean_name: 'Big', diameter: '500', link: link(9) })];
    expect(findFeature(rs, 'Tycho')?.diameterKm).toBeCloseTo(85.294, 3);
    expect(findFeature(rs, 'Tycho')?.id).toBe('tycho');
    expect(findFeature(rs, 'tycho')).toBeNull();
  });
});

describe('gazetteer source', () => {
  it('builds url and spec', () => {
    const zip = 'https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MARS_nomenclature_center_pts.zip';
    const url = 'https://planetarynames.wr.usgs.gov/Page/MARS/target';
    expect(gazetteerUrl(GAZETTEER_TARGETS.mars)).toBe(zip); // fetched by the pipeline; the citation links the web page
    expect(gazetteerSpec('mars', 'Mars')).toEqual({
      id: 'usgs-gazetteer-mars',
      title: 'Mars nomenclature (feature centre points), Gazetteer of Planetary Nomenclature',
      publisher: 'USGS Astrogeology Science Center / IAU Working Group for Planetary System Nomenclature',
      url,
      license: 'Public domain (USGS)',
    });
  });

  it('has a Moon target', () => {
    expect(GAZETTEER_TARGETS.moon).toBe('MOON');
    expect(gazetteerUrl(GAZETTEER_TARGETS.moon)).toBe('https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.zip');
    expect(gazetteerSpec('moon', 'Moon').url).toBe('https://planetarynames.wr.usgs.gov/Page/MOON/target');
    expect(gazetteerSpec('moon', 'Moon').id).toBe('usgs-gazetteer-moon');
  });
});
