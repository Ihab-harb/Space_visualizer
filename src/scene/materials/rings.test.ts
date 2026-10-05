import { describe, expect, it } from 'vitest';
import type { Body } from '../../core/catalog/schema';
import { normalize, type Vec3 } from '../../core/math/vec3';
import { rayHitsEllipsoid } from '../../core/shadows/eclipse';
import { makeJupiter } from '../../test/fixtures';
import { ringFaceLighting, ringRadii, ringShadowCoord } from './rings';

const DEG = Math.PI / 180;
const jupiter = makeJupiter();
const saturn: Body = {
  ...jupiter,
  id: 'saturn',
  shape: { ...jupiter.shape, equatorialRadiusKm: 60268, polarRadiusKm: 54364 },
  imagery: {
    rings: {
      texture: { tiers: { '2k': 'textures/saturn/rings_2k.webp' }, sourceId: 'nssdca-saturn-rings', illustrative: true },
      innerKm: { value: 74658, sourceId: 'nssdca-saturn-rings' },
      outerKm: { value: 139851, sourceId: 'nssdca-saturn-rings' },
    },
  },
};

describe('ring helpers', () => {
  it('expresses ring radii in equatorial radii', () => {
    expect(ringRadii(saturn)!.inner).toBeCloseTo(74658 / 60268, 12);
    expect(ringRadii(saturn)!.outer).toBeCloseTo(139851 / 60268, 12);
    expect(ringRadii(jupiter)).toBeNull();
  });

  it('casts the ring shadow on the winter hemisphere only', () => {
    const { inner, outer } = ringRadii(saturn)!;
    const sun = normalize([1, 0, 0.3]);
    const south: Vec3 = [Math.cos(-20 * DEG), 0, Math.sin(-20 * DEG)];
    // The ray climbs 0.3 per unit of x, so it meets z = 0 at x = cos 20° + sin 20° / 0.3.
    const r = Math.cos(20 * DEG) + Math.sin(20 * DEG) / 0.3;
    expect(ringShadowCoord(south, sun, inner, outer)).toBeCloseTo((r - inner) / (outer - inner), 9);
    const north: Vec3 = [Math.cos(20 * DEG), 0, Math.sin(20 * DEG)];
    expect(ringShadowCoord(north, sun, inner, outer)).toBeNull();
  });

  it('tells the lit face from the unlit face', () => {
    expect(ringFaceLighting(normalize([1, 0, 0.2]), normalize([0, 1, 0.5])).litFace).toBe(true);
    const under = ringFaceLighting(normalize([1, 0, 0.2]), normalize([0, 1, -0.5]));
    expect(under.litFace).toBe(false);
    expect(under.mu).toBeCloseTo(0.5 / Math.hypot(1, 0.5), 12);
  });

  it('puts ring particles behind the planet in its shadow (convention used by the ring shader)', () => {
    const sun = normalize([1, 0, 0.05]);
    expect(rayHitsEllipsoid([-1.6, 0, 0], sun, 54364 / 60268)).toBe(true);
    expect(rayHitsEllipsoid([1.6, 0, 0], sun, 54364 / 60268)).toBe(false);
  });
});
