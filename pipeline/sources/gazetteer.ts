import type { FeatureItem, Features } from '../../src/core/details/schema';
import { featureId } from '../../src/core/details/featureId';
import type { SourceSpec } from './registry';

export const GAZETTEER_TARGETS = { mercury: 'MERCURY', venus: 'VENUS', mars: 'MARS', moon: 'MOON' } as const;
export type GazetteerTarget = (typeof GAZETTEER_TARGETS)[keyof typeof GAZETTEER_TARGETS];

export function gazetteerUrl(target: GazetteerTarget): string {
  return `https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/${target}_nomenclature_center_pts.zip`;
}

/** The Gazetteer's web page for a target, which the citation links to (the zip above is only what the pipeline fetches). */
export function gazetteerPageUrl(target: GazetteerTarget): string {
  return `https://planetarynames.wr.usgs.gov/Page/${target}/target`;
}

export function gazetteerSpec(bodyId: keyof typeof GAZETTEER_TARGETS, name: string): SourceSpec {
  return {
    id: `usgs-gazetteer-${bodyId}`,
    title: `${name} nomenclature (feature centre points), Gazetteer of Planetary Nomenclature`,
    publisher: 'USGS Astrogeology Science Center / IAU Working Group for Planetary System Nomenclature',
    url: gazetteerPageUrl(GAZETTEER_TARGETS[bodyId]),
    license: 'Public domain (USGS)',
  };
}

type Row = Record<string, string>;

const isApproved = (r: Row) => (r.approval ?? '').startsWith('Adopted');
const decimals = (s: string | undefined) => (String(Number(s)).split('.')[1] ?? '').length;

/**
 * One row per Gazetteer feature (one `link`). The dbf can list a feature twice, as two revisions of its geometry that the
 * feature page shows side by side, so neither is singled out there. The row whose diameter is given to more decimals is the
 * more exact measurement and is kept; on a tie the first row stays. Rows without a link are never merged.
 */
export function dedupeRows(rows: Row[]): Row[] {
  const byLink = new Map<string, number>();
  const out: Row[] = [];
  for (const r of rows) {
    const link = (r.link ?? '').trim();
    const at = link ? byLink.get(link) : undefined;
    if (at === undefined) {
      if (link) byLink.set(link, out.length);
      out.push(r);
    } else if (decimals(r.diameter) > decimals(out[at]!.diameter)) {
      out[at] = r;
    }
  }
  return out;
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

function toItem(r: Row): FeatureItem {
  const lon = round(Number(r.center_lon), 4);
  const year = /^\d{4}/.exec(r.approvaldt ?? '');
  return {
    id: '',
    name: (r.clean_name || r.name || '').trim(),
    type: (r.type ?? '').split(',')[0].trim(),
    latDeg: round(Number(r.center_lat), 4),
    lonDegE: lon >= 0 && lon < 360 ? lon : (round((((lon % 360) + 360) % 360), 4)) % 360,
    diameterKm: round(Number(r.diameter), 3),
    origin: (r.origin ?? '').trim(),
    approvedYear: year ? Number(year[0]) : null,
  };
}

/** Every approved, deduped feature with a size, largest first, each with its id. Two features that share a name get `-<type>`. */
function allFeatures(rows: Row[]): { approvedCount: number; items: FeatureItem[] } {
  const approved = dedupeRows(rows.filter(isApproved));
  const sorted = approved
    .map(toItem)
    .filter((i) => i.diameterKm > 0)
    .sort((a, b) => b.diameterKm - a.diameterKm || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const used = new Set<string>();
  for (const it of sorted) {
    const base = featureId(it.name);
    let id = base;
    if (used.has(id)) id = `${base}-${featureId(it.type)}`;
    for (let n = 2; used.has(id); n++) id = `${base}-${featureId(it.type)}-${n}`;
    used.add(id);
    it.id = id;
  }
  return { approvedCount: approved.length, items: sorted };
}

export function selectFeatures(rows: Row[], sourceId: string, limit = 200): Features {
  const { approvedCount, items: all } = allFeatures(rows);
  const items = all.slice(0, limit);
  return {
    totalApproved: { value: approvedCount, sourceId },
    thresholdKm: items.length ? items[items.length - 1].diameterKm : 0,
    sourceId,
    items,
  };
}

/** A feature by exact, case-sensitive name, whatever its size (the 200 cut does not apply). */
export function findFeature(rows: Row[], name: string): FeatureItem | null {
  return allFeatures(rows).items.find((i) => i.name === name) ?? null;
}
