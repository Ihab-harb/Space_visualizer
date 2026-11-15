import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { surfaceDirection } from '../../src/core/frames/surfacePoint';
import { uvForLonLat } from '../../src/scene/materials/bodyUniforms';
import type { Vec3 } from '../../src/core/math/vec3';

/**
 * Placement guards: named features from the committed details files must land on the right
 * spot of each committed 1k map, under the app's convention (longitude 0 at the centre column,
 * east to the right, see uvForLonLat). Positions come only from the details files, by name.
 * Each guard states a physical prior (what the feature is) before any measuring, and the disc is
 * sized from the feature's own diameter, so a mirrored or half-turned map would fail it.
 */

type Body = 'mercury' | 'venus' | 'moon' | 'mars';
/** `prior` is what the feature is, known before looking at the map. */
type Guard = { name: string; expect: 'darker' | 'brighter'; prior: string };

const MAPS: Record<Body, string> = {
  mercury: 'public/textures/mercury/color_1k.webp',
  venus: 'public/textures/venus/radar_1k.webp',
  moon: 'public/textures/moon/color_1k.webp',
  mars: 'public/textures/mars/color_1k.webp',
};

const GUARDS: Record<Body, Guard[]> = {
  moon: [
    { name: 'Mare Crisium', expect: 'darker', prior: 'a mare: dark basalt plain among bright highlands' },
    { name: 'Mare Moscoviense', expect: 'darker', prior: 'a mare: dark basalt plain among bright highlands' },
    { name: 'Mare Orientale', expect: 'darker', prior: 'a mare: dark basalt plain among bright highlands' },
    { name: 'Tycho', expect: 'brighter', prior: 'young rayed craters are bright' },
  ],
  mars: [
    { name: 'Syrtis Major Planum', expect: 'darker', prior: 'the classical dark albedo feature' },
    { name: 'Hellas Planitia', expect: 'brighter', prior: 'a bright basin floor (dust and frost)' },
    { name: 'Argyre Planitia', expect: 'brighter', prior: 'a bright basin floor (dust and frost)' },
  ],
  mercury: [
    { name: 'Nathair Facula', expect: 'brighter', prior: 'a facula is a bright spot by definition' },
    { name: 'Hokusai', expect: 'brighter', prior: 'young rayed craters are bright' },
  ],
  venus: [
    { name: 'Ovda Regio', expect: 'brighter', prior: 'highland regio: rough terrain, radar-bright' },
    { name: 'Atla Regio', expect: 'brighter', prior: 'highland regio: rough terrain, radar-bright' },
    { name: 'Beta Regio', expect: 'brighter', prior: 'highland regio: rough terrain, radar-bright' },
    { name: 'Maxwell Montes', expect: 'brighter', prior: 'mountain belts are rough and radar-bright' },
  ],
};

/** Disc radius, ring inner and ring outer radius, each as a fraction of the feature's angular radius. */
const DISC_FRACTION = 0.6;
const RING_INNER = 1.3;
const RING_OUTER = 2.0;
/** Minimum disc-minus-ring mean luminance (0 to 1) that counts as a clear signal. */
const MIN_CONTRAST = 0.03;

type Gray = { data: Uint8Array; w: number; h: number };
type Feature = { name: string; latDeg: number; lonDegE: number; diameterKm: number };
const radiiKm = new Map<Body, number>();

const images = new Map<Body, Gray>();
const features = new Map<Body, Feature[]>();

async function loadGray(path: string): Promise<Gray> {
  const { data, info } = await sharp(resolve(path)).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), w: info.width, h: info.height };
}

function loadFeatures(body: Body): Feature[] {
  const d = JSON.parse(readFileSync(resolve(`public/data/solar-system/details/${body}.json`), 'utf8')) as {
    features?: { items: Feature[] };
    landmarks?: Feature[];
  };
  return [...(d.features?.items ?? []), ...(d.landmarks ?? [])];
}

