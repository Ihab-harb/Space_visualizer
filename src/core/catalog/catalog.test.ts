import { describe, expect, it } from 'vitest';
import { makeCatalogFiles } from '../../test/fixtures';
import { createCatalog, getBody } from './catalog';

describe('createCatalog', () => {
  it('indexes bodies and sources', () => {
    const f = makeCatalogFiles();
    const catalog = createCatalog(f.regions, f.sources, [f.bodies]);
    expect(catalog.bodies.map((b) => b.id)).toEqual(['sun', 'earth', 'jupiter']);
    expect(getBody(catalog, 'jupiter').name).toBe('Jupiter');
    expect(catalog.sources.get('naif-pck00011')?.publisher).toContain('NAIF');
  });
  it('rejects duplicate body ids and unknown lookups', () => {
    const f = makeCatalogFiles();
    expect(() => createCatalog(f.regions, f.sources, [f.bodies, f.bodies])).toThrow(/Duplicate body id "sun"/);
    expect(() => getBody(createCatalog(f.regions, f.sources, [f.bodies]), 'vulcan')).toThrow(/Unknown body "vulcan"/);
  });
});
