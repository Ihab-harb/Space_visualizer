// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDetailsStore } from '../../state/detailsStore';
import { useExploreStore } from '../../state/exploreStore';
import { useSelectionStore } from '../../state/selectionStore';
import { realCatalog, realDetails } from '../../test/realData';
import { ExploreOverlay } from './ExploreOverlay';

const catalog = realCatalog();

function setWidth(narrow: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: narrow && query.includes('max-width'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function explore(bodyId: string) {
  useDetailsStore.setState({ entries: { [bodyId]: { status: 'ready', details: realDetails(bodyId) } } });
  useSelectionStore.setState({ selectedId: bodyId });
  act(() => useExploreStore.getState().enter(bodyId));
}

describe('ExploreOverlay', () => {
  beforeEach(() => {
    setWidth(false);
    useExploreStore.getState().leave();
  });
  afterEach(() => act(() => useExploreStore.getState().leave()));

  it('renders nothing outside Explore', () => {
    const { container } = render(<ExploreOverlay catalog={catalog} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the kind, the body name, the view switch and the leave button', () => {
    explore('earth');
    render(<ExploreOverlay catalog={catalog} />);
    expect(screen.getByText('Explore · Interior')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Earth' })).toBeInTheDocument();
    const group = screen.getByRole('radiogroup', { name: 'Interior view' });
    expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Whole', 'Exploded', 'Half-section']);
    expect(screen.getByRole('radio', { name: 'Whole' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Leave Explore' })).toBeInTheDocument();
  });

  it('switches the view from the radios and with the arrow keys', async () => {
    explore('earth');
    render(<ExploreOverlay catalog={catalog} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Half-section' }));
    expect(useExploreStore.getState().view).toBe('section');
    expect(screen.getByRole('radio', { name: 'Half-section' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Half-section' }), { key: 'ArrowLeft' });
    expect(useExploreStore.getState().view).toBe('exploded');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Exploded' }));
  });

  it('leaves Explore with ✕', async () => {
    explore('earth');
    render(<ExploreOverlay catalog={catalog} />);
    await userEvent.click(screen.getByRole('button', { name: 'Leave Explore' }));
    expect(useExploreStore.getState().active).toBe(false);
  });

  it('moves focus into the overlay on entry (the checked view)', () => {
    explore('earth');
    render(<ExploreOverlay catalog={catalog} />);
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Whole' }));
  });

  it('shows the Estimate tag only when a layer is an estimate', () => {
    explore('jupiter');
    const { unmount } = render(<ExploreOverlay catalog={catalog} />);
    expect(screen.getByText('Estimate', { selector: '.tag' })).toBeInTheDocument();
    unmount();
    act(() => useExploreStore.getState().leave());
    explore('earth');
    render(<ExploreOverlay catalog={catalog} />);
    expect(screen.queryByText('Estimate', { selector: '.tag' })).toBeNull();
  });

  it('says the layer sizes are not to scale for an all-illustrative interior (Uranus)', () => {
    explore('uranus');
    render(<ExploreOverlay catalog={catalog} />);
    expect(screen.getByText('Layer sizes are not to scale')).toBeInTheDocument();
  });

  it('the "Illustrative colours" note link opens the card on its note', async () => {
    explore('earth');
    render(<ExploreOverlay catalog={catalog} />);
    await userEvent.click(screen.getByRole('button', { name: 'Illustrative colours' }));
    expect(useExploreStore.getState().selectedLayerId).toBe('crust');
    expect(document.activeElement).toHaveTextContent(/^Illustrative colours/);
  });

  it('shows the layer card for the selected layer and clears it with the card ✕', async () => {
    explore('earth');
    render(<ExploreOverlay catalog={catalog} />);
    expect(screen.queryByRole('region', { name: 'Mantle' })).toBeNull();
    act(() => useExploreStore.getState().selectLayer('mantle'));
    expect(screen.getByRole('region', { name: 'Mantle' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close layer card' }));
    expect(useExploreStore.getState().selectedLayerId).toBeNull();
  });

  it('previews the composition in the strip and opens and closes the full chart', async () => {
    explore('earth');
    render(<ExploreOverlay catalog={catalog} />);
    const strip = screen.getByRole('region', { name: 'Composition' });
    expect(strip).toHaveTextContent('N₂ 78.08 %');
    expect(strip).toHaveTextContent('O₂ 20.95 %');
    await userEvent.click(within(strip).getByRole('button', { name: /Open full chart/ }));
    expect(useExploreStore.getState().chartOpen).toBe(true);
    const panel = screen.getByRole('dialog', { name: 'Composition chart' });
    expect(within(panel).getByRole('heading', { name: /Atmosphere/ })).toBeInTheDocument();
    expect(document.activeElement).toBe(within(panel).getByRole('button', { name: 'Close chart' }));
    await userEvent.click(within(panel).getByRole('button', { name: 'Close chart' }));
    expect(useExploreStore.getState().chartOpen).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(within(strip).getByRole('button', { name: /Open full chart/ }));
  });

  it('shows "No atmosphere" and no chart button when there is nothing to chart (Mercury has a note)', () => {
    explore('mercury');
    render(<ExploreOverlay catalog={catalog} />);
    const strip = screen.getByRole('region', { name: 'Composition' });
    expect(within(strip).queryByRole('button', { name: /Open full chart/ })).toBeNull();
    expect(strip.textContent!.length).toBeGreaterThan(10);
  });

  it('shows "No interior data yet" in place of the switch when the body has no interior', () => {
    useDetailsStore.setState({ entries: { earth: { status: 'ready', details: { ...realDetails('earth'), interior: null } } } });
    useSelectionStore.setState({ selectedId: 'earth' });
    act(() => useExploreStore.getState().enter('earth'));
    render(<ExploreOverlay catalog={catalog} />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByText('No interior data yet')).toBeInTheDocument();
  });

  it('every [n] in Explore has somewhere to go: a tooltip naming the source, and a Sources list in the chart panel', async () => {
    explore('earth');
    render(<ExploreOverlay catalog={catalog} />);
    const strip = screen.getByRole('region', { name: 'Composition' });
    const stripLink = within(strip).getAllByRole('link')[0]!;
    const sourceId = stripLink.getAttribute('href')!.replace('#chart-source-', '');
    const source = catalog.sources.get(sourceId)!;
    expect(stripLink).toHaveAttribute('title', `${source.title} · ${source.publisher}`);
    // A strip citation opens the full chart on its source.
    await userEvent.click(stripLink);
    const panel = screen.getByRole('dialog', { name: 'Composition chart' });
    const list = within(panel).getByRole('list', { name: 'Sources' });
    const item = document.getElementById(`chart-source-${sourceId}`)!;
    expect(list.contains(item)).toBe(true);
    expect(item).toHaveTextContent(source.title);
    expect(document.activeElement).toBe(item);
    // Every citation in the panel points at an item of that list.
    for (const a of within(panel).getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('#'))) {
      const target = document.getElementById(a.getAttribute('href')!.slice(1));
      expect(target, a.getAttribute('href')!).not.toBeNull();
      expect(list.contains(target)).toBe(true);
    }
  });

  describe('details not ready', () => {
    const enterWith = (entry: Partial<ReturnType<typeof useDetailsStore.getState>>) => {
      useDetailsStore.setState(entry);
      useSelectionStore.setState({ selectedId: 'earth' });
      act(() => useExploreStore.getState().enter('earth'));
      render(<ExploreOverlay catalog={catalog} />);
    };

    it('while loading: a short hint and no live view switch', () => {
      enterWith({ entries: { earth: { status: 'loading' } } });
      expect(screen.getByRole('status')).toHaveTextContent('Loading the interior…');
      expect(screen.queryByRole('radiogroup')).toBeNull();
      expect(screen.queryByRole('region', { name: 'Composition' })).toBeNull();
    });

    it('when the body has no details file: "No interior data yet" and no switch', () => {
      enterWith({ entries: { earth: { status: 'missing' } } });
      expect(screen.getByText('No interior data yet')).toBeInTheDocument();
      expect(screen.queryByRole('radiogroup')).toBeNull();
    });

    it('when loading failed: a short message and Retry, which loads again', async () => {
      const retry = vi.fn().mockResolvedValue(undefined);
      enterWith({ entries: { earth: { status: 'error', message: 'Could not load details for earth (HTTP 500).' } }, retry });
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Could not load the interior.');
      expect(screen.queryByRole('radiogroup')).toBeNull();
      await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
      expect(retry).toHaveBeenCalledWith('earth');
    });

    it('focuses the leave button when there is no switch', () => {
      enterWith({ entries: { earth: { status: 'missing' } } });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Leave Explore' }));
    });
  });

  describe('phone width (≤ 720 px)', () => {
    beforeEach(() => setWidth(true));

    it('lists the layers, numbered like the dots, behind a tap-to-open button', async () => {
      explore('earth');
      render(<ExploreOverlay catalog={catalog} />);
      const toggle = screen.getByRole('button', { name: /Layers/ });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('list', { name: 'Layers' })).toBeNull();
      await userEvent.click(toggle);
      const list = screen.getByRole('list', { name: 'Layers' });
      const items = within(list).getAllByRole('button');
      expect(items.map((b) => b.textContent)).toEqual([
        expect.stringMatching(/^1\s*Crust/),
        expect.stringMatching(/^2\s*Mantle/),
        expect.stringMatching(/^3\s*Outer core/),
        expect.stringMatching(/^4\s*Inner core/),
      ]);
      await userEvent.click(items[2]!);
      expect(useExploreStore.getState().selectedLayerId).toBe('outer-core');
      expect(screen.queryByRole('list', { name: 'Layers' })).toBeNull();
    });
  });
});
