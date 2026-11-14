import type { ChebyshevFile } from '../catalog/schema';
import type { Vec3 } from '../math/vec3';

export function chebyshevRange(file: ChebyshevFile): { fromJdTdb: number; toJdTdb: number } {
  return { fromJdTdb: file.startJdTdb, toJdTdb: file.startJdTdb + file.segments.length * file.segmentDays };
}

/** Clenshaw recurrence for sum c[offset + i] * T_i(tau), i = 0..degree. */
function clenshaw(c: readonly number[], offset: number, degree: number, tau: number): number {
  let b1 = 0;
  let b2 = 0;
  for (let i = degree; i >= 1; i--) {
    const b0 = c[offset + i]! + 2 * tau * b1 - b2;
    b2 = b1;
    b1 = b0;
  }
  return c[offset]! + tau * b1 - b2;
}

/** Position in km from the table's centre, or null outside the table's time range. */
export function evaluateChebyshev(file: ChebyshevFile, jdTdb: number): Vec3 | null {
  const { fromJdTdb, toJdTdb } = chebyshevRange(file);
  if (!(jdTdb >= fromJdTdb && jdTdb <= toJdTdb)) return null;
  const n = file.segments.length;
  const L = file.segmentDays;
  const k = Math.min(Math.floor((jdTdb - fromJdTdb) / L), n - 1);
  const tau = (2 * (jdTdb - fromJdTdb - k * L)) / L - 1;
  const seg = file.segments[k]!;
  const m = file.degree + 1;
  return [clenshaw(seg, 0, file.degree, tau), clenshaw(seg, m, file.degree, tau), clenshaw(seg, 2 * m, file.degree, tau)];
}
