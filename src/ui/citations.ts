import type { Catalog } from '../core/catalog/catalog';
import { FACT_KEYS } from '../core/catalog/facts';
import type { Body } from '../core/catalog/schema';
import type { BodyDetails } from '../core/details/schema';
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

/** Source ids of a body's details in the order DetailsSections displays them: interior, atmosphere, magnetic field, missions, discovery, features. */
export function detailsSourceOrder(details: BodyDetails | null | undefined): string[] {
  const ids: string[] = [];
  if (!details) return ids;
  const add = (id: string | undefined) => {
    if (id && !ids.includes(id)) ids.push(id);
  };
  for (const layer of details.interior?.layers ?? []) {
    add(layer.outerRadiusKm.sourceId);
    add(layer.innerRadiusKm.sourceId);
    add(layer.composition?.sourceId);
  }
  if (details.atmosphere) {
    for (const gas of details.atmosphere.major) add(gas.sourceId);
    for (const gas of details.atmosphere.minor) add(gas.sourceId);
    add(details.atmosphere.note?.sourceId);
  }
  const mag = details.magnetosphere;
  if (mag.kind === 'none') add(mag.sourceId);
  else if (mag.kind === 'other') add(mag.note.sourceId);
  else {
    add(mag.strengthGaussR3.sourceId);
    add(mag.tiltDeg?.sourceId);
    add(mag.tiltLongitudeDeg?.sourceId);
    add(mag.dipolePole?.sourceId);
    add(mag.offsetRadii?.sourceId);
    add(mag.referenceRadiusKm.sourceId);
    add(mag.surfaceFieldGauss?.sourceId);
  }
  for (const mission of details.missions) add(mission.sourceId);
  add(details.discovery?.sourceId);
  if (details.features) {
    add(details.features.totalApproved.sourceId);
    add(details.features.sourceId);
  }
  return ids;
}

/**
 * The one numbering shared by the header and the drawer: the body's own sources, then the live position model,
 * then the details sources. Details only ever append, so a number shown before they load never changes.
 */
export function citationModel(
  catalog: Catalog,
  body: Body,
  details?: BodyDetails | null,
): { order: string[]; numbers: Map<string, number>; liveSource: string | null } {
  const order = citationOrder(body);
  const earth = catalog.bodyById.get('earth');
  const liveSource = body.orbit.type === 'planet-approx' ? body.orbit.sourceId : earth?.orbit.type === 'planet-approx' ? earth.orbit.sourceId : null;
  if (liveSource && !order.includes(liveSource)) order.push(liveSource);
  for (const id of detailsSourceOrder(details)) if (!order.includes(id)) order.push(id);
  return { order, numbers: citationNumbers(order), liveSource };
}
