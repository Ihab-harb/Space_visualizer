import { mkdtemp, writeFile } from 'node:fs/promises';
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

/** Minimal uncompressed little-endian TIFF with one row per strip and one signed 16-bit band. */
async function signedTiff(dir: string, w: number, h: number, values: number[], opts: { truncateBytes?: number; sampleFormat?: number; magic?: number } = {}): Promise<string> {
  const entries = 11;
  const ifdOffset = 8;
  const ifdSize = 2 + entries * 12 + 4;
  const arraysAt = ifdOffset + ifdSize;
  const stripOffsetsAt = arraysAt;
  const stripCountsAt = arraysAt + h * 4;
  const dataAt = stripCountsAt + h * 4;
  const buf = Buffer.alloc(dataAt + w * h * 2);
  buf.write('II', 0, 'ascii');
  buf.writeUInt16LE(opts.magic ?? 42, 2);
  buf.writeUInt32LE(ifdOffset, 4);
  buf.writeUInt16LE(entries, ifdOffset);
  let o = ifdOffset + 2;
  const tag = (id: number, type: number, count: number, value: number) => {
    buf.writeUInt16LE(id, o);
    buf.writeUInt16LE(type, o + 2);
    buf.writeUInt32LE(count, o + 4);
    if (type === 3 && count === 1) buf.writeUInt16LE(value, o + 8);
    else buf.writeUInt32LE(value, o + 8);
    o += 12;
  };
  tag(256, 3, 1, w);
  tag(257, 3, 1, h);
  tag(258, 3, 1, 16);
  tag(259, 3, 1, 1);
  tag(262, 3, 1, 1);
  tag(273, 4, h, stripOffsetsAt);
  tag(277, 3, 1, 1);
  tag(278, 3, 1, 1);
  tag(279, 4, h, stripCountsAt);
  tag(284, 3, 1, 1);
  tag(339, 3, 1, 2);
  for (let y = 0; y < h; y++) {
    buf.writeUInt32LE(dataAt + y * w * 2, stripOffsetsAt + y * 4);
    buf.writeUInt32LE(w * 2, stripCountsAt + y * 4);
  }
  for (let i = 0; i < w * h; i++) buf.writeInt16LE(values[i]!, dataAt + i * 2);
  const file = path.join(dir, 'signed.tif');
  await writeFile(file, opts.truncateBytes ? buf.subarray(0, buf.length - opts.truncateBytes) : buf);
  return file;
}

describe('rasters', () => {
  const dir = () => mkdtemp(path.join(os.tmpdir(), 'ssv-r-'));
  const values8 = [-8000, -6000, 100, 200, -4000, -2000, 300, 400];

  it('throws when a signed TIFF is truncated mid-strip instead of reusing stale rows', async () => {
    const file = await signedTiff(await dir(), 4, 2, values8, { truncateBytes: 4 });
    await expect(readBandFloat(file, 2, 1)).rejects.toThrow(/strip|truncated|file/i);
  });

  it('throws when the target is larger than the signed source (no upsampling)', async () => {
    const file = await signedTiff(await dir(), 4, 2, values8);
    await expect(readBandFloat(file, 8, 4)).rejects.toThrow(/larger than the source|upsampl/i);
  });

  it('throws for a BigTIFF header rather than letting sharp drop the sign', async () => {
    const file = await signedTiff(await dir(), 4, 2, values8, { magic: 43 });
    await expect(readBandFloat(file, 2, 1)).rejects.toThrow(/BigTIFF/);
  });

  it('keeps the sign of signed 16-bit TIFF elevations when averaging down', async () => {
    const file = await signedTiff(await mkdtemp(path.join(os.tmpdir(), 'ssv-r-')), 4, 2, [-8000, -6000, 100, 200, -4000, -2000, 300, 400]);
    const v = await readBandFloat(file, 2, 1);
    expect(Array.from(v)).toEqual([-5000, 250]);
  });

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
