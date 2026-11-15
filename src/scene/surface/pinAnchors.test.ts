import { describe, expect, it } from 'vitest';
import { IDENTITY, rotZ, transpose } from '../../core/math/mat3';
import { length, type Vec3 } from '../../core/math/vec3';
import { labelLayout, rectsOverlap } from '../../ui/explore/labelLayout';
import { PIN_FADE, PIN_NAME_LAYOUT, pinFacing, pinNameAnchors, pinPoints, pinSide } from './pinAnchors';

const expectCloseVec = (actual: Vec3, expected: Vec3, digits = 9) => actual.forEach((c, i) => expect(c).toBeCloseTo(expected[i]!, digits));

describe('pinFacing', () => {
  it('a pin facing the camera is fully shown; on the limb and beyond it is hidden', () => {
    expect(pinFacing([1, 0, 0], [1, 0, 0], [5, 0, 0])).toBe(1);
    expect(pinFacing([0, 1, 0], [0, 1, 0], [5, 0, 0])).toBe(0);
    expect(pinFacing([-1, 0, 0], [-1, 0, 0], [5, 0, 0])).toBe(0);
  });

  it('fades between the two thresholds', () => {
    // A normal at cosine 0.16 to the line to a camera straight above the point (point at the origin for clarity).
    const c = 0.16;
    const normal: Vec3 = [c, Math.sqrt(1 - c * c), 0];
    const f = pinFacing([0, 0, 0], normal, [10, 0, 0]);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
    expect(pinFacing([0, 0, 0], [PIN_FADE.from, Math.sqrt(1 - PIN_FADE.from ** 2), 0], [10, 0, 0])).toBeCloseTo(0, 9);
    expect(pinFacing([0, 0, 0], [PIN_FADE.to, Math.sqrt(1 - PIN_FADE.to ** 2), 0], [10, 0, 0])).toBeCloseTo(1, 9);
  });
});

describe('pinPoints', () => {
  it('places a pole pin on the flattened pole', () => {
    expectCloseVec(pinPoints([{ id: 'p', latDeg: 90, lonDegE: 0, rank: 0 }], IDENTITY, 0.9, [1, 0, 0], 3.4)[0]!.offsetWorld, [0, 0, 0.9]);
  });

  it('turns with the body orientation', () => {
    // Body-fixed to world: an active 90 degree turn about z (rotZ is passive, so its transpose).
    const turn = transpose(rotZ(Math.PI / 2));
    const [p] = pinPoints([{ id: 'p', latDeg: 0, lonDegE: 0, rank: 0 }], turn, 1, [0, 1, 0], 3);
    expectCloseVec(p!.offsetWorld, [0, 1, 0]);
    expect(p!.facing).toBe(1);
  });

  it('keeps id and rank, and hides pins on the far side', () => {
    const pins = pinPoints(
      [
        { id: 'near', latDeg: 0, lonDegE: 0, rank: 0 },
        { id: 'far', latDeg: 0, lonDegE: 180, rank: 1 },
      ],
      IDENTITY,
      1,
      [1, 0, 0],
      3,
    );
    expect(pins.map((p) => [p.id, p.rank])).toEqual([
      ['near', 0],
      ['far', 1],
    ]);
    expect(pins[0]!.facing).toBe(1);
    expect(pins[1]!.facing).toBe(0);
  });

  it('uses the ellipsoid normal, not the direction of the point, on a flattened body', () => {
    // At latitude 45 on a body with flattening 0.5 the point is (c, 0, c/2) and the surface normal is along (1, 0, 2).
    // A camera far along (2, 0, -1) from the point sits on the tangent plane: on the limb, so hidden, although the
    // direction of the point, (1, 0, 0.5), is only 53 degrees from the line to it.
    const pin = { id: 'p', latDeg: 45, lonDegE: 0, rank: 0 };
    const c = Math.cos(Math.PI / 4);
    const point: Vec3 = [c, 0, c / 2];
    const camera: Vec3 = [point[0] + (1000 * 2) / Math.sqrt(5), 0, point[2] - 1000 / Math.sqrt(5)];
    const d = length(camera);
    const [p] = pinPoints([pin], IDENTITY, 0.5, [camera[0] / d, 0, camera[2] / d], d);
    expectCloseVec(p!.offsetWorld, point);
    expect(p!.facing).toBe(0);
  });
});

