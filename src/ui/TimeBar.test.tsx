// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { calendarToJd } from '../core/time/julian';
import { utcToTdb } from '../core/time/timescales';
import { useTimeStore } from '../state/timeStore';
import { makeCatalogFiles } from '../test/fixtures';
import { TimeBar } from './TimeBar';

const files = makeCatalogFiles();
const catalog = createCatalog(files.regions, files.sources, [files.bodies]);
const J2000_UTC_TDB = utcToTdb(2451545.0);

beforeEach(() => useTimeStore.setState({ jdTdb: J2000_UTC_TDB, playing: true, rateIndex: 0, direction: 1 }));

describe('TimeBar', () => {
  it('shows the simulation date in UTC and no warning inside 1800-2050', () => {
    render(<TimeBar catalog={catalog} />);
    expect(screen.getByLabelText('Simulation date')).toHaveTextContent('1 Jan 2000, 12:00:00 UTC');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('toggles play/pause and reverse', async () => {
    const user = userEvent.setup();
    render(<TimeBar catalog={catalog} />);
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(useTimeStore.getState().playing).toBe(false);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reverse' }));
    expect(useTimeStore.getState().direction).toBe(-1);
    expect(screen.getByRole('button', { name: 'Reverse' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('changes speed', async () => {
    const user = userEvent.setup();
    render(<TimeBar catalog={catalog} />);
    await user.selectOptions(screen.getByLabelText('Speed'), '1 day/s');
    expect(useTimeStore.getState().rateIndex).toBe(3);
  });

  it('jumps to a typed date and warns about lower accuracy before 1800', async () => {
    const user = userEvent.setup();
    render(<TimeBar catalog={catalog} />);
    await user.type(screen.getByLabelText('Go to date (UTC)'), '1500-01-01{Enter}');
    expect(useTimeStore.getState().jdTdb).toBeCloseTo(utcToTdb(calendarToJd({ year: 1500, month: 1, day: 1, hour: 0, minute: 0, second: 0 })), 9);
    expect(screen.getByLabelText('Simulation date')).toHaveTextContent('1 Jan 1500, 00:00:00 UT');
    expect(screen.getByRole('status')).toHaveTextContent('Outside 1800–2050');
  });

  it('rejects an invalid date and leaves time unchanged', async () => {
    const user = userEvent.setup();
    render(<TimeBar catalog={catalog} />);
    await user.type(screen.getByLabelText('Go to date (UTC)'), '2026-02-30{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('That date does not exist in the calendar.');
    expect(useTimeStore.getState().jdTdb).toBe(J2000_UTC_TDB);
  });

  it('says positions are extrapolated far outside every model range', () => {
    useTimeStore.setState({ jdTdb: utcToTdb(calendarToJd({ year: 9999, month: 1, day: 1, hour: 0, minute: 0, second: 0 })) });
    render(<TimeBar catalog={catalog} />);
    expect(screen.getByRole('status')).toHaveTextContent('extrapolated');
  });
});
