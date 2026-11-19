// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useExploreStore } from './exploreStore';
import { useViewStore, useRadarShown } from './viewStore';

describe('viewStore', () => {
  it('switches views, toggles co-rotation and scale mode', () => {
    const s = useViewStore.getState();
    s.setView('follow');
    s.toggleCoRotate();
    s.setScaleMode('true');
    expect(useViewStore.getState()).toMatchObject({ view: 'follow', coRotate: true, scaleMode: 'true' });
  });
  it('numbers focus requests so repeated requests for one body are distinct', () => {
    useViewStore.getState().requestFocus('mars');
    const first = useViewStore.getState().focusRequest!;
    useViewStore.getState().requestFocus('mars');
    expect(useViewStore.getState().focusRequest).toEqual({ bodyId: 'mars', seq: first.seq + 1 });
  });
  describe('useRadarShown', () => {
    afterEach(() => {
      act(() => useExploreStore.getState().leave());
      useViewStore.setState({ venusRadar: false });
    });
    it('is true on Venus Surface in Explore, false on Interior, and follows venusRadar outside Explore', () => {
      const { result } = renderHook(() => useRadarShown());
      expect(result.current).toBe(false);
      act(() => useViewStore.getState().setVenusRadar(true));
      expect(result.current).toBe(true);
      act(() => useViewStore.getState().setVenusRadar(false));
      expect(result.current).toBe(false);
      act(() => useExploreStore.getState().enter('venus'));
      expect(result.current).toBe(true); // Surface
      act(() => useExploreStore.getState().setTab('interior'));
      expect(result.current).toBe(false);
      act(() => useExploreStore.getState().setTab('surface'));
      expect(result.current).toBe(true);
      act(() => useExploreStore.getState().leave());
      expect(result.current).toBe(false); // the user's setting comes back by itself
      expect(useViewStore.getState().venusRadar).toBe(false);
      act(() => useExploreStore.getState().enter('mars'));
      expect(result.current).toBe(false);
    });
  });
});
