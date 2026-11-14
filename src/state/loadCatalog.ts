import type { z } from 'zod';
import { createCatalog, type Catalog } from '../core/catalog/catalog';
import { findUnresolvedSources, formatIssues } from '../core/catalog/references';
import { BodiesFileSchema, ChebyshevFileSchema, RegionsFileSchema, SourcesFileSchema, type BodiesFile, type ChebyshevFile } from '../core/catalog/schema';
import { chebyshevRange } from '../core/ephemeris/chebyshev';

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
  const loadTable = async (bodyId: string, file: string, sourceId: string, from: number, to: number): Promise<ChebyshevFile> => {
    const label = `data/${file}`;
    const fail = (why: string): never => {
      throw new Error(`Could not load ${label} (${why}).`);
    };
    let raw: unknown;
    try {
      raw = await getJson(file);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Already names the file when it is an HTTP error; otherwise name it here.
      if (message.includes(label)) throw e;
      return fail(message);
    }
    const parsed = ChebyshevFileSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(`invalid: ${formatIssues(file, parsed.error).slice(0, 3).join('; ')}`);
    }
    const table = parsed.data;
    if (table.bodyId !== bodyId) fail(`bodyId is "${table.bodyId}", expected "${bodyId}"`);
    if (table.sourceId !== sourceId) fail(`sourceId is "${table.sourceId}", expected "${sourceId}"`);
    const range = chebyshevRange(table);
    if (range.fromJdTdb > from || range.toJdTdb < to) {
      fail(`range ${range.fromJdTdb} to ${range.toJdTdb} does not cover ${from} to ${to}`);
    }
    return table;
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
  const tables = new Map<string, ChebyshevFile>();
  for (const body of bodiesFiles.flatMap((file) => file.bodies)) {
    if (body.orbit.type !== 'satellite') continue;
    const { file, sourceId, validFromJdTdb, validToJdTdb } = body.orbit.table;
    tables.set(body.id, await loadTable(body.id, file, sourceId, validFromJdTdb, validToJdTdb));
  }
  return createCatalog(regions, sources, bodiesFiles, tables);
}
