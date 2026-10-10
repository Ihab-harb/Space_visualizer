import type { Catalog } from '../core/catalog/catalog';
import type { Body } from '../core/catalog/schema';
import { bodyState } from '../core/ephemeris/state';
import { distance } from '../core/math/vec3';
import { SPEED_OF_LIGHT_KM_S } from '../core/units';
import { citationModel } from './citations';

export interface LiveStats {
  fromSunKm: number | null;
  fromEarthKm: number | null;
  lightTimeS: number | null;
  /** The position model behind these values: the body's own, or Earth's when the body is fixed (the Sun). */
  sourceId: string | null;
}

export function liveStats(catalog: Catalog, body: Body, jdTdb: number): LiveStats {
  const position = bodyState(body, jdTdb).positionKm;
  const sun = catalog.bodies.find((b) => b.category === 'star');
  const earth = catalog.bodyById.get('earth');
  const fromSunKm = sun && sun.id !== body.id ? distance(position, bodyState(sun, jdTdb).positionKm) : null;
  const fromEarthKm = earth && earth.id !== body.id ? distance(position, bodyState(earth, jdTdb).positionKm) : null;
  return {
    fromSunKm,
    fromEarthKm,
    lightTimeS: fromEarthKm === null ? null : fromEarthKm / SPEED_OF_LIGHT_KM_S,
    sourceId: citationModel(catalog, body).liveSource,
  };
}
