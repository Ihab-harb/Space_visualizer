import { AdditiveBlending, ShaderMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../core/math/vec3';
import { makeEarth, makeJupiter, makeSun } from '../../test/fixtures';
import { FRAG_OUTRO } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { pickOccluders } from './useBodyUniforms';

describe('createBodyMaterial', () => {
  it('builds a ShaderMaterial with log-depth chunks and shared uniforms', () => {
    const m = createBodyMaterial({ fragment: `void main(){ gl_FragColor = vec4(1.0); ${FRAG_OUTRO} }`, blending: AdditiveBlending });
    expect(m).toBeInstanceOf(ShaderMaterial);
    expect(m.vertexShader).toContain('#include <logdepthbuf_vertex>');
    expect(m.fragmentShader).toContain('#include <logdepthbuf_fragment>');
    expect(m.fragmentShader).toContain('#include <tonemapping_fragment>');
    expect(m.uniforms.uSunDirObj).toBeDefined();
    expect(m.uniforms.uOccluders!.value).toHaveLength(4);
    expect(m.blending).toBe(AdditiveBlending);
  });
});

describe('pickOccluders', () => {
  it('returns nearest other bodies, never itself or the Sun', () => {
    const bodies = [makeSun(), makeEarth(), makeJupiter()];
    const positions = new Map<string, Vec3>([['sun', [0, 0, 0]], ['earth', [1.5e8, 0, 0]], ['jupiter', [7.8e8, 0, 0]]]);
    expect(pickOccluders('earth', bodies, positions).map((o) => o.id)).toEqual(['jupiter']);
  });
});

describe('pickOccluders ordering and limits', () => {
  const mk = (id: string, category: 'star' | 'planet' = 'planet') => ({ ...makeEarth(), id, category });
  const bodies = [mk('sun', 'star'), mk('self'), mk('far'), mk('near'), mk('mid'), mk('mid2'), mk('mid3'), mk('nopos')];
  const positions = new Map<string, Vec3>([
    ['sun', [1, 0, 0]],
    ['self', [0, 0, 0]],
    ['far', [900, 0, 0]],
    ['near', [10, 0, 0]],
    ['mid', [30, 0, 0]],
    ['mid2', [0, 50, 0]],
    ['mid3', [0, 0, 70]],
  ]);

  it('orders by distance, caps at 4 by default, excludes self, Sun and bodies without a position', () => {
    expect(pickOccluders('self', bodies, positions).map((o) => o.id)).toEqual(['near', 'mid', 'mid2', 'mid3']);
  });

  it('honours an explicit smaller max', () => {
    expect(pickOccluders('self', bodies, positions, 2).map((o) => o.id)).toEqual(['near', 'mid']);
  });

  it('returns [] when the body itself has no position', () => {
    expect(pickOccluders('nopos', bodies, positions)).toEqual([]);
  });
});
