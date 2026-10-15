import type { Body } from '../core/catalog/schema';
import { formatAu, formatDuration, formatLightTimeShort, formatNumber, formatPeriodDays } from './format';
import type { BodyDetails } from '../core/details/schema';
import type { LiveStats } from './liveStats';

export type NarrativePart = { kind: 'text'; text: string } | { kind: 'value'; text: string; sourceId: string };

const t = (text: string): NarrativePart => ({ kind: 'text', text });
const v = (text: string, sourceId: string): NarrativePart => ({ kind: 'value', text, sourceId });

type Fact = { value: number | string | boolean; sourceId: string } | undefined;
/** A numeric fact narrowed with its source, or null when absent or not a number. */
function numeric(fact: Fact): { value: number; sourceId: string } | null {
  return fact && typeof fact.value === 'number' ? { value: fact.value, sourceId: fact.sourceId } : null;
}

/** The details sentence: the first major gas and the field summary, each cited; null when neither is available. */
function detailsSentence(body: Body, details: BodyDetails): NarrativePart[] | null {
  const clauses: NarrativePart[][] = [];
  const gas = details.atmosphere?.major[0];
  if (gas) {
    const layer = body.category === 'star' ? 'photosphere' : 'atmosphere';
    clauses.push([t(`its ${layer} is `), v(`${gas.amount}% ${gas.name.toLowerCase()}`, gas.sourceId)]);
  }
  const mag = details.magnetosphere;
  if (mag.kind === 'none') {
    clauses.push([t('it has '), v('no global magnetic field', mag.sourceId)]);
  } else if (mag.kind === 'dipole' && mag.tiltDeg) {
    clauses.push(
      mag.tiltDeg.value === 0
        ? [t('its magnetic field is '), v('aligned with its spin axis', mag.tiltDeg.sourceId)]
        : [t('its magnetic field is tilted '), v(`${mag.tiltDeg.value}°`, mag.tiltDeg.sourceId), t(' from its spin axis')],
    );
  }
  if (clauses.length === 0) return null;
  const parts = clauses.flatMap((clause, i) => (i === 0 ? clause : [t('; '), ...clause]));
  const first = parts[0]!;
  if (first.kind === 'text') parts[0] = t(first.text.charAt(0).toUpperCase() + first.text.slice(1));
  return [...parts, t('. ')];
}

/**
 * Spec §4: 2-3 sentences built only from cited facts and live values; a sentence needing a missing fact is dropped.
 * Order: orbit (or star), the details sentence when details are ready, then the live distance. The day-and-temperature
 * sentence is used only while there is no details sentence.
 */
export function buildNarrative(body: Body, stats: LiveStats, opts: { details?: BodyDetails | null; parent?: Body } = {}): NarrativePart[] {
  const f = body.facts;
  const sentences: NarrativePart[][] = [];
  const radius = numeric(f.meanRadiusKm);
  const period = numeric(f.orbitalPeriodDays);
  const sma = numeric(f.semiMajorAxisAu);
  const day = numeric(f.lengthOfDayHours);
  const temp = numeric(f.meanTemperatureC);
  const spectral = f.spectralType;
  if (body.category === 'star') {
    if (spectral && radius) {
      sentences.push([t(`The ${body.name} is a `), v(String(spectral.value), spectral.sourceId), t(' star with a mean radius of '), v(`${formatNumber(radius.value)} km`, radius.sourceId), t('. ')]);
    }
  } else if (period && sma) {
    const around = opts.parent && opts.parent.category !== 'star' ? `${body.name} orbits ${opts.parent.name} every ` : `${body.name} circles the Sun every `;
    sentences.push([t(around), v(formatPeriodDays(period.value), period.sourceId), t(' at an average '), v(`${sma.value.toFixed(2)} AU`, sma.sourceId), t('. ')]);
  }
  const detailsPart = opts.details ? detailsSentence(body, opts.details) : null;
  if (detailsPart) {
    sentences.push(detailsPart);
  } else if (day && temp) {
    sentences.push([t('A day lasts '), v(formatDuration(day.value), day.sourceId), t(' and the mean temperature is '), v(`${formatNumber(temp.value)} °C`, temp.sourceId), t('. ')]);
  } else if (temp) {
    sentences.push([t('Its mean temperature is '), v(`${formatNumber(temp.value)} °C`, temp.sourceId), t('. ')]);
  }
  if (stats.sourceId) {
    if (stats.fromEarthKm !== null && stats.lightTimeS !== null) {
      const light = body.category === 'star' ? 'sunlight' : 'its light';
      sentences.push([t('Right now it is '), v(formatAu(stats.fromEarthKm), stats.sourceId), t(` from Earth; ${light} takes `), v(formatLightTimeShort(stats.lightTimeS), stats.sourceId), t(' to reach us.')]);
    } else if (stats.fromSunKm !== null) {
      sentences.push([t(`Right now ${body.name} is `), v(formatAu(stats.fromSunKm), stats.sourceId), t(' from the Sun.')]);
    }
  }
  return sentences.slice(0, 3).flat();
}
