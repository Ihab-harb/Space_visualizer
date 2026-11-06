import { describe, expect, it } from 'vitest';
import { labelLayout, rectsOverlap, type LabelAnchor, type PlacedLabel, type Rect } from './labelLayout';

const FULL = { width: 250, height: 38 };
const NAME = { width: 110, height: 20 };

function anchor(id: string, x: number, y: number, side: 'left' | 'right', priority: number, full = FULL, collapsed = NAME): LabelAnchor {
  return { id, x, y, side, priority, full, collapsed };
}

function shown(placed: PlacedLabel[]) {
  return placed.filter((p) => p.mode !== 'hidden');
}

/** Every shown label inside the viewport, clear of every reserved rect and of every other label. */
function expectClear(placed: PlacedLabel[], viewport: { width: number; height: number }, reserved: Rect[]) {
  const s = shown(placed);
  for (const p of s) {
    expect(p.rect.left, `${p.id} left`).toBeGreaterThanOrEqual(0);
    expect(p.rect.top, `${p.id} top`).toBeGreaterThanOrEqual(0);
    expect(p.rect.right, `${p.id} right`).toBeLessThanOrEqual(viewport.width);
    expect(p.rect.bottom, `${p.id} bottom`).toBeLessThanOrEqual(viewport.height);
    for (const r of reserved) expect(rectsOverlap(p.rect, r), `${p.id} overlaps a reserved rect`).toBe(false);
  }
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) expect(rectsOverlap(s[i]!.rect, s[j]!.rect), `${s[i]!.id} overlaps ${s[j]!.id}`).toBe(false);
}

