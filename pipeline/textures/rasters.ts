import { open as openFile } from 'node:fs/promises';
import sharp from 'sharp';

sharp.cache(false);

const open = (file: string) => sharp(file, { limitInputPixels: false });

interface SignedTiff {
  width: number;
  height: number;
  rowsPerStrip: number;
  littleEndian: boolean;
  signed: boolean;
  stripOffsets: number[];
}

/**
 * libvips (via sharp) clamps signed 16-bit GeoTIFF elevations to 0 when it converts the grey16 raster, which destroys every
 * below-datum value (Mars and Mercury DEMs). This probes a classic little- or big-endian TIFF header and returns the strip layout
 * only for uncompressed, single-band, signed 16-bit strip data; every other file is left to sharp.
 */
async function probeSignedTiff(file: string, want: 'signed' | 'unsigned' = 'signed'): Promise<SignedTiff | null> {
  const fh = await openFile(file, 'r');
  try {
    const head = Buffer.alloc(8);
    await fh.read(head, 0, 8, 0);
    const mark = head.toString('ascii', 0, 2);
    if (mark !== 'II' && mark !== 'MM') return null;
    const le = mark === 'II';
    const u16 = (b: Buffer, o: number) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
    const u32 = (b: Buffer, o: number) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
    const version = u16(head, 2);
    if (version === 43) throw new Error(`${file}: BigTIFF is not supported by the signed-elevation reader; sharp would silently drop the sign`);
    if (version !== 42) throw new Error(`${file}: unrecognised TIFF version ${version}`);
    const ifd = u32(head, 4);
    const countBuf = Buffer.alloc(2);
    await fh.read(countBuf, 0, 2, ifd);
    const n = u16(countBuf, 0);
    const entries = Buffer.alloc(n * 12);
    await fh.read(entries, 0, entries.length, ifd + 2);
    const tags = new Map<number, { type: number; count: number; valueAt: number }>();
    for (let i = 0; i < n; i++) tags.set(u16(entries, i * 12), { type: u16(entries, i * 12 + 2), count: u32(entries, i * 12 + 4), valueAt: i * 12 + 8 });
    const scalar = (id: number, fallback: number): number => {
      const t = tags.get(id);
      if (!t) return fallback;
      return t.type === 3 ? u16(entries, t.valueAt) : u32(entries, t.valueAt);
    };
    // SampleFormat absent or 1 (unsigned), 3 (float) etc. is positively not signed integer data: sharp handles it.
    // The unsigned reader exists because sharp rescales unsigned 16-bit greys to 0..255; it is used only on request.
    if (want === 'unsigned') {
      if (scalar(339, 1) !== 1) throw new Error(`${file}: not unsigned 16-bit integer TIFF data (SampleFormat ${scalar(339, 1)})`);
      if (scalar(258, 8) !== 16) throw new Error(`${file}: not unsigned 16-bit TIFF data (${scalar(258, 8)} bits per sample)`);
    } else if (scalar(339, 1) !== 2) return null;
    if (scalar(258, 8) !== 16) throw new Error(`${file}: signed TIFF with ${scalar(258, 8)} bits per sample is not supported`);
    if (scalar(259, 1) !== 1 || scalar(277, 1) !== 1 || tags.has(322)) {
      throw new Error(`${file}: 16-bit TIFF is compressed, multi-band or tiled; add a reader before using it`);
    }
    const width = scalar(256, 0);
    const height = scalar(257, 0);
    const rowsPerStrip = Math.min(scalar(278, height), height);
    const offsetsTag = tags.get(273);
    if (!offsetsTag) throw new Error(`${file}: TIFF has no StripOffsets`);
    const stripOffsets: number[] = [];
    const size = offsetsTag.type === 3 ? 2 : 4;
    if (offsetsTag.count * size <= 4) {
      for (let i = 0; i < offsetsTag.count; i++) stripOffsets.push(size === 2 ? u16(entries, offsetsTag.valueAt + i * 2) : u32(entries, offsetsTag.valueAt));
    } else {
      const arr = Buffer.alloc(offsetsTag.count * size);
      await fh.read(arr, 0, arr.length, u32(entries, offsetsTag.valueAt));
      for (let i = 0; i < offsetsTag.count; i++) stripOffsets.push(size === 2 ? u16(arr, i * 2) : u32(arr, i * 4));
    }
    if (width <= 0 || height <= 0 || rowsPerStrip <= 0) throw new Error(`${file}: TIFF has invalid dimensions`);
    const expectedStrips = Math.ceil(height / rowsPerStrip);
    if (stripOffsets.length !== expectedStrips) throw new Error(`${file}: TIFF has ${stripOffsets.length} strips, expected ${expectedStrips}`);
    return { width, height, rowsPerStrip, littleEndian: le, signed: want === 'signed', stripOffsets };
  } finally {
    await fh.close();
  }
}

