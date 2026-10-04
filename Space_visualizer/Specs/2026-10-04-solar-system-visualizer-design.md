---
title: Solar System Visualizer — Design Spec
date: 2026-10-04
status: approved
tags: [spec, architecture]
---

# Solar System Visualizer — Design Spec

Back to [[Home]]

## 1. Intent

**What we are building:** a browser-based 3D visualization of the solar system with real positions over time, free navigation through multiple camera views, sourced information about every object, and rich filtering. The solar system is the first *region* of an app designed to grow outward to nearby stars, the Milky Way, and other galaxies.

**Goals (equally weighted):**
- **Accuracy** — positions computed from official ephemeris data for any date; documented accuracy limits shown to the user.
- **Information** — every object has an information panel; every fact is cited to an official source.
- **Visuals** — a polished, attractive scene that holds up from a moon's surface to the edge of the solar system.

**Constraints:**
- All facts come from official sources (NASA, JPL, ESA, IAU, MPC, USGS, IERS). Surface textures only from official NASA/USGS/PDS maps; where none exists, a plain or procedural surface labeled as such.
- Runs locally for now; deployable as a static site soon; a backend for user accounts may come later and must not require restructuring the frontend.
- Architecture must support future expansion to galaxy scales without a rewrite.

**Success criteria:**
- Planet positions match JPL Horizons within the documented accuracy of the model used, for any date in the model's valid range. Where a source's published nominal accuracy proves optimistic (found during M1 planning: JPL's 1800–2050 Neptune figures are exceeded by up to ~7×), the pipeline measures the real error against Horizons and the app shows the measured figure.
- Every displayed value links to its source; the data build fails if any value lacks one.
- All five camera views are usable and switchable; all five filter kinds work.
- 60 fps on a mid-range laptop with the full catalogue (including 100k+ small-body points in M4).

## 2. Technology

| Concern | Choice |
|---|---|
| Build tool | Vite |
| Language | TypeScript (strict) |
| UI | React |
| 3D | React Three Fiber + drei over Three.js; raw Three.js for hot paths (point clouds, custom shaders) |
| State | Zustand |
| Post-processing | `@react-three/postprocessing` (Sun bloom) |
| Validation | Zod (pipeline and runtime data loading) |
| Tests | Vitest, React Testing Library, Playwright |
| Data pipeline | Node + TypeScript scripts |
| Hosting (later) | Any static host (GitHub Pages / Netlify / Cloudflare Pages) |
| Backend (later, optional) | Separate service (e.g. Node + Postgres, or Supabase) for accounts only |

Decision record: React Three Fiber chosen over plain Three.js (more hand-written UI↔scene glue) and CesiumJS/Babylon.js (Earth-centric assumptions / smaller ecosystem).

## 3. Architecture

### 3.1 Modules

| Module | Purpose | Depends on |
|---|---|---|
| `pipeline/` | Fetch official data, normalize, validate, emit `public/data/**` | Official APIs only |
| `src/core/` | Pure TS: ephemerides, time scales, frames, units, catalogue query/filter | Nothing |
| `src/state/` | Zustand stores: time, selection, filters, view, layers, scale mode | `core` |
| `src/scene/` | R3F components: bodies, orbits, point clouds, star field, floating origin, region manager | `core`, `state` |
| `src/camera/` | Camera rig and one controller per view | `core`, `state` |
| `src/ui/` | Panels: info, filters, search, time controls, view switcher, layers | `core`, `state` |

`core` has no React or Three.js imports, so it is fully unit-testable and reusable (e.g. by a future backend or worker).

### 3.2 Per-frame data flow

1. Time store advances simulation time (Julian Date, TDB, float64).
2. `core` computes positions of visible bodies in float64 km (heliocentric ecliptic J2000).
3. Scene subtracts camera position (floating origin) and writes float32 offsets to object transforms.
4. Render.

### 3.3 Regions (growth path)

The catalogue is organized as nested **regions**: Solar System → Stellar Neighbourhood → Milky Way → Local Group → beyond. Each region declares:

```ts
interface Region {
  id: string;
  parentId: string | null;
  frame: FrameId;              // its native coordinate frame
  unit: LengthUnit;            // km, AU, ly, pc, Mpc…
  originInParent: Vec3d;       // position of this region's origin in the parent frame
  activeRange: [minCameraDistance, maxCameraDistance];
  dataManifest: string;        // path to its data files
}
```

A `RegionManager` activates/fades region renderers by camera distance and handles frame conversion at hand-off. Only the Solar System region is implemented initially, but the interface and manager exist from M1.

## 4. Data and sources

### 4.1 Data model

Every fact is a sourced value:

```ts
interface SourcedValue<T = number> {
  value: T;
  unit?: string;
  uncertainty?: number;
  sourceId: string;
}

interface Source {
  id: string;
  title: string;
  publisher: string;   // NASA, JPL, ESA, IAU…
  url: string;
  retrievedAt: string; // ISO date
  license: string;
}
```

A **Body** has: `id`, `name`, `designations[]`, `category` (`star | planet | dwarf-planet | moon | asteroid | comet | spacecraft`), `parentId`, `regionId`, `physical` (radius, mass, density, surface gravity, rotation period, axial tilt, albedo, mean temperature… each a `SourcedValue`), `orbit` (an `OrbitModel`), `rotation` (IAU pole/prime-meridian model, sourced), `discovery` (date, discoverer — sourced), `description` (text + sourceId), `texture` (url + sourceId, or `null` → labeled fallback), `accuracyNote`.

**Orbit models** (each declares a valid date range and an accuracy statement):

| Model | Used for | Method |
|---|---|---|
| `planet-approx` | 8 planets (+ Earth–Moon barycentre) | JPL "Approximate Positions of the Planets" elements with secular rates (1800–2050 table; 3000 BC–AD 3000 table as fallback) |
| `keplerian` | Dwarf planets, asteroids, comets | Osculating elements from SBDB, two-body propagation; elliptic, parabolic and hyperbolic |
| `satellite-mean` | Moons | JPL SSD mean elements relative to the parent's Laplace plane |
| `table` | Spacecraft; optionally high-accuracy bodies (e.g. the Moon, Galilean moons) | Pre-fetched Horizons state vectors, interpolated |

Units: km, s, kg internally; angles stored in degrees in data, radians in `core`.

### 4.2 Official sources

| Data | Source |
|---|---|
| Planet orbits | JPL SSD — Approximate Positions of the Planets |
| Planet physical data | NASA NSSDCA Planetary Fact Sheets; JPL SSD Planetary Physical Parameters |
| Moon orbits & physical data | JPL SSD Planetary Satellite Mean Elements & Physical Parameters |
| Dwarf planets, asteroids, comets | JPL Small-Body Database API (single objects); SBDB Query API (bulk populations) |
| Spacecraft & high-accuracy tables | JPL Horizons API |
| Rotation & pole orientation | IAU WGCCRE 2015 report (Archinal et al.), machine-readable via NASA/JPL NAIF `pck00011.tpc` (which also supplies IAU shape radii) |
| Names & classifications | IAU / Minor Planet Center |
| Leap seconds / ΔT | IERS |
| Star field | ESA Hipparcos catalogue |
| Constellation boundaries | IAU |
| Textures | NASA Scientific Visualization Studio, USGS Astrogeology, NASA PDS |
| Descriptions | NASA Science pages (quoted with attribution; NASA content is generally public domain — license recorded per source) |

Each source gets its own note under `Data Sources/` in this vault.

### 4.3 Pipeline

`fetch → raw cache → normalize → validate → emit`

- **Fetch:** one fetcher per source; raw responses cached under `pipeline/raw/` (not committed).
- **Normalize:** convert units, map to the Body schema, attach `sourceId`s.
- **Validate (Zod):** schema shape, units, plausible ranges, and **every value has a resolvable `sourceId`**. Any failure stops the build and names the exact field path.
- **Emit:** committed output under `public/data/`, so data refreshes appear as reviewable diffs.

Output layout:

```
public/data/
  regions.json
  sources.json
  presets.json
  solar-system/
    bodies.json             # core + curated bodies
    small-bodies/*.bin      # packed orbital elements for bulk populations (M4)
    spacecraft/<id>.json    # Horizons vector tables (M5)
    textures/…
  stars/hipparcos.bin
```

If a source is unreachable, the previous committed data is kept and the failure is reported.

### 4.4 Time

Simulation time is a float64 Julian Date in TDB. UTC ↔ TT conversion uses the IERS leap-second table (and ΔT for dates before 1972); TDB ≈ TT at this app's accuracy. The UI displays UTC.

### 4.5 Accuracy transparency

Each body's info panel shows its orbit model's accuracy note: the source's published nominal error plus the maximum error measured against committed JPL Horizons reference positions. When simulation time leaves a model's valid range, the time bar shows a warning and affected bodies are marked approximate; `table` bodies outside their range are hidden with a note.

## 5. Rendering and scale

- **Precision:** float64 positions in `core`; camera-relative (floating-origin) rendering so the GPU only sees small float32 offsets — no jitter at any distance. Three.js `logarithmicDepthBuffer` to span ~1 m to galactic distances.
- **Scale modes:** `core` always holds true values; one scene-level mapping produces render values.
  - *Readable* (default): exaggerated radii with a minimum pixel size; moon orbits expanded so moons stay outside their enlarged parent.
  - *True scale*: real sizes and distances; screen-space labels and markers keep bodies findable.
- **Bodies:** LOD spheres; official textures where available; orientation and spin from IAU rotation models; Sun is the single light source with bloom; optional faint fill light layer.
- **Orbit lines:** polylines generated from each body's orbit model.
- **Bulk populations (M4):** one `THREE.Points` object; orbital elements as vertex attributes; Kepler's equation solved in the vertex shader with a time uniform. Target 100k+ points.
- **Sky:** Hipparcos stars at true positions, magnitudes and colours. Constellation layer shows IAU boundaries by default; stick figures are an optional layer labeled "traditional — not IAU".
- **Performance target:** 60 fps on a mid-range laptop via instancing, GPU orbit math, and frustum culling.

## 6. Camera views

A single **CameraRig** owns a float64 position and an orientation quaternion. Views are controllers:

```ts
interface CameraController {
  id: 'orbit' | 'follow' | 'top-down' | 'from-body' | 'fly';
  enter(from: CameraState): void;
  update(dt: number, ctx: SceneContext): void;
  exit(): CameraState;
}
```

Switching hands state to the next controller with a smooth transition; long jumps interpolate distance logarithmically. Switch via the view switcher or keys `1`–`5`; `Esc` returns to orbit.

1. **Orbit (default):** rotate/zoom/pan around a target; zoom rate proportional to distance; mouse and touch.
2. **Follow:** fly to the selected body and track it through time; toggle between inertial framing and co-rotating with the body.
3. **Top-down:** looking down the ecliptic north pole; pan/zoom only; optional orthographic projection; labels and orbits emphasized.
4. **From body:** choose a body and latitude/longitude (or low orbit); oriented by the IAU rotation model so horizon and sky motion are correct; drag to look around. Ground is the textured sphere; terrain is out of scope (no official elevation data for all bodies).
5. **Fly:** WASD + mouse look, Shift to boost; speed scales with distance to the nearest body; collision stop at surfaces.

Across all views: the camera never enters a body, and the selected body stays highlighted.

## 7. Interface

- **Top bar:** fuzzy search (names and designations, grouped by category), view switcher, scale-mode toggle.
- **Left panel (collapsible) — Filters:**
  - *Category:* star, planets, dwarf planets, moons, asteroids, comets, spacecraft.
  - *Property ranges:* radius, distance from the Sun, orbital period, discovery year, parent body; each with an "include unknown" option.
  - *Presets:* data-defined (filters + layers + camera), e.g. Inner Solar System, Gas Giants & Moons, Kuiper Belt, Active Missions.
  - *Layers:* orbits, labels, stars, constellation boundaries, traditional figures, ecliptic grid, fill light.
- **Right panel — Info:** header (name, category, parent, image); sections Physical, Orbit, Discovery, Description, Accuracy; every value shows unit and a citation marker linking to its `Source`; live values at simulation time (distance from Sun and Earth, light time).
- **Bottom bar — Time:** UTC date, play/pause/reverse, speed steps (real time → 1 yr/s), date picker, "Now", validity warning.
- **Interaction:** hover shows label; click selects.
- **Filter semantics:** filters hide bodies from both the scene and search results.
- **URL state:** time, view, target, filters, layers encoded in the URL hash for bookmarking and sharing.
- **Responsive & accessible:** panels become bottom sheets on small screens; full keyboard operation; ARIA labels on panels; honors `prefers-reduced-motion`.
- **Visual style:** dark, scientific aesthetic; detailed styling decided in the M1 implementation plan.

## 8. Error handling

| Situation | Behaviour |
|---|---|
| Core data fails to load | Full-screen error with retry |
| Optional dataset fails (bulk population, spacecraft, stars) | App continues; that layer disabled with a notice |
| WebGL unavailable | Explanatory message instead of a blank page |
| Time outside a model's valid range | Warning in time bar; bodies marked approximate; `table` bodies hidden with note |
| Texture missing | Plain colour fallback, labeled |
| Kepler solver edge cases | Newton iteration with bisection fallback; parabolic and hyperbolic orbits handled explicitly; never fails silently |
| Pipeline source unreachable | Keep previous committed data; report failure |
| Pipeline validation failure | Build stops, naming the field path |

## 9. Testing

- **`core`** (test-first, Vitest): positions vs. JPL Horizons reference vectors at several dates within each model's documented tolerance; Kepler solver edge cases (high e, e≈1, e>1); time-scale conversions; filter/query logic.
- **Pipeline:** fixture tests on recorded API responses; check that every emitted value has a resolvable source.
- **UI:** component tests for filters, search, and info-panel citations.
- **Scene/camera:** unit tests on controller math (pure functions); Playwright smoke tests — app loads, select a body, switch each view.
- **Performance:** frame-rate benchmark with 100k points (M4).

## 10. Milestones

> **Amended 2026-10-04:** from M2 on, the milestone plan, imagery rules and interface are superseded by [[2026-10-04-m2-cinematic-and-rich-bodies-design]] (M2a cinematic graphics, M2b rich body detail, M2c exhibit mode; the milestones below shift to M3–M7). The table below is kept for history.

Each milestone ends with a working app and updated vault notes. Each gets its own implementation plan under `Plans/`.

| # | Milestone | Scope |
|---|---|---|
| M1 | Foundation | Scaffold; `core` time + `planet-approx` ephemeris; region interface + manager (Solar System only); floating origin; Sun + 8 planets with sourced info panels; time controls; orbit and follow views; pipeline for planet data |
| M2 | Moons & dwarf planets | The five IAU dwarf planets (SBDB) and major moons — defined as all moons of planets and dwarf planets with mean radius ≥ 150 km, plus Phobos and Deimos (`satellite-mean`, `table` for the Moon/Galilean moons); top-down, from-body and fly views; layers; search; Hipparcos star field + IAU boundaries |
| M3 | Curated small bodies & filters | Notable asteroids and comets (the curated list is fixed in the M3 plan); category, property and preset filters; URL state; official textures |
| M4 | Bulk populations | Thousands of asteroids/comets via SBDB Query API as GPU point clouds |
| M5 | Spacecraft | Horizons trajectories for selected missions (list fixed in the M5 plan) |
| M6 | Deploy & scale | Static deployment; true-scale mode polish |
| Later | Beyond | Stellar Neighbourhood (ESA Gaia), Milky Way, galaxies; accounts backend |

## 11. Out of scope (for M1–M6)

- User accounts and any backend.
- 3D terrain on bodies.
- Regions beyond the Solar System (interface only).
- Non-official imagery or facts.
