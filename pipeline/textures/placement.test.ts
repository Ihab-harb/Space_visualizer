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
 */

type Body = 'mercury' | 'venus' | 'moon' | 'mars';
type Guard = { name: string; expect: 'darker' | 'brighter'; radiusDeg: number };

const MAPS: Record<Body, string> = {
  mercury: 'public/textures/mercury/color_1k.webp',
  venus: 'public/textures/venus/radar_1k.webp',
  moon: 'public/textures/moon/color_1k.webp',
  mars: 'public/textures/mars/color_1k.webp',
};

const GUARDS: Record<Body, Guard[]> = {
  moon: [
    { name: 'Mare Moscoviense', expect: 'darker', radiusDeg: 4 },
    { name: 'Mare Orientale', expect: 'darker', radiusDeg: 4 },
  ],
  mars: [
    { name: 'Syrtis Major Planum', expect: 'darker', radiusDeg: 6 },
    { name: 'Argyre Planitia', expect: 'brighter', radiusDeg: 6 },
  ],
  mercury: [
    { name: 'Nathair Facula', expect: 'brighter', radiusDeg: 3 },
    { name: 'Rachmaninoff', expect: 'darker', radiusDeg: 6 },
  ],
  venus: [
    { name: 'Lavinia Planitia', expect: 'brighter', radiusDeg: 6 },
    { name: 'Laima Tessera', expect: 'darker', radiusDeg: 3 },
  ],
};

/** Minimum disc-minus-ring mean luminance (0 to 1) that counts as a clear signal. */
const MIN_CONTRAST = 0.03;

type Gray = { data: Uint8Array; w: number; h: number };
type Feature = { name: string; latDeg: number; lonDegE: number };

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

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Mean luminance (0 to 1) of the disc (angle <= r) and the ring (r < angle <= 2r) around (lat, lon). */
function measure(img: Gray, latDeg: number, lonDegE: number, rDeg: number): { disc: number; ring: number } {
  const [u, v] = uvForLonLat(lonDegE, latDeg);
  const cx = u * img.w;
  const cy = (1 - v) * img.h;
  const centre = surfaceDirection(latDeg, lonDegE);
  const cosR = Math.cos((rDeg * Math.PI) / 180);
  const cos2R = Math.cos((2 * rDeg * Math.PI) / 180);
  const pxPerDeg = img.w / 360;
  const dy = Math.ceil(2 * rDeg * pxPerDeg) + 1;
  const dx = Math.ceil((2 * rDeg * pxPerDeg) / Math.max(0.05, Math.cos((latDeg * Math.PI) / 180))) + 1;
  let ds = 0, dn = 0, rs = 0, rn = 0;
  for (let py = Math.floor(cy) - dy; py <= Math.floor(cy) + dy; py++) {
    if (py < 0 || py >= img.h) continue;
    for (let px0 = Math.floor(cx) - dx; px0 <= Math.floor(cx) + dx; px0++) {
      const px = ((px0 % img.w) + img.w) % img.w;
      const lon = ((px + 0.5) / img.w - 0.5) * 360;
      const lat = (1 - (py + 0.5) / img.h - 0.5) * 180;
      const c = dot(centre, surfaceDirection(lat, lon));
      const g = img.data[py * img.w + px]! / 255;
      if (c >= cosR) { ds += g; dn++; }
      else if (c >= cos2R) { rs += g; rn++; }
    }
  }
  if (dn === 0 || rn === 0) throw new Error('empty disc or ring');
  return { disc: ds / dn, ring: rs / rn };
}

function contrast(body: Body, g: Guard, lonMap: (lon: number) => number): number {
  const f = features.get(body)!.find((x) => x.name === g.name);
  if (!f) throw new Error(`${g.name} not found in ${body} details`);
  const m = measure(images.get(body)!, f.latDeg, lonMap(f.lonDegE), g.radiusDeg);
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
  }
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
