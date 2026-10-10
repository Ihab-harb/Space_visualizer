import { describe, expect, it } from 'vitest';
import { analyseAutoLevels } from './analyseAutoLevels';

const rep = (l: string, n: number) => Array<string>(n).fill(l);

describe('analyseAutoLevels', () => {
  it('accepts a monotonic high to medium to low run that settles', () => {
    const r = analyseAutoLevels([...rep('high', 4), ...rep('medium', 9), ...rep('low', 27)]);
    expect(r).toEqual({ changes: 2, reversed: false, settled: true });
  });
  it('flags a step down followed later by a step up', () => {
    expect(analyseAutoLevels([...rep('high', 4), ...rep('medium', 12), ...rep('high', 24)]).reversed).toBe(true);
  });
  it('flags a step up followed by a step down', () => {
    expect(analyseAutoLevels([...rep('low', 4), ...rep('medium', 12), ...rep('low', 24)]).reversed).toBe(true);
  });
  it('fails to settle while the tail is still changing', () => {
    expect(analyseAutoLevels([...rep('high', 30), ...rep('medium', 6), ...rep('low', 4)]).settled).toBe(false);
  });
  it('does not settle on too few samples', () => {
    expect(analyseAutoLevels(rep('low', 5)).settled).toBe(false);
  });
});
