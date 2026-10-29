import type { Catalog } from '../core/catalog/catalog';
import type { Body } from '../core/catalog/schema';
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
  return {
    fromSunKm,
    fromEarthKm,
    fromParentKm,
    lightTimeS: fromEarthKm === null ? null : fromEarthKm / SPEED_OF_LIGHT_KM_S,
    sourceId: citationModel(catalog, body).liveSource,
  };
}
