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

function explore(bodyId: string, tab: 'surface' | 'interior' = 'surface') {
  useDetailsStore.setState({ entries: { [bodyId]: { status: 'ready', details: realDetails(bodyId) } } });
  useSelectionStore.setState({ selectedId: bodyId });
  act(() => {
    useExploreStore.getState().enter(bodyId);
    useExploreStore.getState().setTab(tab);
  });
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
    expect(screen.getByText('Explore · Surface')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Earth' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave Explore' })).toBeInTheDocument();
  });

  it('shows Surface and Interior, Surface checked on entry', () => {
    explore('earth');
    render(<ExploreOverlay catalog={catalog} />);
    const group = screen.getByRole('radiogroup', { name: 'Explore section' });
    expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Surface', 'Interior']);
    expect(within(group).getByRole('radio', { name: 'Surface' })).toHaveAttribute('aria-checked', 'true');
    expect(within(group).getByRole('radio', { name: 'Interior' })).toHaveAttribute('aria-checked', 'false');
  });

  it('shows Exploded and Half-section only on Interior', async () => {
    explore('earth');
    render(<ExploreOverlay catalog={catalog} />);
    expect(screen.queryByRole('radiogroup', { name: 'Interior view' })).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Interior' }));
    const sub = screen.getByRole('radiogroup', { name: 'Interior view' });
    expect(within(sub).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Exploded', 'Half-section']);
    expect(within(sub).getByRole('radio', { name: 'Exploded' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Surface' }));
    expect(screen.queryByRole('radiogroup', { name: 'Interior view' })).toBeNull();
  });

  it('names the kicker after the tab', async () => {
    explore('earth');
    render(<ExploreOverlay catalog={catalog} />);
    expect(screen.getByText('Explore · Surface')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Interior' }));
    expect(screen.getByText('Explore · Interior')).toBeInTheDocument();
  });

  it('keeps the composition strip on both tabs', async () => {
    explore('earth');
    render(<ExploreOverlay catalog={catalog} />);
    expect(screen.getByRole('region', { name: 'Composition' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Interior' }));
    expect(screen.getByRole('region', { name: 'Composition' })).toBeInTheDocument();
  });

  it('shows the interior notes on Interior only', async () => {
    explore('jupiter');
    render(<ExploreOverlay catalog={catalog} />);
    expect(screen.queryByText('Estimate', { selector: '.tag' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Illustrative colours' })).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Interior' }));
    expect(screen.getByText('Estimate', { selector: '.tag' })).toBeInTheDocument();
  });

  it('shows "No named surface features" on Surface for Jupiter', async () => {
    explore('jupiter');
    render(<ExploreOverlay catalog={catalog} />);
    expect(screen.getByText('No named surface features')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Interior' }));
    expect(screen.queryByText('No named surface features')).toBeNull();
  });

  it('does not say "No named surface features" for a body that has some (Mars)', () => {
    explore('mars');
    render(<ExploreOverlay catalog={catalog} />);
    expect(screen.queryByText('No named surface features')).toBeNull();
  });

  it('shows the radar tag on Surface for Venus and not on Interior', async () => {
    explore('venus');
    render(<ExploreOverlay catalog={catalog} />);
    expect(screen.getByText('Radar view · not visible light')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Interior' }));
    expect(screen.queryByText('Radar view · not visible light')).toBeNull();
  });

  it('shows no surface note while details load or after a failed load, and does not throw', () => {
    for (const entry of [{ status: 'loading' }, { status: 'error', message: 'x' }] as const) {
      useDetailsStore.setState({ entries: { venus: entry } });
      useSelectionStore.setState({ selectedId: 'venus' });
      act(() => useExploreStore.getState().enter('venus'));
      const { unmount } = render(<ExploreOverlay catalog={catalog} />);
      expect(screen.getByRole('radiogroup', { name: 'Explore section' })).toBeInTheDocument();
      expect(screen.queryByText('No named surface features')).toBeNull();
      expect(screen.queryByText('Radar view · not visible light')).toBeNull();
      unmount();
      act(() => useExploreStore.getState().leave());
    }
  });

  it('switches the tab and the interior view from the radios and with the arrow keys', async () => {
    explore('earth');
    render(<ExploreOverlay catalog={catalog} />);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Surface' }), { key: 'ArrowRight' });
    expect(useExploreStore.getState().view).toBe('exploded');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Interior' }));
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Interior' }), { key: 'ArrowLeft' });
    expect(useExploreStore.getState().view).toBe('whole');
    await userEvent.click(screen.getByRole('radio', { name: 'Interior' }));
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
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Surface' }));
  });

  it('shows the Estimate tag only when a layer is an estimate', () => {
    explore('jupiter', 'interior');
    const { unmount } = render(<ExploreOverlay catalog={catalog} />);
    expect(screen.getByText('Estimate', { selector: '.tag' })).toBeInTheDocument();
    unmount();
    act(() => useExploreStore.getState().leave());
    explore('earth', 'interior');
    render(<ExploreOverlay catalog={catalog} />);
    expect(screen.queryByText('Estimate', { selector: '.tag' })).toBeNull();
  });

  it('says the layer sizes are not to scale for an all-illustrative interior (Uranus)', () => {
    explore('uranus', 'interior');
    render(<ExploreOverlay catalog={catalog} />);
    expect(screen.getByText('Layer sizes are not to scale')).toBeInTheDocument();
  });

  it('the "Illustrative colours" note link opens the card on its note', async () => {
    explore('earth', 'interior');
    render(<ExploreOverlay catalog={catalog} />);
    await userEvent.click(screen.getByRole('button', { name: 'Illustrative colours' }));
    expect(useExploreStore.getState().selectedLayerId).toBe('crust');
    expect(document.activeElement).toHaveTextContent(/^Illustrative colours/);
  });

  it('shows the layer card for the selected layer and clears it with the card ✕', async () => {
    explore('earth', 'interior');
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

  it('shows "No interior data yet" on Interior for a body without an interior, and Surface still works', async () => {
    useDetailsStore.setState({ entries: { earth: { status: 'ready', details: { ...realDetails('earth'), interior: null } } } });
    useSelectionStore.setState({ selectedId: 'earth' });
    act(() => useExploreStore.getState().enter('earth'));
    render(<ExploreOverlay catalog={catalog} />);
    expect(screen.getByRole('radiogroup', { name: 'Explore section' })).toBeInTheDocument();
    expect(screen.queryByText('No interior data yet')).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Interior' }));
    expect(screen.queryByRole('radiogroup', { name: 'Interior view' })).toBeNull();
    expect(screen.getByText('No interior data yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Surface' }));
    expect(useExploreStore.getState().view).toBe('whole');
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
      act(() => {
        useExploreStore.getState().enter('earth');
        useExploreStore.getState().setTab('interior');
      });
      render(<ExploreOverlay catalog={catalog} />);
    };

    it('while loading: a short hint in place of the interior switch; the tabs stay', () => {
      enterWith({ entries: { earth: { status: 'loading' } } });
      expect(screen.getByRole('status')).toHaveTextContent('Loading the interior…');
      expect(screen.getByRole('radiogroup', { name: 'Explore section' })).toBeInTheDocument();
      expect(screen.queryByRole('radiogroup', { name: 'Interior view' })).toBeNull();
      expect(screen.queryByRole('region', { name: 'Composition' })).toBeNull();
    });

    it('when the body has no details file: "No interior data yet" and no interior switch', () => {
      enterWith({ entries: { earth: { status: 'missing' } } });
      expect(screen.getByText('No interior data yet')).toBeInTheDocument();
      expect(screen.queryByRole('radiogroup', { name: 'Interior view' })).toBeNull();
    });

    it('when loading failed: a short message and Retry, which loads again', async () => {
      const retry = vi.fn().mockResolvedValue(undefined);
      enterWith({ entries: { earth: { status: 'error', message: 'Could not load details for earth (HTTP 500).' } }, retry });
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Could not load the interior.');
      expect(screen.queryByRole('radiogroup', { name: 'Interior view' })).toBeNull();
      await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
      expect(retry).toHaveBeenCalledWith('earth');
    });

    it('keeps focus in the overlay when Retry goes away: on the checked view once the data has loaded', async () => {
      enterWith({ entries: { earth: { status: 'error', message: 'x' } }, retry: vi.fn().mockResolvedValue(undefined) });
      await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
      act(() => useDetailsStore.setState({ entries: { earth: { status: 'ready', details: realDetails('earth') } } }));
      expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Interior', checked: true }));
    });

    it('focuses the checked section radio on entry even when there is no interior', () => {
      enterWith({ entries: { earth: { status: 'missing' } } });
      expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Interior', checked: true }));
    });
  });

  describe('phone width (≤ 720 px)', () => {
    beforeEach(() => setWidth(true));

    it('lists the layers, numbered like the dots, behind a tap-to-open button', async () => {
      explore('earth', 'interior');
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
