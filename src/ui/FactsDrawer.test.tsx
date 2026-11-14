// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { useSelectionStore } from '../state/selectionStore';
import { useUiStore } from '../state/uiStore';
import { useTimeStore } from '../state/timeStore';
import { useViewStore } from '../state/viewStore';
import { useDetailsStore } from '../state/detailsStore';
import { makeJupiterDetails } from '../test/detailsFixtures';
import { makeCatalogFiles } from '../test/fixtures';
import { citationModel } from './citations';
import { FactsDrawer } from './FactsDrawer';

const files = makeCatalogFiles();
const catalog = createCatalog(files.regions, files.sources, [files.bodies]);

beforeEach(() => {
  useDetailsStore.setState({ entries: {} });
  useTimeStore.setState({ jdTdb: 2451545, playing: false });
  useViewStore.setState({ view: 'orbit', focusRequest: null });
  useSelectionStore.setState({ selectedId: 'jupiter' });
  useUiStore.setState({ drawerOpen: true, focusSource: null });
});

const panel = () => screen.getByRole('complementary', { name: 'Body information' });

describe('FactsDrawer', () => {
  it('renders nothing when nothing is selected', () => {
    useSelectionStore.setState({ selectedId: null });
    const { container } = render(<FactsDrawer catalog={catalog} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the name, kind, description and formatted facts', () => {
    render(<FactsDrawer catalog={catalog} />);
    expect(within(panel()).getByRole('heading', { name: 'Jupiter' })).toBeInTheDocument();
    expect(panel()).toHaveTextContent('Planet · orbits the Sun');
    expect(panel()).toHaveTextContent('Jupiter is the fifth planet from the Sun');
    const mass = within(panel()).getByText('Mass').closest('.facts__row')!;
    expect(mass).toHaveTextContent('1.898 × 10²⁷ kg');
  });

  it('cites every value and lists the sources with links', () => {
    render(<FactsDrawer catalog={catalog} />);
    const mass = within(panel()).getByText('Mass').closest('.facts__row') as HTMLElement;
    const cite = within(mass).getByRole('link');
    expect(cite.getAttribute('href')).toBe('#source-nssdca-planetary-fact-sheet');
    const source = within(panel()).getByRole('link', { name: 'Planetary Fact Sheet - Metric' });
    expect(source).toHaveAttribute('href', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/');
    expect(source.closest('li')).toHaveAttribute('id', 'source-nssdca-planetary-fact-sheet');
  });

  it('never shows undefined or NaN, and omits facts the source lists as unknown', () => {
    render(<FactsDrawer catalog={catalog} />);
    expect(panel().textContent).not.toMatch(/undefined|NaN/);
    expect(within(panel()).queryByText('Surface pressure')).not.toBeInTheDocument();
  });

  it('shows live distances and the measured accuracy', () => {
    render(<FactsDrawer catalog={catalog} />);
    expect(panel()).toHaveTextContent('Distance from the Sun');
    expect(panel()).toHaveTextContent('Distance from Earth');
    expect(panel()).toHaveTextContent('Light travel time from Earth');
    expect(panel()).toHaveTextContent('Measured against JPL Horizons at 6 dates');
  });

  it("shows the Sun's notes and its frame-origin accuracy note", () => {
    useSelectionStore.setState({ selectedId: 'sun' });
    render(<FactsDrawer catalog={catalog} />);
    expect(panel()).toHaveTextContent('Adopted period at 16° latitude');
    expect(panel()).toHaveTextContent('origin of the heliocentric frame');
    expect(panel()).not.toHaveTextContent('Distance from the Sun');
  });

  it("gives the Sun's distance and light time from Earth, cited to Earth's position model", () => {
    useSelectionStore.setState({ selectedId: 'sun' });
    render(<FactsDrawer catalog={catalog} />);
    const row = within(panel()).getByText('Distance from Earth').closest('.facts__row') as HTMLElement;
    expect(row).toHaveTextContent('AU');
    expect(within(row).getByRole('link').getAttribute('href')).toBe('#source-jpl-approx-pos');
    expect(panel()).toHaveTextContent('Light travel time from Earth');
    expect(within(panel()).getByRole('link', { name: 'Approximate Positions of the Planets' })).toBeInTheDocument();
    expect(panel().textContent).not.toMatch(/undefined|NaN/);
  });

  it('cites the light travel time and every sourced accuracy figure', () => {
    render(<FactsDrawer catalog={catalog} />);
    const light = within(panel()).getByText('Light travel time from Earth').closest('.facts__row') as HTMLElement;
    expect(within(light).getByRole('link').getAttribute('href')).toBe('#source-jpl-approx-pos');
    expect(light).toHaveTextContent('299,792.458 km/s');
    const accuracy = panel().querySelector('.info-panel__accuracy') as HTMLElement;
    const hrefs = within(accuracy).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('#source-jpl-approx-pos');
    expect(hrefs).toContain('#source-jpl-horizons');
  });

  it('explains that Earth is drawn at the Earth–Moon barycentre', () => {
    useSelectionStore.setState({ selectedId: 'earth' });
    render(<FactsDrawer catalog={catalog} />);
    expect(panel()).toHaveTextContent('Earth–Moon barycentre');
  });

  it('shows the imagery section with cited layers and illustrative notes', () => {
    render(<FactsDrawer catalog={catalog} />);
    const section = within(panel()).getByRole('heading', { name: 'Imagery' }).closest('section')!;
    expect(section).toHaveTextContent('Cloud-band motion is illustrative.');
    expect(panel()).not.toHaveTextContent('Illustrative colour — no official surface map in this release.');
  });

  it('closes with its close button', async () => {
    const user = userEvent.setup();
    render(<FactsDrawer catalog={catalog} />);
    await user.click(screen.getByRole('button', { name: 'Close facts' }));
    expect(useUiStore.getState().drawerOpen).toBe(false);
  });

  it('is hidden from assistive tech while closed', () => {
    useUiStore.setState({ drawerOpen: false });
    render(<FactsDrawer catalog={catalog} />);
    expect(screen.queryByRole('complementary', { name: 'Body information' })).toBeNull(); // aria-hidden removes it from the a11y tree
  });

  it('uses the same citation numbers as the header', () => {
    render(<FactsDrawer catalog={catalog} />);
    const { order } = citationModel(catalog, catalog.bodyById.get('jupiter')!);
    const items = within(panel()).getAllByRole('listitem').filter((li) => li.id.startsWith('source-'));
    expect(items.map((li) => li.id.replace('source-', ''))).toEqual(order.filter((id) => catalog.sources.has(id)));
  });

  it('scrolls to and clears a revealed source', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    useUiStore.setState({ drawerOpen: true, focusSource: 'nssdca-planetary-fact-sheet' });
    render(<FactsDrawer catalog={catalog} />);
    expect(scroll).toHaveBeenCalled();
    expect(useUiStore.getState().focusSource).toBeNull();
  });

  it('appends the details sources after the existing ones and shows the sections', () => {
    const details = makeJupiterDetails();
    details.discovery = { kind: 'antiquity', sourceId: 'nasa-science-sun' }; // a source the body does not otherwise cite
    useDetailsStore.setState({ entries: { jupiter: { status: 'ready', details } } });
    render(<FactsDrawer catalog={catalog} />);
    const jupiter = catalog.bodyById.get('jupiter')!;
    const before = citationModel(catalog, jupiter).order;
    const after = citationModel(catalog, jupiter, details).order;
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.length).toBeGreaterThan(before.length);
    const items = within(panel()).getAllByRole('listitem').filter((li) => li.id.startsWith('source-'));
    expect(items.map((li) => li.id.replace('source-', ''))).toEqual(after.filter((id) => catalog.sources.has(id)));
    expect(within(panel()).getByRole('heading', { name: 'Magnetic field' })).toBeInTheDocument();
    expect(within(panel()).getByRole('heading', { name: 'Imagery' })).toBeInTheDocument();
  });

  it('shows the loading line, then keeps the existing sections', () => {
    useDetailsStore.setState({ entries: { jupiter: { status: 'loading' } } });
    render(<FactsDrawer catalog={catalog} />);
    expect(within(panel()).getByRole('status')).toHaveTextContent('Loading details…');
    expect(within(panel()).getByRole('heading', { name: 'Position accuracy' })).toBeInTheDocument();
  });
});
