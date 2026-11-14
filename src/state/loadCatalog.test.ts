import { beforeEach, describe, expect, it } from 'vitest';
import { makeCatalogFiles } from '../test/fixtures';
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
