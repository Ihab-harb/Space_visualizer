import { featureId } from '../../src/core/details/featureId';
import {
  checkQuote, checkSources, isPaper, normaliseQuote, pageFor, quoteHasKm,
  type CuratedSource,
} from './quotedReference';

/** Where an Earth landmark's position comes from: a names-database record (resolved by the build) or numbers stated in a quoted sentence. */
export type EarthPosition =
  | { kind: 'names-database'; database: 'gnis' | 'gns'; recordId: string }
  | { kind: 'quoted'; latDeg: number; lonDegE: number; sourceId: string; quote: string };

export type CuratedLandmark =
  /** A Gazetteer body: everything but the sentence comes from the Gazetteer, by name. */
  | { name: string; sourceId: string; quote: string }
  | { name: string; type: string; sourceId: string; quote: string; position: EarthPosition; size?: { km: number; sourceId: string; quote: string } };

export interface LandmarksFile {
  /** Quote pages, on official hosts. */
  sources: CuratedSource[];
  /** What a Gazetteer feature type means, by type name (the first word of the Gazetteer's type, for example "Mons"). */
  types: Record<string, { meaning: string; sourceId: string; quote: string }>;
  /** Landmarks by body id, in rank order. */
  bodies: Record<string, CuratedLandmark[]>;
}

export const hasOwnPosition = (l: CuratedLandmark): l is Extract<CuratedLandmark, { position: EarthPosition }> => 'position' in l;

const round4 = (x: number) => Math.round(x * 1e4) / 1e4;
const NUM = String.raw`\d+(?:\.\d+)?`;
/** Degrees, then optional minutes: `36°06′`, `27.99°`, `112 degrees`. */
const DEG = String.raw`(-?${NUM})\s*(?:°|degrees?)?\s*(?:(${NUM})\s*['′’]\s*)?`;
const HEMI = 'N|S|E|W|[Nn]orth|[Ss]outh|[Ee]ast|[Ww]est';
const WITH_HEMISPHERE = new RegExp(String.raw`(?<![\w.])${DEG}(${HEMI})(?![A-Za-z])`, 'g');
const WITH_WORD = new RegExp(String.raw`\b([Ll]atitude|[Ll]ongitude)\b\s*(?:of|is|at|=|:)?\s*(-?${NUM})\s*°?`, 'g');

interface Hit { axis: 'lat' | 'lon'; value: number; start: number; end: number }

/**
 * Two numbers stated in a sentence: a latitude and a longitude. Each one has a hemisphere letter (N/S, E/W), a hemisphere word
 * (north, south, east, west), or follows the word latitude or longitude with its sign. Degrees may carry minutes. The result is in
 * decimal degrees, 4 places, with the longitude east in [0, 360). `text` is the matched span as written; null when either number is missing.
 */
export function parseStatedPosition(quote: string): { latDeg: number; lonDegE: number; text: string } | null {
  const q = quote.replace(/[−–]/g, '-');
  const hits: Hit[] = [];
  for (const m of q.matchAll(WITH_HEMISPHERE)) {
    const sign = m[1]!.startsWith('-') ? -1 : 1;
    const magnitude = Math.abs(Number(m[1])) + (m[2] ? Number(m[2]) / 60 : 0);
    const h = m[3]!.toUpperCase()[0]!;
    const toward = h === 'S' || h === 'W' ? -1 : 1;
    hits.push({ axis: h === 'N' || h === 'S' ? 'lat' : 'lon', value: sign * toward * magnitude, start: m.index!, end: m.index! + m[0].length });
  }
  for (const m of q.matchAll(WITH_WORD)) {
    hits.push({ axis: m[1]!.toLowerCase() === 'latitude' ? 'lat' : 'lon', value: Number(m[2]), start: m.index!, end: m.index! + m[0].length });
  }
  hits.sort((a, b) => a.start - b.start);
  const lat = hits.find((h) => h.axis === 'lat');
  const lon = hits.find((h) => h.axis === 'lon');
  if (!lat || !lon || Math.abs(lat.value) > 90) return null;
  const start = Math.min(lat.start, lon.start);
  const end = Math.max(lat.end, lon.end);
  return {
    latDeg: round4(lat.value),
    lonDegE: round4(((lon.value % 360) + 360) % 360) % 360,
    text: quote.slice(start, end).trim(),
  };
}

const includesText = (quote: string, part: string): boolean => normaliseQuote(quote).toLowerCase().includes(normaliseQuote(part).toLowerCase());
const close = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-4;

/** The problems in a landmarks file, one string each; an empty list means every quote is on its page and every stored number is in its quote. */
export function verifyLandmarks(file: LandmarksFile, pages: Map<string, string>): string[] {
  const errors: string[] = [];
  checkSources(file.sources.filter((s) => !isPaper(s)), errors);
  for (const s of file.sources) if (isPaper(s)) errors.push(`source ${s.id}: papers are not allowed for landmarks`);
  const quote = (q: string, sourceId: string, where: string): void => {
    const page = pageFor(pages, file.sources, sourceId, where, errors);
    if (page !== null) checkQuote(q, page, sourceId, where, errors);
  };

  for (const [type, t] of Object.entries(file.types)) {
    const where = `type ${type}`;
    quote(t.quote, t.sourceId, where);
    if (!includesText(t.quote, type)) errors.push(`${where}: the type is not in its quote: "${t.quote}"`);
    if (!includesText(t.quote, t.meaning)) errors.push(`${where}: the meaning "${t.meaning}" is not in its quote: "${t.quote}"`);
  }

  for (const [body, list] of Object.entries(file.bodies)) {
    const names = new Set<string>();
    const ids = new Set<string>();
    for (const l of list) {
      const where = `${body}/${l.name}`;
      if (names.has(l.name) || ids.has(featureId(l.name))) errors.push(`${where}: duplicate landmark name`);
      names.add(l.name);
      ids.add(featureId(l.name));
      quote(l.quote, l.sourceId, where);
      if (!hasOwnPosition(l)) continue;
      const p = l.position;
      if (p.kind === 'quoted') {
        const w = `${where} position`;
        quote(p.quote, p.sourceId, w);
        const stated = parseStatedPosition(p.quote);
        if (stated === null) errors.push(`${w}: no latitude and longitude stated in quote: "${p.quote}"`);
        else if (!close(stated.latDeg, p.latDeg) || !close(stated.lonDegE, p.lonDegE)) {
          errors.push(`${w}: ${p.latDeg}, ${p.lonDegE} is not the position stated in quote (${stated.latDeg}, ${stated.lonDegE}): "${p.quote}"`);
        }
      }
      if (l.size) {
        const w = `${where} size`;
        quote(l.size.quote, l.size.sourceId, w);
        if (!quoteHasKm(l.size.quote, l.size.km)) errors.push(`${w}: ${l.size.km} km not in quote: "${l.size.quote}"`);
      }
    }
  }
  return errors;
}
