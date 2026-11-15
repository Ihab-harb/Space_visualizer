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
      positionText: l.position.kind === 'gazetteer' ? formatLatLon(l.latDeg, l.lonDegE) : (l.position.text ?? formatLatLon(l.latDeg, l.lonDegE)),
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
