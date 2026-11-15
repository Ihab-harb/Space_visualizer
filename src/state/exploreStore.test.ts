import { beforeEach, describe, expect, it } from 'vitest';
import { clearFeatureOnEmptyClick, clearLayerOnEmptyClick, tabOf, useExploreStore } from './exploreStore';
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

  it('entering again while active keeps the first saved time state', () => {
    useExploreStore.getState().enter('earth');
    useExploreStore.getState().enter('earth');
    useExploreStore.getState().leave();
    expect(useTimeStore.getState()).toMatchObject({ playing: true, rateIndex: 3 });
  });

  it('leave while idle does not change time', () => {
    useTimeStore.setState({ playing: false, rateIndex: 5 });
    useExploreStore.getState().leave();
    expect(useTimeStore.getState()).toMatchObject({ playing: false, rateIndex: 5 });
  });

  it('a click on empty space in the scene clears the selected layer, and only in Explore', () => {
    useExploreStore.getState().enter('earth');
    useExploreStore.getState().selectLayer('mantle');
    clearLayerOnEmptyClick();
    expect(useExploreStore.getState().selectedLayerId).toBeNull();
    useExploreStore.getState().leave();
    const before = useSelectionStore.getState().selectedId;
    clearLayerOnEmptyClick();
    expect(useSelectionStore.getState().selectedId).toBe(before); // never touches the body selection
  });

  it('a click on empty space or on the body clears the selected feature, and only in Explore', () => {
    useExploreStore.getState().enter('mars');
    useExploreStore.getState().selectFeature('olympus-mons');
    clearFeatureOnEmptyClick();
    expect(useExploreStore.getState().selectedFeatureId).toBeNull();
    useExploreStore.getState().leave();
    const before = useExploreStore.getState();
    clearFeatureOnEmptyClick();
    expect(useExploreStore.getState()).toBe(before);
  });
});

describe('Surface and Interior tabs, features and the list', () => {
  const s = () => useExploreStore.getState();
  beforeEach(() => {
    useExploreStore.getState().leave();
    useExploreStore.setState({ sectionSeq: 0, featureSeq: 0 });
    useTimeStore.setState({ playing: true, rateIndex: 3 });
    useSelectionStore.setState({ selectedId: 'mars' });
  });

  it('opens on Surface', () => {
    s().enter('mars');
    expect(tabOf(s().view)).toBe('surface');
  });

  it('Interior opens Exploded first, then the view used last', () => {
    s().enter('mars');
    s().setTab('interior');
    expect(s().view).toBe('exploded');
    s().setView('section');
    s().setTab('surface');
    expect(s().view).toBe('whole');
    s().setTab('interior');
    expect(s().view).toBe('section');
  });

  it('entering again forgets the last interior view', () => {
    s().enter('mars');
    s().setView('section');
    s().enter('mars');
    s().setTab('interior');
    expect(s().view).toBe('exploded');
  });

  it('selecting a feature goes to Surface, closes the layer card and bumps featureSeq', () => {
    s().enter('mars');
    s().setView('exploded');
    s().selectLayer('core');
    s().selectFeature('olympus-mons');
    expect(s()).toMatchObject({ view: 'whole', selectedLayerId: null, selectedFeatureId: 'olympus-mons', featureSeq: 1 });
    s().selectFeature('olympus-mons');
    expect(s().featureSeq).toBe(2);
    s().selectFeature(null);
    expect(s()).toMatchObject({ selectedFeatureId: null, featureSeq: 2 });
  });

  it('an interior view clears the feature and closes the list; Surface keeps them', () => {
    s().enter('mars');
    s().selectFeature('olympus-mons');
    s().toggleFeatureList(true);
    s().setView('whole');
    expect(s()).toMatchObject({ selectedFeatureId: 'olympus-mons', featureListOpen: true });
    s().setView('exploded');
    expect(s()).toMatchObject({ selectedFeatureId: null, featureListOpen: false });
  });

  it('opening the list from an interior view switches to Surface', () => {
    s().enter('mars');
    s().setView('section');
    s().toggleFeatureList(true);
    expect(s()).toMatchObject({ view: 'whole', featureListOpen: true });
    s().toggleFeatureList();
    expect(s().featureListOpen).toBe(false);
  });

  it('the chart opens on both tabs', () => {
    s().enter('mars');
    s().toggleChart(true);
    s().setView('exploded');
    expect(s().chartOpen).toBe(true);
  });

  it('leave clears the feature, the list and the tab memory', () => {
    s().enter('mars');
    s().setView('section');
    s().selectFeature('olympus-mons');
    s().toggleFeatureList(true);
    s().leave();
    expect(s()).toMatchObject({ selectedFeatureId: null, featureListOpen: false, lastInteriorView: 'exploded', view: 'whole' });
  });

  it('selecting another body leaves Explore and clears the feature', () => {
    s().enter('mars');
    s().selectFeature('olympus-mons');
    useSelectionStore.getState().select('jupiter');
    expect(s()).toMatchObject({ active: false, selectedFeatureId: null });
  });
});
