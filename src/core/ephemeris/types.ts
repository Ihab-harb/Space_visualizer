import type { Vec3 } from '../math/vec3';

export interface BodyState {
  /** Heliocentric ecliptic J2000 position, km. */
  positionKm: Vec3;
  /** False when the date is outside every validity range of the body's model. */
  inValidRange: boolean;
  /** Which model table produced the position (planet-approx only). */
  tableId: string | null;
}
