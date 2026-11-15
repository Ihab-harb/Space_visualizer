// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { realCatalog, realDetails } from '../../test/realData';
import { citationModel } from '../citations';
import { FeatureCard, NAMES_DATABASE_NOTE } from './FeatureCard';
import { featureEntry } from './featureModel';

const catalog = realCatalog();

function show(bodyId: string, featureId: string, onClose = vi.fn()) {
  const body = catalog.bodyById.get(bodyId)!;
  const details = realDetails(bodyId);
  render(<FeatureCard catalog={catalog} body={body} details={details} featureId={featureId} onClose={onClose} />);
  const entry = featureEntry(details, featureId)!;
  const numbers = citationModel(catalog, body, details).numbers;
  return { body, details, entry, numbers, onClose, card: screen.getByRole('region', { name: entry.name }) };
}

describe('FeatureCard', () => {
  it('shows the quote, size, position, name origin and approval year of a landmark, each with its source number', () => {
    const { card, entry, numbers } = show('mars', 'valles-marineris');
    const n = (id: string) => numbers.get(id)!;
    expect(card).toHaveTextContent('Landmark');
    expect(card).toHaveTextContent('“A vast canyon system called Valles Marineris is long enough to stretch from California to New York”');
    expect(card).toHaveTextContent('3,761 km');
    expect(card).toHaveTextContent('14.0° S, 301.4° E');
    expect(card).toHaveTextContent('Named forGeneral name of the system of canyons honoring the scientific team of the Mariner 9 program.');
    expect(card).toHaveTextContent('Name approved1973');
    const rows = (label: string) => within(card).getByText(label, { selector: 'dt' }).parentElement!;
    expect(within(rows('Size')).getByRole('link', { name: `Source ${n('usgs-gazetteer-mars')}` })).toBeInTheDocument();
    expect(within(rows('Position')).getByRole('link', { name: `Source ${n(entry.positionSourceId)}` })).toBeInTheDocument();
    expect(within(rows('Named for')).getByRole('link', { name: `Source ${n('usgs-gazetteer-mars')}` })).toBeInTheDocument();
    expect(within(rows('Name approved')).getByRole('link', { name: `Source ${n('usgs-gazetteer-mars')}` })).toBeInTheDocument();
    const quote = card.querySelector('.explore-card__quote')!;
    expect(within(quote as HTMLElement).getByRole('link', { name: `Source ${n('nasa-science-mars-facts')}` })).toBeInTheDocument();
    expect(card).not.toHaveTextContent(NAMES_DATABASE_NOTE);
  });

  it('shows no quote for a plain feature', () => {
    const d = realDetails('mars');
    const plain = d.features!.items.find((f) => !d.landmarks.some((l) => l.id === f.id))!;
    const { card } = show('mars', plain.id);
    expect(card).not.toHaveTextContent('Landmark');
    expect(card.querySelector('.explore-card__quote')).toBeNull();
    expect(card).toHaveTextContent(plain.name);
  });

  it('shows only what its sources state for an Earth landmark, with the names-database line', () => {
    const { card, entry } = show('earth', 'grand-canyon');
    expect(card).toHaveTextContent(entry.positionText);
    expect(card).toHaveTextContent(NAMES_DATABASE_NOTE);
    expect(within(card).queryByText('Size', { selector: 'dt' })).toBeNull();
    expect(within(card).queryByText('Named for', { selector: 'dt' })).toBeNull();
    expect(within(card).queryByText('Name approved', { selector: 'dt' })).toBeNull();
    expect(card).toHaveTextContent('Canyon');
    expect(card).toHaveTextContent('The Grand Canyon has become a geologic icon');
  });

  it('shows the Latin type with its meaning, and the type alone when no meaning is in the data', () => {
    expect(show('mars', 'olympus-mons').card).toHaveTextContent('Mons · Mountain');
  });

  it('shows "Crater", "Satellite Feature" and "Astronaut-named features" as they are', () => {
    const d = realDetails('moon');
    const item = (id: string, type: string) => ({ id, name: id, type, latDeg: 1, lonDegE: 2, diameterKm: 3, origin: 'Test', approvedYear: 1970 });
    const withTypes = { ...d, features: { ...d.features!, items: [...d.features!.items, item('sat-a', 'Satellite Feature'), item('astro-b', 'Astronaut-named features')] } };
    const body = catalog.bodyById.get('moon')!;
    const kicker = (id: string) => {
      const { unmount } = render(<FeatureCard catalog={catalog} body={body} details={withTypes} featureId={id} onClose={vi.fn()} />);
      const text = screen.getByRole('region', { name: id }).querySelector('.explore-kicker')!.textContent;
      unmount();
      return text;
    };
    expect(kicker('sat-a')).toMatch(/^Satellite Feature\[\d+\]$/);
    expect(kicker('astro-b')).toMatch(/^Astronaut-named features\[\d+\]$/);
    expect(show('moon', 'tycho').card.querySelector('.explore-kicker')).toHaveTextContent(/^Crater\[\d+\] · Landmark$/);
  });

  it('shows a names-database type as the record class, cited to the names database', () => {
    const { card, numbers } = show('earth', 'grand-canyon');
    const kicker = card.querySelector('.explore-kicker') as HTMLElement;
    expect(kicker).toHaveTextContent(/^Valley\[\d+\] · Landmark$/);
    expect(within(kicker).getByRole('link', { name: `Source ${numbers.get('usgs-gnis')}` })).toBeInTheDocument();
  });

  it('shows a quoted-position landmark curated type with no source number', () => {
    const d = realDetails('earth');
    const g = d.landmarks[0]!;
    const quoted = { ...d, landmarks: [{ ...g, type: 'Canyon', position: { kind: 'quoted' as const, sourceId: g.quote.sourceId, text: '36.1 N, 114.0 W' } }, ...d.landmarks.slice(1)] };
    render(<FeatureCard catalog={catalog} body={catalog.bodyById.get('earth')!} details={quoted} featureId="grand-canyon" onClose={vi.fn()} />);
    const kicker = screen.getByRole('region', { name: 'Grand Canyon' }).querySelector('.explore-kicker') as HTMLElement;
    expect(kicker.textContent).toBe('Canyon · Landmark');
    expect(within(kicker).queryByRole('link')).toBeNull();
  });

  it('shows a quote tidied of a stray space before a comma, leaving the stored text alone', () => {
    const d = realDetails('mars');
    const l = d.landmarks[0]!;
    const spaced = { ...d, landmarks: [{ ...l, quote: { ...l.quote, text: 'A vast canyon , long as a country .' } }, ...d.landmarks.slice(1)] };
    render(<FeatureCard catalog={catalog} body={catalog.bodyById.get('mars')!} details={spaced} featureId={l.id} onClose={vi.fn()} />);
    expect(screen.getByRole('region', { name: l.name }).querySelector('.explore-card__quote')).toHaveTextContent('“A vast canyon, long as a country.”');
    expect(spaced.landmarks[0]!.quote.text).toBe('A vast canyon , long as a country .');
  });

  it('lists and links its sources with the shared citation numbers', () => {
    const { card, numbers } = show('mars', 'olympus-mons');
    const list = within(card).getByRole('list', { name: 'Sources' });
    const items = within(list).getAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(3);
    const n = numbers.get('nasa-science-mars-facts')!;
    expect(items.some((li) => li.textContent?.startsWith(`[${n}]`))).toBe(true);
    const cite = within(card).getAllByRole('link', { name: `Source ${n}` })[0]!;
    expect(cite).toHaveAttribute('href', '#feature-source-nasa-science-mars-facts');
    expect(list.querySelector('#feature-source-nasa-science-mars-facts')).not.toBeNull();
  });

  it('closes with its ✕', async () => {
    const { onClose } = show('mars', 'olympus-mons');
    await userEvent.click(screen.getByRole('button', { name: 'Close feature card' }));
    expect(onClose).toHaveBeenCalled();
  });
});
