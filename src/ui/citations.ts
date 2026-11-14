import { FACT_KEYS } from '../core/catalog/facts';
import type { Body } from '../core/catalog/schema';
import { imageryLines } from './imagery';

/** Unique source ids in the order the panel displays them. */
export function citationOrder(body: Body): string[] {
  const ids: string[] = [];
  const add = (id: string | undefined) => {
    if (id && !ids.includes(id)) ids.push(id);
  };
  add(body.description?.sourceId);
  for (const key of FACT_KEYS) add(body.facts[key]?.sourceId);
  if (body.orbit.type === 'planet-approx') {
    add(body.orbit.sourceId);
    for (const table of body.orbit.tables) add(table.horizonsCheck?.sourceId);
  }
  add(body.rotation?.sourceId);
  add(body.shape.sourceId);
  for (const imageryLine of imageryLines(body)) add(imageryLine.sourceId);
  add(body.imagery?.rings?.innerKm.sourceId);
  add(body.imagery?.rings?.outerKm.sourceId);
  return ids;
}

export function citationNumbers(order: string[]): Map<string, number> {
  return new Map(order.map((id, i) => [id, i + 1]));
}
