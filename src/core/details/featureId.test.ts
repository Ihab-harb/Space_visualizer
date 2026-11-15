import { describe, expect, it } from 'vitest';
import { featureId, foldText } from './featureId';

describe('foldText', () => {
  it('lower-cases, strips accents and trims', () => {
    expect(foldText('  Brontë ')).toBe('bronte');
  });
});

describe('featureId', () => {
  it('makes a URL-safe id', () => {
    expect(featureId('Olympus Mons')).toBe('olympus-mons');
    expect(featureId("Chang'e Planitia")).toBe('chang-e-planitia');
    expect(featureId('Von Kármán M')).toBe('von-karman-m');
  });
});
