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

  it('shows "Crater" and "Satellite Feature" as they are', () => {
    const { card } = show('moon', 'tycho');
    expect(card.querySelector('.explore-kicker')).toHaveTextContent(/^Crater\[\d+\] · Landmark$/);
    const d = realDetails('moon');
    const sat = d.features!.items.find((f) => f.type === 'Satellite Feature');
    if (sat) {
      document.body.innerHTML = '';
      const { card: c2 } = show('moon', sat.id);
      expect(c2.querySelector('.explore-kicker')).toHaveTextContent(/^Satellite Feature\[\d+\]$/);
    }
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
