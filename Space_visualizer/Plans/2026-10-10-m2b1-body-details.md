---
title: M2b.1 Body Details Data — Implementation Plan
date: 2026-10-10
status: complete
milestone: M2b.1
tags: [plan, m2b, data]
---

# M2b.1 Body Details Data Implementation Plan

Back to [[Home]] · Spec: [[2026-10-10-m2b1-body-details-design]] · Parent spec: [[2026-10-04-m2-cinematic-and-rich-bodies-design]] (§8) · Follows [[2026-10-07-m2a3-interface-and-tour]] · Session: [[2026-10-04-session-m1-to-m2a3]]

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Sun and the eight planets cited detail data, covering interior layers, atmosphere composition, magnetic field, key missions, discovery and named surface features. The offline pipeline builds it, it loads per body on demand, and it is shown in the facts & sources drawer and in one header sentence.

**Architecture:**
- **Data model:** a shared Zod schema (`src/core/details/schema.ts`) and pure build checks (`src/core/details/checks.ts`) define one details file per body.
- **Pipeline:** builds the files from three kinds of source:
  - the NSSDCA per-planet fact sheets (a new text parser);
  - the USGS Gazetteer shapefiles (a built-in zip and `.dbf` reader);
  - two curated reference files, in which every value carries its source sentence, checked against the fetched page.
- **App:** a small store fetches a body's file on first selection. A `DetailsSections` component renders it in the drawer. The details sources are appended to the shared citation numbering, so header numbers never shift.

**Tech Stack:** the existing stack. Node `zlib` (built in) for zip inflate. **No new runtime or dev dependencies.**

**Spec:** `Space_visualizer/Specs/2026-10-10-m2b1-body-details-design.md`. Read it in full; it is the authority for this plan.

## Global Constraints

- **Earlier constraints still hold**, from M1 to M2a.3:
  - every value shown is cited to an official source;
  - the shell is Windows PowerShell; Git Bash is also available;
  - every commit message ends with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - no change to M1 to M2a.3 behaviour except where a task says so;
  - all existing unit and end-to-end tests keep passing.
- **Data from official sources only:**
  - NSSDCA fact sheets, the USGS Gazetteer of Planetary Nomenclature, NASA mission and science pages, and the NSSDCA Master Catalog;
  - no Wikipedia, no secondary aggregators;
  - every curated value records the exact sentence it came from, and the build fails if that sentence is not on the page or the recorded number is not in the sentence.
- **Dependencies:** no new runtime or dev dependencies. Zip and `.dbf` reading are written in the repo (Node `zlib`).
- **Data files:**
  - details files are `public/data/solar-system/details/<bodyId>.json`, one each for `sun`, `mercury`, `venus`, `earth`, `mars`, `jupiter`, `saturn`, `uranus` and `neptune`;
  - every `sourceId` in them resolves to a source in `public/data/sources.json`;
  - details files are never requested at startup.
- **Citations:** details sources are numbered after the body's existing sources and the live position source. A number shown before the details load never changes after they load.
- **The pipeline is reproducible offline:**
  - `npm run data:offline` rebuilds everything from `pipeline/raw/` with no network;
  - `npm run data` refreshes the caches;
  - raw downloads stay git-ignored under `pipeline/raw/`.
- **UI:** the drawer and header keep their accessible names and existing sections. New sections use the existing glass and drawer styles, monospace `.num` numbers and `.cite` links.

## Review Focus

1. **A curated quote that exists but a recorded number that does not match it.** The likely cause is miles against km, since NASA pages often give miles first, or a rounding difference. The build must catch it. Pinned by Task 4 tests: interior radii must appear in their quote *as kilometres*. A quote reading "about 2,100 miles (3,400 km)" accepts 3400 and rejects 2100. Numbers match whole, so "1830" never matches inside "18300".
2. **Fact-sheet text the parser misreads.** Each of these must parse exactly:
   - Saturn's gas names broken across lines ("Ammonia" / "(NH3) - 125 (75)");
   - Earth's formula-only "CH4 - 1.94";
   - Venus's amount-first "96.5% Carbon Dioxide (CO2)";
   - Mars's missing separator ("2.59% Argon");
   - Neptune's "Methane (CH4) 1.5% (0.5%)";
   - the Sun's element symbols.

   Pinned by Task 2 tests against stored copies of all eight planet sheets and the Sun sheet, with exact expected gas lists.
3. **Switching bodies while details are loading.** The drawer must never show one body's details under another body's name. Pinned by a Task 8 test: start Mars loading, select Venus, resolve Mars, then check that Venus's sections show Venus data or a loading state, never Mars's.
4. **A missing or broken details file.** A static host without the files, a 404, or JSON that fails the schema must show "Details unavailable" with Retry. The rest of the drawer and the scene must keep working. Pinned by a Task 8 unit test and a Task 10 e2e test that aborts the request.
5. **Citation numbers shifting when details arrive.** Pinned by a Task 9 unit test: every source id has the same number in `citationModel` before and after details are passed in, and details sources take only new, higher numbers.

## File Structure

```
src/core/details/schema.ts          BodyDetails Zod schema + types (shared by pipeline and app)
src/core/details/checks.ts          pure build checks (spec §5) -> string[] of errors
pipeline/sources/nssdcPlanetSheet.ts NSSDCA per-planet + Sun text parser: atmosphere, magnetosphere
pipeline/lib/zip.ts                  minimal zip reader (central directory + zlib.inflateRawSync)
pipeline/lib/dbf.ts                  minimal dBASE III reader (C and N fields, UTF-8)
pipeline/sources/gazetteer.ts        Gazetteer URLs + feature selection
pipeline/sources/quotedReference.ts  page-text normalisation, quote and number/date checks
pipeline/reference/interiors.json    curated interior layers (quoted)
pipeline/reference/missions.json     curated key missions + discovery (quoted)
pipeline/build/buildDetails.ts       assembles BodyDetails per body + new sources
pipeline/run.ts                      (modified) fetches, builds, checks, writes details files
src/state/detailsStore.ts            on-demand loader (idle/loading/ready/missing/error) + useBodyDetails
src/ui/DetailsSections.tsx           drawer sections for the details
src/ui/citations.ts                  (modified) citationModel appends details sources
src/ui/narrative.ts                  (modified) details sentence + parent wording fix
e2e/details.spec.ts                  drawer sections, unavailable state, no startup request
```

---

### Task 1: Details schema and build checks

**Files:**
- Create: `src/core/details/schema.ts`, `src/core/details/schema.test.ts`, `src/core/details/checks.ts`, `src/core/details/checks.test.ts`, `src/test/detailsFixtures.ts`

**Interfaces:**
- Produces (`schema.ts`):
  - `BodyDetailsSchema` and the types `BodyDetails`, `InteriorLayer`, `SourcedRange`, `Atmosphere`, `Gas`, `Magnetosphere`, `Mission`, `MissionType`, `MissionOutcome`, `Discovery`, `Features`, `FeatureItem`;
  - the shapes follow spec §3 exactly, plus two refinements found while planning. `InteriorLayer.from: 'radius' | 'depth' | 'percent'` records how the source stated the layer: as radii, as depths below the surface, or as a percentage of the body's radius (the Sun's zones). `discovery` is nullable, for Earth and the Sun.
- Produces (`checks.ts`): `checkDetails(details: BodyDetails, ctx: { radiusKm: number; knownSources: ReadonlySet<string> }): string[]`. It returns one message per failed spec §5 rule, each prefixed with `details/<bodyId>.json:`.
- Produces (`src/test/detailsFixtures.ts`): `makeMarsDetails(): BodyDetails`, `makeJupiterDetails(): BodyDetails` and `makeSunDetails(): BodyDetails`. They are small, valid fixtures whose sourceIds exist in `TEST_SOURCES`, for later tasks' tests. Add any missing source ids to `TEST_SOURCES` in `src/test/fixtures.ts`.

- [ ] **Step 1: Write the failing tests**

`src/core/details/schema.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { makeJupiterDetails, makeMarsDetails, makeSunDetails } from '../../test/detailsFixtures';
import { BodyDetailsSchema } from './schema';

describe('BodyDetailsSchema', () => {
  it('accepts a rocky planet, a giant and the Sun', () => {
    for (const d of [makeMarsDetails(), makeJupiterDetails(), makeSunDetails()]) expect(BodyDetailsSchema.safeParse(d).success).toBe(true);
  });
  it('rejects an unknown mission type, a percent gas listed as minor, and a missing sourceId', () => {
    const m = makeMarsDetails();
    expect(BodyDetailsSchema.safeParse({ ...m, missions: [{ ...m.missions[0]!, type: 'balloon' }] }).success).toBe(false);
    expect(BodyDetailsSchema.safeParse({ ...m, atmosphere: { ...m.atmosphere!, minor: [{ ...m.atmosphere!.major[0]! }] } }).success).toBe(false);
    const { sourceId: _drop, ...noSource } = m.missions[0]!;
    expect(BodyDetailsSchema.safeParse({ ...m, missions: [noSource] }).success).toBe(false);
  });
});
```

