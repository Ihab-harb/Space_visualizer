import { findUnresolvedSources, formatIssues } from '../../src/core/catalog/references';
import { BodiesFileSchema, RegionsFileSchema, SourcesFileSchema } from '../../src/core/catalog/schema';
import { BodyDetailsSchema, type BodyDetails } from '../../src/core/details/schema';
import type { PipelineOutput } from './buildSolarSystem';

export function validateOutput(output: PipelineOutput): string[] {
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
