import type { FeatureItem, Features } from '../../src/core/details/schema';
import type { SourceSpec } from './registry';

export const GAZETTEER_TARGETS = { mercury: 'MERCURY', venus: 'VENUS', mars: 'MARS' } as const;
export type GazetteerTarget = (typeof GAZETTEER_TARGETS)[keyof typeof GAZETTEER_TARGETS];

export function gazetteerUrl(target: GazetteerTarget): string {
  return `https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/${target}_nomenclature_center_pts.zip`;
}

export function gazetteerSpec(bodyId: keyof typeof GAZETTEER_TARGETS, name: string): SourceSpec {
  return {
    id: `usgs-gazetteer-${bodyId}`,
    title: `${name} nomenclature (feature centre points), Gazetteer of Planetary Nomenclature`,
    publisher: 'USGS Astrogeology Science Center / IAU Working Group for Planetary System Nomenclature',
    url: gazetteerUrl(GAZETTEER_TARGETS[bodyId]),
    license: 'Public domain (USGS)',
  };
}

export function selectFeatures(rows: Array<Record<string, string>>, sourceId: string, limit = 200): Features {
  const approved = rows.filter((r) => (r.approval ?? '').startsWith('Adopted'));
  const items: FeatureItem[] = approved
    .map((r): FeatureItem => {
      const lon = Math.round(Number(r.center_lon) * 1e4) / 1e4;
      const year = /^\d{4}/.exec(r.approvaldt ?? '');
      return {
        name: (r.clean_name || r.name || '').trim(),
        type: (r.type ?? '').split(',')[0].trim(),
        latDeg: Math.round(Number(r.center_lat) * 1e4) / 1e4,
        lonDegE: lon >= 0 && lon < 360 ? lon : Math.round((((lon % 360) + 360) % 360) * 1e4) / 1e4 % 360,
        diameterKm: Math.round(Number(r.diameter) * 1e3) / 1e3,
        origin: (r.origin ?? '').trim(),
        approvedYear: year ? Number(year[0]) : null,
      };
    })
    .filter((i) => i.diameterKm > 0)
    .sort((a, b) => b.diameterKm - a.diameterKm || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .slice(0, limit);
  return {
    totalApproved: { value: approved.length, sourceId },
    thresholdKm: items.length ? items[items.length - 1].diameterKm : 0,
    sourceId,
    items,
  };
}
