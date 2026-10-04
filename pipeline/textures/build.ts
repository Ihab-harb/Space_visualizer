import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Imagery, ImageryFile, Source, TextureRef, Tier } from '../../src/core/catalog/schema';
import { toSource } from '../sources/registry';
import { argmaxLonLat, assertElevationRange, calibrateMask, normalMapFromHeight, rollColumns, sampleEquirect, thresholdMask, type LonLat } from './derive';
import { fetchBinaryCached, type FetchedFile } from './fetchBinary';
import { imagerySpec, PRODUCTS, type ProductId } from './manifest';
import { desaturateRgb, imageInfo, readBandFloat, readRgb8, writeWebp } from './rasters';
import { buildRingBands, parseRingSheet, ringProfile } from './rings';
import { decodeStarMapExr, linearToSrgb8, verifySkyOrientation } from './stars';

export const TIER_WIDTH: Record<Tier, number> = { '1k': 1024, '2k': 2048, '4k': 4096, '8k': 8192 };
export const COMMITTED_TIERS: Tier[] = ['1k', '2k'];
const ALL_TIERS: Tier[] = ['1k', '2k', '4k', '8k'];
export const BUDGET_BYTES = 60 * 1024 * 1024;

type Layer = 'color' | 'night' | 'clouds' | 'normal' | 'specular';

export interface LayerJob {
  body: string;
  layer: Layer;
  product: ProductId;
  kind: 'color' | 'gray' | 'normal' | 'mask';
  maxTier: Tier;
  derivation?: string;
  illustrative?: boolean;
  desaturate?: number;
  normal?: { radiusM: number; metersPerUnit: number; strength: number };
}

export const LAYER_JOBS: LayerJob[] = [
  { body: 'earth', layer: 'color', product: 'earth-day', kind: 'color', maxTier: '8k' },
  { body: 'earth', layer: 'night', product: 'earth-night', kind: 'color', maxTier: '8k' },
  { body: 'earth', layer: 'clouds', product: 'earth-clouds', kind: 'gray', maxTier: '8k', derivation: 'Static cloud composite; its slow drift in the app is illustrative.' },
  { body: 'earth', layer: 'normal', product: 'earth-topography', kind: 'normal', maxTier: '4k', normal: { radiusM: 6_371_000, metersPerUnit: 6400 / 255, strength: 8 }, derivation: 'Normal map derived from GEBCO topography; relief exaggerated ×8 for visibility.' },
  { body: 'earth', layer: 'specular', product: 'earth-bathymetry', kind: 'mask', maxTier: '4k', derivation: 'Ocean mask derived from GEBCO bathymetry (water = 1); drives sun glint.' },
  { body: 'mars', layer: 'color', product: 'mars-color', kind: 'color', maxTier: '8k' },
  { body: 'mars', layer: 'normal', product: 'mars-dem', kind: 'normal', maxTier: '4k', normal: { radiusM: 3_389_500, metersPerUnit: 1, strength: 3 }, derivation: 'Normal map derived from MOLA elevation; relief exaggerated ×3.' },
  { body: 'mercury', layer: 'color', product: 'mercury-color', kind: 'color', maxTier: '8k', desaturate: 0.8, derivation: 'MDIS 3-colour mosaic desaturated 80% toward Mercury’s natural grey-brown.' },
  { body: 'mercury', layer: 'normal', product: 'mercury-dem', kind: 'normal', maxTier: '4k', normal: { radiusM: 2_439_400, metersPerUnit: 1, strength: 3 }, derivation: 'Normal map derived from the MESSENGER DEM; relief exaggerated ×3.' },
  { body: 'jupiter', layer: 'color', product: 'jupiter-opal', kind: 'color', maxTier: '4k', derivation: 'Hubble OPAL 2024 global map (F395N/F502N/F631N composite); longitude alignment approximate.' },
  { body: 'saturn', layer: 'color', product: 'saturn-opal', kind: 'color', maxTier: '4k', derivation: 'Hubble OPAL 2024 global map (F395N/F502N/F631N composite); longitude alignment approximate.' },
  { body: 'uranus', layer: 'color', product: 'uranus-opal', kind: 'color', maxTier: '4k', derivation: 'Hubble OPAL 2023 global map (F467M/F547M/F657N composite); longitude alignment approximate.' },
  { body: 'neptune', layer: 'color', product: 'neptune-opal', kind: 'color', maxTier: '4k', derivation: 'Hubble OPAL 2025 global map (F467M/F547M/F657N composite); longitude alignment approximate.' },
];