/** Area-average (box filter) of a signed 16-bit TIFF to width x height, keeping negative values. Rows stream one strip at a time. */
async function readSignedTiffFloat(file: string, tiff: SignedTiff, width: number, height: number): Promise<Float32Array> {
  if (width > tiff.width || height > tiff.height) {
    throw new Error(`${file}: requested ${width}x${height} is larger than the source ${tiff.width}x${tiff.height}; the box filter does not upsample`);
  }
  const sum = new Float64Array(width * height);
  const count = new Uint32Array(width * height);
  const colBin = new Uint32Array(tiff.width);
  for (let x = 0; x < tiff.width; x++) colBin[x] = Math.min(width - 1, Math.floor((x * width) / tiff.width));
  const fh = await openFile(file, 'r');
  try {
    const fileSize = (await fh.stat()).size;
    const buf = Buffer.alloc(tiff.width * tiff.rowsPerStrip * 2);
    for (let s = 0; s < tiff.stripOffsets.length; s++) {
      const rows = Math.min(tiff.rowsPerStrip, tiff.height - s * tiff.rowsPerStrip);
      const wanted = tiff.width * rows * 2;
      const at = tiff.stripOffsets[s]!;
      if (at + wanted > fileSize) throw new Error(`${file}: strip ${s} (${at}+${wanted} bytes) lies beyond the end of the file (${fileSize} bytes); the download is truncated`);
      const { bytesRead } = await fh.read(buf, 0, wanted, at);
      if (bytesRead !== wanted) throw new Error(`${file}: short read on strip ${s}: ${bytesRead} of ${wanted} bytes`);
      for (let r = 0; r < rows; r++) {
        const y = s * tiff.rowsPerStrip + r;
        const rowBase = Math.min(height - 1, Math.floor((y * height) / tiff.height)) * width;
        for (let x = 0; x < tiff.width; x++) {
          const o = (r * tiff.width + x) * 2;
          const v = tiff.signed ? (tiff.littleEndian ? buf.readInt16LE(o) : buf.readInt16BE(o)) : tiff.littleEndian ? buf.readUInt16LE(o) : buf.readUInt16BE(o);
          const i = rowBase + colBin[x]!;
          sum[i] = sum[i]! + v;
          count[i] = count[i]! + 1;
        }
      }
    }
  } finally {
    await fh.close();
  }
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i++) {
    if (!count[i]) throw new Error(`${file}: output cell ${i} received no source samples`);
    out[i] = sum[i]! / count[i]!;
  }
  return out;
}

/** One band, resized with a Lanczos filter, as 32-bit floats. Signed 16-bit TIFFs are box-averaged by a dedicated reader so that negatives survive; `unsigned16` does the same for unsigned 16-bit TIFFs, keeping the raw 0..65535 values. */
export async function readBandFloat(file: string, width: number, height: number, band: 0 | 1 | 2 | 3 = 0, opts: { unsigned16?: boolean } = {}): Promise<Float32Array> {
  if (opts.unsigned16 && band === 0) return readSignedTiffFloat(file, (await probeSignedTiff(file, 'unsigned'))!, width, height);
  if (band === 0) {
    const signed = await probeSignedTiff(file);
    if (signed) return readSignedTiffFloat(file, signed, width, height);
  }
  const { data, info } = await open(file)
    .extractChannel(band)
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    .raw({ depth: 'float' })
    .toBuffer({ resolveWithObject: true });
  return new Float32Array(data.buffer, data.byteOffset, info.width * info.height);
}

/** sRGB 8-bit RGB at the requested size (alpha removed, 16-bit sources converted). */
export async function readRgb8(file: string, width: number, height: number): Promise<Uint8Array> {
  const { data } = await open(file)
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    .removeAlpha()
    .toColourspace('srgb')
    .raw({ depth: 'uchar' })
    .toBuffer({ resolveWithObject: true });
  return new Uint8Array(data.buffer, data.byteOffset, width * height * 3);
}

export async function writeWebp(raw: Uint8Array, width: number, height: number, channels: 1 | 2 | 3 | 4, out: string, opts: { lossless?: boolean; quality?: number }): Promise<void> {
  await sharp(Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength), { raw: { width, height, channels } })
    .webp(opts.lossless ? { lossless: true } : { quality: opts.quality ?? 90 })
    .toFile(out);
}

export function desaturateRgb(rgb: Uint8Array, amount: number): Uint8Array {
  const out = new Uint8Array(rgb.length);
  for (let i = 0; i < rgb.length; i += 3) {
    const grey = 0.2126 * rgb[i]! + 0.7152 * rgb[i + 1]! + 0.0722 * rgb[i + 2]!;
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(rgb[i + c]! + (grey - rgb[i + c]!) * amount);
  }
  return out;
}

export async function imageInfo(file: string): Promise<{ width: number; height: number; channels: number; depth: string }> {
  const m = await open(file).metadata();
  return { width: m.width ?? 0, height: m.height ?? 0, channels: m.channels ?? 0, depth: String(m.depth) };
}
