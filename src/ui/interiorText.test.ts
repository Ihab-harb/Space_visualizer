import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BodyDetails } from '../core/details/schema';
import { drawnLayers } from '../core/interior/geometry';
import { interiorNotes, layerExtent, layerLabelText } from './interiorText';

const real = (id: string): BodyDetails => JSON.parse(readFileSync(`public/data/solar-system/details/${id}.json`, 'utf8')) as BodyDetails;
const layersOf = (id: string) => real(id).interior!.layers;
const labels = (id: string) => {
  const layers = layersOf(id);
  return layers.map((l, i) => layerLabelText(id, l, i === layers.length - 1));
};

describe('layerLabelText', () => {
  it('Earth: name, state where stated, the inner bound as the source states it, its source', () => {
    const [crust, mantle, outer, inner] = labels('earth');
    expect(crust).toEqual({ name: 'Crust', state: 'solid', stateSourceId: undefined, bound: 'to 30 km deep', boundSourceId: 'nasa-science-earth', tag: null });
    expect(mantle!.state).toBeNull(); // 'unknown' is not shown
    expect(mantle!.bound).toBe('to 3,485 km radius');
    expect(mantle!.boundSourceId).toBe('nssdca-earth-fact-sheet');
    expect(outer!.bound).toBe('to 1,221 km radius');
    expect(outer!.state).toBe('liquid');
    // The innermost layer shows its outer bound.
    expect(inner!.bound).toBe('1,221 km radius');
  });

  it('keeps ranges and percent forms (Mars, the Sun)', () => {
    expect(labels('mars').map((l) => l.bound)).toEqual(['to 10–50 km deep', 'to 1,560 km deep', '1,500–2,100 km radius']);
    expect(labels('sun').map((l) => l.bound)).toEqual(['to 200,000 km deep', 'to 25 % of the radius', '25 % of the radius']);
  });

  it('Saturn: the core reads "about 60 %" (source: "approximately 60%") and is tagged Estimate', () => {
    const [envelope, metallic, core] = labels('saturn');
    expect(core!.bound).toBe('about 60 % of the radius');
    expect(core!.tag).toBe('Estimate');
    expect(envelope!.bound).toBeNull();
    expect(envelope!.tag).toBe('Illustrative size');
    expect(metallic!.tag).toBe('Illustrative size');
  });

  it('Venus: the crust reads as a global average estimate', () => {
    const [crust, mantle, core] = labels('venus');
    expect(crust!.bound).toBe('to about 20 km deep (global average)');
    expect(crust!.tag).toBe('Estimate');
    expect(mantle!.bound).toBe('to 2,930–4,350 km radius');
    expect(core!.bound).toBe('2,930–4,350 km radius');
  });

  it('a stated state carries its own source (Jupiter metallic hydrogen)', () => {
    const metallic = labels('jupiter')[1]!;
    expect(metallic.state).toBe('liquid');
    expect(metallic.stateSourceId).toBe('nasa-science-jupiter-facts');
    expect(metallic.bound).toBeNull();
    expect(metallic.tag).toBe('Illustrative size');
  });
});

describe('layerExtent (drawer and layer card)', () => {
  it('writes the bounds as the source states them, with the carried wording', () => {
    const earth = layersOf('earth');
    expect(layerExtent('earth', earth[0]!)).toBe('from the surface to 30 km deep');
    expect(layerExtent('earth', earth[2]!)).toBe('from radius 3,485 km to radius 1,221 km');
    expect(layerExtent('saturn', layersOf('saturn')[2]!)).toBe('from about 60 % of the radius to the centre');
    expect(layerExtent('venus', layersOf('venus')[0]!)).toBe('from the surface to about 20 km deep (global average)');
    expect(layerExtent('venus', layersOf('venus')[1]!)).toBe('from about 20 km deep (global average) to radius 2,930–4,350 km');
    expect(layerExtent('sun', layersOf('sun')[1]!)).toBe('from 71 % to 25 % of the radius');
    expect(layerExtent('jupiter', layersOf('jupiter')[0]!)).toBe('illustrative size');
  });
});

describe('interiorNotes', () => {
  const notes = (id: string) => {
    const details = real(id);
    return interiorNotes(details.interior!.layers, drawnLayers(details.interior!.layers, 1000));
  };
  it('flags an estimate when any layer is one', () => {
    expect(notes('earth').estimate).toBe(false);
    expect(notes('jupiter').estimate).toBe(true);
    expect(notes('venus').estimate).toBe(true);
  });
  it('says the sizes are not to scale only when every layer is illustrative (Uranus, Neptune)', () => {
    expect(notes('uranus').notToScale).toBe(true);
    expect(notes('neptune').notToScale).toBe(true);
    expect(notes('jupiter').notToScale).toBe(false);
    expect(notes('earth').notToScale).toBe(false);
  });
});