const EARTH_LAND: LonLat[] = [
  { lonDeg: 13, latDeg: 23 },
  { lonDeg: 100, latDeg: 60 },
  { lonDeg: -55, latDeg: -10 },
  { lonDeg: 133, latDeg: -25 },
];
const EARTH_WATER: LonLat[] = [
  { lonDeg: -160, latDeg: 0 },
  { lonDeg: -40, latDeg: 30 },
  { lonDeg: 75, latDeg: -20 },
  { lonDeg: -20, latDeg: -40 },
];

export function tiersFor(job: LayerJob, opts: { hd: boolean; sourceWidth: number }): Tier[] {
  if (!opts.hd) return [...COMMITTED_TIERS];
  const max = ALL_TIERS.indexOf(job.maxTier);
  return ALL_TIERS.filter((t, i) => i <= max && (COMMITTED_TIERS.includes(t) || TIER_WIDTH[t] <= opts.sourceWidth));
}

export function texturePath(body: string, layer: string, tier: Tier): string {
  return `textures/${body}/${layer}_${tier}.webp`;
}

/** All tiers up to maxTier are listed; the app falls back when a local-only tier is missing. */
function textureRef(job: { body: string; layer: string; maxTier: Tier; sourceId: string; derivation?: string; illustrative?: boolean }): TextureRef {
  const tiers: Partial<Record<Tier, string>> = {};
  for (const t of ALL_TIERS.slice(0, ALL_TIERS.indexOf(job.maxTier) + 1)) tiers[t] = texturePath(job.body, job.layer, t);
  return {
    tiers,
    sourceId: job.sourceId,
    ...(job.derivation ? { derivation: job.derivation } : {}),
    ...(job.illustrative ? { illustrative: true } : {}),
  };
}

function luminanceAt(rgb: Uint8Array, w: number, h: number, p: LonLat): number {
  return 0.2126 * sampleEquirect(rgb, w, h, p.lonDeg, p.latDeg, 3, 0) + 0.7152 * sampleEquirect(rgb, w, h, p.lonDeg, p.latDeg, 3, 1) + 0.0722 * sampleEquirect(rgb, w, h, p.lonDeg, p.latDeg, 3, 2);
}

function validate(job: LayerJob, data: Uint8Array | Float32Array, w: number, h: number): void {
  if (job.body === 'earth' && job.layer === 'color') {
    const diff = luminanceAt(data as Uint8Array, w, h, EARTH_LAND[0]!) - luminanceAt(data as Uint8Array, w, h, EARTH_WATER[0]!);
    if (diff <= 40) throw new Error(`earth day map orientation check failed: Sahara − Pacific luminance = ${diff.toFixed(1)}`);
  }
  if (job.product === 'mars-dem') {
    assertElevationRange('mars', data, { minBelow: -5000, maxAbove: 15000 });
    const peak = argmaxLonLat(data, w, h);
    const dLon = Math.abs(((peak.lonDeg - -133.8 + 540) % 360) - 180);
    if (dLon > 5 || Math.abs(peak.latDeg - 18.65) > 5) {
      throw new Error(`mars DEM peak at ${peak.lonDeg.toFixed(1)}°, ${peak.latDeg.toFixed(1)}° is not Olympus Mons (−133.8°, 18.65°): check lonOffsetDeg`);
    }
  }
  if (job.product === 'mercury-dem') assertElevationRange('mercury', data, { minBelow: -3000, maxAbove: 3000 });
}

