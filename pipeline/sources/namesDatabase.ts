import type { SourceSpec } from './registry';

/**
 * Official names databases for Earth landmark positions (ADR 0010). Each one is an entry in `NAMES_SOURCES`: its cited source,
 * the host that source is on, where it holds places, how to fetch a record (or the file that holds it) and how to read it.
 * A position source is never used for a quoted sentence. See `Data Sources/Earth names databases (GNIS, GNS).md`.
 *
 * - `gnis`: USGS GNIS, the U.S. Board on Geographic Names data for the United States and Antarctica.
 * - `noaa-volcano`: NOAA NCEI Volcano Locations Database, worldwide volcanoes.
 * - `gebco`: IHO-IOC GEBCO Gazetteer of Undersea Feature Names, worldwide undersea features (served by NOAA NCEI).
 * - `nrcan`: Canadian Geographical Names Database (Natural Resources Canada), Canada only.
 * - `linz`: New Zealand Gazetteer (Toitū Te Whenua LINZ), New Zealand only.
 * - `ga-cga`: Composite Gazetteer of Australia (Geoscience Australia), Australia only (the states and mainland territories).
 * - `gns`: the NGA GEOnet Names Server; defined but not in use (it could not be reached on 2026-11-15).
 */
export type NamesDatabase = 'gnis' | 'gns' | 'noaa-volcano' | 'gebco' | 'nrcan' | 'linz' | 'ga-cga';

/** One record: its official name, the other names the database lists for it, and its point. `text` is the point as the record writes it. */
export interface NamesRecord {
  id: string;
  name: string;
  variants: string[];
  latDeg: number;
  lonDegE: number;
  /** The record's own class (GNIS `feature_class`, NOAA `morphology`, ...), trimmed; empty when the record gives none. */
  featureClass: string;
  text: string;
  /** Where a national database's record says the place is (a province code, a land district); set only by national sources. */
  territory?: string;
}

/** A file to fetch into the cache. A zip lists the entries (by name suffix) read from it, in order. */
export interface NamesFile { url: string; cacheName: string; zipEntries?: string[] }

export interface NamesSource {
  database: NamesDatabase;
  /** Short name, for the position text of a variant match ("GNIS name: ..."). */
  label: string;
  /** The registered source a position is cited to; null while the database is not in use. */
  spec: SourceSpec | null;
  /** The host the cited source must be on (a position host, never a quote host unless it is already official). */
  host: string;
  /** Where the database holds places, in plain words. */
  coverage: string;
  /** A national database: the country, and whether the record's `territory` is inside it. Worldwide sources have none. */
  country?: { name: string; holds: (territory: string) => boolean };
  /** Why the database cannot be used, when it cannot. */
  notInUse?: string;
  /** GNIS only: the record's staged file is named by an area (a state code or Antarctica). */
  needsArea?: boolean;
  /** The files that hold a record; throws on an id or area the source cannot have. */
  files: (recordId: string, area?: string) => NamesFile[];
  /** The record with this id, from the fetched files' texts (zip entries in order); null when it is not there or not usable. */
  read: (texts: readonly string[], recordId: string) => NamesRecord | null;
}

const splitLines = (body: string): string[] => body.replace(/^﻿/, '').split(/\r?\n/);

/** Decimals written in a number string, so a converted longitude keeps the record's own precision. */
const decimals = (s: string): number => (s.includes('.') ? s.length - s.indexOf('.') - 1 : 0);

const NUMBER = /^-?\d+(?:\.\d+)?$/;

/** A record from its fields; the point stays as written in `text`. Null for a point that is not a number, out of range, or 0, 0. */
function toRecord(id: string, name: string, variants: string[], featureClass: string, lat: string, lon: string, territory?: string): NamesRecord | null {
  if (!id || !name || !NUMBER.test(lat) || !NUMBER.test(lon)) return null;
  const latDeg = Number(lat);
  const lonDeg = Number(lon);
  if (Math.abs(latDeg) > 90 || Math.abs(lonDeg) > 180 || (latDeg === 0 && lonDeg === 0)) return null;
  const east = lonDeg < 0 ? 360 + lonDeg : lonDeg;
  const lonDegE = Number(east.toFixed(decimals(lon))) % 360;
  return { id, name, variants, featureClass, latDeg, lonDegE, text: `${lat}, ${lon}`, ...(territory !== undefined ? { territory } : {}) };
}

