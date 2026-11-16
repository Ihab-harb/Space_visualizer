import { foldText } from '../../core/details/featureId';
import type { BodyDetails } from '../../core/details/schema';

/** One named feature of a body, as the card and the list show it: a landmark or a Gazetteer feature, merged by id. */
export interface FeatureEntry {
  id: string;
  name: string;
  type: string;
  typeMeaning: { text: string; sourceId: string } | null;
  latDeg: number;
  lonDegE: number;
  positionText: string;
  positionSourceId: string;
  positionKind: 'gazetteer' | 'names-database' | 'quoted';
  diameterKm: number | null;
  sizeSourceId: string | null;
  origin: string | null;
  approvedYear: number | null;
  /** The Gazetteer page that states the origin and the approval year, when the entry has one. */
  gazetteerSourceId: string | null;
  landmark: { rank: number; quote: { text: string; sourceId: string } } | null;
}

/** "14.0° S, 301.4° E": one decimal, east longitude 0 to 360. */
export function formatLatLon(latDeg: number, lonDegE: number): string {
  const lon = ((lonDegE % 360) + 360) % 360;
  return `${Math.abs(latDeg).toFixed(1)}° ${latDeg < 0 ? 'S' : 'N'}, ${lon.toFixed(1)}° E`;
}

/**
 * A names-database position as the record wrote it, "36.112764, -113.9960696", shown with hemisphere letters:
 * "36.112764° N, 113.9960696° W". The digits are the record's own (not rounded); only the minus sign becomes S or W.
 * Anything after the two numbers (a variant-name note) is kept; text that is not two numbers is returned as it is.
 */
export function formatRecordPosition(text: string): string {
  const m = /^(-?)(\d+(?:\.\d+)?),\s*(-?)(\d+(?:\.\d+)?)(.*)$/.exec(text.trim());
  if (!m) return text;
  return `${m[2]}° ${m[1] ? 'S' : 'N'}, ${m[4]}° ${m[3] ? 'W' : 'E'}${m[5]}`;
}

/** True when the details are ready and name no feature with this id: a selection nobody can see, to be cleared. */
export function isUnknownFeature(details: BodyDetails | null | undefined, id: string | null): boolean {
  return !!details && id !== null && featureEntry(details, id) === null;
}

/** Removes a stray space before , . ; : or ) for display only (some official pages have " ," inside a sentence). */
export function tidyQuote(text: string): string {
  return text.replace(/\s+([,.;:)])/g, '$1');
}

/** Every entry of a body: landmarks in rank order, then the other features largest first (ties by name). */
export function featureEntries(details: BodyDetails): FeatureEntry[] {
  const meaning = (type: string) => {
    const m = details.featureTypes[type];
    return m ? { text: m.meaning, sourceId: m.sourceId } : null;
  };
  const gazetteer = details.features;
  const items = new Map((gazetteer?.items ?? []).map((f) => [f.id, f]));
  const out: FeatureEntry[] = details.landmarks.map((l, rank) => {
    const item = items.get(l.id);
    const gazetteerSourceId = item && gazetteer ? gazetteer.sourceId : l.position.kind === 'gazetteer' ? l.position.sourceId : null;
    const diameterKm = l.diameterKm ?? item?.diameterKm ?? null;
    return {
      id: l.id,
      name: l.name,
      type: l.type,
      typeMeaning: meaning(l.type),
      latDeg: l.latDeg,
      lonDegE: l.lonDegE,
      positionText:
        l.position.kind === 'gazetteer' || l.position.text === null
          ? formatLatLon(l.latDeg, l.lonDegE)
          : l.position.kind === 'names-database'
            ? formatRecordPosition(l.position.text)
            : l.position.text,
      positionSourceId: l.position.sourceId,
      positionKind: l.position.kind,
      diameterKm,
      sizeSourceId: diameterKm === null ? null : (l.sizeSourceId ?? (item && gazetteer ? gazetteer.sourceId : null)),
      origin: l.origin ?? item?.origin ?? null,
      approvedYear: l.approvedYear ?? item?.approvedYear ?? null,
      gazetteerSourceId,
      landmark: { rank, quote: l.quote },
    };
  });
  if (gazetteer) {
    const landmarkIds = new Set(details.landmarks.map((l) => l.id));
    const rest = gazetteer.items.filter((f) => !landmarkIds.has(f.id)).sort((a, b) => b.diameterKm - a.diameterKm || a.name.localeCompare(b.name));
    for (const f of rest) {
      out.push({
        id: f.id,
        name: f.name,
        type: f.type,
        typeMeaning: meaning(f.type),
        latDeg: f.latDeg,
        lonDegE: f.lonDegE,
        positionText: formatLatLon(f.latDeg, f.lonDegE),
        positionSourceId: gazetteer.sourceId,
        positionKind: 'gazetteer',
        diameterKm: f.diameterKm,
        sizeSourceId: gazetteer.sourceId,
        origin: f.origin || null,
        approvedYear: f.approvedYear,
        gazetteerSourceId: gazetteer.sourceId,
        landmark: null,
      });
    }
  }
  return out;
}

export function featureEntry(details: BodyDetails | null | undefined, id: string): FeatureEntry | null {
  if (!details) return null;
  return featureEntries(details).find((e) => e.id === id) ?? null;
}

/** Entries whose folded name contains the folded query; an empty query keeps all, in order. */
export function searchFeatures(entries: readonly FeatureEntry[], query: string): FeatureEntry[] {
  const q = foldText(query);
  return q === '' ? [...entries] : entries.filter((e) => foldText(e.name).includes(q));
}

const QUOTED_KM = /(\d[\d,]*(?:\.\d+)?)\s*-?\s*(?:km|kilomet(?:er|re)s?)\b/gi;
const SIZE_WORD = /diameter|across|wide/i;

/**
 * The width a quoted sentence states for its feature, in km: the first figure in km with "diameter", "across" or "wide"
 * within 40 characters of it. Null when the sentence states none (a height or a depth is not a width).
 */
export function quoteSizeKm(quote: string): number | null {
  for (const m of quote.matchAll(QUOTED_KM)) {
    const near = quote.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40);
    if (!SIZE_WORD.test(near)) continue;
    const km = Number(m[1]!.replace(/,/g, ''));
    if (Number.isFinite(km) && km > 0) return km;
  }
  return null;
}

/** True when the sentence states a width that is not the card's Size (more than 0.5 % apart), so the card must say why two sizes show. */
export function sizesDiffer(quote: string, diameterKm: number | null): boolean {
  const q = quoteSizeKm(quote);
  return q !== null && diameterKm !== null && Math.abs(q - diameterKm) > 0.005 * diameterKm;
}
