import type { Body, BodiesFile, Region, RegionsFile, Source, SourcesFile } from './schema';

export interface Catalog {
  regions: readonly Region[];
  sources: ReadonlyMap<string, Source>;
  bodies: readonly Body[];
  bodyById: ReadonlyMap<string, Body>;
}

export function createCatalog(regions: RegionsFile, sources: SourcesFile, bodiesFiles: readonly BodiesFile[]): Catalog {
  const bodies = bodiesFiles.flatMap((file) => file.bodies);
  const bodyById = new Map<string, Body>();
  for (const body of bodies) {
    if (bodyById.has(body.id)) throw new Error(`Duplicate body id "${body.id}" in catalogue`);
    bodyById.set(body.id, body);
  }
  return { regions: regions.regions, sources: new Map(sources.sources.map((s) => [s.id, s])), bodies, bodyById };
}

export function getBody(catalog: Catalog, id: string): Body {
  const body = catalog.bodyById.get(id);
  if (!body) throw new Error(`Unknown body "${id}"`);
  return body;
}
