import type { Body, Source } from '../../src/core/catalog/schema';
import { collectSourceIds } from '../../src/core/catalog/references';
import { checkDetails } from '../../src/core/details/checks';
import {
  BodyDetailsSchema,
  type BodyDetails, type Discovery, type InteriorLayer, type Magnetosphere, type Mission, type SourcedRange,
} from '../../src/core/details/schema';
import type { FetchedText } from '../lib/fetchCached';
import { GAZETTEER_TARGETS, gazetteerSpec, selectFeatures } from '../sources/gazetteer';
import { parseMoonExosphere } from '../sources/nssdcMoonSheet';
import {
  PLANET_ATMOSPHERE_HEADING, PLANET_SHEET_IDS, SUN_COMPOSITION_HEADING,
  parseComposition, parseMagnetosphere, parseMeanRadiusKm, parseSunField, sheetText,
} from '../sources/nssdcPlanetSheet';
import {
  pageText, verifyInteriors, verifyMissions,
  type CuratedLayer, type CuratedSource, type InteriorsFile, type MissionsFile, type QuotedRange,
} from '../sources/quotedReference';
import { planetSheetSpec, toSource, type SourceSpec } from '../sources/registry';

export const DETAIL_BODY_IDS = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const;

export interface DetailsInputs {
  bodies: readonly Body[];
  existingSourceIds: ReadonlySet<string>;
  /** URL -> id of the sources already registered, so a curated source for the same page is aliased to it. */
  existingSourceUrls?: ReadonlyMap<string, string>;
  planetSheets: Record<(typeof PLANET_SHEET_IDS)[number], FetchedText>;
  sunSheet: FetchedText;
  moonSheet: FetchedText;
  gazetteer: Partial<Record<keyof typeof GAZETTEER_TARGETS, { rows: Array<Record<string, string>>; retrievedAt: string }>>;
  interiors: InteriorsFile;
  missions: MissionsFile;
  curatedPages: ReadonlyMap<string, FetchedText>;
}

const round = (x: number) => Math.round(x * 1e6) / 1e6;

/** Convert one curated bound (in its effective `from`) to a radius range in km, keeping the stated form and numbers for display. */
function boundToRadius(r: QuotedRange, layerFrom: CuratedLayer['from'], radiusKm: number): SourcedRange {
  const from = r.from ?? layerFrom;
  if (from === 'radius') return { min: r.min, max: r.max, sourceId: r.sourceId, from };
  const stated = { min: r.min, max: r.max };
  if (from === 'depth') return { min: round(radiusKm - r.max), max: round(radiusKm - r.min), sourceId: r.sourceId, from, stated };
  return { min: round((radiusKm * r.min) / 100), max: round((radiusKm * r.max) / 100), sourceId: r.sourceId, from, stated };
}

function convertLayer(layer: CuratedLayer, radiusKm: number): InteriorLayer {
  return {
    id: layer.id,
    name: layer.name,
    outerRadiusKm: boundToRadius(layer.outer, layer.from, radiusKm),
    innerRadiusKm: boundToRadius(layer.inner, layer.from, radiusKm),
    from: layer.from,
    state: layer.state,
    ...(layer.stateSource ? { stateSourceId: layer.stateSource.sourceId } : {}),
    composition: layer.composition ? { text: layer.composition.text, sourceId: layer.composition.sourceId } : null,
    uncertain: layer.uncertain,
  };
}

function convertDiscovery(d: NonNullable<MissionsFile['bodies'][string]>['discovery']): Discovery | null {
  if (!d) return null;
  if (d.kind === 'antiquity') return { kind: 'antiquity', sourceId: d.sourceId };
  return { kind: 'discovered', by: d.by, date: d.date, method: d.method, sourceId: d.sourceId };
}

/** Rewrite every source id in `value` (keys "sourceId" and "*SourceId") through `alias`. */
function aliasSourceIds<T>(value: T, alias: ReadonlyMap<string, string>): T {
  if (Array.isArray(value)) return value.map((v) => aliasSourceIds(v, alias)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, (k === 'sourceId' || k.endsWith('SourceId')) && typeof v === 'string' ? (alias.get(v) ?? v) : aliasSourceIds(v, alias)]),
    ) as T;
  }
  return value;
}

