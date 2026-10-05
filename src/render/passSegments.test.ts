import { describe, expect, it } from 'vitest';
import { segmentByAttributes } from './passSegments';
import { activePasses } from './quality';

describe('segmentByAttributes', () => {
  it('splits the High stack where EffectPass would reorder', () => {
    expect(segmentByAttributes(activePasses('high', true, true).filter((p) => !['chromatic', 'vignette', 'grain'].includes(p)))).toEqual([
      ['bloom'],
      ['rays', 'flare'],
      ['streaks', 'dof', 'exposure', 'tonemap'],
    ]);
  });
  it('keeps the Low stack in one pass', () => {
    expect(segmentByAttributes(['bloom', 'exposure', 'tonemap'])).toEqual([['bloom', 'exposure', 'tonemap']]);
  });
});
