export interface LonLat {
  lonDeg: number;
  latDeg: number;
}

const DEG = Math.PI / 180;

function pixelOf(width: number, height: number, lonDeg: number, latDeg: number): { x: number; y: number } {
  const x = (((Math.floor(((lonDeg + 180) / 360) * width) % width) + width) % width);
  const y = Math.min(height - 1, Math.max(0, Math.floor(((90 - latDeg) / 180) * height)));
  return { x, y };
}

export function sampleEquirect(values: ArrayLike<number>, width: number, height: number, lonDeg: number, latDeg: number, channels = 1, channel = 0): number {
  const { x, y } = pixelOf(width, height, lonDeg, latDeg);
  return values[(y * width + x) * channels + channel]!;
}

export function argmaxLonLat(values: ArrayLike<number>, width: number, height: number): { lonDeg: number; latDeg: number; value: number } {
  let best = 0;
  for (let i = 1; i < width * height; i++) if (values[i]! > values[best]!) best = i;
  const x = best % width;
  const y = Math.floor(best / width);
  return { lonDeg: ((x + 0.5) / width) * 360 - 180, latDeg: 90 - ((y + 0.5) / height) * 180, value: values[best]! };
}

/** Mean of the pixels whose centres lie inside the lon/lat box (edges inclusive) of an equirectangular grid spanning -180..180 E, 90..-90 N. */
export function meanInBox(values: ArrayLike<number>, width: number, height: number, box: { lonMin: number; lonMax: number; latMin: number; latMax: number }): number {
  const eps = 1e-9;
  let sum = 0;
  let n = 0;
  for (let y = 0; y < height; y++) {
    const lat = 90 - ((y + 0.5) / height) * 180;
    if (lat < box.latMin - eps || lat > box.latMax + eps) continue;
    for (let x = 0; x < width; x++) {
      const lon = ((x + 0.5) / width) * 360 - 180;
      if (lon < box.lonMin - eps || lon > box.lonMax + eps) continue;
      sum += values[y * width + x]!;
      n++;
    }
  }
  if (n === 0) throw new Error('meanInBox: the box contains no pixel centres');
  return sum / n;
}

export function rangeOf(values: ArrayLike<number>): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

export function assertElevationRange(name: string, values: ArrayLike<number>, limits: { minBelow: number; maxAbove: number }): void {
  const { min, max } = rangeOf(values);
  if (!(min < limits.minBelow && max > limits.maxAbove)) {
    throw new Error(`${name} elevation range ${min} .. ${max} m fails sanity check (need min < ${limits.minBelow}, max > ${limits.maxAbove}); signed data may have been read as unsigned`);
  }
}

/** Tangent-space normals (x = east, y = north, z = up) from an equirectangular height grid. */
export function normalMapFromHeight(height: Float32Array, width: number, rows: number, opts: { radiusM: number; metersPerUnit: number; strength: number }): Uint8Array {
  const out = new Uint8Array(width * rows * 3);
  const dy = (Math.PI * opts.radiusM) / rows;
  for (let y = 0; y < rows; y++) {
    const lat = (90 - ((y + 0.5) / rows) * 180) * DEG;
    const dx = (2 * Math.PI * opts.radiusM * Math.max(Math.cos(lat), 0.01)) / width;
    const yUp = Math.max(0, y - 1);
    const yDown = Math.min(rows - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const xE = (x + 1) % width;
      const xW = (x - 1 + width) % width;
      const dhdx = ((height[y * width + xE]! - height[y * width + xW]!) * opts.metersPerUnit) / (2 * dx);
      const dhdy = ((height[yUp * width + x]! - height[yDown * width + x]!) * opts.metersPerUnit) / ((yDown - yUp) * dy);
      let nx = -opts.strength * dhdx;
      let ny = -opts.strength * dhdy;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * width + x) * 3;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }
  return out;
}

/** Finds a threshold separating known land points from known water points; throws if they overlap. */
export function calibrateMask(values: ArrayLike<number>, width: number, height: number, land: LonLat[], water: LonLat[]): { threshold: number; waterAbove: boolean } {
  const l = land.map((p) => sampleEquirect(values, width, height, p.lonDeg, p.latDeg));
  const w = water.map((p) => sampleEquirect(values, width, height, p.lonDeg, p.latDeg));
  const [lMin, lMax, wMin, wMax] = [Math.min(...l), Math.max(...l), Math.min(...w), Math.max(...w)];
  if (wMin > lMax) return { threshold: (wMin + lMax) / 2, waterAbove: true };
  if (wMax < lMin) return { threshold: (wMax + lMin) / 2, waterAbove: false };
  throw new Error(`cannot separate land from water (land ${lMin}..${lMax}, water ${wMin}..${wMax})`);
}

export function thresholdMask(values: ArrayLike<number>, threshold: number, waterAbove: boolean): Uint8Array {
  const out = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = (waterAbove ? values[i]! > threshold : values[i]! < threshold) ? 255 : 0;
  return out;
}

/** Rolls every row east by `degrees` (rounded to whole pixels). */
export function rollColumns<T extends Uint8Array | Float32Array>(data: T, width: number, height: number, channels: number, degrees: number): T {
  const shift = ((Math.round((degrees / 360) * width) % width) + width) % width;
  if (shift === 0) return data;
  const out = new (data.constructor as new (n: number) => T)(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * channels;
      const to = (y * width + ((x + shift) % width)) * channels;
      for (let c = 0; c < channels; c++) out[to + c] = data[from + c]!;
    }
  }
  return out;
}
