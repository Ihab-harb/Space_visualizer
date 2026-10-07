// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRenderStore } from '../state/renderStore';
import { useViewStore } from '../state/viewStore';
import { TopBar } from './TopBar';

beforeEach(() => useViewStore.setState({ view: 'orbit', coRotate: false, scaleMode: 'readable' }));

describe('TopBar', () => {
  it('switches views with buttons and shows co-rotation only in follow view', async () => {
    const user = userEvent.setup();
    render(<TopBar />);
    expect(screen.queryByLabelText('Rotate with body')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Follow' }));
    expect(useViewStore.getState().view).toBe('follow');
    expect(screen.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByLabelText('Rotate with body'));
    expect(useViewStore.getState().coRotate).toBe(true);
  });

  it('switches scale mode', async () => {
    const user = userEvent.setup();
    render(<TopBar />);
    await user.click(screen.getByRole('button', { name: 'True scale' }));
    expect(useViewStore.getState().scaleMode).toBe('true');
  });
});

describe('quality and camera effects', () => {
  beforeEach(() => useRenderStore.setState({ mode: 'auto', level: 'high', effects: true }));
  it('shows the Auto level and switches quality from the buttons', async () => {
    render(<TopBar />);
    expect(screen.getByRole('button', { name: /Auto · High/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Medium' }));
    expect(useRenderStore.getState()).toMatchObject({ mode: 'medium', level: 'medium' });
  });
  it('toggles camera effects from the checkbox', async () => {
    render(<TopBar />);
    await userEvent.click(screen.getByRole('checkbox', { name: /Camera effects/ }));
    expect(useRenderStore.getState().effects).toBe(false);
  });
});

describe('top bar edge', () => {
  it('publishes its bottom edge as --top-bar-bottom while mounted and on resize', () => {
    let callback: ResizeObserverCallback = () => undefined;
    const disconnect = vi.fn();
    class FakeResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        callback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect = disconnect;
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    let bottom = 102;
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ bottom }) as DOMRect);
    const root = document.documentElement.style;
    const { unmount } = render(<TopBar />);
    expect(root.getPropertyValue('--top-bar-bottom')).toBe('102px');
    bottom = 195;
    act(() => callback([], {} as ResizeObserver));
    expect(root.getPropertyValue('--top-bar-bottom')).toBe('195px');
    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(root.getPropertyValue('--top-bar-bottom')).toBe('');
    rect.mockRestore();
    vi.unstubAllGlobals();
  });
});