`src/core/details/checks.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { makeJupiterDetails, makeMarsDetails } from '../../test/detailsFixtures';
import { TEST_SOURCES } from '../../test/fixtures';
import { checkDetails } from './checks';

const ctx = { radiusKm: 3389.5, knownSources: new Set(TEST_SOURCES.map((s) => s.id)) };

describe('checkDetails (spec §5)', () => {
  it('passes valid fixtures', () => {
    expect(checkDetails(makeMarsDetails(), ctx)).toEqual([]);
    expect(checkDetails(makeJupiterDetails(), { ...ctx, radiusKm: 71492 })).toEqual([]);
  });
  it('rejects layers out of order, above the radius, or with a non-zero innermost inner radius', () => {
    const d = makeMarsDetails();
    const [a, b] = d.interior!.layers;
    expect(checkDetails({ ...d, interior: { layers: [b!, a!] } }, ctx).join()).toMatch(/order/);
    expect(checkDetails({ ...d, interior: { layers: [{ ...a!, outerRadiusKm: { ...a!.outerRadiusKm, max: 4000 } }, b!] } }, ctx).join()).toMatch(/radius/);
    const last = d.interior!.layers.at(-1)!;
    expect(checkDetails({ ...d, interior: { layers: [...d.interior!.layers.slice(0, -1), { ...last, innerRadiusKm: { ...last.innerRadiusKm, min: 5, max: 5 } }] } }, ctx).join()).toMatch(/innermost/);
  });
  it('rejects gases over 100 %, ppm at or above a million, and bad feature coordinates', () => {
    const d = makeMarsDetails();
    const gas = d.atmosphere!.major[0]!;
    expect(checkDetails({ ...d, atmosphere: { ...d.atmosphere!, major: [gas, { ...gas, name: 'X', amount: 10 }] } }, ctx).join()).toMatch(/100/);
    expect(checkDetails({ ...d, atmosphere: { ...d.atmosphere!, minor: [{ ...d.atmosphere!.minor[0]!, amount: 1e6 }] } }, ctx).join()).toMatch(/ppm/);
    const f = d.features!;
    expect(checkDetails({ ...d, features: { ...f, items: [{ ...f.items[0]!, latDeg: 95 }] } }, ctx).join()).toMatch(/latitude/);
    expect(checkDetails({ ...d, features: { ...f, items: [{ ...f.items[0]!, lonDegE: 360 }] } }, ctx).join()).toMatch(/longitude/);
  });
  it('rejects arrival before launch, a tilt over 180, and an unknown sourceId', () => {
    const d = makeMarsDetails();
    expect(checkDetails({ ...d, missions: [{ ...d.missions[0]!, launchDate: '1970-01-01', arrivalDate: '1969-01-01' }] }, ctx).join()).toMatch(/arrival/);
    const j = makeJupiterDetails();
    if (j.magnetosphere.kind !== 'dipole') throw new Error('fixture');
    expect(checkDetails({ ...j, magnetosphere: { ...j.magnetosphere, tiltDeg: { value: 190, sourceId: j.magnetosphere.strengthGaussR3.sourceId } } }, { ...ctx, radiusKm: 71492 }).join()).toMatch(/tilt/);
    expect(checkDetails({ ...d, discovery: { kind: 'antiquity', sourceId: 'nope' } }, ctx).join()).toMatch(/unknown sourceId "nope"/);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/core/details`
Expected: FAIL (the modules are missing).

- [ ] **Step 3: Implement the schema**

`src/core/details/schema.ts`:
```ts
import { z } from 'zod';

const SourceId = z.string().min(1);
const NumberValue = z.object({ value: z.number(), sourceId: SourceId });
const Text = z.object({ text: z.string().min(1), sourceId: SourceId });
const IsoDate = z.iso.date();

export const SourcedRangeSchema = z
  .object({ min: z.number(), max: z.number(), sourceId: SourceId })
  .refine((r) => r.min <= r.max, { message: 'range min must not exceed max' });

export const InteriorLayerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  outerRadiusKm: SourcedRangeSchema,
  innerRadiusKm: SourcedRangeSchema,
  from: z.enum(['radius', 'depth', 'percent']),
  state: z.enum(['solid', 'liquid', 'gas', 'plasma', 'unknown']),
  composition: Text.nullable(),
  uncertain: z.boolean(),
});

const GasBase = { name: z.string().min(1), formula: z.string().min(1), amount: z.number().nonnegative(), uncertainty: z.number().nonnegative().nullable(), sourceId: SourceId };
export const MajorGasSchema = z.object({ ...GasBase, unit: z.literal('%') });
export const MinorGasSchema = z.object({ ...GasBase, unit: z.literal('ppm') });

export const AtmosphereSchema = z.object({
  basis: z.string().min(1),
  major: z.array(MajorGasSchema),
  minor: z.array(MinorGasSchema),
  note: Text.nullable(),
});

export const MagnetosphereSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none'), sourceId: SourceId }),
  z.object({
    kind: z.literal('dipole'),
    strengthGaussR3: NumberValue,
    tiltDeg: NumberValue.nullable(),
    tiltLongitudeDeg: NumberValue.nullable(),
    dipolePole: z.object({ latDeg: z.number(), lonDegE: z.number(), sourceId: SourceId }).nullable(),
    offsetRadii: NumberValue.nullable(),
    referenceRadiusKm: NumberValue,
    surfaceFieldGauss: SourcedRangeSchema.nullable(),
  }),
  z.object({ kind: z.literal('other'), note: Text }),
]);

export const MISSION_TYPES = ['flyby', 'orbiter', 'lander', 'rover', 'probe', 'sample-return', 'impactor', 'observatory'] as const;
export const MISSION_OUTCOMES = ['success', 'partial', 'failure', 'ongoing', 'planned'] as const;

export const MissionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  agency: z.string().min(1),
  type: z.enum(MISSION_TYPES),
  launchDate: IsoDate,
  arrivalDate: IsoDate.nullable(),
  endDate: IsoDate.nullable(),
  outcome: z.enum(MISSION_OUTCOMES),
  sourceId: SourceId,
});

export const DiscoverySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('antiquity'), sourceId: SourceId }),
  z.object({ kind: z.literal('discovered'), by: z.string().min(1), date: IsoDate, method: z.string().min(1), sourceId: SourceId }),
]);

export const FeatureItemSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  latDeg: z.number(),
  lonDegE: z.number(),
  diameterKm: z.number(),
  origin: z.string(),
  approvedYear: z.number().int().nullable(),
});

export const FeaturesSchema = z.object({
  totalApproved: NumberValue,
  thresholdKm: z.number().nonnegative(),
  sourceId: SourceId,
  items: z.array(FeatureItemSchema),
});

export const BodyDetailsSchema = z.object({
  schemaVersion: z.literal(1),
  bodyId: z.string().regex(/^[a-z0-9-]+$/),
  generatedAt: z.iso.datetime(),
  interior: z.object({ layers: z.array(InteriorLayerSchema).min(1) }).nullable(),
  atmosphere: AtmosphereSchema.nullable(),
  magnetosphere: MagnetosphereSchema,
  missions: z.array(MissionSchema),
  discovery: DiscoverySchema.nullable(),
  features: FeaturesSchema.nullable(),
});

export type SourcedRange = z.infer<typeof SourcedRangeSchema>;
export type InteriorLayer = z.infer<typeof InteriorLayerSchema>;
export type Gas = z.infer<typeof MajorGasSchema> | z.infer<typeof MinorGasSchema>;
export type Atmosphere = z.infer<typeof AtmosphereSchema>;
export type Magnetosphere = z.infer<typeof MagnetosphereSchema>;
export type MissionType = (typeof MISSION_TYPES)[number];
export type MissionOutcome = (typeof MISSION_OUTCOMES)[number];
export type Mission = z.infer<typeof MissionSchema>;
export type Discovery = z.infer<typeof DiscoverySchema>;
export type FeatureItem = z.infer<typeof FeatureItemSchema>;
export type Features = z.infer<typeof FeaturesSchema>;
export type BodyDetails = z.infer<typeof BodyDetailsSchema>;
```
Range checks such as latitude and tilt live in `checks.ts`, not in the schema, so they produce readable build messages. The minor-gas `unit: 'ppm'` literal makes the "percent gas listed as minor" test fail parsing.

- [ ] **Step 4: Implement the checks and the fixtures**

`src/core/details/checks.ts`:
```ts
import { findUnresolvedSources } from '../catalog/references';
import type { BodyDetails } from './schema';

const EPS = 1e-6;
const validDate = (d: string) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

/** Spec §5 build checks. Returns one message per failed rule; empty means the file is consistent. */
export function checkDetails(details: BodyDetails, ctx: { radiusKm: number; knownSources: ReadonlySet<string> }): string[] {
  const p = `details/${details.bodyId}.json:`;
  const errors: string[] = [];
  const layers = details.interior?.layers ?? [];
  layers.forEach((layer, i) => {
    for (const [label, r] of [['outer', layer.outerRadiusKm], ['inner', layer.innerRadiusKm]] as const) {
      if (r.min < -EPS || r.max > ctx.radiusKm * 1.001) errors.push(`${p} interior ${layer.id} ${label} radius ${r.min}-${r.max} km outside 0-${ctx.radiusKm} km`);
    }
    if (layer.innerRadiusKm.min > layer.outerRadiusKm.max + EPS) errors.push(`${p} interior ${layer.id} inner radius above outer radius`);
    const next = layers[i + 1];
    if (next && next.outerRadiusKm.min > layer.outerRadiusKm.max + EPS) errors.push(`${p} interior layers out of order at ${layer.id} -> ${next.id} (outside in)`);
  });
  const innermost = layers.at(-1);
  if (innermost && innermost.innerRadiusKm.max > EPS) errors.push(`${p} innermost layer ${innermost.id} must have inner radius 0`);
  const atm = details.atmosphere;
  if (atm) {
    const total = atm.major.reduce((s, g) => s + g.amount, 0);
    if (total > 100.5) errors.push(`${p} major gases sum to ${total.toFixed(2)} %, over 100 %`);
    for (const g of atm.minor) if (g.amount >= 1e6) errors.push(`${p} minor gas ${g.formula} ${g.amount} ppm is not below 10^6 ppm`);
  }
  const f = details.features;
  if (f) {
    if (f.items.length > 200 || f.items.length > f.totalApproved.value) errors.push(`${p} ${f.items.length} features exceeds the 200 cap or the approved total`);
    for (const it of f.items) {
      if (it.latDeg < -90 || it.latDeg > 90) errors.push(`${p} feature ${it.name} latitude ${it.latDeg} outside [-90, 90]`);
      if (it.lonDegE < 0 || it.lonDegE >= 360) errors.push(`${p} feature ${it.name} longitude ${it.lonDegE} outside [0, 360)`);
      if (!(it.diameterKm > 0)) errors.push(`${p} feature ${it.name} diameter must be > 0`);
    }
  }
  for (const m of details.missions) {
    for (const d of [m.launchDate, m.arrivalDate, m.endDate]) if (d && !validDate(d)) errors.push(`${p} mission ${m.id} has invalid date ${d}`);
    if (m.arrivalDate && m.arrivalDate < m.launchDate) errors.push(`${p} mission ${m.id} arrival ${m.arrivalDate} before launch ${m.launchDate}`);
    if (m.endDate && m.endDate < (m.arrivalDate ?? m.launchDate)) errors.push(`${p} mission ${m.id} end ${m.endDate} before arrival/launch`);
  }
  const mag = details.magnetosphere;
  if (mag.kind === 'dipole') {
    if (!(mag.strengthGaussR3.value > 0)) errors.push(`${p} dipole strength must be > 0`);
    if (mag.tiltDeg && (mag.tiltDeg.value < 0 || mag.tiltDeg.value > 180)) errors.push(`${p} dipole tilt ${mag.tiltDeg.value} outside [0, 180]`);
    if (mag.offsetRadii && (mag.offsetRadii.value < 0 || mag.offsetRadii.value > 1)) errors.push(`${p} dipole offset ${mag.offsetRadii.value} outside [0, 1]`);
  }
  errors.push(...findUnresolvedSources(details, ctx.knownSources).map((e) => `${p} ${e}`));
  return errors;
}
```
Before relying on `findUnresolvedSources` (in `src/core/catalog/references.ts`), check that it finds `sourceId` keys at any depth. If it only walks known shapes, extend it generically and add a test.

