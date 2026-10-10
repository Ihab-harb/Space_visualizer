import { findUnresolvedSources } from '../catalog/references';
import type { BodyDetails } from './schema';

const EPS = 1e-6;
const validDate = (d: string) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

/** Spec §5 build checks. Returns one message per failed rule; empty means the file is consistent. */
export function checkDetails(details: BodyDetails, ctx: { radiusKm: number; knownSources: ReadonlySet<string> }): string[] {
  const p = `details/${details.bodyId}.json:`;
  const errors: string[] = [];
  const layers = details.interior?.layers ?? [];
  layers.forEach((layer, i) => {
    for (const [label, r] of [['outer', layer.outerRadiusKm], ['inner', layer.innerRadiusKm]] as const) {
      if (r.min < -EPS || r.max > ctx.radiusKm * 1.001) errors.push(`${p} interior ${layer.id} ${label} radius ${r.min}-${r.max} km outside 0-${ctx.radiusKm} km`);
    }
    if (layer.innerRadiusKm.min > layer.outerRadiusKm.max + EPS) errors.push(`${p} interior ${layer.id} inner radius above outer radius`);
    const next = layers[i + 1];
    if (next && next.outerRadiusKm.min > layer.outerRadiusKm.max + EPS) errors.push(`${p} interior layers out of order at ${layer.id} -> ${next.id} (outside in)`);
    if (next && (layer.innerRadiusKm.min > next.outerRadiusKm.max + EPS || next.outerRadiusKm.min > layer.innerRadiusKm.max + EPS)) {
      errors.push(`${p} interior gap or overlap between ${layer.id} and ${next.id} (inner ${layer.innerRadiusKm.min}–${layer.innerRadiusKm.max} km vs outer ${next.outerRadiusKm.min}–${next.outerRadiusKm.max} km)`);
    }
  });
  const innermost = layers.at(-1);
  if (innermost && innermost.innerRadiusKm.max > EPS) errors.push(`${p} innermost layer ${innermost.id} must have inner radius 0`);
  const atm = details.atmosphere;
  if (atm) {
    const total = atm.major.reduce((s, g) => s + g.amount, 0);
    if (total > 100.5) errors.push(`${p} major gases sum to ${total.toFixed(2)} %, over 100 %`);
    for (const g of atm.minor) if (g.amount >= 1e6) errors.push(`${p} minor gas ${g.formula} ${g.amount} ppm is not below 10^6 ppm`);
  }
  const f = details.features;
  if (f) {
    if (f.items.length > 200) errors.push(`${p} ${f.items.length} features exceeds the 200 cap`);
    if (f.items.length > f.totalApproved.value) errors.push(`${p} ${f.items.length} features exceeds the approved total ${f.totalApproved.value}`);
    for (const it of f.items) {
      if (it.latDeg < -90 || it.latDeg > 90) errors.push(`${p} feature ${it.name} latitude ${it.latDeg} outside [-90, 90]`);
      if (it.lonDegE < 0 || it.lonDegE >= 360) errors.push(`${p} feature ${it.name} longitude ${it.lonDegE} outside [0, 360)`);
      if (!(it.diameterKm > 0)) errors.push(`${p} feature ${it.name} diameter must be > 0`);
    }
  }
  for (const m of details.missions) {
    for (const d of [m.launchDate, m.arrivalDate, m.endDate]) if (d && !validDate(d)) errors.push(`${p} mission ${m.id} has invalid date ${d}`);
    if (m.arrivalDate && m.arrivalDate < m.launchDate) errors.push(`${p} mission ${m.id} arrival ${m.arrivalDate} before launch ${m.launchDate}`);
    if (m.endDate && m.endDate < (m.arrivalDate ?? m.launchDate)) errors.push(`${p} mission ${m.id} end ${m.endDate} before arrival/launch`);
  }
  const mag = details.magnetosphere;
  if (mag.kind === 'dipole') {
    if (!(mag.strengthGaussR3.value > 0)) errors.push(`${p} dipole strength must be > 0`);
    if (mag.tiltDeg && (mag.tiltDeg.value < 0 || mag.tiltDeg.value > 180)) errors.push(`${p} dipole tilt ${mag.tiltDeg.value} outside [0, 180]`);
    if (mag.offsetRadii && (mag.offsetRadii.value < 0 || mag.offsetRadii.value > 1)) errors.push(`${p} dipole offset ${mag.offsetRadii.value} outside [0, 1]`);
  }
  errors.push(...findUnresolvedSources(details, ctx.knownSources).map((e) => `${p} ${e}`));
  return errors;
}
