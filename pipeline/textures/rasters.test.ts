import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { desaturateRgb, imageInfo, readBandFloat, readRgb8, writeWebp } from './rasters';

async function gradientPng(dir: string): Promise<string> {
  const w = 8, h = 4;
  const raw = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * w + x] = x * 32;
  const file = path.join(dir, 'g.png');
  await sharp(raw, { raw: { width: w, height: h, channels: 1 } }).png().toFile(file);
  return file;
}

describe('rasters', () => {
  it('reads one band as floats at the requested size', async () => {
    const file = await gradientPng(await mkdtemp(path.join(os.tmpdir(), 'ssv-r-')));
    const v = await readBandFloat(file, 4, 2);
    expect(v.length).toBe(8);
    expect(v[3]!).toBeGreaterThan(v[0]!);
  });

  it('writes WebP and reads RGB back', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ssv-r-'));
    const out = path.join(dir, 'o.webp');
    await writeWebp(new Uint8Array(4 * 2 * 3).fill(200), 4, 2, 3, out, { lossless: true });
    expect(await imageInfo(out)).toMatchObject({ width: 4, height: 2 });
    const rgb = await readRgb8(out, 4, 2);
    expect(rgb.length).toBe(24);
    expect(rgb[0]).toBe(200);
  });

  it('desaturates toward grey', () => {
    const out = desaturateRgb(Uint8Array.from([200, 100, 0]), 1);
    expect(out[0]).toBe(out[1]);
    expect(out[1]).toBe(out[2]);
  });
});