function bodyRadiusKm(body: Body): number {
  const d = JSON.parse(readFileSync(resolve('public/data/solar-system/bodies.json'), 'utf8')) as {
    bodies: { id: string; shape: { equatorialRadiusKm: number } }[];
  };
  return d.bodies.find((b) => b.id === body)!.shape.equatorialRadiusKm;
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Mean of `value(luminance)` (luminance 0 to 1) over the disc (angle <= disc) and the ring (ringIn < angle <= ringOut), angles
 * in degrees. The default value is the luminance itself.
 */
function measure(
  img: Gray, latDeg: number, lonDegE: number, discDeg: number, ringInDeg: number, ringOutDeg: number,
  value: (g: number) => number = (g) => g,
): { disc: number; ring: number } {
  const [u, v] = uvForLonLat(lonDegE, latDeg);
  const cx = u * img.w;
  const cy = (1 - v) * img.h;
  const centre = surfaceDirection(latDeg, lonDegE);
  const cos = (d: number): number => Math.cos((d * Math.PI) / 180);
  const cosDisc = cos(discDeg);
  const cosIn = cos(ringInDeg);
  const cosOut = cos(ringOutDeg);
  const pxPerDeg = img.w / 360;
  const dy = Math.ceil(ringOutDeg * pxPerDeg) + 1;
  const dx = Math.ceil((ringOutDeg * pxPerDeg) / Math.max(0.05, cos(Math.min(89, Math.abs(latDeg) + ringOutDeg)))) + 1;
  let ds = 0, dn = 0, rs = 0, rn = 0;
  for (let py = Math.max(0, Math.floor(cy) - dy); py <= Math.min(img.h - 1, Math.floor(cy) + dy); py++) {
    for (let px0 = Math.floor(cx) - dx; px0 <= Math.floor(cx) + dx; px0++) {
      const px = ((px0 % img.w) + img.w) % img.w;
      const lon = ((px + 0.5) / img.w - 0.5) * 360;
      const lat = (1 - (py + 0.5) / img.h - 0.5) * 180;
      const c = dot(centre, surfaceDirection(lat, lon));
      const g = value(img.data[py * img.w + px]! / 255);
      if (c >= cosDisc) { ds += g; dn++; }
      else if (c >= cosOut && c < cosIn) { rs += g; rn++; }
    }
  }
  if (dn === 0 || rn === 0) throw new Error('empty disc or ring');
  return { disc: ds / dn, ring: rs / rn };
}

/** Angular radius of a feature in degrees, from its diameter and the body's equatorial radius. */
function angularRadiusDeg(body: Body, f: Feature): number {
  return ((f.diameterKm / 2) / radiiKm.get(body)!) * (180 / Math.PI);
}

function contrast(body: Body, g: Guard, lonMap: (lon: number) => number): number {
  const f = features.get(body)!.find((x) => x.name === g.name);
  if (!f) throw new Error(`${g.name} not found in ${body} details`);
  const a = angularRadiusDeg(body, f);
  const m = measure(images.get(body)!, f.latDeg, lonMap(f.lonDegE), DISC_FRACTION * a, RING_INNER * a, RING_OUTER * a);
  return m.disc - m.ring;
}

function passes(g: Guard, c: number): boolean {
  return g.expect === 'darker' ? c <= -MIN_CONTRAST : c >= MIN_CONTRAST;
}

const BODIES = Object.keys(GUARDS) as Body[];

beforeAll(async () => {
  for (const b of BODIES) {
    images.set(b, await loadGray(MAPS[b]));
    features.set(b, loadFeatures(b));
    radiiKm.set(b, bodyRadiusKm(b));
  }
});

/**
 * Earth has no Gazetteer sizes, so its guard uses a small fixed disc and a land-or-water prior instead of a size-scaled
 * contrast. On the 1k colour map open ocean and the Great Lakes are near black; land and ice are brighter. Each guard
 * states where the landmark is and what lies at its mirrored and half-turned longitudes. Measured (radius 0.4 degrees):
 * no Earth landmark has water at its half-turned longitude (all are land or Antarctic ice there), so the half-turn is
 * caught by Lake Superior, a lake whose transforms fall on dry land.
 */
const EARTH_MAP = 'public/textures/earth/color_1k.webp';
/** Disc radius in degrees (about 45 km): inside the Island of Hawaiʻi and inside Lake Superior. */
const EARTH_DISC_DEG = 0.4;
/** A pixel darker than this is water. */
const WATER_LUMINANCE = 0.08;
/** Water share of the disc: at least WATER_SHARE is water, at most 1 - WATER_SHARE is land. */
const WATER_SHARE = 0.75;
type EarthGuard = { name: string; expect: 'water' | 'land'; prior: string };
const EARTH_GUARDS: EarthGuard[] = [
  { name: 'Lake Superior', expect: 'water', prior: 'open water, the largest freshwater lake by area; its mirrored (87.8° E) and half-turned (92.2° E) longitudes at 47.5° N are inland Asia, dry land' },
  { name: 'McMurdo Dry Valleys', expect: 'land', prior: 'ice-free land in Victoria Land; its mirrored longitude (162° W at 77.5° S) is the open Ross Sea; its half-turn is the ice sheet' },
  { name: 'Mauna Loa', expect: 'land', prior: 'a volcano covering half the Island of Hawaiʻi; its mirrored longitude (155.6° E at 19.5° N) is open Pacific; its half-turn is the Sahara' },
];
let earthImage: Gray;
let earthLandmarks: Feature[];

function waterShare(g: EarthGuard, lonMap: (lon: number) => number): number {
  const f = earthLandmarks.find((x) => x.name === g.name);
  if (!f) throw new Error(`${g.name} not found in earth details`);
  const r = EARTH_DISC_DEG;
  return measure(earthImage, f.latDeg, lonMap(f.lonDegE), r, 2 * r, 3 * r, (lum) => (lum < WATER_LUMINANCE ? 1 : 0)).disc;
}
const earthPasses = (g: EarthGuard, share: number): boolean => (g.expect === 'water' ? share >= WATER_SHARE : share <= 1 - WATER_SHARE);

describe('Earth placement guards (land against water)', () => {
  beforeAll(async () => {
    earthImage = await loadGray(EARTH_MAP);
    earthLandmarks = (JSON.parse(readFileSync(resolve('public/data/solar-system/details/earth.json'), 'utf8')) as { landmarks: Feature[] }).landmarks;
  });
  it('earth: pins land on the picture', () => {
    for (const g of EARTH_GUARDS) {
      const s = waterShare(g, (lon) => lon);
      expect(earthPasses(g, s), `${g.name} should be ${g.expect}, water share ${s.toFixed(2)}`).toBe(true);
    }
  });
  it('earth: a mirrored longitude would be caught', () => {
    expect(EARTH_GUARDS.filter((g) => !earthPasses(g, waterShare(g, (lon) => 360 - lon))).length).toBeGreaterThan(0);
  });
  it('earth: a half-turn shift would be caught', () => {
    expect(EARTH_GUARDS.filter((g) => !earthPasses(g, waterShare(g, (lon) => lon + 180))).length).toBeGreaterThan(0);
  });
});

describe('placement guards on the committed maps', () => {
  for (const body of BODIES) {
    it(`${body}: pins land on the picture`, () => {
      for (const g of GUARDS[body]) {
        const c = contrast(body, g, (lon) => lon);
        expect(passes(g, c), `${g.name} should be ${g.expect}, contrast ${c.toFixed(3)}`).toBe(true);
      }
    });
    it(`${body}: a mirrored longitude would be caught`, () => {
      const failing = GUARDS[body].filter((g) => !passes(g, contrast(body, g, (lon) => 360 - lon)));
      expect(failing.length).toBeGreaterThan(0);
    });
    it(`${body}: a half-turn shift would be caught`, () => {
      const failing = GUARDS[body].filter((g) => !passes(g, contrast(body, g, (lon) => lon + 180)));
      expect(failing.length).toBeGreaterThan(0);
    });
  }
});
