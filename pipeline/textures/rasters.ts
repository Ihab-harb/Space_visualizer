import sharp from 'sharp';

sharp.cache(false);

const open = (file: string) => sharp(file, { limitInputPixels: false });

/** One band, resized with a Lanczos filter, as 32-bit floats (signed rasters keep their sign). */
export async function readBandFloat(file: string, width: number, height: number, band: 0 | 1 | 2 | 3 = 0): Promise<Float32Array> {
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
