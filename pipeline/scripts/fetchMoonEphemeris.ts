import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ChebyshevFileSchema, type ChebyshevFile } from '../../src/core/catalog/schema';
import { evaluateChebyshev } from '../../src/core/ephemeris/chebyshev';
import { ARCSEC } from '../../src/core/math/angles';
import { length, type Vec3 } from '../../src/core/math/vec3';
import { calendarToJd } from '../../src/core/time/julian';
import { fitTable } from '../lib/chebyshevFit';
import { fetchCached } from '../lib/fetchCached';
import { moonChunkUrl, moonListUrl, parseHorizonsVectorTable, REFERENCE_JDS, REFERENCE_QUERY } from '../sources/horizons';

const offline = process.argv.includes('--offline');
const RAW_DIR = path.resolve('pipeline/raw');
const OUT_TABLE = path.resolve('public/data/solar-system/ephemeris/moon.json');
const OUT_CHECK = path.resolve('pipeline/reference/horizons-moon-check.json');

// Same range as TABLE1_RANGE in pipeline/build/buildSolarSystem.ts (midnight 1800-01-01 to midnight 2051-01-01).
const midnight = (year: number, month: number, day: number) => calendarToJd({ year, month, day, hour: 0, minute: 0, second: 0 });
const START = midnight(1800, 1, 1);
const END = midnight(2051, 1, 1);
const STEP_MINUTES = 180;
const STEP_DAYS = STEP_MINUTES / 1440;
const CHUNK_DAYS = 1826; // about 5 years
const ROUND_KM = 0.001;
const HELD_OUT_EVERY_DAYS = 3; // thinning of the committed check file only; the error figure uses every odd sample
const TRIALS: Array<[number, number]> = [[8, 10], [16, 12], [16, 14], [32, 18]];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchRows(url: string, cacheName: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      if (!offline) await sleep(400); // be polite to the Horizons API
      const fetched = await fetchCached(url, cacheName, { offline, rawDir: RAW_DIR, log: console.warn });
      const json = JSON.parse(fetched.text) as { result?: string; error?: string };
      if (json.error) throw new Error(json.error);
      return { rows: parseHorizonsVectorTable(json.result ?? ''), retrievedAt: fetched.retrievedAt };
    } catch (error) {
      lastError = error;
      if (offline) break;
      console.warn(`retry ${attempt + 1} for ${cacheName}: ${String(error)}`);
      await sleep(3000);
    }
  }
  throw lastError;
}

// Every sample is START + i * 3 h; the last segment of every trial must be covered, so fetch to END plus the longest segment.
const MAX_SEGMENT_DAYS = Math.max(...TRIALS.map(([d]) => d));
const FETCH_END = END + MAX_SEGMENT_DAYS;
const total = Math.round((FETCH_END - START) / STEP_DAYS) + 1;
const samples = new Array<{ jdTdb: number; positionKm: Vec3 } | undefined>(total).fill(undefined);
let retrievedAt = '';
for (let chunkStart = START; chunkStart <= FETCH_END; chunkStart += CHUNK_DAYS) {
  const chunkStop = Math.min(chunkStart + CHUNK_DAYS, FETCH_END);
  const { rows, retrievedAt: at } = await fetchRows(moonChunkUrl(chunkStart, chunkStop, STEP_MINUTES), `horizons-moon-${chunkStart}.txt`);
  retrievedAt = at > retrievedAt ? at : retrievedAt;
  for (const row of rows) {
    const i = Math.round((row.jdTdb - START) / STEP_DAYS);
    if (i >= 0 && i < total) samples[i] = row;
  }
  console.log(`chunk ${chunkStart}: ${rows.length} rows`);
}
const missing = samples.findIndex((s) => s === undefined);
if (missing >= 0) throw new Error(`Missing Horizons sample at index ${missing}`);
const all = samples as Array<{ jdTdb: number; positionKm: Vec3 }>;
const even = all.filter((_, i) => i % 2 === 0);
const odd = all.filter((_, i) => i % 2 === 1);

