import { describe, expect, it } from 'vitest';
import { labelPriority, resolveOverlaps, type LabelBox } from './labelLayout';

const box = (id: string, left: number, top: number, priority: number): LabelBox => ({ id, left, top, width: 80, height: 22, priority });

describe('label decluttering', () => {
  it('keeps the highest-priority label in an overlapping cluster', () => {
    const shown = resolveOverlaps([box('mercury', 100, 100, 1), box('venus', 120, 104, 2), box('earth', 130, 108, 5)]);
    expect([...shown]).toEqual(['earth']);
  });
  it('keeps labels that do not overlap', () => {
    expect(resolveOverlaps([box('a', 0, 0, 1), box('b', 200, 0, 1), box('c', 0, 200, 1)]).size).toBe(3);
  });
  it('is deterministic for equal priorities', () => {
    expect([...resolveOverlaps([box('venus', 0, 0, 1), box('mars', 10, 0, 1)])]).toEqual(['mars']);
  });
  it('ranks selected over hovered over size', () => {
    const sel = labelPriority({ selected: true, hovered: false, pixelRadius: 1 });
    const hov = labelPriority({ selected: false, hovered: true, pixelRadius: 500 });
    const big = labelPriority({ selected: false, hovered: false, pixelRadius: 400 });
    const small = labelPriority({ selected: false, hovered: false, pixelRadius: 3 });
    expect(sel).toBeGreaterThan(hov);
    expect(hov).toBeGreaterThan(big);
    expect(big).toBeGreaterThan(small);
  });
  it('ignores labels marked hidden, so they neither show nor block others', () => {
    const hiddenTop: LabelBox = { id: 'moon', left: 0, top: 0, width: 50, height: 20, priority: 99, hidden: true };
    const other: LabelBox = { id: 'earth', left: 10, top: 5, width: 50, height: 20, priority: 1 };
    const shown = resolveOverlaps([hiddenTop, other]);
    expect(shown.has('moon')).toBe(false);
    expect(shown.has('earth')).toBe(true);
  });
});