describe('pinSide', () => {
  it('puts a name on the side of the body its pin is on', () => {
    expect(pinSide(100, 200)).toBe('left');
    expect(pinSide(300, 200)).toBe('right');
  });
});

describe('pinNameAnchors', () => {
  const size = { width: 80, height: 18 };
  const points = [
    { id: 'a', rank: 0, x: 500, y: 300, facing: 1 },
    { id: 'b', rank: 1, x: 700, y: 320, facing: 0.6 },
    { id: 'c', rank: 2, x: 650, y: 400, facing: 0.4 },
  ];
  const sizes = new Map(points.map((p) => [p.id, size]));

  it('names only the pins well inside the facing side, on their side of the body, the best known first', () => {
    const anchors = pinNameAnchors(points, sizes, 640, { selectedId: null, hoveredId: null });
    expect(anchors.map((a) => a.id)).toEqual(['a', 'b']);
    expect(anchors.map((a) => a.side)).toEqual(['left', 'right']);
    expect(anchors[0]!.priority).toBeGreaterThan(anchors[1]!.priority);
    expect(anchors[0]!.full).toEqual(size);
    expect(anchors[0]!.collapsed).toEqual(size);
  });

  it('names never overlap each other or the reserved rects at 1280x720 and 800x1000, and the selected pin keeps its name', () => {
    // A small seeded generator (mulberry32), so the case is the same on every run.
    const random = (seed: number) => () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 800, height: 1000 },
    ]) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const rnd = random(seed);
        const body = { x: viewport.width / 2, y: viewport.height / 2, r: Math.min(viewport.width, viewport.height) * 0.3 };
        const gutter = 20;
        const reserved = [
          { left: gutter, top: gutter, right: gutter + 220, bottom: gutter + 70 }, // title
          { left: viewport.width / 2 - 85, top: gutter, right: viewport.width / 2 + 85, bottom: gutter + 44 }, // tabs
          { left: viewport.width - gutter - 340, top: gutter + 52, right: viewport.width - gutter, bottom: gutter + 52 + 300 }, // card
          { left: gutter, top: viewport.height - gutter - 260, right: gutter + 260, bottom: viewport.height - gutter - 56 }, // list
          { left: viewport.width / 2 - 460, top: viewport.height - gutter - 44, right: viewport.width / 2 + 460, bottom: viewport.height - gutter }, // strip
        ];
        const pts = Array.from({ length: 25 }, (_, i) => {
          // A point on the facing side: inside the body's circle on screen.
          const a = rnd() * 2 * Math.PI;
          const r = Math.sqrt(rnd()) * body.r * 0.95;
          return { id: `pin-${i}`, rank: i, x: body.x + r * Math.cos(a), y: body.y + r * Math.sin(a), facing: 0.6 + 0.4 * rnd() };
        });
        const nameSizes = new Map(pts.map((p) => [p.id, { width: 60 + Math.round(rnd() * 110), height: 20 }]));
        const selectedId = `pin-${Math.floor(rnd() * 25)}`;
        const placed = labelLayout(pinNameAnchors(pts, nameSizes, body.x, { selectedId, hoveredId: null }), viewport, reserved, { ...PIN_NAME_LAYOUT, body, selectedId });
        const shown = placed.filter((p) => p.mode !== 'hidden');
        expect(shown.length).toBeGreaterThan(5);
        for (const p of shown) {
          for (const r of reserved) expect(rectsOverlap(p.rect, r)).toBe(false);
          for (const q of shown) if (q !== p) expect(rectsOverlap(p.rect, q.rect)).toBe(false);
        }
        expect(placed.find((p) => p.id === selectedId)!.mode).toBe('full');
      }
    }
  });

  it('puts the selected and the hovered pin first', () => {
    const anchors = pinNameAnchors(points, sizes, 640, { selectedId: 'b', hoveredId: null });
    expect(anchors.find((a) => a.id === 'b')!.priority).toBeGreaterThan(anchors.find((a) => a.id === 'a')!.priority);
    const hovered = pinNameAnchors(points, sizes, 640, { selectedId: null, hoveredId: 'b' });
    expect(hovered.find((a) => a.id === 'b')!.priority).toBeGreaterThan(hovered.find((a) => a.id === 'a')!.priority);
  });
});
