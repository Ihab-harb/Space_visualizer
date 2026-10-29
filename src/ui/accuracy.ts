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

export function accuracyLines(body: Body): AccuracyLine[] {
  const orbit = body.orbit;
  if (orbit.type === 'fixed') return [{ text: orbit.note, sourceIds: [] }];
  // Satellite accuracy lines arrive with the Moon drawer work.
  if (orbit.type === 'satellite') return [{ text: orbit.meanElements.note, sourceIds: [orbit.meanElements.sourceId] }];
  const lines: AccuracyLine[] = orbit.tables.map((t) => {
    const nominal = `${TABLE_LABELS[t.id] ?? t.id}: JPL nominal error ${formatNumber(t.nominalError.longitudeArcsec)}″ in longitude, ${formatNumber(t.nominalError.latitudeArcsec)}″ in latitude, ${formatNumber(t.nominalError.distanceKm)} km in distance.`;
    if (!t.horizonsCheck) return { text: nominal, sourceIds: [orbit.sourceId] };
    const check = ` Measured against JPL Horizons at ${t.horizonsCheck.sampleCount} dates: up to ${formatNumber(t.horizonsCheck.maxAngularErrorArcsec)}″ in direction and ${formatNumber(t.horizonsCheck.maxDistanceErrorKm)} km in distance.`;
    return { text: nominal + check, sourceIds: [orbit.sourceId, t.horizonsCheck.sourceId] };
  });
  if (orbit.represents === 'earth-moon-barycenter') {
    lines.push({ text: 'Earth is drawn at the Earth–Moon barycentre; the Moon arrives in a later release.', sourceIds: [] });
  }
  return lines;
}
