import { readFileSync } from 'node:fs';
import { createCatalog, type Catalog } from '../core/catalog/catalog';
import type { BodiesFile, RegionsFile, SourcesFile } from '../core/catalog/schema';
import type { BodyDetails } from '../core/details/schema';

const json = <T,>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

/** The built catalogue in public/data (bodies, regions, every source), for tests that check real cited text. */
export function realCatalog(): Catalog {
  return createCatalog(json<RegionsFile>('public/data/regions.json'), json<SourcesFile>('public/data/sources.json'), [json<BodiesFile>('public/data/solar-system/bodies.json')]);
}

export function realDetails(bodyId: string): BodyDetails {
  return json<BodyDetails>(`public/data/solar-system/details/${bodyId}.json`);
}
