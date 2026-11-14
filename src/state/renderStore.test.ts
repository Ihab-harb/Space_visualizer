import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRenderStore } from './renderStore';

describe('renderStore', () => {
  beforeEach(() => useRenderStore.setState({ mode: 'auto', level: 'high', effects: true }));
  afterEach(() => vi.unstubAllGlobals());
  it('a fixed mode also fixes the level', () => {
    useRenderStore.getState().setMode('low');
    expect(useRenderStore.getState()).toMatchObject({ mode: 'low', level: 'low' });
  });
  it('entering Auto restarts from the initial level (High on a desktop), so Auto can step down from there', () => {
    useRenderStore.getState().setMode('low');
    useRenderStore.getState().setMode('auto');
    expect(useRenderStore.getState()).toMatchObject({ mode: 'auto', level: 'high' });
  });
  it('entering Auto on a phone restarts at Low', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }), innerWidth: 390 });
    useRenderStore.getState().setMode('high');
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