async function processLayer(job: LayerJob, file: string, tier: Tier, tmpDir: string): Promise<void> {
  const w = TIER_WIDTH[tier];
  const h = w / 2;
  const lon = PRODUCTS[job.product].lonOffsetDeg;
  const out = path.join(tmpDir, texturePath(job.body, job.layer, tier).replace(/^textures\//, ''));
  await mkdir(path.dirname(out), { recursive: true });
  if (job.kind === 'color') {
    let rgb = await readRgb8(file, w, h);
    if (job.desaturate) rgb = desaturateRgb(rgb, job.desaturate);
    rgb = rollColumns(rgb, w, h, 3, lon);
    if (tier === '1k') validate(job, rgb, w, h);
    await writeWebp(rgb, w, h, 3, out, { quality: 90 });
  } else if (job.kind === 'gray') {
    const v = rollColumns(await readBandFloat(file, w, h), w, h, 1, lon);
    await writeWebp(Uint8Array.from(v, (x) => Math.max(0, Math.min(255, Math.round(x)))), w, h, 1, out, { quality: 90 });
  } else if (job.kind === 'normal') {
    const height = rollColumns(await readBandFloat(file, w, h), w, h, 1, lon);
    if (tier === '1k') validate(job, height, w, h);
    await writeWebp(normalMapFromHeight(height, w, h, job.normal!), w, h, 3, out, { lossless: true });
  } else {
    const v = rollColumns(await readBandFloat(file, w, h), w, h, 1, lon);
    const cal = calibrateMask(v, w, h, EARTH_LAND, EARTH_WATER);
    await writeWebp(thresholdMask(v, cal.threshold, cal.waterAbove), w, h, 1, out, { lossless: true });
  }
}

async function buildSky(opts: { hd: boolean; offline: boolean; rawDir: string; log: (m: string) => void }, tmpDir: string, fetched: Map<ProductId, FetchedFile>): Promise<TextureRef> {
  const get = async (id: ProductId) => {
    const f = await fetchBinaryCached(PRODUCTS[id].url, PRODUCTS[id].cacheName, opts);
    fetched.set(id, f);
    return f.path;
  };
  const dir = path.join(tmpDir, 'sky');
  await mkdir(dir, { recursive: true });
  const sky4 = await decodeStarMapExr(await get('sky-starmap-4k'));
  const gray = new Float32Array(sky4.width * sky4.height);
  for (let i = 0; i < gray.length; i++) gray[i] = 0.2126 * sky4.rgb[i * 3]! + 0.7152 * sky4.rgb[i * 3 + 1]! + 0.0722 * sky4.rgb[i * 3 + 2]!;
  const check = verifySkyOrientation(gray, sky4.width, sky4.height);
  opts.log(`sky orientation: matched ${check.matched.join(', ')}; missing ${check.missing.join(', ') || 'none'}`);
  if (check.matched.length < 4) throw new Error(`sky orientation check failed: missing ${check.missing.join(', ')}`);
  const srgb4 = linearToSrgb8(sky4.rgb, 1);
  await writeWebp(srgb4, sky4.width, sky4.height, 3, path.join(dir, 'color_4k.webp'), { quality: 92 });
  const { default: sharp } = await import('sharp');
  await sharp(Buffer.from(srgb4.buffer, srgb4.byteOffset, srgb4.byteLength), { raw: { width: sky4.width, height: sky4.height, channels: 3 } })
    .resize(2048, 1024, { kernel: 'lanczos3' })
    .webp({ quality: 92 })
    .toFile(path.join(dir, 'color_2k.webp'));
  if (opts.hd) {
    const sky8 = await decodeStarMapExr(await get('sky-starmap-8k'));
    await writeWebp(linearToSrgb8(sky8.rgb, 1), sky8.width, sky8.height, 3, path.join(dir, 'color_8k.webp'), { quality: 92 });
  }
  return { tiers: { '2k': texturePath('sky', 'color', '2k'), '4k': texturePath('sky', 'color', '4k'), '8k': texturePath('sky', 'color', '8k') }, sourceId: 'nasa-svs-deep-star-maps' };
}

async function buildRings(planet: 'saturn' | 'uranus', file: string, tmpDir: string): Promise<NonNullable<Imagery['rings']>> {
  const sourceId = planet === 'saturn' ? 'nssdca-saturn-rings' : 'nssdca-uranus-rings';
  const rows = parseRingSheet(await readFile(file, 'utf8'));
  const bands = buildRingBands(rows, { albedoUnit: planet === 'saturn' ? 1 : 1e-3, minOpticalDepth: 0.01 });
  const tint: [number, number, number] = planet === 'saturn' ? [0.86, 0.78, 0.64] : [0.55, 0.55, 0.55];
  const { rgba, innerKm, outerKm } = ringProfile(bands, { width: 2048, tint });
  const out = path.join(tmpDir, planet, 'rings_2k.webp');
  await mkdir(path.dirname(out), { recursive: true });
  await writeWebp(rgba, 2048, 2, 4, out, { lossless: true });
  return {
    texture: { tiers: { '2k': texturePath(planet, 'rings', '2k') }, sourceId, derivation: 'Radial profile built from the NSSDCA ring table (radii, optical depth, albedo); colour tint is illustrative.', illustrative: true },
    innerKm: { value: Math.round(innerKm), unit: 'km', sourceId },
    outerKm: { value: Math.round(outerKm), unit: 'km', sourceId },
  };
}

export async function committedBytes(outDir: string): Promise<number> {
  let total = 0;
  const walk = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (!/_(4k|8k)\.webp$/.test(entry.name) || full.replace(/\\/g, '/').endsWith('sky/color_4k.webp')) total += (await stat(full)).size;
    }
  };
  if (existsSync(outDir)) await walk(outDir);
  return total;
}

