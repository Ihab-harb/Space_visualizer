// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { useSelectionStore } from '../state/selectionStore';
import { useTimeStore } from '../state/timeStore';
import { useUiStore } from '../state/uiStore';
import { makeCatalogFiles } from '../test/fixtures';
import { Header } from './Header';

const f = makeCatalogFiles();
const catalog = createCatalog(f.regions, f.sources, [f.bodies]);

describe('Header', () => {
  beforeEach(() => {
    useTimeStore.setState({ jdTdb: 2451545, playing: false });
    useUiStore.setState({ drawerOpen: false, focusSource: null });
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
});
