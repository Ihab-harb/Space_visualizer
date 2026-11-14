import type { Catalog } from '../core/catalog/catalog';
import type { Body } from '../core/catalog/schema';
import { moonPhase, type MoonPhase } from '../core/ephemeris/phase';
import { systemState } from '../core/ephemeris/system';
import { distance } from '../core/math/vec3';
import { SPEED_OF_LIGHT_KM_S } from '../core/units';
import { citationModel } from './citations';

export interface LiveStats {
  fromSunKm: number | null;
  fromEarthKm: number | null;
  /** Distance from the body's parent; null when the parent is a star (that is the Sun distance). */
  fromParentKm: number | null;
  lightTimeS: number | null;
  /** Phase as seen from Earth; non-null only for a satellite of Earth. */
  phase: MoonPhase | null;
  /** The position model behind these values: the body's own, or Earth's when the body is fixed (the Sun). */
  sourceId: string | null;
}

export function liveStats(catalog: Catalog, body: Body, jdTdb: number): LiveStats {
  const states = systemState(catalog.bodies, catalog.ephemerisTables, jdTdb);
  const position = states.get(body.id)!.positionKm;
  const sun = catalog.bodies.find((b) => b.category === 'star');
  const earth = catalog.bodyById.get('earth');
  const parent = body.parentId ? catalog.bodyById.get(body.parentId) : undefined;
  const fromSunKm = sun && sun.id !== body.id ? distance(position, states.get(sun.id)!.positionKm) : null;
  const fromEarthKm = earth && earth.id !== body.id ? distance(position, states.get(earth.id)!.positionKm) : null;
  const fromParentKm = parent && parent.category !== 'star' ? distance(position, states.get(parent.id)!.positionKm) : null;
  const phase = sun && parent?.id === 'earth' && body.orbit?.type === 'satellite' ? moonPhase(states.get(sun.id)!.positionKm, states.get(parent.id)!.positionKm, position) : null;
  // A satellite outside its table is on the mean elements; cite those, not the table's source.
  const own = body.orbit?.type === 'satellite' && states.get(body.id)!.tableId === 'mean-elements' ? body.orbit.meanElements.sourceId : null;
  const sourceId = own ?? citationModel(catalog, body).liveSource;
  return {
    fromSunKm,
    fromEarthKm,
    fromParentKm,
    lightTimeS: fromEarthKm === null ? null : fromEarthKm / SPEED_OF_LIGHT_KM_S,
    phase,
    sourceId,
  };
}
