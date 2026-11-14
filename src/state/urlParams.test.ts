import { beforeEach, describe, expect, it } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { makeCatalogFiles } from '../test/fixtures';
import { useRenderStore } from './renderStore';
import { useSelectionStore } from './selectionStore';
import { useTimeStore } from './timeStore';
import { applyUrlOverrides, parseUrlOverrides } from './urlParams';
import { useViewStore } from './viewStore';

const f = makeCatalogFiles();
const catalog = createCatalog(f.regions, f.sources, [f.bodies]);

describe('parseUrlOverrides', () => {
  it('reads golden-view parameters', () => {
    expect(parseUrlOverrides('?jd=2451545&pause=1&target=jupiter&dist=300000&azSun=90&el=20&tier=4k')).toEqual({
      jdTdb: 2451545, paused: true, target: 'jupiter', distanceKm: 300000, azFromSunDeg: 90, elDeg: 20, tier: '4k',
    });
  });
  it('converts a UTC date to TDB and ignores invalid values', () => {
    const o = parseUrlOverrides('?date=2000-01-01%2012:00&tier=16k&dist=-5&jd=abc&rate=99');
    expect(o.jdTdb).toBeCloseTo(2451545 + 64.184 / 86400, 9);
    expect(o).not.toHaveProperty('tier');
    expect(o).not.toHaveProperty('distanceKm');
    expect(o).not.toHaveProperty('rateIndex');
  });
});

describe('quality and effects parameters', () => {  it('reads quality and camera-effects parameters', () => {    expect(parseUrlOverrides('?quality=low&fx=0')).toEqual({ quality: 'low', effects: false });    expect(parseUrlOverrides('?quality=ultra&fx=2')).toEqual({});  });});
describe('radar parameter', () => {
  it('reads radar=1 and applies it to the view store', () => {
    expect(parseUrlOverrides('?radar=1')).toEqual({ venusRadar: true });
    expect(parseUrlOverrides('?radar=0')).toEqual({});
    useViewStore.setState({ venusRadar: false });
    applyUrlOverrides({ venusRadar: true }, catalog);
    expect(useViewStore.getState().venusRadar).toBe(true);
    useViewStore.setState({ venusRadar: false });
  });
});
describe('applyUrlOverrides', () => {
  beforeEach(() => useViewStore.setState({ cameraOverride: null, textureTierOverride: null }));
  it('sets time, selection, texture tier and a camera override', () => {
    applyUrlOverrides({ jdTdb: 2451545, paused: true, target: 'jupiter', distanceKm: 1e6, elDeg: 10, tier: '1k' }, catalog);
    expect(useTimeStore.getState()).toMatchObject({ jdTdb: 2451545, playing: false });
    expect(useSelectionStore.getState().selectedId).toBe('jupiter');
    expect(useViewStore.getState().textureTierOverride).toBe('1k');
    expect(useViewStore.getState().cameraOverride).toMatchObject({ targetId: 'jupiter', distanceKm: 1e6, elDeg: 10 });
  });
it('applies quality and effects', () => {    applyUrlOverrides({ quality: 'medium', effects: false }, catalog);    expect(useRenderStore.getState()).toMatchObject({ mode: 'medium', level: 'medium', effects: false });  });
  it('ignores unknown targets', () => {
    applyUrlOverrides({ target: 'vulcan' }, catalog);
    expect(useViewStore.getState().cameraOverride).toBeNull();
  });
});
