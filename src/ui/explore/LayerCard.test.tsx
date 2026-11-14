// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { drawnLayers } from '../../core/interior/geometry';
import { interiorRadiusKm } from '../../scene/interior/useExploreTransition';
import { realCatalog, realDetails } from '../../test/realData';
import { citationModel } from '../citations';
import { LayerCard } from './LayerCard';

const catalog = realCatalog();

function show(bodyId: string, layerId: string, onClose = vi.fn()) {
  const body = catalog.bodyById.get(bodyId)!;
  const details = realDetails(bodyId);
  const drawn = drawnLayers(details.interior!.layers, interiorRadiusKm(body));
  render(<LayerCard catalog={catalog} body={body} details={details} layerId={layerId} drawn={drawn} onClose={onClose} />);
  return { body, details, onClose, card: screen.getByRole('region', { name: details.interior!.layers.find((l) => l.id === layerId)!.name }) };
}

describe('LayerCard', () => {
  it('shows "Estimate" and the paper note for an estimate layer (Venus crust)', () => {
    const { card } = show('venus', 'crust');
    expect(within(card).getByText('Estimate', { selector: '.tag' })).toBeInTheDocument();
    expect(card).toHaveTextContent('from the surface to about 20 km deep (global average)');
    expect(card).toHaveTextContent('peer-reviewed research paper');
    expect(within(card).queryByText('Illustrative size', { selector: '.tag' })).toBeNull();
  });

  it('shows no "Estimate" for a cited layer, and the thicker-than-scale note for the Earth crust', () => {
    const { card } = show('earth', 'crust');
    expect(within(card).queryByText('Estimate', { selector: '.tag' })).toBeNull();
    expect(card).toHaveTextContent('from the surface to 30 km deep');
    expect(card).toHaveTextContent('Drawn thicker than scale');
    expect(within(card).getByText(/Illustrative colours/)).toBeInTheDocument();
  });

  it('shows "Illustrative size" and no number for an illustrative layer (Jupiter envelope)', () => {
    const { card } = show('jupiter', 'envelope');
    expect(within(card).getByText('Illustrative size', { selector: '.tag' })).toBeInTheDocument();
    expect(card).not.toHaveTextContent(/\d+ km/);
    expect(card).toHaveTextContent('Mostly hydrogen and helium.');
  });

  it('cites every value with the shared numbering and lists the sources', () => {
    const { body, details, card } = show('earth', 'outer-core');
    const { numbers } = citationModel(catalog, body, details);
    const n = numbers.get('nssdca-earth-fact-sheet')!;
    expect(within(card).getAllByRole('link', { name: `Source ${n}` }).length).toBeGreaterThan(0);
    const sources = within(card).getByRole('list', { name: 'Sources' });
    expect(within(sources).getByText(/Earth Fact Sheet/)).toBeInTheDocument();
    expect(within(sources).getAllByRole('listitem')[0]).toHaveTextContent(`[${numbers.get('nssdca-earth-fact-sheet')}]`);
    expect(card).toHaveTextContent('liquid');
    expect(card).toHaveTextContent('Iron and nickel fluids.');
  });

  it('marks an uncertain layer and a range drawn as a soft band (Mars core)', () => {
    const { card } = show('mars', 'core');
    expect(within(card).getByText('Uncertain', { selector: '.tag' })).toBeInTheDocument();
    expect(card).toHaveTextContent('from radius 1,500–2,100 km to the centre');
    expect(card).toHaveTextContent('soft band');
  });

  it('says a gradual core has no sharp edge, cites the sentence, and calls the soft edge illustrative (Jupiter, Saturn)', () => {
    const { body, details, card } = show('jupiter', 'dilute-core');
    const n = citationModel(catalog, body, details).numbers.get('nasa-science-jupiter-facts')!;
    const note = within(card).getByText(/No sharp edge/);
    expect(note).toHaveTextContent('the source describes a gradual change into the layer above');
    expect(note).toHaveTextContent('The soft edge is illustrative');
    expect(within(note).getByRole('link', { name: `Source ${n}` })).toBeInTheDocument();
    expect(card).not.toHaveTextContent('The source gives a range');
  });

  it('notes the soft lower edge on the layer above a gradual core, and no range note there', () => {
    const { card } = show('saturn', 'metallic-hydrogen');
    expect(card).toHaveTextContent('No sharp lower edge: the source describes a gradual change into the diffuse core below');
    expect(card).toHaveTextContent('The soft edge is illustrative');
    expect(card).not.toHaveTextContent('The source gives a range');
    // Saturn's sentence is the paper's: the card says so.
    expect(card).toHaveTextContent('This comes from a peer-reviewed research paper (an estimate).');
  });

  it('does not call an official gradual sentence an estimate (Jupiter: the sentence is NASA\'s)', () => {
    const { card } = show('jupiter', 'metallic-hydrogen');
    expect(card).toHaveTextContent('No sharp lower edge');
    expect(card).not.toHaveTextContent('research paper');
  });

  it('closes with its ✕', async () => {
    const { onClose } = show('earth', 'mantle');
    await userEvent.click(screen.getByRole('button', { name: 'Close layer card' }));
    expect(onClose).toHaveBeenCalled();
  });
});
