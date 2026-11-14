// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { calendarToJd } from '../core/time/julian';
import { utcToTdb } from '../core/time/timescales';
import { useSkyStore } from '../state/skyStore';
import { useTimeStore } from '../state/timeStore';
import { useTourStore } from '../state/tourStore';
import { makeCatalogFiles } from '../test/fixtures';
import { BottomBar } from './BottomBar';
import { timelineRangeTdb } from './timeline';

const files = makeCatalogFiles();
const catalog = createCatalog(files.regions, files.sources, [files.bodies]);
const J2000_UTC_TDB = utcToTdb(2451545.0);

beforeEach(() => useTimeStore.setState({ jdTdb: J2000_UTC_TDB, playing: true, rateIndex: 0, direction: 1 }));

describe('BottomBar', () => {
  it('shows the simulation date in UTC and no warning inside 1800-2050', () => {
    render(<BottomBar catalog={catalog} />);
    expect(screen.getByLabelText('Simulation date')).toHaveTextContent('1 Jan 2000, 12:00:00 UTC');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('toggles play/pause and reverse', async () => {
    const user = userEvent.setup();
    render(<BottomBar catalog={catalog} />);
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(useTimeStore.getState().playing).toBe(false);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reverse' }));
    expect(useTimeStore.getState().direction).toBe(-1);
    expect(screen.getByRole('button', { name: 'Reverse' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('changes speed', async () => {
    const user = userEvent.setup();
    render(<BottomBar catalog={catalog} />);
    await user.selectOptions(screen.getByLabelText('Speed'), '1 day/s');
    expect(useTimeStore.getState().rateIndex).toBe(3);
  });

  it('jumps to a typed date and warns about lower accuracy before 1800', async () => {
    const user = userEvent.setup();
    render(<BottomBar catalog={catalog} />);
    await user.type(screen.getByLabelText('Go to date (UTC)'), '1500-01-01{Enter}');
    expect(useTimeStore.getState().jdTdb).toBeCloseTo(utcToTdb(calendarToJd({ year: 1500, month: 1, day: 1, hour: 0, minute: 0, second: 0 })), 9);
    expect(screen.getByLabelText('Simulation date')).toHaveTextContent('1 Jan 1500, 00:00:00 UT');
    expect(screen.getByRole('status')).toHaveTextContent('Outside 1800–2050');
  });

  it('rejects an invalid date and leaves time unchanged', async () => {
    const user = userEvent.setup();
    render(<BottomBar catalog={catalog} />);
    await user.type(screen.getByLabelText('Go to date (UTC)'), '2026-02-30{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('That date does not exist in the calendar.');
    expect(useTimeStore.getState().jdTdb).toBe(J2000_UTC_TDB);
  });

  it('says positions are extrapolated far outside every model range', () => {
    useTimeStore.setState({ jdTdb: utcToTdb(calendarToJd({ year: 9999, month: 1, day: 1, hour: 0, minute: 0, second: 0 })) });
    render(<BottomBar catalog={catalog} />);
    expect(screen.getByRole('status')).toHaveTextContent('extrapolated');
  });

  it('moves through time with the timeline without changing play state', () => {
    useTimeStore.setState({ jdTdb: 2451545, playing: false });
    render(<BottomBar catalog={catalog} />);
    const slider = screen.getByRole('slider', { name: 'Timeline 1800–2050' });
    fireEvent.change(slider, { target: { value: '0' } });
    expect(useTimeStore.getState().jdTdb).toBeCloseTo(timelineRangeTdb().start, 6);
    expect(useTimeStore.getState().playing).toBe(false);
  });

  it('toggles the tour', async () => {
    useTourStore.setState({ active: false, seq: 0 });
    render(<BottomBar catalog={catalog} />);
    await userEvent.click(screen.getByRole('button', { name: /Tour/ }));
    expect(useTourStore.getState().active).toBe(true);
  });

  it('credits the sky imagery', () => {
    useSkyStore.setState({ ref: { tiers: { '2k': 'x' }, sourceId: 'nasa-svs-deep-star-maps' }, status: 'ready' });
    render(<BottomBar catalog={catalog} />);
    expect(screen.getByText(/Sky:/)).toBeInTheDocument();
  });
});
