import { describe, expect, it } from 'vitest';
import type { TextureRef } from '../../core/catalog/schema';
import { availableRef } from './availableTiers';

const ref: TextureRef = {
  tiers: { '1k': 'textures/earth/color_1k.webp', '2k': 'textures/earth/color_2k.webp', '4k': 'textures/earth/color_4k.webp', '8k': 'textures/earth/color_8k.webp' },
  sourceId: 'x',
};

describe('availableRef', () => {
  it('keeps committed tiers and drops HD tiers that are not in the build', () => {
    expect(Object.keys(availableRef(ref, new Set()).tiers)).toEqual(['1k', '2k']);
    expect(Object.keys(availableRef(ref, new Set(['textures/earth/color_4k.webp'])).tiers)).toEqual(['1k', '2k', '4k']);
  });
  it('keeps the rest of the reference unchanged', () => {
    expect(availableRef(ref, new Set()).sourceId).toBe('x');
  });
});