`src/test/detailsFixtures.ts`: write the three fixtures with realistic values and the fixture source ids, so that `checkDetails` passes:
- **Mars:** two layers (crust from radius 3389.5 to 3339.5; core from 1830 to 0, `uncertain: true`); one major gas and one minor gas; `magnetosphere: { kind: 'none' }`; one mission; antiquity discovery; one feature.
- **Jupiter:** a dipole field; `features: null`.
- **Sun:** `magnetosphere: { kind: 'other' }`; `features: null`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/core/details`, then `npm test`, then `npm run typecheck`
Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add src
git commit -m "feat(data): body details schema and spec build checks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: NSSDCA per-planet and Sun fact-sheet parser

**Files:**
- Create: `pipeline/sources/nssdcPlanetSheet.ts`, `pipeline/sources/nssdcPlanetSheet.test.ts`, and `pipeline/fixtures/planets/<planet>fact.html` for the eight planets. Download each real page once from `https://nssdc.gsfc.nasa.gov/planetary/factsheet/<planet>fact.html` and commit it as a fixture, exactly as M1 did with `planet-factsheet.html`.
- Modify: `pipeline/sources/registry.ts` (per-planet sheet sources)

**Interfaces:**
- Produces:
  - `PLANET_SHEET_IDS = ['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune'] as const`;
  - `planetSheetUrl(id)`;
  - `planetSheetSpec(id, name): SourceSpec` with id `nssdca-<planet>-fact-sheet`, title `<Name> Fact Sheet (D. R. Williams)`, publisher `NASA Goddard Space Flight Center, NSSDCA` and licence `NASA public domain (NASA media usage guidelines)`.
- Produces:
  - `sheetText(html: string): string`: the page's visible text with line breaks kept. `<sub>`/`<sup>` contents are inlined (`CO<sub>2</sub>` becomes `CO2`), other tags removed and entities decoded with the existing `decodeEntities`.
  - `parseComposition(text, heading: RegExp, sourceId): Atmosphere | null`.
  - `parseMagnetosphere(text, sourceId): Extract<Magnetosphere, { kind: 'dipole' }> | null`.
  - `parseSunField(text, sourceId): Extract<Magnetosphere, { kind: 'other' }>`.
  - `PLANET_ATMOSPHERE_HEADING = /^Atmospheric composition\s*\(([^)]*)\)\s*:?/i` and `SUN_COMPOSITION_HEADING = /^Photosphere Composition\s*:?/i`.

