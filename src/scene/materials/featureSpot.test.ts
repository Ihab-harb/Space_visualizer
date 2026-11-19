import { describe, expect, it } from 'vitest';
import { surfaceDirection } from '../../core/frames/surfacePoint';
import { realDetails } from '../../test/realData';
import { BODY_VERTEX } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { spotFeature } from './useBodyUniforms';

const mars = realDetails('mars');
const on = { active: true, bodyId: 'mars', view: 'whole', selectedFeatureId: 'olympus-mons' };

describe('spotFeature', () => {
  it('gives the selected feature of the explored body on Surface, at its own position', () => {
    const f = mars.landmarks.find((l) => l.id === 'olympus-mons')!;
    expect(spotFeature('mars', on, mars)).toEqual({ id: 'olympus-mons', dir: surfaceDirection(f.latDeg, f.lonDegE) });
  });
  it('gives nothing for another body, the Interior tab, no selection, an unknown id, or details not ready', () => {
    expect(spotFeature('earth', on, mars)).toBeNull();
    expect(spotFeature('mars', { ...on, view: 'exploded' }, mars)).toBeNull();
    expect(spotFeature('mars', { ...on, selectedFeatureId: null }, mars)).toBeNull();
    expect(spotFeature('mars', { ...on, selectedFeatureId: 'nope' }, mars)).toBeNull();
    expect(spotFeature('mars', { ...on, active: false }, mars)).toBeNull();
    expect(spotFeature('mars', on, null)).toBeNull();
  });
});

describe('feature light in the body shader', () => {
  it('every body material has the uSpot uniform, off by default, and the featureLight helper', () => {
    const m = createBodyMaterial({ fragment: 'void main() { gl_FragColor = vec4(featureLight(vec3(1.0), vUnit, normalize(vUnit), 0.0), 1.0); }' });
    expect(m.uniforms.uSpot!.value.w).toBe(0);
    expect(m.fragmentShader).toContain('uniform vec4 uSpot;');
    expect(m.fragmentShader).toContain('vec3 featureLight(vec3 albedo, vec3 unit, vec3 nb, float geo)');
    expect(m.vertexShader).toBe(BODY_VERTEX);
    m.dispose();
  });
});
