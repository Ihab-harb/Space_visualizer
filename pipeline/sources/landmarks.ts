import { featureId } from '../../src/core/details/featureId';
import { NAMES_SOURCES, namesSource, type NamesDatabase } from './namesDatabase';
import {
  OFFICIAL_HOSTS, checkQuote, checkSources, isPaper, normaliseQuote, pageFor, quoteHasKm,
  type CuratedSource,
} from './quotedReference';

const OFFICIAL = new Set<string>(OFFICIAL_HOSTS);

/**
 * Hosts a position source may be on: the official hosts plus the hosts of the names databases in the registry (ADR 0010).
 * The extra hosts are never used for quoted sentences.
 */
export const POSITION_HOSTS: readonly string[] = [...OFFICIAL_HOSTS, ...Object.values(NAMES_SOURCES).map((s) => s.host).filter((h) => !OFFICIAL.has(h))];

/**
 * Where an Earth landmark's position comes from: a names-database record (resolved by the build) or numbers stated in a quoted
 * sentence. A GNIS record also names its `area`, the staged file that holds it: a two-letter state code or `Antarctica`.
 */
export type EarthPosition =
  | { kind: 'names-database'; database: NamesDatabase; recordId: string; area?: string }
  | { kind: 'quoted'; latDeg: number; lonDegE: number; sourceId: string; quote: string };

/** Key of a names-database record in the fetched positions. */
export const namesRecordKey = (p: { database: string; recordId: string }): string => `${p.database}:${p.recordId}`;

/** What the check needs from a fetched names-database record. `territory` is set by national databases. */
export interface FetchedNamesRecord { name: string; variants: readonly string[]; sourceUrl: string; featureClass?: string; territory?: string }

export type CuratedLandmark =
  /** A Gazetteer body: everything but the sentence comes from the Gazetteer, by name. */
  | { name: string; sourceId: string; quote: string }
  /** A names-database position: the type is the record's own `feature_class`, so no curated type is used. */
  | { name: string; type?: undefined; sourceId: string; quote: string; position: Extract<EarthPosition, { kind: 'names-database' }>; size?: { km: number; sourceId: string; quote: string } }
  /** A position stated in the quote: the type is a curated plain word (shown without a source number). */
  | { name: string; type: string; sourceId: string; quote: string; position: Extract<EarthPosition, { kind: 'quoted' }>; size?: { km: number; sourceId: string; quote: string } };

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

const hostOf = (url: string): string | null => { try { return new URL(url).hostname.toLowerCase(); } catch { return null; } };
const onHost = (host: string, h: string): boolean => host === h || host.endsWith(`.${h}`);
const onPositionHost = (host: string): boolean => POSITION_HOSTS.some((h) => onHost(host, h));

/** The problems of one names-database position: the database, its area, and the fetched record (host, name, country). */
function checkNamesPosition(where: string, name: string, p: Extract<EarthPosition, { kind: 'names-database' }>, rec: FetchedNamesRecord | undefined, errors: string[]): void {
  const source = namesSource(p.database);
  if (!source) { errors.push(`${where} position: unknown names database "${p.database}"`); return; }
  if (source.notInUse) errors.push(`${where} position: ${source.notInUse}`);
  else if (source.needsArea && !p.area) errors.push(`${where} position: GNIS record ${p.recordId} needs an area (a state code or Antarctica)`);
  else if (!source.needsArea && p.area !== undefined) errors.push(`${where} position: only GNIS records name an area; remove "area"`);
  if (!rec) return;
  const host = hostOf(rec.sourceUrl);
  if (host === null || !onPositionHost(host)) errors.push(`${where} position: record ${p.recordId} is not on a position host: ${host ?? rec.sourceUrl}`);
  else if (!onHost(host, source.host)) errors.push(`${where} position: record ${p.recordId} is cited to ${host}, not to the ${source.label} host ${source.host}`);
  if (rec.name !== name && !rec.variants.includes(name)) errors.push(`${where}: record ${p.recordId} is named ${rec.name}`);
  // A national database is used only for its own country: the record's own territory (a province code, a land district) must be in it.
  if (source.country && rec.territory !== undefined && !source.country.holds(rec.territory)) {
    errors.push(`${where}: record ${p.recordId} is outside ${source.country.name} (territory "${rec.territory}"); a national names database is used only for its own country`);
  }
}

/**
 * The problems in a landmarks file, one string each; an empty list means every quote is on its page and every stored number is
 * in its quote. `records` are the fetched names-database records by `namesRecordKey`: a fetched record must be cited to a
 * position host and carry the landmark's name (its own or a listed variant). A record that was not fetched is the build's error.
 */
export function verifyLandmarks(file: LandmarksFile, pages: Map<string, string>, records: ReadonlyMap<string, FetchedNamesRecord> = new Map()): string[] {
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
      if (p.kind === 'names-database') checkNamesPosition(where, l.name, p, records.get(namesRecordKey(p)), errors);
      if (p.kind === 'quoted' && !l.type) errors.push(`${where}: a landmark with a quoted position needs a type`);
      if (p.kind === 'names-database' && l.type) errors.push(`${where}: a names-database landmark takes its type from the record's feature class; remove "type"`);
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
