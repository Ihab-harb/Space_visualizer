import { beforeEach, describe, expect, it } from 'vitest';
import { useTourStore } from './tourStore';
import { useUiStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => useUiStore.setState({ drawerOpen: false, controlsOpen: false, focusSource: null }));
  it('reveals a source by opening the drawer', () => {
    useUiStore.getState().revealSource('nssdca-planetary-fact-sheet');
    expect(useUiStore.getState()).toMatchObject({ drawerOpen: true, focusSource: 'nssdca-planetary-fact-sheet' });
  });
  it('toggles the drawer and the phone controls', () => {
    useUiStore.getState().toggleDrawer();
    useUiStore.getState().toggleControls();
    expect(useUiStore.getState()).toMatchObject({ drawerOpen: true, controlsOpen: true });
  });
});

describe('tourStore', () => {
  beforeEach(() => useTourStore.setState({ active: false, seq: 0 }));
  it('counts starts and toggles', () => {
    useTourStore.getState().start();
    useTourStore.getState().toggle();
    useTourStore.getState().toggle();
    expect(useTourStore.getState()).toMatchObject({ active: true, seq: 2 });
  });
});
