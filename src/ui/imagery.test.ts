import { describe, expect, it } from 'vitest';
import type { Body } from '../core/catalog/schema';
import { makeEarth, makeJupiter, makeSun } from '../test/fixtures';
import { illustrativeNotes, imageryLines } from './imagery';

const earth: Body = {
  ...makeEarth(),
  imagery: {
    color: { tiers: { '2k': 'textures/earth/color_2k.webp' }, sourceId: 'nasa-blue-marble' },
    normal: { tiers: { '2k': 'textures/earth/normal_2k.webp' }, sourceId: 'gebco-topography', derivation: 'Normal map from GEBCO elevation; relief exaggerated.', illustrative: true },
    night: { tiers: { '2k': 'textures/earth/night_2k.webp' }, sourceId: 'nasa-black-marble' },
  },
};

describe('imagery lines', () => {
  it('lists each layer with its source, in display order', () => {
    expect(imageryLines(earth)).toEqual([
      { label: 'Surface', sourceId: 'nasa-blue-marble', illustrative: false },
      { label: 'Relief', sourceId: 'gebco-topography', derivation: 'Normal map from GEBCO elevation; relief exaggerated.', illustrative: true },
      { label: 'Night lights', sourceId: 'nasa-black-marble', illustrative: false },
    ]);
  });
  it('includes rings and flags illustrative layers', () => {
    const saturn: Body = {
      ...makeJupiter(),
      imagery: {
        rings: {
          texture: { tiers: { '2k': 'r' }, sourceId: 'nssdca-saturn-rings', derivation: 'Radial profile', illustrative: true },
          innerKm: { value: 74658, sourceId: 'nssdca-saturn-rings' },
          outerKm: { value: 139826, sourceId: 'nssdca-saturn-rings' },
        },
      },
    };
    expect(imageryLines(saturn)).toEqual([{ label: 'Rings', sourceId: 'nssdca-saturn-rings', derivation: 'Radial profile', illustrative: true }]);
  });
  it('explains procedural visuals', () => {
    expect(illustrativeNotes(makeSun()).join(' ')).toMatch(/illustrative/i);
    expect(illustrativeNotes(makeJupiter())).toContain('Cloud-band motion is illustrative.');
    expect(illustrativeNotes({ ...makeEarth(), imagery: null }).join(' ')).toMatch(/no official surface map/i);
    const withClouds: Body = { ...earth, imagery: { ...earth.imagery, clouds: { tiers: { '2k': 'c' }, sourceId: 'nasa-blue-marble-clouds' } } };
    expect(illustrativeNotes(withClouds)).toContain('Cloud drift is illustrative.');
  });
});
