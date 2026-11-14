import { describe, expect, it } from 'vitest';
import { makeCatalogFiles, makeMoon } from '../../test/fixtures';
import { BodiesFileSchema, BodySchema, ImageryFileSchema, RegionsFileSchema, SourcesFileSchema, TextureRefSchema } from './schema';
import { collectSourceIds, findUnresolvedSources, formatIssues } from './references';

describe('catalogue schema', () => {
  it('accepts the fixture catalogue', () => {
    const files = makeCatalogFiles();
    expect(RegionsFileSchema.safeParse(files.regions).success).toBe(true);
    expect(SourcesFileSchema.safeParse(files.sources).success).toBe(true);
    const parsed = BodiesFileSchema.safeParse(files.bodies);
    if (!parsed.success) throw new Error(formatIssues('bodies.json', parsed.error).join('\n'));
  });

  it('rejects a fact without a sourceId and names the field path', () => {
    const files = makeCatalogFiles();
    delete (files.bodies.bodies[2]!.facts.massKg as { sourceId?: string }).sourceId;
    const parsed = BodiesFileSchema.safeParse(files.bodies);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(formatIssues('bodies.json', parsed.error).join('\n')).toContain('bodies.json: bodies.2.facts.massKg.sourceId');
    }
  });

  it('rejects non-finite numbers, bad eccentricity and unknown categories', () => {
    const nan = makeCatalogFiles();
    nan.bodies.bodies[2]!.facts.massKg!.value = Number.NaN;
    expect(BodiesFileSchema.safeParse(nan.bodies).success).toBe(false);

    const ecc = makeCatalogFiles();
    const orbit = ecc.bodies.bodies[2]!.orbit;
    if (orbit.type !== 'planet-approx') throw new Error('fixture changed');
    orbit.tables[0]!.elements.e = 1.2;
    expect(BodiesFileSchema.safeParse(ecc.bodies).success).toBe(false);

    const cat = makeCatalogFiles();
    (cat.bodies.bodies[2] as { category: string }).category = 'blob';
    expect(BodiesFileSchema.safeParse(cat.bodies).success).toBe(false);
  });
});

describe('source references', () => {
  it('collects every sourceId with its path', () => {
    const refs = collectSourceIds({ a: { sourceId: 'x' }, list: [{ sourceId: 'y' }] });
    expect(refs).toEqual([
      { path: 'a.sourceId', sourceId: 'x' },
      { path: 'list.0.sourceId', sourceId: 'y' },
    ]);
  });

  it('reports unresolved sources in the fixture when a source is removed', () => {
    const files = makeCatalogFiles();
    const known = new Set(files.sources.sources.map((s) => s.id));
    expect(findUnresolvedSources(files.bodies, known)).toEqual([]);
    known.delete('nasa-science-jupiter');
    expect(findUnresolvedSources(files.bodies, known)).toEqual([
      'bodies.2.description.sourceId: unknown sourceId "nasa-science-jupiter"',
    ]);
  });
});

describe('imagery schema', () => {
  it('accepts tiered textures with a source and rejects empty ones', () => {
    expect(TextureRefSchema.safeParse({ tiers: { '1k': 'textures/earth/color_1k.webp' }, sourceId: 'nasa-blue-marble-ng' }).success).toBe(true);
    expect(TextureRefSchema.safeParse({ tiers: {}, sourceId: 'x' }).success).toBe(false);
    expect(TextureRefSchema.safeParse({ tiers: { '16k': 'a' }, sourceId: 'x' }).success).toBe(false);
  });
  it('validates an imagery file with rings', () => {
    const file = {
      schemaVersion: 1,
      generatedAt: '2026-10-04T12:00:00.000Z',
      sources: [],
      bodies: {
        saturn: {
          color: { tiers: { '2k': 'textures/saturn/color_2k.webp' }, sourceId: 'stsci-opal' },
          rings: {
            texture: { tiers: { '2k': 'textures/saturn/rings_2k.webp' }, sourceId: 'nssdca-saturn-rings', illustrative: true },
            innerKm: { value: 74658, sourceId: 'nssdca-saturn-rings' },
            outerKm: { value: 139826, sourceId: 'nssdca-saturn-rings' },
          },
        },
      },
    };
    expect(ImageryFileSchema.safeParse(file).success).toBe(true);
  });
  it('requires render settings on every body', () => {
    const f = makeCatalogFiles();
    delete (f.bodies.bodies[0] as { render?: unknown }).render;
    expect(BodiesFileSchema.safeParse(f.bodies).success).toBe(false);
  });
});

describe('satellite bodies', () => {
  it('accepts the fixture Moon', () => {
    expect(BodySchema.safeParse(makeMoon()).success).toBe(true);
  });
  it('rejects a barycentre mass ratio outside (0, 1)', () => {
    for (const value of [0, 1, 1.5, -0.01, 'x']) {
      const moon = makeMoon();
      if (moon.orbit.type !== 'satellite') throw new Error('fixture');
      moon.orbit.barycentre = { massRatio: { value, sourceId: 'naif-gm-de440' } };
      expect(BodySchema.safeParse(moon).success).toBe(false);
    }
  });
  it('rejects a satellite without a parent', () => {
    expect(BodySchema.safeParse({ ...makeMoon(), parentId: null }).success).toBe(false);
  });
});