const maxInRange = (file: ChebyshevFile) => {
  let maxKm = 0;
  let maxArcsec = 0;
  for (const s of odd) {
    const p = evaluateChebyshev(file, s.jdTdb);
    if (!p) continue;
    const err = Math.hypot(p[0] - s.positionKm[0], p[1] - s.positionKm[1], p[2] - s.positionKm[2]);
    maxKm = Math.max(maxKm, err);
    maxArcsec = Math.max(maxArcsec, err / length(s.positionKm) / ARCSEC);
  }
  return { maxKm, maxArcsec };
};

const buildFile = (segmentDays: number, degree: number): ChebyshevFile => {
  const segments = fitTable(even, { startJdTdb: START, segmentDays, degree, roundKm: ROUND_KM });
  // Only keep the segments needed to cover END.
  const needed = Math.ceil((END - START) / segmentDays - 1e-9);
  return ChebyshevFileSchema.parse({
    schemaVersion: 1,
    bodyId: 'moon',
    centreId: 'earth',
    frame: 'ecliptic-j2000',
    unit: 'km',
    sourceId: 'jpl-horizons',
    startJdTdb: START,
    segmentDays,
    degree,
    segments: segments.slice(0, needed),
  });
};

interface Trial { segmentDays: number; degree: number; maxKm: number; maxArcsec: number; bytes: number; file: ChebyshevFile }
const trials: Trial[] = TRIALS.map(([segmentDays, degree]) => {
  const file = buildFile(segmentDays, degree);
  const bytes = Buffer.byteLength(JSON.stringify(file));
  const { maxKm, maxArcsec } = maxInRange(file);
  console.log(`trial segmentDays=${segmentDays} degree=${degree}: max held-out ${maxKm.toFixed(4)} km (${maxArcsec.toFixed(5)} arcsec), ${(bytes / 1e6).toFixed(3)} MB`);
  return { segmentDays, degree, maxKm, maxArcsec, bytes, file };
});
const passing = trials.filter((t) => t.maxKm <= 1).sort((a, b) => a.bytes - b.bytes);
if (passing.length === 0) throw new Error('No tried setting reaches 1 km held-out error');
const best = passing[0]!;

// Moon (geocentric) at the reference dates, straight from Horizons.
const ref = await fetchRows(moonListUrl(REFERENCE_JDS), 'horizons-moon-reference-dates.txt');
const heldOut = odd
  .filter((_, i) => i % (HELD_OUT_EVERY_DAYS * 4) === 0)
  .map((s) => ({ jdTdb: s.jdTdb, positionKm: [Math.round(s.positionKm[0] * 1000) / 1000, Math.round(s.positionKm[1] * 1000) / 1000, Math.round(s.positionKm[2] * 1000) / 1000] }));
const check = { retrievedAt, query: { ...REFERENCE_QUERY, COMMAND: "'301'", CENTER: "'500@399'", STEP_SIZE: `'${STEP_MINUTES} m'` }, heldOut, referenceDates: ref.rows };

await mkdir(path.dirname(OUT_TABLE), { recursive: true });
await writeFile(OUT_TABLE, JSON.stringify(best.file), 'utf8');
await writeFile(OUT_CHECK, `${JSON.stringify(check, null, 0).replace(/\{"jdTdb"/g, '\n{"jdTdb"')}\n`, 'utf8');
const size = (await stat(OUT_TABLE)).size;
const checkSize = (await stat(OUT_CHECK)).size;
console.log(`horizons-moon-check.json: ${heldOut.length} held-out samples (one per ${HELD_OUT_EVERY_DAYS} d), ${(checkSize / 1e6).toFixed(2)} MB`);
console.log(
  `moon.json: ${best.file.segments.length} segments, ${best.segmentDays} d, degree ${best.degree}, max held-out error ${best.maxKm.toFixed(3)} km (${best.maxArcsec.toFixed(4)}″), ${(size / 1e6).toFixed(2)} MB`,
);