/** Rows of a CSV text (RFC 4180: quoted fields may hold commas, doubled quotes and line breaks). A leading BOM is dropped. */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (quoted) {
      if (c !== '"') field += c;
      else if (t[i + 1] === '"') { field += '"'; i++; } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; } else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; } else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

/** The first row whose `idColumn` is `recordId`, as a field reader; null when absent or malformed. */
function csvRow(rows: string[][], idColumn: string, recordId: string): ((name: string) => string) | null {
  const header = rows[0];
  if (!header) return null;
  const col = header.indexOf(idColumn);
  const row = rows.slice(1).find((r) => r[col] === recordId);
  if (col < 0 || !row || row.length !== header.length) return null;
  return (name: string) => (header.indexOf(name) < 0 ? '' : row[header.indexOf(name)]!.trim());
}

/** A number token written in a JSON text after `"key":`, as written (so 60.0 stays 60.0). */
const jsonNumber = (json: string, key: string): string => new RegExp(`"${key}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`).exec(json)?.[1] ?? '';

const parseJson = (text: string): unknown => { try { return JSON.parse(text); } catch { return null; } };

// ---------------------------------------------------------------------------------------------------------------------------
// GNIS
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * GNIS has no fetch of one record by id that returns the record itself (the National Map map service returns reprojected
 * geometry, and the names search is a browser app). Its staged text files are small per state (about 1.4 MB zipped), so
 * the pipeline fetches the file for the record's area and finds the record by its feature id. The USGS download page
 * names this bucket as The National Map Staged Products Directory.
 */
const GNIS_STAGED = 'https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/';
const GNIS_AREA = /^[A-Z]{2}$/;

export const GNS_NOT_IN_USE = 'the GEOnet Names Server is not in use (it could not be reached when the Earth landmarks were built; ADR 0010)';

