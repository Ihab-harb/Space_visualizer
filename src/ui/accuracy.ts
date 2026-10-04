import type { Body } from '../core/catalog/schema';
import { formatNumber } from './format';

const TABLE_LABELS: Record<string, string> = {
  '1800-2050': '1800–2050',
  '3000BC-3000AD': '3000 BC–AD 3000',
};

export function accuracyLines(body: Body): string[] {
  const orbit = body.orbit;
  if (orbit.type === 'fixed') return [orbit.note];
  const lines = orbit.tables.map((t) => {
    const nominal = `${TABLE_LABELS[t.id] ?? t.id}: JPL nominal error ${formatNumber(t.nominalError.longitudeArcsec)}″ in longitude, ${formatNumber(t.nominalError.latitudeArcsec)}″ in latitude, ${formatNumber(t.nominalError.distanceKm)} km in distance.`;
    const check = t.horizonsCheck
      ? ` Measured against JPL Horizons at ${t.horizonsCheck.sampleCount} dates: up to ${formatNumber(t.horizonsCheck.maxAngularErrorArcsec)}″ in direction and ${formatNumber(t.horizonsCheck.maxDistanceErrorKm)} km in distance.`
      : '';
    return nominal + check;
  });
  if (orbit.represents === 'earth-moon-barycenter') {
    lines.push('Earth is drawn at the Earth–Moon barycentre; the Moon arrives in a later release.');
  }
  return lines;
}
