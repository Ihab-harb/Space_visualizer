import type { ChebyshevFile } from '../../src/core/catalog/schema';
import type { Vec3 } from '../../src/core/math/vec3';

/** Least-squares Chebyshev coefficients c[0..degree] for samples at tau = t in [-1, 1] (normal equations, double precision). */
export function fitChebyshev(samples: ReadonlyArray<{ t: number; v: number }>, degree: number): number[] {
  const m = degree + 1;
  if (samples.length < m) throw new Error(`Need at least ${m} samples for degree ${degree}, got ${samples.length}`);
  const ata = Array.from({ length: m }, () => new Array<number>(m).fill(0));
  const atb = new Array<number>(m).fill(0);
  const basis = new Array<number>(m).fill(0);
  for (const { t, v } of samples) {
    basis[0] = 1;
    if (m > 1) basis[1] = t;
    for (let i = 2; i < m; i++) basis[i] = 2 * t * basis[i - 1]! - basis[i - 2]!;
    for (let i = 0; i < m; i++) {
      atb[i]! += basis[i]! * v;
      for (let j = 0; j <= i; j++) ata[i]![j]! += basis[i]! * basis[j]!;
    }
  }
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) ata[i]![j] = ata[j]![i]!;
  // Gaussian elimination with partial pivoting.
  for (let col = 0; col < m; col++) {
    let pivot = col;
    for (let r = col + 1; r < m; r++) if (Math.abs(ata[r]![col]!) > Math.abs(ata[pivot]![col]!)) pivot = r;
    [ata[col], ata[pivot]] = [ata[pivot]!, ata[col]!];
    [atb[col], atb[pivot]] = [atb[pivot]!, atb[col]!];
    for (let r = col + 1; r < m; r++) {
      const f = ata[r]![col]! / ata[col]![col]!;
      for (let c = col; c < m; c++) ata[r]![c]! -= f * ata[col]![c]!;
      atb[r]! -= f * atb[col]!;
    }
  }
  const x = new Array<number>(m).fill(0);
  for (let i = m - 1; i >= 0; i--) {
    let s = atb[i]!;
    for (let j = i + 1; j < m; j++) s -= ata[i]![j]! * x[j]!;
    x[i] = s / ata[i]![i]!;
  }
  return x;
}

/** Round to a multiple of `step`, then to the step's decimals so the serialised number is the shortest decimal (no 1.6440000000000001). */
const roundTo = (value: number, step: number) => {
  if (!(step > 0)) return value;
  const decimals = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
  return Number((Math.round(value / step) * step).toFixed(decimals));
};

/**
 * Fit consecutive segments of `segmentDays` from `startJdTdb`. A segment uses every sample inside it, both ends included.
 * The number of segments is the smallest that covers the last sample. Coefficients are rounded to `roundKm` (0 = off).
 */
export function fitTable(
  samples: Array<{ jdTdb: number; positionKm: Vec3 }>,
  opts: { startJdTdb: number; segmentDays: number; degree: number; roundKm: number },
): ChebyshevFile['segments'] {
  const { startJdTdb, segmentDays: L, degree, roundKm } = opts;
  const eps = 1e-9;
  const last = samples.reduce((m, s) => Math.max(m, s.jdTdb), -Infinity);
  const count = Math.max(1, Math.ceil((last - startJdTdb) / L - eps));
  const buckets: Array<typeof samples> = Array.from({ length: count }, () => []);
  for (const s of samples) {
    const x = (s.jdTdb - startJdTdb) / L;
    const k = Math.floor(x + eps);
    if (k >= 0 && k < count) buckets[k]!.push(s);
    if (k >= 1 && Math.abs(x - k) < eps) buckets[k - 1]!.push(s); // shared boundary sample
    else if (k === count && Math.abs(x - k) < eps) buckets[count - 1]!.push(s);
  }
  return buckets.map((bucket, k) => {
    const out: number[] = [];
    for (let axis = 0; axis < 3; axis++) {
      const pts = bucket.map((s) => ({ t: (2 * (s.jdTdb - startJdTdb - k * L)) / L - 1, v: s.positionKm[axis]! }));
      out.push(...fitChebyshev(pts, degree).map((c) => roundTo(c, roundKm)));
    }
    return out;
  });
}