export function buildDetails(inputs: DetailsInputs, generatedAt: string): { details: BodyDetails[]; sources: Source[]; errors: string[] } {
  const errors: string[] = [];

  const pages = new Map<string, string>();
  for (const [id, page] of inputs.curatedPages) pages.set(id, pageText(page.text));
  errors.push(...verifyInteriors(inputs.interiors, pages).map((e) => `interiors.json: ${e}`));
  errors.push(...verifyMissions(inputs.missions, pages).map((e) => `missions.json: ${e}`));

  const candidates = new Map<string, Source>();
  const addSource = (spec: SourceSpec, retrievedAt: string) => {
    if (inputs.existingSourceIds.has(spec.id)) { errors.push(`sources: new source id "${spec.id}" collides with an existing source`); return; }
    const prev = candidates.get(spec.id);
    const next = toSource(spec, retrievedAt);
    if (prev && JSON.stringify(prev) !== JSON.stringify(next)) { errors.push(`sources: source id "${spec.id}" defined twice with different content`); return; }
    candidates.set(spec.id, next);
  };

  const details: BodyDetails[] = [];
  const radii = new Map<string, number>();
  for (const id of DETAIL_BODY_IDS) {
    const body = inputs.bodies.find((b) => b.id === id);
    if (!body) continue;
    const p = `details/${id}.json`;
    const isSun = id === 'sun';
    const isMoon = id === 'moon';
    const sheet = isSun ? inputs.sunSheet : isMoon ? inputs.moonSheet : inputs.planetSheets[id as (typeof PLANET_SHEET_IDS)[number]];
    const text = sheetText(sheet.text);
    // The Sun and the Moon have no planet-sheet mean radius row to parse: use the catalogue's cited radius.
    const radiusKm = isSun || isMoon
      ? ((body.facts.meanRadiusKm?.value as number | undefined) ?? body.shape.equatorialRadiusKm)
      : (() => { try { return parseMeanRadiusKm(text); } catch { return (body.facts.meanRadiusKm?.value as number | undefined) ?? body.shape.equatorialRadiusKm; } })();
    radii.set(id, radiusKm);
    const curated = inputs.interiors.bodies[id];
    const interior = curated && curated.layers.length > 0 ? { layers: curated.layers.map((l) => convertLayer(l, radiusKm)) } : null;
    const sheetSourceId = isSun ? 'nssdca-sun-fact-sheet' : `nssdca-${id}-fact-sheet`;
    // The Sun and Moon sheets are registered by the catalogue build; the planet sheets are registered here.
    if (!isSun && !isMoon) addSource(planetSheetSpec(id, body.name), sheet.retrievedAt);
    const atmosphere = isMoon
      ? parseMoonExosphere(sheet.text, sheetSourceId)
      : parseComposition(text, isSun ? SUN_COMPOSITION_HEADING : PLANET_ATMOSPHERE_HEADING, sheetSourceId);

    let magnetosphere: Magnetosphere | null = null;
    const field = body.facts.hasGlobalMagneticField;
    if (!isSun && !isMoon) magnetosphere = parseMagnetosphere(text, sheetSourceId);
    if (isMoon && curated?.magneticField) magnetosphere = { kind: 'other', note: { text: curated.magneticField.text, sourceId: curated.magneticField.sourceId } };
    if (!magnetosphere && field && field.value === false) magnetosphere = { kind: 'none', sourceId: field.sourceId };
    if (!magnetosphere && isSun) magnetosphere = parseSunField(text, sheetSourceId);
    if (!magnetosphere) { errors.push(`${p}: no magnetosphere source`); continue; }

    const m = inputs.missions.bodies[id];
    const missions: Mission[] = (m?.missions ?? [])
      .map(({ quotes: _q, ...rest }) => rest)
      .sort((a, b) => a.launchDate.localeCompare(b.launchDate) || a.name.localeCompare(b.name));

    let features: BodyDetails['features'] = null;
    if (id in GAZETTEER_TARGETS) {
      const key = id as keyof typeof GAZETTEER_TARGETS;
      const g = inputs.gazetteer[key];
      if (!g) errors.push(`${p}: no Gazetteer data`);
      else {
        const spec = gazetteerSpec(key, body.name);
        addSource(spec, g.retrievedAt);
        features = selectFeatures(g.rows, spec.id);
      }
    }

    details.push({ schemaVersion: 1, bodyId: id, generatedAt, interior, atmosphere, magnetosphere, missions, discovery: convertDiscovery(m?.discovery ?? null), features });
  }

  // A curated source for a page that is already registered (in the catalogue, or as a fact sheet above) is an alias of it:
  // the page is listed once, and the details point at the registered id.
  const registeredByUrl = new Map<string, string>(inputs.existingSourceUrls ?? []);
  for (const c of candidates.values()) if (!registeredByUrl.has(c.url)) registeredByUrl.set(c.url, c.id);
  const alias = new Map<string, string>();
  const curatedSources: CuratedSource[] = [...inputs.interiors.sources, ...inputs.missions.sources];
  for (const s of curatedSources) {
    const registered = registeredByUrl.get(s.url);
    if (registered !== undefined && registered !== s.id) { alias.set(s.id, registered); continue; }
    const page = inputs.curatedPages.get(s.id);
    addSource(s, page?.retrievedAt ?? '');
    registeredByUrl.set(s.url, s.id);
  }
  for (let i = 0; i < details.length; i++) details[i] = aliasSourceIds(details[i]!, alias);

  // Keep only sources a details file references.
  const referenced = new Set(details.flatMap((d) => collectSourceIds(d).map((r) => r.sourceId)));
  const sources = [...candidates.values()].filter((s) => referenced.has(s.id));
  const known = new Set([...inputs.existingSourceIds, ...sources.map((s) => s.id)]);

  for (const s of sources) if (!s.retrievedAt) errors.push(`sources: no fetched page for "${s.id}"`);

  for (const d of details) {
    const parsed = BodyDetailsSchema.safeParse(d);
    if (!parsed.success) {
      errors.push(...parsed.error.issues.map((i) => `details/${d.bodyId}.json: ${i.path.map(String).join('.') || '(root)'}: ${i.message}`));
      continue;
    }
    errors.push(...checkDetails(d, { radiusKm: radii.get(d.bodyId)!, knownSources: known }));
  }
  return { details, sources, errors };
}
