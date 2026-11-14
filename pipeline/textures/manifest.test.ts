import { describe, expect, it } from 'vitest';
import { IMAGERY_SOURCE_SPECS, imagerySpec, PRODUCTS } from './manifest';

describe('imagery manifest', () => {
  it('cites a registered source for every product', () => {
    const ids = new Set(IMAGERY_SOURCE_SPECS.map((s) => s.id));
    for (const [id, p] of Object.entries(PRODUCTS)) {
      expect(ids.has(p.sourceId), `${id} -> ${p.sourceId}`).toBe(true);
      expect(p.url.startsWith('https://'), id).toBe(true);
    }
  });
  it('has unique source ids and cache names', () => {
    const ids = IMAGERY_SOURCE_SPECS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const caches = Object.values(PRODUCTS).map((p) => p.cacheName);
    expect(new Set(caches).size).toBe(caches.length);
  });
  it('marks only the 8k star map as HD-only', () => {
    expect(Object.entries(PRODUCTS).filter(([, p]) => p.hdOnly).map(([id]) => id)).toEqual(['sky-starmap-8k']);
  });
  it('looks up specs and fails loudly for unknown ids', () => {
    expect(imagerySpec('stsci-opal').publisher).toContain('STScI');
    expect(() => imagerySpec('nope')).toThrow(/Unknown imagery source "nope"/);
  });
});
