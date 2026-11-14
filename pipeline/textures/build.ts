import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageryFileSchema } from '../../src/core/catalog/schema';
import type { Imagery, ImageryFile, Source, TextureRef, Tier } from '../../src/core/catalog/schema';
import { toSource } from '../sources/registry';
import { argmaxLonLat, argminLonLat, assertElevationRange, calibrateMask, meanInBox, normalMapFromHeight, rollColumns, sampleEquirect, thresholdMask, type LonLat } from './derive';
import { fetchBinaryCached, type FetchedFile } from './fetchBinary';
import { imagerySpec, PRODUCTS, type ProductId } from './manifest';
import { desaturateRgb, imageInfo, readBandFloat, readRgb8, writeWebp } from './rasters';
import { buildRingBands, parseRingSheet, ringProfile } from './rings';
import { decodeStarMapExr, linearToSrgb8, verifySkyOrientation } from './stars';

export const TIER_WIDTH: Record<Tier, number> = { '1k': 1024, '2k': 2048, '4k': 4096, '8k': 8192 };
export const COMMITTED_TIERS: Tier[] = ['1k', '2k'];
const ALL_TIERS: Tier[] = ['1k', '2k', '4k', '8k'];
export const BUDGET_BYTES = 60 * 1024 * 1024;

type Layer = 'color' | 'night' | 'clouds' | 'normal' | 'specular' | 'radar';

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
  { body: 'earth', layer: 'normal', product: 'earth-topography', kind: 'normal', illustrative: true, maxTier: '4k', normal: { radiusM: 6_371_000, metersPerUnit: 6400 / 255, strength: 8 }, derivation: 'Normal map derived from GEBCO topography; relief exaggerated ×8 for visibility.' },
  { body: 'earth', layer: 'specular', product: 'earth-bathymetry', kind: 'mask', maxTier: '4k', derivation: 'Ocean mask derived from GEBCO bathymetry (water = 1); drives sun glint.' },
  { body: 'mars', layer: 'color', product: 'mars-color', kind: 'color', maxTier: '8k' },
  { body: 'mars', layer: 'normal', product: 'mars-dem', kind: 'normal', illustrative: true, maxTier: '4k', normal: { radiusM: 3_389_500, metersPerUnit: 1, strength: 3 }, derivation: 'Normal map derived from MOLA elevation; relief exaggerated ×3.' },
  { body: 'mercury', layer: 'color', product: 'mercury-color', kind: 'color', maxTier: '8k', desaturate: 0.8, derivation: 'MDIS 3-colour mosaic desaturated 80% toward Mercury’s natural grey-brown.' },
  { body: 'mercury', layer: 'normal', product: 'mercury-dem', kind: 'normal', illustrative: true, maxTier: '4k', normal: { radiusM: 2_439_400, metersPerUnit: 1, strength: 3 }, derivation: 'Normal map derived from the MESSENGER DEM; relief exaggerated ×3.' },
  { body: 'moon', layer: 'color', product: 'moon-color', kind: 'color', maxTier: '8k', derivation: 'LROC WAC colour mosaic (NASA SVS CGI Moon Kit, 2025); SVS: "These image is optimized for aesthetics, not science."' },
  { body: 'moon', layer: 'normal', product: 'moon-dem', kind: 'normal', illustrative: true, maxTier: '4k', normal: { radiusM: 1_737_400, metersPerUnit: 0.5, strength: 2 }, derivation: 'Normal map derived from LOLA elevation (ldem_16); relief exaggerated ×2.' },
  { body: 'venus', layer: 'radar', product: 'venus-radar', kind: 'gray', maxTier: '4k', derivation: 'Magellan C3-MDIR radar backscatter mosaic (2025 m/pixel); radar brightness, not visible light.' },
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

