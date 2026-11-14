// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { useSelectionStore } from '../state/selectionStore';
import { useTimeStore } from '../state/timeStore';
import { useUiStore } from '../state/uiStore';
import { useViewStore } from '../state/viewStore';
import { useDetailsStore } from '../state/detailsStore';
import { makeJupiterDetails } from '../test/detailsFixtures';
import { makeCatalogFiles } from '../test/fixtures';
import { Header } from './Header';

const f = makeCatalogFiles();
const catalog = createCatalog(f.regions, f.sources, [f.bodies]);

describe('Header', () => {
  beforeEach(() => {
    useDetailsStore.setState({ entries: {} });
    useTimeStore.setState({ jdTdb: 2451545, playing: false });
    useUiStore.setState({ drawerOpen: false, focusSource: null });
    useViewStore.setState({ venusRadar: false });
  });
  it('shows the overview when nothing is selected', () => {
    useSelectionStore.setState({ selectedId: null });
    render(<Header catalog={catalog} />);
    expect(screen.getByRole('heading', { name: 'Solar System' })).toBeInTheDocument();
    expect(screen.getByText(/Bodies in view/)).toBeInTheDocument();
  });
  it('shows the selected body with cited chips and narrative', () => {
    useSelectionStore.setState({ selectedId: 'jupiter' });
    render(<Header catalog={catalog} />);
    const header = screen.getByRole('banner', { name: 'Selected body' });
    expect(within(header).getByRole('heading', { name: 'Jupiter' })).toBeInTheDocument();
    expect(within(header).getByText('From Earth')).toBeInTheDocument();
    expect(within(header).getAllByRole('link', { name: /Source \d+/ }).length).toBeGreaterThanOrEqual(3);
  });
  it('opens the drawer at a source when a citation is clicked', async () => {
    useSelectionStore.setState({ selectedId: 'jupiter' });
    render(<Header catalog={catalog} />);
    await userEvent.click(screen.getAllByRole('link', { name: /Source \d+/ })[0]!);
    expect(useUiStore.getState().drawerOpen).toBe(true);
    expect(useUiStore.getState().focusSource).not.toBeNull();
  });
  it('tags the on-screen radar view as not visible light, only while it is shown (I3)', () => {
    const radarFiles = makeCatalogFiles();
    const jupiter = radarFiles.bodies.bodies.find((b) => b.id === 'jupiter')!;
    jupiter.render.shader = 'venus';
    jupiter.imagery = { radar: { tiers: { '2k': 'r' }, sourceId: 'nasa-science-jupiter' } };
    const radarCatalog = createCatalog(radarFiles.regions, radarFiles.sources, [radarFiles.bodies]);
    useSelectionStore.setState({ selectedId: 'jupiter' });
    const { rerender } = render(<Header catalog={radarCatalog} />);
    expect(screen.queryByText(/not visible light/i)).toBeNull();
    useViewStore.setState({ venusRadar: true });
    rerender(<Header catalog={radarCatalog} />);
    expect(screen.getByText('Radar view · not visible light')).toBeInTheDocument();
    useSelectionStore.setState({ selectedId: 'earth' });
    rerender(<Header catalog={radarCatalog} />);
    expect(screen.queryByText(/not visible light/i)).toBeNull();
  });

  it('adds the cited field sentence once details load, without renumbering the chips', () => {
    useSelectionStore.setState({ selectedId: 'jupiter' });
    useDetailsStore.setState({ entries: { jupiter: { status: 'loading' } } });
    const { rerender } = render(<Header catalog={catalog} />);
    const header = () => screen.getByRole('banner', { name: 'Selected body' });
    const chips = () => Array.from(header().querySelectorAll('.chip')).map((c) => c.textContent);
    const before = chips();
    expect(header()).not.toHaveTextContent(/tilted/);
    useDetailsStore.setState({ entries: { jupiter: { status: 'ready', details: makeJupiterDetails() } } });
    rerender(<Header catalog={catalog} />);
    expect(chips()).toEqual(before);
    expect(header()).toHaveTextContent(/tilted 9\.4°\[\d+\] from its spin axis/);
    const narrative = header().querySelector('#header-narrative')!;
    expect(within(narrative as HTMLElement).getAllByRole('link', { name: /Source \d+/ }).length).toBeGreaterThanOrEqual(2);
  });
});
