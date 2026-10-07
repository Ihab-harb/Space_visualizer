// @vitest-environment jsdom
import { fireEvent, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRenderStore } from '../state/renderStore';
import { useTourStore } from '../state/tourStore';
import { useUiStore } from '../state/uiStore';
import { useViewStore } from '../state/viewStore';
import { hotkeyAction, useHotkeys } from './hotkeys';

const key = (k: string, extra: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; repeat: boolean; target: EventTarget | null }> = {}) => ({
  key: k, ctrlKey: false, metaKey: false, altKey: false, repeat: false, target: document.body, ...extra,
});

describe('hotkeyAction (spec §4 keyboard)', () => {
  it('maps the spec keys', () => {
    expect(['1', '2', 'Escape', 't', 'T', 'q', 'E', 'f'].map((k) => hotkeyAction(key(k)))).toEqual(['orbit', 'follow', 'orbit', 'tour', 'tour', 'quality', 'effects', 'drawer']);
    expect(hotkeyAction(key('x'))).toBeNull();
  });
  it('ignores modifiers and auto-repeat', () => {
    expect(hotkeyAction(key('f', { ctrlKey: true }))).toBeNull();
    expect(hotkeyAction(key('e', { metaKey: true }))).toBeNull();
    expect(hotkeyAction(key('q', { altKey: true }))).toBeNull();
    expect(hotkeyAction(key('t', { repeat: true }))).toBeNull();
  });
  it('ignores keys while typing', () => {
    for (const tag of ['input', 'select', 'textarea']) {
      expect(hotkeyAction(key('f', { target: document.createElement(tag) }))).toBeNull();
    }
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    expect(hotkeyAction(key('t', { target: editable }))).toBeNull();
  });
});

describe('useHotkeys', () => {
  beforeEach(() => {
    useViewStore.setState({ view: 'orbit' });
    useRenderStore.setState({ mode: 'auto', level: 'high', effects: true });
    useUiStore.setState({ drawerOpen: false, controlsOpen: false, focusSource: null });
    useTourStore.setState({ active: false, seq: 0 });
  });

  it('supports keys 1, 2 and Escape, but not while typing', async () => {
    const user = userEvent.setup();
    renderHook(() => useHotkeys());
    const input = document.createElement('input');
    document.body.append(input);
    await user.keyboard('2');
    expect(useViewStore.getState().view).toBe('follow');
    await user.keyboard('{Escape}');
    expect(useViewStore.getState().view).toBe('orbit');
    await user.click(input);
    await user.keyboard('2');
    expect(useViewStore.getState().view).toBe('orbit');
    input.remove();
  });

  it('cycles quality with Q and toggles effects with E, but not while typing', async () => {
    const user = userEvent.setup();
    renderHook(() => useHotkeys());
    const input = document.createElement('input');
    document.body.append(input);
    await user.keyboard('q');
    expect(useRenderStore.getState().mode).toBe('high');
    await user.keyboard('e');
    expect(useRenderStore.getState().effects).toBe(false);
    await user.click(input);
    await user.keyboard('qe');
    expect(useRenderStore.getState()).toMatchObject({ mode: 'high', effects: false });
    input.remove();
  });

  it('ignores Q and E with Ctrl, Cmd or Alt, and on key auto-repeat', () => {
    renderHook(() => useHotkeys());
    for (const k of ['q', 'Q', 'e', 'E']) {
      for (const extra of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { repeat: true }]) {
        fireEvent.keyDown(window, { key: k, ...extra });
        expect(useRenderStore.getState(), `${k} ${JSON.stringify(extra)}`).toMatchObject({ mode: 'auto', effects: true });
      }
    }
    fireEvent.keyDown(window, { key: 'q' });
    fireEvent.keyDown(window, { key: 'E', shiftKey: true });
    expect(useRenderStore.getState()).toMatchObject({ mode: 'high', effects: false });
  });

  it('fires each action once per key press', () => {
    renderHook(() => useHotkeys());
    fireEvent.keyDown(window, { key: 'f' });
    expect(useUiStore.getState().drawerOpen).toBe(true);
    fireEvent.keyDown(window, { key: 'q' });
    expect(useRenderStore.getState().mode).toBe('high');
  });

  it('T toggles the tour; any other key stops it before acting', () => {
    renderHook(() => useHotkeys());
    fireEvent.keyDown(window, { key: 't' });
    expect(useTourStore.getState()).toMatchObject({ active: true, seq: 1 });
    fireEvent.keyDown(window, { key: 'Shift' });
    expect(useTourStore.getState().active).toBe(true);
    fireEvent.keyDown(window, { key: '2' });
    expect(useTourStore.getState().active).toBe(false);
    expect(useViewStore.getState().view).toBe('follow');
    fireEvent.keyDown(window, { key: 't' });
    fireEvent.keyDown(window, { key: 't' });
    expect(useTourStore.getState().active).toBe(false);
  });

  it('auto-repeat never stops or toggles the tour', () => {
    renderHook(() => useHotkeys());
    fireEvent.keyDown(window, { key: 't' });
    fireEvent.keyDown(window, { key: 't', repeat: true });
    expect(useTourStore.getState().active).toBe(true);
    fireEvent.keyDown(window, { key: 'x', repeat: true });
    expect(useTourStore.getState().active).toBe(true);
  });

  it('a modifier chord stops the tour; typing targets do not', () => {
    renderHook(() => useHotkeys());
    useTourStore.getState().start();
    const input = document.createElement('input');
    document.body.append(input);
    fireEvent.keyDown(input, { key: 'f' });
    expect(useTourStore.getState().active).toBe(true);
    input.remove();
    fireEvent.keyDown(window, { key: 't', ctrlKey: true });
    expect(useTourStore.getState().active).toBe(false);
  });
});
