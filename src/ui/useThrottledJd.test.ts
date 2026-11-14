// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimeStore } from '../state/timeStore';
import { useThrottledJd } from './useThrottledJd';

describe('useThrottledJd (M2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTimeStore.setState({ jdTdb: 2451545 });
  });
  afterEach(() => vi.useRealTimers());

  it('re-renders at most about 4 times a second while time plays', () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return useThrottledJd();
    });
    const before = renders;
    // 60 clock ticks over one second
    for (let i = 1; i <= 60; i++) {
      act(() => {
        vi.advanceTimersByTime(1000 / 60);
        useTimeStore.setState({ jdTdb: 2451545 + i * 1e-6 });
      });
    }
    expect(renders - before).toBeLessThanOrEqual(6);
    expect(renders - before).toBeGreaterThanOrEqual(3);
  });

  it('ends on the latest value and updates a quiet clock at once', () => {
    const { result } = renderHook(() => useThrottledJd());
    act(() => {
      vi.advanceTimersByTime(1000);
      useTimeStore.setState({ jdTdb: 2451600 });
    });
    expect(result.current).toBe(2451600);
    act(() => {
      useTimeStore.setState({ jdTdb: 2451601 });
      useTimeStore.setState({ jdTdb: 2451602 });
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(2451602);
  });
});
