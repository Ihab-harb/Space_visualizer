import type { Catalog } from '../core/catalog/catalog';
import { TIERS, type Tier } from '../core/catalog/schema';
import { parseDateInput } from '../core/time/format';
import { utcToTdb } from '../core/time/timescales';
import { useSelectionStore } from './selectionStore';
import { JD_MAX, JD_MIN, RATE_STEPS, useTimeStore } from './timeStore';
import { useViewStore } from './viewStore';

export interface UrlOverrides {
  jdTdb?: number;
  paused?: boolean;
  rateIndex?: number;
  target?: string;
  distanceKm?: number;
  azDeg?: number;
  azFromSunDeg?: number;
  elDeg?: number;
  tier?: Tier;
}

export function parseUrlOverrides(search: string): UrlOverrides {
  const p = new URLSearchParams(search);
  const o: UrlOverrides = {};
  const num = (key: string) => {
    const raw = p.get(key);
    if (raw === null || raw.trim() === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };
  const jd = num('jd');
  if (jd !== undefined && jd >= JD_MIN && jd <= JD_MAX) o.jdTdb = jd;
  const date = p.get('date');
  if (date) {
    const parsed = parseDateInput(date);
    if (parsed.ok) o.jdTdb = utcToTdb(parsed.jdUtc);
  }
  if (p.get('pause') === '1') o.paused = true;
  const rate = num('rate');
  if (rate !== undefined && Number.isInteger(rate) && rate >= 0 && rate < RATE_STEPS.length) o.rateIndex = rate;
  const target = p.get('target');
  if (target) o.target = target;
  const dist = num('dist');
  if (dist !== undefined && dist > 0) o.distanceKm = dist;
  const az = num('az');
  if (az !== undefined) o.azDeg = az;
  const azSun = num('azSun');
  if (azSun !== undefined) o.azFromSunDeg = azSun;
  const el = num('el');
  if (el !== undefined) o.elDeg = el;
  const tier = p.get('tier');
  if (tier && (TIERS as readonly string[]).includes(tier)) o.tier = tier as Tier;
  return o;
}

export function applyUrlOverrides(o: UrlOverrides, catalog: Catalog): void {
  const time = useTimeStore.getState();
  if (o.jdTdb !== undefined) time.setJdTdb(o.jdTdb);
  if (o.paused) time.setPlaying(false);
  if (o.rateIndex !== undefined) time.setRateIndex(o.rateIndex);
  if (o.tier) useViewStore.getState().setTextureTier(o.tier);
  if (o.target && catalog.bodyById.has(o.target)) {
    useSelectionStore.getState().select(o.target);
    useViewStore.getState().requestCameraOverride({
      targetId: o.target,
      ...(o.distanceKm !== undefined ? { distanceKm: o.distanceKm } : {}),
      ...(o.azDeg !== undefined ? { azDeg: o.azDeg } : {}),
      ...(o.azFromSunDeg !== undefined ? { azFromSunDeg: o.azFromSunDeg } : {}),
      ...(o.elDeg !== undefined ? { elDeg: o.elDeg } : {}),
    });
  }
}
