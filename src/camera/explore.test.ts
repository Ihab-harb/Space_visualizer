import { describe, expect, it } from 'vitest';
import { cross, dot, length, normalize, sub } from '../core/math/vec3';
import { lookRotation } from './rig';
import { offsetDirection, orbitPose } from './orbitController';
import { orbitUp } from './explore';

describe('orbitUp', () => {
  it('is the screen-up of the orbit view: unit, across the view direction, and equal to the camera up column', () => {
    for (const [az, el] of [[0, 0], [1, 0.4], [-2, -0.7], [3, 1.2]] as const) {
      const up = orbitUp(az, el);
      expect(length(up)).toBeCloseTo(1);
      expect(dot(up, offsetDirection(az, el))).toBeCloseTo(0);
      const pose = orbitPose({ targetId: 'x', distanceKm: 10, azimuthRad: az, elevationRad: el, panOffsetKm: [0, 0, 0] }, [0, 0, 0]);
      const m = lookRotation(pose.positionKm, pose.lookAtKm, pose.up);
      const cameraUp = [m[1], m[4], m[7]] as const;
      expect(dot(up, cameraUp)).toBeCloseTo(1);
      expect(length(cross(normalize(sub(pose.lookAtKm, pose.positionKm)), up))).toBeCloseTo(1);
    }
  });
});