/** Tiers the build produces for a source: never wider than the source (1k is always kept as the floor); only committed tiers without --hd. */
export function tiersFor(job: LayerJob, opts: { hd: boolean; sourceWidth: number }): Tier[] {
  const max = ALL_TIERS.indexOf(job.maxTier);
  return ALL_TIERS.filter((t, i) => i <= max && (opts.hd || COMMITTED_TIERS.includes(t)) && (t === '1k' || TIER_WIDTH[t] <= opts.sourceWidth));
}

/** Validate the assembled imagery file before anything is promoted or written. */
export function assertValidImagery(file: ImageryFile): ImageryFile {
  return ImageryFileSchema.parse(file);
}

export function texturePath(body: string, layer: string, tier: Tier): string {
  return `textures/${body}/${layer}_${tier}.webp`;
}

/** Lists exactly the tiers the build can produce for this source (HD included); the app falls back when a local-only tier is missing. */
function textureRef(job: LayerJob & { sourceId: string }, sourceWidth: number): TextureRef {
  const tiers: Partial<Record<Tier, string>> = {};
  for (const t of tiersFor(job, { hd: true, sourceWidth })) tiers[t] = texturePath(job.body, job.layer, t);
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

/** Mean luminance of a lon/lat box in a -180..180 frame; a box with lonMax > 180 wraps past the antimeridian. */
function lumaBoxMean(rgb: Uint8Array, w: number, h: number, box: { lonMin: number; lonMax: number; latMin: number; latMax: number }): number {
  const luma = new Float32Array(w * h);
  for (let i = 0; i < luma.length; i++) luma[i] = 0.2126 * rgb[i * 3]! + 0.7152 * rgb[i * 3 + 1]! + 0.0722 * rgb[i * 3 + 2]!;
  if (box.lonMax <= 180) return meanInBox(luma, w, h, box);
  const a = { ...box, lonMax: 180 };
  const b = { ...box, lonMin: -180, lonMax: box.lonMax - 360 };
  const wa = 180 - box.lonMin;
  const wb = box.lonMax - 180;
  return (meanInBox(luma, w, h, a) * wa + meanInBox(luma, w, h, b) * wb) / (wa + wb);
}

export function validate(job: LayerJob, data: Uint8Array | Float32Array, w: number, h: number): void {
  if (job.body === 'earth' && job.layer === 'color') {
    const diff = luminanceAt(data as Uint8Array, w, h, EARTH_LAND[0]!) - luminanceAt(data as Uint8Array, w, h, EARTH_WATER[0]!);
    if (diff <= 40) throw new Error(`earth day map orientation check failed: Sahara − Pacific luminance = ${diff.toFixed(1)}`);
  }
  if (job.product === 'moon-color') {
    const maria = lumaBoxMean(data as Uint8Array, w, h, { lonMin: -60, lonMax: -20, latMin: 10, latMax: 40 });
    const highlands = lumaBoxMean(data as Uint8Array, w, h, { lonMin: 150, lonMax: 200, latMin: -20, latMax: 20 });
    if (!(maria < 0.8 * highlands)) {
      throw new Error(`moon colour orientation check failed: near-side maria box mean ${maria.toFixed(1)} is not below 0.8 x the far-side highlands box mean ${highlands.toFixed(1)}: check lonOffsetDeg`);
    }
  }
  if (job.product === 'moon-dem') {
    // Unsigned 16-bit half-metres relative to a 1727.4 km radius; elevation relative to 1737.4 km = value x 0.5 - 10000 m.
    const metres = Float32Array.from(data as Float32Array, (v) => v * 0.5 - 10000);
    assertElevationRange('moon', metres, { minBelow: -8000, maxAbove: 8000 });
    const low = argminLonLat(metres, w, h);
    const inAitken = low.latDeg >= -75 && low.latDeg <= -15 && (low.lonDeg >= 150 || low.lonDeg <= -130);
    if (!inAitken) {
      throw new Error(`moon DEM minimum at ${low.lonDeg.toFixed(1)}°, ${low.latDeg.toFixed(1)}° is not inside South Pole–Aitken (lat −75…−15, lon 150…230 E): check lonOffsetDeg`);
    }
  }
  if (job.product === 'mars-dem') {
    assertElevationRange('mars', data, { minBelow: -5000, maxAbove: 15000 });
    const peak = argmaxLonLat(data, w, h);
    const dLon = Math.abs(((peak.lonDeg - -133.8 + 540) % 360) - 180);
    if (dLon > 5 || Math.abs(peak.latDeg - 18.65) > 5) {
      throw new Error(`mars DEM peak at ${peak.lonDeg.toFixed(1)}°, ${peak.latDeg.toFixed(1)}° is not Olympus Mons (−133.8°, 18.65°): check lonOffsetDeg`);
    }
  }
  if (job.product === 'venus-radar') {
    const global = meanInBox(data, w, h, { lonMin: -180, lonMax: 180, latMin: -90, latMax: 90 });
    const maxwell = meanInBox(data, w, h, { lonMin: 0, lonMax: 7, latMin: 62, latMax: 68 });
    if (!(maxwell > 1.3 * global)) {
      throw new Error(`venus radar orientation check failed: Maxwell Montes box mean ${maxwell.toFixed(1)} is not above 1.3 x the global mean ${global.toFixed(1)}`);
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
    if (tier === '1k') validate(job, v, w, h);
    await writeWebp(Uint8Array.from(v, (x) => Math.max(0, Math.min(255, Math.round(x)))), w, h, 1, out, { quality: 90 });
  } else if (job.kind === 'normal') {
    const height = rollColumns(await readBandFloat(file, w, h, 0, { unsigned16: job.product === 'moon-dem' }), w, h, 1, lon);
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
  const tmpDir = path.join(opts.rawDir, '..', 'textures.tmp');
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
      (bodies[job.body] ??= {})[job.layer] = textureRef({ ...job, sourceId: PRODUCTS[job.product].sourceId }, width);
    }
    bodies.saturn!.rings = await buildRings('saturn', await fetchProduct('saturn-ring-sheet'), tmpDir);
    bodies.uranus!.rings = await buildRings('uranus', await fetchProduct('uranus-ring-sheet'), tmpDir);
    bodies.sky = { color: await buildSky({ ...opts }, tmpDir, fetched) };

    const usedSourceIds = new Set([...fetched.keys()].map((id) => PRODUCTS[id].sourceId));
    const sources: Source[] = [...usedSourceIds].map((id) => {
      const dates = [...fetched.entries()].filter(([pid]) => PRODUCTS[pid].sourceId === id).map(([, f]) => f.retrievedAt).sort();
      return toSource(imagerySpec(id), dates[0]!);
    });
    const file = assertValidImagery({ schemaVersion: 1, generatedAt: new Date().toISOString(), sources, bodies });

    // Budget check on the new committed tiers before anything is promoted.
    const bytes = await committedBytes(tmpDir);
    if (bytes > BUDGET_BYTES) throw new Error(`committed textures are ${(bytes / 1048576).toFixed(1)} MB, over the 60 MB budget`);
    opts.log(`committed texture size ${(bytes / 1048576).toFixed(1)} MB`);
    // Promote: copy new tiers over the old ones (local HD tiers from earlier runs are kept), then write imagery.json.
    await mkdir(opts.outDir, { recursive: true });
    await cp(tmpDir, opts.outDir, { recursive: true, force: true });
    // Prune tiers no longer advertised (e.g. upsampled tiers from earlier builds).
    for (const [bodyId, imagery] of Object.entries(bodies)) {
      for (const [layer, ref] of Object.entries(imagery)) {
        if (layer === 'rings' || !ref || !('tiers' in ref)) continue;
        for (const tier of ALL_TIERS) if (!ref.tiers[tier]) await rm(path.join(opts.outDir, bodyId, `${layer}_${tier}.webp`), { force: true });
      }
    }
    await writeFile(path.join(opts.outDir, 'imagery.json'), `${JSON.stringify(file, null, 2)}\n`, 'utf8');
    return file;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
