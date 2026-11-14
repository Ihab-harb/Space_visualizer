import type { z } from 'zod';
import { createCatalog, type Catalog } from '../core/catalog/catalog';
import { findUnresolvedSources, formatIssues } from '../core/catalog/references';
import { BodiesFileSchema, RegionsFileSchema, SourcesFileSchema, type BodiesFile } from '../core/catalog/schema';

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(`Invalid ${label}:\n${formatIssues(label, result.error).slice(0, 10).join('\n')}`);
  return result.data;
}

export async function loadCatalog(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<Catalog> {
  const getJson = async (file: string): Promise<unknown> => {
    const res = await fetchImpl(`${baseUrl}data/${file}`);
    if (!res.ok) throw new Error(`Could not load data/${file} (HTTP ${res.status}).`);
    return res.json();
  };
  const regions = parseOrThrow(RegionsFileSchema, await getJson('regions.json'), 'regions.json');
  const sources = parseOrThrow(SourcesFileSchema, await getJson('sources.json'), 'sources.json');
  const bodiesFiles: BodiesFile[] = [];
  for (const region of regions.regions) {
    bodiesFiles.push(parseOrThrow(BodiesFileSchema, await getJson(region.dataManifest), region.dataManifest));
  }
  const known = new Set(sources.sources.map((s) => s.id));
  const unresolved = bodiesFiles.flatMap((file) => findUnresolvedSources(file, known));
  if (unresolved.length > 0) throw new Error(`Data references unknown sources:\n${unresolved.join('\n')}`);
  return createCatalog(regions, sources, bodiesFiles);
}
