import { describe, expect, it } from 'vitest';
import { ChebyshevFileSchema, type ChebyshevFile } from '../catalog/schema';
import { chebyshevRange, evaluateChebyshev } from './chebyshev';

function file(over: Partial<ChebyshevFile>): ChebyshevFile {
  return {
    schemaVersion: 1,
    bodyId: 'moon',
    centreId: 'earth',
    frame: 'ecliptic-j2000',
    unit: 'km',
    sourceId: 'jpl-horizons',
    startJdTdb: 2460000,
    segmentDays: 4,
    degree: 2,
    segments: [[1, 2, 3, 4, 5, 6, 7, 8, 9]],
    ...over,
  };
}

describe('evaluateChebyshev', () => {
  it('evaluates a known polynomial', () => {
    const f = file({ segments: [[1, 2, 3, 0, 1, 0, 5, 0, 2]] });
    // tau = 0.5 -> jd = start + 0.75 * L
    const p = evaluateChebyshev(f, 2460000 + 3)!;
    expect(p[0]).toBeCloseTo(0.5, 12);
    expect(p[1]).toBeCloseTo(0.5, 12);
    expect(p[2]).toBeCloseTo(5 + 2 * -0.5, 12);
  });

  it('picks the right segment and maps tau', () => {
    const f = file({ degree: 1, segments: [[10, 0, 10, 0, 10, 0], [20, 0, 20, 0, 20, 0]] });
    expect(evaluateChebyshev(f, 2460000 + 4 - 1e-9)![0]).toBeCloseTo(10, 6);
    expect(evaluateChebyshev(f, 2460000 + 4)![0]).toBeCloseTo(20, 6);
    expect(chebyshevRange(f)).toEqual({ fromJdTdb: 2460000, toJdTdb: 2460008 });
  });

  it('includes the last instant and rejects outside', () => {
    const f = file({});
    const to = chebyshevRange(f).toJdTdb;
    const p = evaluateChebyshev(f, to)!;
    expect(p.every(Number.isFinite)).toBe(true);
    expect(evaluateChebyshev(f, to + 1 / 86400)).toBeNull();
    expect(evaluateChebyshev(f, 2460000 - 1 / 86400)).toBeNull();
  });
});

describe('ChebyshevFileSchema', () => {
  it('accepts a valid file', () => {
    expect(ChebyshevFileSchema.safeParse(file({})).success).toBe(true);
  });
  it('rejects a segment of the wrong length', () => {
    expect(ChebyshevFileSchema.safeParse(file({ segments: [[1, 2, 3]] })).success).toBe(false);
  });
  it('rejects a non-finite coefficient', () => {
    const bad = file({ segments: [[1, 2, 3, 4, 5, 6, 7, 8, Number.NaN]] });
    expect(ChebyshevFileSchema.safeParse(bad).success).toBe(false);
  });
});
