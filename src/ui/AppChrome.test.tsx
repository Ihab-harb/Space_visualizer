// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { useExploreStore } from '../state/exploreStore';
import { useSelectionStore } from '../state/selectionStore';
import { makeCatalogFiles } from '../test/fixtures';
import { AppChrome } from './AppChrome';

const f = makeCatalogFiles();
const catalog = createCatalog(f.regions, f.sources, [f.bodies]);

describe('AppChrome', () => {
  beforeEach(() => {
    useExploreStore.getState().leave();
    useSelectionStore.setState({ selectedId: 'jupiter' });
  });
  it('shows the header, controls, drawer and time bar, and none of them while Explore is active', () => {
    render(<AppChrome catalog={catalog} />);
    const names = ['Selected body', 'Controls', 'Body information', 'Time controls'];
    for (const n of names) expect(document.querySelector(`[aria-label="${n}"]`), n).not.toBeNull();
    act(() => useExploreStore.getState().enter('jupiter'));
    for (const n of names) expect(document.querySelector(`[aria-label="${n}"]`), n).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
    act(() => useExploreStore.getState().leave());
    for (const n of names) expect(document.querySelector(`[aria-label="${n}"]`), n).not.toBeNull();
  });
});
