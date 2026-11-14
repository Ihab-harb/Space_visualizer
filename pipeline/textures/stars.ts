import { readFile } from 'node:fs/promises';
import { FloatType } from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

/** J2000 positions (Hipparcos), used only to validate the sky map's orientation. */
export const ORIENTATION_STARS = [
  { name: 'Vega', raDeg: 279.2347, decDeg: 38.7837 },
  { name: 'Capella', raDeg: 79.1723, decDeg: 45.998 },
  { name: 'Arcturus', raDeg: 213.9153, decDeg: 19.1824 },
  { name: 'Canopus', raDeg: 95.988, decDeg: -52.6957 },
  { name: 'Procyon', raDeg: 114.8255, decDeg: 5.225 },
];

/** Image convention (NASA Deep Star Maps): centre column = RA 0h, RA increases to the left, top row = +90° Dec. */
export function pixelToRaDec(x: number, y: number, width: number, height: number): { raDeg: number; decDeg: number } {
  const u = (x + 0.5) / width;
  return { raDeg: (((0.5 - u) * 360) % 360 + 360) % 360, decDeg: 90 - ((y + 0.5) / height) * 180 };
}

export function raDecToPixel(raDeg: number, decDeg: number, width: number, height: number): { x: number; y: number } {
  const u = (((0.5 - raDeg / 360) % 1) + 1) % 1;
  return { x: Math.min(width - 1, Math.floor(u * width)), y: Math.min(height - 1, Math.max(0, Math.floor(((90 - decDeg) / 180) * height))) };
}

export async function decodeStarMapExr(file: string): Promise<{ width: number; height: number; rgb: Float32Array }> {
  const buf = await readFile(file);
  const loader = new EXRLoader();
  loader.setDataType(FloatType);
  const tex = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer) as unknown as {
    data: Float32Array;
    width: number;
    height: number;
  };
  const { width, height, data } = tex;
  const channels = data.length / (width * height);
  const rgb = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y; // EXRLoader rows are bottom-up
    for (let x = 0; x < width; x++) {
      const s = (srcRow * width + x) * channels;
      const d = (y * width + x) * 3;
      rgb[d] = data[s]!;
      rgb[d + 1] = data[s + 1]!;
      rgb[d + 2] = data[s + 2]!;
    }
  }
  return { width, height, rgb };
}

export function linearToSrgb8(values: Float32Array, exposure: number): Uint8Array {
  const out = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const v = Math.min(1, Math.max(0, values[i]! * exposure));
    const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    out[i] = Math.round(s * 255);
  }
  return out;
}

export function findBrightBlobs(gray: ArrayLike<number>, width: number, height: number, threshold: number): Array<{ x: number; y: number; pixels: number }> {
  const seen = new Uint8Array(width * height);
  const blobs: Array<{ x: number; y: number; pixels: number }> = [];
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || gray[start]! < threshold) continue;
    const stack = [start];
    seen[start] = 1;
    let pixels = 0;
    let sx = 0;
    let sy = 0;
    const anchorX = start % width;
    while (stack.length) {
      const j = stack.pop()!;
      const x = j % width;
      const y = Math.floor(j / width);
      // Unwrap x relative to the first pixel so blobs across the seam average correctly.
      let ux = x;
      if (ux - anchorX > width / 2) ux -= width;
      if (anchorX - ux > width / 2) ux += width;
      pixels += 1;
      sx += ux;
      sy += y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = (x + dx + width) % width;
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        const k = ny * width + nx;
        if (!seen[k] && gray[k]! >= threshold) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
    blobs.push({ x: (((sx / pixels) % width) + width) % width, y: sy / pixels, pixels });
  }
  return blobs.sort((a, b) => b.pixels - a.pixels);
}

/** Each orientation star must have a bright blob within 1° of its catalogue position. */
export function verifySkyOrientation(gray: ArrayLike<number>, width: number, height: number): { matched: string[]; missing: string[] } {
  const blobs = findBrightBlobs(gray, width, height, 0.9).slice(0, 400);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const star of ORIENTATION_STARS) {
    const hit = blobs.some((b) => {
      const p = pixelToRaDec(b.x, b.y, width, height);
      const dRa = Math.abs(((p.raDeg - star.raDeg + 540) % 360) - 180) * Math.cos((star.decDeg * Math.PI) / 180);
      return Math.hypot(dRa, p.decDeg - star.decDeg) < 1;
    });
    (hit ? matched : missing).push(star.name);
  }
  return { matched, missing };
}
