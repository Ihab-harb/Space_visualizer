import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Source } from '../../src/core/catalog/schema';
import type { BodyDetails } from '../../src/core/details/schema';
import { DETAIL_BODY_IDS } from './buildDetails';

const read = <T>(file: string): T => JSON.parse(readFileSync(`public/data/${file}`, 'utf8')) as T;
const sources = read<{ sources: Source[] }>('sources.json').sources;
const details = DETAIL_BODY_IDS.map((id) => read<BodyDetails>(`solar-system/details/${id}.json`));

describe('generated data', () => {
  it('lists each page once in sources.json: no two sources share a URL', () => {
    const byUrl = new Map<string, string[]>();
    for (const s of sources) byUrl.set(s.url, [...(byUrl.get(s.url) ?? []), s.id]);
    expect([...byUrl].filter(([, ids]) => ids.length > 1)).toEqual([]);
  });

  it('links the Gazetteer citations to web pages, not to the downloaded zip', () => {
    const gazetteer = sources.filter((s) => s.id.startsWith('usgs-gazetteer-'));
    expect(gazetteer.length).toBeGreaterThan(0);
    for (const s of gazetteer) {
      expect(s.url).toMatch(/^https:\/\/planetarynames\.wr\.usgs\.gov\//);
      expect(s.url).not.toMatch(/\.zip$/);
    }
  });

  it('lists missions in launch order and every details sourceId resolves', () => {
    const ids = new Set(sources.map((s) => s.id));
    for (const d of details) {
      const launches = d.missions.map((m) => m.launchDate);
      expect(launches, d.bodyId).toEqual([...launches].sort());
      for (const m of d.missions) expect(ids.has(m.sourceId), `${d.bodyId}/${m.id}`).toBe(true);
    }
  });

  it('keeps Apollo 8 out of the Earth missions and types the Sun orbiters from their pages', () => {
    expect(details.find((d) => d.bodyId === 'earth')!.missions.map((m) => m.id)).not.toContain('apollo-8');
    const sun = details.find((d) => d.bodyId === 'sun')!.missions;
    for (const id of ['parker-solar-probe', 'solar-orbiter']) expect(sun.find((m) => m.id === id)!.type).toBe('orbiter');
  });
});
