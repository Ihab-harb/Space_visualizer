import { findUnresolvedSources, formatIssues } from '../../src/core/catalog/references';
import { BodiesFileSchema, ChebyshevFileSchema, RegionsFileSchema, SourcesFileSchema } from '../../src/core/catalog/schema';
import { chebyshevRange } from '../../src/core/ephemeris/chebyshev';
import { BodyDetailsSchema, type BodyDetails } from '../../src/core/details/schema';
import type { PipelineOutput } from './buildSolarSystem';

/** `ephemeris` maps each satellite's `table.file` (path under data/) to its parsed JSON; a missing entry means the file does not exist. */
export function validateOutput(output: PipelineOutput, ephemeris: ReadonlyMap<string, unknown>): string[] {
  const errors: string[] = [];
  const regions = RegionsFileSchema.safeParse(output.regions);
  if (!regions.success) errors.push(...formatIssues('regions.json', regions.error));
  const sources = SourcesFileSchema.safeParse(output.sources);
  if (!sources.success) errors.push(...formatIssues('sources.json', sources.error));
  const bodies = BodiesFileSchema.safeParse(output.bodies);
  if (!bodies.success) errors.push(...formatIssues('solar-system/bodies.json', bodies.error));

  const ids = output.sources.sources.map((s) => s.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length) errors.push(`sources.json: duplicate source ids ${duplicates.join(', ')}`);
  errors.push(...findUnresolvedSources(output.bodies, new Set(ids)).map((e) => `solar-system/bodies.json: ${e}`));
  errors.push(...validateEphemeris(output, ephemeris));
  return errors;
}

/** Each satellite's table file exists, parses, covers exactly the range the orbit claims, and cites a known source. */
function validateEphemeris(output: PipelineOutput, ephemeris: ReadonlyMap<string, unknown>): string[] {
  const errors: string[] = [];
  const known = new Set(output.sources.sources.map((s) => s.id));
  for (const body of output.bodies.bodies) {
    const orbit = body.orbit;
    if (orbit.type !== 'satellite') continue;
    const { file, validFromJdTdb, validToJdTdb, sourceId } = orbit.table;
    const raw = ephemeris.get(file);
    if (raw === undefined) { errors.push(`${body.id}: ephemeris file ${file} not found`); continue; }
    const parsed = ChebyshevFileSchema.safeParse(raw);
    if (!parsed.success) { errors.push(...formatIssues(file, parsed.error)); continue; }
    const range = chebyshevRange(parsed.data);
    if (range.fromJdTdb !== validFromJdTdb || range.toJdTdb !== validToJdTdb) {
      errors.push(`${body.id}: ${file} covers JD ${range.fromJdTdb}..${range.toJdTdb} but the orbit says ${validFromJdTdb}..${validToJdTdb}`);
    }
    if (parsed.data.bodyId !== body.id) errors.push(`${body.id}: ${file} is for body "${parsed.data.bodyId}"`);
    if (!known.has(parsed.data.sourceId)) errors.push(`${file}: unknown sourceId "${parsed.data.sourceId}"`);
    if (!known.has(sourceId)) errors.push(`${body.id}: orbit.table has unknown sourceId "${sourceId}"`);
  }
  return errors;
}

/** Details files against the merged sources (call after the new sources are merged into output.sources). */
export function validateDetails(details: readonly BodyDetails[], output: PipelineOutput): string[] {
  const errors: string[] = [];
  const known = new Set(output.sources.sources.map((s) => s.id));
  for (const d of details) {
    const parsed = BodyDetailsSchema.safeParse(d);
    if (!parsed.success) errors.push(...formatIssues(`solar-system/details/${d.bodyId}.json`, parsed.error));
    errors.push(...findUnresolvedSources(d, known).map((e) => `solar-system/details/${d.bodyId}.json: ${e}`));
  }
  return errors;
}
