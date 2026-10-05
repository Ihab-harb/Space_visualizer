import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCatalog, getBody } from '../../core/catalog/catalog';
import { BodiesFileSchema, RegionsFileSchema, SourcesFileSchema } from '../../core/catalog/schema';
import { bodyState } from '../../core/ephemeris/state';
import { bodyFixedToEcliptic } from '../../core/frames/rotation';
import { computeBodyFrameUniforms } from './bodyUniforms';

const read = (f: string): unknown => JSON.parse(readFileSync(`public/data/${f}`, 'utf8'));

describe('Saturn ring geometry in the golden view (JD 2453371.5, 2005-01-01)', () => {
  it('has the Sun below the ring plane, so the ring shadow falls on the northern (+Z) hemisphere', () => {
    const regions = RegionsFileSchema.parse(read('regions.json'));
    const sources = SourcesFileSchema.parse(read('sources.json'));
    const files = regions.regions.map((r) => BodiesFileSchema.parse(read(r.dataManifest)));
    const catalog = createCatalog(regions, sources, files);
    const saturn = getBody(catalog, 'saturn');
    const sun = getBody(catalog, 'sun');
    const jd = 2453371.5;
    const u = computeBodyFrameUniforms({
      bodyPosKm: bodyState(saturn, jd).positionKm,
      cameraPosKm: bodyState(saturn, jd).positionKm,
      sunPosKm: bodyState(sun, jd).positionKm,
      orientation: bodyFixedToEcliptic(saturn.rotation!, jd),
      renderRadiusKm: saturn.shape.equatorialRadiusKm,
      trueRadiusKm: saturn.shape.equatorialRadiusKm,
      sunRadiusKm: sun.shape.equatorialRadiusKm,
      occluders: [],
    });
    const elevationDeg = (Math.asin(u.sunDirObj[2]) * 180) / Math.PI;
    expect(u.sunDirObj[2]).toBeLessThan(0);
    expect(Math.abs(elevationDeg - -23)).toBeLessThan(3);
  });
});
