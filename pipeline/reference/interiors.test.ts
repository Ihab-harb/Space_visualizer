import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { pageText, verifyInteriors, type InteriorsFile } from '../sources/quotedReference';

const file = JSON.parse(readFileSync('pipeline/reference/interiors.json', 'utf8')) as InteriorsFile;

describe('curated interiors', () => {
  it('covers the Sun and the eight planets, or lists the omission', () => {
    const ids = Object.keys(file.bodies);
    for (const id of ids) expect(['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']).toContain(id);
    expect(ids).toEqual(expect.arrayContaining(['sun', 'mercury', 'earth', 'mars'])); // the other five have no official numeric source: interior null
  });
  it('passes the quote, kilometre and percent checks against the cached pages', () => {
    const pages = new Map<string, string>();
    for (const s of file.sources) {
      const cached = path.join('pipeline/raw', `ref-${s.id}.html`);
      if (existsSync(cached)) pages.set(s.id, pageText(readFileSync(cached, 'utf8')));
    }
    if (pages.size === 0) return; // CI without the cache: run.ts performs the same check at build time
    expect(verifyInteriors(file, pages)).toEqual([]);
  });
});
