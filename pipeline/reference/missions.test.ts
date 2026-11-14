import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MISSION_OUTCOMES, MISSION_TYPES } from '../../src/core/details/schema';
import { pageText, verifyMissions, type MissionsFile } from '../sources/quotedReference';

const file = JSON.parse(readFileSync('pipeline/reference/missions.json', 'utf8')) as MissionsFile;

const BODIES = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const RAW_DIR = 'pipeline/raw';

describe('curated missions', () => {
  it('covers the Sun, the Moon and the eight planets and nothing else', () => {
    expect(Object.keys(file.bodies).sort()).toEqual([...BODIES].sort());
  });
  it('uses schema types and outcomes, ISO dates in order, and unique kebab-case ids', () => {
    for (const [body, { missions }] of Object.entries(file.bodies)) {
      const ids = new Set<string>();
      for (const m of missions) {
        const where = `${body}/${m.id}`;
        expect(m.id, where).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(ids.has(m.id), `${where} duplicated`).toBe(false);
        ids.add(m.id);
        expect(MISSION_TYPES as readonly string[], where).toContain(m.type);
        expect(MISSION_OUTCOMES as readonly string[], where).toContain(m.outcome);
        expect(m.launchDate, where).toMatch(ISO);
        if (m.arrivalDate !== null) {
          expect(m.arrivalDate, where).toMatch(ISO);
          expect(m.launchDate <= m.arrivalDate, `${where} launch after arrival`).toBe(true);
        }
        if (m.endDate !== null) {
          expect(m.endDate, where).toMatch(ISO);
          expect(m.launchDate <= m.endDate, `${where} launch after end`).toBe(true);
          if (m.arrivalDate !== null) expect(m.arrivalDate <= m.endDate, `${where} arrival after end`).toBe(true);
        }
      }
    }
  });
  it('gives every planet but the Earth and the Sun a discovery entry of the right kind', () => {
    for (const id of ['mercury', 'venus', 'mars', 'jupiter', 'saturn']) expect(file.bodies[id]!.discovery?.kind, id).toBe('antiquity');
    expect(file.bodies['uranus']!.discovery?.kind).toBe('discovered');
    expect(file.bodies['neptune']!.discovery?.kind).toBe('discovered');
    expect(file.bodies['earth']!.discovery).toBeNull();
    expect(file.bodies['sun']!.discovery).toBeNull();
  });
  it('passes the quote and date checks against the cached pages', () => {
    if (!existsSync(RAW_DIR)) return; // CI without the cache: run.ts performs the same check at build time
    const pages = new Map<string, string>();
    for (const s of file.sources) {
      const cached = path.join(RAW_DIR, `ref-${s.id}.html`);
      expect(existsSync(cached), `page cache missing: ${cached}`).toBe(true);
      pages.set(s.id, pageText(readFileSync(cached, 'utf8')));
    }
    expect(pages.size).toBeGreaterThan(0);
    expect(verifyMissions(file, pages)).toEqual([]);
  });
});
