import type { SourceSpec } from './registry';

/**
 * Official names databases for Earth landmark positions (ADR 0010). GNIS is the U.S. Board on Geographic Names data for the
 * United States and Antarctica, published by the USGS. The NGA GEOnet Names Server (the rest of the world) could not be reached
 * when this was built (2026-11-15), so it is not in use: see `Data Sources/Earth names databases (GNIS, GNS).md`.
 */
export type NamesDatabase = 'gnis' | 'gns';

/** One record: its official name, the other names the database lists for it, and its point. `text` is the point as the record writes it. */
export interface NamesRecord {
  id: string;
  name: string;
  variants: string[];
  latDeg: number;
  lonDegE: number;
  /** The record's own `feature_class` (for example "Valley"), trimmed; empty when the record leaves it blank. */
  featureClass: string;
  text: string;
}

/**
 * GNIS has no fetch of one record by id that returns the record itself (the National Map map service returns reprojected
 * geometry, and the names search is a browser app). Its staged text files are small per state (about 1.4 MB zipped), so
 * the pipeline fetches the file for the record's area and finds the record by its feature id. The USGS download page
 * names this bucket as The National Map Staged Products Directory.
 */
const GNIS_STAGED = 'https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/';
const GNIS_AREA = /^[A-Z]{2}$/;

export const GNS_NOT_IN_USE = 'the GEOnet Names Server is not in use (it could not be reached when the Earth landmarks were built; ADR 0010)';

/** The file that holds a record: a state or territory's two-letter code (`AZ`), or `Antarctica`. */
export function namesFileUrl(database: NamesDatabase, area: string): string {
  if (database === 'gns') throw new Error(GNS_NOT_IN_USE);
  if (area === 'Antarctica') return `${GNIS_STAGED}Antarctica/Gazetteer_Antarctica_Text.zip`;
  if (!GNIS_AREA.test(area)) throw new Error(`GNIS area must be a two-letter state code or Antarctica, not "${area}"`);
  return `${GNIS_STAGED}DomesticNames/DomesticNames_${area}_Text.zip`;
}

export const namesFileCacheName = (database: NamesDatabase, area: string): string => `names-${database}-${area}.zip`;

/** The zip entries (by name suffix) holding the records and, where the file has them, the other names. */
export function namesFileEntries(database: NamesDatabase, area: string): { records: string; names?: string } {
  if (database === 'gns') throw new Error(GNS_NOT_IN_USE);
  return area === 'Antarctica'
    ? { records: '/AntarcticaNames_Antarctica.txt', names: '/AntarcticaAllNames_Antarctica.txt' }
    : { records: `/DomesticNames_${area}.txt` };
}

const splitLines = (body: string): string[] => body.replace(/^﻿/, '').split(/\r?\n/);

/** Decimals written in a number string, so a converted longitude keeps the record's own precision. */
const decimals = (s: string): number => (s.includes('.') ? s.length - s.indexOf('.') - 1 : 0);

/**
 * One GNIS record from its file's header line and the record's line (the domestic and the Antarctica layouts both name their
 * columns). The point is `prim_lat_dec`, `prim_long_dec` (NAD83). Null for anything else, or when GNIS marks the location
 * unknown (0, 0).
 */
export function parseNamesRecord(database: NamesDatabase, body: string): NamesRecord | null {
  if (database === 'gns') return null;
  const lines = splitLines(body).filter((l) => l.trim() !== '');
  if (lines.length < 2) return null;
  const header = lines[0]!.split('|');
  const row = lines[1]!.split('|');
  if (row.length !== header.length) return null;
  const field = (name: string): string | undefined => {
    const i = header.indexOf(name);
    return i < 0 ? undefined : row[i]!.trim();
  };
  const id = field('feature_id');
  const name = field('feature_name');
  const featureClass = field('feature_class') ?? '';
  const lat = field('prim_lat_dec');
  const lon = field('prim_long_dec');
  if (!id || !/^\d+$/.test(id) || !name || !lat || !lon) return null;
  const latDeg = Number(lat);
  const lonDeg = Number(lon);
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg) || Math.abs(latDeg) > 90 || Math.abs(lonDeg) > 180) return null;
  if (latDeg === 0 && lonDeg === 0) return null;
  const east = lonDeg < 0 ? 360 + lonDeg : lonDeg;
  return { id, name, variants: [], featureClass, latDeg, lonDegE: Number(east.toFixed(decimals(lon))) % 360, text: `${lat}, ${lon}` };
}

/** The record with this id in a whole file, with the other names from the file's names list (official name excluded). */
export function findNamesRecord(database: NamesDatabase, fileText: string, recordId: string, namesText?: string): NamesRecord | null {
  if (database === 'gns') return null;
  const lines = splitLines(fileText);
  const line = lines.find((l) => l.startsWith(`${recordId}|`));
  if (line === undefined) return null;
  const record = parseNamesRecord(database, `${lines[0]}\n${line}`);
  if (!record) return null;
  if (namesText) {
    const names = splitLines(namesText);
    const col = names[0]!.split('|').indexOf('feature_name');
    for (const l of names.slice(1)) {
      if (!l.startsWith(`${recordId}|`)) continue;
      const n = l.split('|')[col]?.trim();
      if (n && n !== record.name && !record.variants.includes(n)) record.variants.push(n);
    }
  }
  return record;
}

/** The registered source a names-database position is cited to. */
export function namesSourceSpec(database: NamesDatabase): SourceSpec {
  // The GNS licence could not be read from its own site, so no GNS source is defined (id `nga-gns` is kept for when it is).
  if (database === 'gns') throw new Error(GNS_NOT_IN_USE);
  return {
    id: 'usgs-gnis',
    title: 'Geographic Names Information System (GNIS): domestic and Antarctica names (primary points)',
    publisher: 'U.S. Geological Survey / U.S. Board on Geographic Names',
    url: 'https://www.usgs.gov/us-board-on-geographic-names/download-gnis-data',
    license: 'Public domain (USGS); GNIS metadata: "Use constraints: None"',
  };
}

/** Short name of a database, for position text. */
export const namesDatabaseLabel = (database: NamesDatabase): string => (database === 'gnis' ? 'GNIS' : 'GNS');
