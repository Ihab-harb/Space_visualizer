import type { Body } from '../core/catalog/schema';
import { formatAu, formatDuration, formatLightTimeShort, formatNumber, formatPeriodDays } from './format';
import type { LiveStats } from './liveStats';

export type NarrativePart = { kind: 'text'; text: string } | { kind: 'value'; text: string; sourceId: string };

const t = (text: string): NarrativePart => ({ kind: 'text', text });
const v = (text: string, sourceId: string): NarrativePart => ({ kind: 'value', text, sourceId });

type Fact = { value: number | string | boolean; sourceId: string } | undefined;
/** A numeric fact narrowed with its source, or null when absent or not a number. */
function numeric(fact: Fact): { value: number; sourceId: string } | null {
  return fact && typeof fact.value === 'number' ? { value: fact.value, sourceId: fact.sourceId } : null;
}

/** Spec §4: 2-3 sentences built only from cited facts and live values; a sentence needing a missing fact is dropped. */
export function buildNarrative(body: Body, stats: LiveStats): NarrativePart[] {
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
    sentences.push([t(`${body.name} circles the Sun every `), v(formatPeriodDays(period.value), period.sourceId), t(' at an average '), v(`${sma.value.toFixed(2)} AU`, sma.sourceId), t('. ')]);
  }
  if (day && temp) {
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
