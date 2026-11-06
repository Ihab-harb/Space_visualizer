import { describe, expect, it } from 'vitest';
import { exploreGlareKeep, sunExploreWeight } from './sunFx';

describe('Sun effects in Explore', () => {
  it('keeps the flare and god rays outside Explore', () => {
    expect(exploreGlareKeep(null)).toBe(1);
  });
  it('fades them with the focus whichever body is explored, the Sun or another', () => {
    expect(exploreGlareKeep({ bodyId: 'sun', focus: 1 })).toBe(0);
    expect(exploreGlareKeep({ bodyId: 'earth', focus: 1 })).toBe(0);
    expect(exploreGlareKeep({ bodyId: 'earth', focus: 0.25 })).toBeCloseTo(0.75);
    expect(exploreGlareKeep({ bodyId: 'earth', focus: 0 })).toBe(1);
  });
  it('the exposure floor and reduced bloom stay the Sun’s own', () => {
    expect(sunExploreWeight({ bodyId: 'earth', focus: 1 }, 'sun')).toBe(0);
    expect(sunExploreWeight({ bodyId: 'sun', focus: 0.5 }, 'sun')).toBe(0.5);
  });
});
