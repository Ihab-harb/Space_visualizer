// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BodyDetails } from '../core/details/schema';
import { useDetailsStore, type DetailsEntry } from '../state/detailsStore';
import { makeJupiterDetails, makeMarsDetails, makeSunDetails } from '../test/detailsFixtures';
import { DetailsSections } from './DetailsSections';

const cite = (id: string) => <sup>[{id}]</sup>;
const ready = (details: BodyDetails): DetailsEntry => ({ status: 'ready', details });
const show = (id: string, entry: DetailsEntry | undefined) => render(<DetailsSections body={{ id }} entry={entry} cite={cite} />);
const heading = (name: string) => screen.queryByRole('heading', { name });

afterEach(() => vi.restoreAllMocks());

describe('DetailsSections', () => {
  it('shows a loading line while there is no entry or it is loading', () => {
    const { unmount } = show('mars', undefined);
    expect(screen.getByRole('status')).toHaveTextContent('Loading details…');
    unmount();
    show('mars', { status: 'loading' });
    expect(screen.getByRole('status')).toHaveTextContent('Loading details…');
  });

  it.each([{ status: 'missing' }, { status: 'error', message: 'boom' }] as DetailsEntry[])('shows unavailable and retries on $status', async (entry) => {
    const retry = vi.fn().mockResolvedValue(undefined);
    useDetailsStore.setState({ retry });
    show('mars', entry);
    expect(screen.getByText('Details unavailable')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledWith('mars');
  });

  it('renders every Mars section with cited values', () => {
    show('mars', ready(makeMarsDetails()));
    for (const name of ['Interior', 'Atmosphere', 'Magnetic field', 'Key missions', 'Discovery', 'Named features']) expect(heading(name)).toBeInTheDocument();
    expect(screen.getByText('No global magnetic field')).toBeInTheDocument();
    expect(screen.getByText(/Carbon dioxide \(CO₂\)/).closest('li')).toHaveTextContent('95.1%');
    expect(screen.getByText(/Showing 1 of/)).toHaveTextContent('Showing 1 of 1 approved features (≥ 100 km)');
    expect(screen.getByText('Mariner 4').closest('li')).toHaveTextContent('Launched 1964-11-28 · arrived 1965-07-14');
    expect(screen.getByText('Known since antiquity')).toBeInTheDocument();
    expect(screen.getByText('Olympus Mons').closest('li')).toHaveTextContent('Olympus Mons · Mons, montes · 624 km · 18.65° N, 226.2° E');
    expect(screen.getByText('Core').closest('li')).toHaveTextContent('radius 0–1,830 km');
    expect(screen.getByText('Core').closest('li')).toHaveTextContent('uncertain');
    expect(screen.getByText('Crust').closest('li')).toHaveTextContent('radius 3,339.5–3,389.5 km');
    expect(document.body.textContent).not.toMatch(/undefined|NaN/);
  });

  it('shows depths for depth-based layers, measured from the top layer outer radius', () => {
    const details = makeMarsDetails();
    details.interior!.layers[0]!.from = 'depth';
    show('mars', ready(details));
    expect(screen.getByText('Crust').closest('li')).toHaveTextContent('0–50 km deep');
  });

  it('shows the Jupiter dipole field and omits sections with no data', () => {
    show('jupiter', ready(makeJupiterDetails()));
    expect(screen.getByText('4.30 G·R³')).toBeInTheDocument();
    expect(screen.getByText(/9\.4°/)).toBeInTheDocument();
    expect(screen.getAllByText(/± 2\.0/, { selector: '.num' })).toHaveLength(2);
    expect(heading('Interior')).toBeNull();
    expect(heading('Named features')).toBeNull();
  });

  it('shows the Earth dipole pole', () => {
    const details = makeJupiterDetails();
    if (details.magnetosphere.kind === 'dipole') details.magnetosphere.dipolePole = { latDeg: 80.65, lonDegE: 287.32, sourceId: 'x' };
    show('earth', ready(details));
    expect(screen.getByText('80.65° N, 287.32° E')).toBeInTheDocument();
  });

  it('shows the Sun field note and no features, discovery or empty mission section', () => {
    show('sun', ready(makeSunDetails()));
    expect(screen.getByText(/reverses polarity/)).toBeInTheDocument();
    expect(heading('Named features')).toBeNull();
    expect(heading('Discovery')).toBeNull();
    expect(heading('Key missions')).toBeNull();
  });

  it('renders an atmosphere with only a basis and a note without empty lists', () => {
    const details = makeMarsDetails();
    details.atmosphere = { basis: 'Exosphere only', major: [], minor: [], note: { text: 'Extremely thin.', sourceId: 'n' } };
    show('mercury', ready(details));
    const section = heading('Atmosphere')!.closest('section')!;
    expect(section).toHaveTextContent('Exosphere only');
    expect(section).toHaveTextContent('Extremely thin.');
    expect(within(section).queryByRole('list')).toBeNull();
  });
});
