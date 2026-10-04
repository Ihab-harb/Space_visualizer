import { describe, expect, it } from 'vitest';
import { makeCatalogFiles } from '../../test/fixtures';
import { BodiesFileSchema, RegionsFileSchema, SourcesFileSchema } from './schema';
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
