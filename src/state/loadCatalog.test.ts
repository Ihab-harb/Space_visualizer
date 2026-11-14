import { beforeEach, describe, expect, it } from 'vitest';
import { makeCatalogFiles, makeMoon, makeMoonTable } from '../test/fixtures';
import { serveCatalog as serve } from '../test/serveCatalog';
import { useCatalogStore } from './catalogStore';
import { loadCatalog } from './loadCatalog';

describe('loadCatalog', () => {
  it('loads and validates every file', async () => {
    const catalog = await loadCatalog('/', serve());
    expect(catalog.bodies.map((b) => b.id)).toEqual(['sun', 'earth', 'jupiter']);
  });
  it('names the missing file and HTTP status', async () => {
    await expect(loadCatalog('/', serve({ 'sources.json': undefined }))).rejects.toThrow('Could not load data/sources.json (HTTP 404).');
  });
  it('names the invalid file and field', async () => {
    const f = makeCatalogFiles();
    f.bodies.bodies[0]!.name = '';
    await expect(loadCatalog('/', serve({ 'solar-system/bodies.json': f.bodies }))).rejects.toThrow(/Invalid solar-system\/bodies\.json[\s\S]*bodies\.0\.name/);
  });
  it('rejects data that cites unknown sources', async () => {
    const f = makeCatalogFiles();
    f.sources.sources = f.sources.sources.filter((s) => s.id !== 'jpl-horizons');
    await expect(loadCatalog('/', serve({ 'sources.json': f.sources }))).rejects.toThrow(/unknown sourceId "jpl-horizons"/);
  });
});

describe('loadCatalog with the Moon', () => {
  const withMoon = (tableOverride?: unknown) => {
    const f = makeCatalogFiles();
    f.bodies.bodies.push(makeMoon());
    return serve({ 'solar-system/bodies.json': f.bodies, 'solar-system/ephemeris/moon.json': tableOverride });
  };
  it('loads the ephemeris table', async () => {
    const catalog = await loadCatalog('/', withMoon(makeMoonTable()));
    expect(catalog.ephemerisTables.get('moon')?.bodyId).toBe('moon');
    expect(catalog.bodies.map((b) => b.id)).toContain('moon');
  });
  it('names the file when the table is missing', async () => {
    await expect(loadCatalog('/', withMoon())).rejects.toThrow(/Could not load data\/solar-system\/ephemeris\/moon\.json/);
  });
  it('names the file when the table is invalid', async () => {
    await expect(loadCatalog('/', withMoon({ nonsense: true }))).rejects.toThrow(/ephemeris\/moon\.json/);
  });
  it('rejects a table whose bodyId does not match', async () => {
    await expect(loadCatalog('/', withMoon({ ...makeMoonTable(), bodyId: 'earth' }))).rejects.toThrow(/ephemeris\/moon\.json[\s\S]*bodyId/);
  });
  it('rejects a table that does not cover the declared range', async () => {
    const t = makeMoonTable();
    await expect(loadCatalog('/', withMoon({ ...t, segments: t.segments.slice(0, 2) }))).rejects.toThrow(/ephemeris\/moon\.json[\s\S]*range/);
  });
  it('rejects a table with a different source', async () => {
    await expect(loadCatalog('/', withMoon({ ...makeMoonTable(), sourceId: 'jpl-approx-pos' }))).rejects.toThrow(/ephemeris\/moon\.json[\s\S]*sourceId/);
  });
});

describe('catalogStore', () => {
  beforeEach(() => useCatalogStore.setState({ status: 'idle', catalog: null, error: null }));
  it('moves to ready on success', async () => {
    await useCatalogStore.getState().load(serve());
    expect(useCatalogStore.getState().status).toBe('ready');
  });
  it('moves to error with a readable message on failure', async () => {
    await useCatalogStore.getState().load(serve({ 'regions.json': undefined }));
    expect(useCatalogStore.getState()).toMatchObject({ status: 'error', error: 'Could not load data/regions.json (HTTP 404).' });
  });
});
