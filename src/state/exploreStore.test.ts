import { beforeEach, describe, expect, it } from 'vitest';
import { useExploreStore } from './exploreStore';
import { useSelectionStore } from './selectionStore';
import { useTimeStore } from './timeStore';
import { useTourStore } from './tourStore';

describe('exploreStore', () => {
  beforeEach(() => {
    useExploreStore.getState().leave();
    useExploreStore.setState({ sectionSeq: 0 });
    useTimeStore.setState({ playing: true, rateIndex: 3 });
    useTourStore.setState({ active: false, seq: 0 });
    useSelectionStore.setState({ selectedId: 'earth' });
  });

  it('enter pauses time and remembers play state and rate; leave restores both', () => {
    useExploreStore.getState().enter('earth');
    expect(useExploreStore.getState()).toMatchObject({ active: true, bodyId: 'earth', view: 'whole', progress: 0 });
    expect(useTimeStore.getState().playing).toBe(false);
    useTimeStore.setState({ rateIndex: 0 });
    useExploreStore.getState().leave();
    expect(useTimeStore.getState()).toMatchObject({ playing: true, rateIndex: 3 });
    expect(useExploreStore.getState()).toMatchObject({ active: false, bodyId: null, saved: null });
  });

  it('leave keeps time paused if it was paused before', () => {
    useTimeStore.setState({ playing: false });
    useExploreStore.getState().enter('earth');
    useExploreStore.getState().leave();
    expect(useTimeStore.getState().playing).toBe(false);
  });

  it('enter stops an active tour', () => {
    useTourStore.getState().start();
    useExploreStore.getState().enter('earth');
    expect(useTourStore.getState().active).toBe(false);
  });

  it('choosing Half-section again bumps sectionSeq', () => {
    const s = useExploreStore.getState();
    s.enter('earth');
    s.setView('section');
    s.setView('section');
    s.setView('exploded');
    expect(useExploreStore.getState()).toMatchObject({ view: 'exploded', sectionSeq: 2 });
  });

  it('leave resets progress, closes the chart and clears the layer', () => {
    const s = useExploreStore.getState();
    s.enter('earth');
    s.setProgress(0.5);
    s.toggleChart(true);
    s.selectLayer('core');
    s.leave();
    expect(useExploreStore.getState()).toMatchObject({ progress: 0, chartOpen: false, selectedLayerId: null, active: false });
  });

  it('selecting another body or none while active leaves', () => {
    useExploreStore.getState().enter('earth');
    useSelectionStore.getState().select('earth');
    expect(useExploreStore.getState().active).toBe(true);
    useSelectionStore.getState().select('jupiter');
    expect(useExploreStore.getState().active).toBe(false);
    expect(useTimeStore.getState().playing).toBe(true);
    useExploreStore.getState().enter('jupiter');
    useSelectionStore.getState().select(null);
    expect(useExploreStore.getState().active).toBe(false);
  });
});