/** The file that holds a GNIS record: a state or territory's two-letter code (`AZ`), or `Antarctica`. */
export function namesFileUrl(database: NamesDatabase, area: string): string {
  if (database === 'gns') throw new Error(GNS_NOT_IN_USE);
  if (database !== 'gnis') throw new Error(`${database} has no staged files by area`);
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

/**
 * One GNIS record from its file's header line and the record's line (the domestic and the Antarctica layouts both name their
 * columns). The point is `prim_lat_dec`, `prim_long_dec` (NAD83). Null for anything else, or when GNIS marks the location
 * unknown (0, 0).
 */
export function parseNamesRecord(database: NamesDatabase, body: string): NamesRecord | null {
  if (database !== 'gnis') return null;
  const lines = splitLines(body).filter((l) => l.trim() !== '');
  if (lines.length < 2) return null;
  const header = lines[0]!.split('|');
  const row = lines[1]!.split('|');
  if (row.length !== header.length) return null;
  const field = (name: string): string | undefined => {
    const i = header.indexOf(name);
    return i < 0 ? undefined : row[i]!.trim();
  };
  const id = field('feature_id') ?? '';
  if (!/^\d+$/.test(id)) return null;
  return toRecord(id, field('feature_name') ?? '', [], field('feature_class') ?? '', field('prim_lat_dec') ?? '', field('prim_long_dec') ?? '');
}

/** The GNIS record with this id in a whole file, with the other names from the file's names list (official name excluded). */
export function findNamesRecord(database: NamesDatabase, fileText: string, recordId: string, namesText?: string): NamesRecord | null {
  if (database !== 'gnis') return null;
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

// ---------------------------------------------------------------------------------------------------------------------------
// The other sources
// ---------------------------------------------------------------------------------------------------------------------------

/** NOAA NCEI HazEL: one volcano location by id, JSON (`id`, `name`, `country`, `latitude`, `longitude`, `morphology`). */
const NOAA_VOLCANO = 'https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/volcanolocs/';

function readNoaaVolcano(texts: readonly string[], recordId: string): NamesRecord | null {
  const json = texts[0] ?? '';
  const r = parseJson(json) as { id?: unknown; name?: unknown; morphology?: unknown } | null;
  if (!r || String(r.id) !== recordId || typeof r.name !== 'string') return null;
  // "Unknown" is not a class: the build then reports the record has none.
  const morphology = typeof r.morphology === 'string' && r.morphology.trim() !== 'Unknown' ? r.morphology.trim() : '';
  return toRecord(recordId, r.name.trim(), [], morphology, jsonNumber(json, 'latitude'), jsonNumber(json, 'longitude'));
}

/** The GEBCO gazetteer's API at the IHO Data Centre for Digital Bathymetry (NOAA NCEI): a search by feature id returns that feature. */
const GEBCO_FEATURE = 'https://www.ngdc.noaa.gov/gazetteer/api/v1/feature?featureId=';

/**
 * A GEBCO feature: the name is the specific term and the generic term ("Challenger" + "Deep"), the way an undersea feature name
 * is formed; the specific term alone is kept as a variant. The class is the generic term; the point is the single point
 * (`singlePointLatitude`, `singlePointLongitude`), which lies on the feature's geometry. Only an approved feature is used.
 */
function readGebcoFeature(texts: readonly string[], recordId: string): NamesRecord | null {
  const json = texts[0] ?? '';
  const r = parseJson(json) as { items?: Array<{ featureId?: unknown; name?: unknown; genericTerm?: unknown; approvalState?: unknown }> } | null;
  const items = r?.items ?? [];
  const f = items[0];
  if (items.length !== 1 || !f || f.featureId !== recordId || f.approvalState !== 'APPROVED') return null;
  if (typeof f.name !== 'string' || typeof f.genericTerm !== 'string') return null;
  const specific = f.name.trim();
  const generic = f.genericTerm.trim();
  return toRecord(recordId, `${specific} ${generic}`, [specific], generic, jsonNumber(json, 'singlePointLatitude'), jsonNumber(json, 'singlePointLongitude'));
}

/** NRCan geographical names web service: one record by its key (five capital letters), CSV; and the concise code list, JSON. */
const NRCAN = 'https://geogratis.gc.ca/services/geoname/en/';
/** Province and territory codes of the database; 72 (undersea feature) and 73 (international waters) are not Canadian land. */
const NRCAN_PROVINCES = new Set(['10', '11', '12', '13', '24', '35', '46', '47', '48', '59', '60', '61', '62']);

/** An NRCan record. The class is the term of its concise code ("BAY-Bay" gives "Bay"); `territory` is its province code. */
function readNrcanRecord(texts: readonly string[], recordId: string): NamesRecord | null {
  const field = csvRow(parseCsv(texts[0] ?? ''), 'id', recordId);
  if (!field) return null;
  const codes = parseJson(texts[1] ?? '') as { definitions?: Array<{ code?: unknown; term?: unknown }> } | null;
  const code = field('concise.code');
  const term = codes?.definitions?.find((d) => d.code === code)?.term;
  const featureClass = typeof term === 'string' ? term.replace(new RegExp(`^${code}-`), '').trim() : '';
  return toRecord(recordId, field('name'), [], featureClass, field('latitude'), field('longitude'), field('province.code'));
}

/** LINZ: the whole New Zealand Gazetteer as one CSV (about 21 MB); the record is found by `name_id`. */
const LINZ_GAZETTEER = 'https://gazetteer.linz.govt.nz/gaz.csv';
let linzParsed: { text: string; rows: string[][] } | null = null;

/** A LINZ record: the class is `feat_type`, the point `crd_latitude`, `crd_longitude`; `territory` is its land district. */
function readLinzRecord(texts: readonly string[], recordId: string): NamesRecord | null {
  const text = texts[0] ?? '';
  if (linzParsed?.text !== text) linzParsed = { text, rows: parseCsv(text) };
  const field = csvRow(linzParsed.rows, 'name_id', recordId);
  if (!field) return null;
  return toRecord(recordId, field('name'), [], field('feat_type'), field('crd_latitude'), field('crd_longitude'), field('land_district'));
}

/**
 * Geoscience Australia's map service for the Composite Gazetteer of Australia: one record by its `id` (the authority code, an
 * underscore and the authority's own id, for example `NT_10532`), JSON. The id pattern below keeps the query's where clause safe.
 */
const GA_CGA_QUERY = 'https://services.ga.gov.au/gis/rest/services/Composite_Gazetteer_of_Australia/MapServer/0/query';
/**
 * The naming authorities of the six states and the two mainland territories. The gazetteer also holds the Australian Antarctic
 * Division's names (`AAD`: the Australian Antarctic Territory, Heard Island) and the Australian Hydrographic Office's offshore and
 * undersea names (`AHO`); those are not Australia proper and fail the country check.
 */
const GA_CGA_STATES = new Set(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']);

/** "MOUNTAIN" or "NATIONAL PARK" as "Mountain", "National park": the record's own words, in sentence case. */
const sentenceCase = (s: string): string => (s === '' ? '' : s[0]!.toUpperCase() + s.slice(1).toLowerCase());

/**
 * A CGA record: the class is its `feature` ("MOUNTAIN", "LAKE", "CRATER"; `category` is a broader group such as "LANDFORM"),
 * in sentence case; the point is `latitude`, `longitude` as written in the JSON (GDA94); `territory` is its `authority`.
 */
function readGaCgaRecord(texts: readonly string[], recordId: string): NamesRecord | null {
  const json = texts[0] ?? '';
  const r = parseJson(json) as { features?: Array<{ attributes?: { id?: unknown; name?: unknown; feature?: unknown; authority?: unknown } }> } | null;
  const features = r?.features ?? [];
  const a = features[0]?.attributes;
  if (features.length !== 1 || !a || a.id !== recordId || typeof a.name !== 'string') return null;
  const featureClass = typeof a.feature === 'string' ? sentenceCase(a.feature.trim()) : '';
  const authority = typeof a.authority === 'string' ? a.authority.trim() : '';
  return toRecord(recordId, a.name.trim(), [], featureClass, jsonNumber(json, 'latitude'), jsonNumber(json, 'longitude'), authority);
}

const recordId = (pattern: RegExp, label: string) => (id: string): string => {
  if (!pattern.test(id)) throw new Error(`${label} record id must match ${pattern}, not "${id}"`);
  return id;
};
const noaaId = recordId(/^\d+$/, 'NOAA volcano');
const gebcoId = recordId(/^\d+$/, 'GEBCO');
const nrcanId = recordId(/^[A-Z]{5}$/, 'NRCan');
const linzId = recordId(/^\d+$/, 'LINZ');
const gaCgaId = recordId(/^[A-Z]{2,3}_[A-Za-z0-9]+$/, 'CGA');

export const NAMES_SOURCES: Record<NamesDatabase, NamesSource> = {
  gnis: {
    database: 'gnis',
    label: 'GNIS',
    spec: {
      id: 'usgs-gnis',
      title: 'Geographic Names Information System (GNIS): domestic and Antarctica names (primary points)',
      publisher: 'U.S. Geological Survey / U.S. Board on Geographic Names',
      url: 'https://www.usgs.gov/us-board-on-geographic-names/download-gnis-data',
      license: 'Public domain (USGS); GNIS metadata: "Use constraints: None"',
    },
    host: 'usgs.gov',
    coverage: 'the United States and Antarctica',
    needsArea: true,
    files: (_id, area = '') => {
      const entries = namesFileEntries('gnis', area);
      return [{ url: namesFileUrl('gnis', area), cacheName: namesFileCacheName('gnis', area), zipEntries: [entries.records, ...(entries.names ? [entries.names] : [])] }];
    },
    read: (texts, id) => findNamesRecord('gnis', texts[0] ?? '', id, texts[1]),
  },
  gns: {
    database: 'gns',
    label: 'GNS',
    // The GNS licence could not be read from its own site, so no GNS source is defined (id `nga-gns` is kept for when it is).
    spec: null,
    host: 'nga.mil',
    coverage: 'the world outside the United States and Antarctica',
    notInUse: GNS_NOT_IN_USE,
    files: () => { throw new Error(GNS_NOT_IN_USE); },
    read: () => null,
  },
  'noaa-volcano': {
    database: 'noaa-volcano',
    label: 'NOAA NCEI',
    spec: {
      id: 'noaa-ncei-volcano-locations',
      title: 'Volcano Locations Database (NCEI/WDS Global Significant Volcanic Eruptions Database, doi:10.7289/V5JW8BSH)',
      publisher: 'NOAA National Centers for Environmental Information (NCEI)',
      url: 'https://www.ncei.noaa.gov/products/natural-hazards/tsunamis-earthquakes-volcanoes/volcanoes',
      license: 'U.S. Government data (NOAA); dataset metadata: "Access to this dataset is unrestricted."; cite as doi:10.7289/V5JW8BSH',
    },
    host: 'noaa.gov',
    coverage: 'worldwide (volcanoes)',
    files: (id) => [{ url: `${NOAA_VOLCANO}${noaaId(id)}`, cacheName: `names-noaa-volcano-${id}.json` }],
    read: readNoaaVolcano,
  },
  gebco: {
    database: 'gebco',
    label: 'GEBCO',
    spec: {
      id: 'gebco-undersea-feature-names',
      title: 'IHO-IOC GEBCO Gazetteer of Undersea Feature Names (single points)',
      publisher: 'IHO-IOC GEBCO Sub-Committee on Undersea Feature Names; hosted by the IHO Data Centre for Digital Bathymetry at NOAA NCEI',
      url: 'https://www.gebco.net/data-products/undersea-feature-names',
      license: 'Use with citation: "IHO-IOC GEBCO Gazetteer of Undersea Feature Names, www.gebco.net" (GEBCO and NCEI)',
    },
    host: 'gebco.net',
    coverage: 'worldwide (undersea features)',
    files: (id) => [{ url: `${GEBCO_FEATURE}${gebcoId(id)}`, cacheName: `names-gebco-${id}.json` }],
    read: readGebcoFeature,
  },
  nrcan: {
    database: 'nrcan',
    label: 'CGNDB',
    spec: {
      id: 'nrcan-cgndb',
      title: 'Canadian Geographical Names Database (geographical names web service)',
      publisher: 'Natural Resources Canada / Geographical Names Board of Canada',
      url: 'https://natural-resources.canada.ca/maps-tools-publications/maps/geographical-names-canada/download-geographical-names-data',
      license: 'Open Government Licence - Canada ("Use of the data is subject to the Open Government Licence - Canada.")',
    },
    host: 'natural-resources.canada.ca',
    coverage: 'Canada',
    country: { name: 'Canada', holds: (province) => NRCAN_PROVINCES.has(province) },
    files: (id) => [
      { url: `${NRCAN}geonames/${nrcanId(id)}.csv`, cacheName: `names-nrcan-${id}.csv` },
      { url: `${NRCAN}codes/concise.json`, cacheName: 'names-nrcan-concise.json' },
    ],
    read: readNrcanRecord,
  },
  linz: {
    database: 'linz',
    label: 'NZ Gazetteer',
    spec: {
      id: 'linz-nz-gazetteer',
      title: 'New Zealand Gazetteer of place names (gaz.csv)',
      publisher: 'Toitū Te Whenua Land Information New Zealand (LINZ) / New Zealand Geographic Board',
      url: 'https://www.linz.govt.nz/products-services/place-names/place-names-new-zealand',
      license: 'CC BY 4.0 (Toitū Te Whenua LINZ: "content produced by Toitū Te Whenua Land Information New Zealand is licensed under the Creative Commons Attribution 4.0 International licence")',
    },
    host: 'linz.govt.nz',
    coverage: 'New Zealand',
    // The gazetteer also holds the Ross Dependency of Antarctica and undersea names; those records have no land district.
    country: { name: 'New Zealand', holds: (district) => district !== '' },
    files: (id) => { linzId(id); return [{ url: LINZ_GAZETTEER, cacheName: 'names-linz-gaz.csv' }]; },
    read: readLinzRecord,
  },
  'ga-cga': {
    database: 'ga-cga',
    label: 'CGA',
    spec: {
      id: 'ga-composite-gazetteer',
      title: 'Composite Gazetteer of Australia (map service layer 0, place names points)',
      publisher: 'Geoscience Australia, with the state and territory naming authorities',
      url: 'https://ecat.ga.gov.au/geonetwork/srv/api/records/f91a52b3-26f6-4f2c-bb8e-520f40864d5b',
      license: 'CC BY 4.0 under Geoscience Australia\'s site licence (https://www.ga.gov.au/copyright: "All material on this website is licensed under the Creative Commons Attribution 4.0 International Licence"), as accepted by the user on 2026-11-16; the dataset\'s own entries state no licence (catalogue: "© Commonwealth of Australia (Geoscience Australia) 2025"; data.gov.au: "notspecified")',
    },
    host: 'ga.gov.au',
    coverage: 'Australia (the states and mainland territories)',
    country: { name: 'Australia', holds: (authority) => GA_CGA_STATES.has(authority) },
    files: (id) => [{
      url: `${GA_CGA_QUERY}?where=id%3D%27${gaCgaId(id)}%27&outFields=*&returnGeometry=false&f=json`,
      cacheName: `names-ga-cga-${id}.json`,
    }],
    read: readGaCgaRecord,
  },
};

export const namesSource = (database: string): NamesSource | undefined =>
  Object.hasOwn(NAMES_SOURCES, database) ? NAMES_SOURCES[database as NamesDatabase] : undefined;

/** The registered source a names-database position is cited to. */
export function namesSourceSpec(database: NamesDatabase): SourceSpec {
  const s = NAMES_SOURCES[database];
  if (s.notInUse || !s.spec) throw new Error(s.notInUse ?? `${database} has no source`);
  return s.spec;
}

/** Short name of a database, for position text. */
export const namesDatabaseLabel = (database: NamesDatabase): string => NAMES_SOURCES[database].label;
