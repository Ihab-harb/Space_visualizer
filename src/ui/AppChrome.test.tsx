// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { useExploreSession, useExploreStore } from '../state/exploreStore';
import { useSelectionStore } from '../state/selectionStore';
import { makeCatalogFiles } from '../test/fixtures';
import { AppChrome, CHROME_FADE_MS } from './AppChrome';

const f = makeCatalogFiles();
const catalog = createCatalog(f.regions, f.sources, [f.bodies]);
const names = ['Selected body', 'Controls', 'Body information', 'Time controls'];
const shown = () => names.every((n) => document.querySelector(`[aria-label="${n}"]`) !== null);
const gone = () => names.every((n) => document.querySelector(`[aria-label="${n}"]`) === null);

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('AppChrome', () => {
  beforeEach(() => {
    // Reduced motion: the interface steps aside at once (spec §3.2), so these tests read the result straight away.
    setReducedMotion(true);
    useExploreStore.getState().leave();
    useExploreSession.setState({ bodyId: null });
    useSelectionStore.setState({ selectedId: 'jupiter' });
  });

  it('shows the header, controls, drawer and time bar, and none of them while Explore is active', () => {
    render(<AppChrome catalog={catalog} />);
    expect(shown()).toBe(true);
    act(() => useExploreStore.getState().enter('jupiter'));
    expect(gone()).toBe(true);
    expect(screen.queryByRole('banner')).toBeNull();
    act(() => useExploreStore.getState().leave());
    expect(shown()).toBe(true);
  });

  it('stays hidden after leaving until the scene has closed the body (spec §3.1)', () => {
    render(<AppChrome catalog={catalog} />);
    act(() => {
      useExploreStore.getState().enter('jupiter');
      useExploreSession.setState({ bodyId: 'jupiter' }); // the scene opens its session on the next frame
    });
    act(() => useExploreStore.getState().leave());
    expect(gone()).toBe(true); // the body is still closing
    act(() => useExploreSession.setState({ bodyId: null })); // frame.explore went null: fully closed
    expect(shown()).toBe(true);
  });

  it('returns focus to the Explore button once the normal view is back', async () => {
    render(<AppChrome catalog={catalog} />);
    await userEvent.click(screen.getByRole('button', { name: /^Explore/ }));
    expect(gone()).toBe(true);
    act(() => useExploreSession.setState({ bodyId: 'jupiter' }));
    act(() => useExploreStore.getState().leave());
    expect(document.activeElement).toBe(document.body);
    act(() => useExploreSession.setState({ bodyId: null }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Explore/ }));
  });

  it('falls back to the controls when the body was deselected while exploring', () => {
    render(<AppChrome catalog={catalog} />);
    act(() => useExploreStore.getState().enter('jupiter'));
    act(() => useSelectionStore.getState().select(null)); // leaves Explore
    expect(screen.queryByRole('button', { name: /^Explore/ })).toBeNull();
    const controls = document.querySelector('[aria-label="Controls"]')!;
    expect(controls.contains(document.activeElement)).toBe(true);
  });

  it('does not steal focus when the user has already focused something else', () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <AppChrome catalog={catalog} />
      </>,
    );
    act(() => useExploreStore.getState().enter('jupiter'));
    screen.getByRole('button', { name: 'Elsewhere' }).focus();
    act(() => useExploreStore.getState().leave());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Elsewhere' }));
  });
});

describe('AppChrome fade (spec §3.2)', () => {
  beforeEach(() => {
    setReducedMotion(false);
    vi.useFakeTimers();
    useExploreStore.getState().leave();
    useExploreSession.setState({ bodyId: null });
    useSelectionStore.setState({ selectedId: 'jupiter' });
  });
  afterEach(() => vi.useRealTimers());

  it('fades out on entering Explore (inert while it fades), then is removed', () => {
    const { container } = render(<AppChrome catalog={catalog} />);
    act(() => useExploreStore.getState().enter('jupiter'));
    const chrome = container.querySelector('.app-chrome')!;
    expect(chrome).toHaveAttribute('data-state', 'leaving');
    expect(chrome).toHaveAttribute('inert');
    expect(shown()).toBe(true);
    act(() => vi.advanceTimersByTime(CHROME_FADE_MS + 10));
    expect(gone()).toBe(true);
  });

  it('fades back in when the body has closed', () => {
    const { container } = render(<AppChrome catalog={catalog} />);
    act(() => useExploreStore.getState().enter('jupiter'));
    act(() => vi.advanceTimersByTime(CHROME_FADE_MS + 10));
    act(() => useExploreStore.getState().leave());
    expect(container.querySelector('.app-chrome')).toHaveAttribute('data-state', 'entering');
    expect(container.querySelector('.app-chrome')).not.toHaveAttribute('inert');
    act(() => vi.advanceTimersByTime(CHROME_FADE_MS + 10));
    expect(container.querySelector('.app-chrome')).toHaveAttribute('data-state', 'shown');
  });

  it('under reduced motion it is removed at once', () => {
    setReducedMotion(true);
    render(<AppChrome catalog={catalog} />);
    act(() => useExploreStore.getState().enter('jupiter'));
    expect(gone()).toBe(true);
  });
});
