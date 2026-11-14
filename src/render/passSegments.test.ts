import { describe, expect, it } from 'vitest';
import { composerGroups, segmentByAttributes } from './passSegments';
import { activePasses } from './quality';

describe('segmentByAttributes', () => {
  it('splits the High stack where EffectPass would reorder, and before depth of field', () => {
    expect(segmentByAttributes(activePasses('high', true).filter((p) => !['chromatic', 'vignette', 'grain'].includes(p)))).toEqual([
      ['bloom'],
      ['rays', 'flare'],
      ['streaks'],
      ['dof', 'exposure', 'tonemap'],
    ]);
  });
  it('keeps the Low stack in one pass', () => {
    expect(segmentByAttributes(['bloom', 'exposure', 'tonemap'])).toEqual([['bloom', 'exposure', 'tonemap']]);
  });
});

describe('composerGroups', () => {
  it('gives the display effects their own pass after tone mapping when chromatic aberration is present', () => {
    expect(composerGroups(activePasses('high', true))).toEqual([
      ['bloom'],
      ['rays', 'flare'],
      ['streaks'],
      ['dof', 'exposure', 'tonemap'],
      ['chromatic', 'vignette', 'grain'],
    ]);
    expect(composerGroups(activePasses('medium', true)).at(-1)).toEqual(['chromatic', 'vignette', 'grain']);
  });
  it('merges vignette into the HDR pass at Low, so Low is a single pass', () => {
    expect(composerGroups(activePasses('low', true))).toEqual([['bloom', 'exposure', 'tonemap', 'vignette']]);
  });
  it('keeps camera effects off in one pass', () => {
    expect(composerGroups(activePasses('high', false))).toEqual([['bloom', 'tonemap']]);
  });
  it('keeps every pass in the spec order', () => {
    for (const level of ['high', 'medium', 'low'] as const)
      for (const fx of [true, false]) expect(composerGroups(activePasses(level, fx)).flat()).toEqual(activePasses(level, fx));
  });
});