describe('labelLayout', () => {
  // Earth in Exploded at 1280x720: four anchors stacked near the centre line, alternating sides (as InteriorLabels sends them).
  const desktop = { width: 1280, height: 720 };
  const desktopReserved: Rect[] = [
    { left: 16, top: 16, right: 260, bottom: 92 }, // title
    { left: 480, top: 16, right: 800, bottom: 56 }, // view switch
    { left: 1224, top: 16, right: 1264, bottom: 56 }, // leave
    { left: 16, top: 648, right: 1264, bottom: 704 }, // composition strip
  ];
  const body = { x: 640, y: 360, r: 220 };
  const four = [
    anchor('crust', 760, 170, 'right', 4),
    anchor('mantle', 530, 250, 'left', 3),
    anchor('outer-core', 720, 330, 'right', 2),
    anchor('inner-core', 600, 420, 'left', 1),
  ];

  it('places four labels at 1280x720 clear of each other, the top bar and the strip, all in full', () => {
    const placed = labelLayout(four, desktop, desktopReserved, { body });
    expect(placed.map((p) => p.mode)).toEqual(['full', 'full', 'full', 'full']);
    expectClear(placed, desktop, desktopReserved);
  });

  it('keeps each label on its side of the body, outside the body', () => {
    const placed = labelLayout(four, desktop, desktopReserved, { body });
    for (const p of placed) {
      if (p.side === 'right') expect(p.rect.left).toBeGreaterThanOrEqual(body.x + body.r);
      else expect(p.rect.right).toBeLessThanOrEqual(body.x - body.r);
    }
    // The leader starts at the anchor and ends on the label's edge that faces the body.
    const crust = placed.find((p) => p.id === 'crust')!;
    expect(crust.leader).toEqual({ x1: 760, y1: 170, x2: crust.rect.left, y2: (crust.rect.top + crust.rect.bottom) / 2 });
  });

  it('places four labels at 390x844 clear of each other, the top bar and the strip', () => {
    const phone = { width: 390, height: 844 };
    const reserved: Rect[] = [
      { left: 0, top: 0, right: 390, bottom: 104 }, // title, leave and switch
      { left: 0, top: 724, right: 390, bottom: 844 }, // strip and layer list
    ];
    const phoneBody = { x: 195, y: 400, r: 150 };
    const anchors = [
      anchor('crust', 240, 260, 'right', 4, { width: 220, height: 38 }),
      anchor('mantle', 150, 320, 'left', 3, { width: 200, height: 38 }),
      anchor('outer-core', 230, 390, 'right', 2, { width: 240, height: 38 }),
      anchor('inner-core', 180, 450, 'left', 1, { width: 180, height: 38 }),
    ];
    const placed = labelLayout(anchors, phone, reserved, { body: phoneBody });
    expect(shown(placed)).toHaveLength(4);
    expectClear(placed, phone, reserved);
  });

  it('re-lays out with no overlaps after a resize (Review Focus 4)', () => {
    const a = labelLayout(four, desktop, desktopReserved, { body });
    const narrow = { width: 800, height: 1000 };
    const reserved: Rect[] = [
      { left: 16, top: 16, right: 784, bottom: 104 },
      { left: 16, top: 928, right: 784, bottom: 984 },
    ];
    const b = labelLayout(four.map((x) => ({ ...x, x: x.x - 240, y: x.y + 140 })), narrow, reserved, { body: { x: 400, y: 500, r: 200 } });
    expectClear(a, desktop, desktopReserved);
    expectClear(b, narrow, reserved);
  });

  it('never overlaps for many random anchor sets (property check)', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const vp of [desktop, { width: 390, height: 844 }, { width: 1024, height: 768 }]) {
      const reserved: Rect[] = [
        { left: 0, top: 0, right: vp.width, bottom: 70 },
        { left: 0, top: vp.height - 70, right: vp.width, bottom: vp.height },
      ];
      for (let trial = 0; trial < 200; trial++) {
        const n = 2 + Math.floor(rnd() * 4);
        const anchors = Array.from({ length: n }, (_, i) =>
          anchor(`l${i}`, rnd() * vp.width, rnd() * vp.height, rnd() < 0.5 ? 'left' : 'right', n - i, { width: 120 + rnd() * 200, height: 38 }, { width: 50 + rnd() * 60, height: 20 }),
        );
        const placed = labelLayout(anchors, vp, reserved, { body: { x: vp.width / 2, y: vp.height / 2, r: rnd() * vp.width * 0.4 } });
        expectClear(placed, vp, reserved);
      }
    }
  });

  describe('collapse rule', () => {
    // A thin strip of room: one full label (two lines) and one name (one line) fit on the right; the left is reserved.
    const vp = { width: 900, height: 110 };
    const reserved: Rect[] = [{ left: 0, top: 0, right: 450, bottom: 110 }];
    const outer = anchor('mantle', 500, 50, 'right', 2);
    const inner = anchor('core', 500, 50, 'right', 1);

    it('collapses the lower-priority label to its name on conflict', () => {
      const placed = labelLayout([outer, inner], vp, reserved);
      expect(placed.find((p) => p.id === 'mantle')!.mode).toBe('full');
      expect(placed.find((p) => p.id === 'core')!.mode).toBe('collapsed');
      expectClear(placed, vp, reserved);
    });

    it('keeps the selected label full, even when it has the lower priority', () => {
      const placed = labelLayout([outer, inner], vp, reserved, { selectedId: 'core' });
      expect(placed.find((p) => p.id === 'core')!.mode).toBe('full');
      expect(placed.find((p) => p.id === 'mantle')!.mode).toBe('collapsed');
      expectClear(placed, vp, reserved);
    });

    it('hides a label (never overlaps) when even its name has no room', () => {
      const third = anchor('inner', 500, 50, 'right', 0);
      const placed = labelLayout([outer, inner, third], vp, reserved);
      expect(placed.find((p) => p.id === 'inner')!.mode).toBe('hidden');
      expectClear(placed, vp, reserved);
    });
  });

  it('returns labels in the input order and handles no anchors or a zero-size viewport', () => {
    expect(labelLayout([], desktop, [])).toEqual([]);
    const placed = labelLayout(four, desktop, desktopReserved, { body });
    expect(placed.map((p) => p.id)).toEqual(four.map((a) => a.id));
    expect(labelLayout(four, { width: 0, height: 0 }, []).every((p) => p.mode === 'hidden')).toBe(true);
  });

  it('ignores anchors that are not finite (behind the camera)', () => {
    const placed = labelLayout([anchor('x', Number.NaN, 10, 'right', 1)], desktop, []);
    expect(placed[0]!.mode).toBe('hidden');
  });
});
