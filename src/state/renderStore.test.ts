import { beforeEach, describe, expect, it } from 'vitest';
import { useRenderStore } from './renderStore';

describe('renderStore', () => {
  beforeEach(() => useRenderStore.setState({ mode: 'auto', level: 'high', effects: true }));
  it('a fixed mode also fixes the level; auto keeps the current level', () => {
    useRenderStore.getState().setMode('low');
    expect(useRenderStore.getState()).toMatchObject({ mode: 'low', level: 'low' });
    useRenderStore.getState().setMode('auto');
    expect(useRenderStore.getState()).toMatchObject({ mode: 'auto', level: 'low' });
  });
  it('cycles modes and toggles effects', () => {
    useRenderStore.getState().cycleMode();
    expect(useRenderStore.getState()).toMatchObject({ mode: 'high', level: 'high' });
    useRenderStore.getState().toggleEffects();
    expect(useRenderStore.getState().effects).toBe(false);
  });
});
