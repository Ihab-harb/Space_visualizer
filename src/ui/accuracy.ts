import type { Catalog } from '../core/catalog/catalog';
import type { Body } from '../core/catalog/schema';
import { formatNumber } from './format';

const TABLE_LABELS: Record<string, string> = {
  '1800-2050': '1800–2050',
  '3000BC-3000AD': '3000 BC–AD 3000',
};

export interface AccuracyLine {
  text: string;
  /** Sources of the figures in this line (empty for explanatory notes). */
  sourceIds: string[];
}

/** Angular errors of a degree or more read better in degrees; smaller ones in arcseconds. */
function formatAngle(arcsec: number): string {
  return arcsec >= 3600 ? `${formatNumber(Number((arcsec / 3600).toPrecision(3)))}°` : `${formatNumber(arcsec)}″`;
}

export function accuracyLines(body: Body, catalog?: Catalog): AccuracyLine[] {
  const orbit = body.orbit;
  if (orbit.type === 'fixed') return [{ text: orbit.note, sourceIds: [] }];
  if (orbit.type === 'satellite') {
    const t = orbit.table;
    const m = orbit.meanElements;
    const lines: AccuracyLine[] = [
      {
        text: `1800–2050: JPL Horizons, compressed to Chebyshev polynomials. Measured against Horizons at ${t.horizonsCheck.sampleCount} times: up to ${formatNumber(t.horizonsCheck.maxDistanceErrorKm)} km and ${formatAngle(t.horizonsCheck.maxAngularErrorArcsec)} as seen from Earth's centre.`,
        sourceIds: [t.sourceId, t.horizonsCheck.sourceId].filter((id, i, a) => a.indexOf(id) === i),
      },
    ];
    const check = m.horizonsCheck;
    lines.push(
      check
        ? {
            text: `Other dates: JPL mean elements. Measured against Horizons at ${check.sampleCount} dates: up to ${formatAngle(check.maxAngularErrorArcsec)} and ${formatNumber(check.maxDistanceErrorKm)} km off.`,
            sourceIds: [m.sourceId, check.sourceId],
          }
        : { text: 'Other dates: JPL mean elements.', sourceIds: [m.sourceId] },
    );
    lines.push({ text: m.note, sourceIds: [m.sourceId] });
    return lines;
  }
  const lines: AccuracyLine[] = orbit.tables.map((t) => {
    const nominal = `${TABLE_LABELS[t.id] ?? t.id}: JPL nominal error ${formatNumber(t.nominalError.longitudeArcsec)}″ in longitude, ${formatNumber(t.nominalError.latitudeArcsec)}″ in latitude, ${formatNumber(t.nominalError.distanceKm)} km in distance.`;
    if (!t.horizonsCheck) return { text: nominal, sourceIds: [orbit.sourceId] };
    const check = ` Measured against JPL Horizons at ${t.horizonsCheck.sampleCount} dates: up to ${formatNumber(t.horizonsCheck.maxAngularErrorArcsec)}″ in direction and ${formatNumber(t.horizonsCheck.maxDistanceErrorKm)} km in distance.`;
    return { text: nominal + check, sourceIds: [orbit.sourceId, t.horizonsCheck.sourceId] };
  });
  if (orbit.represents === 'earth-moon-barycenter') {
    const moon = catalog?.bodies.find((b) => b.parentId === body.id && b.orbit.type === 'satellite');
    const bary = moon?.orbit.type === 'satellite' ? moon.orbit.barycentre : null;
    if (bary) {
      const check = orbit.centreCheck;
      const measured = check
        ? ` Measured against JPL Horizons at ${check.sampleCount} dates: up to ${formatNumber(check.maxDistanceErrorKm)} km in distance and ${formatAngle(check.maxAngularErrorArcsec)} in direction.`
        : '';
      lines.push({
        text: `Earth is drawn at its own centre: the barycentre position minus the Moon's share (μ = ${String(bary.massRatio.value)}).${measured}`,
        sourceIds: check ? [bary.massRatio.sourceId, check.sourceId] : [bary.massRatio.sourceId],
      });
    }
    lines.push({ text: "The orbit line shows the Earth–Moon barycentre's path.", sourceIds: [] });
  }
  return lines;
}
