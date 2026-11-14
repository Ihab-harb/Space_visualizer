import { describe, expect, it } from 'vitest';
import { DESCRIPTION_PAGES, parseMetaDescription } from './nasaScience';
import { nasaScienceSpec, SOURCE_SPECS, toSource } from './registry';

describe('parseMetaDescription', () => {
  it('reads and decodes the meta description', () => {
    const html = '<html><head><meta name="description" content="Mercury is the closest planet to the Sun, and the smallest planet in our solar system - only slightly larger than Earth&#039;s Moon."></head></html>';
    expect(parseMetaDescription(html)).toBe("Mercury is the closest planet to the Sun, and the smallest planet in our solar system - only slightly larger than Earth's Moon.");
  });
  it('throws when there is no description', () => {
    expect(() => parseMetaDescription('<html><head></head></html>')).toThrow(/meta description/);
  });
});

describe('source registry', () => {
  it('covers the Sun and eight planets, with Earth on its facts page', () => {
    expect(Object.keys(DESCRIPTION_PAGES)).toEqual(['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
    expect(DESCRIPTION_PAGES.earth).toBe('https://science.nasa.gov/earth/facts/');
  });
  it('builds Source records with a retrieval date', () => {
    expect(toSource(SOURCE_SPECS.naifPck, '2026-10-04')).toMatchObject({ id: 'naif-pck00011', retrievedAt: '2026-10-04' });
    expect(nasaScienceSpec('jupiter', 'Jupiter', DESCRIPTION_PAGES.jupiter)).toMatchObject({ id: 'nasa-science-jupiter', publisher: 'NASA' });
  });
});
