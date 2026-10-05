---
title: M2a.1 Imagery and Realistic Shading — Implementation Plan
date: 2026-10-04
status: awaiting review
milestone: M2a.1
tags: [plan, m2a]
---

# M2a.1 Imagery and Realistic Shading Implementation Plan

Back to [[Home]] · Spec: [[2026-10-04-m2-cinematic-and-rich-bodies-design]] (§2, §6, §7) · Follows [[2026-10-04-m1-foundation]]

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace M1's plain coloured spheres with official NASA/USGS/STScI surface imagery and per-body shaders: Earth with city lights, clouds and atmosphere; Mars and Mercury with relief; Hubble OPAL gas giants; Saturn's and Uranus's rings built from NASA ring tables, with shadows; an animated Sun; and the real star sky.

**Architecture:** A new texture pipeline (`pipeline/textures/`) downloads official products into a cache, derives tiered WebP textures (1k/2k committed; 4k/8k generated locally) plus normal maps, ocean masks and ring profiles, and writes `public/textures/imagery.json`. The data pipeline merges that into `bodies.json` under a new `imagery` field, with every image cited. At runtime, tiered textures load progressively and feed custom `ShaderMaterial`s. All lighting is computed in each body's object space from float64 CPU uniforms, so the floating origin keeps its precision.

**Tech Stack:** M1 stack plus `sharp` (libvips) for image processing and three.js `EXRLoader` (run in Node) for the HDR star map. GLSL shaders run on three r186 `ShaderMaterial` under WebGL2.

**Spec:** `Space_visualizer/Specs/2026-10-04-m2-cinematic-and-rich-bodies-design.md`. This plan implements spec §6 (imagery and shading) and the imagery part of §7. Spec §4 (interface), §5 (effects and quality) and the rest of §7 are plan **M2a.2**.

## Scope rulings (spec deviations, decided while planning; executors must not undo them)

| Spec says | This plan does | Why |
|---|---|---|
| Earth Blue Marble month matched to the date | One month (July 2004); the schema and pipeline are written so more months are data-only additions | Monthly record IDs on NASA's site are irregular and couldn't be resolved reliably during planning |
| OPAL map for the year nearest the date | The most recent OPAL map per planet (Jupiter 2024c, Saturn 2024a, Uranus 2023a, Neptune 2025a) | Same data-only extension path; avoids roughly 4× the download and storage |
| Moon imagery prepared in M2a | Deferred to M2b, which adds the Moon body | No Moon body exists to use it yet (YAGNI) |
| Venus Magellan radar view | Deferred to M2a.2, alongside the drawer toggle it needs | M2a.1 has no UI for the toggle |
| KTX2/Basis compression | WebP tiers; KTX2 deferred and recorded as a decision | 8k is capped to a few layers; WebP is natively supported; avoids a WASM encoder dependency |
| Saturn ring profiles from the NASA PDS Rings Node (*to verify*) | Ring structure (radii, optical depth, albedo) from the NSSDCA Saturn and Uranus ring fact sheets; colour tint illustrative | Official and verified during planning; the PDS profiles need a heavier toolchain |
| Mercury MESSENGER colour | The MDIS 3-colour (MD3) 665 m mosaic, desaturated 80% and labelled | The monochrome basemap is 4.2 GB; MD3 colour is stretched, so it is desaturated toward the natural grey-brown |
| Sun limb darkening from published coefficients | Illustrative linear limb darkening, labelled; no numeric citation | Couldn't verify the coefficients during planning; the Sun's surface is illustrative anyway |

## Global Constraints

- All M1 global constraints still hold. In particular: `src/core` stays pure TypeScript; every fact shown is cited; Windows PowerShell commands; every commit message ends with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Realistic-mode imagery comes only from the official products listed in Task 1, each a `Source` (title, publisher, url, licence, retrievedAt). Procedural visuals (Venus clouds, Sun surface, ring colour tint, band flow, cloud drift, exaggerated relief) are labelled **illustrative** in the UI. No fact, position or accuracy figure is ever derived from imagery.
- Texture tiers: `1k` = 1024×512, `2k` = 2048×1024, `4k` = 4096×2048, `8k` = 8192×4096 (always 2:1 equirectangular, top row = +90° latitude, left column = −180° longitude, east to the right). Exceptions: the sky has 2k/4k committed and 8k local; ring profiles are 2048×2.
- Committed texture budget: **≤ 60 MB** under `public/textures/` (the validator fails the build otherwise). `*_4k.webp` and `*_8k.webp` are git-ignored, except `public/textures/sky/color_4k.webp`, which is committed.
- Texture formats: colour layers as WebP quality 90; normal maps, masks and ring profiles as WebP lossless.
- Shaders: every custom `ShaderMaterial` includes three's `logdepthbuf` chunks (the logarithmic depth buffer is on). Surface shaders end with `#include <tonemapping_fragment>` and `#include <colorspace_fragment>`. No shader may log a compile error: the e2e suite fails on any console message containing `Shader Error` or `THREE.WebGLProgram`.
- Object-space lighting convention: every body shader works in its mesh's object space, where the unit sphere is the rendered equatorial radius, `vUnit` is the unit-sphere vertex position and the surface point is `vec3(vUnit.xy, vUnit.z * uFlattening)`. `uSunDirObj` and `uCamObj` are computed on the CPU in float64 (Task 8).
- Large downloads (up to about 2.1 GB per file; about 5 GB total cache) go to `pipeline/raw/textures/` (git-ignored). `npm run textures` must work again from the cache with `--offline`.

## Review Focus

1. **HD tiers missing locally (fresh clone, no `textures:hd` run):** asking for 4k/8k must fall back to the best committed tier without unhandled promise rejections, console errors or visible flicker. Pinned by a Task 9 unit test (loader fallback with a fake loader).
2. **An interrupted multi-GB download** (network drop at 80%) must not leave a truncated file that the next run treats as complete. Pinned by a Task 2 test (temp file + rename; a failed stream leaves no cache entry).
3. **Mirrored or shifted maps** (stars mirrored, continents offset by 180°, Olympus Mons on the wrong side): pinned by pipeline validations with unit-tested helpers (Tasks 3–4), run in Task 6:
   - bright-star positions in the sky texture;
   - Sahara bright and Pacific dark in Earth's day map, and the ocean mask correct at known points;
   - Mars DEM maximum near Olympus Mons.

   Task 8 pins the runtime UV convention to `SphereGeometry`, and Task 17 pins the sky mapping (Vega's texel).
4. **Signed elevation read as unsigned** (Mars or Mercury DEM wrapping to +60 km): pinned by Task 3's `assertElevationRange` (unit-tested), applied in Task 6 to each DEM (Mars min < −5000 m and max > 15000 m; Mercury min < −3000 m and max > 3000 m).
5. **Shader compile failure** on a GPU or driver: it must surface in tests, not silently render black. Pinned by the e2e console gate added in Task 10, which runs on every page load from then on.

## File Structure

```
pipeline/textures/
  manifest.ts          official products (URL, format, source, longitude convention) and imagery Source specs
  fetchBinary.ts       streamed, resumable-safe cached downloads (temp file + rename)
  rasters.ts           sharp helpers: read single-band float rasters, write WebP tiers, raw → WebP
  derive.ts            pure: normal map from height, threshold masks, equirect sampling, range assertions
  rings.ts             pure: parse NSSDCA ring sheets, build radial RGBA ring profiles
  stars.ts             EXR decode + orientation fix, blob finder, bright-star orientation check
  build.ts             recipes per body/layer → tier files + imagery.json (with validations)
  run.ts               CLI: npm run textures [--hd] [--offline]
pipeline/fixtures/     satringfact.html, uranringfact.html (downloaded in Task 4)
public/textures/       <body>/<layer>_<tier>.webp, sky/, imagery.json
src/core/shadows/eclipse.ts         pure: sun-disc visibility behind a sphere, ray-plane radius, ray-ellipsoid hit
src/core/catalog/schema.ts          + TextureRef, Imagery, Render; Body.texture → Body.imagery + Body.render
src/scene/materials/
  bodyUniforms.ts      pure: float64 → object-space sun direction, camera, occluders
  chunks.ts            GLSL: log-depth vertex/fragment wrappers, noise, eclipse, lighting helpers
  createBodyMaterial.ts  ShaderMaterial factory applying conventions
  useBodyUniforms.ts   per-frame uniform updates from FrameState
  BodyMaterial.tsx     picks the material per render.shader; BodyExtras (clouds, atmosphere, rings, corona)
  rings.ts             pure: ring radii, ring-shadow coordinate, lit/unlit face
  illustrative.ts      pure: illustrative constants and profiles (limb darkening, Venus cloud angle, corona)
  RockyMaterial.tsx, EarthMaterial.tsx, CloudShell.tsx, AtmosphereShell.tsx, GiantMaterial.tsx,
  Rings.tsx, VenusMaterial.tsx, SunMaterial.tsx, CoronaGlow.tsx
src/scene/sky/skyMath.ts, SkyBackground.tsx  star-map mapping (tested against the core frames) + sky sphere
src/scene/textures/useTieredTexture.ts   progressive tier loading with fallback + pending counter
src/scene/TextureReadiness.tsx           data-textures-ready flag for golden views
src/state/urlParams.ts                   golden-view / debug URL overrides
src/state/skyStore.ts                    loads the sky texture reference from imagery.json
src/ui/imagery.ts, SkyCredit.tsx         imagery citations per body; sky credit
e2e/golden.spec.ts                       golden-view screenshots
```

---

### Task 1: Official imagery manifest and source verification

**Files:**
- Create: `pipeline/textures/manifest.ts`, `pipeline/textures/verifySources.ts`
- Modify: `package.json` (add `sharp`; scripts `textures`, `textures:hd`, `textures:verify`), `.gitignore`
- Test: `pipeline/textures/manifest.test.ts`

**Interfaces:**
- Consumes: `SourceSpec` (M1 `pipeline/sources/registry.ts`).
- Produces: `type ProductId`; `interface Product { url: string; cacheName: string; sourceId: string; approxBytes: number; hdOnly?: boolean; lonOffsetDeg: number }`; `PRODUCTS: Record<ProductId, Product>`; `IMAGERY_SOURCE_SPECS: SourceSpec[]`; `imagerySpec(id: string): SourceSpec`.

All URLs below were confirmed to return HTTP 200 on 2026-10-04 (sizes noted).

- [ ] **Step 1: Install sharp and add scripts**

```powershell
npm install -D sharp@0.35.5
```

Add these to `package.json` `scripts`:
```json
"textures": "tsx pipeline/textures/run.ts",
"textures:hd": "tsx pipeline/textures/run.ts --hd",
"textures:verify": "tsx pipeline/textures/verifySources.ts"
```

Append to `.gitignore`:
```
# Texture tiers generated locally by `npm run textures:hd`
public/textures/**/*_4k.webp
public/textures/**/*_8k.webp
!public/textures/sky/color_4k.webp
```

- [ ] **Step 2: Write the failing test `pipeline/textures/manifest.test.ts`**

```ts
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
```

- [ ] **Step 3: Run and confirm failure**

Run: `npx vitest run pipeline/textures/manifest.test.ts`
Expected: FAIL, cannot resolve `./manifest`.

- [ ] **Step 4: Create `pipeline/textures/manifest.ts`**

```ts
import type { SourceSpec } from '../sources/registry';

const NASA_PD = 'NASA public domain (NASA media usage guidelines)';
const USGS_PD = 'USGS public domain (U.S. Government work)';
const EO = 'https://eoimages.gsfc.nasa.gov/images/imagerecords';
const USGS = 'https://planetarymaps.usgs.gov/mosaic';
const OPAL = 'https://archive.stsci.edu/hlsps/opal/cycle31';
const SVS = 'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851';

export const IMAGERY_SOURCE_SPECS: SourceSpec[] = [
  { id: 'nasa-blue-marble-ng', title: 'Blue Marble: Next Generation, July 2004 (R. Stöckli)', publisher: 'NASA Earth Observatory / Visible Earth', url: 'https://visibleearth.nasa.gov/images/74092', license: NASA_PD },
  { id: 'nasa-black-marble-2016', title: 'Earth at Night (Black Marble) 2016', publisher: 'NASA Earth Observatory / Visible Earth', url: 'https://visibleearth.nasa.gov/images/144898', license: NASA_PD },
  { id: 'nasa-blue-marble-clouds', title: 'Blue Marble: Clouds', publisher: 'NASA Earth Observatory / Visible Earth', url: 'https://visibleearth.nasa.gov/images/57747', license: NASA_PD },
  { id: 'nasa-topography', title: 'Topography (GEBCO 2008 data)', publisher: 'NASA Earth Observatory / Visible Earth', url: 'https://visibleearth.nasa.gov/images/73934', license: NASA_PD },
  { id: 'nasa-bathymetry', title: 'Bathymetry (GEBCO 2008 data)', publisher: 'NASA Earth Observatory / Visible Earth', url: 'https://visibleearth.nasa.gov/images/73963', license: NASA_PD },
  { id: 'usgs-mars-viking-color', title: 'Mars Viking Global Color Mosaic 925 m', publisher: 'USGS Astrogeology Science Center', url: 'https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m', license: USGS_PD },
  { id: 'usgs-mars-mola-dem', title: 'Mars MGS MOLA DEM 463 m', publisher: 'USGS Astrogeology Science Center (NASA MGS MOLA team data)', url: `${USGS}/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif`, license: USGS_PD },
  { id: 'usgs-mercury-md3-color', title: 'Mercury MESSENGER MDIS Basemap MD3 Color Mosaic 665 m', publisher: 'USGS Astrogeology Science Center (NASA MESSENGER data)', url: `${USGS}/Mercury_MESSENGER_MDIS_Basemap_MD3Color_Mosaic_Global_665m.tif`, license: USGS_PD },
  { id: 'usgs-mercury-dem', title: 'Mercury MESSENGER USGS DEM 665 m', publisher: 'USGS Astrogeology Science Center (NASA MESSENGER data)', url: `${USGS}/Mercury_Messenger_USGS_DEM_Global_665m_v2.tif`, license: USGS_PD },
  { id: 'stsci-opal', title: 'Outer Planet Atmospheres Legacy (OPAL) global maps', publisher: 'NASA/ESA Hubble Space Telescope via STScI MAST (OPAL program, PI A. Simon)', url: 'https://doi.org/10.17909/T9G593', license: 'Public HLSP data; acknowledge NASA/ESA HST OPAL program (PI: Simon, GO13937), archived by STScI' },
  { id: 'nasa-svs-deep-star-maps', title: 'Deep Star Maps 2020', publisher: 'NASA Goddard Scientific Visualization Studio', url: 'https://svs.gsfc.nasa.gov/4851', license: 'NASA public domain (credit NASA/Goddard SVS; Gaia DR2: ESA/Gaia/DPAC)' },
  { id: 'nssdca-saturn-rings', title: 'Saturnian Rings Fact Sheet (D. R. Williams)', publisher: 'NASA Goddard Space Flight Center, NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html', license: NASA_PD },
  { id: 'nssdca-uranus-rings', title: 'Uranus Rings Fact Sheet (D. R. Williams)', publisher: 'NASA Goddard Space Flight Center, NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/uranringfact.html', license: NASA_PD },
];

export type ProductId =
  | 'earth-day' | 'earth-night' | 'earth-clouds' | 'earth-topography' | 'earth-bathymetry'
  | 'mars-color' | 'mars-dem' | 'mercury-color' | 'mercury-dem'
  | 'jupiter-opal' | 'saturn-opal' | 'uranus-opal' | 'neptune-opal'
  | 'sky-starmap-4k' | 'sky-starmap-8k' | 'saturn-ring-sheet' | 'uranus-ring-sheet';

export interface Product {
  url: string;
  cacheName: string;
  sourceId: string;
  approxBytes: number;
  hdOnly?: boolean;
  /** Degrees to roll the map east so that column 0 is −180° longitude (0 = already −180..180). */
  lonOffsetDeg: number;
}

export const PRODUCTS: Record<ProductId, Product> = {
  'earth-day': { url: `${EO}/74000/74092/world.200407.3x21600x10800.jpg`, cacheName: 'earth-day.jpg', sourceId: 'nasa-blue-marble-ng', approxBytes: 21_125_326, lonOffsetDeg: 0 },
  'earth-night': { url: `${EO}/144000/144898/BlackMarble_2016_3km.jpg`, cacheName: 'earth-night.jpg', sourceId: 'nasa-black-marble-2016', approxBytes: 8_106_233, lonOffsetDeg: 0 },
  'earth-clouds': { url: `${EO}/57000/57747/cloud_combined_8192.tif`, cacheName: 'earth-clouds.tif', sourceId: 'nasa-blue-marble-clouds', approxBytes: 35_870_468, lonOffsetDeg: 0 },
  'earth-topography': { url: `${EO}/73000/73934/gebco_08_rev_elev_21600x10800.png`, cacheName: 'earth-topography.png', sourceId: 'nasa-topography', approxBytes: 18_414_843, lonOffsetDeg: 0 },
  'earth-bathymetry': { url: `${EO}/73000/73963/gebco_08_rev_bath_21600x10800.png`, cacheName: 'earth-bathymetry.png', sourceId: 'nasa-bathymetry', approxBytes: 35_097_740, lonOffsetDeg: 0 },
  'mars-color': { url: `${USGS}/Mars_Viking_ClrMosaic_global_925m.tif`, cacheName: 'mars-color.tif', sourceId: 'usgs-mars-viking-color', approxBytes: 797_888_177, lonOffsetDeg: 0 },
  'mars-dem': { url: `${USGS}/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif`, cacheName: 'mars-dem.tif', sourceId: 'usgs-mars-mola-dem', approxBytes: 2_125_771_142, lonOffsetDeg: 0 },
  'mercury-color': { url: `${USGS}/Mercury_MESSENGER_MDIS_Basemap_MD3Color_Mosaic_Global_665m.tif`, cacheName: 'mercury-color.tif', sourceId: 'usgs-mercury-md3-color', approxBytes: 796_539_539, lonOffsetDeg: 0 },
  'mercury-dem': { url: `${USGS}/Mercury_Messenger_USGS_DEM_Global_665m_v2.tif`, cacheName: 'mercury-dem.tif', sourceId: 'usgs-mercury-dem', approxBytes: 530_934_581, lonOffsetDeg: 0 },
  'jupiter-opal': { url: `${OPAL}/jupiter/hlsp_opal_hst_wfc3-uvis_jupiter-2024c_f395n-f502n-f631n_v1_globalmap.tif`, cacheName: 'jupiter-opal.tif', sourceId: 'stsci-opal', approxBytes: 19_472_820, lonOffsetDeg: 0 },
  'saturn-opal': { url: `${OPAL}/saturn/hlsp_opal_hst_wfc3-uvis_saturn-2024a_f395n-f502n-f631n_v1_globalmap.tif`, cacheName: 'saturn-opal.tif', sourceId: 'stsci-opal', approxBytes: 20_000_000, lonOffsetDeg: 0 },
  'uranus-opal': { url: `${OPAL}/uranus/hlsp_opal_hst_wfc3-uvis_uranus-2023a_f467m-f547m-f657n_v1_globalmap.tif`, cacheName: 'uranus-opal.tif', sourceId: 'stsci-opal', approxBytes: 20_000_000, lonOffsetDeg: 0 },
  'neptune-opal': { url: `${OPAL}/neptune/hlsp_opal_hst_wfc3-uvis_neptune-2025a_f467m-f547m-f657n_v1_globalmap.tif`, cacheName: 'neptune-opal.tif', sourceId: 'stsci-opal', approxBytes: 20_000_000, lonOffsetDeg: 0 },
  'sky-starmap-4k': { url: `${SVS}/starmap_2020_4k.exr`, cacheName: 'starmap-4k.exr', sourceId: 'nasa-svs-deep-star-maps', approxBytes: 35_997_085, lonOffsetDeg: 0 },
  'sky-starmap-8k': { url: `${SVS}/starmap_2020_8k.exr`, cacheName: 'starmap-8k.exr', sourceId: 'nasa-svs-deep-star-maps', approxBytes: 130_530_278, hdOnly: true, lonOffsetDeg: 0 },
  'saturn-ring-sheet': { url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html', cacheName: 'satringfact.html', sourceId: 'nssdca-saturn-rings', approxBytes: 5_565, lonOffsetDeg: 0 },
  'uranus-ring-sheet': { url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/uranringfact.html', cacheName: 'uranringfact.html', sourceId: 'nssdca-uranus-rings', approxBytes: 4_337, lonOffsetDeg: 0 },
};

export function imagerySpec(id: string): SourceSpec {
  const spec = IMAGERY_SOURCE_SPECS.find((s) => s.id === id);
  if (!spec) throw new Error(`Unknown imagery source "${id}"`);
  return spec;
}
```

- [ ] **Step 5: Create `pipeline/textures/verifySources.ts`**

```ts
import { PRODUCTS } from './manifest';

let failures = 0;
for (const [id, product] of Object.entries(PRODUCTS)) {
  try {
    const res = await fetch(product.url, { method: 'HEAD', redirect: 'follow' });
    const bytes = Number(res.headers.get('content-length') ?? 0);
    const ok = res.ok;
    if (!ok) failures += 1;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${res.status} ${(bytes / 1e6).toFixed(1).padStart(8)} MB  ${id}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ---         -   ${id}: ${String(error)}`);
  }
}
if (failures > 0) {
  console.error(`${failures} product(s) unavailable`);
  process.exit(1);
}
```

- [ ] **Step 6: Run the tests and the verification (network)**

Run: `npx vitest run pipeline/textures/manifest.test.ts`, then `npm run textures:verify`
Expected: 4 tests PASS; every product prints `OK 200`. Record any product size that differs from `approxBytes` by more than 10% by updating `approxBytes` (it is informational only).

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json .gitignore pipeline/textures/manifest.ts pipeline/textures/manifest.test.ts pipeline/textures/verifySources.ts
git commit -m "feat(textures): add official imagery manifest and source verification" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Safe cached binary downloads

**Files:**
- Create: `pipeline/textures/fetchBinary.ts`
- Test: `pipeline/textures/fetchBinary.test.ts`

**Interfaces:**
- Produces: `interface BinaryFetchOptions { offline: boolean; rawDir: string; fetchImpl?: typeof fetch; now?: () => Date; log?: (message: string) => void }`; `interface FetchedFile { path: string; retrievedAt: string; fromCache: boolean; bytes: number }`; `fetchBinaryCached(url: string, cacheName: string, options: BinaryFetchOptions): Promise<FetchedFile>`.

Behaviour: **cache-first**, because sources are multi-GB. A cached file counts only when it and its `.meta.json` exist and the file size equals `meta.bytes`. Downloads stream to `<file>.part`, which is renamed to `<file>` only after the byte count matches `Content-Length` (when given). Any failure deletes the `.part` file, so an interrupted download never looks complete.

- [ ] **Step 1: Write the failing tests `pipeline/textures/fetchBinary.test.ts`**

```ts
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fetchBinaryCached } from './fetchBinary';

const tempDir = () => mkdtemp(path.join(os.tmpdir(), 'ssv-bin-'));
const now = () => new Date('2026-10-04T10:00:00Z');
const bytes = (n: number) => new Uint8Array(n).map((_, i) => i % 251);

function okFetch(body: Uint8Array, contentLength: number | null = body.length) {
  return vi.fn(async () =>
    new Response(body, { status: 200, headers: contentLength === null ? {} : { 'content-length': String(contentLength) } }),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

function brokenFetch() {
  return (async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes(1000));
        controller.error(new Error('connection reset'));
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-length': '5000' } });
  }) as unknown as typeof fetch;
}

