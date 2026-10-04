---
title: M2 Cinematic Graphics and Rich Bodies — Design Spec
date: 2026-10-04
status: draft — awaiting review
amends: "[[2026-10-04-solar-system-visualizer-design]]"
tags: [spec, m2, graphics]
---

# M2 Cinematic Graphics and Rich Bodies — Design Spec

Back to [[Home]] · Amends [[2026-10-04-solar-system-visualizer-design]] (milestone plan, imagery rules, UI).

## 1. Intent

**Why this spec exists:** after M1, the user found two gaps. Bodies lack depth of information, and the graphics (plain coloured spheres) fall far short of the intended level. The reference for the intended look is [sael.net](https://sael.net/): interactive 3D explainers with studio lighting, bloom, depth of field, glass, particle physics, editorial typography and self-playing chapters. That bar is set alongside advanced Opus 5.5 graphics projects (research summary in §11).

**Goals (unchanged priorities):** accuracy, information and visuals stay equally weighted. Positions and facts keep their M1 accuracy and per-value citations. Visual effects are allowed to be cinematic rather than physical, but they never alter data.

**Decisions taken in brainstorming (2026-10-04):**

| Topic | Decision |
|---|---|
| Next focus | More detail per existing body before adding more bodies |
| Body detail | All four areas: interior and composition, atmosphere and climate, missions and discovery, features and fields |
| Visual direction | Maximum cinematic (bloom, filmic tone mapping, lens flare, sun rays, depth of field, chromatic aberration, film grain, vignette, anamorphic streaks, cinematic fill light, auto fly-by tour), with a Camera-effects toggle |
| Hardware | Adaptive quality: High, Medium, Low and Auto (frame-time driven) |
| Art style | Both, switchable: **Realistic** (official NASA/USGS surface maps) and **Exhibit** (stylized, sael-like) |
| Engine | Stay on WebGL2 + React Three Fiber; revisit WebGPU when compute-heavy features arrive (decision record) |
| Decomposition | M2a Visual foundation and Realistic mode → M2b Rich body detail → M2c Exhibit mode |

**Success criteria for M2 as a whole:**
- Golden views (§7) pass the look checklist in both styles.
- Every body has sourced interior, atmosphere (where present), discovery and missions, named features and field data, with every value cited.
- 60 fps at High on a desktop GPU and at Medium on a mid-range laptop; Auto settles without oscillating.
- No regressions in the M1 accuracy tests or the "every value cited" rule.

## 2. Imagery rule (amends spec §1 constraints)

- **Realistic mode** surface imagery must come from official sources (NASA, USGS, ESA, JPL, STScI), each recorded as a cited `Source`.
- **Procedural visuals** (Venus cloud deck, Sun granulation, gas-giant band flow, exaggerated relief, cinematic effects) are allowed and are labelled **illustrative** in the UI.
- **Exhibit mode** surfaces are stylized: low-poly meshes built *from official elevation and colour data*, labelled **stylized**.
- No data value (position, fact, accuracy figure) is ever derived from an illustrative or stylized visual.

## 3. Milestones (replaces spec §10 from M2 on)

| # | Milestone | Scope |
|---|---|---|
| M1 | Foundation | Done (PR #1) |
| **M2a** | Visual foundation and Realistic mode | §4–§7 of this spec |
| **M2b** | Rich body detail | §8 (outline; detailed in its own plan) |
| **M2c** | Exhibit mode | §9 (outline; detailed in its own plan) |
| M3 | Moons and dwarf planets | Was M2: dwarf planets, major moons, top-down, from-body and fly views, layers, search |
| M4 | Curated small bodies and filters | Was M3 (textures moved into M2a) |
| M5 | Bulk populations | Was M4 |
| M6 | Spacecraft | Was M5 |
| M7 | Deploy and scale | Was M6 |

## 4. M2a — Interface redesign

**Layout**
- **Header (top-left):**
  - a small subtitle (category · distance), then a large bold headline in the body's accent colour;
  - 3–4 live stat chips with monospace numbers (distance from Earth, light time, day length, mean temperature);
  - a 2–3 sentence narrative assembled from cited facts, with key numbers highlighted.
  - With nothing selected, it shows a Solar System overview (date, scale, bodies in view).
- **Control panel (top-right, dark frosted glass):** segmented controls with keyboard hints.

  | Group | Controls |
  |---|---|
  | View | Orbit, Follow |
  | Style | Realistic; Exhibit (from M2c) |
  | Scale | Readable, True |
  | Time | Speeds, play/pause, reverse, scrubber |
  | Quality | Auto, High, Medium, Low |
  | Camera effects | On/off |

- **Pill labels:** each body gets a coloured dot, its name and one live monospace datum ("JUPITER · 4.96 AU · 52 min light"). The selected body's pill expands; labels fade when bodies overlap.
- **Bottom bar:** date and time scrubber plus a **Tour** button. M2b adds per-body chapters here.
- **Facts & sources drawer (right):** the M1 info panel content (all facts, live values, accuracy, sources) as a slide-out drawer, with a new **Imagery** section.
- **Keyboard:** 1/2/Esc as in M1; **T** Tour; **Q** cycles Quality; **E** toggles camera effects; **F** opens the drawer. Keys are ignored while typing.

**Visual language:** dark frosted glass panels with hairline borders; Inter for text and a monospace face for numbers; cyan for interaction, amber for warnings, per-body accent colours; animated transitions (slide, fade, ticking numbers, headline crossfade) that respect `prefers-reduced-motion`.

## 5. M2a — Rendering, effects and adaptive quality

**Kept from M1:** WebGL2, React Three Fiber, the floating origin, the logarithmic depth buffer, float64 positions and the `useFrame` priority order.

**Lighting**
- The Sun remains the physical light source.
- **Cinematic fill:** a faint rim light from behind the camera plus a soft ambient term, so night sides read as deep blue-black. It is disabled when Camera effects is off.
- **Analytic shadows:** soft-edged sphere-on-sphere eclipse shadows and ring shadows (rings on Saturn, Saturn on the rings), computed in shaders. No shadow maps, because they cannot span solar-system distances. The geometry lives in `src/core` as pure, testable functions.

**Effects stack** (`@react-three/postprocessing`, in order)
1. Multi-level HDR bloom.
2. Sun rays (god rays) and lens flare, occluded by bodies.
3. Depth of field focused on the selected body (mild in Realistic mode, strong in Exhibit mode).
4. Filmic tone mapping (ACES or AgX; chosen visually in the plan) with auto-exposure.
5. Chromatic aberration at the frame edges, vignette, film grain, anamorphic streaks on the brightest highlights.

The Camera-effects toggle disables 2–5 and the cinematic fill; bloom stays, at reduced strength.

**Adaptive quality**

| Setting | High | Medium | Low |
|---|---|---|---|
| Pixel ratio | min(devicePixelRatio, 2) | 1.25 | 1 |
| Sphere segments | 192 | 96 | 48 |
| Texture tier (max) | 8k / 4k | 2k | 1k |
| Atmosphere samples | 16 | 8 | 4 |
| Bloom levels | 8 | 5 | 3 |
| Depth of field / grain / chromatic aberration / streaks | on | on (lighter) | off |
| Sun rays | on | on | off |

- **Auto mode:** after a 3 s warm-up, it measures the median frame time over a 2 s window. It steps down when that exceeds 18 ms, and steps up after 10 s under 12 ms, with a 5 s cooldown after any change.
- **Phones** (coarse pointer and narrow viewport) start at Low.
- **Textures** load progressively: 1k immediately, then higher tiers swapped in without blocking.

**Tour mode:** a scripted camera path (Sun, then each planet outward, then an overview) with eased logarithmic-distance fly-bys, slow orbits and headline changes. Any user input exits the tour immediately.

## 6. M2a — Imagery and shading

**Sources** (verified on 2026-10-04 unless marked *to verify*; full licence notes go in Data Sources vault notes)

| Body | Imagery | Source |
|---|---|---|
| Earth | Blue Marble Next Generation, month matched to the date; topography and bathymetry → normal map; Black Marble city lights; cloud layer; land/ocean mask → specular | NASA Earth Observatory / Visible Earth; Black Marble (NASA) |
| Moon | Lunar Reconnaissance Orbiter camera colour + LOLA elevation → normal map (used by M2b) | NASA SVS CGI Moon Kit |
| Mars | Viking MDIM 2.1 colorized mosaic + MOLA elevation → normal map | USGS Astrogeology |
| Mercury | MESSENGER global mosaic + elevation | USGS Astrogeology (*to verify*) |
| Venus | Magellan radar mosaic for the "radar surface" view; cloud tops procedural (illustrative) | USGS Astrogeology |
| Jupiter, Saturn, Uranus, Neptune | Hubble OPAL yearly global maps (year nearest the simulation date) | STScI MAST HLSP "OPAL" (NASA/ESA, A. Simon et al.) |
| Saturn's rings | Cassini radial colour and transparency profiles | NASA PDS Ring-Moon Systems Node (*to verify*) |
| Uranus's rings | Ring radii and widths | Published values (*to verify* source) |
| Sun | Procedural granulation + limb darkening (illustrative; published limb-darkening coefficients cited) | Coefficients: *to verify* |
| Sky | Deep Star Maps 2020 (Hipparcos-2, Tycho-2, Gaia DR2; ICRF equirectangular; HDR) | NASA SVS 4851 |

**Items marked *to verify*:** confirming them is the first task of the M2a plan. If no official product exists, that layer falls back to a procedural version labelled **illustrative** (as for Venus's cloud tops), and the gap is recorded in the Data Sources notes. Nothing else blocks on them.

**Data model change:** `Body.texture` is replaced by `Body.imagery`.

```ts
interface TextureRef {
  tiers: Partial<Record<'1k' | '2k' | '4k' | '8k', string>>; // URLs under public/textures/
  sourceId: string;
  derivation?: string; // e.g. "normal map from MOLA elevation, relief ×1.5"
  illustrative?: boolean;
}
interface Imagery {
  color?: TextureRef; normal?: TextureRef; night?: TextureRef; clouds?: TextureRef;
  specular?: TextureRef; radar?: TextureRef;
  rings?: { color: TextureRef; alpha: TextureRef; innerKm: SourcedValue; outerKm: SourcedValue };
  byYear?: Record<string, TextureRef>; // OPAL yearly maps
}
```

**Texture pipeline** (`pipeline/textures/`)
- `npm run textures`: produces the 1k and 2k tiers (committed; total budget about 60 MB).
- `npm run textures:hd`: produces the 4k and 8k tiers (git-ignored; generated in CI for deployment).
- Steps: download with cache and checksums → pick the smallest official product covering the top tier → reproject / colour-convert → normal maps from elevation (Sobel on a height grid, relief factor recorded in `derivation`) → tiers → KTX2/Basis (feasibility-checked in the plan; WebP fallback) → validate dimensions, budget and source resolution.
- Same failure rule as the data pipeline: if anything fails validation, nothing is written.

**Shading (Realistic mode)**
- **Shared framework:** lighting, analytic shadows, cinematic fill, log-depth-safe shader chunks; atmosphere shells scale with Readable mode.
- **Earth:**
  - day map, relief and ocean-only GGX sun glint;
  - a soft twilight band with sunlight reddened at grazing angles;
  - city lights on the night side, fading near the twilight band and under clouds;
  - a drifting cloud layer with offset shadows, sunset tint and city-light under-glow;
  - a Rayleigh/Mie scattering shell (O'Neil, *GPU Gems 2*) with the sample count set by the quality preset.
- **Mars:** colour and relief; thin butterscotch scattering atmosphere.
- **Venus:** illustrative cloud deck with slow banding and a thick golden glow; Magellan radar view as an alternative.
- **Mercury:** colour and relief; airless-body reflectance blend (Lommel–Seeliger) so the full phase looks evenly lit.
- **Jupiter and Saturn:** OPAL maps on IAU-flattened ellipsoids; illustrative differential band flow; limb darkening; haze rim.
- **Saturn's rings:** Cassini profiles; lit and unlit faces with forward scattering; shadows both ways; dust glow when backlit.
- **Uranus and Neptune:** OPAL maps, haze limb; Uranus's dark thin rings.
- **Sun:** animated granulation, limb darkening, illustrative sunspot patches, corona glow driving bloom, flare and god rays.
- **Sky:** Deep Star Maps in true celestial orientation as an HDR background, exposure-matched so stars fade when the Sun is in frame; Milky Way included.

## 7. M2a — Testing and visual QA

- **Unit tests:** quality controller (thresholds, hysteresis, cooldown), tier selection, eclipse and ring-shadow geometry, limb darkening and atmosphere parameters, OPAL year selection, tour path, imagery schema and citation, and the new UI components (header, chips, glass panel, drawer with Imagery).
- **Texture pipeline tests:** fixture-based download parsing, normal-map generation on a synthetic height grid, budget and source validation.
- **End-to-end tests:**
  - no page errors during or after interactions;
  - the 2k tier has loaded;
  - each quality preset can be forced;
  - Camera effects off removes post-processing passes;
  - Tour starts and any key stops it;
  - selection updates the header and chips;
  - the drawer lists Imagery sources.
- **Golden views and look checklist.** Automated screenshots are reviewed against this checklist each graphics task and attached to the PR. No pixel-diff tests, because GPU output varies between machines.
  1. *Earth, day/night split:* visible twilight band, city lights only on the night side, clouds with offset shadows, blue limb glow.
  2. *Saturn near equinox angle:* the ring shadow on the globe and the globe's shadow on the rings both visible; rings translucent.
  3. *Sun in frame:* granulation visible, bloom halo, lens flare and god rays; stars dimmed.
  4. *Overview:* readable labels without overlap clutter, orbits visible, Milky Way present, frame not blown out.
  5. *Phone width:* panels usable, drawer becomes a sheet, text legible.
- **Performance probe:** frame-time report per preset on the development machine; Auto must settle within 5 s and not oscillate.

## 8. M2b — Rich body detail (outline)

- **Data (all cited):**
  - interior layers and bulk composition (NASA fact sheets, mission science pages);
  - atmosphere composition and layers (NSSDCA per-planet fact sheets);
  - missions and discovery (NASA/NSSDCA mission catalogues);
  - named surface features with coordinates and sizes (IAU/USGS Gazetteer of Planetary Nomenclature);
  - magnetic field parameters (dipole tilt and strength; NASA sources).
- **Views:**
  - animated exploded cutaway of the interior;
  - composition charts;
  - mission timeline;
  - clickable feature pins on the globe;
  - magnetic field lines with flowing particles and aurora ovals;
  - per-body chapters in the bottom bar that play themselves.
- **Adds the Moon** (Earth's chapters need it), using the CGI Moon Kit imagery prepared in M2a.

## 9. M2c — Exhibit mode (outline)

- Low-poly planets generated from official elevation and colour data (faceted, palette-quantized), labelled **stylized**.
- Lab and studio staging: an exhibit stand with dials, soft studio lighting with shadow maps (local scene scale makes them viable), strong depth of field, glass shells (refraction and Fresnel).
- Views: Lab, Exploded (reusing M2b's cutaways) and Studio; Style toggle Realistic ↔ Exhibit.

## 10. Architecture changes

| Module | Change |
|---|---|
| `src/core/shadows/` | New: analytic eclipse and ring-shadow geometry (pure) |
| `src/core/catalog/schema.ts` | `texture` → `imagery` (§6); new M2b sections later |
| `src/render/` | New: effects stack, quality controller and presets, tour path |
| `src/scene/materials/` | New: per-body shader materials and shared chunks |
| `src/ui/` | Header, stat chips, glass control panel, pill labels, drawer, chapter bar |
| `pipeline/textures/` | New: imagery download, processing, tiers, validation |
| `public/textures/` | Committed 1k and 2k tiers; 4k and 8k git-ignored |

**Decision record:** stay on WebGL2 for M2; re-evaluate WebGPU at M5 (bulk populations).

## 11. Research summary (2026-10-04)

- **Target look:**
  - [sael.net](https://sael.net/): studio lighting, depth of field, bloom, glass shells, particle field lines, editorial UI, self-playing chapters, Lab/Exploded/Studio views.
  - A photoreal Earth co-authored with Opus 5.5 ([prohasiki/asteroid PR #1](https://github.com/prohasiki/asteroid/pull/1)): scattering shell, twilight band, city lights, GGX glint, cloud shadows, ACES, flare, adaptive quality.
  - A Moon built from NASA data ([maxbbn/solar PR #4](https://github.com/maxbbn/solar/pull/4)): CGI Moon Kit, LOLA normals, Lommel–Seeliger reflectance.
  - Cinematic deep space ([demo-astra](https://github.com/Yosf96633/demo-astra), [webgpu-galaxy](https://github.com/dgreenheck/webgpu-galaxy)).
  - Opus 5.5 showcases with self-review by screenshots ([OhMyUnicorn](https://ohmyunicorn.com/labs/dream-loop/planet-opus55/)).
- **Benchmark:** [NASA's Eyes on the Solar System](https://eyes.nasa.gov/apps/solar-system/).

## 12. Out of scope for M2

New bodies other than the Moon (M3+); WebGPU; terrain displacement beyond normal mapping; sound; accounts and backend; deployment (M7).
