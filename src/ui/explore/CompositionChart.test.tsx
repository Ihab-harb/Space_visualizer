// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCatalog } from '../../core/catalog/catalog';
import type { RegionsFile } from '../../core/catalog/schema';
import type { BodyDetails } from '../../core/details/schema';
import { makeCatalogFiles, makeEarth } from '../../test/fixtures';
import { CompositionChart } from './CompositionChart';

const files = makeCatalogFiles();
const sources = [
  ...files.sources.sources,
  { id: 'nssdca-earth-fact-sheet', title: 'Earth Fact Sheet', publisher: 'NASA NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html', retrievedAt: '2026-10-04', license: 'NASA public domain' },
  { id: 'nssdca-moon-fact-sheet', title: 'Moon Fact Sheet', publisher: 'NASA NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html', retrievedAt: '2026-10-04', license: 'NASA public domain' },
  { id: 'nssdca-mercury-fact-sheet', title: 'Mercury Fact Sheet', publisher: 'NASA NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html', retrievedAt: '2026-10-04', license: 'NASA public domain' },
];
const catalog = createCatalog(files.regions as RegionsFile, { schemaVersion: 1, sources }, [files.bodies]);
const earth = catalog.bodyById.get('earth') ?? makeEarth();
const real = (id: string): BodyDetails => JSON.parse(readFileSync(`public/data/solar-system/details/${id}.json`, 'utf8')) as BodyDetails;

describe('CompositionChart', () => {
  it('draws a titled chart with one cited bar per gas', () => {
    render(<CompositionChart catalog={catalog} body={earth} details={real('earth')} />);
    expect(screen.getByRole('heading', { name: 'Atmosphere · by volume, dry air' })).toBeInTheDocument();
    const svg = screen.getByRole('group', { name: /Atmosphere/ });
    expect(within(svg).getAllByRole('listitem')).toHaveLength(9);
    expect(within(svg).getAllByRole('link', { name: /^Source \d+$/ })).toHaveLength(9);
    expect(within(svg).getAllByText(/^\[\d+\]$/)).toHaveLength(9);
    expect(within(svg).getByText('78.08 %')).toBeInTheDocument();
    expect(within(svg).getByText('420 ppm')).toBeInTheDocument();
    expect(within(svg).getByText('1,000,000')).toBeInTheDocument();
  });

  it('toggles to a real table with the same rows', async () => {
    render(<CompositionChart catalog={catalog} body={earth} details={real('earth')} />);
    const toggle = screen.getByRole('button', { name: 'Table' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(10); // header + 9
    const row = within(table).getByText('Nitrogen').closest('tr')!;
    expect(row).toHaveTextContent('N₂');
    expect(row).toHaveTextContent('78.08 %');
    expect(within(row).getByRole('link', { name: /^Source \d+$/ })).toBeInTheDocument();
  });

  it('shows a tooltip with name, value and source title on focus', async () => {
    render(<CompositionChart catalog={catalog} body={earth} details={real('earth')} />);
    expect(screen.queryByRole('tooltip')).toBeNull();
    screen.getAllByRole('listitem')[0]!.focus();
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('Nitrogen');
    expect(tip).toHaveTextContent('78.08 %');
    expect(tip).toHaveTextContent('Earth Fact Sheet');
  });

  it('marks Moon bars as upper limits on a per cm³ chart', () => {
    render(<CompositionChart catalog={catalog} body={catalog.bodyById.get('moon') ?? makeEarth()} details={real('moon')} />);
    expect(screen.getByRole('heading', { name: 'Exosphere · particles per cm³ (upper limits)' })).toBeInTheDocument();
    expect(screen.getAllByText('40,000 per cm³').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/upper limit/i).length).toBeGreaterThan(0);
  });

  it('shows the cited note instead of a chart for a note-only body', () => {
    render(<CompositionChart catalog={catalog} body={earth} details={real('mercury')} />);
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.getByText(/surface bounded exosphere/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Source \d+$/ })).toBeInTheDocument();
  });

  it('says No atmosphere when there is none', () => {
    render(<CompositionChart catalog={catalog} body={earth} details={{ ...real('earth'), atmosphere: null }} />);
    expect(screen.getByText('No atmosphere')).toBeInTheDocument();
  });
});
