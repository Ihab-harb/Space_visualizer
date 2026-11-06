import { describe, expect, it } from 'vitest';
import { drawnLayers, explodeOffsets } from '../../core/interior/geometry';
import { dot, length, scale, sub, type Vec3 } from '../../core/math/vec3';
import { realDetails } from '../../test/realData';
import type { ExploreFrame } from './exploreFrame';
import { layerAnchors } from './labelAnchors';

const drawn = drawnLayers(realDetails('earth').interior!.layers, 6371);
const up: Vec3 = [0, 0, 1];
const right: Vec3 = [1, 0, 0];

function frame(view: ExploreFrame['view'], progress = 1): ExploreFrame {
  const exploded = view === 'exploded';
  const normal: Vec3 = exploded ? [0, 0, -1] : [0, -1, 0]; // section: the cut faces the camera on -y
  return {
    bodyId: 'earth',
    view,
    progress,
    focus: 1,
    drawn,
    offsets: exploded ? explodeOffsets(drawn, progress) : drawn.map(() => 0),
    upWorld: up,
    upObj: up,
    planeNormalWorld: normal,
    planeNormalObj: normal,
    planeOffset: 0,
    cutsInnermost: view === 'section',
    shiftRadii: 0,
    halfHeightRadii: 1,
    selectedLayerId: null,
  };
}

describe('layerAnchors', () => {
  it('has no anchors in Whole', () => {
    expect(layerAnchors(frame('whole'), right)).toEqual([]);
  });

  it('Exploded: one anchor per layer on its shell, sides alternating from the right', () => {
    const ex = frame('exploded');
    const anchors = layerAnchors(ex, right);
    expect(anchors.map((a) => a.id)).toEqual(drawn.map((d) => d.id));
    expect(anchors.map((a) => a.side)).toEqual(['right', 'left', 'right', 'left']);
    anchors.forEach((a, i) => {
      const centre = scale(up, ex.offsets[i]!);
      expect(length(sub(a.offset, centre))).toBeCloseTo(drawn[i]!.outer, 6);
      expect(Math.sign(dot(a.offset, right))).toBe(a.side === 'right' ? 1 : -1);
      // On the visible band: below the base of the cap above it.
      if (i > 0) expect(dot(a.offset, up)).toBeLessThanOrEqual(ex.offsets[i - 1]! + 1e-9);
    });
  });

  it('Half-section: anchors lie on the cut face inside their own ring', () => {
    const ex = frame('section');
    const anchors = layerAnchors(ex, right);
    anchors.forEach((a, i) => {
      expect(dot(a.offset, ex.planeNormalWorld)).toBeCloseTo(ex.planeOffset, 9);
      const r = length(a.offset);
      expect(r).toBeLessThanOrEqual(drawn[i]!.outer);
      expect(r).toBeGreaterThanOrEqual(i === drawn.length - 1 ? 0 : drawn[i]!.inner);
      expect(Math.sign(dot(a.offset, right))).toBe(a.side === 'right' ? 1 : -1);
    });
  });

  it('keeps working when the camera right vector is along the explode axis (degenerate)', () => {
    const anchors = layerAnchors(frame('exploded'), up);
    for (const a of anchors) for (const c of a.offset) expect(Number.isFinite(c)).toBe(true);
  });
});
