import { describe, expect, it } from 'vitest';
import { useViewStore } from './viewStore';

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
});
