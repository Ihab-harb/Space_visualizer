// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDetailsStore } from '../../state/detailsStore';
import { useExploreStore } from '../../state/exploreStore';
import { useSelectionStore } from '../../state/selectionStore';
import { realCatalog, realDetails } from '../../test/realData';
import { createPinBridge, FeaturePins, type PinBridge } from './FeaturePins';

const catalog = realCatalog();

function setWidth(narrow: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: narrow && query.includes('max-width'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function explore(bodyId: string) {
  useDetailsStore.setState({ entries: { [bodyId]: { status: 'ready', details: realDetails(bodyId) } } });
  useSelectionStore.setState({ selectedId: bodyId });
  act(() => useExploreStore.getState().enter(bodyId));
}

const pins = () => screen.queryAllByRole('button', { hidden: true });

/** What the projector does for pins on the facing side: shows the root and the dots. */
function project(bridge: PinBridge) {
  if (bridge.root) bridge.root.style.visibility = 'visible';
  for (const it of bridge.items.values()) if (it.dot) it.dot.hidden = false;
}

describe('FeaturePins', () => {
  beforeEach(() => {
    setWidth(false);
    useExploreStore.getState().leave();
  });
  afterEach(() => act(() => useExploreStore.getState().leave()));

  it('renders one button per landmark, named after it, in rank order', () => {
    explore('mars');
    render(<FeaturePins bridge={createPinBridge()} catalog={catalog} />);
    const landmarks = realDetails('mars').landmarks;
    expect(pins().map((b) => b.getAttribute('aria-label'))).toEqual(landmarks.map((l) => l.name));
    expect(pins().every((b) => b.classList.contains('xpin'))).toBe(true);
  });

  it('a click on a dot or on a name selects the feature', () => {
    explore('mars');
    const bridge = createPinBridge();
    const { container } = render(<FeaturePins bridge={bridge} catalog={catalog} />);
    project(bridge);
    fireEvent.click(screen.getByRole('button', { name: 'Olympus Mons' }));
    expect(useExploreStore.getState().selectedFeatureId).toBe('olympus-mons');
    const name = [...container.querySelectorAll('.xpin-name')].find((el) => el.textContent === 'Gale')!;
    fireEvent.click(name);
    expect(useExploreStore.getState().selectedFeatureId).toBe('gale');
  });

  it('adds a temporary pin for a selected feature that is not a landmark, and removes it when the selection clears', () => {
    explore('mars');
    const details = realDetails('mars');
    const landmarkIds = new Set(details.landmarks.map((l) => l.id));
    const other = details.features!.items.find((f) => !landmarkIds.has(f.id))!;
    render(<FeaturePins bridge={createPinBridge()} catalog={catalog} />);
    act(() => useExploreStore.getState().selectFeature(other.id));
    expect(pins()).toHaveLength(details.landmarks.length + 1);
    expect(pins().at(-1)).toHaveAttribute('aria-label', other.name);
    expect(pins().at(-1)).toHaveAttribute('aria-pressed', 'true');
    act(() => useExploreStore.getState().selectFeature(null));
    expect(pins()).toHaveLength(details.landmarks.length);
    expect(screen.queryByRole('button', { name: other.name, hidden: true })).toBeNull();
  });

  it('marks the selected pin pressed', () => {
    explore('mars');
    const bridge = createPinBridge();
    render(<FeaturePins bridge={bridge} catalog={catalog} />);
    act(() => useExploreStore.getState().selectFeature('valles-marineris'));
    project(bridge);
    expect(screen.getByRole('button', { name: 'Valles Marineris' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Olympus Mons' })).toHaveAttribute('aria-pressed', 'false');
    expect(pins().filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
  });

  it('shows numbers and no names at phone width', () => {
    setWidth(true);
    explore('mars');
    const bridge = createPinBridge();
    const { container } = render(<FeaturePins bridge={bridge} catalog={catalog} />);
    project(bridge);
    const landmarks = realDetails('mars').landmarks;
    expect(pins().map((b) => b.textContent)).toEqual(landmarks.map((_, i) => String(i + 1)));
    expect(pins()[0]).toHaveAccessibleName(`1 ${landmarks[0]!.name}`);
    expect(container.querySelectorAll('.xpin-name')).toHaveLength(0);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders nothing for a body with no landmarks and no selected feature', () => {
    explore('jupiter');
    const { container } = render(<FeaturePins bridge={createPinBridge()} catalog={catalog} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing outside Explore', () => {
    useDetailsStore.setState({ entries: { mars: { status: 'ready', details: realDetails('mars') } } });
    const { container } = render(<FeaturePins bridge={createPinBridge()} catalog={catalog} />);
    expect(container).toBeEmptyDOMElement();
  });
});
