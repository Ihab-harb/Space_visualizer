import type { Vec3 } from '../math/vec3';

export interface ConicElements {
  aKm: number;
  e: number;
  iRad: number;
  /** Longitude of the ascending node. */
  nodeRad: number;
  /** Argument of perihelion. */
  argPeriRad: number;
}

/** Rotate orbital-plane coordinates (x toward perihelion) into the ecliptic frame (JPL approx_pos formula). */
export function perifocalToEcliptic(el: ConicElements, xp: number, yp: number): Vec3 {
  const cw = Math.cos(el.argPeriRad);
  const sw = Math.sin(el.argPeriRad);
  const cO = Math.cos(el.nodeRad);
  const sO = Math.sin(el.nodeRad);
  const cI = Math.cos(el.iRad);
  const sI = Math.sin(el.iRad);
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ];
}

export function positionAtEccentricAnomaly(el: ConicElements, E: number): Vec3 {
  const xp = el.aKm * (Math.cos(E) - el.e);
  const yp = el.aKm * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  return perifocalToEcliptic(el, xp, yp);
}

/** Closed polyline of the ellipse starting at eccentric anomaly startE. */
export function orbitPolylineKm(el: ConicElements, startE: number, segments: number): Vec3[] {
  const points: Vec3[] = [];
  for (let k = 0; k <= segments; k++) {
    points.push(positionAtEccentricAnomaly(el, startE + (2 * Math.PI * k) / segments));
  }
  return points;
}

export function orbitNormal(el: ConicElements): Vec3 {
  return [Math.sin(el.iRad) * Math.sin(el.nodeRad), -Math.sin(el.iRad) * Math.cos(el.nodeRad), Math.cos(el.iRad)];
}
