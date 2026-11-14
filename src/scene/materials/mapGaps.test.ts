import { describe, expect, it } from 'vitest';
import { fillsMapBand, MAP_COVERAGE, mapCoverage } from './mapGaps';

describe('colour-map gaps in Explore', () => {
  const open = (bodyId: string) => ({ bodyId, progress: 0.5 });
  it("fills Saturn's black equatorial band only while its own rings are hidden (the body is open in Explore)", () => {
    expect(fillsMapBand('saturn', true, null)).toBe(false);
    expect(fillsMapBand('saturn', true, { bodyId: 'saturn', progress: 0 })).toBe(false);
    expect(fillsMapBand('saturn', true, open('saturn'))).toBe(true);
    expect(fillsMapBand('saturn', true, open('earth'))).toBe(false);
    // Jupiter's dark belts are real: no band fill on a body without rings.
    expect(fillsMapBand('jupiter', false, open('jupiter'))).toBe(false);
  });
  it('keeps the map to the latitudes Hubble saw (Uranus south, Neptune north) only while the body is open in Explore', () => {
    expect(MAP_COVERAGE.uranus![0]).toBeGreaterThan(0.4);
    expect(MAP_COVERAGE.neptune![1]).toBeLessThan(0.75);
    expect(mapCoverage('uranus', open('uranus'))).toEqual(MAP_COVERAGE.uranus);
    expect(mapCoverage('neptune', open('neptune'))).toEqual(MAP_COVERAGE.neptune);
    expect(mapCoverage('neptune', null)).toEqual([0, 1]);
    expect(mapCoverage('neptune', { bodyId: 'neptune', progress: 0 })).toEqual([0, 1]);
    expect(mapCoverage('jupiter', open('jupiter'))).toEqual([0, 1]);
  });
});