describe('fetchBinaryCached', () => {
  it('downloads to the cache with metadata', async () => {
    const rawDir = await tempDir();
    const result = await fetchBinaryCached('https://example.org/a.bin', 'a.bin', { offline: false, rawDir, fetchImpl: okFetch(bytes(4096)), now });
    expect(result).toMatchObject({ fromCache: false, bytes: 4096, retrievedAt: '2026-10-04' });
    expect((await readFile(result.path)).length).toBe(4096);
  });

  it('uses the cache without fetching again', async () => {
    const rawDir = await tempDir();
    await fetchBinaryCached('https://example.org/a.bin', 'a.bin', { offline: false, rawDir, fetchImpl: okFetch(bytes(10)), now });
    const second = okFetch(bytes(10));
    const result = await fetchBinaryCached('https://example.org/a.bin', 'a.bin', { offline: false, rawDir, fetchImpl: second });
    expect(result.fromCache).toBe(true);
    expect(second).not.toHaveBeenCalled();
  });

  it('leaves nothing behind when the stream fails part-way', async () => {
    const rawDir = await tempDir();
    await expect(fetchBinaryCached('https://example.org/b.bin', 'b.bin', { offline: false, rawDir, fetchImpl: brokenFetch() })).rejects.toThrow(/connection reset/);
    expect(await readdir(rawDir)).toEqual([]);
  });

  it('rejects a short download that does not match Content-Length', async () => {
    const rawDir = await tempDir();
    await expect(fetchBinaryCached('https://example.org/c.bin', 'c.bin', { offline: false, rawDir, fetchImpl: okFetch(bytes(100), 200) })).rejects.toThrow(/expected 200 bytes, got 100/);
    expect(existsSync(path.join(rawDir, 'c.bin'))).toBe(false);
  });

  it('offline mode requires a complete cached copy', async () => {
    await expect(fetchBinaryCached('https://example.org/d.bin', 'd.bin', { offline: true, rawDir: await tempDir() })).rejects.toThrow(/Offline mode: no complete cached copy/);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run pipeline/textures/fetchBinary.test.ts`
Expected: FAIL, cannot resolve `./fetchBinary`.

- [ ] **Step 3: Create `pipeline/textures/fetchBinary.ts`**

```ts
import { createWriteStream, existsSync, statSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface BinaryFetchOptions {
  offline: boolean;
  rawDir: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  log?: (message: string) => void;
}

export interface FetchedFile {
  path: string;
  retrievedAt: string;
  fromCache: boolean;
  bytes: number;
}

interface Meta {
  url: string;
  retrievedAt: string;
  bytes: number;
}

async function readCompleteCache(file: string, metaFile: string): Promise<FetchedFile | null> {
  if (!existsSync(file) || !existsSync(metaFile)) return null;
  const meta = JSON.parse(await readFile(metaFile, 'utf8')) as Meta;
  if (statSync(file).size !== meta.bytes) return null;
  return { path: file, retrievedAt: meta.retrievedAt, fromCache: true, bytes: meta.bytes };
}

export async function fetchBinaryCached(url: string, cacheName: string, options: BinaryFetchOptions): Promise<FetchedFile> {
  const file = path.join(options.rawDir, cacheName);
  const metaFile = `${file}.meta.json`;
  const partFile = `${file}.part`;

  const cached = await readCompleteCache(file, metaFile);
  if (cached) return cached;
  if (options.offline) throw new Error(`Offline mode: no complete cached copy of ${url} at ${file}`);

  await mkdir(options.rawDir, { recursive: true });
  try {
    const res = await (options.fetchImpl ?? fetch)(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; solar-system-visualizer-texture-pipeline)' } });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`);
    const expected = res.headers.get('content-length');
    options.log?.(`downloading ${url}${expected ? ` (${(Number(expected) / 1e6).toFixed(0)} MB)` : ''}`);
    await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), createWriteStream(partFile));
    const bytes = statSync(partFile).size;
    if (expected !== null && Number(expected) !== bytes) throw new Error(`Download of ${url} incomplete: expected ${expected} bytes, got ${bytes}`);
    await rename(partFile, file);
    const retrievedAt = (options.now ?? (() => new Date()))().toISOString().slice(0, 10);
    await writeFile(metaFile, JSON.stringify({ url, retrievedAt, bytes } satisfies Meta, null, 2), 'utf8');
    return { path: file, retrievedAt, fromCache: false, bytes };
  } catch (error) {
    await rm(partFile, { force: true });
    throw error;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run pipeline/textures/fetchBinary.test.ts`
Expected: all 5 PASS.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/textures/fetchBinary.ts pipeline/textures/fetchBinary.test.ts
git commit -m "feat(textures): add cache-first binary downloads that never keep partial files" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Raster helpers and pure derivations

**Files:**
- Create: `pipeline/textures/rasters.ts`, `pipeline/textures/derive.ts`
- Test: `pipeline/textures/derive.test.ts`, `pipeline/textures/rasters.test.ts`

**Interfaces:**
- Produces (`derive.ts`, all pure):
  - `normalMapFromHeight(height: Float32Array, width: number, height: number, opts: { radiusM: number; metersPerUnit: number; strength: number }): Uint8Array` returns RGB, 3 bytes per pixel, in the tangent basis (east, north, up); flat ground is (128, 128, 255);
  - `sampleEquirect(values, width, height, lonDeg, latDeg, channels?, channel?): number`;
  - `argmaxLonLat(values, width, height): { lonDeg; latDeg; value }`;
  - `rangeOf(values): { min; max }`;
  - `assertElevationRange(name, values, { minBelow, maxAbove }): void`;
  - `calibrateMask(values, width, height, landPoints, waterPoints): { threshold; waterAbove }`;
  - `thresholdMask(values, threshold, waterAbove): Uint8Array` (water = 255);
  - `rollColumns<T extends Uint8Array | Float32Array>(data: T, width, height, channels, degrees): T`.
- Produces (`rasters.ts`, sharp):
  - `readBandFloat(file, width, height, band?): Promise<Float32Array>`;
  - `readRgb8(file, width, height): Promise<Uint8Array>`;
  - `writeWebp(raw: Uint8Array, width, height, channels, out, opts: { lossless?: boolean; quality?: number }): Promise<void>`;
  - `desaturateRgb(rgb: Uint8Array, amount): Uint8Array`;
  - `imageInfo(file): Promise<{ width; height; channels; depth }>`.

- [ ] **Step 1: Write the failing tests `pipeline/textures/derive.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { argmaxLonLat, assertElevationRange, calibrateMask, normalMapFromHeight, rangeOf, rollColumns, sampleEquirect, thresholdMask } from './derive';

const W = 8;
const H = 4;
const grid = (f: (x: number, y: number) => number) => {
  const a = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a[y * W + x] = f(x, y);
  return a;
};
const opts = { radiusM: 1000, metersPerUnit: 1, strength: 1 };

describe('normalMapFromHeight', () => {
  it('encodes flat ground as straight up', () => {
    const n = normalMapFromHeight(grid(() => 5), W, H, opts);
    expect([...n.slice(0, 3)]).toEqual([128, 128, 255]);
  });
  it('tilts away from ground rising to the east (R < 128)', () => {
    const n = normalMapFromHeight(grid((x) => x * 50), W, H, opts);
    const i = (1 * W + 3) * 3;
    expect(n[i]!).toBeLessThan(128);
    expect(Math.abs(n[i + 1]! - 128)).toBeLessThanOrEqual(1);
  });
  it('tilts away from ground rising to the north (G < 128)', () => {
    const n = normalMapFromHeight(grid((_, y) => (H - y) * 50), W, H, opts);
    const i = (1 * W + 3) * 3;
    expect(n[i + 1]!).toBeLessThan(128);
    expect(Math.abs(n[i]! - 128)).toBeLessThanOrEqual(1);
  });
});

describe('equirect helpers', () => {
  it('samples by longitude/latitude with column 0 at −180° and row 0 at +90°', () => {
    const v = grid((x, y) => x * 10 + y);
    expect(sampleEquirect(v, W, H, -179, 80)).toBe(0);
    expect(sampleEquirect(v, W, H, 179, -80)).toBe(73);
    expect(sampleEquirect(v, W, H, 0, 0)).toBe(42);
  });
  it('finds the maximum location', () => {
    const v = grid((x, y) => (x === 6 && y === 1 ? 99 : 0));
    expect(argmaxLonLat(v, W, H)).toEqual({ lonDeg: 112.5, latDeg: 22.5, value: 99 });
  });
  it('rolls columns east by whole pixels', () => {
    const v = Float32Array.from({ length: W }, (_, i) => i);
    expect([...rollColumns(v, W, 1, 1, 90)]).toEqual([6, 7, 0, 1, 2, 3, 4, 5]);
  });
});

describe('range and mask checks', () => {
  it('reports ranges and enforces elevation sanity', () => {
    const v = Float32Array.from([-8000, 0, 21000]);
    expect(rangeOf(v)).toEqual({ min: -8000, max: 21000 });
    expect(() => assertElevationRange('mars', v, { minBelow: -5000, maxAbove: 15000 })).not.toThrow();
    expect(() => assertElevationRange('mars', Float32Array.from([0, 60000]), { minBelow: -5000, maxAbove: 15000 })).toThrow(/mars elevation range 0 .. 60000 m fails sanity check/);
  });
  it('calibrates a water mask from known land and water points', () => {
    const v = grid((x) => (x < 4 ? 200 : 10)); // west half bright (land), east half dark (water)
    const cal = calibrateMask(v, W, H, [{ lonDeg: -100, latDeg: 0 }], [{ lonDeg: 100, latDeg: 0 }]);
    expect(cal).toEqual({ threshold: 105, waterAbove: false });
    const mask = thresholdMask(v, cal.threshold, cal.waterAbove);
    expect(mask[0]).toBe(0);
    expect(mask[7]).toBe(255);
  });
  it('refuses to calibrate when land and water overlap', () => {
    const v = grid(() => 50);
    expect(() => calibrateMask(v, W, H, [{ lonDeg: -100, latDeg: 0 }], [{ lonDeg: 100, latDeg: 0 }])).toThrow(/cannot separate land from water/);
  });
});
```

- [ ] **Step 2: Write the failing tests `pipeline/textures/rasters.test.ts`**

```ts
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { desaturateRgb, imageInfo, readBandFloat, readRgb8, writeWebp } from './rasters';

async function gradientPng(dir: string): Promise<string> {
  const w = 8, h = 4;
  const raw = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * w + x] = x * 32;
  const file = path.join(dir, 'g.png');
  await sharp(raw, { raw: { width: w, height: h, channels: 1 } }).png().toFile(file);
  return file;
}

describe('rasters', () => {
  it('reads one band as floats at the requested size', async () => {
    const file = await gradientPng(await mkdtemp(path.join(os.tmpdir(), 'ssv-r-')));
    const v = await readBandFloat(file, 4, 2);
    expect(v.length).toBe(8);
    expect(v[3]!).toBeGreaterThan(v[0]!);
  });

  it('writes WebP and reads RGB back', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ssv-r-'));
    const out = path.join(dir, 'o.webp');
    await writeWebp(new Uint8Array(4 * 2 * 3).fill(200), 4, 2, 3, out, { lossless: true });
    expect(await imageInfo(out)).toMatchObject({ width: 4, height: 2 });
    const rgb = await readRgb8(out, 4, 2);
    expect(rgb.length).toBe(24);
    expect(rgb[0]).toBe(200);
  });

  it('desaturates toward grey', () => {
    const out = desaturateRgb(Uint8Array.from([200, 100, 0]), 1);
    expect(out[0]).toBe(out[1]);
    expect(out[1]).toBe(out[2]);
  });
});
```

- [ ] **Step 3: Run and confirm failure**

Run: `npx vitest run pipeline/textures/derive.test.ts pipeline/textures/rasters.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 4: Create `pipeline/textures/derive.ts`**

```ts
export interface LonLat {
  lonDeg: number;
  latDeg: number;
}

const DEG = Math.PI / 180;

function pixelOf(width: number, height: number, lonDeg: number, latDeg: number): { x: number; y: number } {
  const x = (((Math.floor(((lonDeg + 180) / 360) * width) % width) + width) % width);
  const y = Math.min(height - 1, Math.max(0, Math.floor(((90 - latDeg) / 180) * height)));
  return { x, y };
}

export function sampleEquirect(values: ArrayLike<number>, width: number, height: number, lonDeg: number, latDeg: number, channels = 1, channel = 0): number {
  const { x, y } = pixelOf(width, height, lonDeg, latDeg);
  return values[(y * width + x) * channels + channel]!;
}

export function argmaxLonLat(values: ArrayLike<number>, width: number, height: number): { lonDeg: number; latDeg: number; value: number } {
  let best = 0;
  for (let i = 1; i < width * height; i++) if (values[i]! > values[best]!) best = i;
  const x = best % width;
  const y = Math.floor(best / width);
  return { lonDeg: ((x + 0.5) / width) * 360 - 180, latDeg: 90 - ((y + 0.5) / height) * 180, value: values[best]! };
}

export function rangeOf(values: ArrayLike<number>): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

export function assertElevationRange(name: string, values: ArrayLike<number>, limits: { minBelow: number; maxAbove: number }): void {
  const { min, max } = rangeOf(values);
  if (!(min < limits.minBelow && max > limits.maxAbove)) {
    throw new Error(`${name} elevation range ${min} .. ${max} m fails sanity check (need min < ${limits.minBelow}, max > ${limits.maxAbove}); signed data may have been read as unsigned`);
  }
}

/** Tangent-space normals (x = east, y = north, z = up) from an equirectangular height grid. */
export function normalMapFromHeight(height: Float32Array, width: number, rows: number, opts: { radiusM: number; metersPerUnit: number; strength: number }): Uint8Array {
  const out = new Uint8Array(width * rows * 3);
  const dy = (Math.PI * opts.radiusM) / rows;
  for (let y = 0; y < rows; y++) {
    const lat = (90 - ((y + 0.5) / rows) * 180) * DEG;
    const dx = (2 * Math.PI * opts.radiusM * Math.max(Math.cos(lat), 0.01)) / width;
    const yUp = Math.max(0, y - 1);
    const yDown = Math.min(rows - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const xE = (x + 1) % width;
      const xW = (x - 1 + width) % width;
      const dhdx = ((height[y * width + xE]! - height[y * width + xW]!) * opts.metersPerUnit) / (2 * dx);
      const dhdy = ((height[yUp * width + x]! - height[yDown * width + x]!) * opts.metersPerUnit) / ((yDown - yUp) * dy);
      let nx = -opts.strength * dhdx;
      let ny = -opts.strength * dhdy;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * width + x) * 3;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }
  return out;
}

/** Finds a threshold separating known land points from known water points; throws if they overlap. */
export function calibrateMask(values: ArrayLike<number>, width: number, height: number, land: LonLat[], water: LonLat[]): { threshold: number; waterAbove: boolean } {
  const l = land.map((p) => sampleEquirect(values, width, height, p.lonDeg, p.latDeg));
  const w = water.map((p) => sampleEquirect(values, width, height, p.lonDeg, p.latDeg));
  const [lMin, lMax, wMin, wMax] = [Math.min(...l), Math.max(...l), Math.min(...w), Math.max(...w)];
  if (wMin > lMax) return { threshold: (wMin + lMax) / 2, waterAbove: true };
  if (wMax < lMin) return { threshold: (wMax + lMin) / 2, waterAbove: false };
  throw new Error(`cannot separate land from water (land ${lMin}..${lMax}, water ${wMin}..${wMax})`);
}

export function thresholdMask(values: ArrayLike<number>, threshold: number, waterAbove: boolean): Uint8Array {
  const out = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = (waterAbove ? values[i]! > threshold : values[i]! < threshold) ? 255 : 0;
  return out;
}

/** Rolls every row east by `degrees` (rounded to whole pixels). */
export function rollColumns<T extends Uint8Array | Float32Array>(data: T, width: number, height: number, channels: number, degrees: number): T {
  const shift = ((Math.round((degrees / 360) * width) % width) + width) % width;
  if (shift === 0) return data;
  const out = new (data.constructor as new (n: number) => T)(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * channels;
      const to = (y * width + ((x + shift) % width)) * channels;
      for (let c = 0; c < channels; c++) out[to + c] = data[from + c]!;
    }
  }
  return out;
}
```

- [ ] **Step 5: Create `pipeline/textures/rasters.ts`**

```ts
import sharp from 'sharp';

sharp.cache(false);

const open = (file: string) => sharp(file, { limitInputPixels: false });

/** One band, resized with a Lanczos filter, as 32-bit floats (signed rasters keep their sign). */
export async function readBandFloat(file: string, width: number, height: number, band = 0): Promise<Float32Array> {
  const { data, info } = await open(file)
    .extractChannel(band)
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    .raw({ depth: 'float' })
    .toBuffer({ resolveWithObject: true });
  return new Float32Array(data.buffer, data.byteOffset, info.width * info.height);
}

/** sRGB 8-bit RGB at the requested size (alpha removed, 16-bit sources converted). */
export async function readRgb8(file: string, width: number, height: number): Promise<Uint8Array> {
  const { data } = await open(file)
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    .removeAlpha()
    .toColourspace('srgb')
    .raw({ depth: 'uchar' })
    .toBuffer({ resolveWithObject: true });
  return new Uint8Array(data.buffer, data.byteOffset, width * height * 3);
}

export async function writeWebp(raw: Uint8Array, width: number, height: number, channels: 1 | 2 | 3 | 4, out: string, opts: { lossless?: boolean; quality?: number }): Promise<void> {
  await sharp(Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength), { raw: { width, height, channels } })
    .webp(opts.lossless ? { lossless: true } : { quality: opts.quality ?? 90 })
    .toFile(out);
}

export function desaturateRgb(rgb: Uint8Array, amount: number): Uint8Array {
  const out = new Uint8Array(rgb.length);
  for (let i = 0; i < rgb.length; i += 3) {
    const grey = 0.2126 * rgb[i]! + 0.7152 * rgb[i + 1]! + 0.0722 * rgb[i + 2]!;
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(rgb[i + c]! + (grey - rgb[i + c]!) * amount);
  }
  return out;
}

export async function imageInfo(file: string): Promise<{ width: number; height: number; channels: number; depth: string }> {
  const m = await open(file).metadata();
  return { width: m.width ?? 0, height: m.height ?? 0, channels: m.channels ?? 0, depth: String(m.depth) };
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run pipeline/textures/derive.test.ts pipeline/textures/rasters.test.ts`
Expected: all PASS. If `raw({ depth: 'float' })` is rejected by the installed sharp, use `.toFormat('raw', { depth: 'float' })` instead (the same libvips option). Record the change as a ledger ruling.

- [ ] **Step 7: Commit**

```powershell
git add pipeline/textures/derive.ts pipeline/textures/derive.test.ts pipeline/textures/rasters.ts pipeline/textures/rasters.test.ts
git commit -m "feat(textures): add raster helpers, normal maps, mask calibration and sanity checks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Ring profiles from NASA ring tables, and the star-map orientation check

**Files:**
- Create: `pipeline/textures/rings.ts`, `pipeline/textures/stars.ts`, `pipeline/fixtures/satringfact.html`, `pipeline/fixtures/uranringfact.html` (downloaded)
- Test: `pipeline/textures/rings.test.ts`, `pipeline/textures/stars.test.ts`

**Interfaces:**
- Consumes: `parseHtml`, `cellText`, `decodeEntities` (M1 `pipeline/lib/html.ts`).
- Produces (`rings.ts`):
  - `interface RingRow { name: string; radiusKm?: number; opticalDepth?: number; albedo?: number; widthKm?: number }`;
  - `parseRingSheet(html: string): RingRow[]`;
  - `interface RingBand { name: string; innerKm: number; outerKm: number; opticalDepth: number; albedo: number }`;
  - `buildRingBands(rows: RingRow[], opts: { albedoUnit: number; minOpticalDepth: number }): RingBand[]`;
  - `ringProfile(bands, opts: { width: number; tint: [number, number, number] }): { rgba: Uint8Array; innerKm: number; outerKm: number }` (image `width × 2`).
- Produces (`stars.ts`):
  - `decodeStarMapExr(file): Promise<{ width; height; rgb: Float32Array }>` (top row = +90° Dec);
  - `linearToSrgb8(rgb: Float32Array, exposure): Uint8Array`;
  - `findBrightBlobs(gray: ArrayLike<number>, width, height, threshold): Array<{ x; y; pixels }>`;
  - `pixelToRaDec(x, y, width, height)` / `raDecToPixel(raDeg, decDeg, width, height)`;
  - `ORIENTATION_STARS`;
  - `verifySkyOrientation(gray, width, height): { matched: string[]; missing: string[] }`.

Star-map convention, verified during planning on the 4k map: in the image as viewed, the **top is +90° Dec**, the **centre column is RA 0h**, and **RA increases to the left**. three's `EXRLoader` returns rows **bottom-up**, so they are flipped after decoding. Values are already in 0..1.

- [ ] **Step 1: Download the ring fixtures**

```powershell
curl.exe -sSL -o pipeline/fixtures/satringfact.html https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html
curl.exe -sSL -o pipeline/fixtures/uranringfact.html https://nssdc.gsfc.nasa.gov/planetary/factsheet/uranringfact.html
```

- [ ] **Step 2: Write the failing tests `pipeline/textures/rings.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildRingBands, parseRingSheet, ringProfile } from './rings';

const saturnRows = parseRingSheet(readFileSync('pipeline/fixtures/satringfact.html', 'utf8'));
const uranusRows = parseRingSheet(readFileSync('pipeline/fixtures/uranringfact.html', 'utf8'));

describe('parseRingSheet (NSSDCA)', () => {
  it('reads Saturn edges, ranges and superscript exponents', () => {
    expect(saturnRows.find((r) => r.name === 'B inner edge')).toMatchObject({ radiusKm: 91975, opticalDepth: 1.45, albedo: 0.5 });
    expect(saturnRows.find((r) => r.name === 'D inner edge')?.opticalDepth).toBeCloseTo(1e-5, 10);
    expect(saturnRows.find((r) => r.name === 'Cassini division')).toMatchObject({ radiusKm: undefined, opticalDepth: 0.05 });
  });
  it('reads Uranus radii, widths and approximate values', () => {
    expect(uranusRows.find((r) => r.name === 'Epsilon')).toMatchObject({ radiusKm: 51149, widthKm: 58, opticalDepth: 1.4, albedo: 18 });
    expect(uranusRows.find((r) => r.name === 'Lambda')?.opticalDepth).toBeCloseTo(0.1, 9);
  });
});

describe('buildRingBands and ringProfile', () => {
  const saturn = buildRingBands(saturnRows, { albedoUnit: 1, minOpticalDepth: 0.01 });
  it('pairs edges and fills the Cassini division between B and A', () => {
    expect(saturn.map((b) => b.name)).toEqual(['C', 'B', 'Cassini division', 'A', 'F ring']);
    expect(saturn.find((b) => b.name === 'Cassini division')).toMatchObject({ innerKm: 117507, outerKm: 122340 });
  });
  it('makes the B ring opaque and the Cassini division nearly clear', () => {
    const { rgba, innerKm, outerKm } = ringProfile(saturn, { width: 2048, tint: [0.85, 0.78, 0.66] });
    const alphaAt = (r: number) => rgba[Math.floor(((r - innerKm) / (outerKm - innerKm)) * 2047) * 4 + 3]!;
    expect(alphaAt(105000)).toBeGreaterThan(180);
    expect(alphaAt(119900)).toBeLessThan(30);
    expect(innerKm).toBe(74658);
  });
  it('builds faint, dark Uranian rings from radius and width', () => {
    const uranus = buildRingBands(uranusRows, { albedoUnit: 1e-3, minOpticalDepth: 0.01 });
    expect(uranus.map((b) => b.name)).toContain('Epsilon');
    expect(uranus.some((b) => b.name.startsWith('R/2003'))).toBe(false);
    const { rgba, innerKm, outerKm } = ringProfile(uranus, { width: 2048, tint: [0.5, 0.5, 0.5] });
    const i = Math.floor(((51149 - innerKm) / (outerKm - innerKm)) * 2047) * 4;
    expect(rgba[i + 3]!).toBeGreaterThan(80);
    expect(rgba[i]!).toBeLessThan(40);
  });
});
```

- [ ] **Step 3: Write the failing tests `pipeline/textures/stars.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { findBrightBlobs, linearToSrgb8, ORIENTATION_STARS, pixelToRaDec, raDecToPixel, verifySkyOrientation } from './stars';

const W = 720;
const H = 360;

function skyWith(stars: Array<{ raDeg: number; decDeg: number }>, mirror = false): Float32Array {
  const img = new Float32Array(W * H).fill(0.1);
  for (const s of stars) {
    let { x, y } = raDecToPixel(s.raDeg, s.decDeg, W, H);
    if (mirror) x = W - 1 - x;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) img[(y + dy) * W + ((x + dx + W) % W)] = 1;
  }
  return img;
}

describe('star map orientation', () => {
  it('maps the centre column to RA 0 with RA increasing to the left and north at the top', () => {
    expect(pixelToRaDec(W / 2, 0, W, H).decDeg).toBeCloseTo(90 - 90 / H, 6);
    expect(pixelToRaDec(W / 2, H / 2, W, H).raDeg).toBeCloseTo(359.75, 1);
    const p = raDecToPixel(90, 0, W, H);
    expect(p.x).toBeLessThan(W / 2);
  });
  it('round-trips pixel and sky coordinates', () => {
    const p = raDecToPixel(213.9, 19.2, W, H);
    const back = pixelToRaDec(p.x, p.y, W, H);
    expect(back.raDeg).toBeCloseTo(213.9, 0);
    expect(back.decDeg).toBeCloseTo(19.2, 0);
  });
  it('finds blobs, including one straddling the RA seam', () => {
    const img = new Float32Array(W * H);
    for (const x of [W - 1, 0]) img[100 * W + x] = 1;
    const blobs = findBrightBlobs(img, W, H, 0.9);
    expect(blobs).toHaveLength(1);
    expect(blobs[0]!.pixels).toBe(2);
  });
  it('accepts a correctly oriented sky and rejects a mirrored one', () => {
    expect(verifySkyOrientation(skyWith(ORIENTATION_STARS), W, H).missing).toEqual([]);
    expect(verifySkyOrientation(skyWith(ORIENTATION_STARS, true), W, H).matched.length).toBeLessThan(3);
  });
  it('encodes linear light as sRGB bytes', () => {
    expect([...linearToSrgb8(Float32Array.from([0, 0.5, 1]), 1)]).toEqual([0, 188, 255]);
  });
});
```

- [ ] **Step 4: Run and confirm failure**

Run: `npx vitest run pipeline/textures/rings.test.ts pipeline/textures/stars.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 5: Create `pipeline/textures/rings.ts`**

```ts
import { cellText, decodeEntities, parseHtml, type HTMLElement } from '../lib/html';

export interface RingRow {
  name: string;
  radiusKm?: number;
  opticalDepth?: number;
  albedo?: number;
  widthKm?: number;
}

export interface RingBand {
  name: string;
  innerKm: number;
  outerKm: number;
  opticalDepth: number;
  albedo: number;
}

/** "0.05 - 0.35" → 0.2; "1e-5" → 1e-5; "~0.4-" → 0.4; "<<0.01" → 0.005; "60,268" → 60268. */
export function parseValue(raw: string): number | undefined {
  let t = decodeEntities(raw).replace(/,/g, '').replace(/~/g, '').trim();
  if (t === '') return undefined;
  if (t.startsWith('<<') || t.startsWith('<')) {
    const n = Number(t.replace(/</g, ''));
    return Number.isFinite(n) ? n / 2 : undefined;
  }
  t = t.replace(/[+-]$/, '').trim();
  const range = /^([\d.]+)\s*-\s*([\d.]+)$/.exec(t);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Cell texts with colspans expanded, so column indexes line up across rows. */
function cellsOf(tr: HTMLElement): string[] {
  return tr.querySelectorAll('th, td').flatMap((c) => {
    const span = Number(c.getAttribute('colspan') ?? '1');
    return [cellText(c), ...Array<string>(Math.max(0, span - 1)).fill('')];
  });
}

export function parseRingSheet(html: string): RingRow[] {
  // Powers of ten: 10<sup>-5</sup> → 1e-5 (other superscripts, like cm<sup>2</sup>, stay as text).
  // Line breaks inside header cells ("Radius<br />(km)") become spaces.
  const cleaned = html.replace(/10\s*<sup>\s*([-\d]+)\s*<\/sup>/gi, '1e$1').replace(/<br\s*\/?>/gi, ' ');
  const root = parseHtml(cleaned);
  const table = root.querySelector('table');
  if (!table) throw new Error('Ring fact sheet: no table found');
  const rows = table.querySelectorAll('tr');
  const header = cellsOf(rows[0]!);
  const col = (prefix: string) => header.findIndex((h) => h.startsWith(prefix));
  const radiusCol = col('Radius (km)');
  const tauCol = col('Optical Depth');
  const albedoCol = col('Albedo');
  const widthCol = col('Width');
  if (radiusCol < 0 || tauCol < 0) throw new Error(`Ring fact sheet: unexpected header ${header.join(' | ')}`);
  const out: RingRow[] = [];
  for (const tr of rows.slice(1)) {
    const cells = cellsOf(tr);
    const name = cells[0];
    if (!name || /equator/i.test(name)) continue;
    const get = (i: number) => (i >= 0 ? parseValue(cells[i] ?? '') : undefined);
    out.push({ name, radiusKm: get(radiusCol), opticalDepth: get(tauCol), albedo: get(albedoCol), widthKm: get(widthCol) });
  }
  return out;
}

export function buildRingBands(rows: RingRow[], opts: { albedoUnit: number; minOpticalDepth: number }): RingBand[] {
  const bands: RingBand[] = [];
  const pending: Array<{ name: string; tau: number; albedo: number }> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const tau = row.opticalDepth;
    const albedo = (row.albedo ?? 0.3 / opts.albedoUnit) * opts.albedoUnit;
    const inner = /^(.*) inner edge$/.exec(row.name);
    if (inner && row.radiusKm !== undefined) {
      const outerRow = rows.slice(i + 1).find((r) => r.name === `${inner[1]} outer edge`);
      if (outerRow?.radiusKm !== undefined && tau !== undefined) {
        // A gap row (no radius) between the previous band and this one fills the space between them.
        const gap = pending.shift();
        const prev = bands.at(-1);
        if (gap && prev) bands.push({ name: gap.name, innerKm: prev.outerKm, outerKm: row.radiusKm, opticalDepth: gap.tau, albedo: gap.albedo });
        bands.push({ name: inner[1]!, innerKm: row.radiusKm, outerKm: outerRow.radiusKm, opticalDepth: tau, albedo });
      }
      continue;
    }
    if (/ outer edge$/.test(row.name)) continue;
    if (row.radiusKm === undefined && tau !== undefined) {
      pending.push({ name: row.name, tau, albedo });
      continue;
    }
    if (row.radiusKm !== undefined && tau !== undefined && !/gap|ringlet/i.test(row.name)) {
      const half = (row.widthKm ?? 50) / 2;
      bands.push({ name: row.name, innerKm: row.radiusKm - half, outerKm: row.radiusKm + half, opticalDepth: tau, albedo });
    }
  }
  return bands.filter((b) => b.opticalDepth >= opts.minOpticalDepth).sort((a, b) => a.innerKm - b.innerKm);
}

/** Radial RGBA profile (width × 2): alpha from optical depth with sub-texel coverage, colour = tint × albedo. */
export function ringProfile(bands: RingBand[], opts: { width: number; tint: [number, number, number] }): { rgba: Uint8Array; innerKm: number; outerKm: number } {
  const innerKm = Math.min(...bands.map((b) => b.innerKm));
  const outerKm = Math.max(...bands.map((b) => b.outerKm));
  const texelKm = (outerKm - innerKm) / opts.width;
  const rgba = new Uint8Array(opts.width * 2 * 4);
  for (let x = 0; x < opts.width; x++) {
    const r0 = innerKm + x * texelKm;
    const r1 = r0 + texelKm;
    let alpha = 0;
    let bright = 0;
    for (const b of bands) {
      const overlap = Math.max(0, Math.min(r1, b.outerKm) - Math.max(r0, b.innerKm));
      if (overlap <= 0) continue;
      const coverage = overlap / texelKm;
      const a = (1 - Math.exp(-b.opticalDepth)) * coverage;
      alpha = Math.max(alpha, a);
      bright = Math.max(bright, Math.min(1.2, Math.max(0.05, b.albedo / 0.4)));
    }
    for (const row of [0, 1]) {
      const i = (row * opts.width + x) * 4;
      rgba[i] = Math.round(Math.min(1, opts.tint[0] * bright) * 255);
      rgba[i + 1] = Math.round(Math.min(1, opts.tint[1] * bright) * 255);
      rgba[i + 2] = Math.round(Math.min(1, opts.tint[2] * bright) * 255);
      rgba[i + 3] = Math.round(Math.min(1, alpha) * 255);
    }
  }
  return { rgba, innerKm, outerKm };
}
```

- [ ] **Step 6: Create `pipeline/textures/stars.ts`**

```ts
import { readFile } from 'node:fs/promises';
import { FloatType } from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

/** J2000 positions (Hipparcos), used only to validate the sky map's orientation. */
export const ORIENTATION_STARS = [
  { name: 'Vega', raDeg: 279.2347, decDeg: 38.7837 },
  { name: 'Capella', raDeg: 79.1723, decDeg: 45.998 },
  { name: 'Arcturus', raDeg: 213.9153, decDeg: 19.1824 },
  { name: 'Canopus', raDeg: 95.988, decDeg: -52.6957 },
  { name: 'Procyon', raDeg: 114.8255, decDeg: 5.225 },
];

/** Image convention (NASA Deep Star Maps): centre column = RA 0h, RA increases to the left, top row = +90° Dec. */
export function pixelToRaDec(x: number, y: number, width: number, height: number): { raDeg: number; decDeg: number } {
  const u = (x + 0.5) / width;
  return { raDeg: (((0.5 - u) * 360) % 360 + 360) % 360, decDeg: 90 - ((y + 0.5) / height) * 180 };
}

export function raDecToPixel(raDeg: number, decDeg: number, width: number, height: number): { x: number; y: number } {
  const u = (((0.5 - raDeg / 360) % 1) + 1) % 1;
  return { x: Math.min(width - 1, Math.floor(u * width)), y: Math.min(height - 1, Math.max(0, Math.floor(((90 - decDeg) / 180) * height))) };
}

export async function decodeStarMapExr(file: string): Promise<{ width: number; height: number; rgb: Float32Array }> {
  const buf = await readFile(file);
  const loader = new EXRLoader();
  loader.setDataType(FloatType);
  const tex = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer) as unknown as {
    data: Float32Array;
    width: number;
    height: number;
  };
  const { width, height, data } = tex;
  const channels = data.length / (width * height);
  const rgb = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y; // EXRLoader rows are bottom-up
    for (let x = 0; x < width; x++) {
      const s = (srcRow * width + x) * channels;
      const d = (y * width + x) * 3;
      rgb[d] = data[s]!;
      rgb[d + 1] = data[s + 1]!;
      rgb[d + 2] = data[s + 2]!;
    }
  }
  return { width, height, rgb };
}

export function linearToSrgb8(values: Float32Array, exposure: number): Uint8Array {
  const out = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const v = Math.min(1, Math.max(0, values[i]! * exposure));
    const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    out[i] = Math.round(s * 255);
  }
  return out;
}

export function findBrightBlobs(gray: ArrayLike<number>, width: number, height: number, threshold: number): Array<{ x: number; y: number; pixels: number }> {
  const seen = new Uint8Array(width * height);
  const blobs: Array<{ x: number; y: number; pixels: number }> = [];
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || gray[start]! < threshold) continue;
    const stack = [start];
    seen[start] = 1;
    let pixels = 0;
    let sx = 0;
    let sy = 0;
    let anchorX = start % width;
    while (stack.length) {
      const j = stack.pop()!;
      const x = j % width;
      const y = Math.floor(j / width);
      // Unwrap x relative to the first pixel so blobs across the seam average correctly.
      let ux = x;
      if (ux - anchorX > width / 2) ux -= width;
      if (anchorX - ux > width / 2) ux += width;
      pixels += 1;
      sx += ux;
      sy += y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = (x + dx + width) % width;
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        const k = ny * width + nx;
        if (!seen[k] && gray[k]! >= threshold) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
    blobs.push({ x: (((sx / pixels) % width) + width) % width, y: sy / pixels, pixels });
  }
  return blobs.sort((a, b) => b.pixels - a.pixels);
}

/** Each orientation star must have a bright blob within 1° of its catalogue position. */
export function verifySkyOrientation(gray: ArrayLike<number>, width: number, height: number): { matched: string[]; missing: string[] } {
  const blobs = findBrightBlobs(gray, width, height, 0.9).slice(0, 400);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const star of ORIENTATION_STARS) {
    const hit = blobs.some((b) => {
      const p = pixelToRaDec(b.x, b.y, width, height);
      const dRa = Math.abs(((p.raDeg - star.raDeg + 540) % 360) - 180) * Math.cos((star.decDeg * Math.PI) / 180);
      return Math.hypot(dRa, p.decDeg - star.decDeg) < 1;
    });
    (hit ? matched : missing).push(star.name);
  }
  return { matched, missing };
}
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run pipeline/textures/rings.test.ts pipeline/textures/stars.test.ts`
Expected: all PASS. If the Saturn band list differs only by whether `F ring` is present (its optical depth is 0.1), keep the source data and update the expectation. Record that as a ledger note.

- [ ] **Step 8: Commit**

```powershell
git add pipeline/textures/rings.ts pipeline/textures/rings.test.ts pipeline/textures/stars.ts pipeline/textures/stars.test.ts pipeline/fixtures/satringfact.html pipeline/fixtures/uranringfact.html
git commit -m "feat(textures): add ring profiles from NSSDCA tables and star-map orientation checks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Imagery and render schema

**Files:**
- Modify: `src/core/catalog/schema.ts`, `src/test/fixtures.ts`, `pipeline/build/buildSolarSystem.ts`, `public/data/solar-system/bodies.json` (regenerated offline)
- Test: `src/core/catalog/schema.test.ts` (extend)

**Interfaces:**
- Produces: `TIERS = ['1k','2k','4k','8k'] as const`; `type Tier`; `TextureRefSchema` / `type TextureRef`; `ImagerySchema` / `type Imagery` (`color`, `normal`, `night`, `clouds`, `specular`, and `rings: { texture; innerKm: SourcedValue; outerKm: SourcedValue }`, all optional); `RenderSchema` / `type Render` (`shader: 'earth' | 'rocky' | 'giant' | 'venus' | 'sun'`; `atmosphere: 'earth' | 'mars' | 'venus' | null`; `lommelSeeliger: number`; `normalStrength: number`; `bandFlow: boolean`); `ImageryFileSchema` / `type ImageryFile` (`{ schemaVersion: 1; generatedAt; sources: Source[]; bodies: Record<string, Imagery> }`).
- **Breaking change:** `Body.texture` is removed; `Body.imagery: Imagery | null` and `Body.render: Render` are added.

- [ ] **Step 1: Add failing tests to `src/core/catalog/schema.test.ts`**

Append:
```ts
import { ImageryFileSchema, TextureRefSchema } from './schema';

describe('imagery schema', () => {
  it('accepts tiered textures with a source and rejects empty ones', () => {
    expect(TextureRefSchema.safeParse({ tiers: { '1k': 'textures/earth/color_1k.webp' }, sourceId: 'nasa-blue-marble-ng' }).success).toBe(true);
    expect(TextureRefSchema.safeParse({ tiers: {}, sourceId: 'x' }).success).toBe(false);
    expect(TextureRefSchema.safeParse({ tiers: { '16k': 'a' }, sourceId: 'x' }).success).toBe(false);
  });
  it('validates an imagery file with rings', () => {
    const file = {
      schemaVersion: 1,
      generatedAt: '2026-10-04T12:00:00.000Z',
      sources: [],
      bodies: {
        saturn: {
          color: { tiers: { '2k': 'textures/saturn/color_2k.webp' }, sourceId: 'stsci-opal' },
          rings: {
            texture: { tiers: { '2k': 'textures/saturn/rings_2k.webp' }, sourceId: 'nssdca-saturn-rings', illustrative: true },
            innerKm: { value: 74658, sourceId: 'nssdca-saturn-rings' },
            outerKm: { value: 139851, sourceId: 'nssdca-saturn-rings' },
          },
        },
      },
    };
    expect(ImageryFileSchema.safeParse(file).success).toBe(true);
  });
  it('requires render settings on every body', () => {
    const f = makeCatalogFiles();
    delete (f.bodies.bodies[0] as { render?: unknown }).render;
    expect(BodiesFileSchema.safeParse(f.bodies).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/core/catalog/schema.test.ts`
Expected: FAIL (`TextureRefSchema` not exported).

- [ ] **Step 3: Update `src/core/catalog/schema.ts`**

Add before `BodySchema`:
```ts
export const TIERS = ['1k', '2k', '4k', '8k'] as const;

export const TextureRefSchema = z
  .object({
    tiers: z.partialRecord(z.enum(TIERS), z.string().min(1)),
    sourceId: SourceIdSchema,
    derivation: z.string().min(1).optional(),
    illustrative: z.boolean().optional(),
  })
  .refine((t) => Object.keys(t.tiers).length > 0, { message: 'texture needs at least one tier' });

export const ImagerySchema = z.object({
  color: TextureRefSchema.optional(),
  normal: TextureRefSchema.optional(),
  night: TextureRefSchema.optional(),
  clouds: TextureRefSchema.optional(),
  specular: TextureRefSchema.optional(),
  rings: z.object({ texture: TextureRefSchema, innerKm: SourcedValueSchema, outerKm: SourcedValueSchema }).optional(),
});

export const RenderSchema = z.object({
  shader: z.enum(['earth', 'rocky', 'giant', 'venus', 'sun']),
  atmosphere: z.enum(['earth', 'mars', 'venus']).nullable(),
  lommelSeeliger: z.number().min(0).max(1),
  normalStrength: z.number().nonnegative(),
  bandFlow: z.boolean(),
});
```

In `BodySchema`, replace
```ts
  texture: z.object({ url: z.string().min(1), sourceId: SourceIdSchema }).nullable(),
```
with
```ts
  imagery: ImagerySchema.nullable(),
  render: RenderSchema,
```

After `BodiesFileSchema`, add:
```ts
export const ImageryFileSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.iso.datetime(),
  sources: z.array(SourceSchema),
  bodies: z.record(z.string(), ImagerySchema),
});
```

Add these to the type exports:
```ts
export type Tier = (typeof TIERS)[number];
export type TextureRef = z.infer<typeof TextureRefSchema>;
export type Imagery = z.infer<typeof ImagerySchema>;
export type Render = z.infer<typeof RenderSchema>;
export type ImageryFile = z.infer<typeof ImageryFileSchema>;
```

- [ ] **Step 4: Update the fixtures `src/test/fixtures.ts`**

In `makeSun()`, replace `texture: null,` with:
```ts
    imagery: null,
    render: { shader: 'sun', atmosphere: null, lommelSeeliger: 0, normalStrength: 0, bandFlow: false },
```
In `makeEarth()`:
```ts
    imagery: null,
    render: { shader: 'earth', atmosphere: 'earth', lommelSeeliger: 0, normalStrength: 1, bandFlow: false },
```
In `makeJupiter()`:
```ts
    imagery: null,
    render: { shader: 'giant', atmosphere: null, lommelSeeliger: 0, normalStrength: 0, bandFlow: true },
```

- [ ] **Step 5: Give the data pipeline render settings (imagery comes in Task 7)**

In `pipeline/build/buildSolarSystem.ts`:
1. Add `render: Render` to `interface PlanetSpec` and import `Render` from the schema.
2. Give each `PLANET_SPECS` entry its `render`:

| id | render |
|---|---|
| mercury | `{ shader: 'rocky', atmosphere: null, lommelSeeliger: 0.85, normalStrength: 1, bandFlow: false }` |
| venus | `{ shader: 'venus', atmosphere: 'venus', lommelSeeliger: 0, normalStrength: 0, bandFlow: false }` |
| earth | `{ shader: 'earth', atmosphere: 'earth', lommelSeeliger: 0, normalStrength: 1, bandFlow: false }` |
| mars | `{ shader: 'rocky', atmosphere: 'mars', lommelSeeliger: 0.4, normalStrength: 1, bandFlow: false }` |
| jupiter, saturn, uranus, neptune | `{ shader: 'giant', atmosphere: null, lommelSeeliger: 0, normalStrength: 0, bandFlow: true }` |

3. In the Sun body, replace `texture: null,` with `imagery: null,` and `render: { shader: 'sun', atmosphere: null, lommelSeeliger: 0, normalStrength: 0, bandFlow: false },`. In the planets map, replace `texture: null,` with `imagery: null,` and `render: spec.render,`.

- [ ] **Step 6: Run tests and the type checker, then regenerate the data offline**

Run: `npx vitest run src/core/catalog/schema.test.ts`, then `npm test`, `npm run typecheck`, then `npm run data:offline`
Expected: all PASS; typecheck clean; `Wrote 9 bodies and 14 sources`. The app keeps loading because `bodies.json` now matches the new schema.

- [ ] **Step 7: Commit**

```powershell
git add src/core/catalog/schema.ts src/core/catalog/schema.test.ts src/test/fixtures.ts pipeline/build/buildSolarSystem.ts public/data
git commit -m "feat(core): add imagery and render settings to the catalogue schema" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Texture build: recipes, validation, tiers and imagery.json

**Files:**
- Create: `pipeline/textures/build.ts`, `pipeline/textures/run.ts`, `public/textures/**` (generated), `public/textures/imagery.json` (generated)
- Modify: `package.json` (scripts run with a larger heap)
- Test: `pipeline/textures/build.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5 (`PRODUCTS`, `IMAGERY_SOURCE_SPECS`, `fetchBinaryCached`, raster and derivation helpers, `rings`, `stars`, `ImageryFile`, `Tier`, `TextureRef`); `toSource` (M1 registry).
- Produces: `TIER_WIDTH: Record<Tier, number>`; `COMMITTED_TIERS`; `interface LayerJob`; `LAYER_JOBS`; `tiersFor(job, opts: { hd: boolean; sourceWidth: number }): Tier[]`; `texturePath(body, layer, tier): string` (`textures/<body>/<layer>_<tier>.webp`); `buildTextures(opts: { hd: boolean; offline: boolean; rawDir: string; outDir: string; log }): Promise<ImageryFile>`; `committedBytes(outDir): Promise<number>`.

Validation points (Review Focus 3 and 4):

| Check | Location | Expected |
|---|---|---|
| Earth day map, 1k: Sahara brighter than Pacific | Sahara 23°N 13°E vs. Pacific 0°N 160°W | luminance difference > 40 |
| Earth ocean mask calibration | land: Sahara (23, 13), Siberia (60, 100), Brazil (−10, −55), Australia (−25, 133); water: Pacific (0, −160), N. Atlantic (30, −40), Indian (−20, 75), S. Atlantic (−40, −20) | `calibrateMask` separates them |
| Mars DEM range | — | min < −5000 m, max > 15000 m |
| Mars DEM peak position | Olympus Mons 18.65°N, 133.8°W | argmax within 5° (if it is 180° off, set `PRODUCTS['mars-dem'].lonOffsetDeg` and `mars-color` to 180 and record a ledger ruling) |
| Mercury DEM range | — | min < −3000 m, max > 3000 m |
| Sky orientation | Vega, Capella, Arcturus, Canopus, Procyon | at least 4 of 5 matched |
| Committed size | `public/textures` excluding git-ignored tiers | ≤ 60 MB |

- [ ] **Step 1: Write the failing tests `pipeline/textures/build.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { COMMITTED_TIERS, LAYER_JOBS, texturePath, tiersFor } from './build';
import { PRODUCTS } from './manifest';

describe('texture recipes', () => {
  it('covers every planet and the sky with official products', () => {
    const bodies = new Set(LAYER_JOBS.map((j) => j.body));
    for (const b of ['earth', 'mars', 'mercury', 'jupiter', 'saturn', 'uranus', 'neptune']) expect(bodies.has(b), b).toBe(true);
    for (const j of LAYER_JOBS) expect(PRODUCTS[j.product], j.product).toBeDefined();
  });
  it('produces only committed tiers without --hd, and never upsizes past the source in HD', () => {
    const earthColor = LAYER_JOBS.find((j) => j.body === 'earth' && j.layer === 'color')!;
    expect(tiersFor(earthColor, { hd: false, sourceWidth: 21600 })).toEqual(COMMITTED_TIERS);
    expect(tiersFor(earthColor, { hd: true, sourceWidth: 21600 })).toEqual(['1k', '2k', '4k', '8k']);
    const opal = LAYER_JOBS.find((j) => j.body === 'jupiter' && j.layer === 'color')!;
    expect(tiersFor(opal, { hd: true, sourceWidth: 3600 })).toEqual(['1k', '2k']);
  });
  it('names texture files predictably', () => {
    expect(texturePath('earth', 'color', '2k')).toBe('textures/earth/color_2k.webp');
  });
  it('labels derived and adjusted layers', () => {
    for (const j of LAYER_JOBS.filter((x) => x.kind === 'normal' || x.desaturate)) expect(j.derivation, `${j.body}/${j.layer}`).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run pipeline/textures/build.test.ts`
Expected: FAIL, cannot resolve `./build`.

- [ ] **Step 3: Create `pipeline/textures/build.ts`**

```ts
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Imagery, ImageryFile, Source, TextureRef, Tier } from '../../src/core/catalog/schema';
import { toSource } from '../sources/registry';
import { argmaxLonLat, assertElevationRange, calibrateMask, normalMapFromHeight, rollColumns, sampleEquirect, thresholdMask, type LonLat } from './derive';
import { fetchBinaryCached, type FetchedFile } from './fetchBinary';
import { imagerySpec, PRODUCTS, type ProductId } from './manifest';
import { desaturateRgb, imageInfo, readBandFloat, readRgb8, writeWebp } from './rasters';
import { buildRingBands, parseRingSheet, ringProfile } from './rings';
import { decodeStarMapExr, linearToSrgb8, verifySkyOrientation } from './stars';

export const TIER_WIDTH: Record<Tier, number> = { '1k': 1024, '2k': 2048, '4k': 4096, '8k': 8192 };
export const COMMITTED_TIERS: Tier[] = ['1k', '2k'];
const ALL_TIERS: Tier[] = ['1k', '2k', '4k', '8k'];
export const BUDGET_BYTES = 60 * 1024 * 1024;

type Layer = 'color' | 'night' | 'clouds' | 'normal' | 'specular';

export interface LayerJob {
  body: string;
  layer: Layer;
  product: ProductId;
  kind: 'color' | 'gray' | 'normal' | 'mask';
  maxTier: Tier;
  derivation?: string;
  illustrative?: boolean;
  desaturate?: number;
  normal?: { radiusM: number; metersPerUnit: number; strength: number };
}

export const LAYER_JOBS: LayerJob[] = [
  { body: 'earth', layer: 'color', product: 'earth-day', kind: 'color', maxTier: '8k' },
  { body: 'earth', layer: 'night', product: 'earth-night', kind: 'color', maxTier: '8k' },
  { body: 'earth', layer: 'clouds', product: 'earth-clouds', kind: 'gray', maxTier: '8k', derivation: 'Static cloud composite; its slow drift in the app is illustrative.' },
  { body: 'earth', layer: 'normal', product: 'earth-topography', kind: 'normal', maxTier: '4k', normal: { radiusM: 6_371_000, metersPerUnit: 6400 / 255, strength: 8 }, derivation: 'Normal map derived from GEBCO topography; relief exaggerated ×8 for visibility.' },
  { body: 'earth', layer: 'specular', product: 'earth-bathymetry', kind: 'mask', maxTier: '4k', derivation: 'Ocean mask derived from GEBCO bathymetry (water = 1); drives sun glint.' },
  { body: 'mars', layer: 'color', product: 'mars-color', kind: 'color', maxTier: '8k' },
  { body: 'mars', layer: 'normal', product: 'mars-dem', kind: 'normal', maxTier: '4k', normal: { radiusM: 3_389_500, metersPerUnit: 1, strength: 3 }, derivation: 'Normal map derived from MOLA elevation; relief exaggerated ×3.' },
  { body: 'mercury', layer: 'color', product: 'mercury-color', kind: 'color', maxTier: '8k', desaturate: 0.8, derivation: 'MDIS 3-colour mosaic desaturated 80% toward Mercury’s natural grey-brown.' },
  { body: 'mercury', layer: 'normal', product: 'mercury-dem', kind: 'normal', maxTier: '4k', normal: { radiusM: 2_439_400, metersPerUnit: 1, strength: 3 }, derivation: 'Normal map derived from the MESSENGER DEM; relief exaggerated ×3.' },
  { body: 'jupiter', layer: 'color', product: 'jupiter-opal', kind: 'color', maxTier: '4k', derivation: 'Hubble OPAL 2024 global map (F395N/F502N/F631N composite); longitude alignment approximate.' },
  { body: 'saturn', layer: 'color', product: 'saturn-opal', kind: 'color', maxTier: '4k', derivation: 'Hubble OPAL 2024 global map (F395N/F502N/F631N composite); longitude alignment approximate.' },
  { body: 'uranus', layer: 'color', product: 'uranus-opal', kind: 'color', maxTier: '4k', derivation: 'Hubble OPAL 2023 global map (F467M/F547M/F657N composite); longitude alignment approximate.' },
  { body: 'neptune', layer: 'color', product: 'neptune-opal', kind: 'color', maxTier: '4k', derivation: 'Hubble OPAL 2025 global map (F467M/F547M/F657N composite); longitude alignment approximate.' },
];

const EARTH_LAND: LonLat[] = [
  { lonDeg: 13, latDeg: 23 },
  { lonDeg: 100, latDeg: 60 },
  { lonDeg: -55, latDeg: -10 },
  { lonDeg: 133, latDeg: -25 },
];
const EARTH_WATER: LonLat[] = [
  { lonDeg: -160, latDeg: 0 },
  { lonDeg: -40, latDeg: 30 },
  { lonDeg: 75, latDeg: -20 },
  { lonDeg: -20, latDeg: -40 },
];

export function tiersFor(job: LayerJob, opts: { hd: boolean; sourceWidth: number }): Tier[] {
  if (!opts.hd) return [...COMMITTED_TIERS];
  const max = ALL_TIERS.indexOf(job.maxTier);
  return ALL_TIERS.filter((t, i) => i <= max && (COMMITTED_TIERS.includes(t) || TIER_WIDTH[t] <= opts.sourceWidth));
}

export function texturePath(body: string, layer: string, tier: Tier): string {
  return `textures/${body}/${layer}_${tier}.webp`;
}

/** All tiers up to maxTier are listed; the app falls back when a local-only tier is missing. */
function textureRef(job: { body: string; layer: string; maxTier: Tier; sourceId: string; derivation?: string; illustrative?: boolean }): TextureRef {
  const tiers: Partial<Record<Tier, string>> = {};
  for (const t of ALL_TIERS.slice(0, ALL_TIERS.indexOf(job.maxTier) + 1)) tiers[t] = texturePath(job.body, job.layer, t);
  return {
    tiers,
    sourceId: job.sourceId,
    ...(job.derivation ? { derivation: job.derivation } : {}),
    ...(job.illustrative ? { illustrative: true } : {}),
  };
}

function luminanceAt(rgb: Uint8Array, w: number, h: number, p: LonLat): number {
  return 0.2126 * sampleEquirect(rgb, w, h, p.lonDeg, p.latDeg, 3, 0) + 0.7152 * sampleEquirect(rgb, w, h, p.lonDeg, p.latDeg, 3, 1) + 0.0722 * sampleEquirect(rgb, w, h, p.lonDeg, p.latDeg, 3, 2);
}

function validate(job: LayerJob, data: Uint8Array | Float32Array, w: number, h: number): void {
  if (job.body === 'earth' && job.layer === 'color') {
    const diff = luminanceAt(data as Uint8Array, w, h, EARTH_LAND[0]!) - luminanceAt(data as Uint8Array, w, h, EARTH_WATER[0]!);
    if (diff <= 40) throw new Error(`earth day map orientation check failed: Sahara − Pacific luminance = ${diff.toFixed(1)}`);
  }
  if (job.product === 'mars-dem') {
    assertElevationRange('mars', data, { minBelow: -5000, maxAbove: 15000 });
    const peak = argmaxLonLat(data, w, h);
    const dLon = Math.abs(((peak.lonDeg - -133.8 + 540) % 360) - 180);
    if (dLon > 5 || Math.abs(peak.latDeg - 18.65) > 5) {
      throw new Error(`mars DEM peak at ${peak.lonDeg.toFixed(1)}°, ${peak.latDeg.toFixed(1)}° is not Olympus Mons (−133.8°, 18.65°): check lonOffsetDeg`);
    }
  }
  if (job.product === 'mercury-dem') assertElevationRange('mercury', data, { minBelow: -3000, maxAbove: 3000 });
}

async function processLayer(job: LayerJob, file: string, tier: Tier, tmpDir: string): Promise<void> {
  const w = TIER_WIDTH[tier];
  const h = w / 2;
  const lon = PRODUCTS[job.product].lonOffsetDeg;
  const out = path.join(tmpDir, texturePath(job.body, job.layer, tier).replace(/^textures\//, ''));
  await mkdir(path.dirname(out), { recursive: true });
  if (job.kind === 'color') {
    let rgb = await readRgb8(file, w, h);
    if (job.desaturate) rgb = desaturateRgb(rgb, job.desaturate);
    rgb = rollColumns(rgb, w, h, 3, lon);
    if (tier === '1k') validate(job, rgb, w, h);
    await writeWebp(rgb, w, h, 3, out, { quality: 90 });
  } else if (job.kind === 'gray') {
    const v = rollColumns(await readBandFloat(file, w, h), w, h, 1, lon);
    await writeWebp(Uint8Array.from(v, (x) => Math.max(0, Math.min(255, Math.round(x)))), w, h, 1, out, { quality: 90 });
  } else if (job.kind === 'normal') {
    const height = rollColumns(await readBandFloat(file, w, h), w, h, 1, lon);
    if (tier === '1k') validate(job, height, w, h);
    await writeWebp(normalMapFromHeight(height, w, h, job.normal!), w, h, 3, out, { lossless: true });
  } else {
    const v = rollColumns(await readBandFloat(file, w, h), w, h, 1, lon);
    const cal = calibrateMask(v, w, h, EARTH_LAND, EARTH_WATER);
    await writeWebp(thresholdMask(v, cal.threshold, cal.waterAbove), w, h, 1, out, { lossless: true });
  }
}

async function buildSky(opts: { hd: boolean; offline: boolean; rawDir: string; log: (m: string) => void }, tmpDir: string, fetched: Map<ProductId, FetchedFile>): Promise<TextureRef> {
  const get = async (id: ProductId) => {
    const f = await fetchBinaryCached(PRODUCTS[id].url, PRODUCTS[id].cacheName, opts);
    fetched.set(id, f);
    return f.path;
  };
  const dir = path.join(tmpDir, 'sky');
  await mkdir(dir, { recursive: true });
  const sky4 = await decodeStarMapExr(await get('sky-starmap-4k'));
  const gray = new Float32Array(sky4.width * sky4.height);
  for (let i = 0; i < gray.length; i++) gray[i] = 0.2126 * sky4.rgb[i * 3]! + 0.7152 * sky4.rgb[i * 3 + 1]! + 0.0722 * sky4.rgb[i * 3 + 2]!;
  const check = verifySkyOrientation(gray, sky4.width, sky4.height);
  if (check.matched.length < 4) throw new Error(`sky orientation check failed: missing ${check.missing.join(', ')}`);
  const srgb4 = linearToSrgb8(sky4.rgb, 1);
  await writeWebp(srgb4, sky4.width, sky4.height, 3, path.join(dir, 'color_4k.webp'), { quality: 92 });
  const { default: sharp } = await import('sharp');
  await sharp(Buffer.from(srgb4.buffer, srgb4.byteOffset, srgb4.byteLength), { raw: { width: sky4.width, height: sky4.height, channels: 3 } })
    .resize(2048, 1024, { kernel: 'lanczos3' })
    .webp({ quality: 92 })
    .toFile(path.join(dir, 'color_2k.webp'));
  if (opts.hd) {
    const sky8 = await decodeStarMapExr(await get('sky-starmap-8k'));
    await writeWebp(linearToSrgb8(sky8.rgb, 1), sky8.width, sky8.height, 3, path.join(dir, 'color_8k.webp'), { quality: 92 });
  }
  return { tiers: { '2k': texturePath('sky', 'color', '2k'), '4k': texturePath('sky', 'color', '4k'), '8k': texturePath('sky', 'color', '8k') }, sourceId: 'nasa-svs-deep-star-maps' };
}

async function buildRings(planet: 'saturn' | 'uranus', file: string, tmpDir: string): Promise<NonNullable<Imagery['rings']>> {
  const sourceId = planet === 'saturn' ? 'nssdca-saturn-rings' : 'nssdca-uranus-rings';
  const rows = parseRingSheet(await readFile(file, 'utf8'));
  const bands = buildRingBands(rows, { albedoUnit: planet === 'saturn' ? 1 : 1e-3, minOpticalDepth: 0.01 });
  const tint: [number, number, number] = planet === 'saturn' ? [0.86, 0.78, 0.64] : [0.55, 0.55, 0.55];
  const { rgba, innerKm, outerKm } = ringProfile(bands, { width: 2048, tint });
  const out = path.join(tmpDir, planet, 'rings_2k.webp');
  await mkdir(path.dirname(out), { recursive: true });
  await writeWebp(rgba, 2048, 2, 4, out, { lossless: true });
  return {
    texture: { tiers: { '2k': texturePath(planet, 'rings', '2k') }, sourceId, derivation: 'Radial profile built from the NSSDCA ring table (radii, optical depth, albedo); colour tint is illustrative.', illustrative: true },
    innerKm: { value: Math.round(innerKm), unit: 'km', sourceId },
    outerKm: { value: Math.round(outerKm), unit: 'km', sourceId },
  };
}

export async function committedBytes(outDir: string): Promise<number> {
  let total = 0;
  const walk = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (!/_(4k|8k)\.webp$/.test(entry.name) || full.replace(/\\/g, '/').endsWith('sky/color_4k.webp')) total += (await stat(full)).size;
    }
  };
  if (existsSync(outDir)) await walk(outDir);
  return total;
}

export async function buildTextures(opts: { hd: boolean; offline: boolean; rawDir: string; outDir: string; log: (m: string) => void }): Promise<ImageryFile> {
  const tmpDir = `${opts.outDir}.tmp`;
  await rm(tmpDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });
  const fetched = new Map<ProductId, FetchedFile>();
  const fetchProduct = async (id: ProductId) => {
    const f = await fetchBinaryCached(PRODUCTS[id].url, PRODUCTS[id].cacheName, { offline: opts.offline, rawDir: opts.rawDir, log: opts.log });
    fetched.set(id, f);
    return f.path;
  };
  try {
    const bodies: Record<string, Imagery> = {};
    for (const job of LAYER_JOBS) {
      const file = await fetchProduct(job.product);
      const { width } = await imageInfo(file);
      for (const tier of tiersFor(job, { hd: opts.hd, sourceWidth: width })) {
        opts.log(`${job.body}/${job.layer} ${tier}`);
        await processLayer(job, file, tier, tmpDir);
      }
      (bodies[job.body] ??= {})[job.layer] = textureRef({ ...job, sourceId: PRODUCTS[job.product].sourceId });
    }
    bodies.saturn!.rings = await buildRings('saturn', await fetchProduct('saturn-ring-sheet'), tmpDir);
    bodies.uranus!.rings = await buildRings('uranus', await fetchProduct('uranus-ring-sheet'), tmpDir);
    bodies.sky = { color: await buildSky({ ...opts }, tmpDir, fetched) };

    const usedSourceIds = new Set([...fetched.keys()].map((id) => PRODUCTS[id].sourceId));
    const sources: Source[] = [...usedSourceIds].map((id) => {
      const dates = [...fetched.entries()].filter(([pid]) => PRODUCTS[pid].sourceId === id).map(([, f]) => f.retrievedAt).sort();
      return toSource(imagerySpec(id), dates[0]!);
    });
    const file: ImageryFile = { schemaVersion: 1, generatedAt: new Date().toISOString(), sources, bodies };

    // Budget check on the new committed tiers before anything is promoted.
    const bytes = await committedBytes(tmpDir);
    if (bytes > BUDGET_BYTES) throw new Error(`committed textures are ${(bytes / 1048576).toFixed(1)} MB, over the 60 MB budget`);
    opts.log(`committed texture size ${(bytes / 1048576).toFixed(1)} MB`);
    // Promote: copy new tiers over the old ones (local HD tiers from earlier runs are kept), then write imagery.json.
    await mkdir(opts.outDir, { recursive: true });
    await cp(tmpDir, opts.outDir, { recursive: true, force: true });
    await writeFile(path.join(opts.outDir, 'imagery.json'), `${JSON.stringify(file, null, 2)}\n`, 'utf8');
    return file;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: Create `pipeline/textures/run.ts`, and change the scripts to use a larger heap**

```ts
import path from 'node:path';
import { buildTextures } from './build';

const hd = process.argv.includes('--hd');
const offline = process.argv.includes('--offline');
try {
  const file = await buildTextures({ hd, offline, rawDir: path.resolve('pipeline/raw/textures'), outDir: path.resolve('public/textures'), log: (m) => console.log(m) });
  console.log(`Imagery for ${Object.keys(file.bodies).length} bodies from ${file.sources.length} sources written to public/textures/imagery.json`);
} catch (error) {
  console.error(`Texture pipeline failed; imagery.json was NOT updated.\n${error instanceof Error ? error.stack : String(error)}`);
  process.exit(1);
}
```

In `package.json`, update:
```json
"textures": "node --max-old-space-size=8192 --import tsx pipeline/textures/run.ts",
"textures:hd": "node --max-old-space-size=8192 --import tsx pipeline/textures/run.ts --hd",
```

- [ ] **Step 5: Run the unit tests**

Run: `npx vitest run pipeline/textures`
Expected: all PASS.

- [ ] **Step 6: Run the pipeline (network; about 4.6 GB to download the first time)**

Run: `npm run textures`
Expected:
- each layer logs its tiers;
- the validations pass;
- the run ends with `committed texture size … MB` (≤ 60) and `Imagery for 8 bodies from 13 sources …` (7 planets plus sky; Venus and the Sun have no imagery).

If a validation fails, fix the cause (for example, a longitude offset found by the Mars peak check), record it in the ledger, and re-run with `npm run textures -- --offline`.

Then run: `npm run textures -- --offline`
Expected: identical output from the cache.

- [ ] **Step 7: Look at the outputs**

Open these with the Read tool (it renders images) and confirm:
- `public/textures/earth/color_2k.webp` — continents upright, Africa centred-left of the middle;
- `public/textures/earth/specular_2k.webp` — oceans white;
- `public/textures/mars/normal_2k.webp` — mostly lavender-blue, with Valles Marineris and the Tharsis volcanoes visible as relief;
- `public/textures/sky/color_2k.webp` — the Milky Way band visible.

- [ ] **Step 8: Commit**

```powershell
git add pipeline/textures/build.ts pipeline/textures/build.test.ts pipeline/textures/run.ts package.json public/textures
git commit -m "feat(textures): build tiered official textures, ring profiles and sky with validations" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Merge imagery into the catalogue data

**Files:**
- Modify: `pipeline/build/buildSolarSystem.ts`, `pipeline/build/buildSolarSystem.test.ts`, `pipeline/run.ts`, `pipeline/build/validate.ts`, `public/data/**` (regenerated)
- Modify (vault): `Space_visualizer/Data Sources/` (new notes, Step 6)

**Interfaces:**
- Consumes: `ImageryFile`, `ImageryFileSchema` (Task 5); `public/textures/imagery.json` (Task 6).
- Produces: `PipelineInputs.imagery: ImageryFile`; each body's `imagery` taken from `imagery.bodies[id] ?? null`; imagery sources appended to `sources.json`. The **sky** imagery (`imagery.bodies.sky.color`) stays only in `public/textures/imagery.json`, which the app loads directly for the background (Task 17).

- [ ] **Step 1: Add failing tests to `pipeline/build/buildSolarSystem.test.ts`**

At the top, after the `horizons` constant, add:
```ts
import type { ImageryFile } from '../../src/core/catalog/schema';
const imagery = JSON.parse(readFileSync('public/textures/imagery.json', 'utf8')) as ImageryFile;
```
Change the `buildSolarSystem({...})` call to pass `imagery`, and add:
```ts
  it('attaches official imagery to planets and cites every image', () => {
    expect(body('earth').imagery?.color?.sourceId).toBe('nasa-blue-marble-ng');
    expect(body('saturn').imagery?.rings?.innerKm.value).toBeGreaterThan(70000);
    expect(body('venus').imagery).toBeNull();
    expect(out.sources.sources.map((s) => s.id)).toEqual(expect.arrayContaining(['stsci-opal', 'nssdca-saturn-rings', 'nasa-svs-deep-star-maps']));
    expect(validateOutput(out)).toEqual([]);
  });
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run pipeline/build`
Expected: FAIL (the input has no `imagery`, so it isn't attached).

- [ ] **Step 3: Update `pipeline/build/buildSolarSystem.ts`**

1. Import `ImageryFile` and add `imagery: ImageryFile;` to `PipelineInputs`.
2. In the Sun body: `imagery: inputs.imagery.bodies.sun ?? null,`. In the planets map: `imagery: inputs.imagery.bodies[spec.id] ?? null,`.
3. Append the imagery sources to `sources`, skipping any id already present:
```ts
  for (const s of inputs.imagery.sources) if (!sources.some((x) => x.id === s.id)) sources.push(s);
```

- [ ] **Step 4: Update `pipeline/run.ts`**

After reading `horizons`, add:
```ts
  const imagery = ImageryFileSchema.parse(JSON.parse(await readFile('public/textures/imagery.json', 'utf8')));
```
Pass `imagery` into `buildSolarSystem({...})`, and import `ImageryFileSchema` from `../src/core/catalog/schema`.

- [ ] **Step 5: Run tests and regenerate the data**

Run: `npx vitest run pipeline/build`, then `npm run data:offline`, then `npm test` and `npm run typecheck`
Expected: all PASS; `Wrote 9 bodies and 27 sources` (14 from M1 plus 13 imagery sources).

- [ ] **Step 6: Write the Data Sources vault notes**

Using the M1 note template (`Space_visualizer/Data Sources/*.md`), create one note per new source:
- `NASA Blue Marble Next Generation.md`
- `NASA Black Marble.md`
- `NASA Blue Marble Clouds.md`
- `NASA GEBCO Topography and Bathymetry.md`
- `USGS Mars Viking Color Mosaic.md`
- `USGS Mars MOLA DEM.md`
- `USGS Mercury MESSENGER Mosaics.md`
- `Hubble OPAL Global Maps.md`
- `NASA SVS Deep Star Maps 2020.md`
- `NSSDCA Ring Fact Sheets.md`

Each records publisher, URL, file used, licence, which layer it feeds, the derivation (from `LAYER_JOBS`), the validation that guards it, and how to refresh it (`npm run textures`). Note the scope rulings (single Earth month, latest OPAL year).

Add the notes to `Home.md` under **Data Sources**.

- [ ] **Step 7: Commit**

```powershell
git add pipeline/build pipeline/run.ts public/data "Space_visualizer/Data Sources" Space_visualizer/Home.md
git commit -m "feat(pipeline): attach cited official imagery to bodies" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Shadow geometry and object-space uniforms

**Files:**
- Create: `src/core/shadows/eclipse.ts`, `src/scene/materials/bodyUniforms.ts`
- Test: `src/core/shadows/eclipse.test.ts`, `src/scene/materials/bodyUniforms.test.ts`

**Interfaces:**
- Produces (`eclipse.ts`):
  - `sunVisibleFraction(sunAngularRadius: number, occluderAngularRadius: number, separation: number): number` (radians in, 0..1 out; soft penumbra from the disc-overlap area);
  - `rayPlaneRadius(origin: Vec3, dir: Vec3): number | null` (hit radius on the plane z = 0, forward hits only);
  - `rayHitsEllipsoid(origin: Vec3, dir: Vec3, flattening: number): boolean` (unit equatorial radius, polar radius = flattening, forward hits only).
- Produces (`bodyUniforms.ts`):
  - `interface BodyFrameInput { bodyPosKm: Vec3; cameraPosKm: Vec3; sunPosKm: Vec3; orientation?: Mat3; renderRadiusKm: number; trueRadiusKm: number; sunRadiusKm: number; occluders: Array<{ posKm: Vec3; radiusKm: number }> }`;
  - `interface BodyFrameUniforms { sunDirObj: Vec3; camObj: Vec3; sunDistTrue: number; sunRadiusTrue: number; occluders: Array<{ posTrue: Vec3; radiusTrue: number }> }`;
  - `computeBodyFrameUniforms(input): BodyFrameUniforms`;
  - `uvForLonLat(lonDeg, latDeg): [number, number]`.
- Units: `camObj` is in **render** units (the rendered equatorial radius = 1, matching the mesh). Shadow geometry (`sunDistTrue`, `occluders`) is in **true** equatorial radii, so shadows stay physical in Readable mode. All vectors are expressed in the body-fixed frame (`orientation` maps body-fixed → ecliptic).

- [ ] **Step 1: Write the failing tests**

`src/core/shadows/eclipse.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { rayHitsEllipsoid, rayPlaneRadius, sunVisibleFraction } from './eclipse';

describe('sunVisibleFraction', () => {
  it('is 1 with no overlap and 0 in totality', () => {
    expect(sunVisibleFraction(0.01, 0.01, 0.05)).toBe(1);
    expect(sunVisibleFraction(0.01, 0.02, 0.001)).toBe(0);
  });
  it('handles annular eclipses', () => {
    expect(sunVisibleFraction(0.02, 0.01, 0)).toBeCloseTo(0.75, 9);
  });
  it('matches the analytic overlap for equal discs one radius apart', () => {
    expect(sunVisibleFraction(1, 1, 1)).toBeCloseTo(0.609, 3);
  });
});

describe('ray helpers', () => {
  it('finds where a ray crosses the ring plane', () => {
    expect(rayPlaneRadius([0, 0, 1], [1, 0, -1])).toBeCloseTo(1, 12);
    expect(rayPlaneRadius([0, 0, 1], [0, 0, 1])).toBeNull();
    expect(rayPlaneRadius([3, 0, 0], [0, 0, 1])).toBeNull();
  });
  it('detects hits on a flattened body, forward only', () => {
    expect(rayHitsEllipsoid([3, 0, 0], [-1, 0, 0], 0.9)).toBe(true);
    expect(rayHitsEllipsoid([3, 0, 0], [1, 0, 0], 0.9)).toBe(false);
    expect(rayHitsEllipsoid([0, 0, 3], [0, 1, -1], 0.9)).toBe(false);
  });
});
```

`src/scene/materials/bodyUniforms.test.ts`:
```ts
import { SphereGeometry, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { rotZ, transpose } from '../../core/math/mat3';
import { computeBodyFrameUniforms, uvForLonLat } from './bodyUniforms';

const base = { bodyPosKm: [10, 0, 0] as const, cameraPosKm: [10, 0, 5] as const, sunPosKm: [0, 0, 0] as const, renderRadiusKm: 1, trueRadiusKm: 1, sunRadiusKm: 0.1, occluders: [] };

describe('computeBodyFrameUniforms', () => {
  it('expresses the sun direction and camera in object space', () => {
    const u = computeBodyFrameUniforms(base);
    u.sunDirObj.forEach((v, i) => expect(v).toBeCloseTo([-1, 0, 0][i]!, 12));
    u.camObj.forEach((v, i) => expect(v).toBeCloseTo([0, 0, 5][i]!, 12));
    expect(u.sunDistTrue).toBeCloseTo(10, 12);
  });
  it('rotates into the body-fixed frame', () => {
    const orientation = transpose(rotZ(Math.PI / 2)); // body x axis = ecliptic +y
    const u = computeBodyFrameUniforms({ ...base, orientation });
    u.sunDirObj.forEach((v, i) => expect(v).toBeCloseTo([0, 1, 0][i]!, 12));
  });
  it('uses render units for the camera and true units for shadows', () => {
    const u = computeBodyFrameUniforms({ ...base, renderRadiusKm: 2, trueRadiusKm: 0.5, occluders: [{ posKm: [11, 0, 0], radiusKm: 0.25 }] });
    expect(u.camObj[2]).toBeCloseTo(2.5, 12);
    expect(u.occluders[0]!.posTrue[0]).toBeCloseTo(2, 12);
    expect(u.occluders[0]!.radiusTrue).toBeCloseTo(0.5, 12);
  });
});

describe('texture convention', () => {
  it('matches the rotated SphereGeometry uv layout (lon 0 at +X, east = +Y, north = +Z)', () => {
    const g = new SphereGeometry(1, 64, 32);
    g.rotateX(Math.PI / 2);
    const pos = g.attributes.position!;
    const uv = g.attributes.uv!;
    const find = (target: Vector3) => {
      let best = 0;
      for (let i = 1; i < pos.count; i++) if (new Vector3().fromBufferAttribute(pos, i).distanceTo(target) < new Vector3().fromBufferAttribute(pos, best).distanceTo(target)) best = i;
      return [uv.getX(best), uv.getY(best)];
    };
    const [u0, v0] = find(new Vector3(1, 0, 0));
    expect(u0).toBeCloseTo(uvForLonLat(0, 0)[0], 2);
    expect(v0).toBeCloseTo(uvForLonLat(0, 0)[1], 2);
    expect(find(new Vector3(0, 1, 0))[0]).toBeCloseTo(uvForLonLat(90, 0)[0], 2);
    expect(find(new Vector3(0, 0, 0.999))[1]).toBeCloseTo(1, 2);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/core/shadows src/scene/materials`
Expected: FAIL, modules not found.

- [ ] **Step 3: Create `src/core/shadows/eclipse.ts`**

```ts
import { dot, type Vec3 } from '../math/vec3';

/** Fraction of the Sun's disc visible behind a spherical occluder (circle-overlap area; soft penumbra). */
export function sunVisibleFraction(sunAngularRadius: number, occluderAngularRadius: number, separation: number): number {
  const rs = sunAngularRadius;
  const ro = occluderAngularRadius;
  const d = separation;
  if (d >= rs + ro) return 1;
  if (d <= Math.abs(ro - rs)) return ro >= rs ? 0 : 1 - (ro * ro) / (rs * rs);
  const a1 = rs * rs * Math.acos((d * d + rs * rs - ro * ro) / (2 * d * rs));
  const a2 = ro * ro * Math.acos((d * d + ro * ro - rs * rs) / (2 * d * ro));
  const a3 = 0.5 * Math.sqrt((-d + rs + ro) * (d + rs - ro) * (d - rs + ro) * (d + rs + ro));
  return 1 - (a1 + a2 - a3) / (Math.PI * rs * rs);
}

/** Radius at which a ray meets the plane z = 0, or null if it never does going forward. */
export function rayPlaneRadius(origin: Vec3, dir: Vec3): number | null {
  if (Math.abs(dir[2]) < 1e-12) return null;
  const t = -origin[2] / dir[2];
  if (t <= 0) return null;
  return Math.hypot(origin[0] + t * dir[0], origin[1] + t * dir[1]);
}

/** Forward ray hit on an ellipsoid with equatorial radius 1 and polar radius `flattening`. */
export function rayHitsEllipsoid(origin: Vec3, dir: Vec3, flattening: number): boolean {
  const o: Vec3 = [origin[0], origin[1], origin[2] / flattening];
  const d: Vec3 = [dir[0], dir[1], dir[2] / flattening];
  const a = dot(d, d);
  const b = dot(o, d);
  const c = dot(o, o) - 1;
  const disc = b * b - a * c;
  if (disc < 0) return false;
  return (-b + Math.sqrt(disc)) / a > 0 && (-b - Math.sqrt(disc)) / a > 1e-9;
}
```

- [ ] **Step 4: Create `src/scene/materials/bodyUniforms.ts`**

```ts
import { apply, transpose, type Mat3 } from '../../core/math/mat3';
import { length, normalize, scale, sub, type Vec3 } from '../../core/math/vec3';

export interface BodyFrameInput {
  bodyPosKm: Vec3;
  cameraPosKm: Vec3;
  sunPosKm: Vec3;
  orientation?: Mat3;
  renderRadiusKm: number;
  trueRadiusKm: number;
  sunRadiusKm: number;
  occluders: Array<{ posKm: Vec3; radiusKm: number }>;
}

export interface BodyFrameUniforms {
  sunDirObj: Vec3;
  camObj: Vec3;
  sunDistTrue: number;
  sunRadiusTrue: number;
  occluders: Array<{ posTrue: Vec3; radiusTrue: number }>;
}

/** Float64 world (ecliptic, km) → body-fixed object space for shaders. */
export function computeBodyFrameUniforms(i: BodyFrameInput): BodyFrameUniforms {
  const toBody = (v: Vec3) => (i.orientation ? apply(transpose(i.orientation), v) : v);
  const toSun = sub(i.sunPosKm, i.bodyPosKm);
  const sunDist = length(toSun);
  return {
    sunDirObj: sunDist > 0 ? toBody(normalize(toSun)) : [0, 0, 1],
    camObj: scale(toBody(sub(i.cameraPosKm, i.bodyPosKm)), 1 / i.renderRadiusKm),
    sunDistTrue: sunDist / i.trueRadiusKm,
    sunRadiusTrue: i.sunRadiusKm / i.trueRadiusKm,
    occluders: i.occluders.map((o) => ({ posTrue: scale(toBody(sub(o.posKm, i.bodyPosKm)), 1 / i.trueRadiusKm), radiusTrue: o.radiusKm / i.trueRadiusKm })),
  };
}

/** Equirectangular texture coordinate convention shared with the rotated SphereGeometry. */
export function uvForLonLat(lonDeg: number, latDeg: number): [number, number] {
  return [((lonDeg / 360 + 0.5) % 1 + 1) % 1, 0.5 + latDeg / 180];
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/core/shadows src/scene/materials`
Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/core/shadows src/scene/materials/bodyUniforms.ts src/scene/materials/bodyUniforms.test.ts
git commit -m "feat(core): add eclipse and ring-shadow geometry and object-space body uniforms" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Tiered texture loading, URL overrides and golden-view screenshots

**Files:**
- Create: `src/scene/textures/useTieredTexture.ts`, `src/state/urlParams.ts`, `src/scene/TextureReadiness.tsx`, `e2e/golden.spec.ts`
- Modify: `src/state/viewStore.ts`, `src/camera/orbitController.ts`, `src/camera/CameraSystem.tsx`, `src/scene/SceneRoot.tsx`, `src/App.tsx`, `.gitignore`
- Test: `src/scene/textures/useTieredTexture.test.ts`, `src/state/urlParams.test.ts`, `src/camera/camera.test.ts` (extend)

**Interfaces:**
- Produces (`useTieredTexture.ts`):
  - `tierChain(ref: TextureRef, maxTier: Tier): Tier[]` (listed tiers ≤ max, ascending);
  - `interface TextureLoaderLike { loadAsync(url: string): Promise<Texture> }`;
  - `loadBestTier(ref, maxTier, baseUrl, loader, onTexture): Promise<Tier | null>` (shows the lowest tier first, then the highest tier that loads; never throws);
  - `pendingTextures(): number`; `subscribePending(cb): () => void`;
  - `useTieredTexture(ref: TextureRef | undefined, opts: { maxTier: Tier; srgb: boolean; mipmaps?: boolean }): Texture | null`.
- Produces (`urlParams.ts`):
  - `interface UrlOverrides { jdTdb?; paused?; rateIndex?; target?; distanceKm?; azDeg?; azFromSunDeg?; elDeg?; tier? }`;
  - `parseUrlOverrides(search: string): UrlOverrides`;
  - `applyUrlOverrides(o: UrlOverrides, catalog: Catalog): void`.
- Produces (`viewStore`): `textureTier: Tier` (default `'2k'`), `setTextureTier(t)`, `cameraOverride: { targetId: string; distanceKm?: number; azDeg?: number; azFromSunDeg?: number; elDeg?: number; seq: number } | null`, `requestCameraOverride(o)`.
- Produces (`orbitController`): `setView(view: { distanceKm?: number; azimuthRad?: number; elevationRad?: number }): void`.
- URL parameters:

  | Parameter | Meaning |
  |---|---|
  | `jd` | TDB Julian date |
  | `date` | `YYYY-MM-DD[ HH:MM]` in UTC |
  | `pause=1` | Start paused |
  | `rate` | Speed index |
  | `target` | Body id |
  | `dist` | Camera distance, km |
  | `az` | Azimuth, degrees |
  | `azSun` | Azimuth relative to the direction from the body to the Sun, degrees |
  | `el` | Elevation, degrees |
  | `tier` | Texture tier: `1k`, `2k`, `4k` or `8k` |

  Invalid values are ignored.

- [ ] **Step 1: Write the failing tests**

`src/scene/textures/useTieredTexture.test.ts`:
```ts
import { Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { TextureRef } from '../../core/catalog/schema';
import { loadBestTier, pendingTextures, tierChain, type TextureLoaderLike } from './useTieredTexture';

const ref: TextureRef = { tiers: { '1k': 'a_1k', '2k': 'a_2k', '4k': 'a_4k', '8k': 'a_8k' }, sourceId: 'x' };
const loader = (ok: string[]): TextureLoaderLike => ({
  loadAsync: async (url) => {
    if (!ok.some((o) => url.endsWith(o))) throw new Error(`404 ${url}`);
    const t = new Texture();
    t.name = url;
    return t;
  },
});

describe('tiered textures', () => {
  it('lists tiers up to the maximum', () => {
    expect(tierChain(ref, '2k')).toEqual(['1k', '2k']);
    expect(tierChain({ tiers: { '2k': 'b' }, sourceId: 'x' }, '8k')).toEqual(['2k']);
  });
  it('shows the lowest tier first, then the best tier that exists (HD missing locally)', async () => {
    const shown: string[] = [];
    const best = await loadBestTier(ref, '8k', '/', loader(['a_1k', 'a_2k']), (_t, tier) => shown.push(tier));
    expect(shown).toEqual(['1k', '2k']);
    expect(best).toBe('2k');
    expect(pendingTextures()).toBe(0);
  });
  it('never throws when every tier fails', async () => {
    await expect(loadBestTier(ref, '4k', '/', loader([]), () => undefined)).resolves.toBeNull();
    expect(pendingTextures()).toBe(0);
  });
});
```

`src/state/urlParams.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { makeCatalogFiles } from '../test/fixtures';
import { useSelectionStore } from './selectionStore';
import { useTimeStore } from './timeStore';
import { applyUrlOverrides, parseUrlOverrides } from './urlParams';
import { useViewStore } from './viewStore';

const f = makeCatalogFiles();
const catalog = createCatalog(f.regions, f.sources, [f.bodies]);

describe('parseUrlOverrides', () => {
  it('reads golden-view parameters', () => {
    expect(parseUrlOverrides('?jd=2451545&pause=1&target=jupiter&dist=300000&azSun=90&el=20&tier=4k')).toEqual({
      jdTdb: 2451545, paused: true, target: 'jupiter', distanceKm: 300000, azFromSunDeg: 90, elDeg: 20, tier: '4k',
    });
  });
  it('converts a UTC date to TDB and ignores invalid values', () => {
    const o = parseUrlOverrides('?date=2000-01-01%2012:00&tier=16k&dist=-5&jd=abc&rate=99');
    expect(o.jdTdb).toBeCloseTo(2451545 + 64.184 / 86400, 9);
    expect(o).not.toHaveProperty('tier');
    expect(o).not.toHaveProperty('distanceKm');
    expect(o).not.toHaveProperty('rateIndex');
  });
});

describe('applyUrlOverrides', () => {
  beforeEach(() => useViewStore.setState({ cameraOverride: null, textureTier: '2k' }));
  it('sets time, selection, texture tier and a camera override', () => {
    applyUrlOverrides({ jdTdb: 2451545, paused: true, target: 'jupiter', distanceKm: 1e6, elDeg: 10, tier: '1k' }, catalog);
    expect(useTimeStore.getState()).toMatchObject({ jdTdb: 2451545, playing: false });
    expect(useSelectionStore.getState().selectedId).toBe('jupiter');
    expect(useViewStore.getState().textureTier).toBe('1k');
    expect(useViewStore.getState().cameraOverride).toMatchObject({ targetId: 'jupiter', distanceKm: 1e6, elDeg: 10 });
  });
  it('ignores unknown targets', () => {
    applyUrlOverrides({ target: 'vulcan' }, catalog);
    expect(useViewStore.getState().cameraOverride).toBeNull();
  });
});
```

Append to `src/camera/camera.test.ts` (inside the `orbit controller` describe):
```ts
  it('setView jumps straight to a distance and angles, clamped like user input', () => {
    const c = createOrbitController(base);
    c.setView({ distanceKm: 1, azimuthRad: 1, elevationRad: 2 });
    expect(c.getState()).toMatchObject({ azimuthRad: 1, elevationRad: MAX_ELEVATION_RAD });
    expect(c.getState().distanceKm).toBe(1);
  });
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/scene/textures src/state/urlParams.test.ts src/camera`
Expected: FAIL (modules and `setView` missing).

- [ ] **Step 3: Create `src/scene/textures/useTieredTexture.ts`**

```ts
import { useEffect, useState } from 'react';
import { LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { TIERS, type TextureRef, type Tier } from '../../core/catalog/schema';

export interface TextureLoaderLike {
  loadAsync(url: string): Promise<Texture>;
}

let pending = 0;
const listeners = new Set<() => void>();
const setPending = (delta: number) => {
  pending += delta;
  listeners.forEach((cb) => cb());
};
export const pendingTextures = () => pending;
export function subscribePending(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function tierChain(ref: TextureRef, maxTier: Tier): Tier[] {
  const max = TIERS.indexOf(maxTier);
  return TIERS.filter((t, i) => i <= max && ref.tiers[t] !== undefined);
}

async function tryLoad(loader: TextureLoaderLike, url: string): Promise<Texture | null> {
  setPending(1);
  try {
    return await loader.loadAsync(url);
  } catch {
    return null;
  } finally {
    setPending(-1);
  }
}

/** Lowest tier first for a fast first paint, then the highest tier that loads (missing local HD tiers fall back). */
export async function loadBestTier(ref: TextureRef, maxTier: Tier, baseUrl: string, loader: TextureLoaderLike, onTexture: (t: Texture, tier: Tier) => void): Promise<Tier | null> {
  const chain = tierChain(ref, maxTier);
  let shownIndex = -1;
  for (let i = 0; i < chain.length && shownIndex < 0; i++) {
    const t = await tryLoad(loader, baseUrl + ref.tiers[chain[i]!]!);
    if (t) {
      onTexture(t, chain[i]!);
      shownIndex = i;
    }
  }
  if (shownIndex < 0) return null;
  for (let i = chain.length - 1; i > shownIndex; i--) {
    const t = await tryLoad(loader, baseUrl + ref.tiers[chain[i]!]!);
    if (t) {
      onTexture(t, chain[i]!);
      return chain[i]!;
    }
  }
  return chain[shownIndex]!;
}

export function useTieredTexture(ref: TextureRef | undefined, opts: { maxTier: Tier; srgb: boolean; mipmaps?: boolean }): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null);
  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    let current: Texture | null = null;
    void loadBestTier(ref, opts.maxTier, import.meta.env.BASE_URL, new TextureLoader(), (t) => {
      if (cancelled) {
        t.dispose();
        return;
      }
      t.colorSpace = opts.srgb ? SRGBColorSpace : NoColorSpace;
      t.wrapS = RepeatWrapping;
      t.anisotropy = 8;
      t.generateMipmaps = opts.mipmaps !== false;
      t.minFilter = opts.mipmaps === false ? LinearFilter : LinearMipmapLinearFilter;
      t.needsUpdate = true;
      current?.dispose();
      current = t;
      setTexture(t);
    });
    return () => {
      cancelled = true;
      current?.dispose();
    };
  }, [ref, opts.maxTier, opts.srgb, opts.mipmaps]);
  return texture;
}
```

- [ ] **Step 4: Update `src/state/viewStore.ts`**

Add to the state interface and the store:
```ts
import type { Tier } from '../core/catalog/schema';

export interface CameraOverride {
  targetId: string;
  distanceKm?: number;
  azDeg?: number;
  azFromSunDeg?: number;
  elDeg?: number;
  seq: number;
}
// in ViewState:
  textureTier: Tier;
  cameraOverride: CameraOverride | null;
  setTextureTier(tier: Tier): void;
  requestCameraOverride(o: Omit<CameraOverride, 'seq'>): void;
// in create(...):
  textureTier: '2k',
  cameraOverride: null,
  setTextureTier: (textureTier) => set({ textureTier }),
  requestCameraOverride: (o) => set((s) => ({ cameraOverride: { ...o, seq: (s.cameraOverride?.seq ?? 0) + 1 } })),
```

- [ ] **Step 5: Create `src/state/urlParams.ts`**

```ts
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
```

- [ ] **Step 6: Add `setView` to `src/camera/orbitController.ts` and handle overrides in `CameraSystem`**

In `createOrbitController`'s returned object:
```ts
    setView(view: { distanceKm?: number; azimuthRad?: number; elevationRad?: number }) {
      state = {
        ...state,
        ...(view.distanceKm !== undefined ? { distanceKm: Math.min(MAX_DISTANCE_KM, Math.max(0, view.distanceKm)) } : {}),
        ...(view.azimuthRad !== undefined ? { azimuthRad: view.azimuthRad } : {}),
        ...(view.elevationRad !== undefined ? { elevationRad: clamp(view.elevationRad, -MAX_ELEVATION_RAD, MAX_ELEVATION_RAD) } : {}),
      };
    },
```

In `CameraSystem.tsx`, add `lastOverrideSeq: number` to `Rig` (initialised to 0). In `useFrame`, insert this block right after `const ctx = makeContext(frame, catalog);` and **before** `const { view, coRotate, focusRequest } = useViewStore.getState();`. The view it sets is then read in the same frame, so no view-change transition starts:
```ts
    const override = useViewStore.getState().cameraOverride;
    if (override && override.seq !== r.lastOverrideSeq) {
      r.lastOverrideSeq = override.seq;
      useViewStore.getState().setView('orbit');
      r.activeView = 'orbit';
      r.orbit.focus(override.targetId, ctx);
      let azimuthRad = override.azDeg !== undefined ? override.azDeg * DEG : undefined;
      if (override.azFromSunDeg !== undefined) {
        const body = ctx.bodyPosition(override.targetId) ?? [0, 0, 0];
        const sunId = catalog.bodies.find((b) => b.category === 'star')?.id;
        const sun = (sunId && ctx.bodyPosition(sunId)) || [0, 0, 0];
        azimuthRad = Math.atan2(sun[1] - body[1], sun[0] - body[0]) + override.azFromSunDeg * DEG;
      }
      r.orbit.setView({ distanceKm: override.distanceKm, azimuthRad, elevationRad: override.elDeg !== undefined ? override.elDeg * DEG : undefined });
      r.transition = null;
    }
```

- [ ] **Step 7: Apply URL overrides once the catalogue is ready (`src/App.tsx`)**

```tsx
  useEffect(() => {
    if (status === 'ready' && catalog) applyUrlOverrides(parseUrlOverrides(window.location.search), catalog);
  }, [status, catalog]);
```
Place it next to the existing `load` effect, **before** the early returns (React hooks must run on every render). Import `applyUrlOverrides` and `parseUrlOverrides`.

- [ ] **Step 8: Create `src/scene/TextureReadiness.tsx` and mount it in `SceneRoot`**

```tsx
import { useEffect, useSyncExternalStore } from 'react';
import { pendingTextures, subscribePending } from './textures/useTieredTexture';

/** Marks the scene element with data-textures-ready="true" when no texture loads are pending (used by golden views). */
export function TextureReadiness({ target }: { target: React.RefObject<HTMLDivElement | null> }) {
  const pending = useSyncExternalStore(subscribePending, pendingTextures);
  useEffect(() => {
    const t = setTimeout(() => target.current?.setAttribute('data-textures-ready', pending === 0 ? 'true' : 'false'), 300);
    return () => clearTimeout(t);
  }, [pending, target]);
  return null;
}
```

In `SceneRoot`, add `const sceneRef = useRef<HTMLDivElement>(null);`, put `ref={sceneRef}` on `<div className="scene">`, and render `<TextureReadiness target={sceneRef} />` inside that div (outside the Canvas).

- [ ] **Step 9: Create `e2e/golden.spec.ts` and git-ignore its output**

```ts
import { expect, test } from '@playwright/test';

/** Golden views (spec §7). Screenshots go to test-results/golden/ for review against the look checklist. */
const VIEWS = [
  { name: '1-earth-terminator', url: '/?jd=2461317.5&pause=1&target=earth&dist=26000&azSun=90&el=12' },
  { name: '2-saturn-rings', url: '/?jd=2453371.5&pause=1&target=saturn&dist=420000&azSun=55&el=16' },
  { name: '3-sun', url: '/?jd=2461317.5&pause=1&target=sun&dist=4500000&az=0&el=8' },
  { name: '4-overview', url: '/?jd=2461317.5&pause=1' },
];

for (const view of VIEWS) {
  test(`golden ${view.name}`, async ({ page }) => {
    await page.goto(view.url);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/golden/${view.name}.png` });
  });
}

test('golden 5-phone', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('/?jd=2461317.5&pause=1&target=jupiter&dist=600000&azSun=70&el=10');
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/golden/5-phone.png' });
  await page.close();
});
```

(`test-results/` is already git-ignored.)

- [ ] **Step 10: Run tests, the type checker and the golden views**

Run: `npx vitest run src/scene/textures src/state src/camera`, then `npm test`, `npm run typecheck`, then `npx playwright test e2e/golden.spec.ts --reporter=line`
Expected: all PASS; five PNGs in `test-results/golden/`. They still show M1's plain spheres; the camera framing should already match each view's intent (Earth at about one third of the frame height, Saturn centred, the Sun centred).

- [ ] **Step 11: Commit**

```powershell
git add src e2e/golden.spec.ts
git commit -m "feat(scene): add tiered texture loading, URL view overrides and golden-view screenshots" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Shader framework and per-frame body uniforms

**Files:**
- Create: `src/scene/materials/chunks.ts`, `src/scene/materials/createBodyMaterial.ts`, `src/scene/materials/useBodyUniforms.ts`
- Modify: `src/scene/frameState.ts` (add `bodyRenderRadiusKm`), `src/scene/BodyMesh.tsx` (record the render radius), `e2e/app.spec.ts` (shader console gate)
- Test: `src/scene/materials/createBodyMaterial.test.ts`

**Interfaces:**
- Produces (`chunks.ts`, GLSL strings):
  - `BODY_VERTEX` (varyings `vUnit`, `vUv`, `vPlane`);
  - `FRAG_HEADER` (common, log depth, shared uniforms);
  - `NOISE` (`snoise(vec3)`, `fbm(vec3)`);
  - `LIGHTING` (`surfacePoint`, `surfaceNormal`, `perturbNormal`, `cinematicFill`, `lommelSeeliger`, `ggx`);
  - `ECLIPSE` (`sunVisibleFraction`, `eclipseFactor(vec3 pTrue)`, `rayHitsEllipsoid`);
  - `FRAG_OUTRO` (log depth, tone mapping, colour space);
  - `FRAG_OUTRO_NO_TONEMAP`.
- Produces (`createBodyMaterial.ts`): `createBaseUniforms(): Record<string, IUniform>`; `createBodyMaterial(opts: { fragment: string; uniforms?: Record<string, IUniform>; vertex?: string; transparent?: boolean; blending?: Blending; side?: Side; depthWrite?: boolean; toneMapped?: boolean }): ShaderMaterial`.
- Produces (`useBodyUniforms.ts`):
  - `pickOccluders(bodyId, bodies, positions, max?): Array<{ id; posKm; radiusKm }>` (nearest bodies other than itself and the Sun, up to `max = 4`);
  - `useBodyUniforms(body: Body, materials: Array<ShaderMaterial | null>, bodies: readonly Body[]): void`, which writes `uSunDirObj`, `uCamObj`, `uSunDistTrue`, `uSunRadiusTrue`, `uOccluders`, `uOccluderCount`, `uTime` (real seconds), `uSimDays` (simulation days since J2000) and `uFlattening` at `useFrame` priority −0.4.
- Produces (`FrameState`): `bodyRenderRadiusKm: Map<string, number>`.

- [ ] **Step 1: Write the failing test `src/scene/materials/createBodyMaterial.test.ts`**

```ts
import { AdditiveBlending, ShaderMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../core/math/vec3';
import { makeEarth, makeJupiter, makeSun } from '../../test/fixtures';
import { FRAG_OUTRO } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { pickOccluders } from './useBodyUniforms';

describe('createBodyMaterial', () => {
  it('builds a ShaderMaterial with log-depth chunks and shared uniforms', () => {
    const m = createBodyMaterial({ fragment: `void main(){ gl_FragColor = vec4(1.0); ${FRAG_OUTRO} }`, blending: AdditiveBlending });
    expect(m).toBeInstanceOf(ShaderMaterial);
    expect(m.vertexShader).toContain('#include <logdepthbuf_vertex>');
    expect(m.fragmentShader).toContain('#include <logdepthbuf_fragment>');
    expect(m.fragmentShader).toContain('#include <tonemapping_fragment>');
    expect(m.uniforms.uSunDirObj).toBeDefined();
    expect(m.uniforms.uOccluders!.value).toHaveLength(4);
    expect(m.blending).toBe(AdditiveBlending);
  });
});

describe('pickOccluders', () => {
  it('returns nearest other bodies, never itself or the Sun', () => {
    const bodies = [makeSun(), makeEarth(), makeJupiter()];
    const positions = new Map<string, Vec3>([['sun', [0, 0, 0]], ['earth', [1.5e8, 0, 0]], ['jupiter', [7.8e8, 0, 0]]]);
    expect(pickOccluders('earth', bodies, positions).map((o) => o.id)).toEqual(['jupiter']);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/scene/materials/createBodyMaterial.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Create `src/scene/materials/chunks.ts`**

```ts
/** Shared GLSL. All body shaders work in object space: unit sphere = rendered equatorial radius. */

export const BODY_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vUnit;
varying vec2 vUv;
varying vec2 vPlane;
void main() {
  vUnit = position;
  vUv = uv;
  vPlane = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;

export const FRAG_HEADER = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uSunDirObj;
uniform vec3 uCamObj;
uniform float uFlattening;
uniform float uTime;
uniform float uSimDays;
uniform float uFill;
uniform float uSunIntensity;
uniform float uSunDistTrue;
uniform float uSunRadiusTrue;
uniform int uOccluderCount;
uniform vec4 uOccluders[4];
varying vec3 vUnit;
varying vec2 vUv;
varying vec2 vPlane;
`;

/** 3D simplex noise: Ian McEwan & Stefan Gustavson (Ashima Arts), MIT licence (webgl-noise). */
export const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) { sum += amp * snoise(p); p *= 2.02; amp *= 0.5; }
  return sum;
}
`;

export const LIGHTING = /* glsl */ `
vec3 surfacePoint(vec3 unit) { return vec3(unit.xy, unit.z * uFlattening); }
vec3 surfaceNormal(vec3 unit) { return normalize(vec3(unit.xy, unit.z / uFlattening)); }
/** Tangent-space normal map (x = east, y = north, z = up) applied around normal n (pole = +z). */
vec3 perturbNormal(vec3 n, vec3 texel, float strength) {
  vec3 t = texel * 2.0 - 1.0;
  t.xy *= strength;
  vec3 east = normalize(vec3(-n.y, n.x, 0.0) + vec3(1e-5, 0.0, 0.0));
  vec3 north = cross(n, east);
  return normalize(t.x * east + t.y * north + t.z * n);
}
/** Cinematic fill: faint cool light from the camera side so night sides read as deep blue-black. */
vec3 cinematicFill(vec3 albedo, vec3 n, vec3 v) {
  return uFill * albedo * vec3(0.05, 0.07, 0.13) * (0.35 + 0.65 * max(dot(n, v), 0.0));
}
/** Lommel–Seeliger (×2 so it matches Lambert at normal incidence), gated by the geometric terminator. */
float lommelSeeliger(float mu0, float mu, float geoMu0) {
  return step(0.0, geoMu0) * 2.0 * mu0 / max(mu0 + mu, 1e-4);
}
float ggx(vec3 n, vec3 v, vec3 l, float roughness) {
  vec3 h = normalize(v + l);
  float a2 = roughness * roughness * roughness * roughness;
  float nh = max(dot(n, h), 0.0);
  float d = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}
`;

export const ECLIPSE = /* glsl */ `
float sunVisibleFraction(float rs, float ro, float d) {
  if (d >= rs + ro) return 1.0;
  if (d <= abs(ro - rs)) return ro >= rs ? 0.0 : 1.0 - (ro * ro) / (rs * rs);
  float a1 = rs * rs * acos(clamp((d * d + rs * rs - ro * ro) / (2.0 * d * rs), -1.0, 1.0));
  float a2 = ro * ro * acos(clamp((d * d + ro * ro - rs * rs) / (2.0 * d * ro), -1.0, 1.0));
  float a3 = 0.5 * sqrt(max((-d + rs + ro) * (d + rs - ro) * (d - rs + ro) * (d + rs + ro), 0.0));
  return 1.0 - (a1 + a2 - a3) / (PI * rs * rs);
}
/** Sunlight fraction at a point (true-radius units, body centre at origin) behind up to 4 occluders. */
float eclipseFactor(vec3 p) {
  vec3 toSun = uSunDirObj * uSunDistTrue - p;
  float dSun = length(toSun);
  float as = asin(clamp(uSunRadiusTrue / dSun, 0.0, 1.0));
  float vis = 1.0;
  for (int i = 0; i < 4; i++) {
    if (i >= uOccluderCount) break;
    vec3 toOcc = uOccluders[i].xyz - p;
    float dOcc = length(toOcc);
    if (dOcc >= dSun) continue;
    float ao = asin(clamp(uOccluders[i].w / dOcc, 0.0, 1.0));
    float sep = acos(clamp(dot(toSun / dSun, toOcc / dOcc), -1.0, 1.0));
    vis *= sunVisibleFraction(as, ao, sep);
  }
  return vis;
}
bool rayHitsEllipsoid(vec3 o, vec3 d, float f) {
  vec3 os = vec3(o.xy, o.z / f);
  vec3 ds = vec3(d.xy, d.z / f);
  float a = dot(ds, ds);
  float b = dot(os, ds);
  float c = dot(os, os) - 1.0;
  float disc = b * b - a * c;
  if (disc < 0.0) return false;
  return (-b - sqrt(disc)) / a > 1e-4;
}
`;

export const FRAG_OUTRO = /* glsl */ `
  #include <logdepthbuf_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

export const FRAG_OUTRO_NO_TONEMAP = /* glsl */ `
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
`;
```

- [ ] **Step 4: Create `src/scene/materials/createBodyMaterial.ts`**

```ts
import { FrontSide, NormalBlending, ShaderMaterial, Vector3, Vector4, type Blending, type IUniform, type Side } from 'three';
import { BODY_VERTEX, ECLIPSE, FRAG_HEADER, LIGHTING, NOISE } from './chunks';

export function createBaseUniforms(): Record<string, IUniform> {
  return {
    uSunDirObj: { value: new Vector3(1, 0, 0) },
    uCamObj: { value: new Vector3(0, 0, 3) },
    uFlattening: { value: 1 },
    uTime: { value: 0 },
    uSimDays: { value: 0 },
    uFill: { value: 1 },
    uSunIntensity: { value: 1 },
    uSunDistTrue: { value: 23000 },
    uSunRadiusTrue: { value: 100 },
    uOccluderCount: { value: 0 },
    uOccluders: { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
  };
}

/** Fragment source = shared header + noise + lighting + eclipse helpers + the material's own code (which defines main). */
export function createBodyMaterial(opts: {
  fragment: string;
  uniforms?: Record<string, IUniform>;
  vertex?: string;
  transparent?: boolean;
  blending?: Blending;
  side?: Side;
  depthWrite?: boolean;
  toneMapped?: boolean;
}): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: opts.vertex ?? BODY_VERTEX,
    fragmentShader: `${FRAG_HEADER}\n${NOISE}\n${LIGHTING}\n${ECLIPSE}\n${opts.fragment}`,
    uniforms: { ...createBaseUniforms(), ...opts.uniforms },
    transparent: opts.transparent ?? false,
    blending: opts.blending ?? NormalBlending,
    side: opts.side ?? FrontSide,
    depthWrite: opts.depthWrite ?? true,
    toneMapped: opts.toneMapped ?? true,
  });
}
```

- [ ] **Step 5: Create `src/scene/materials/useBodyUniforms.ts`, and record render radii**

```ts
import { useFrame } from '@react-three/fiber';
import type { ShaderMaterial } from 'three';
import type { Body } from '../../core/catalog/schema';
import { length, sub, type Vec3 } from '../../core/math/vec3';
import { J2000_JD } from '../../core/units';
import { useFrameState } from '../FrameStateContext';
import { computeBodyFrameUniforms } from './bodyUniforms';

export function pickOccluders(bodyId: string, bodies: readonly Body[], positions: ReadonlyMap<string, Vec3>, max = 4): Array<{ id: string; posKm: Vec3; radiusKm: number }> {
  const self = positions.get(bodyId);
  if (!self) return [];
  return bodies
    .filter((b) => b.id !== bodyId && b.category !== 'star' && positions.has(b.id))
    .map((b) => ({ id: b.id, posKm: positions.get(b.id)!, radiusKm: b.shape.equatorialRadiusKm }))
    .sort((a, b) => length(sub(a.posKm, self)) - length(sub(b.posKm, self)))
    .slice(0, max);
}

/** Writes object-space lighting uniforms into the given materials every frame (after BodyMesh positions, before render). */
export function useBodyUniforms(body: Body, materials: Array<ShaderMaterial | null>, bodies: readonly Body[]): void {
  const frame = useFrameState();
  const sun = bodies.find((b) => b.category === 'star');
  useFrame((state) => {
    const pos = frame.bodyPositionsKm.get(body.id);
    const renderRadiusKm = frame.bodyRenderRadiusKm.get(body.id);
    if (!pos || !renderRadiusKm) return;
    const sunPos = (sun && frame.bodyPositionsKm.get(sun.id)) ?? ([0, 0, 0] as Vec3);
    const u = computeBodyFrameUniforms({
      bodyPosKm: pos,
      cameraPosKm: frame.cameraPositionKm,
      sunPosKm: sunPos,
      orientation: frame.bodyOrientation.get(body.id),
      renderRadiusKm,
      trueRadiusKm: body.shape.equatorialRadiusKm,
      sunRadiusKm: sun?.shape.equatorialRadiusKm ?? 695700,
      occluders: body.category === 'star' ? [] : pickOccluders(body.id, bodies, frame.bodyPositionsKm),
    });
    for (const m of materials) {
      if (!m) continue;
      const un = m.uniforms;
      un.uSunDirObj!.value.set(...u.sunDirObj);
      un.uCamObj!.value.set(...u.camObj);
      un.uSunDistTrue!.value = u.sunDistTrue;
      un.uSunRadiusTrue!.value = u.sunRadiusTrue;
      un.uOccluderCount!.value = u.occluders.length;
      u.occluders.forEach((o, i) => un.uOccluders!.value[i].set(o.posTrue[0], o.posTrue[1], o.posTrue[2], o.radiusTrue));
      un.uFlattening!.value = body.shape.polarRadiusKm / body.shape.equatorialRadiusKm;
      un.uTime!.value = state.clock.elapsedTime;
      un.uSimDays!.value = frame.jdTdb - J2000_JD;
    }
  }, -0.4);
}
```

In `src/scene/frameState.ts`, add `bodyRenderRadiusKm: Map<string, number>;` to `FrameState` and `bodyRenderRadiusKm: new Map(),` to `createFrameState()`. In `BodyMesh.tsx`'s `useFrame`, right after computing `radius`, add `frame.bodyRenderRadiusKm.set(body.id, radius);`.

- [ ] **Step 6: Add the shader console gate to `e2e/app.spec.ts`**

Next to `pageErrors`:
```ts
let shaderErrors: string[] = [];
```
In `beforeEach`, before `page.goto`:
```ts
  shaderErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Shader Error|THREE\.WebGLProgram/.test(msg.text())) shaderErrors.push(msg.text().slice(0, 500));
  });
```
In `afterEach`:
```ts
  expect(shaderErrors).toEqual([]);
```

- [ ] **Step 7: Run tests and the type checker**

Run: `npx vitest run src/scene`, then `npm test`, `npm run typecheck`, `npx playwright test e2e/app.spec.ts --reporter=line`
Expected: all PASS.

- [ ] **Step 8: Commit**

```powershell
git add src e2e/app.spec.ts
git commit -m "feat(scene): add shared body shader framework and per-frame object-space uniforms" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Rocky material (Mercury, Mars) and material selection in BodyMesh

**Files:**
- Create: `src/scene/materials/RockyMaterial.tsx`, `src/scene/materials/BodyMaterial.tsx`
- Modify: `src/scene/BodyMesh.tsx` (geometry 128×64; delegate the material to `BodyMaterial`; pass `bodies`), `src/scene/SceneRoot.tsx` (pass `catalog.bodies` to `BodyMesh`)

**Interfaces:**
- Consumes: `useTieredTexture` (Task 9); `createBodyMaterial`, `useBodyUniforms`, `FRAG_OUTRO` (Task 10); `Body.imagery`, `Body.render` (Task 5); `useViewStore().textureTier`.
- Produces: `RockyMaterial({ body, bodies })`; `BodyMaterial({ body, bodies })`, which switches on `body.render.shader` (`'rocky'` → `RockyMaterial`; other shaders keep the M1 `meshStandardMaterial` / `meshBasicMaterial` until Tasks 12–16 replace them). Every material component renders `<primitive object={material} attach="material" />` inside the body `<mesh>`.

- [ ] **Step 1: Create `src/scene/materials/RockyMaterial.tsx`**

```tsx
import { useMemo } from 'react';
import { Color } from 'three';
import type { Body } from '../../core/catalog/schema';
import { useViewStore } from '../../state/viewStore';
import { useTieredTexture } from '../textures/useTieredTexture';
import { FRAG_OUTRO } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { useBodyUniforms } from './useBodyUniforms';

const FRAGMENT = /* glsl */ `
uniform sampler2D uColorMap;
uniform sampler2D uNormalMap;
uniform float uHasColor;
uniform float uHasNormal;
uniform float uNormalStrength;
uniform float uLommelSeeliger;
uniform vec3 uFallbackColor;
void main() {
  vec3 s = surfacePoint(vUnit);
  vec3 n = surfaceNormal(vUnit);
  vec3 nb = uHasNormal > 0.5 ? perturbNormal(n, texture2D(uNormalMap, vUv).xyz, uNormalStrength) : n;
  vec3 v = normalize(uCamObj - s);
  float geoMu0 = dot(n, uSunDirObj);
  float mu0 = max(dot(nb, uSunDirObj), 0.0);
  float mu = max(dot(n, v), 1e-3);
  float brdf = mix(mu0 * step(0.0, geoMu0), lommelSeeliger(mu0, mu, geoMu0), uLommelSeeliger);
  vec3 albedo = uHasColor > 0.5 ? texture2D(uColorMap, vUv).rgb : uFallbackColor;
  vec3 color = albedo * brdf * uSunIntensity * eclipseFactor(s) + cinematicFill(albedo, n, v);
  gl_FragColor = vec4(color, 1.0);
  ${FRAG_OUTRO}
}`;

export function RockyMaterial({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const tier = useViewStore((s) => s.textureTier);
  const color = useTieredTexture(body.imagery?.color, { maxTier: tier, srgb: true });
  const normal = useTieredTexture(body.imagery?.normal, { maxTier: tier, srgb: false });
  const material = useMemo(
    () =>
      createBodyMaterial({
        fragment: FRAGMENT,
        uniforms: {
          uColorMap: { value: null },
          uNormalMap: { value: null },
          uHasColor: { value: 0 },
          uHasNormal: { value: 0 },
          uNormalStrength: { value: body.render.normalStrength },
          uLommelSeeliger: { value: body.render.lommelSeeliger },
          uFallbackColor: { value: new Color(body.display.color) },
        },
      }),
    [body.render.normalStrength, body.render.lommelSeeliger, body.display.color],
  );
  material.uniforms.uColorMap!.value = color;
  material.uniforms.uHasColor!.value = color ? 1 : 0;
  material.uniforms.uNormalMap!.value = normal;
  material.uniforms.uHasNormal!.value = normal ? 1 : 0;
  useBodyUniforms(body, [material], bodies);
  return <primitive object={material} attach="material" />;
}
```

(`uFallbackColor` shows the body's display colour until its map loads.)

- [ ] **Step 2: Create `src/scene/materials/BodyMaterial.tsx`**

```tsx
import { useMemo } from 'react';
import { Color } from 'three';
import type { Body } from '../../core/catalog/schema';
import { RockyMaterial } from './RockyMaterial';

/** Chooses the shader for a body from its render settings. Shaders not yet implemented fall back to M1 materials. */
export function BodyMaterial({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const starColor = useMemo(() => new Color(body.display.color).multiplyScalar(2.2), [body.display.color]);
  switch (body.render.shader) {
    case 'rocky':
      return <RockyMaterial body={body} bodies={bodies} />;
    case 'sun':
      return <meshBasicMaterial color={starColor} toneMapped={false} />;
    default:
      return <meshStandardMaterial color={body.display.color} roughness={1} metalness={0} />;
  }
}
```

- [ ] **Step 3: Update `src/scene/BodyMesh.tsx` and `SceneRoot.tsx`**

- Change the props to `{ body, bodies }: { body: Body; bodies: readonly Body[] }`.
- Use geometry `new SphereGeometry(1, 128, 64)` (still rotated with `g.rotateX(Math.PI / 2)`).
- Replace the material JSX inside `<mesh>` with `<BodyMaterial body={body} bodies={bodies} />`, and remove the now-unused `starColor` and `isStar` material code (`isStar` stays for `MIN_PIXELS`).
- In `SceneRoot`, render `<BodyMesh key={body.id} body={body} bodies={catalog.bodies} />`.

- [ ] **Step 4: Type-check, test, and review the look**

Run: `npm run typecheck`, `npm test`, then `npx playwright test e2e --reporter=line`
Expected: all PASS, with no shader errors.

Then add a temporary Mars view by running `npx playwright test e2e/golden.spec.ts` with one extra line in `VIEWS`: `{ name: '0-mars', url: '/?jd=2461317.5&pause=1&target=mars&dist=14000&azSun=60&el=15' }`. Open `test-results/golden/0-mars.png` and check:
1. Mars shows real surface colour (Syrtis Major dark, Hellas visible);
2. relief catches the light near the terminator;
3. the night side is deep blue-black, not pure black.

Keep the Mars view in `VIEWS` (it is useful from now on).

- [ ] **Step 5: Commit**

```powershell
git add src e2e/golden.spec.ts
git commit -m "feat(scene): render Mercury and Mars with official maps, relief and airless-body reflectance" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Earth material and cloud shell

**Files:**
- Create: `src/scene/materials/EarthMaterial.tsx`, `src/scene/materials/CloudShell.tsx`
- Modify: `src/scene/materials/BodyMaterial.tsx` (`'earth'` case), `src/scene/BodyMesh.tsx` (render body extras as `<mesh>` children; see Step 3)

**Interfaces:**
- Produces: `EarthMaterial({ body, bodies })`; `CloudShell({ body, bodies })`, a child `<mesh>` at 1.006× radius, with no raycast; `BodyExtras({ body, bodies })` in `BodyMaterial.tsx`, which returns the cloud shell for Earth (extended in Tasks 13–16).
- `CLOUD_DRIFT_PER_DAY = 0.0015` (u offset per simulation day; illustrative), shared by the Earth shader (cloud shadows) and the cloud shell.

- [ ] **Step 1: Create `src/scene/materials/EarthMaterial.tsx`**

```tsx
import { useMemo } from 'react';
import type { Body } from '../../core/catalog/schema';
import { useViewStore } from '../../state/viewStore';
import { useTieredTexture } from '../textures/useTieredTexture';
import { FRAG_OUTRO } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { useBodyUniforms } from './useBodyUniforms';

export const CLOUD_DRIFT_PER_DAY = 0.0015;

const FRAGMENT = /* glsl */ `
uniform sampler2D uDayMap;
uniform sampler2D uNightMap;
uniform sampler2D uCloudMap;
uniform sampler2D uOceanMask;
uniform sampler2D uNormalMap;
uniform float uReady;
uniform float uNormalStrength;
uniform float uCloudDrift;
void main() {
  vec3 s = surfacePoint(vUnit);
  vec3 n = surfaceNormal(vUnit);
  vec3 v = normalize(uCamObj - s);
  vec3 l = uSunDirObj;
  float geo = dot(n, l);
  float ocean = texture2D(uOceanMask, vUv).r;
  vec3 nb = perturbNormal(n, texture2D(uNormalMap, vUv).xyz, uNormalStrength * (1.0 - ocean));
  vec3 dayColor = texture2D(uDayMap, vUv).rgb;
  // Soft terminator; sunlight reddens at grazing angles.
  float day = smoothstep(-0.10, 0.12, geo);
  vec3 sunColor = mix(vec3(1.0, 0.42, 0.18), vec3(1.0), smoothstep(0.0, 0.35, geo));
  // Cloud shadow: sample the cloud layer offset toward the Sun.
  vec3 east = normalize(vec3(-n.y, n.x, 0.0) + vec3(1e-5, 0.0, 0.0));
  vec3 north = cross(n, east);
  vec2 drift = vec2(uSimDays * uCloudDrift, 0.0);
  float cloudHere = texture2D(uCloudMap, vUv - drift).r;
  float cloudShadow = texture2D(uCloudMap, vUv - drift + vec2(dot(l, east), dot(l, north)) * 0.0025).r;
  float shade = eclipseFactor(s);
  vec3 diffuse = dayColor * max(dot(nb, l), 0.0) * day * sunColor * (1.0 - 0.45 * cloudShadow) * uSunIntensity * shade;
  // Sun glint on water only (GGX).
  float spec = ocean * ggx(n, v, l, 0.35) * max(geo, 0.0) * 0.06 * (1.0 - cloudHere);
  // City lights on the night side, fading toward the terminator and under clouds.
  float night = 1.0 - smoothstep(-0.18, 0.06, geo);
  vec3 lights = texture2D(uNightMap, vUv).rgb * night * (1.0 - 0.7 * cloudHere) * vec3(1.0, 0.8, 0.55) * 1.4;
  vec3 color = diffuse + spec * sunColor * uSunIntensity * shade + lights + cinematicFill(dayColor, n, v);
  gl_FragColor = vec4(color, uReady);
  ${FRAG_OUTRO}
}`;

export function EarthMaterial({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const tier = useViewStore((s) => s.textureTier);
  const day = useTieredTexture(body.imagery?.color, { maxTier: tier, srgb: true });
  const night = useTieredTexture(body.imagery?.night, { maxTier: tier, srgb: true });
  const clouds = useTieredTexture(body.imagery?.clouds, { maxTier: tier, srgb: false });
  const ocean = useTieredTexture(body.imagery?.specular, { maxTier: tier, srgb: false });
  const normal = useTieredTexture(body.imagery?.normal, { maxTier: tier, srgb: false });
  const material = useMemo(
    () =>
      createBodyMaterial({
        fragment: FRAGMENT,
        uniforms: {
          uDayMap: { value: null }, uNightMap: { value: null }, uCloudMap: { value: null }, uOceanMask: { value: null }, uNormalMap: { value: null },
          uReady: { value: 1 }, uNormalStrength: { value: body.render.normalStrength }, uCloudDrift: { value: CLOUD_DRIFT_PER_DAY },
        },
      }),
    [body.render.normalStrength],
  );
  material.uniforms.uDayMap!.value = day;
  material.uniforms.uNightMap!.value = night;
  material.uniforms.uCloudMap!.value = clouds;
  material.uniforms.uOceanMask!.value = ocean;
  material.uniforms.uNormalMap!.value = normal;
  useBodyUniforms(body, [material], bodies);
  return <primitive object={material} attach="material" />;
}
```

Until all five textures exist the samplers are null; WebGL then samples black. That is acceptable for the first frame or two. Golden views wait for textures.

- [ ] **Step 2: Create `src/scene/materials/CloudShell.tsx`**

```tsx
import { useMemo } from 'react';
import { SphereGeometry } from 'three';
import type { Body } from '../../core/catalog/schema';
import { useViewStore } from '../../state/viewStore';
import { useTieredTexture } from '../textures/useTieredTexture';
import { FRAG_OUTRO } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { CLOUD_DRIFT_PER_DAY } from './EarthMaterial';
import { useBodyUniforms } from './useBodyUniforms';

const FRAGMENT = /* glsl */ `
uniform sampler2D uCloudMap;
uniform sampler2D uNightMap;
uniform float uCloudDrift;
void main() {
  vec3 s = surfacePoint(vUnit) * 1.006;
  vec3 n = surfaceNormal(vUnit);
  vec3 v = normalize(uCamObj - s);
  float geo = dot(n, uSunDirObj);
  float a = texture2D(uCloudMap, vUv - vec2(uSimDays * uCloudDrift, 0.0)).r;
  vec3 sunColor = mix(vec3(1.0, 0.5, 0.3), vec3(1.0), smoothstep(0.0, 0.3, geo));
  vec3 lit = vec3(1.0) * max(geo, 0.0) * sunColor * uSunIntensity * eclipseFactor(s);
  float night = 1.0 - smoothstep(-0.18, 0.06, geo);
  vec3 glow = texture2D(uNightMap, vUv).rgb * night * 0.25 * vec3(1.0, 0.8, 0.55);
  vec3 color = lit + glow + cinematicFill(vec3(1.0), n, v) * 0.6;
  gl_FragColor = vec4(color, a * (0.25 + 0.75 * smoothstep(-0.25, 0.1, geo)));
  ${FRAG_OUTRO}
}`;

export function CloudShell({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const tier = useViewStore((s) => s.textureTier);
  const clouds = useTieredTexture(body.imagery?.clouds, { maxTier: tier, srgb: false });
  const night = useTieredTexture(body.imagery?.night, { maxTier: tier, srgb: true });
  const geometry = useMemo(() => {
    const g = new SphereGeometry(1, 128, 64);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const material = useMemo(
    () => createBodyMaterial({ fragment: FRAGMENT, uniforms: { uCloudMap: { value: null }, uNightMap: { value: null }, uCloudDrift: { value: CLOUD_DRIFT_PER_DAY } }, transparent: true, depthWrite: false }),
    [],
  );
  material.uniforms.uCloudMap!.value = clouds;
  material.uniforms.uNightMap!.value = night;
  useBodyUniforms(body, [material], bodies);
  if (!clouds) return null;
  return <mesh geometry={geometry} material={material} scale={1.006} raycast={() => null} renderOrder={1} />;
}
```

- [ ] **Step 3: Add the `'earth'` case and extras**

In `BodyMaterial.tsx`, add `case 'earth': return <EarthMaterial body={body} bodies={bodies} />;`, and export:
```tsx
/** Child meshes that ride with the body (clouds, atmosphere, rings, corona). */
export function BodyExtras({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  return <>{body.render.shader === 'earth' && <CloudShell body={body} bodies={bodies} />}</>;
}
```
In `BodyMesh.tsx`, render `<BodyExtras body={body} bodies={bodies} />` as a child of `<mesh>` (after `<BodyMaterial …/>`), so the extras inherit the mesh's scale and orientation.

- [ ] **Step 4: Type-check, test, and review the golden Earth view**

Run: `npm run typecheck`, `npm test`, `npx playwright test e2e --reporter=line`
Expected: all PASS, no shader errors.

Open `test-results/golden/1-earth-terminator.png` and check checklist item 1: a visible twilight band, city lights only on the night side, clouds with offset shadows, and ocean glint near the sub-solar point. (The blue limb arrives in Task 13.) Tune only the constants in the shader (glint 0.06, lights 1.4, shadow 0.45); record the final values in the ledger.

- [ ] **Step 5: Commit**

```powershell
git add src
git commit -m "feat(scene): render Earth with day/night maps, city lights, ocean glint and a cloud layer with shadows" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Atmospheric scattering shell (Earth, Mars, Venus)

**Files:**
- Create: `src/scene/materials/AtmosphereShell.tsx`
- Modify: `src/scene/materials/BodyMaterial.tsx` (`BodyExtras` adds the shell when `render.atmosphere` is set)
- Test: `src/scene/materials/atmosphere.test.ts`

**Interfaces:**
- Produces:
  - `ATMOSPHERE_PRESETS: Record<'earth' | 'mars' | 'venus', AtmospherePreset>`, where `AtmospherePreset = { outer: number; wavelength: [number, number, number]; kr: number; km: number; eSun: number; g: number; scaleDepth: number; intensity: number }`;
  - `atmosphereUniforms(p: AtmospherePreset, samples: number)` (pure; returns plain values for the shader);
  - `AtmosphereShell({ body, bodies })`.
- Method: Sean O'Neil, "Accurate Atmospheric Scattering", *GPU Gems 2* ch. 16 (SkyFromSpace; the camera is always outside the shell, since it never comes closer than 1.2 radii). The Earth parameters are O'Neil's published defaults. The Mars and Venus presets are **illustrative** tints.

- [ ] **Step 1: Write the failing test `src/scene/materials/atmosphere.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { ATMOSPHERE_PRESETS, atmosphereUniforms } from './AtmosphereShell';

describe('atmosphere presets', () => {
  it('derives O’Neil constants for Earth', () => {
    const u = atmosphereUniforms(ATMOSPHERE_PRESETS.earth, 8);
    expect(u.uInvWavelength[2]).toBeCloseTo(1 / Math.pow(0.475, 4), 6);
    expect(u.uKrESun).toBeCloseTo(0.0025 * 20, 12);
    expect(u.uKr4PI).toBeCloseTo(0.0025 * 4 * Math.PI, 12);
    expect(u.uOuter).toBe(1.025);
    expect(u.uSamples).toBe(8);
  });
  it('keeps every shell outside the camera’s minimum distance (1.2 radii)', () => {
    for (const p of Object.values(ATMOSPHERE_PRESETS)) expect(p.outer).toBeLessThan(1.2);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/scene/materials/atmosphere.test.ts`
Expected: FAIL, cannot resolve `./AtmosphereShell`.

- [ ] **Step 3: Create `src/scene/materials/AtmosphereShell.tsx`**

```tsx
import { useMemo } from 'react';
import { AdditiveBlending, SphereGeometry, Vector3 } from 'three';
import type { Body } from '../../core/catalog/schema';
import { FRAG_OUTRO } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { useBodyUniforms } from './useBodyUniforms';

export interface AtmospherePreset {
  outer: number;
  wavelength: [number, number, number];
  kr: number;
  km: number;
  eSun: number;
  g: number;
  scaleDepth: number;
  intensity: number;
}

/** Earth: O'Neil's defaults. Mars and Venus: illustrative tints (a shorter "wavelength" scatters more of that colour). */
export const ATMOSPHERE_PRESETS: Record<'earth' | 'mars' | 'venus', AtmospherePreset> = {
  earth: { outer: 1.025, wavelength: [0.65, 0.57, 0.475], kr: 0.0025, km: 0.001, eSun: 20, g: -0.95, scaleDepth: 0.25, intensity: 1.0 },
  mars: { outer: 1.015, wavelength: [0.5, 0.58, 0.68], kr: 0.0015, km: 0.0035, eSun: 12, g: -0.85, scaleDepth: 0.25, intensity: 0.8 },
  venus: { outer: 1.035, wavelength: [0.55, 0.6, 0.75], kr: 0.003, km: 0.006, eSun: 18, g: -0.9, scaleDepth: 0.3, intensity: 0.9 },
};

export function atmosphereUniforms(p: AtmospherePreset, samples: number) {
  return {
    uOuter: p.outer,
    uInvWavelength: p.wavelength.map((w) => 1 / Math.pow(w, 4)) as [number, number, number],
    uKrESun: p.kr * p.eSun,
    uKmESun: p.km * p.eSun,
    uKr4PI: p.kr * 4 * Math.PI,
    uKm4PI: p.km * 4 * Math.PI,
    uScaleDepth: p.scaleDepth,
    uG: p.g,
    uIntensity: p.intensity,
    uSamples: samples,
  };
}

const FRAGMENT = /* glsl */ `
uniform float uOuter;
uniform vec3 uInvWavelength;
uniform float uKrESun;
uniform float uKmESun;
uniform float uKr4PI;
uniform float uKm4PI;
uniform float uScaleDepth;
uniform float uG;
uniform float uIntensity;
uniform int uSamples;
float scaleFn(float c) {
  float x = 1.0 - c;
  return uScaleDepth * exp(-0.00287 + x * (0.459 + x * (3.83 + x * (-6.80 + x * 5.25))));
}
vec2 raySphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
void main() {
  vec3 ro = uCamObj;
  vec3 rd = normalize(vUnit * uOuter - ro);
  vec2 tOut = raySphere(ro, rd, uOuter);
  if (tOut.y <= 0.0) discard;
  float tNear = max(tOut.x, 0.0);
  float tFar = tOut.y;
  vec2 tIn = raySphere(ro, rd, 1.0);
  if (tIn.x > 0.0) tFar = min(tFar, tIn.x);
  float fScale = 1.0 / (uOuter - 1.0);
  float scaleOverDepth = fScale / uScaleDepth;
  vec3 start = ro + rd * tNear;
  float startOffset = exp(-1.0 / uScaleDepth) * scaleFn(dot(rd, start) / uOuter);
  float segLen = (tFar - tNear) / float(uSamples);
  vec3 front = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uSamples) break;
    vec3 sp = start + rd * segLen * (float(i) + 0.5);
    float h = length(sp);
    float depth = exp(scaleOverDepth * (1.0 - h));
    float scatter = startOffset + depth * (scaleFn(dot(uSunDirObj, sp) / h) - scaleFn(dot(rd, sp) / h));
    vec3 att = exp(-scatter * (uInvWavelength * uKr4PI + uKm4PI));
    front += att * depth * segLen * fScale;
  }
  float cosA = dot(uSunDirObj, -rd);
  float g2 = uG * uG;
  float rayleighPhase = 0.75 * (1.0 + cosA * cosA);
  float miePhase = 1.5 * ((1.0 - g2) / (2.0 + g2)) * (1.0 + cosA * cosA) / pow(1.0 + g2 - 2.0 * uG * cosA, 1.5);
  vec3 color = (rayleighPhase * front * uInvWavelength * uKrESun + miePhase * front * uKmESun) * uIntensity * uSunIntensity;
  gl_FragColor = vec4(color, 1.0);
  ${FRAG_OUTRO}
}`;

export function AtmosphereShell({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const preset = ATMOSPHERE_PRESETS[body.render.atmosphere!];
  const geometry = useMemo(() => {
    const g = new SphereGeometry(1, 96, 48);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const material = useMemo(() => {
    const u = atmosphereUniforms(preset, 8);
    return createBodyMaterial({
      fragment: FRAGMENT,
      uniforms: {
        uOuter: { value: u.uOuter }, uInvWavelength: { value: new Vector3(...u.uInvWavelength) }, uKrESun: { value: u.uKrESun }, uKmESun: { value: u.uKmESun },
        uKr4PI: { value: u.uKr4PI }, uKm4PI: { value: u.uKm4PI }, uScaleDepth: { value: u.uScaleDepth }, uG: { value: u.uG }, uIntensity: { value: u.uIntensity }, uSamples: { value: u.uSamples },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
  }, [preset]);
  useBodyUniforms(body, [material], bodies);
  return <mesh geometry={geometry} material={material} scale={preset.outer} raycast={() => null} renderOrder={2} />;
}
```

- [ ] **Step 4: Add the shell to `BodyExtras`**

```tsx
      {body.render.atmosphere && <AtmosphereShell body={body} bodies={bodies} />}
```

- [ ] **Step 5: Run tests, and review Earth and Mars**

Run: `npx vitest run src/scene/materials`, `npm run typecheck`, `npx playwright test e2e --reporter=line`
Expected: all PASS, no shader errors.

Open `1-earth-terminator.png` and `0-mars.png`:
- Earth now has a thin blue limb that turns orange-red along the terminator;
- Mars has a faint butterscotch limb;
- neither disc is washed out: the surface stays readable through the haze.

If the haze overwhelms the surface, lower `intensity` in the preset, not the O'Neil constants. Record the final value in the ledger.

- [ ] **Step 6: Commit**

```powershell
git add src
git commit -m "feat(scene): add physically based atmospheric scattering shells for Earth, Mars and Venus" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Gas-giant material (OPAL maps, limb darkening, haze, ring shadows)

**Files:**
- Create: `src/scene/materials/rings.ts`, `src/scene/materials/GiantMaterial.tsx`
- Modify: `src/scene/materials/BodyMaterial.tsx` (`'giant'` case)
- Test: `src/scene/materials/rings.test.ts`

**Interfaces:**
- Consumes: `rayPlaneRadius` (Task 8); `Body.imagery.rings` (Task 5); `useTieredTexture` (Task 9); `createBodyMaterial`, `useBodyUniforms`, `FRAG_OUTRO` (Task 10).
- Produces (`rings.ts`):
  - `ringRadii(body: Body): { inner: number; outer: number } | null` (ring radii in equatorial radii, the object-space unit);
  - `ringShadowCoord(point: Vec3, sunDir: Vec3, inner: number, outer: number): number | null` (ring-profile coordinate 0–1 where the ray from a surface point toward the Sun crosses the ring plane; null when it misses);
  - `ringFaceLighting(sunDirObj: Vec3, camDirObj: Vec3): { litFace: boolean; mu0: number; mu: number }` (used in Task 15).
- Produces: `GiantMaterial({ body, bodies })`. The ring-profile texture is sampled with the coordinate clamped to `[0.0005, 0.9995]`, because `useTieredTexture` sets `RepeatWrapping` and the inner and outer edges must not blend.
- Band motion: when `render.bandFlow` is true, a small noise warp of the texture coordinates, animated in **real** seconds (`uTime`), not simulation days. It is bounded, so the bands never smear, and it does not flicker at high time rates. It is labelled illustrative (Task 18).

- [ ] **Step 1: Write the failing test `src/scene/materials/rings.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import type { Body } from '../../core/catalog/schema';
import { normalize, type Vec3 } from '../../core/math/vec3';
import { rayHitsEllipsoid } from '../../core/shadows/eclipse';
import { makeJupiter } from '../../test/fixtures';
import { ringFaceLighting, ringRadii, ringShadowCoord } from './rings';

const DEG = Math.PI / 180;
const jupiter = makeJupiter();
const saturn: Body = {
  ...jupiter,
  id: 'saturn',
  shape: { ...jupiter.shape, equatorialRadiusKm: 60268, polarRadiusKm: 54364 },
  imagery: {
    rings: {
      texture: { tiers: { '2k': 'textures/saturn/rings_2k.webp' }, sourceId: 'nssdca-saturn-rings', illustrative: true },
      innerKm: { value: 74658, sourceId: 'nssdca-saturn-rings' },
      outerKm: { value: 139851, sourceId: 'nssdca-saturn-rings' },
    },
  },
};

describe('ring helpers', () => {
  it('expresses ring radii in equatorial radii', () => {
    expect(ringRadii(saturn)!.inner).toBeCloseTo(74658 / 60268, 12);
    expect(ringRadii(saturn)!.outer).toBeCloseTo(139851 / 60268, 12);
    expect(ringRadii(jupiter)).toBeNull();
  });

  it('casts the ring shadow on the winter hemisphere only', () => {
    const { inner, outer } = ringRadii(saturn)!;
    const sun = normalize([1, 0, 0.3]);
    const south: Vec3 = [Math.cos(-20 * DEG), 0, Math.sin(-20 * DEG)];
    // The ray climbs 0.3 per unit of x, so it meets z = 0 at x = cos 20° + sin 20° / 0.3.
    const r = Math.cos(20 * DEG) + Math.sin(20 * DEG) / 0.3;
    expect(ringShadowCoord(south, sun, inner, outer)).toBeCloseTo((r - inner) / (outer - inner), 9);
    const north: Vec3 = [Math.cos(20 * DEG), 0, Math.sin(20 * DEG)];
    expect(ringShadowCoord(north, sun, inner, outer)).toBeNull();
  });

  it('tells the lit face from the unlit face', () => {
    expect(ringFaceLighting(normalize([1, 0, 0.2]), normalize([0, 1, 0.5])).litFace).toBe(true);
    const under = ringFaceLighting(normalize([1, 0, 0.2]), normalize([0, 1, -0.5]));
    expect(under.litFace).toBe(false);
    expect(under.mu).toBeCloseTo(0.5 / Math.hypot(1, 0.5), 12);
  });

  it('puts ring particles behind the planet in its shadow (convention used by the ring shader)', () => {
    const sun = normalize([1, 0, 0.05]);
    expect(rayHitsEllipsoid([-1.6, 0, 0], sun, 54364 / 60268)).toBe(true);
    expect(rayHitsEllipsoid([1.6, 0, 0], sun, 54364 / 60268)).toBe(false);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/scene/materials/rings.test.ts`
Expected: FAIL, cannot resolve `./rings`.

- [ ] **Step 3: Create `src/scene/materials/rings.ts`**

```ts
import type { Body } from '../../core/catalog/schema';
import type { Vec3 } from '../../core/math/vec3';
import { rayPlaneRadius } from '../../core/shadows/eclipse';

/** Ring radii in units of the planet's equatorial radius (the object-space unit of the body mesh). */
export function ringRadii(body: Body): { inner: number; outer: number } | null {
  const rings = body.imagery?.rings;
  if (!rings) return null;
  return { inner: rings.innerKm.value / body.shape.equatorialRadiusKm, outer: rings.outerKm.value / body.shape.equatorialRadiusKm };
}

/** Ring-profile coordinate (0 inner edge, 1 outer edge) where sunlight reaching `point` crossed the ring plane. */
export function ringShadowCoord(point: Vec3, sunDir: Vec3, inner: number, outer: number): number | null {
  const r = rayPlaneRadius(point, sunDir);
  if (r === null || r < inner || r > outer) return null;
  return (r - inner) / (outer - inner);
}

/** The camera sees the lit face when it is on the same side of the ring plane as the Sun. */
export function ringFaceLighting(sunDirObj: Vec3, camDirObj: Vec3): { litFace: boolean; mu0: number; mu: number } {
  return { litFace: sunDirObj[2] * camDirObj[2] >= 0, mu0: Math.abs(sunDirObj[2]), mu: Math.abs(camDirObj[2]) };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/scene/materials/rings.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Create `src/scene/materials/GiantMaterial.tsx`**

```tsx
import { useMemo } from 'react';
import { Color, Vector2 } from 'three';
import type { Body } from '../../core/catalog/schema';
import { useViewStore } from '../../state/viewStore';
import { useTieredTexture } from '../textures/useTieredTexture';
import { FRAG_OUTRO } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { ringRadii } from './rings';
import { useBodyUniforms } from './useBodyUniforms';

const FRAGMENT = /* glsl */ `
uniform sampler2D uColorMap;
uniform float uHasColor;
uniform vec3 uFallbackColor;
uniform sampler2D uRingMap;
uniform float uHasRings;
uniform vec2 uRingRadii;
uniform float uBandFlow;
uniform vec3 uHazeColor;
/** Sunlight let through the rings on the way to point p (1 = no ring in the way). */
float ringTransmission(vec3 p) {
  if (uHasRings < 0.5 || abs(uSunDirObj.z) < 1e-4) return 1.0;
  float t = -p.z / uSunDirObj.z;
  if (t <= 0.0) return 1.0;
  float r = length(p.xy + uSunDirObj.xy * t);
  if (r < uRingRadii.x || r > uRingRadii.y) return 1.0;
  float x = clamp((r - uRingRadii.x) / (uRingRadii.y - uRingRadii.x), 0.0005, 0.9995);
  return 1.0 - 0.9 * texture2D(uRingMap, vec2(x, 0.5)).a;
}
void main() {
  vec3 s = surfacePoint(vUnit);
  vec3 n = surfaceNormal(vUnit);
  vec3 v = normalize(uCamObj - s);
  vec2 uv = vUv;
  if (uBandFlow > 0.5) {
    uv.x += 0.0015 * fbm(vec3(vUnit.xy * 6.0, vUnit.z * 24.0) + vec3(0.0, 0.0, uTime * 0.01));
    uv.y += 0.0004 * snoise(vUnit * 12.0 + vec3(uTime * 0.02));
  }
  vec3 albedo = uHasColor > 0.5 ? texture2D(uColorMap, uv).rgb : uFallbackColor;
  float mu0 = max(dot(n, uSunDirObj), 0.0);
  float mu = max(dot(n, v), 0.05);
  // Minnaert limb darkening (k = 0.85), illustrative.
  float diffuse = pow(mu0, 0.85) * pow(mu, -0.15);
  float light = diffuse * uSunIntensity * eclipseFactor(s) * ringTransmission(s);
  // Thin high haze brightening the sunlit limb.
  vec3 haze = uHazeColor * pow(1.0 - mu, 3.0) * smoothstep(-0.1, 0.3, dot(n, uSunDirObj)) * 0.35;
  vec3 color = albedo * light + haze * uSunIntensity + cinematicFill(albedo, n, v);
  gl_FragColor = vec4(color, 1.0);
  ${FRAG_OUTRO}
}`;

export function GiantMaterial({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const tier = useViewStore((s) => s.textureTier);
  const color = useTieredTexture(body.imagery?.color, { maxTier: tier, srgb: true });
  const rings = useTieredTexture(body.imagery?.rings?.texture, { maxTier: '2k', srgb: true });
  const radii = ringRadii(body);
  const material = useMemo(
    () =>
      createBodyMaterial({
        fragment: FRAGMENT,
        uniforms: {
          uColorMap: { value: null },
          uHasColor: { value: 0 },
          uFallbackColor: { value: new Color(body.display.color) },
          uRingMap: { value: null },
          uHasRings: { value: 0 },
          uRingRadii: { value: new Vector2(radii?.inner ?? 0, radii?.outer ?? 0) },
          uBandFlow: { value: body.render.bandFlow ? 1 : 0 },
          uHazeColor: { value: new Color(body.display.color).lerp(new Color('#9fc4ff'), 0.5) },
        },
      }),
    [body.display.color, body.render.bandFlow, radii?.inner, radii?.outer],
  );
  material.uniforms.uColorMap!.value = color;
  material.uniforms.uHasColor!.value = color ? 1 : 0;
  material.uniforms.uRingMap!.value = rings;
  material.uniforms.uHasRings!.value = rings && radii ? 1 : 0;
  useBodyUniforms(body, [material], bodies);
  return <primitive object={material} attach="material" />;
}
```

- [ ] **Step 6: Add the `'giant'` case to `BodyMaterial`**

```tsx
    case 'giant':
      return <GiantMaterial body={body} bodies={bodies} />;
```

- [ ] **Step 7: Type-check, test, and review the giants**

Run: `npm run typecheck`, `npm test`, `npx playwright test e2e --reporter=line`
Expected: all PASS, no shader errors.

Open `test-results/golden/5-phone.png` (Jupiter) and `2-saturn-rings.png`:
- Jupiter shows the OPAL bands and the Great Red Spot, darkening toward the limb;
- Saturn's southern hemisphere shows the dark ring-shadow bands (the rings are not drawn yet; they arrive in Task 15);
- nothing looks smeared or noisy at rest.

- [ ] **Step 8: Commit**

```powershell
git add src
git commit -m "feat(scene): render the gas giants from Hubble OPAL maps with limb darkening, haze and ring shadows" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Rings for Saturn and Uranus

**Files:**
- Create: `src/scene/materials/Rings.tsx`
- Modify: `src/scene/materials/BodyMaterial.tsx` (`BodyExtras` adds rings when `ringRadii(body)` is not null)

**Interfaces:**
- Consumes: `ringRadii`, `ringFaceLighting` convention (Task 14); `rayHitsEllipsoid` GLSL from `ECLIPSE` (Task 10); `vPlane` from `BODY_VERTEX` (Task 10).
- Produces: `Rings({ body, bodies })`, a child mesh of the body mesh, made of a `RingGeometry(inner, outer, 256, 1)` in the object-space plane z = 0. The mesh's non-uniform scale (x and y equatorial, z polar) leaves that plane unchanged. Ring rendering:
  - double-sided; alpha from the NSSDCA optical depth;
  - the lit face uses Lommel–Seeliger reflection, and the unlit face shows diffuse transmission (brightest at medium optical depth);
  - the planet's shadow falls on the rings;
  - forward scattering when backlit (illustrative strength);
  - no raycast, so clicks pass through to the planet.

- [ ] **Step 1: Create `src/scene/materials/Rings.tsx`**

```tsx
import { useMemo } from 'react';
import { DoubleSide, RingGeometry, Vector2 } from 'three';
import type { Body } from '../../core/catalog/schema';
import { useTieredTexture } from '../textures/useTieredTexture';
import { FRAG_OUTRO } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { ringRadii } from './rings';
import { useBodyUniforms } from './useBodyUniforms';

const FRAGMENT = /* glsl */ `
uniform sampler2D uRingMap;
uniform vec2 uRingRadii;
void main() {
  float r = length(vPlane);
  float x = (r - uRingRadii.x) / (uRingRadii.y - uRingRadii.x);
  if (x < 0.0 || x > 1.0) discard;
  vec4 ring = texture2D(uRingMap, vec2(clamp(x, 0.0005, 0.9995), 0.5));
  if (ring.a < 0.004) discard;
  vec3 p = vec3(vPlane, 0.0);
  vec3 v = normalize(uCamObj - p);
  float mu0 = abs(uSunDirObj.z);
  float mu = max(abs(v.z), 1e-3);
  bool litFace = uSunDirObj.z * v.z >= 0.0;
  // Lit face: Lommel–Seeliger. Unlit face: light diffusing through the layer, peaking at medium optical depth.
  float reflected = 2.0 * mu0 / (mu0 + mu);
  float transmitted = 4.0 * ring.a * (1.0 - ring.a) * mu0 / (mu0 + mu);
  float brightness = litFace ? reflected : transmitted;
  // Forward scattering by fine dust when looking toward the Sun through the rings (illustrative strength).
  float forward = pow(max(dot(-uSunDirObj, v), 0.0), 12.0) * (1.0 - ring.a) * 1.5;
  float shadow = rayHitsEllipsoid(p, uSunDirObj, uFlattening) ? 0.0 : 1.0;
  vec3 color = ring.rgb * (brightness + forward) * shadow * uSunIntensity + ring.rgb * 0.01 * uFill;
  gl_FragColor = vec4(color, ring.a);
  ${FRAG_OUTRO}
}`;

export function Rings({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const radii = ringRadii(body)!;
  const texture = useTieredTexture(body.imagery?.rings?.texture, { maxTier: '2k', srgb: true });
  const geometry = useMemo(() => new RingGeometry(radii.inner, radii.outer, 256, 1), [radii.inner, radii.outer]);
  const material = useMemo(
    () =>
      createBodyMaterial({
        fragment: FRAGMENT,
        uniforms: { uRingMap: { value: null }, uRingRadii: { value: new Vector2(radii.inner, radii.outer) } },
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
      }),
    [radii.inner, radii.outer],
  );
  material.uniforms.uRingMap!.value = texture;
  useBodyUniforms(body, [material], bodies);
  if (!texture) return null;
  return <mesh geometry={geometry} material={material} raycast={() => null} renderOrder={3} />;
}
```

- [ ] **Step 2: Add rings to `BodyExtras`**

```tsx
      {ringRadii(body) && <Rings body={body} bodies={bodies} />}
```
(Import `ringRadii` from `./rings` and `Rings` from `./Rings`.)

- [ ] **Step 3: Type-check, test, and review Saturn**

Run: `npm run typecheck`, `npm test`, `npx playwright test e2e --reporter=line`
Expected: all PASS, no shader errors.

Open `test-results/golden/2-saturn-rings.png` and check checklist item 2:
1. the ring shadow on the globe and the globe's shadow on the rings are both visible;
2. the Cassini Division is a clear dark gap;
3. the rings are translucent (the globe shows through the C ring);
4. Uranus (add a temporary view `/?jd=2461317.5&pause=1&target=uranus&dist=150000&azSun=40&el=10`) shows thin, dark, nearly invisible rings, which is correct.

Remove the temporary Uranus view after checking.

- [ ] **Step 4: Commit**

```powershell
git add src
git commit -m "feat(scene): add Saturn and Uranus rings from NSSDCA ring tables with planet shadow and lit/unlit faces" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Venus cloud deck, Sun surface and corona (illustrative)

**Files:**
- Create: `src/scene/materials/illustrative.ts`, `src/scene/materials/VenusMaterial.tsx`, `src/scene/materials/SunMaterial.tsx`, `src/scene/materials/CoronaGlow.tsx`
- Modify: `src/scene/materials/BodyMaterial.tsx` (`'venus'` and `'sun'` cases; `BodyExtras` adds the corona for the Sun; the M1 fallback materials are removed, since every shader now has a material)
- Test: `src/scene/materials/illustrative.test.ts`

**Interfaces:**
- Produces (`illustrative.ts`):
  - `LIMB_DARKENING_U = 0.6`;
  - `VENUS_CLOUD_PERIOD_DAYS = 4` (the cloud tops circle Venus in about four Earth days, NASA Science Venus page; the visual itself is illustrative);
  - `CORONA_SCALE = 4` (shell radius in solar radii);
  - `limbDarkening(mu: number, u?: number): number`;
  - `venusCloudAngle(jdTdb: number): number` (radians in [0, 2π), computed in float64 on the CPU);
  - `coronaProfile(b: number): number` (glow at closest-approach distance `b` in solar radii; 0 inside the disc).
- Produces: `VenusMaterial`, `SunMaterial`, `CoronaGlow`, each `({ body, bodies })`. The GLSL uses the same constants, interpolated from `illustrative.ts`.

- [ ] **Step 1: Write the failing test `src/scene/materials/illustrative.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { J2000_JD } from '../../core/units';
import { coronaProfile, LIMB_DARKENING_U, limbDarkening, venusCloudAngle } from './illustrative';

describe('illustrative profiles', () => {
  it('darkens the solar limb linearly', () => {
    expect(limbDarkening(1)).toBe(1);
    expect(limbDarkening(0)).toBeCloseTo(1 - LIMB_DARKENING_U, 12);
    expect(limbDarkening(-0.5)).toBeCloseTo(1 - LIMB_DARKENING_U, 12);
  });
  it('turns the Venus cloud deck once every four days, staying precise far from J2000', () => {
    expect(venusCloudAngle(J2000_JD)).toBeCloseTo(0, 12);
    expect(venusCloudAngle(J2000_JD + 1)).toBeCloseTo(Math.PI / 2, 12);
    expect(venusCloudAngle(J2000_JD + 4 * 25_000 + 2)).toBeCloseTo(Math.PI, 9);
    expect(venusCloudAngle(J2000_JD - 1)).toBeCloseTo(1.5 * Math.PI, 12);
  });
  it('fades the corona outward and hides it behind the disc', () => {
    expect(coronaProfile(0.5)).toBe(0);
    expect(coronaProfile(1)).toBeGreaterThan(coronaProfile(1.5));
    expect(coronaProfile(1.5)).toBeGreaterThan(coronaProfile(3));
    expect(coronaProfile(3)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/scene/materials/illustrative.test.ts`
Expected: FAIL, cannot resolve `./illustrative`.

- [ ] **Step 3: Create `src/scene/materials/illustrative.ts`**

```ts
import { J2000_JD } from '../../core/units';

/** Illustrative visual constants. The UI labels these visuals illustrative; no data is derived from them. */
export const LIMB_DARKENING_U = 0.6;
/** The cloud tops circle Venus in about four Earth days (NASA Science, Venus). */
export const VENUS_CLOUD_PERIOD_DAYS = 4;
export const CORONA_SCALE = 4;

export function limbDarkening(mu: number, u = LIMB_DARKENING_U): number {
  return 1 - u * (1 - Math.min(1, Math.max(0, mu)));
}

/** Cloud-deck rotation angle relative to the surface, in [0, 2π). Float64 here so the shader gets a small, precise angle. */
export function venusCloudAngle(jdTdb: number): number {
  const turns = (jdTdb - J2000_JD) / VENUS_CLOUD_PERIOD_DAYS;
  return (turns - Math.floor(turns)) * 2 * Math.PI;
}

export function coronaProfile(b: number): number {
  if (b < 1) return 0;
  return 0.6 * Math.exp(-3 * (b - 1)) + 0.12 / (b * b);
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/scene/materials/illustrative.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Create `src/scene/materials/VenusMaterial.tsx`**

The noise sample point is rotated by `+uCloudAngle` about the pole, so the pattern drifts toward decreasing east longitude (westward, the direction of Venus's rotation and of its super-rotating clouds).

```tsx
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import type { Body } from '../../core/catalog/schema';
import { useFrameState } from '../FrameStateContext';
import { FRAG_OUTRO } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { venusCloudAngle } from './illustrative';
import { useBodyUniforms } from './useBodyUniforms';

const FRAGMENT = /* glsl */ `
uniform float uCloudAngle;
void main() {
  vec3 s = surfacePoint(vUnit);
  vec3 n = surfaceNormal(vUnit);
  vec3 v = normalize(uCamObj - s);
  float c = cos(uCloudAngle);
  float sn = sin(uCloudAngle);
  vec3 q = vec3(c * vUnit.x - sn * vUnit.y, sn * vUnit.x + c * vUnit.y, vUnit.z);
  // Latitude-stretched noise gives zonal bands; a second octave adds the dark UV-absorber streaks.
  float bands = fbm(vec3(q.xy * 2.0, q.z * 9.0));
  float streaks = smoothstep(0.15, 0.6, fbm(vec3(q.xy * 4.0, q.z * 14.0) + 7.3));
  vec3 albedo = mix(vec3(0.86, 0.77, 0.58), vec3(0.98, 0.94, 0.83), 0.5 + 0.5 * bands) * (1.0 - 0.12 * streaks);
  float geo = dot(n, uSunDirObj);
  float diffuse = smoothstep(-0.06, 0.25, geo) * max(geo, 0.0) * pow(max(dot(n, v), 0.05), -0.1);
  vec3 color = albedo * diffuse * uSunIntensity * eclipseFactor(s) + cinematicFill(albedo, n, v);
  gl_FragColor = vec4(color, 1.0);
  ${FRAG_OUTRO}
}`;

export function VenusMaterial({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const frame = useFrameState();
  const material = useMemo(() => createBodyMaterial({ fragment: FRAGMENT, uniforms: { uCloudAngle: { value: 0 } } }), []);
  useBodyUniforms(body, [material], bodies);
  useFrame(() => {
    material.uniforms.uCloudAngle!.value = venusCloudAngle(frame.jdTdb);
  }, -0.4);
  return <primitive object={material} attach="material" />;
}
```

- [ ] **Step 6: Create `src/scene/materials/SunMaterial.tsx`**

```tsx
import { useMemo } from 'react';
import { Color } from 'three';
import type { Body } from '../../core/catalog/schema';
import { FRAG_OUTRO_NO_TONEMAP } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { LIMB_DARKENING_U } from './illustrative';
import { useBodyUniforms } from './useBodyUniforms';

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
void main() {
  vec3 s = surfacePoint(vUnit);
  vec3 n = surfaceNormal(vUnit);
  float mu = max(dot(n, normalize(uCamObj - s)), 0.0);
  float limb = 1.0 - ${LIMB_DARKENING_U.toFixed(3)} * (1.0 - mu);
  // Granulation: fine cells drifting slowly in real time; supergranulation as a broad, faint modulation.
  float cells = snoise(vUnit * 140.0 + vec3(0.0, 0.0, uTime * 0.05));
  float broad = fbm(vUnit * 9.0 + vec3(uTime * 0.004));
  float grain = 1.0 + 0.07 * cells + 0.05 * broad;
  vec3 color = uColor * limb * grain * mix(vec3(1.0, 0.72, 0.45), vec3(1.0), mu);
  gl_FragColor = vec4(color, 1.0);
  ${FRAG_OUTRO_NO_TONEMAP}
}`;

export function SunMaterial({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const material = useMemo(
    () => createBodyMaterial({ fragment: FRAGMENT, uniforms: { uColor: { value: new Color(body.display.color).multiplyScalar(2.2) } }, toneMapped: false }),
    [body.display.color],
  );
  useBodyUniforms(body, [material], bodies);
  return <primitive object={material} attach="material" />;
}
```

- [ ] **Step 7: Create `src/scene/materials/CoronaGlow.tsx`**

The corona is a back-faced shell, so rays that pass through the Sun hit its far side behind the disc and the depth test hides them. It also still renders when the camera is inside the shell.

```tsx
import { useMemo } from 'react';
import { AdditiveBlending, BackSide, Color, SphereGeometry } from 'three';
import type { Body } from '../../core/catalog/schema';
import { FRAG_OUTRO_NO_TONEMAP } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { CORONA_SCALE } from './illustrative';
import { useBodyUniforms } from './useBodyUniforms';

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
void main() {
  vec3 ro = uCamObj;
  vec3 rd = normalize(vUnit * ${CORONA_SCALE.toFixed(1)} - ro);
  float b = length(ro - rd * dot(ro, rd));
  if (b < 1.0) discard;
  float glow = 0.6 * exp(-3.0 * (b - 1.0)) + 0.12 / (b * b);
  gl_FragColor = vec4(uColor * glow, 1.0);
  ${FRAG_OUTRO_NO_TONEMAP}
}`;

export function CoronaGlow({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const geometry = useMemo(() => new SphereGeometry(1, 64, 32), []);
  const material = useMemo(
    () =>
      createBodyMaterial({
        fragment: FRAGMENT,
        uniforms: { uColor: { value: new Color(body.display.color).multiplyScalar(1.6) } },
        transparent: true,
        blending: AdditiveBlending,
        side: BackSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [body.display.color],
  );
  useBodyUniforms(body, [material], bodies);
  return <mesh geometry={geometry} material={material} scale={CORONA_SCALE} raycast={() => null} renderOrder={2} />;
}
```

- [ ] **Step 8: Finish `BodyMaterial.tsx`**

The switch becomes exhaustive, and the M1 fallback materials and `starColor` are removed:
```tsx
export function BodyMaterial({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  switch (body.render.shader) {
    case 'rocky':
      return <RockyMaterial body={body} bodies={bodies} />;
    case 'earth':
      return <EarthMaterial body={body} bodies={bodies} />;
    case 'giant':
      return <GiantMaterial body={body} bodies={bodies} />;
    case 'venus':
      return <VenusMaterial body={body} bodies={bodies} />;
    case 'sun':
      return <SunMaterial body={body} bodies={bodies} />;
  }
}

/** Child meshes that ride with the body (clouds, atmosphere, rings, corona). */
export function BodyExtras({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  return (
    <>
      {body.render.shader === 'earth' && <CloudShell body={body} bodies={bodies} />}
      {body.render.atmosphere && <AtmosphereShell body={body} bodies={bodies} />}
      {ringRadii(body) && <Rings body={body} bodies={bodies} />}
      {body.render.shader === 'sun' && <CoronaGlow body={body} bodies={bodies} />}
    </>
  );
}
```
Remove the now-unused `useMemo` and `Color` imports. In `SceneRoot`, remove `<ambientLight>` and `<SunLight>`: no remaining material uses three's lights, because every body shader lights itself from `uSunDirObj`. Delete `src/scene/SunLight.tsx`, and its test if it has one.

- [ ] **Step 9: Type-check, test, and review**

Run: `npm run typecheck`, `npm test`, `npx playwright test e2e --reporter=line`
Expected: all PASS, no shader errors. TypeScript accepts the switch without a `default`, because it covers every `render.shader` value.

Open `3-sun.png` and check checklist item 3 as far as M2a.1 goes (flares and god rays are M2a.2):
- granulation visible on the disc;
- the limb darker and warmer than the centre;
- a soft corona halo, with bloom around it.

Add a temporary Venus view (`/?jd=2461317.5&pause=1&target=venus&dist=30000&azSun=60&el=10`) and check for a creamy banded deck with a soft terminator and a thin haze limb. Remove the view after checking.

- [ ] **Step 10: Commit**

```powershell
git add -A src
git commit -m "feat(scene): add illustrative Venus cloud deck, animated Sun surface and corona; retire M1 lights" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Star-sky background with credit

**Files:**
- Create: `src/scene/sky/skyMath.ts`, `src/scene/sky/SkyBackground.tsx`, `src/state/skyStore.ts`, `src/ui/SkyCredit.tsx`
- Modify: `src/scene/SceneRoot.tsx` (mount `SkyBackground`, start loading the sky), `src/App.tsx` (render `SkyCredit`), `src/styles/app.css` (`.sky-credit`)
- Test: `src/scene/sky/skyMath.test.ts`, `src/state/skyStore.test.ts`

**Interfaces:**
- Consumes: `eclipticToEquatorial`, `equatorialToEcliptic` (M1 `src/core/frames/rotation.ts`); `ImageryFileSchema`, `TextureRef`, `Tier` (Task 5); `useTieredTexture` with `mipmaps: false` (Task 9); `public/textures/imagery.json`, whose `bodies.sky.color` is written by Task 6.
- Produces (`skyMath.ts`):
  - `eclipticDirToSkyUv(dir: Vec3): [number, number]` (texture u, v with v = 1 at the top, as three's `flipY` loads it; u = 0.5 − RA/2π wrapped to [0, 1), v = 0.5 + Dec/π);
  - `eclipticToEquatorialColumns(): [Vec3, Vec3, Vec3]` (matrix columns for the shader, built from the tested core rotation, so there is no hand-written obliquity matrix);
  - `skyTier(textureTier: Tier): Tier` (`'8k'` stays `'8k'`; anything else becomes `'4k'`, which is committed).
- Produces (`skyStore.ts`): `useSkyStore` with `{ ref: TextureRef | null; status: 'idle' | 'loading' | 'ready' | 'missing'; load(fetchJson?: (url: string) => Promise<unknown>): Promise<void> }`. It never throws; a missing or invalid file means `status: 'missing'` and the plain background stays.
- `SKY_EXPOSURE = 0.55` (the star map is dimmed so it never competes with the bodies or triggers bloom).

- [ ] **Step 1: Write the failing tests**

`src/scene/sky/skyMath.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { eclipticToEquatorial, equatorialToEcliptic } from '../../core/frames/rotation';
import { eclipticDirToSkyUv, eclipticToEquatorialColumns, skyTier } from './skyMath';

const DEG = Math.PI / 180;
const fromRaDec = (raDeg: number, decDeg: number) =>
  equatorialToEcliptic([Math.cos(decDeg * DEG) * Math.cos(raDeg * DEG), Math.cos(decDeg * DEG) * Math.sin(raDeg * DEG), Math.sin(decDeg * DEG)]);

describe('sky mapping', () => {
  it('puts Vega at its texel (RA increases to the left, RA 0h in the centre column)', () => {
    const [u, v] = eclipticDirToSkyUv(fromRaDec(279.2347, 38.7837));
    expect(u).toBeCloseTo(1.5 - 279.2347 / 360, 9);
    expect(v).toBeCloseTo(0.5 + 38.7837 / 180, 9);
  });
  it('puts RA 0h, Dec 0 in the centre and the north celestial pole at the top', () => {
    const [u, v] = eclipticDirToSkyUv(fromRaDec(0, 0));
    expect(u).toBeCloseTo(0.5, 9);
    expect(v).toBeCloseTo(0.5, 9);
    expect(eclipticDirToSkyUv(fromRaDec(0, 90))[1]).toBeCloseTo(1, 9);
  });
  it('gives the shader the same rotation as the core frames', () => {
    const [c0, c1, c2] = eclipticToEquatorialColumns();
    const v = [0.3, -0.5, 0.81] as const;
    const expected = eclipticToEquatorial([...v]);
    for (let i = 0; i < 3; i++) expect(c0[i]! * v[0] + c1[i]! * v[1] + c2[i]! * v[2]).toBeCloseTo(expected[i]!, 12);
  });
  it('uses the committed 4k sky unless 8k is asked for', () => {
    expect(skyTier('1k')).toBe('4k');
    expect(skyTier('2k')).toBe('4k');
    expect(skyTier('8k')).toBe('8k');
  });
});
```

`src/state/skyStore.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useSkyStore } from './skyStore';

const valid = {
  schemaVersion: 1,
  generatedAt: '2026-10-04T12:00:00.000Z',
  sources: [],
  bodies: { sky: { color: { tiers: { '2k': 'textures/sky/color_2k.webp', '4k': 'textures/sky/color_4k.webp' }, sourceId: 'nasa-svs-deep-star-maps' } } },
};

describe('skyStore', () => {
  beforeEach(() => useSkyStore.setState({ ref: null, status: 'idle' }));
  it('loads the sky texture reference from imagery.json', async () => {
    await useSkyStore.getState().load(async () => valid);
    expect(useSkyStore.getState()).toMatchObject({ status: 'ready', ref: { sourceId: 'nasa-svs-deep-star-maps' } });
  });
  it('falls back quietly when the file is missing or invalid', async () => {
    await useSkyStore.getState().load(async () => {
      throw new Error('404');
    });
    expect(useSkyStore.getState()).toMatchObject({ status: 'missing', ref: null });
    await useSkyStore.getState().load(async () => ({ schemaVersion: 2 }));
    expect(useSkyStore.getState().status).toBe('missing');
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/scene/sky src/state/skyStore.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Create `src/scene/sky/skyMath.ts`**

```ts
import type { Tier } from '../../core/catalog/schema';
import { eclipticToEquatorial } from '../../core/frames/rotation';
import type { Vec3 } from '../../core/math/vec3';

/** Star-map texture coordinate for a direction in the ecliptic J2000 frame (NASA Deep Star Maps layout). */
export function eclipticDirToSkyUv(dir: Vec3): [number, number] {
  const [x, y, z] = eclipticToEquatorial(dir);
  const ra = Math.atan2(y, x);
  const dec = Math.asin(Math.max(-1, Math.min(1, z / Math.hypot(x, y, z))));
  const u = 0.5 - ra / (2 * Math.PI);
  return [u - Math.floor(u), 0.5 + dec / Math.PI];
}

export function eclipticToEquatorialColumns(): [Vec3, Vec3, Vec3] {
  return [eclipticToEquatorial([1, 0, 0]), eclipticToEquatorial([0, 1, 0]), eclipticToEquatorial([0, 0, 1])];
}

export function skyTier(textureTier: Tier): Tier {
  return textureTier === '8k' ? '8k' : '4k';
}
```

- [ ] **Step 4: Create `src/state/skyStore.ts`**

```ts
import { create } from 'zustand';
import { ImageryFileSchema, type TextureRef } from '../core/catalog/schema';

interface SkyState {
  ref: TextureRef | null;
  status: 'idle' | 'loading' | 'ready' | 'missing';
  load(fetchJson?: (url: string) => Promise<unknown>): Promise<void>;
}

const defaultFetch = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json() as Promise<unknown>;
};

export const useSkyStore = create<SkyState>((set) => ({
  ref: null,
  status: 'idle',
  async load(fetchJson = defaultFetch) {
    set({ status: 'loading' });
    try {
      const parsed = ImageryFileSchema.safeParse(await fetchJson(`${import.meta.env.BASE_URL}textures/imagery.json`));
      const ref = parsed.success ? parsed.data.bodies.sky?.color : undefined;
      set(ref ? { ref, status: 'ready' } : { ref: null, status: 'missing' });
    } catch {
      set({ ref: null, status: 'missing' });
    }
  },
}));
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/scene/sky src/state/skyStore.test.ts`
Expected: 6 PASS.

- [ ] **Step 6: Create `src/scene/sky/SkyBackground.tsx`**

The sky is a unit sphere at the camera (the floating origin keeps the camera at 0,0,0). It is drawn first with depth test and depth write off, so everything else paints over it.

```tsx
import { useMemo } from 'react';
import { BackSide, Matrix3, ShaderMaterial, SphereGeometry } from 'three';
import { useSkyStore } from '../../state/skyStore';
import { useViewStore } from '../../state/viewStore';
import { useTieredTexture } from '../textures/useTieredTexture';
import { eclipticToEquatorialColumns, skyTier } from './skyMath';

export const SKY_EXPOSURE = 0.55;

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uSky;
uniform mat3 uEclToEq;
uniform float uExposure;
varying vec3 vDir;
void main() {
  vec3 d = normalize(uEclToEq * normalize(vDir));
  float u = fract(0.5 - atan(d.y, d.x) / (2.0 * PI));
  float v = 0.5 + asin(clamp(d.z, -1.0, 1.0)) / PI;
  gl_FragColor = vec4(texture2D(uSky, vec2(u, v)).rgb * uExposure, 1.0);
  #include <logdepthbuf_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function SkyBackground() {
  const ref = useSkyStore((s) => s.ref);
  const tier = useViewStore((s) => s.textureTier);
  const texture = useTieredTexture(ref ?? undefined, { maxTier: skyTier(tier), srgb: true, mipmaps: false });
  const geometry = useMemo(() => new SphereGeometry(1, 64, 32), []);
  const material = useMemo(() => {
    const [c0, c1, c2] = eclipticToEquatorialColumns();
    // Matrix3.set takes rows; the columns c0..c2 become the matrix columns.
    const m = new Matrix3().set(c0[0], c1[0], c2[0], c0[1], c1[1], c2[1], c0[2], c1[2], c2[2]);
    return new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uSky: { value: null }, uEclToEq: { value: m }, uExposure: { value: SKY_EXPOSURE } },
      side: BackSide,
      depthTest: false,
      depthWrite: false,
    });
  }, []);
  material.uniforms.uSky!.value = texture;
  if (!texture) return null;
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-1000} raycast={() => null} />;
}
```

- [ ] **Step 7: Mount it, load the sky, and show the credit**

In `SceneRoot.tsx`:
```tsx
  const loadSky = useSkyStore((s) => s.load);
  useEffect(() => {
    if (useSkyStore.getState().status === 'idle') void loadSky();
  }, [loadSky]);
```
Render `<SkyBackground />` first inside `<FrameStateProvider>`. Keep `<color attach="background" …>` as the fallback.

`src/ui/SkyCredit.tsx`:
```tsx
import type { Catalog } from '../core/catalog/catalog';
import { useSkyStore } from '../state/skyStore';

/** Cites the background star map (every image shown is cited). */
export function SkyCredit({ catalog }: { catalog: Catalog }) {
  const ref = useSkyStore((s) => s.ref);
  const source = ref ? catalog.sources.get(ref.sourceId) : undefined;
  if (!source) return null;
  return (
    <p className="sky-credit">
      Sky:{' '}
      <a href={source.url} target="_blank" rel="noreferrer">
        {source.title}
      </a>{' '}
      — {source.publisher}
    </p>
  );
}
```
Render `<SkyCredit catalog={catalog} />` in `App` after `<TimeBar …/>`. In `app.css`:
```css
.sky-credit {
  position: absolute;
  left: var(--gutter);
  bottom: 150px;
  margin: 0;
  font-size: 11px;
  color: var(--text-dim, rgba(255, 255, 255, 0.55));
  isolation: isolate;
  z-index: 2;
}
.sky-credit a {
  color: inherit;
}
```

- [ ] **Step 8: Type-check, test, and review**

Run: `npm run typecheck`, `npm test`, `npx playwright test e2e --reporter=line`
Expected: all PASS, no shader errors.

Open `4-overview.png` and check checklist item 4 as far as M2a.1 goes:
- the Milky Way band is present but faint;
- the frame is not blown out;
- labels and orbits read clearly over the sky.

Open `1-earth-terminator.png` and confirm the stars stay dim next to the lit planet. If the sky is too bright, lower `SKY_EXPOSURE`, and record the value in the ledger.

- [ ] **Step 9: Commit**

```powershell
git add src
git commit -m "feat(scene): add the NASA Deep Star Maps sky background with credit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Imagery citations in the info panel, final golden review and documentation

**Files:**
- Create: `src/ui/imagery.ts`, `src/ui/citations.test.ts`, `src/ui/imagery.test.ts`, `Space_visualizer/Decisions/0005-webgl2-custom-shaders.md`, `Space_visualizer/Decisions/0006-webp-tiers-ktx2-deferred.md`
- Modify: `src/ui/citations.ts`, `src/ui/InfoPanel.tsx`, `src/ui/InfoPanel.test.tsx`, `e2e/app.spec.ts`, `README.md`, `docs/SETUP.md`, `Space_visualizer/Architecture/scene.md`, `Space_visualizer/Architecture/pipeline.md`, `Space_visualizer/Changelog.md`, `Space_visualizer/Home.md`

**Interfaces:**
- Consumes: `Body.imagery`, `Body.render` (Task 5); source ids written by Tasks 6–7.
- Produces (`imagery.ts`):
  - `interface ImageryLine { label: string; sourceId: string; derivation?: string; illustrative: boolean }`;
  - `imageryLines(body: Body): ImageryLine[]` (layer order: Surface, Relief, Night lights, Clouds, Water mask, Rings);
  - `illustrativeNotes(body: Body): string[]`.
- Produces (`citations.ts`): `citationOrder(body)` now appends each imagery layer's `sourceId`, then the ring radii sources, after `shape.sourceId`.

- [ ] **Step 1: Write the failing tests**

`src/ui/imagery.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Body } from '../core/catalog/schema';
import { makeEarth, makeJupiter, makeSun } from '../test/fixtures';
import { illustrativeNotes, imageryLines } from './imagery';

const earth: Body = {
  ...makeEarth(),
  imagery: {
    color: { tiers: { '2k': 'textures/earth/color_2k.webp' }, sourceId: 'nasa-blue-marble' },
    normal: { tiers: { '2k': 'textures/earth/normal_2k.webp' }, sourceId: 'gebco-topography', derivation: 'Normal map from GEBCO elevation; relief exaggerated.' },
    night: { tiers: { '2k': 'textures/earth/night_2k.webp' }, sourceId: 'nasa-black-marble' },
  },
};

describe('imagery lines', () => {
  it('lists each layer with its source, in display order', () => {
    expect(imageryLines(earth)).toEqual([
      { label: 'Surface', sourceId: 'nasa-blue-marble', illustrative: false },
      { label: 'Relief', sourceId: 'gebco-topography', derivation: 'Normal map from GEBCO elevation; relief exaggerated.', illustrative: false },
      { label: 'Night lights', sourceId: 'nasa-black-marble', illustrative: false },
    ]);
  });
  it('includes rings and flags illustrative layers', () => {
    const saturn: Body = {
      ...makeJupiter(),
      imagery: {
        rings: {
          texture: { tiers: { '2k': 'r' }, sourceId: 'nssdca-saturn-rings', derivation: 'Radial profile', illustrative: true },
          innerKm: { value: 74658, sourceId: 'nssdca-saturn-rings' },
          outerKm: { value: 139851, sourceId: 'nssdca-saturn-rings' },
        },
      },
    };
    expect(imageryLines(saturn)).toEqual([{ label: 'Rings', sourceId: 'nssdca-saturn-rings', derivation: 'Radial profile', illustrative: true }]);
  });
  it('explains procedural visuals', () => {
    expect(illustrativeNotes(makeSun()).join(' ')).toMatch(/illustrative/i);
    expect(illustrativeNotes(makeJupiter())).toContain('Cloud-band motion is illustrative.');
    expect(illustrativeNotes({ ...makeEarth(), imagery: null }).join(' ')).toMatch(/no official surface map/i);
    expect(illustrativeNotes(earth)).toContain('Cloud drift is illustrative.');
  });
});
```

`src/ui/citations.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Body } from '../core/catalog/schema';
import { makeEarth } from '../test/fixtures';
import { citationOrder } from './citations';

describe('citationOrder', () => {
  it('puts imagery sources after the data sources, without duplicates', () => {
    const base = citationOrder(makeEarth());
    const earth: Body = {
      ...makeEarth(),
      imagery: {
        color: { tiers: { '2k': 'a' }, sourceId: 'nasa-blue-marble' },
        clouds: { tiers: { '2k': 'b' }, sourceId: 'nasa-blue-marble' },
        night: { tiers: { '2k': 'c' }, sourceId: 'nasa-black-marble' },
      },
    };
    expect(citationOrder(earth)).toEqual([...base, 'nasa-blue-marble', 'nasa-black-marble']);
  });
});
```

Add to `src/ui/InfoPanel.test.tsx`:
```tsx
  it('shows the imagery section with cited layers and illustrative notes', () => {
    render(<InfoPanel catalog={catalog} />);
    const section = within(panel()).getByRole('heading', { name: 'Imagery' }).closest('section')!;
    expect(section).toHaveTextContent('Cloud-band motion is illustrative.');
    expect(panel()).not.toHaveTextContent('Illustrative colour — no official surface map in this release.');
  });
```
(The Jupiter fixture has `imagery: null`, so the section shows the notes "Illustrative colour — no official surface map." and "Cloud-band motion is illustrative.")

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/ui`
Expected: FAIL (`./imagery` missing; citation order lacks imagery; no Imagery heading).

- [ ] **Step 3: Create `src/ui/imagery.ts`**

```ts
import type { Body, Imagery, TextureRef } from '../core/catalog/schema';

export interface ImageryLine {
  label: string;
  sourceId: string;
  derivation?: string;
  illustrative: boolean;
}

const LAYERS: Array<[Exclude<keyof Imagery, 'rings'>, string]> = [
  ['color', 'Surface'],
  ['normal', 'Relief'],
  ['night', 'Night lights'],
  ['clouds', 'Clouds'],
  ['specular', 'Water mask'],
];

const line = (label: string, ref: TextureRef): ImageryLine => ({
  label,
  sourceId: ref.sourceId,
  ...(ref.derivation ? { derivation: ref.derivation } : {}),
  illustrative: ref.illustrative === true,
});

export function imageryLines(body: Body): ImageryLine[] {
  const imagery = body.imagery;
  if (!imagery) return [];
  const lines = LAYERS.flatMap(([key, label]) => {
    const ref = imagery[key];
    return ref ? [line(label, ref)] : [];
  });
  if (imagery.rings) lines.push(line('Rings', imagery.rings.texture));
  return lines;
}

export function illustrativeNotes(body: Body): string[] {
  const notes: string[] = [];
  if (body.render.shader === 'sun') notes.push('Illustrative surface: granulation, limb darkening and corona are artistic, not imagery.');
  else if (body.render.shader === 'venus') notes.push('Illustrative cloud deck: there is no official true-colour global map of Venus.');
  else if (!body.imagery?.color) notes.push('Illustrative colour — no official surface map.');
  if (body.render.bandFlow) notes.push('Cloud-band motion is illustrative.');
  if (body.render.shader === 'earth' && body.imagery?.clouds) notes.push('Cloud drift is illustrative.');
  if (body.render.atmosphere && body.render.atmosphere !== 'earth') notes.push('Atmosphere tint is illustrative.');
  return notes;
}
```

- [ ] **Step 4: Extend `citationOrder` in `src/ui/citations.ts`**

After `add(body.shape.sourceId);`:
```ts
  for (const imageryLine of imageryLines(body)) add(imageryLine.sourceId);
  add(body.imagery?.rings?.innerKm.sourceId);
  add(body.imagery?.rings?.outerKm.sourceId);
```
(Import `imageryLines` from `./imagery`.)

- [ ] **Step 5: Add the Imagery section to `InfoPanel.tsx`**

Replace the `<p className="info-panel__note">Illustrative colour — no official surface map in this release.</p>` line with:
```tsx
      <section>
        <h3>Imagery</h3>
        {imageryLines(body).length > 0 && (
          <ul className="info-panel__imagery">
            {imageryLines(body).map((l) => (
              <li key={l.label}>
                <strong>{l.label}</strong>
                {l.illustrative && <span className="tag">illustrative</span>}
                {cite(l.sourceId)}
                {l.derivation && <span className="info-panel__derivation"> — {l.derivation}</span>}
              </li>
            ))}
          </ul>
        )}
        {illustrativeNotes(body).map((note) => (
          <p key={note} className="info-panel__note">
            {note}
          </p>
        ))}
      </section>
```
Add to `app.css`:
```css
.info-panel__imagery {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
}
.info-panel__derivation {
  color: var(--text-dim, rgba(255, 255, 255, 0.6));
}
.tag {
  margin-left: 6px;
  padding: 0 5px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 4px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
```

- [ ] **Step 6: Run the unit tests**

Run: `npx vitest run src/ui`, then `npm test`
Expected: all PASS.

- [ ] **Step 7: Add an end-to-end imagery check to `e2e/app.spec.ts`**

```ts
test('cites the official imagery for Earth', async ({ page }) => {
  await page.goto('/?target=earth&pause=1');
  const panel = page.getByRole('complementary', { name: 'Body information' });
  const imagery = panel.locator('section', { has: page.getByRole('heading', { name: 'Imagery' }) });
  await expect(imagery).toContainText('Surface');
  await expect(imagery).toContainText('Night lights');
  await expect(panel.locator('.sources')).toContainText('Blue Marble');
});
```

Run: `npx playwright test --reporter=line`
Expected: all e2e tests PASS (M1's 6, the new imagery test and the 5 golden views), with no page or shader errors.

- [ ] **Step 8: Final golden review**

Run `npm run textures -- --offline` (the textures should be unchanged), then `npx playwright test e2e/golden.spec.ts --reporter=line`. Review all six PNGs in `test-results/golden/` against the spec §7 checklist, items 1–5, for the parts M2a.1 owns:

| View | M2a.1 must show | Left for M2a.2 |
|---|---|---|
| Earth | Twilight band, city lights only at night, offset cloud shadows, blue limb | — |
| Saturn | Ring shadow on the globe, globe shadow on the rings, translucent rings | — |
| Sun | Granulation, darker limb, corona halo, bloom | Lens flare, god rays, star dimming |
| Overview | Milky Way present and faint, frame not blown out | Label de-cluttering |
| Phone | Bodies render; the panel stays usable | Drawer becomes a sheet |
| Mars | Real colour, relief at the terminator, faint limb | — |

Record any constants tuned during the review in the ledger. Copy the six PNGs to `Space_visualizer/Assets/m2a1-golden/` (create the folder) so the vault keeps the visual record. They are small screenshots and fine to commit.

- [ ] **Step 9: Update the documentation**

`README.md`, new section **Imagery** after the data section:
```markdown
## Imagery

Planet surfaces, rings and the star sky come from official NASA, USGS and STScI products. Each image is cited in the app's info panel.

- `npm run textures`: downloads the source products (about 5 GB, cached in `pipeline/raw/textures/`) and builds the committed 1k/2k textures in `public/textures/`.
- `npm run textures:hd`: also builds 4k/8k textures locally (not committed). Open the app with `?tier=4k` or `?tier=8k` to use them; missing tiers fall back to 2k.
- `npm run textures -- --offline`: rebuilds from the cache without network access.
- `npm run textures:verify`: checks that every source URL still responds.
```

`docs/SETUP.md`:
- Under requirements, add: about 6 GB free disk space for the imagery cache (only needed to rebuild textures; the committed textures are enough to run the app); 16 GB RAM is recommended for `textures:hd` (the build runs Node with an 8 GB heap).
- Add a **Golden views** paragraph: `npx playwright test e2e/golden.spec.ts` writes screenshots to `test-results/golden/`; the URL parameters (`jd`, `date`, `pause`, `target`, `dist`, `az`, `azSun`, `el`, `tier`) also work in the browser for sharing a view.
- Under troubleshooting, add:
  - "Texture build fails a validation (for example the Mars peak check)": the source product may have changed layout; run `npm run textures:verify`, and see the vault's Data Sources notes;
  - "Black planets": a shader failed to compile; check the browser console for `THREE.WebGLProgram`, and report the GPU and browser.

Vault:
- `Architecture/scene.md`: add a **Rendering (M2a.1)** section covering:
  - object-space shading with float64 CPU uniforms (`bodyUniforms.ts`, `useBodyUniforms` at priority −0.4);
  - the material per `render.shader`, and `BodyExtras` (clouds, atmosphere, rings, corona);
  - log-depth chunks in every `ShaderMaterial`;
  - the sky sphere at the camera;
  - tiered loading with fallback and `data-textures-ready`;
  - URL overrides.
- `Architecture/pipeline.md`: add a **Textures** section: `pipeline/textures/` modules, the cache, tiers and budget, the validations (Earth Sahara vs Pacific, Mars and Mercury DEM ranges, Olympus Mons peak, sky orientation), and `imagery.json`.
- `Decisions/0005-webgl2-custom-shaders.md`: stay on WebGL2 with three `ShaderMaterial` and object-space lighting, rather than WebGPU/TSL or `onBeforeCompile` patches. Reasons: browser reach, the e2e SwiftShader runner, full control of precision. Revisit when WebGPU runs in the CI browser.
- `Decisions/0006-webp-tiers-ktx2-deferred.md`: WebP tiers 1k/2k committed (≤ 60 MB) and 4k/8k local; KTX2/Basis deferred until M7 deployment, when GPU memory on phones matters. It costs more memory per texture now, but avoids a WASM encoder in the pipeline.
- `Changelog.md`: an **M2a.1** entry listing the imagery products, the shaders, the rings, the sky, URL views and the golden screenshots.
- `Home.md`: mark the M2a.1 plan complete and link the two decisions and the golden screenshots.

Each new vault note links back to [[Home]] and to the M2 spec, like the existing notes.

- [ ] **Step 10: Final verification and commit**

Run: `npm run typecheck`, `npm test`, `npx playwright test --reporter=line`
Expected: all PASS.

```powershell
git add -A src e2e README.md docs Space_visualizer
git commit -m "feat(ui): cite imagery per body; docs, decisions and golden screenshots for M2a.1" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

