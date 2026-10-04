import { makeCatalogFiles } from './fixtures';

/** Fake fetch for `${BASE_URL}data/<file>`; an override of `undefined` simulates a missing file (HTTP 404). */
export function serveCatalog(overrides: Record<string, unknown> = {}): typeof fetch {
  const f = makeCatalogFiles();
  const table: Record<string, unknown> = {
    'regions.json': f.regions,
    'sources.json': f.sources,
    'solar-system/bodies.json': f.bodies,
    ...overrides,
  };
  return (async (url: string | URL) => {
    const key = String(url).replace(/^.*\/data\//, '');
    if (!(key in table) || table[key] === undefined) return new Response('missing', { status: 404 });
    return new Response(JSON.stringify(table[key]), { status: 200 });
  }) as unknown as typeof fetch;
}
