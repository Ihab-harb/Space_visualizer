// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BodyDetails, InteriorLayer, SourcedRange } from '../core/details/schema';
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
    expect(screen.getByText('Core').closest('li')).toHaveTextContent('from radius 1,830 km to the centre');
    expect(screen.getByText('Core').closest('li')).toHaveTextContent('uncertain');
    expect(screen.getByText('Crust').closest('li')).toHaveTextContent('from radius 3,389.5 km to radius 3,339.5 km');
    expect(document.body.textContent).not.toMatch(/undefined|NaN/);
  });

  const bound = (min: number, max: number, from?: 'radius' | 'depth' | 'percent', stated?: { min: number; max: number }, radius = [min, max] as [number, number]): SourcedRange => ({
    min: radius[0], max: radius[1], sourceId: 'src', ...(from ? { from } : {}), ...(stated ? { stated } : {}),
  });
  const layer = (id: string, name: string, outer: SourcedRange, inner: SourcedRange, extra: Partial<InteriorLayer> = {}): InteriorLayer => ({
    id, name, outerRadiusKm: outer, innerRadiusKm: inner, from: 'radius', state: 'solid', composition: null, uncertain: false, ...extra,
  });
  const interiorRows = (layers: InteriorLayer[]) => {
    const details = makeMarsDetails();
    details.interior = { layers };
    show('mars', ready(details));
    return (name: string) => screen.getByText(name).closest('li')!;
  };

  it('shows each Interior bound in the form its source states it', () => {
    const row = interiorRows([
      layer('crust', 'Crust', bound(0, 0, 'depth', { min: 0, max: 0 }, [3389.5, 3389.5]), bound(0, 0, 'depth', { min: 10, max: 50 }, [3339.5, 3379.5]), { from: 'depth' }),
      layer('mantle', 'Mantle', bound(0, 0, 'depth', { min: 10, max: 50 }, [3339.5, 3379.5]), bound(0, 0, 'depth', { min: 1560, max: 1560 }, [1829.5, 1829.5]), { from: 'depth' }),
      layer('core', 'Core', bound(1500, 2100, 'radius'), bound(0, 0, 'radius'), { state: 'liquid', stateSourceId: 'insight' }),
    ]);
    expect(row('Crust')).toHaveTextContent('from the surface to 10–50 km deep');
    expect(row('Mantle')).toHaveTextContent('from 10–50 km deep to 1,560 km deep');
    expect(row('Core')).toHaveTextContent('from radius 1,500–2,100 km to the centre');
    expect(row('Core').textContent).toMatch(/liquid\[insight\]/);
    expect(row('Crust').textContent).not.toMatch(/3,3/);
  });

  it('shows the Sun layers as the percentages and depth the sources state, not derived kilometres', () => {
    const row = interiorRows([
      layer('convection-zone', 'Convection zone', bound(0, 0, 'depth', { min: 0, max: 0 }, [695700, 695700]), bound(0, 0, 'depth', { min: 200000, max: 200000 }, [495700, 495700]), { from: 'depth', state: 'plasma' }),
      layer('radiative-zone', 'Radiative zone', bound(0, 0, 'percent', { min: 71, max: 71 }, [493947, 493947]), bound(0, 0, 'percent', { min: 25, max: 25 }, [173925, 173925]), { from: 'percent', state: 'plasma' }),
      layer('core', 'Core', bound(0, 0, 'percent', { min: 25, max: 25 }, [173925, 173925]), bound(0, 0, 'percent', { min: 0, max: 0 }, [0, 0]), { from: 'percent', state: 'plasma' }),
    ]);
    expect(row('Convection zone')).toHaveTextContent('from the surface to 200,000 km deep');
    expect(row('Radiative zone')).toHaveTextContent('from 71 % to 25 % of the radius');
    expect(row('Core')).toHaveTextContent('from 25 % of the radius to the centre');
    expect(document.body.textContent).not.toMatch(/173,925|493,947/);
  });

  it("shows Earth's mantle as 30 km deep down to radius 3,485 km", () => {
    const row = interiorRows([
      layer('mantle', 'Mantle', bound(0, 0, 'depth', { min: 30, max: 30 }, [6341, 6341]), bound(3485, 3485, 'radius'), { from: 'depth' }),
    ]);
    expect(row('Mantle')).toHaveTextContent('from 30 km deep to radius 3,485 km');
    expect(row('Mantle').textContent).not.toMatch(/2,886/);
  });

  it('shows the Jupiter dipole field and omits sections with no data', () => {
    show('jupiter', ready(makeJupiterDetails()));
    expect(screen.getByText('4.3 G·R³')).toBeInTheDocument();
    expect(screen.getByText(/9\.4°/)).toBeInTheDocument();
    expect(screen.getAllByText(/± 2\.0/, { selector: '.num' })).toHaveLength(2);
    expect(heading('Interior')).toBeNull();
    expect(heading('Named features')).toBeNull();
  });

  it('never invents digits: a dipole of 0.002 reads 0.002 and ppm uncertainties are grouped without a decimal', () => {
    const details = makeJupiterDetails();
    if (details.magnetosphere.kind === 'dipole') details.magnetosphere.strengthGaussR3.value = 0.002;
    details.atmosphere = {
      basis: 'ppm', major: [], note: null,
      minor: [{ name: 'Methane', formula: 'CH4', amount: 3000, unit: 'ppm', uncertainty: 1000, sourceId: 'x' }, { name: 'Neon', formula: 'Ne', amount: 18, unit: 'ppm', uncertainty: 4, sourceId: 'x' }],
    };
    show('mercury', ready(details));
    expect(screen.getByText('0.002 G·R³')).toBeInTheDocument();
    expect(screen.getByText('3,000 ppm ± 1,000')).toBeInTheDocument();
    expect(screen.getByText('18 ppm ± 4')).toBeInTheDocument();
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

  it('renders an atmosphere with only a note without empty lists', () => {
    const details = makeMarsDetails();
    details.atmosphere = { basis: 'Exosphere only', major: [], minor: [], note: { text: 'Extremely thin.', sourceId: 'n' } };
    show('mercury', ready(details));
    const section = heading('Atmosphere')!.closest('section')!;
    expect(section).toHaveTextContent('Extremely thin.');
    expect(within(section).queryByRole('list')).toBeNull();
  });

  it('prints no column-abundance basis line when an atmosphere has no gases, but keeps the cited note', () => {
    const details = makeMarsDetails();
    details.atmosphere = { basis: 'Column abundances in 10⁶ per cm²', major: [], minor: [], note: { text: 'A surface bounded exosphere.', sourceId: 'n' } };
    show('mercury', ready(details));
    const section = heading('Atmosphere')!.closest('section')!;
    expect(section).not.toHaveTextContent('Column abundances');
    expect(section).toHaveTextContent('A surface bounded exosphere.');
    expect(section).toHaveTextContent('[n]');
  });

  it('states the discovery without an unquoted method', () => {
    const details = makeMarsDetails();
    details.discovery = { kind: 'discovered', by: 'William Herschel', date: '1781-03-13', method: 'telescope', sourceId: 'd' };
    show('mars', ready(details));
    expect(screen.getByText(/Discovered by/).closest('p')).toHaveTextContent(/^Discovered by William Herschel on 1781-03-13\[d\]$/);
  });

  it('heads a Moon exosphere "Exosphere" and prints number densities per cm³ as upper limits, with the caveat', () => {
    const details = makeMarsDetails();
    details.atmosphere = {
      basis: 'night, particles per cubic cm', kind: 'exosphere', major: [], minor: [],
      numberDensity: [
        { name: 'Helium 4', formula: '⁴He', amount: 40000, unit: 'cm⁻³', upperLimit: true, sourceId: 'nssdca-moon-fact-sheet' },
        { name: 'Hydrogen', formula: 'H2', amount: 35000, unit: 'cm⁻³', upperLimit: true, sourceId: 'nssdca-moon-fact-sheet' },
      ],
      note: { text: 'Composition of the tenuous lunar atmosphere is poorly known and variable.', sourceId: 'nssdca-moon-fact-sheet' },
    };
    show('moon', ready(details));
    expect(heading('Exosphere')).toBeInTheDocument();
    expect(heading('Atmosphere')).toBeNull();
    const section = heading('Exosphere')!.closest('section')!;
    expect(section).toHaveTextContent('Helium 4');
    expect(screen.getByText(/Helium 4/).closest('li')).toHaveTextContent('40,000 per cm³ (upper limit)');
    expect(screen.getByText(/Hydrogen/).closest('li')).toHaveTextContent('Hydrogen (H₂)');
    expect(section).toHaveTextContent('poorly known and variable');
    expect(section).toHaveTextContent('[nssdca-moon-fact-sheet]');
    expect(section).toHaveTextContent('night, particles per cubic cm');
  });
});
