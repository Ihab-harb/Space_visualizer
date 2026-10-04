// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { useSelectionStore } from '../state/selectionStore';
import { useTimeStore } from '../state/timeStore';
import { useViewStore } from '../state/viewStore';
import { makeCatalogFiles } from '../test/fixtures';
import { InfoPanel } from './InfoPanel';

const files = makeCatalogFiles();
const catalog = createCatalog(files.regions, files.sources, [files.bodies]);

beforeEach(() => {
  useTimeStore.setState({ jdTdb: 2451545, playing: false });
  useViewStore.setState({ view: 'orbit', focusRequest: null });
  useSelectionStore.setState({ selectedId: 'jupiter' });
});

const panel = () => screen.getByRole('complementary', { name: 'Body information' });

describe('InfoPanel', () => {
  it('renders nothing when nothing is selected', () => {
    useSelectionStore.setState({ selectedId: null });
    const { container } = render(<InfoPanel catalog={catalog} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the name, kind, description and formatted facts', () => {
    render(<InfoPanel catalog={catalog} />);
    expect(within(panel()).getByRole('heading', { name: 'Jupiter' })).toBeInTheDocument();
    expect(panel()).toHaveTextContent('Planet · orbits the Sun');
    expect(panel()).toHaveTextContent('Jupiter is the fifth planet from the Sun');
    const mass = within(panel()).getByText('Mass').closest('.facts__row')!;
    expect(mass).toHaveTextContent('1.898 × 10²⁷ kg');
  });

  it('cites every value and lists the sources with links', () => {
    render(<InfoPanel catalog={catalog} />);
    const mass = within(panel()).getByText('Mass').closest('.facts__row') as HTMLElement;
    const cite = within(mass).getByRole('link');
    expect(cite.getAttribute('href')).toBe('#source-nssdca-planetary-fact-sheet');
    const source = within(panel()).getByRole('link', { name: 'Planetary Fact Sheet - Metric' });
    expect(source).toHaveAttribute('href', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/');
    expect(source.closest('li')).toHaveAttribute('id', 'source-nssdca-planetary-fact-sheet');
  });

  it('never shows undefined or NaN, and omits facts the source lists as unknown', () => {
    render(<InfoPanel catalog={catalog} />);
    expect(panel().textContent).not.toMatch(/undefined|NaN/);
    expect(within(panel()).queryByText('Surface pressure')).not.toBeInTheDocument();
  });

  it('shows live distances and the measured accuracy', () => {
    render(<InfoPanel catalog={catalog} />);
    expect(panel()).toHaveTextContent('Distance from the Sun');
    expect(panel()).toHaveTextContent('Distance from Earth');
    expect(panel()).toHaveTextContent('Light travel time from Earth');
    expect(panel()).toHaveTextContent('Measured against JPL Horizons at 6 dates');
  });

  it("shows the Sun's notes and its frame-origin accuracy note", () => {
    useSelectionStore.setState({ selectedId: 'sun' });
    render(<InfoPanel catalog={catalog} />);
    expect(panel()).toHaveTextContent('Adopted period at 16° latitude');
    expect(panel()).toHaveTextContent('origin of the heliocentric frame');
    expect(panel()).not.toHaveTextContent('Distance from the Sun');
  });

  it('explains that Earth is drawn at the Earth–Moon barycentre', () => {
    useSelectionStore.setState({ selectedId: 'earth' });
    render(<InfoPanel catalog={catalog} />);
    expect(panel()).toHaveTextContent('Earth–Moon barycentre');
  });

  it('centres the view and closes', async () => {
    const user = userEvent.setup();
    render(<InfoPanel catalog={catalog} />);
    await user.click(screen.getByRole('button', { name: 'Centre view' }));
    expect(useViewStore.getState().focusRequest?.bodyId).toBe('jupiter');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(useSelectionStore.getState().selectedId).toBeNull();
  });
});