export async function buildTextures(opts: { hd: boolean; offline: boolean; rawDir: string; outDir: string; log: (m: string) => void }): Promise<ImageryFile> {
  const tmpDir = `${opts.outDir}.tmp`;
  await rm(tmpDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });
  const fetched = new Map<ProductId, FetchedFile>();
  const fetchProduct = async (id: ProductId) => {
    const f = await fetchBinaryCached(PRODUCTS[id].url, PRODUCTS[id].cacheName, { offline: opts.offline, rawDir: opts.rawDir, log: opts.log });
    fetched.set(id, f);
    return f.path;
  };
  try {
    const bodies: Record<string, Imagery> = {};
    for (const job of LAYER_JOBS) {
      const file = await fetchProduct(job.product);
      const { width } = await imageInfo(file);
      for (const tier of tiersFor(job, { hd: opts.hd, sourceWidth: width })) {
        opts.log(`${job.body}/${job.layer} ${tier}`);
        await processLayer(job, file, tier, tmpDir);
      }
      (bodies[job.body] ??= {})[job.layer] = textureRef({ ...job, sourceId: PRODUCTS[job.product].sourceId });
    }
    bodies.saturn!.rings = await buildRings('saturn', await fetchProduct('saturn-ring-sheet'), tmpDir);
    bodies.uranus!.rings = await buildRings('uranus', await fetchProduct('uranus-ring-sheet'), tmpDir);
    bodies.sky = { color: await buildSky({ ...opts }, tmpDir, fetched) };

    const usedSourceIds = new Set([...fetched.keys()].map((id) => PRODUCTS[id].sourceId));
    const sources: Source[] = [...usedSourceIds].map((id) => {
      const dates = [...fetched.entries()].filter(([pid]) => PRODUCTS[pid].sourceId === id).map(([, f]) => f.retrievedAt).sort();
      return toSource(imagerySpec(id), dates[0]!);
    });
    const file: ImageryFile = { schemaVersion: 1, generatedAt: new Date().toISOString(), sources, bodies };

    // Budget check on the new committed tiers before anything is promoted.
    const bytes = await committedBytes(tmpDir);
    if (bytes > BUDGET_BYTES) throw new Error(`committed textures are ${(bytes / 1048576).toFixed(1)} MB, over the 60 MB budget`);
    opts.log(`committed texture size ${(bytes / 1048576).toFixed(1)} MB`);
    // Promote: copy new tiers over the old ones (local HD tiers from earlier runs are kept), then write imagery.json.
    await mkdir(opts.outDir, { recursive: true });
    await cp(tmpDir, opts.outDir, { recursive: true, force: true });
    await writeFile(path.join(opts.outDir, 'imagery.json'), `${JSON.stringify(file, null, 2)}\n`, 'utf8');
    return file;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