The real formats vary per planet (see Review Focus #2). The parser works on the text block that starts at the heading line:
1. **Section lines** begin, after trimming, with `Major`, `Minor (ppm)`, `Major elements`, `Minor elements (ppm)` or `Aerosols`.
2. **Continuation lines** contain a `(Formula)` group or start with `Formula - number`. They may or may not be indented: Saturn's `(NH3) - 125 (75);` starts at column 0. They join the current section with a space, which repairs Saturn's broken `Ammonia` / `(NH3)`. An `Aerosols:` section is not parsed as gases; its text is appended to the note as `Aerosols: …`.
3. **Note lines.** The block ends at the first blank line. Lines before it that are neither section nor continuation lines (Earth's "Numbers do not add up…", "Water is highly variable…") become `note` text. If the heading's basis is not by volume and is not the Sun (Mercury: "Column abundances…"), no gases are parsed. Instead the parenthesised paragraph that follows the block, after the blank line ("(The atmosphere of Mercury is a surface bounded exosphere… given as ranges.)"), becomes the note, without its outer parentheses. `major` and `minor` are empty.
4. **Splitting entries.** Before splitting, insert `;` after a complete `…(Formula) - n%` entry (with optional `(u%)`) that runs straight into a capitalised word, which handles Mars's `2.59% Argon`. Then split on `;` and on commas outside parentheses.
5. **Entry patterns,** tried in order (the first match wins; anything else throws `Unrecognised atmosphere entry "<text>"`):
   - **amount first:** `^([\d.]+)%\s+(.+?)\s*\(([^)]+)\)$`, as in Venus `96.5% Carbon Dioxide (CO2)`;
   - **name (formula) amount:** `^(.+?)\s*\(([^)]+)\)\s*-?\s*([\d.,]+)\s*%?\s*(?:\(([\d.]+)%?\))?(?:\s*\(varies[^)]*\))?$`, as in `Methane (CH4) - 3000 (1000)` or Neptune `Methane (CH4) 1.5% (0.5%)`;
   - **symbol amount:** `^([A-Z][A-Za-z0-9]*)\s*-\s*([\d.,]+)\s*%?$`, as in Earth `CH4 - 1.94` or the Sun `He - 8.889%`. The name comes from a small table (H Hydrogen, He Helium, O Oxygen, C Carbon, Ne Neon, N Nitrogen, Fe Iron, Mg Magnesium, Si Silicon, S Sulfur, CH4 Methane), or is the formula itself.
6. **Units:** gases in a `Major` section get unit `%`; gases in a `Minor (ppm)` section get unit `ppm`. Amounts drop thousands commas. Uncertainty is the parenthesised number, or `null`.

- [ ] **Step 1: Write the failing tests**

`pipeline/sources/nssdcPlanetSheet.test.ts`. Read the fixtures with `readFileSync('pipeline/fixtures/planets/<p>fact.html', 'utf8')` and the Sun from `pipeline/fixtures/sun-factsheet.html`, then assert:
```ts
const gases = (a: Atmosphere | null) => a && { major: a.major.map((g) => [g.formula, g.amount, g.uncertainty]), minor: a.minor.map((g) => [g.formula, g.amount]) };
// Mars
expect(gases(parseComposition(sheetText(mars), PLANET_ATMOSPHERE_HEADING, 'm'))).toEqual({
  major: [['CO2', 95.1, null], ['N2', 2.59, null], ['Ar', 1.94, null], ['O2', 0.16, null], ['CO', 0.06, null]],
  minor: [['H2O', 210], ['NO', 100], ['Ne', 2.5], ['HDO', 0.85], ['Kr', 0.3], ['Xe', 0.08]],
});
// Venus (amount first)
expect(gases(...venus...)!.major).toEqual([['CO2', 96.5, null], ['N2', 3.5, null]]);
// Earth (formula-only CH4, note lines)
expect(gases(...earth...)!.minor).toEqual([['Ar', 9340], ['CO2', 420], ['Ne', 18.18], ['He', 5.24], ['CH4', 1.94], ['Kr', 1.14], ['H2', 0.55]]);
expect(earthAtm!.note!.text).toMatch(/Water is highly variable/);
// Jupiter (uncertainties, "varies with pressure")
expect(gases(...jupiter...)).toEqual({ major: [['H2', 89.8, 2.0], ['He', 10.2, 2.0]], minor: [['CH4', 3000], ['NH3', 260], ['HD', 28], ['C2H6', 5.8], ['H2O', 4]] });
// Saturn (names broken across lines)
expect(gases(...saturn...)!.minor).toEqual([['CH4', 4500], ['NH3', 125], ['HD', 110], ['C2H6', 7]]);
// Uranus (three majors), Neptune (no dash)
expect(gases(...uranus...)!.major.map((g) => g[0])).toEqual(['H2', 'He', 'CH4']);
expect(gases(...neptune...)!.major).toEqual([['H2', 80.0, 3.2], ['He', 19.0, 3.2], ['CH4', 1.5, 0.5]]);
// Mercury (exosphere note, no gases)
expect(mercuryAtm).toMatchObject({ major: [], minor: [] });
expect(mercuryAtm!.note!.text).toMatch(/surface bounded exosphere/);
// Sun photosphere
expect(gases(parseComposition(sheetText(sun), SUN_COMPOSITION_HEADING, 's'))).toEqual({
  major: [['H', 90.965, null], ['He', 8.889, null]],
  minor: [['O', 774], ['C', 330], ['Ne', 112], ['N', 102], ['Fe', 43], ['Mg', 35], ['Si', 32], ['S', 15]],
});
```
Magnetosphere:
```ts
expect(parseMagnetosphere(sheetText(jupiter), 'j')).toMatchObject({
  kind: 'dipole', strengthGaussR3: { value: 4.3 }, tiltDeg: { value: 9.4 }, tiltLongitudeDeg: { value: 200.1 },
  offsetRadii: { value: 0.119 }, referenceRadiusKm: { value: 71398 }, surfaceFieldGauss: { min: 4.0, max: 13.0 }, dipolePole: null,
});
expect(parseMagnetosphere(sheetText(earth), 'e')).toMatchObject({ tiltDeg: null, dipolePole: { latDeg: 80.65, lonDegE: 287.32 }, referenceRadiusKm: { value: 6378 } });
expect(parseMagnetosphere(sheetText(saturn), 's')!.tiltDeg!.value).toBe(0);
expect(parseMagnetosphere(sheetText(neptune), 'n')!.tiltLongitudeDeg!.value).toBe(288);
expect(parseMagnetosphere(sheetText(mercury), 'm')).toMatchObject({ strengthGaussR3: { value: 0.002 }, offsetRadii: { value: 0.17 }, referenceRadiusKm: { value: 2440 } });
expect(parseMagnetosphere(sheetText(mars), 'x')).toBeNull();
expect(parseMagnetosphere(sheetText(venus), 'x')).toBeNull();
expect(parseSunField(sheetText(sun), 's').note.text).toMatch(/Polar field 1–2 G.*Sunspots 3000 G/);
```
Also test that `parseComposition` throws `Unrecognised atmosphere entry` for a made-up block line such as `    Major: ??? 5 parts`.

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run pipeline/sources/nssdcPlanetSheet.test.ts`
Expected: FAIL (the module is missing).

- [ ] **Step 3: Implement**

Implement the algorithm above. `parseMagnetosphere` finds the line matching `/Magnetosphere\s*$/i`, which is the heading, and reads the following 16 lines, stopping early at a line ending in `Atmosphere`. Earth's `Geomagnetic Poles - Model WMM2020` sub-heading sits inside the block and must not stop it. It reads:
- `Dipole field strength: (n) Gauss-R.3`;
- `Dipole tilt to rotational axis: (n)` (optional `degrees`);
- `Longitude of tilt: (n)`;
- `Dipole offset: (n) R.` (case-insensitive);
- `Surface (1 R.) field strength: ~?(a) - (b) Gauss`;
- `Geocentric Dipole: (lat) N, (lon) W|E`, where west longitudes become `360 − lon` east;
- the reference radius, from the `R. denotes … defined (here )?to be (n,nnn) km` line in the same block.

`parseSunField` turns the "Solar Magnetic Field" lines into one note: `Typical field strengths (Gauss): Polar field 1–2 G; Sunspots 3000 G; Prominences 10–100 G; …`, using an en dash for ranges.

Add `planetSheetSpec` and `planetSheetUrl` to `registry.ts` beside `nasaScienceSpec`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run pipeline/sources`, then `npm test`, then `npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
git add pipeline
git commit -m "feat(pipeline): parse atmosphere composition and magnetosphere from the NSSDCA per-planet and Sun fact sheets" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Zip and dBASE readers, and Gazetteer feature selection

**Files:**
- Create: `pipeline/lib/zip.ts`, `pipeline/lib/zip.test.ts`, `pipeline/lib/dbf.ts`, `pipeline/lib/dbf.test.ts`, `pipeline/sources/gazetteer.ts`, `pipeline/sources/gazetteer.test.ts`

**Interfaces:**
- Produces (`zip.ts`): `readZipEntry(zip: Buffer, nameSuffix: string): Buffer`.
  - It finds the End of Central Directory record (`0x06054b50`) by scanning back from the end, then walks the central directory (`0x02014b50`) for the entry whose name ends with `nameSuffix`.
  - It reads the local header (`0x04034b50`), skips the name and extra fields, and returns the data: stored (method 0) as is, deflated (method 8) through `zlib.inflateRawSync`.
  - Throws `zip: no entry ending with <suffix>` or `zip: unsupported compression <n>`.
- Produces (`dbf.ts`): `readDbf(buf: Buffer): Array<Record<string, string>>`.
  - It reads a dBASE III file (version byte 3): record count from bytes 4–7, header length from 8–9 and record length from 10–11.
  - Field descriptors are 32-byte entries from offset 32 up to the `0x0d` terminator: name from bytes 0–10, NUL-trimmed; type from byte 11; length from byte 16.
  - It skips records whose first byte is `0x2a` (deleted), decodes each field as UTF-8 and trims it.
- Produces (`gazetteer.ts`):
  - `GAZETTEER_TARGETS = { mercury: 'MERCURY', venus: 'VENUS', mars: 'MARS' } as const`;
  - `gazetteerUrl(target)` returns `https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/${target}_nomenclature_center_pts.zip`;
  - `gazetteerSpec(bodyId, name): SourceSpec` with id `usgs-gazetteer-<bodyId>`, title `<Name> nomenclature (feature centre points), Gazetteer of Planetary Nomenclature`, publisher `USGS Astrogeology Science Center / IAU Working Group for Planetary System Nomenclature`, the url above and licence `Public domain (USGS)`;
  - `selectFeatures(rows, sourceId, limit = 200): Features`.
- `selectFeatures` uses the real columns, verified against the 2026-10-10 download: `name`, `clean_name`, `approvaldt` (`YYYY/MM/DD hh:mm:ss`), `origin`, `diameter`, `center_lon` (0–360 east; 360 occurs), `center_lat`, `type` (`"Crater, craters"`) and `approval` (`"Adopted by IAU"`).
  - It keeps rows whose `approval` starts with `Adopted`; `totalApproved` is their count.
  - It drops rows with a diameter ≤ 0, sorts by diameter descending then name, and keeps `limit`.
  - Each item takes `name` from `clean_name` (or `name`), `type` as the text before the first comma, `lonDegE` normalised to [0, 360), `approvedYear` from the first four digits of `approvaldt` (or `null`) and `origin` trimmed.
  - `thresholdKm` is the smallest kept diameter.

- [ ] **Step 1: Write the failing tests**

- **`zip.test.ts`:** build a zip in the test with a helper `makeZip(entries: Array<{ name: string; data: Buffer; deflate: boolean }>)` that writes local headers, data (`zlib.deflateRawSync` when `deflate`), the central directory and the EOCD record. Assert that `readZipEntry` returns both a stored and a deflated entry byte for byte, and throws for a missing suffix.
- **`dbf.test.ts`:** build a dBASE III buffer with a helper `makeDbf(fields: Array<{ name: string; type: 'C' | 'N'; len: number }>, rows: string[][], deletedRows: number[] = [])`. Assert the rows round-trip, deleted rows are skipped, and a UTF-8 name such as `Jürgen` decodes.
- **`gazetteer.test.ts`:** call `selectFeatures` on five hand-made rows:
  - Olympus Mons, 648.9 km, approved 1973, lon 226.2;
  - a 360-longitude feature;
  - a dropped (`approval: 'Dropped'`) feature;
  - a 0-diameter feature;
  - a small crater.

  With `limit = 2`, assert `totalApproved` = 4, two items sorted by diameter, `thresholdKm` = the second item's diameter, lon 360 becomes 0, `type: 'Mons'` from `'Mons, montes'`, and `approvedYear: 1973`.

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run pipeline/lib pipeline/sources/gazetteer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the three modules as specified above.**

- [ ] **Step 4: Run the tests on real data**

Run: `npx vitest run pipeline/lib pipeline/sources`
Expected: PASS.

Then, in a scratch script outside the repo, download `MARS_nomenclature_center_pts.zip` and run `readZipEntry` → `readDbf` → `selectFeatures`. Expect about 2052 approved features, a cut-off near 499 km, and Olympus Mons and Valles Marineris in the list. Record the numbers in your report.

- [ ] **Step 5: Commit**

```powershell
git add pipeline
git commit -m "feat(pipeline): minimal zip and dBASE readers and USGS Gazetteer feature selection" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Curated references with quote, number and date checks

**Files:**
- Create: `pipeline/sources/quotedReference.ts`, `pipeline/sources/quotedReference.test.ts`, `pipeline/reference/README.md`

**Interfaces:**
- Produces the types for the curated files (Tasks 5–6 write them; Task 7 reads them):
```ts
export interface CuratedSource { id: string; title: string; publisher: string; url: string; license: string }
export interface Quoted { sourceId: string; quote: string }
export interface QuotedRange extends Quoted { min: number; max: number }
export interface CuratedLayer {
  id: string; name: string; from: 'radius' | 'depth' | 'percent';
  outer: QuotedRange; inner: QuotedRange;      // radii in km, depths in km below the surface, or percent of the body's radius from the centre
  state: 'solid' | 'liquid' | 'gas' | 'plasma' | 'unknown';
  composition: (Quoted & { text: string }) | null;
  uncertain: boolean;
}
export interface CuratedMission { id: string; name: string; agency: string; type: MissionType; launchDate: string; arrivalDate: string | null; endDate: string | null; outcome: MissionOutcome; sourceId: string; quotes: string[] }
export type CuratedDiscovery = (Quoted & { kind: 'antiquity' }) | (Quoted & { kind: 'discovered'; by: string; date: string; method: string });
export interface InteriorsFile { sources: CuratedSource[]; bodies: Record<string, { layers: CuratedLayer[] }> }
export interface MissionsFile { sources: CuratedSource[]; bodies: Record<string, { discovery: CuratedDiscovery | null; missions: CuratedMission[] }> }
```
- Produces the checks:
  - `pageText(html: string): string`: visible text with `<script>`, `<style>` and `<noscript>` removed, tags replaced by spaces, entities decoded, curly quotes made straight, en and em dashes made hyphens, NBSP made a space, whitespace collapsed.
  - `normaliseQuote(q: string): string`: the same character normalisation, applied to a quote.
  - `quoteOnPage(quote, page): boolean`: a case-insensitive substring test after normalising both.
  - `numbersIn(text): number[]`: every number in the text, thousands commas removed (`2,100` gives 2100, `1650–1675` gives [1650, 1675], `3.25` gives 3.25), so "1830" never matches inside "18300".
  - `quoteHasNumber(quote, n): boolean`: whether `n` is among `numbersIn(quote)`, within 1e-9 relative.
  - `kmIn(text): number[]`: the numbers that are stated in kilometres. A number counts when it is followed by `km`, `kilometer(s)` or `kilometre(s)`. It also counts when it is the first number of a range whose second number is: `1,650–1,675 km`, `between 1,650 and 1,675 km`, `1650 to 1675 kilometers`.
  - `percentIn(text): number[]` and `quoteHasPercent(quote, n)`: the same rule for numbers followed by `%` or `percent`, used for `from: 'percent'` layers.
  - `quoteHasKm(quote, n): boolean`: whether `n` is among `kmIn(quote)`. This catches the miles-first trap: in "about 2,100 miles (3,400 km)", 3400 passes and 2100 fails.
  - `quoteHasDate(quotes: string[], isoDate: string): boolean`: whether any quote contains the date as `November 28, 1964`, `Nov. 28, 1964`, `28 November 1964` or `1964-11-28`. A date ending `-01-01` with no day evidence also matches on the year alone, for planned launches given only as a year.
  - `verifyInteriors(file, pages: Map<sourceId, string>): string[]`: for every layer, the source is registered, its page text exists, the quote is on the page, and `outer.min`/`outer.max`/`inner.min`/`inner.max` are each in that range's quote *as kilometres* (`quoteHasKm`), or as percentages (`quoteHasPercent`) for `from: 'percent'`. A value of 0 is exempt: a depth of 0 at the surface, or an inner radius of 0 at the centre. Curators write the outermost layer with `from: 'depth'` (outer depth 0), and Task 7 converts depths to radii using the body's cited mean radius. The composition quote is on the page.
  - `verifyMissions(file, pages): string[]`: for every mission, each quote is on the page, the launch date is in a quote, and the arrival and end dates are in a quote when present. For discovery, the quote is on the page, and for `discovered` its date is in the quote.
- Produces `pipeline/reference/README.md`, which explains the curated format, the rule that only official sources may be used, the quote rule, the miles-first trap, and how to add an entry.

- [ ] **Step 1: Write the failing tests**

`pipeline/sources/quotedReference.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { kmIn, numbersIn, pageText, quoteHasDate, quoteHasKm, quoteHasNumber, quoteOnPage, verifyInteriors, verifyMissions } from './quotedReference';

const html = '<html><script>x</script><p>Mars has a core about 2,100 miles (3,400 km)&nbsp;wide &mdash; it&rsquo;s liquid.</p><p>Mariner 4 launched on Nov. 28, 1964, and flew past Mars on July 14, 1965.</p></html>';

describe('quoted references (Review Focus #1)', () => {
  it('normalises page text and finds quotes regardless of entities and dashes', () => {
    expect(pageText(html)).toContain("about 2,100 miles (3,400 km) wide - it's liquid.");
    expect(quoteOnPage('a core about 2,100 miles (3,400 km) wide', pageText(html))).toBe(true);
    expect(quoteOnPage('a core about 2,200 miles', pageText(html))).toBe(false);
  });
  it('matches whole numbers only, so km is accepted and miles is not mistaken for km', () => {
    const q = 'a core about 2,100 miles (3,400 km) wide';
    expect(numbersIn(q)).toEqual([2100, 3400]);
    expect(quoteHasNumber(q, 3400)).toBe(true);
    expect(quoteHasNumber(q, 340)).toBe(false);
    expect(numbersIn('between 1650–1675 km')).toEqual([1650, 1675]);
  });
  it('accepts only numbers stated in kilometres (the miles-first trap)', () => {
    const q = 'a core about 2,100 miles (3,400 km) wide';
    expect(kmIn(q)).toEqual([3400]);
    expect(quoteHasKm(q, 3400)).toBe(true);
    expect(quoteHasKm(q, 2100)).toBe(false);
    expect(kmIn('a core radius between 1,650 and 1,675 km')).toEqual([1650, 1675]);
    expect(kmIn('roughly 1650 to 1675 kilometers')).toEqual([1650, 1675]);
  });
  it('finds mission dates written several ways', () => {
    const q = ['Mariner 4 launched on Nov. 28, 1964, and flew past Mars on July 14, 1965.'];
    expect(quoteHasDate(q, '1964-11-28')).toBe(true);
    expect(quoteHasDate(q, '1965-07-14')).toBe(true);
    expect(quoteHasDate(q, '1965-07-15')).toBe(false);
  });
  it('reports a layer whose number is not in its quote', () => {
    const pages = new Map([['p', pageText(html)]]);
    const file = {
      sources: [{ id: 'p', title: 't', publisher: 'NASA', url: 'u', license: 'l' }],
      bodies: { mars: { layers: [{ id: 'core', name: 'Core', from: 'radius' as const, outer: { min: 2100, max: 2100, sourceId: 'p', quote: 'a core about 2,100 miles (3,400 km) wide' }, inner: { min: 0, max: 0, sourceId: 'p', quote: 'a core about 2,100 miles (3,400 km) wide' }, state: 'liquid' as const, composition: null, uncertain: false }] } },
    };
    expect(verifyInteriors(file, pages).join()).toMatch(/2100 km not in quote/); // 2,100 is miles in the quote
    file.bodies.mars.layers[0]!.outer.min = 3400;
    file.bodies.mars.layers[0]!.outer.max = 3400;
    expect(verifyInteriors(file, pages)).toEqual([]);
  });
  it('reports a mission quote missing from the page and an arrival date not in any quote', () => {
    const pages = new Map([['p', pageText(html)]]);
    const file = {
      sources: [{ id: 'p', title: 't', publisher: 'NASA', url: 'u', license: 'l' }],
      bodies: { mars: { discovery: { kind: 'antiquity' as const, sourceId: 'p', quote: 'it’s liquid' }, missions: [{ id: 'mariner-4', name: 'Mariner 4', agency: 'NASA', type: 'flyby' as const, launchDate: '1964-11-28', arrivalDate: '1965-07-15', endDate: null, outcome: 'success' as const, sourceId: 'p', quotes: ['Mariner 4 launched on Nov. 28, 1964, and flew past Mars on July 14, 1965.'] }] } },
    };
    expect(verifyMissions(file, pages).join()).toMatch(/mariner-4.*arrival 1965-07-15/);
  });
});
```
Interior radii must appear as kilometres in their quote (`quoteHasKm`). Mission dates must appear as dates (`quoteHasDate`). Bare digit matching is only used where no unit applies.

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run pipeline/sources/quotedReference.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `quotedReference.ts` and write `pipeline/reference/README.md`.**

- [ ] **Step 4: Run the tests**

Run: `npx vitest run pipeline/sources`, then `npm test`, then `npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
git add pipeline
git commit -m "feat(pipeline): curated reference format with quote, number and date checks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Curate interior layers (Sun and eight planets)

**Files:**
- Create: `pipeline/reference/interiors.json`, `pipeline/reference/interiors.test.ts`

**Interfaces:**
- Consumes: the `InteriorsFile` and `CuratedLayer` types and `verifyInteriors` from Task 4.
- Produces: `pipeline/reference/interiors.json`, with entries for `sun`, `mercury`, `venus`, `earth`, `mars`, `jupiter`, `saturn`, `uranus` and `neptune`. A body whose layers no official source states with numbers may be omitted; it then gets `interior: null`. List any omission in the report.

This is a research task. Use `WebFetch` to read the pages.
- **Allowed sources:**
  - NASA Science (`science.nasa.gov`): each planet's "Facts" or "In Depth" pages, and the Sun's;
  - NSSDCA fact sheets (`nssdc.gsfc.nasa.gov`): the planet sheets give core radius, with footnotes;
  - NASA mission science pages (`nasa.gov`, `jpl.nasa.gov`; for example InSight results for Mars' core, Juno for Jupiter);
  - USGS Astrogeology.
- **Not allowed:** Wikipedia, encyclopaedias or news sites.
- **Target layers per body**, when an official source gives numbers:

| Body | Layers |
|---|---|
| Sun | core, radiative zone, convection zone (as `percent` of the solar radius, or km) |
| Mercury, Venus, Earth, Mars | crust, mantle, core (Earth: outer core and inner core) |
| Jupiter, Saturn | atmosphere or outer envelope, the metallic hydrogen layer, and the core with `uncertain: true` where the source hedges |
| Uranus, Neptune | atmosphere, icy or "water–ammonia–methane" mantle, rocky core |

- **Rules:**
  - **Units:** every number must appear in the quote in kilometres, or in % for `percent` layers. Never record the miles figure.
  - **Disagreements:** when sources disagree (for example the Mars core in the NSSDCA footnote 1650–1675 km against 1830 km), record a range `{ min, max }`, citing the source that states the range.
  - **Outermost layer:** use `from: 'depth'` with outer depth 0. The quote must state the layer's thickness or depth.
  - **Innermost layer:** inner radius 0.
  - **Composition text:** one short sentence, taken from the source.
  - **Quotes:** each is ≤ 300 characters, copied from the page text exactly, entities as shown. One `CuratedSource` per page; ids are kebab-case (for example `nasa-science-mars-facts`).

- [ ] **Step 1: Write the test that runs the quote check against the cached pages**

`pipeline/reference/interiors.test.ts`:
```ts
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { pageText, verifyInteriors, type InteriorsFile } from '../sources/quotedReference';

const file = JSON.parse(readFileSync('pipeline/reference/interiors.json', 'utf8')) as InteriorsFile;

describe('curated interiors', () => {
  it('covers the Sun and the eight planets, or lists the omission', () => {
    const ids = Object.keys(file.bodies);
    for (const id of ids) expect(['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']).toContain(id);
    expect(ids.length).toBeGreaterThanOrEqual(7);
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
```
To make the cache files, fetch each source page once into `pipeline/raw/ref-<id>.html`, with its `.meta.json`, using `fetchCached` from a scratch script. Task 7 does the same inside `run.ts`.

- [ ] **Step 2: Run, and confirm it fails because the file is missing**

Run: `npx vitest run pipeline/reference`
Expected: FAIL (ENOENT).

- [ ] **Step 3: Research and write `interiors.json`; iterate until the check passes**

Run: `npx vitest run pipeline/reference`, after caching the pages.
Expected: PASS.

In the report, include a table per body: each layer, its outer and inner bounds in km, its source and its quote. Name every layer you could not support, and why.

- [ ] **Step 4: Commit**

```powershell
git add pipeline/reference
git commit -m "data(reference): curated, quoted interior layers for the Sun and the planets" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Curate key missions and discovery (Sun and eight planets)

**Files:**
- Create: `pipeline/reference/missions.json`, `pipeline/reference/missions.test.ts`

**Interfaces:**
- Consumes: the `MissionsFile`, `CuratedMission` and `CuratedDiscovery` types and `verifyMissions` from Task 4.
- Produces: `pipeline/reference/missions.json`, with all nine bodies.

This is a research task, under the same allowed-source rule as Task 5. Good sources are the NASA mission pages (`science.nasa.gov/mission/<name>/`, `nasa.gov`, `jpl.nasa.gov`) and the NSSDCA Master Catalog spacecraft pages (`nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=…`), which state launch dates. ESA, JAXA, ISRO and CNSA missions may be cited to NASA or NSSDCA pages that describe them. Agency pages (`esa.int`, `global.jaxa.jp`, `isro.gov.in`) are acceptable official sources for their own missions.

- **Per body, about 5 to 12 landmark missions:**

| Body | Missions |
|---|---|
| Mercury | Mariner 10, MESSENGER, BepiColombo |
| Venus | Mariner 2, Venera 7, Venera 13, Magellan, Venus Express, Akatsuki |
| Earth | Sputnik 1, Explorer 1, TIROS-1, Landsat 1, Apollo 8; one or two current flagship Earth-observing missions |
| Mars | Mariner 4, Mariner 9, Viking 1, Mars Pathfinder, Mars Global Surveyor, Spirit/Opportunity, Curiosity, InSight, Perseverance, Tianwen-1 |
| Jupiter | Pioneer 10, Voyager 1, Galileo, Juno, Juice, Europa Clipper |
| Saturn | Pioneer 11, Voyager 1, Voyager 2, Cassini–Huygens |
| Uranus, Neptune | Voyager 2 |
| Sun | Helios 1, Ulysses, SOHO, SDO, Parker Solar Probe, Solar Orbiter |

- **Fields for each mission:**
  - `type`: one of the schema types;
  - `launchDate`: always present;
  - `arrivalDate`: the flyby, orbit insertion or landing date; `null` for Earth orbiters and for Sun observatories;
  - `endDate`: when it is stated;
  - `outcome`: one of `success | partial | failure | ongoing | planned`;
  - `quotes`: sentences that contain every date recorded. Use several quotes from the same page if needed.
- **Discovery:**
  - Uranus: `discovered`, William Herschel, 1781-03-13, method "telescopic observation";
  - Neptune: `discovered`, Johann Galle with Urbain Le Verrier's prediction, 1846-09-23, method "telescopic search at a mathematically predicted position";
  - Mercury, Venus, Mars, Jupiter and Saturn: `antiquity`, with a quote such as "known since ancient times" from a NASA page; `null` if no official page says so;
  - Earth and the Sun: `null`.

- [ ] **Step 1: Write the test**

`pipeline/reference/missions.test.ts` mirrors the interiors test:
- every body id is one of the nine;
- every mission's `type` and `outcome` are in the schema enums;
- launch ≤ arrival ≤ end;
- `verifyMissions(file, pages)` returns `[]` when the cached `ref-<id>.html` pages exist.

- [ ] **Step 2: Run, and confirm it fails because the file is missing**

Run: `npx vitest run pipeline/reference/missions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Research and write `missions.json`; cache the pages; iterate until the check passes**

Run: `npx vitest run pipeline/reference`
Expected: PASS.

In the report, include a table per body: each mission, its dates, its outcome and its source.

- [ ] **Step 4: Commit**

```powershell
git add pipeline/reference
git commit -m "data(reference): curated, quoted key missions and discovery for the Sun and the planets" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Build the details files in the pipeline

**Files:**
- Create: `pipeline/build/buildDetails.ts`, `pipeline/build/buildDetails.test.ts`
- Modify:
  - `pipeline/run.ts` (fetch, build, check, write);
  - `pipeline/build/validate.ts` (validate the details files and the merged sources);
  - `src/core/catalog/references.ts`, only if Task 1 found it needs a generic walk.
- Generate: `public/data/solar-system/details/*.json` and `public/data/sources.json` (adds the new sources)
- Create (vault): `Space_visualizer/Data Sources/NSSDCA Planet Fact Sheets.md`, `Space_visualizer/Data Sources/USGS Gazetteer of Planetary Nomenclature.md`, `Space_visualizer/Data Sources/NASA mission and science pages (curated).md`. Link all three from `Home.md` under Data Sources.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces:
```ts
export const DETAIL_BODY_IDS = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const;
export interface DetailsInputs {
  bodies: readonly Body[];                                   // the bodies just built (bodies.json content)
  existingSourceIds: ReadonlySet<string>;                    // sources already in sources.json
  planetSheets: Record<(typeof PLANET_SHEET_IDS)[number], FetchedText>;
  sunSheet: FetchedText;
  gazetteer: Partial<Record<keyof typeof GAZETTEER_TARGETS, { rows: Array<Record<string, string>>; retrievedAt: string }>>;
  interiors: InteriorsFile;
  missions: MissionsFile;
  curatedPages: ReadonlyMap<string, FetchedText>;            // CuratedSource.id -> fetched page
}
export function buildDetails(inputs: DetailsInputs, generatedAt: string): { details: BodyDetails[]; sources: Source[]; errors: string[] };
```
- **Assembly per body:**
  - **Radius R** is `facts.meanRadiusKm`, falling back to `shape.equatorialRadiusKm`.
  - **Interior:** converts the curated layers. A `depth` range [a, b] becomes radii [R − b, R − a]. A `percent` value p becomes R·p/100. Each converted range keeps the curated `sourceId`, with the quote fields dropped. With no curated entry, `interior` is `null`.
  - **Atmosphere:**
    - planets: `parseComposition(sheetText(planetSheet), PLANET_ATMOSPHERE_HEADING, 'nssdca-<p>-fact-sheet')`;
    - Sun: `parseComposition(sheetText(sunSheet), SUN_COMPOSITION_HEADING, 'nssdca-sun-fact-sheet')`.
  - **Magnetosphere,** first that applies:
    - `parseMagnetosphere` (a dipole);
    - `{ kind: 'none', sourceId }`, when `facts.hasGlobalMagneticField.value === false`, citing that fact's source;
    - `parseSunField`, for the Sun;
    - otherwise an error `details/<id>.json: no magnetosphere source`.
  - **Missions and discovery:** from `missions.json`, with `quotes` and `quote` dropped.
  - **Features:** `selectFeatures(rows, 'usgs-gazetteer-<id>')` for Mercury, Venus and Mars; `null` for the rest.
- **Sources:** new entries are `planetSheetSpec` for the eight planets, `gazetteerSpec` for the three Gazetteer bodies and every `CuratedSource`. Each gets `retrievedAt` from its fetch, and only sources a details file actually references are kept. No new id may collide with `existingSourceIds`.
- **Errors:** collected from:
  - `verifyInteriors` and `verifyMissions`, against `pageText` of `curatedPages`;
  - `BodyDetailsSchema.safeParse` for each file;
  - `checkDetails(details, { radiusKm: R, knownSources: existing ∪ new })`.

- [ ] **Step 1: Write the failing tests**

`pipeline/build/buildDetails.test.ts` builds inputs from:
- the stored fact-sheet fixtures (Task 2);
- a tiny in-memory Gazetteer row set;
- a small inline `InteriorsFile` and `MissionsFile` whose quotes appear in an inline HTML page;
- the bodies from `makeCatalogFiles()`, extended with fixture bodies as needed for Mars, Venus and the Sun, using the existing fixture builders.

It asserts:
- Mars gets a `none` magnetosphere citing its `hasGlobalMagneticField` source, a parsed atmosphere (CO2 95.1), features from the rows, and interior radii converted from depth (outer radius = R − 0);
- Jupiter gets a dipole field and `features: null`;
- the Sun gets the `other` field note and photosphere gases;
- new sources include `nssdca-mars-fact-sheet` and `usgs-gazetteer-mars` with `retrievedAt`, and nothing unreferenced;
- a curated quote missing from its page appears in `errors`;
- a collision with an existing source id appears in `errors`.

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run pipeline/build/buildDetails.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `buildDetails.ts`, then wire `run.ts`**

In `run.ts`, after `buildSolarSystem`:
- fetch each planet sheet with `fetchCached(planetSheetUrl(id), \`nssdca-${id}-fact.html\`, options)`;
- fetch each Gazetteer zip with `fetchBinaryCached(gazetteerUrl(target), \`gazetteer-${target}.zip\`, options)`, from `pipeline/textures/fetchBinary.ts`, then `readZipEntry(buffer, '.dbf')` and `readDbf`;
- read `pipeline/reference/interiors.json` and `missions.json`;
- fetch each curated source page with `fetchCached(url, \`ref-${id}.html\`, options)`;
- call `buildDetails`;
- merge the new sources into `output.sources.sources` before `validateOutput`;
- add the details errors to the validation errors.

Only when there are no errors does it write `public/data/solar-system/details/<id>.json` for every body. The existing guarantee holds: on any error nothing in `public/data` changes. `validate.ts` also runs `BodyDetailsSchema` and `findUnresolvedSources` on each details file against the merged sources.

- [ ] **Step 4: Regenerate and inspect**

Run: `npm run data`. This fetches into the cache; the network is needed once. Then run `npm run data:offline`. It must reproduce byte-identical details files, apart from `generatedAt`.
Expected:
- nine details files exist;
- `sources.json` gains the new sources;
- no validation errors.

Open `details/mars.json` and `details/jupiter.json` and check them against the fact sheets by eye. Report the size of each file; each should be ≤ 60 KB. If Mars, Venus or Mercury is larger, the feature `origin` texts are the likely cause; report it rather than truncating.

- [ ] **Step 5: Write the three Data Sources notes**

Follow the format of the existing notes. Cover:
- the publisher, URL pattern, licence and retrieval;
- what is used, and how it is parsed;
- the checks that apply;
- for the curated note, the quote rule and the list of pages used. Generate the list from `interiors.json` and `missions.json`.

Link them from `Home.md`.

- [ ] **Step 6: Run the tests and commit**

Run: `npm test`, then `npm run typecheck`
Expected: all PASS.

```powershell
git add pipeline public/data Space_visualizer
git commit -m "feat(pipeline): build cited per-body details files (interior, atmosphere, field, missions, features)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: On-demand details store

**Files:**
- Create: `src/state/detailsStore.ts`, `src/state/detailsStore.test.ts`

**Interfaces:**
- Consumes: `BodyDetailsSchema` and `BodyDetails` (Task 1).
- Produces:
```ts
export const DETAILS_DIR = 'data/solar-system/details/';
export type DetailsEntry =
  | { status: 'loading' }
  | { status: 'ready'; details: BodyDetails }
  | { status: 'missing' }
  | { status: 'error'; message: string };
export const useDetailsStore: UseBoundStore<StoreApi<{
  entries: Record<string, DetailsEntry>;
  load(bodyId: string, fetchImpl?: typeof fetch): Promise<void>;   // no-op while loading or when ready; reloads after missing/error only via retry
  retry(bodyId: string, fetchImpl?: typeof fetch): Promise<void>;
}>>;
export function useBodyDetails(bodyId: string | undefined): DetailsEntry | undefined; // starts load() in an effect when the body has no entry
export function readyDetails(entry: DetailsEntry | undefined): BodyDetails | null;
```
- **Behaviour of `load`:**
  - It fetches `${import.meta.env.BASE_URL}${DETAILS_DIR}${bodyId}.json`.
  - HTTP 404 gives `missing`.
  - A non-OK status, a network error, invalid JSON, a schema failure, or a file whose `bodyId` differs gives `error`, with a message.
  - Success gives `ready`.
  - Entries are keyed by body id, so a late response for one body can never fill another body's entry (Review Focus #3).

- [ ] **Step 1: Write the failing tests**

`src/state/detailsStore.test.ts`, with `// @vitest-environment jsdom` for the hook test:
```ts
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMarsDetails } from '../test/detailsFixtures';
import { useBodyDetails, useDetailsStore } from './detailsStore';

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
beforeEach(() => useDetailsStore.setState({ entries: {} }));

describe('detailsStore', () => {
  it('loads, validates and caches a body', async () => {
    const fetchImpl = vi.fn(() => ok(makeMarsDetails()));
    await useDetailsStore.getState().load('mars', fetchImpl as unknown as typeof fetch);
    await useDetailsStore.getState().load('mars', fetchImpl as unknown as typeof fetch);
    expect(useDetailsStore.getState().entries.mars).toMatchObject({ status: 'ready' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('reports missing on 404 and error on a schema failure or a wrong bodyId (Review Focus #4)', async () => {
    const s = useDetailsStore.getState();
    await s.load('venus', (() => Promise.resolve(new Response('', { status: 404 }))) as unknown as typeof fetch);
    await s.load('earth', (() => ok({ nonsense: true })) as unknown as typeof fetch);
    await s.load('jupiter', (() => ok(makeMarsDetails())) as unknown as typeof fetch);
    expect(useDetailsStore.getState().entries).toMatchObject({ venus: { status: 'missing' }, earth: { status: 'error' }, jupiter: { status: 'error' } });
  });
  it('retries after an error', async () => {
    await useDetailsStore.getState().load('mars', (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch);
    await useDetailsStore.getState().retry('mars', (() => ok(makeMarsDetails())) as unknown as typeof fetch);
    expect(useDetailsStore.getState().entries.mars).toMatchObject({ status: 'ready' });
  });
  it('never puts one body’s late response under another body (Review Focus #3)', async () => {
    let resolveMars!: (r: Response) => void;
    const marsPending = new Promise<Response>((r) => (resolveMars = r));
    const p = useDetailsStore.getState().load('mars', (() => marsPending) as unknown as typeof fetch);
    await useDetailsStore.getState().load('venus', (() => Promise.resolve(new Response('', { status: 404 }))) as unknown as typeof fetch);
    resolveMars(new Response(JSON.stringify(makeMarsDetails()), { status: 200 }));
    await p;
    expect(useDetailsStore.getState().entries.venus).toEqual({ status: 'missing' });
    expect(useDetailsStore.getState().entries.mars).toMatchObject({ status: 'ready', details: { bodyId: 'mars' } });
  });
  it('useBodyDetails starts loading the selected body', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok(makeMarsDetails())));
    const { result } = renderHook(() => useBodyDetails('mars'));
    await waitFor(() => expect(result.current).toMatchObject({ status: 'ready' }));
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/state/detailsStore.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `detailsStore.ts` (Zustand, matching the other stores' style)**

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/state`, then `npm test`, then `npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
git add src
git commit -m "feat(state): load body details on demand with missing and error states" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Drawer sections, citation order and the header sentence

**Files:**
- Create: `src/ui/DetailsSections.tsx`, `src/ui/DetailsSections.test.tsx`
- Modify:
  - `src/ui/citations.ts` and `citations.test.ts`;
  - `src/ui/narrative.ts` and `narrative.test.ts`;
  - `src/ui/FactsDrawer.tsx` and `FactsDrawer.test.tsx`;
  - `src/ui/Header.tsx` and `Header.test.tsx`;
  - `src/styles/app.css`.

**Interfaces:**
- Consumes:
  - `useBodyDetails` and `readyDetails` (Task 8);
  - the `BodyDetails` types (Task 1);
  - the existing `cite` rendering in the drawer and header.
- Produces:
  - **`citationModel(catalog, body, details?: BodyDetails | null)`:** the order is `citationOrder(body)`, then the live source, then `detailsSourceOrder(details)`, without duplicates. `detailsSourceOrder` lists sourceIds in display order: interior (outer, inner, composition per layer), atmosphere (gases, note), magnetosphere, missions, discovery, features.
  - **`buildNarrative(body, stats, opts?: { details?: BodyDetails | null; parent?: Body })`:**
    - **Order:** the orbit (or star) sentence, then the details sentence when details are ready, then the live-distance sentence. The day-and-temperature sentence is used only when there is no details sentence. The total stays at three or fewer.
    - **Details sentence:**
      - the atmosphere part reads "Its atmosphere is 95.1% carbon dioxide", or for the Sun "Its photosphere is 90.965% hydrogen", from the first major gas, cited;
      - the field part, joined with "; ", reads "it has no global magnetic field" for `none`, or "its magnetic field is tilted 9.4° from its spin axis" for a dipole with `tiltDeg`, cited;
      - parts whose data is missing are omitted; with neither part there is no sentence.
    - **Moon wording fix:** a body whose `parent` is not a star gets "{name} orbits {parent.name} every …"; it must not say "circles the Sun".
  - **`DetailsSections({ body, entry, cite })`** renders:
    - `entry` undefined or `loading`: one line, "Loading details…" (`role="status"`);
    - `missing` or `error`: "Details unavailable" and a `Retry` button (`useDetailsStore.retry`);
    - `ready`: these sections, each `<section id="details-<key>">` with an `<h3>`:
      - **Interior:** one row per layer: name; "radius a–b km" (or "radius a km" when min = max), or, when `from === 'depth'`, "a–b km deep"; state; an "uncertain" tag; composition text. Each number is cited.
      - **Atmosphere:** the basis; a list of major gases ("Carbon dioxide (CO₂) 95.1%", uncertainty "± 2.0" when present); minor gases in ppm; the note.
      - **Magnetic field:** for a dipole, strength ("4.30 G·R³"), tilt, tilt longitude, offset ("0.119 R") and surface field range; for Earth, the dipole pole ("80.65° N, 287.32° E"); for `none`, "No global magnetic field"; for `other`, the note.
      - **Key missions:** in launch order, one row each: name, agency, the type tag, the outcome tag, "Launched 1964-11-28 · arrived 1965-07-14". Dates use the existing date formatting if there is one for dates; otherwise ISO.
      - **Discovery:** "Known since antiquity", or "Discovered by William Herschel on 1781-03-13 (telescopic observation)".
      - **Named features:** the 10 largest ("Olympus Mons · Mons · 648.9 km · 18.65° N, 226.2° E"), then "Showing 10 of 2,052 approved features (≥ 499 km)". Each line is cited to the Gazetteer source.
  - **Mounting:**
    - **Drawer:** `FactsDrawer` calls `useBodyDetails(body.id)` and passes `readyDetails(entry)` to `citationModel`. It renders `<DetailsSections>` after "Position accuracy" and before "Imagery". The Sources list therefore includes the details sources, numbered after the existing ones.
    - **Header:** `Header` calls `useBodyDetails` too and passes `details` and `parent` (`catalog.bodyById.get(body.parentId)`) to `buildNarrative`.
    - Both use the same `citationModel` input, so their numbering matches.
  - **CSS:** `.details-row`, plus `.tag` variants for the outcome (success uses the accent colour; failure uses `--danger`; ongoing and planned are muted) and an `.uncertain` tag in `--warning`. Use the existing tokens.

- [ ] **Step 1: Write the failing tests**

- **`citations.test.ts` (Review Focus #5):** for the fixture Mars body, build `const before = citationModel(catalog, mars)` and `const after = citationModel(catalog, mars, makeMarsDetails())`. Then:
  - `for (const [id, n] of before.numbers) expect(after.numbers.get(id)).toBe(n)`;
  - every id in `after.order` but not in `before.order` has a number greater than `before.order.length`;
  - there are no duplicates.
- **`narrative.test.ts`:**
  - Mars with details: the text matches `/atmosphere is 95\.1% carbon dioxide; it has no global magnetic field/`, there are at most three sentences, and the live sentence is kept;
  - Jupiter with dipole details: `/tilted 9\.4° from its spin axis/`;
  - without details: the result is unchanged from today, matching the existing tests;
  - a moon fixture (`parentId: 'earth'`, `parent` = Earth) says `orbits Earth` and not `circles the Sun`.
- **`DetailsSections.test.tsx`** (jsdom), with a `cite` stub that renders `[id]`:
  - the loading line shows;
  - `missing` shows "Details unavailable" and Retry calls `useDetailsStore.getState().retry`;
  - `ready` Mars shows the headings Interior, Atmosphere, Magnetic field, Key missions, Discovery and Named features, plus the text "No global magnetic field", the gas line "95.1%", and "Showing 1 of";
  - Jupiter shows "4.30 G·R³" and "9.4°";
  - the Sun shows the field note and has no Named features section.
- **`FactsDrawer.test.tsx` and `Header.test.tsx`:** with `useDetailsStore.setState({ entries: { jupiter: { status: 'ready', details: makeJupiterDetails() } } })`:
  - the drawer's sources list grows by the details sources;
  - the header's chip citation numbers are unchanged;
  - the header narrative includes the field sentence.

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/ui`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/ui`, then `npm test`, then `npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
git add src
git commit -m "feat(ui): body details sections in the drawer, appended citations, and a cited details sentence in the header" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: End-to-end tests, docs and the session record

**Files:**
- Create: `e2e/details.spec.ts`
- Modify (vault):
  - `Space_visualizer/Architecture/pipeline.md`, `ui.md`, `state.md`, and `core.md` if it lists core modules;
  - `Space_visualizer/Changelog.md`, `Home.md`;
  - `Space_visualizer/Plans/2026-10-05-m2a1-carry-over.md`: mark the narrative "circles the Sun" item done;
  - `Space_visualizer/Sessions/2026-10-04-session-m1-to-m2a3.md`;
  - this plan's `status:`.
- Modify: `README.md` (data sources table: the per-planet fact sheets, the Gazetteer, curated references) and `docs/SETUP.md` (`npm run data` now also fetches about 12 MB of Gazetteer zips plus the curated pages; offline needs them cached).

**Interfaces:**
- Produces the spec §7 end-to-end items.

- [ ] **Step 1: Write the e2e tests**

`e2e/details.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test('details files are not requested at startup', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto('/?pause=1&quality=low');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(1500);
  expect(requested.filter((u) => u.includes('/details/'))).toEqual([]);
});

test('Mars shows cited interior, atmosphere, field, missions and features', async ({ page }) => {
  await page.goto('/?target=mars&pause=1&quality=low');
  await page.keyboard.press('f');
  const drawer = page.getByRole('complementary', { name: 'Body information' });
  for (const heading of ['Interior', 'Atmosphere', 'Magnetic field', 'Key missions', 'Named features']) {
    await expect(drawer.getByRole('heading', { name: heading })).toBeVisible({ timeout: 10_000 });
  }
  await expect(drawer).toContainText('No global magnetic field');
  await expect(drawer).toContainText('Olympus Mons');
  for (const id of ['interior', 'atmosphere', 'missions', 'features']) {
    expect(await drawer.locator(`#details-${id} a[aria-label^="Source"]`).count()).toBeGreaterThan(0);
  }
});

test('a blocked details file shows Details unavailable and the drawer still works (Review Focus #4)', async ({ page }) => {
  await page.route('**/details/mars.json', (route) => route.abort());
  await page.goto('/?target=mars&pause=1&quality=low');
  await page.keyboard.press('f');
  const drawer = page.getByRole('complementary', { name: 'Body information' });
  await expect(drawer.getByText('Details unavailable')).toBeVisible({ timeout: 10_000 });
  await expect(drawer.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(drawer.getByRole('heading', { name: 'Sources' })).toBeVisible();
  await expect(page.getByRole('banner', { name: 'Selected body' }).getByRole('heading', { name: 'Mars' })).toBeVisible();
});
```
Match the citation link selector to how the drawer's `cite` renders its anchors (`aria-label="Source N"`).

- [ ] **Step 2: Run the e2e tests**

Run: `npx playwright test e2e/details.spec.ts --reporter=list`. Fix any real defect; never weaken an assertion.
Expected: PASS. Then run the full `npx playwright test --reporter=list` (never two runs at once; kill the runner if it hangs after printing its summary).
Expected: all PASS.

With a scratch script, take two screenshots: the Mars drawer scrolled to Interior and Atmosphere, and the Jupiter drawer at Magnetic field. Both at 1280×720 and 390×844. View them, describe them in the report, and copy them to `Space_visualizer/Assets/m2b1/`.

- [ ] **Step 3: Docs**

- **Architecture notes:** the details model, the pipeline flow (parsers, Gazetteer, curated quotes) and the runtime (the store, the drawer sections, the citation order rule).
- **Changelog:** an "M2b.1 implemented" entry.
- **Home:** the M2b.1 plan, marked complete, and the screenshots.
- **Carry-over note:** mark the narrative item done, and add a "From M2b.1" list of deferred items.
- **Session note:** the M2b.1 execution summary.
- **Plan status:** complete. Also add the "Execution record" section (rulings and review outcome), which the controller writes at the end.

- [ ] **Step 4: Final verification and commit**

Run: `npm test`, then `npm run typecheck`, then `npx playwright test --reporter=list`
Expected: all PASS.

```powershell
git add -A e2e README.md docs Space_visualizer
git commit -m "docs: M2b.1 body details documentation, screenshots and e2e coverage" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Execution record

### Part 1: Tasks 1–4 (2026-10-10)
The work ran subagent-driven, with one implementer and one reviewer per task. The user asked for Tasks 1–4 first; Tasks 5–10 follow in a later session, starting at Task 5. The whole-branch review runs after Task 10. On commit `0affc51`, 631 unit tests pass and typecheck is clean. No end-to-end tests were needed, because the app is unchanged.

| Task | Result | Commits |
|---|---|---|
| 1 Schema and checks | Review: the layer gap and overlap check was missing, and several §5 rules had no failing test. Both fixed in round 1 | `b681b1a..14320a9` |
| 2 Fact-sheet parser | All nine bodies parse exactly. Review: Mercury's basis read "106 per cm2"; fixed in round 1 to "10⁶ per cm²" | `14320a9..d1b43c4` |
| 3 Zip, dBASE and Gazetteer | Real data: Mercury 614 approved features (cut-off 143 km), Venus 1985 (906 km), Mars 2052 (499.3 km). Review: no bounds or ZIP64 checks; fixed in round 1 | `d1b43c4..c9a06f3` |
| 4 Quote checks | Review probes found four false-pass paths: a mission number read as the day, km² counted as km, range leaks, and a month-year passing as 1 January. All fixed in round 1, together with an official-host gate and a minimum quote length. Round 2 restored test assertions that were not running | `c9a06f3..0affc51` |

**Rulings made so far** (each ends with what it costs if wrong):
1. **Task 1:** consecutive interior layers must touch; one layer's inner radius range must intersect the next layer's outer radius range (spec §5, "without gaps or overlaps"). The Mars fixture gained a mantle. *Cost:* curated layers with a real gap fail the build until a range is widened or a source is added. That is intended.
2. **Task 2:** superscripts in fact sheets render as Unicode, so 10⁶ no longer reads as 106. Subscripts stay as plain ASCII, so formulas read CO2. *Cost:* basis text shows superscript characters instead of plain text.
3. **Task 4:** curated sources must come from an official host (nasa.gov, usgs.gov, esa.int, jaxa.jp, isro.gov.in or cnsa.gov.cn, including subdomains), and quotes need at least 6 words. *Cost:* an official host missing from the list needs a one-line addition, and a very short genuine sentence needs a longer excerpt.

**Deferred minor findings** so far are recorded in the execution ledger. The final review will triage them. They include:
- the parser silently turns some reworded dipole lines into null;
- a lower-case word before a day number still passes the date check;
- some safe false fails in the quote checks.

### Part 2: Tasks 5–10, whole-branch review and fix wave (2026-10-15/16)

| Task | Result | Commits |
|---|---|---|
| 5 Curated interiors | **Coverage:** Sun (3 layers), Mercury (2), Earth (4), Mars (3). Venus and the giant planets have no official km or % figures (confirmed independently), so their interior is null. **Review:** Earth's mantle was stored from a "thickness" quote, and its outer core was missing; both fixed using NSSDCA's core radius of 3,485 km | `bf8dbb3..3c83047` |
| 6 Curated missions | 43 entries (39 distinct missions; the Voyagers repeat across bodies) from official NASA, NSSDCA and ESA pages. Discovery for Uranus and Neptune; antiquity for the five classical planets. **Review:** checked 33 missions and found no wrong date; NASA's MESSENGER page has a typo (Mar. 11), confirmed. The Ulysses and Sputnik 1 quotes were fixed | `3c83047..ee39ab1` |
| 7 Pipeline build | Nine details files and 64 new sources. **Review:** radii used the equatorial radius instead of the mean radius; fixed with the NSSDCA sheet mean radius. Gazetteer values are rounded | `ee39ab1..3291a3b` |
| 8 Details store | On-demand loading, with missing, error and retry states. Clean review | `3291a3b..a14d0fd` |
| 9 Drawer and header | New drawer sections, citations added only after the existing ones, the details sentence and the moon wording fix. Clean review | `a14d0fd..91a315b` |
| 10 End-to-end tests and docs | Three end-to-end tests, screenshots and docs. **Review:** an existing Earth-imagery test pressed F before the URL target was selected (a timing race in the test); fixed with a canvas wait | `91a315b..038485e` |
| Whole-branch review (Opus) | **Verdict:** ready with fixes. **Interior rows** did not show the sources' forms: collapsed ranges, percentages shown as km, and Earth's 2,886 km. **False precision:** 0.00200 G·R³. One fix wave fixed both, plus: the tilt-0 wording, Mercury's atmosphere text, duplicate sources, Apollo 8 removed from Earth, Sun mission types, the discovery line, the Gazetteer link and mission order. A scoped re-review confirmed every fix | `038485e..e0e755f` |

**Rulings made in Part 2** (each ends with what it costs if wrong):
1. **Task 5, coverage:** interiors for the Sun, Mercury, Earth and Mars only; null for the other five. *Cost:* less interior information until an official numeric source appears.
2. **Task 5, table figures:** a number directly after a "(km)" label counts as kilometres. *Cost:* a year placed right after such a label would also count.
3. **Task 5, per-bound form:** each curated bound may state its own form (radius, depth or percent). *Cost:* slightly more complex curated data.
4. **Task 5, layer tolerance:** a gap or overlap between layers is allowed up to the larger of 40 km and 0.5 % of the radius. *Cost:* a genuinely missing layer thinner than that would not be caught.
5. **Task 6, date convention:** mission dates follow the cited page's convention. The UT date is preferred only when the page gives it with its year in a form the date check accepts. *Cost:* a date can differ by one day from another source (Mariner 4 is July 14 EDT, July 15 UT).
6. **Task 6, process:** no separate re-review for a two-line README change, which the controller read in full. *Cost:* a wording slip.
7. **Task 7, mean radius:** R is the NSSDCA sheet's volumetric mean radius. *Cost:* none expected.
8. **Task 7, rounding:** Gazetteer coordinates are rounded to 1e-4° and diameters to 1e-3 km. *Cost:* sub-metre precision, which doesn't matter at feature scale.
9. **Whole-branch review, items kept as they are:**
   - mission outcome describes the whole mission;
   - Earth's dipole pole is shown in east longitude;
   - "(≥ X km)" refers to the 200 stored features;
   - end dates are stored but not shown;
   - Akatsuki's 2024 end is not re-verified (recorded in the carry-over);
   - interior states carry no citation except Mars's core;
   - Mercury's species are not listed;
   - the Sun's photosphere sits under "Atmosphere";
   - feature diameters use the existing number format.

   *Cost:* minor gaps in information or presentation, each listed in the ledger.
10. **Whole-branch review, discovery method:** kept in the data but not displayed, because no quote states it. *Cost:* an unused field.
11. **Whole-branch review, Apollo 8:** removed from Earth; it belongs with the Moon in M2b.2. *Cost:* Earth loses one landmark crewed mission until then.

**Final verification (2026-10-16, idle machine):** 690 unit tests pass, typecheck is clean, and all 76 end-to-end tests pass (8.2 min). The god-ray occlusion patch measured 76.22 against its 77.5 threshold. That is closer than at M2a.3 (74.85), but this branch did not touch the render code. It is noted under the existing Task 2 deferred item.

**Deferred items** are in [[2026-10-05-m2a1-carry-over]] under "From M2b.1".
