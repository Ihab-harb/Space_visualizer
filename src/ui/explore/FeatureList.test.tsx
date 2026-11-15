// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useExploreStore } from '../../state/exploreStore';
import { realCatalog, realDetails } from '../../test/realData';
import { FeatureList } from './FeatureList';
import { featureEntries } from './featureModel';

const catalog = realCatalog();

function show(bodyId: string, details = realDetails(bodyId)) {
  render(<FeatureList catalog={catalog} body={catalog.bodyById.get(bodyId)!} details={details} />);
}

beforeEach(() => useExploreStore.getState().enter('mars'));
afterEach(() => useExploreStore.getState().leave());

describe('FeatureList', () => {
  it('opens, lists 200 entries with landmarks first, and filters as you type', async () => {
    const total = featureEntries(realDetails('mars')).length;
    show('mars');
    const button = screen.getByRole('button', { name: `All features (${total}) · Search` });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const list = screen.getByRole('list', { name: 'Features' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Valles Marineris');
    expect(rows[0]).toHaveTextContent('Landmark');
    expect(rows).toHaveLength(total);
    expect(total).toBeGreaterThanOrEqual(200);
    expect(screen.getByRole('status')).toHaveTextContent(`${rows.length} of ${rows.length}`);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search features' }), 'pl');
    const filtered = within(screen.getByRole('list', { name: 'Features' })).getAllByRole('listitem');
    expect(filtered.length).toBeLessThan(rows.length);
    expect(filtered.every((li) => /pl/i.test(li.querySelector('.explore-features__name')!.textContent!))).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent(`${filtered.length} of ${rows.length}`);
  });

  it('shows "No features match"', async () => {
    show('mars');
    await userEvent.click(screen.getByRole('button', { name: /All features/ }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search features' }), 'zzzzqq');
    expect(screen.getByText('No features match')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Features' })).toBeNull();
  });

  it('is titled "Landmarks (N)" for Earth, which has landmarks and no Gazetteer list', async () => {
    show('earth');
    const button = screen.getByRole('button', { name: 'Landmarks (21)' });
    await userEvent.click(button);
    expect(within(screen.getByRole('list', { name: 'Features' })).getAllByRole('listitem')).toHaveLength(21);
  });

  it('has a search box only for more than ten entries', async () => {
    const d = realDetails('earth');
    show('earth', { ...d, landmarks: d.landmarks.slice(0, 10) });
    await userEvent.click(screen.getByRole('button', { name: 'Landmarks (10)' }));
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('10 of 10');
  });

  it('picking a row selects the feature', async () => {
    show('mars');
    await userEvent.click(screen.getByRole('button', { name: /All features/ }));
    await userEvent.click(screen.getByRole('button', { name: /Olympus Mons/ }));
    expect(useExploreStore.getState().selectedFeatureId).toBe('olympus-mons');
    expect(useExploreStore.getState().featureListOpen).toBe(true);
  });

  it('Esc in the search box closes the panel', async () => {
    show('mars');
    const button = screen.getByRole('button', { name: /All features/ });
    await userEvent.click(button);
    const input = screen.getByRole('searchbox', { name: 'Search features' });
    expect(input).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(useExploreStore.getState().featureListOpen).toBe(false);
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('renders no button for Jupiter', () => {
    show('jupiter');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
