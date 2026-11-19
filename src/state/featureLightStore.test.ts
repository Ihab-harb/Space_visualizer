import { describe, expect, it } from 'vitest';
import { featureLightShown } from './featureLightStore';

describe('featureLightShown', () => {
  const sun = [1, 0, 0] as const;
  it('is true for a feature on the night side or near the terminator while the light has strength', () => {
    expect(featureLightShown(1, [-1, 0, 0], sun)).toBe(true);
    expect(featureLightShown(0.2, [0, 1, 0], sun)).toBe(true);
  });
  it('is false in full daylight, and when the light is off', () => {
    expect(featureLightShown(1, [1, 0, 0], sun)).toBe(false);
    expect(featureLightShown(1, [0.3, Math.sqrt(1 - 0.09), 0], sun)).toBe(false);
    expect(featureLightShown(0, [-1, 0, 0], sun)).toBe(false);
  });
});
