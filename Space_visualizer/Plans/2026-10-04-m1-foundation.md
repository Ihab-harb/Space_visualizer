---
title: M1 Foundation — Implementation Plan
date: 2026-10-04
status: awaiting review
milestone: M1
tags: [plan, m1]
---

# M1 Foundation Implementation Plan

Back to [[Home]] · Spec: [[2026-10-04-solar-system-visualizer-design]]

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A locally running web app showing the Sun and eight planets at their real positions for any date, with time controls, orbit and follow camera views, and an information panel in which every value cites an official source.

**Architecture:** A pure-TypeScript `src/core` (time scales, JPL approximate ephemeris, IAU rotation models, catalogue schema) is driven by Zustand stores and rendered by React Three Fiber using a floating origin: the Three.js camera stays at (0,0,0) and every object is placed at `bodyPosition − cameraPosition`, computed in float64. A Node pipeline (`pipeline/`) fetches JPL, NASA NSSDCA, NASA NAIF and NASA Science pages, validates them with Zod, and commits JSON to `public/data/`, measuring each planet's real error against committed JPL Horizons reference vectors.

**Tech Stack:** Node 24, TypeScript 7 (strict), Vite 8, React 19, three 0.186, @react-three/fiber 9, @react-three/drei 10, @react-three/postprocessing 3, Zustand 5, Zod 4, Vitest 5, Testing Library, Playwright 1.63, node-html-parser 9, tsx.

**Spec:** `Space_visualizer/Specs/2026-10-04-solar-system-visualizer-design.md` (vault note [[2026-10-04-solar-system-visualizer-design]]). Executors read both.

## Global Constraints

- Node ≥ 24; ESM everywhere (`"type": "module"`); TypeScript `strict: true`.
- Commands in this plan are written for Windows PowerShell (the dev machine). Use `curl.exe`, not the `curl` alias.
- `src/core/**` must not import `react`, `three`, `@react-three/*`, `zustand`, or anything under `src/state`, `src/scene`, `src/camera`, `src/ui`. Allowed library: `zod` (schemas only).
- Every fact shown to users comes from an official source and carries a `sourceId` that resolves in `public/data/sources.json`. The pipeline exits non-zero and writes nothing if any value lacks a resolvable source.
- No unofficial imagery. M1 draws plain colours, labelled "Illustrative colour — no official surface map in this release".
- Internal units: km, s, kg. Data stores angles in degrees exactly as the sources publish them; trigonometry converts with `DEG` from `src/core/math/angles.ts`.
- Simulation time is a float64 Julian Date in TDB (`jdTdb`). The UI displays UTC (UT before 1972). TDB ≈ TT (difference < 2 ms, ignored).
- World frame = heliocentric ecliptic J2000, km. Three.js world axes equal this frame (z = ecliptic north). The Three.js camera always sits at (0,0,0).
- Astronomical constants (exact values): AU = 149 597 870.7 km (IAU 2012 B2); c = 299 792.458 km/s; J2000 = JD 2451545.0 TDB; obliquity of J2000 ecliptic = 84381.448″ (IAU 1976, as used by JPL Horizons ecliptic frames).
- Planet model validity: Table 1 = JD 2378496.5 (1800-01-01) to 2470172.5 (2051-01-01); Table 2a/2b = JD 625673.5 (3000 BC = −2999-01-01, Julian calendar) to 2817152.5 (3001-01-01).
- Performance target: 60 fps on a mid-range laptop.
- Documentation lives in the Obsidian vault `Space_visualizer/`. Tasks that add data sources or architecture update vault notes in the same commit.
- Every commit message ends with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (pass it as a second `-m`).

## Review Focus

1. **Dates far outside every model range** (the date box accepts −4712 to 9999; playback can run into the clamps at JD 0 and year 10 000): planets must still render at finite positions, the time bar must say positions are extrapolated, playback must stop at the clamp, and nothing may become `NaN`. Pinned by tests in Task 7 (`planetApproxState` at JD 0 and year 10 000), Task 15 (time clamp) and Task 18 (warning text).
2. **Returning to a backgrounded tab / very high rates**: a single frame may report `delta` of many seconds; time must advance by at most `MAX_FRAME_DT_S` of real time per frame and reverse playback must work across the 1800/2050 table boundary. Pinned in Task 15 (`advance` clamp, reverse) and Task 14 (`validityStatus` at boundaries).
3. **Camera at degenerate poses**: looking straight down the ecliptic pole (elevation ±90°), zooming to the minimum distance, a transition whose start equals its end. No `NaN` camera matrices; the camera never ends up inside a body. Pinned in Task 17 (`lookRotation` parallel-up case, zoom clamp, `interpolatePose` identical poses).
4. **"Unknown" or missing source values** (NSSDCA lists giant-planet surface pressure as `Unknown*`): the field is omitted, never shown as `undefined`/`NaN`/empty row. Pinned in Task 10 (`parseFactCell`) and Task 19 (InfoPanel has no such text).
5. **Invalid date input** (`2026-02-30`, `1582-10-10` which never existed, `24:00`, garbage text): rejected with a readable message, simulation time unchanged. Pinned in Task 4 (`parseDateInput`) and Task 18 (TimeBar error).

## File Structure

```
package.json, tsconfig.json, vite.config.ts, playwright.config.ts, index.html
src/
  main.tsx, App.tsx                       app entry; screen selection (loading / error / no-WebGL / app)
  styles/tokens.css, styles/app.css       design tokens and layout
  test/setup.ts                           jest-dom matchers
  test/approxOrbits.ts                    JPL Table 1/2a/2b values for all 8 bodies (test data)
  test/fixtures.ts                        small real-data catalogue (Sun, Earth, Jupiter) for tests
  core/
    units.ts                              constants
    math/angles.ts, math/vec3.ts, math/mat3.ts
    time/julian.ts                        calendar <-> JD (mixed Julian/Gregorian)
    time/timescales.ts                    leap seconds, ΔT, UTC <-> TDB
    time/format.ts                        formatUtc, parseDateInput
    ephemeris/kepler.ts                   Kepler's equation (elliptic)
    ephemeris/conic.ts                    orbital plane -> ecliptic, orbit polylines
    ephemeris/types.ts                    BodyState
    ephemeris/planetApprox.ts             JPL approximate positions
    ephemeris/state.ts                    bodyState dispatch, validityStatus
    frames/rotation.ts                    IAU rotation model -> orientation matrices
    catalog/facts.ts                      fact keys, labels, units
    catalog/schema.ts                     Zod schemas + types for all data files
    catalog/references.ts                 sourceId resolution, issue formatting
    catalog/catalog.ts                    Catalog object
    regions/regionManager.ts              region opacity by camera distance
  state/
    timeStore.ts, selectionStore.ts, viewStore.ts, catalogStore.ts, loadCatalog.ts
  scene/
    frameState.ts, FrameStateContext.tsx, scaleMode.ts, threeMath.ts
    SceneRoot.tsx, FrameDriver.tsx, BodyMesh.tsx, BodyLabel.tsx, SunLight.tsx, OrbitLine.tsx, Effects.tsx
  camera/
    types.ts, rig.ts, transition.ts, orbitController.ts, followController.ts, input.ts, CameraSystem.tsx
  ui/
    format.ts, accuracy.ts, citations.ts, webgl.ts
    TopBar.tsx, TimeBar.tsx, InfoPanel.tsx, StatusScreens.tsx
pipeline/
  lib/fetchCached.ts, lib/html.ts
  sources/registry.ts, sources/jplApproxPos.ts, sources/nssdcFactSheet.ts, sources/naifPck.ts,
  sources/nasaScience.ts, sources/horizons.ts
  build/buildSolarSystem.ts, build/validate.ts
  scripts/fetchHorizonsReference.ts
  reference/horizons-heliocentric.json   committed Horizons reference vectors
  fixtures/                               committed copies of source pages for parser tests
  run.ts
public/data/regions.json, sources.json, solar-system/bodies.json   (generated, committed)
e2e/app.spec.ts
```

---

### Task 1: Project scaffold and constants

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/test/setup.ts`, `src/core/units.ts`
- Test: `src/core/units.test.ts`

**Interfaces:**
- Produces: `AU_KM`, `SPEED_OF_LIGHT_KM_S`, `SECONDS_PER_DAY`, `DAYS_PER_JULIAN_CENTURY`, `J2000_JD`, `OBLIQUITY_J2000_DEG` (all `number`) from `src/core/units.ts`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "solar-system-visualizer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit -p tsconfig.json && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "data": "tsx pipeline/run.ts",
    "data:offline": "tsx pipeline/run.ts --offline",
    "horizons:reference": "tsx pipeline/scripts/fetchHorizonsReference.ts"
  }
}
```

- [ ] **Step 2: Install dependencies**

```powershell
npm install react@19.3.0 react-dom@19.3.0 three@0.186.1 @react-three/fiber@9.8.1 @react-three/drei@10.7.9 @react-three/postprocessing@3.1.3 zustand@5.0.15 zod@4.6.5 @fontsource-variable/inter@5.3.0 @fontsource/jetbrains-mono@5.3.0
npm install -D typescript@7.0.2 vite@8.3.2 @vitejs/plugin-react@6.1.1 vitest@5.0.3 jsdom@30.1.2 @testing-library/react@16.3.3 @testing-library/user-event@14.6.7 @testing-library/jest-dom@7.0.1 @types/three@0.186.0 @types/react@19.3.0 @types/react-dom@19.3.0 @types/node@26.6.4 tsx@4.23.15 node-html-parser@9.0.4 @playwright/test@1.63.0
npx playwright install chromium
```

If npm reports a peer-dependency conflict (`ERESOLVE`), do not use `--force`. Install the newest versions that satisfy the peers, and record the versions you used and the reason in `Space_visualizer/Decisions/0001-stack-versions.md`.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "types": ["node", "vite/client"]
  },
  "include": ["src", "pipeline", "e2e", "vite.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'pipeline/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});
```

UI test files opt into the DOM with a first-line comment `// @vitest-environment jsdom`.

- [ ] **Step 5: Create `index.html`, `src/main.tsx`, `src/App.tsx`, `src/test/setup.ts`**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Solar System Visualizer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx` (replaced in Task 20):
```tsx
export function App() {
  return <h1>Solar System Visualizer</h1>;
}
```

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Write the failing test `src/core/units.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  AU_KM,
  DAYS_PER_JULIAN_CENTURY,
  J2000_JD,
  OBLIQUITY_J2000_DEG,
  SECONDS_PER_DAY,
  SPEED_OF_LIGHT_KM_S,
} from './units';

describe('units', () => {
  it('uses the IAU 2012 astronomical unit', () => {
    expect(AU_KM).toBe(149_597_870.7);
  });
  it('uses the SI speed of light', () => {
    expect(SPEED_OF_LIGHT_KM_S).toBe(299_792.458);
  });
  it('defines J2000, the Julian century and the day', () => {
    expect(J2000_JD).toBe(2_451_545.0);
    expect(DAYS_PER_JULIAN_CENTURY).toBe(36_525);
    expect(SECONDS_PER_DAY).toBe(86_400);
  });
  it('uses the IAU 1976 J2000 obliquity used by JPL Horizons ecliptic frames', () => {
    expect(OBLIQUITY_J2000_DEG).toBeCloseTo(23.4392911, 7);
  });
});
```

- [ ] **Step 7: Run it and confirm it fails**

Run: `npx vitest run src/core/units.test.ts`
Expected: FAIL, cannot resolve `./units`.

- [ ] **Step 8: Create `src/core/units.ts`**

```ts
/** Astronomical unit in km (IAU 2012 Resolution B2, exact). */
export const AU_KM = 149_597_870.7;
/** Speed of light in vacuum, km/s (SI, exact). */
export const SPEED_OF_LIGHT_KM_S = 299_792.458;
export const SECONDS_PER_DAY = 86_400;
export const DAYS_PER_JULIAN_CENTURY = 36_525;
/** J2000.0 epoch: 2000-01-01 12:00 TDB. */
export const J2000_JD = 2_451_545.0;
/** Obliquity of the J2000 ecliptic, 84381.448 arcsec (IAU 1976; JPL Horizons "Ecliptic of J2000.0"). */
export const OBLIQUITY_J2000_DEG = 84_381.448 / 3600;
```

- [ ] **Step 9: Run tests and the type checker**

Run: `npx vitest run src/core/units.test.ts` then `npm run typecheck`
Expected: 4 tests PASS; typecheck exits 0.

- [ ] **Step 10: Commit**

```powershell
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src
git commit -m "chore: scaffold Vite + React + TypeScript project with core constants" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Vector, matrix and angle math

**Files:**
- Create: `src/core/math/angles.ts`, `src/core/math/vec3.ts`, `src/core/math/mat3.ts`
- Test: `src/core/math/math.test.ts`

**Interfaces:**
- Produces (`angles.ts`): `DEG`, `RAD`, `ARCSEC` (`number`); `normalizeDeg360(deg): number` → [0, 360); `normalizeDeg180(deg): number` → (−180, 180]; `normalizeRadPi(rad): number` → [−π, π].
- Produces (`vec3.ts`): `type Vec3 = readonly [number, number, number]`; `ZERO`; `add`, `sub`, `scale`, `dot`, `cross`, `length`, `distance`, `normalize` (returns `ZERO` for zero length), `lerp(a,b,t)`, `angleBetween(a,b)` (radians), `slerpDirection(a,b,t)` (unit vectors in, unit vector out).
- Produces (`mat3.ts`): `type Mat3` (row-major 9-tuple); `IDENTITY`; `mul(a,b)`; `transpose(m)`; `apply(m,v): Vec3`; `rotX(theta)`, `rotZ(theta)` (passive frame rotations, radians); `fromColumns(x,y,z)`; `column(m, i): Vec3`.

- [ ] **Step 1: Write the failing tests `src/core/math/math.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { DEG, normalizeDeg180, normalizeDeg360, normalizeRadPi } from './angles';
import { add, angleBetween, cross, distance, dot, length, lerp, normalize, scale, slerpDirection, sub, ZERO, type Vec3 } from './vec3';
import { apply, column, fromColumns, IDENTITY, mul, rotX, rotZ, transpose } from './mat3';

const close = (a: Vec3, b: Vec3, digits = 12) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, digits));

describe('angles', () => {
  it('normalizes degrees', () => {
    expect(normalizeDeg360(-90)).toBe(270);
    expect(normalizeDeg360(720)).toBe(0);
    expect(normalizeDeg360(-0)).toBe(0);
    expect(normalizeDeg180(270)).toBe(-90);
    expect(normalizeDeg180(180)).toBe(180);
    expect(normalizeDeg180(-180)).toBe(180);
  });
  it('normalizes radians to [-pi, pi]', () => {
    expect(normalizeRadPi(2.5 * Math.PI)).toBeCloseTo(0.5 * Math.PI, 12);
    expect(normalizeRadPi(-1.5 * Math.PI)).toBeCloseTo(0.5 * Math.PI, 12);
    expect(normalizeRadPi(0.25)).toBe(0.25);
  });
});

describe('vec3', () => {
  it('does arithmetic', () => {
    expect(add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    expect(sub([4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3]);
    expect(scale([1, -2, 3], 2)).toEqual([2, -4, 6]);
    expect(dot([1, 0, 0], [0, 1, 0])).toBe(0);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(length([3, 4, 12])).toBe(13);
    expect(distance([1, 1, 1], [4, 5, 1])).toBe(5);
    expect(lerp([0, 0, 0], [10, 20, 30], 0.5)).toEqual([5, 10, 15]);
  });
  it('normalizes and handles zero length', () => {
    close(normalize([0, 3, 4]), [0, 0.6, 0.8]);
    expect(normalize(ZERO)).toEqual([0, 0, 0]);
  });
  it('measures angles robustly, including tiny ones', () => {
    expect(angleBetween([1, 0, 0], [0, 1, 0])).toBeCloseTo(Math.PI / 2, 12);
    expect(angleBetween([1, 0, 0], [1, 1e-9, 0])).toBeCloseTo(1e-9, 18);
  });
  it('slerps between directions, including opposite ones', () => {
    close(slerpDirection([1, 0, 0], [0, 1, 0], 0.5), [Math.SQRT1_2, Math.SQRT1_2, 0]);
    close(slerpDirection([1, 0, 0], [0, 1, 0], 0), [1, 0, 0]);
    close(slerpDirection([1, 0, 0], [0, 1, 0], 1), [0, 1, 0]);
    const mid = slerpDirection([1, 0, 0], [-1, 0, 0], 0.5);
    expect(length(mid)).toBeCloseTo(1, 12);
    expect(dot(mid, [1, 0, 0])).toBeCloseTo(0, 12);
  });
});

describe('mat3', () => {
  it('rotZ is a passive frame rotation', () => {
    close(apply(rotZ(90 * DEG), [1, 0, 0]), [0, -1, 0]);
  });
  it('rotX is a passive frame rotation', () => {
    close(apply(rotX(90 * DEG), [0, 1, 0]), [0, 0, -1]);
  });
  it('multiplies, transposes and builds from columns', () => {
    const r = mul(rotZ(0.3), rotX(0.7));
    const back = mul(r, transpose(r));
    back.forEach((v, i) => expect(v).toBeCloseTo(IDENTITY[i]!, 12));
    const m = fromColumns([1, 2, 3], [4, 5, 6], [7, 8, 9]);
    expect(column(m, 1)).toEqual([4, 5, 6]);
    expect(apply(m, [1, 0, 0])).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/core/math`
Expected: FAIL, modules not found.

- [ ] **Step 3: Create `src/core/math/angles.ts`**

```ts
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const ARCSEC = DEG / 3600;

/** Normalize to [0, 360). */
export function normalizeDeg360(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r + 0; // "+ 0" turns -0 into 0
}

/** Normalize to (-180, 180]. */
export function normalizeDeg180(deg: number): number {
  const r = normalizeDeg360(deg);
  return r > 180 ? r - 360 : r;
}

/** Normalize to [-pi, pi]. */
export function normalizeRadPi(rad: number): number {
  const twoPi = 2 * Math.PI;
  let r = rad % twoPi;
  if (r > Math.PI) r -= twoPi;
  else if (r < -Math.PI) r += twoPi;
  return r;
}
```

- [ ] **Step 4: Create `src/core/math/vec3.ts`**

```ts
export type Vec3 = readonly [number, number, number];

export const ZERO: Vec3 = [0, 0, 0];

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}
export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}
export function distance(a: Vec3, b: Vec3): number {
  return length(sub(a, b));
}
export function normalize(a: Vec3): Vec3 {
  const l = length(a);
  return l === 0 ? ZERO : scale(a, 1 / l);
}
export function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
/** Angle in radians; atan2 form stays accurate for tiny and near-pi angles. */
export function angleBetween(a: Vec3, b: Vec3): number {
  return Math.atan2(length(cross(a, b)), dot(a, b));
}
/** Spherical interpolation between unit vectors. */
export function slerpDirection(a: Vec3, b: Vec3, t: number): Vec3 {
  const angle = angleBetween(a, b);
  if (angle < 1e-9) return normalize(lerp(a, b, t));
  if (Math.PI - angle < 1e-6) {
    const axis = normalize(Math.abs(a[2]) < 0.9 ? cross(a, [0, 0, 1]) : cross(a, [1, 0, 0]));
    const theta = angle * t;
    return normalize(add(scale(a, Math.cos(theta)), scale(cross(axis, a), Math.sin(theta))));
  }
  const s = Math.sin(angle);
  return normalize(add(scale(a, Math.sin((1 - t) * angle) / s), scale(b, Math.sin(t * angle) / s)));
}
```

- [ ] **Step 5: Create `src/core/math/mat3.ts`**

```ts
import type { Vec3 } from './vec3';

/** Row-major 3x3 matrix. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mul(a: Mat3, b: Mat3): Mat3 {
  const r: number[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r.push(a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!);
    }
  }
  return r as unknown as Mat3;
}

export function transpose(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

export function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** Passive rotation of the coordinate frame about x by theta (radians). */
export function rotX(theta: number): Mat3 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [1, 0, 0, 0, c, s, 0, -s, c];
}

/** Passive rotation of the coordinate frame about z by theta (radians). */
export function rotZ(theta: number): Mat3 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [c, s, 0, -s, c, 0, 0, 0, 1];
}

export function fromColumns(x: Vec3, y: Vec3, z: Vec3): Mat3 {
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

export function column(m: Mat3, i: 0 | 1 | 2): Vec3 {
  return [m[i], m[3 + i], m[6 + i]];
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/core/math`
Expected: all PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/core/math
git commit -m "feat(core): add vector, matrix and angle math" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Calendar ↔ Julian Date

**Files:**
- Create: `src/core/time/julian.ts`
- Test: `src/core/time/julian.test.ts`

**Interfaces:**
- Produces: `interface CalendarDate { year: number; month: number; day: number; hour: number; minute: number; second: number }` (astronomical year numbering: 0 = 1 BC, −1 = 2 BC; Julian calendar before 1582-10-15, Gregorian from then on, matching JPL Horizons' "mixed" calendar); `calendarToJd(d: CalendarDate): number`; `jdToCalendar(jd: number): CalendarDate` (second rounded to the millisecond); `unixMsToJd(ms: number): number`; `jdToUnixMs(jd: number): number`.

Algorithm: Meeus, *Astronomical Algorithms* (2nd ed.), chapter 7.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { calendarToJd, jdToCalendar, jdToUnixMs, unixMsToJd, type CalendarDate } from './julian';

const d = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0): CalendarDate => ({
  year, month, day, hour, minute, second,
});

describe('calendarToJd', () => {
  it.each([
    [d(2000, 1, 1, 12), 2451545.0],
    [d(1957, 10, 4, 19, 26, 24), 2436116.31], // Meeus example 7.a
    [d(333, 1, 27, 12), 1842713.0], // Meeus example 7.b (Julian calendar)
    [d(1582, 10, 15), 2299160.5], // first Gregorian day
    [d(1582, 10, 4), 2299159.5], // last Julian day
    [d(-1000, 7, 12, 12), 1356001.0], // Meeus table 7
    [d(-4712, 1, 1, 12), 0.0],
    [d(1800, 1, 1), 2378496.5],
    [d(2051, 1, 1), 2470172.5],
    [d(-2999, 1, 1), 625673.5],
    [d(3001, 1, 1), 2817152.5],
  ])('%o -> %d', (date, jd) => {
    expect(calendarToJd(date)).toBeCloseTo(jd, 6);
  });
});

describe('jdToCalendar', () => {
  it('inverts known dates', () => {
    expect(jdToCalendar(2436116.31)).toEqual(d(1957, 10, 4, 19, 26, 24));
    expect(jdToCalendar(2299160.5)).toEqual(d(1582, 10, 15));
    expect(jdToCalendar(2299159.5)).toEqual(d(1582, 10, 4));
    expect(jdToCalendar(1356001.0)).toEqual(d(-1000, 7, 12, 12));
  });
  it('carries a time that rounds up to midnight into the next day (never 24:00:00)', () => {
    expect(jdToCalendar(2451544.5 - 0.0004 / 86_400)).toEqual(d(2000, 1, 1));
  });
  it('round-trips across the supported range to the millisecond', () => {
    for (let jd = 625673.5; jd < 2817152.5; jd += 7919.123456) {
      const back = calendarToJd(jdToCalendar(jd));
      expect(Math.abs(back - jd) * 86_400_000).toBeLessThan(1);
    }
  });
});

describe('unix time', () => {
  it('maps the Unix epoch to JD 2440587.5', () => {
    expect(unixMsToJd(0)).toBe(2440587.5);
    expect(jdToUnixMs(2440588.5)).toBe(86_400_000);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/core/time/julian.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Create `src/core/time/julian.ts`**

```ts
export interface CalendarDate {
  /** Astronomical year numbering: 0 = 1 BC, -1 = 2 BC. */
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const FIRST_GREGORIAN_DAY_NUMBER = 2299161; // floor(JD + 0.5) of 1582-10-15
const MS_PER_DAY = 86_400_000;
const UNIX_EPOCH_JD = 2440587.5;

function isGregorian(year: number, month: number, day: number): boolean {
  if (year !== 1582) return year > 1582;
  if (month !== 10) return month > 10;
  return day >= 15;
}

/** Meeus ch. 7. Julian calendar before 1582-10-15, Gregorian after (JPL Horizons "mixed" mode). */
export function calendarToJd(date: CalendarDate): number {
  let y = date.year;
  let m = date.month;
  const dayWithFraction = date.day + (date.hour + (date.minute + date.second / 60) / 60) / 24;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  let b = 0;
  if (isGregorian(date.year, date.month, date.day)) {
    const a = Math.floor(y / 100);
    b = 2 - a + Math.floor(a / 4);
  }
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + dayWithFraction + b - 1524.5;
}

/** Meeus ch. 7 inverse; the time of day is rounded to the nearest millisecond. */
export function jdToCalendar(jd: number): CalendarDate {
  let z = Math.floor(jd + 0.5);
  let ms = Math.round((jd + 0.5 - z) * MS_PER_DAY);
  if (ms >= MS_PER_DAY) {
    z += 1;
    ms -= MS_PER_DAY;
  }
  let a = z;
  if (z >= FIRST_GREGORIAN_DAY_NUMBER) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const dd = Math.floor(365.25 * c);
  const e = Math.floor((b - dd) / 30.6001);
  const day = b - dd - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return {
    year,
    month,
    day,
    hour: Math.floor(ms / 3_600_000),
    minute: Math.floor((ms % 3_600_000) / 60_000),
    second: (ms % 60_000) / 1000,
  };
}

export function unixMsToJd(ms: number): number {
  return ms / MS_PER_DAY + UNIX_EPOCH_JD;
}

export function jdToUnixMs(jd: number): number {
  return (jd - UNIX_EPOCH_JD) * MS_PER_DAY;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/core/time/julian.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/core/time/julian.ts src/core/time/julian.test.ts
git commit -m "feat(core): add calendar to Julian Date conversion" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Time scales, date formatting and date parsing

**Files:**
- Create: `src/core/time/timescales.ts`, `src/core/time/format.ts`
- Test: `src/core/time/timescales.test.ts`, `src/core/time/format.test.ts`

**Interfaces:**
- Consumes: `calendarToJd`, `jdToCalendar`, `CalendarDate` (Task 3); `SECONDS_PER_DAY` (Task 1).
- Produces (`timescales.ts`): `LEAP_SECONDS: ReadonlyArray<{ jdUtc: number; taiMinusUtc: number }>`; `FIRST_LEAP_SECOND_JD = 2441317.5`; `taiMinusUtc(jdUtc): number | null`; `decimalYear(jd): number`; `deltaT(year): number` (seconds, TT − UT); `ttMinusUtc(jdUtc): number`; `utcToTdb(jdUtc): number`; `tdbToUtc(jdTdb): number`.
- Produces (`format.ts`): `MIN_YEAR = -4712`, `MAX_YEAR = 9999`; `formatUtc(jdUtc: number): string`; `type DateParseResult = { ok: true; jdUtc: number } | { ok: false; error: string }`; `parseDateInput(text: string): DateParseResult`.

Sources: leap seconds from IERS `Leap_Second.dat` (https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat; checked 2026-10-04, last entry 2017-01-01 = 37 s). ΔT from NASA GSFC, Espenak & Meeus polynomial expressions (https://eclipse.gsfc.nasa.gov/SEhelp/deltatpoly2004.html), with y = year + (month − 0.5)/12.

- [ ] **Step 1: Write the failing tests `src/core/time/timescales.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { deltaT, LEAP_SECONDS, taiMinusUtc, tdbToUtc, ttMinusUtc, utcToTdb } from './timescales';

describe('leap seconds (IERS)', () => {
  it('has 28 entries ending at 37 s on 2017-01-01', () => {
    expect(LEAP_SECONDS).toHaveLength(28);
    expect(LEAP_SECONDS.at(-1)).toEqual({ jdUtc: 2457754.5, taiMinusUtc: 37 });
  });
  it('steps exactly at the leap second', () => {
    expect(taiMinusUtc(2457754.5)).toBe(37);
    expect(taiMinusUtc(2457754.4999)).toBe(36);
    expect(taiMinusUtc(2441317.5)).toBe(10);
    expect(taiMinusUtc(2441317.4)).toBeNull();
  });
});

describe('deltaT (NASA, Espenak & Meeus)', () => {
  it.each([
    [1800, 13.72],
    [1900, -2.79],
    [1950, 29.07],
    [2000, 63.86],
  ])('year %d -> %d s', (year, expected) => {
    expect(deltaT(year)).toBeCloseTo(expected, 2);
  });
  it('is continuous at 2150', () => {
    expect(deltaT(2149.999)).toBeCloseTo(deltaT(2150), 1);
  });
  it('stays finite far from the present', () => {
    expect(Number.isFinite(deltaT(-5000))).toBe(true);
    expect(Number.isFinite(deltaT(10000))).toBe(true);
  });
});

describe('UTC <-> TDB', () => {
  it('adds 32.184 s + TAI-UTC after 1972', () => {
    expect(ttMinusUtc(2461317.5)).toBeCloseTo(69.184, 9);
    expect(utcToTdb(2451545.0)).toBeCloseTo(2451545.0 + 64.184 / 86400, 10);
  });
  it('uses deltaT before 1972', () => {
    expect(ttMinusUtc(2415020.5)).toBeCloseTo(deltaT(1900 + 0.5 / 12), 6);
  });
  it.each([2415020.5, 2451545.0, 2457754.6, 2461317.5, 1356001.0])('round-trips %d', (jdUtc) => {
    expect(tdbToUtc(utcToTdb(jdUtc))).toBeCloseTo(jdUtc, 9);
  });
});
```

- [ ] **Step 2: Write the failing tests `src/core/time/format.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { calendarToJd } from './julian';
import { formatUtc, parseDateInput } from './format';

describe('formatUtc', () => {
  it('formats AD dates as UTC after 1972', () => {
    expect(formatUtc(2451545.0)).toBe('1 Jan 2000, 12:00:00 UTC');
  });
  it('labels pre-1972 times as UT and BC years', () => {
    expect(formatUtc(1356001.0)).toBe('12 Jul 1001 BC, 12:00:00 UT');
  });
  it('truncates fractional seconds', () => {
    expect(formatUtc(2451545.0 - 0.6 / 86400)).toBe('1 Jan 2000, 11:59:59 UTC');
  });
});

describe('parseDateInput', () => {
  it('accepts date and optional time', () => {
    expect(parseDateInput('2026-10-04')).toEqual({ ok: true, jdUtc: 2461317.5 });
    expect(parseDateInput(' 2026-10-04 08:40 ')).toEqual({
      ok: true,
      jdUtc: calendarToJd({ year: 2026, month: 10, day: 4, hour: 8, minute: 40, second: 0 }),
    });
    expect(parseDateInput('2026-10-04T08:40:30').ok).toBe(true);
  });
  it('accepts negative astronomical years', () => {
    expect(parseDateInput('-1000-07-12 12:00')).toEqual({ ok: true, jdUtc: 1356001.0 });
  });
  it.each([
    ['2026-02-30', 'That date does not exist in the calendar.'],
    ['1582-10-10', 'That date does not exist in the calendar.'],
    ['2026-13-01', 'That date does not exist in the calendar.'],
    ['2026-10-04 24:00', 'Time must be between 00:00:00 and 23:59:59.'],
    ['2026-10-04 12:60', 'Time must be between 00:00:00 and 23:59:59.'],
    ['-4713-01-01', 'Years from -4712 to 9999 are supported (negative = BC, 0 = 1 BC).'],
    ['10000-01-01', 'Years from -4712 to 9999 are supported (negative = BC, 0 = 1 BC).'],
    ['hello', 'Use YYYY-MM-DD or YYYY-MM-DD HH:MM[:SS]. Use negative years for BC (0 = 1 BC).'],
    ['', 'Use YYYY-MM-DD or YYYY-MM-DD HH:MM[:SS]. Use negative years for BC (0 = 1 BC).'],
  ])('rejects %s', (text, error) => {
    expect(parseDateInput(text)).toEqual({ ok: false, error });
  });
});
```

- [ ] **Step 3: Run and confirm failure**

Run: `npx vitest run src/core/time`
Expected: the two new files FAIL with module not found.

- [ ] **Step 4: Create `src/core/time/timescales.ts`**

```ts
import { SECONDS_PER_DAY } from '../units';
import { jdToCalendar } from './julian';

/**
 * TAI - UTC from IERS Bulletin C / Leap_Second.dat
 * (https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat, checked 2026-10-04).
 * Each entry applies from jdUtc (00:00 UTC) onwards.
 */
export const LEAP_SECONDS: ReadonlyArray<{ jdUtc: number; taiMinusUtc: number }> = [
  { jdUtc: 2441317.5, taiMinusUtc: 10 }, // 1972-01-01
  { jdUtc: 2441499.5, taiMinusUtc: 11 }, // 1972-07-01
  { jdUtc: 2441683.5, taiMinusUtc: 12 }, // 1973-01-01
  { jdUtc: 2442048.5, taiMinusUtc: 13 }, // 1974-01-01
  { jdUtc: 2442413.5, taiMinusUtc: 14 }, // 1975-01-01
  { jdUtc: 2442778.5, taiMinusUtc: 15 }, // 1976-01-01
  { jdUtc: 2443144.5, taiMinusUtc: 16 }, // 1977-01-01
  { jdUtc: 2443509.5, taiMinusUtc: 17 }, // 1978-01-01
  { jdUtc: 2443874.5, taiMinusUtc: 18 }, // 1979-01-01
  { jdUtc: 2444239.5, taiMinusUtc: 19 }, // 1980-01-01
  { jdUtc: 2444786.5, taiMinusUtc: 20 }, // 1981-07-01
  { jdUtc: 2445151.5, taiMinusUtc: 21 }, // 1982-07-01
  { jdUtc: 2445516.5, taiMinusUtc: 22 }, // 1983-07-01
  { jdUtc: 2446247.5, taiMinusUtc: 23 }, // 1985-07-01
  { jdUtc: 2447161.5, taiMinusUtc: 24 }, // 1988-01-01
  { jdUtc: 2447892.5, taiMinusUtc: 25 }, // 1990-01-01
  { jdUtc: 2448257.5, taiMinusUtc: 26 }, // 1991-01-01
  { jdUtc: 2448804.5, taiMinusUtc: 27 }, // 1992-07-01
  { jdUtc: 2449169.5, taiMinusUtc: 28 }, // 1993-07-01
  { jdUtc: 2449534.5, taiMinusUtc: 29 }, // 1994-07-01
  { jdUtc: 2450083.5, taiMinusUtc: 30 }, // 1996-01-01
  { jdUtc: 2450630.5, taiMinusUtc: 31 }, // 1997-07-01
  { jdUtc: 2451179.5, taiMinusUtc: 32 }, // 1999-01-01
  { jdUtc: 2453736.5, taiMinusUtc: 33 }, // 2006-01-01
  { jdUtc: 2454832.5, taiMinusUtc: 34 }, // 2009-01-01
  { jdUtc: 2456109.5, taiMinusUtc: 35 }, // 2012-07-01
  { jdUtc: 2457204.5, taiMinusUtc: 36 }, // 2015-07-01
  { jdUtc: 2457754.5, taiMinusUtc: 37 }, // 2017-01-01
];

export const FIRST_LEAP_SECOND_JD = 2441317.5;
const TT_MINUS_TAI = 32.184;

/** TAI - UTC in seconds, or null before 1972 (UTC as we know it did not exist). */
export function taiMinusUtc(jdUtc: number): number | null {
  if (jdUtc < FIRST_LEAP_SECOND_JD) return null;
  let value = LEAP_SECONDS[0]!.taiMinusUtc;
  for (const entry of LEAP_SECONDS) {
    if (jdUtc >= entry.jdUtc) value = entry.taiMinusUtc;
    else break;
  }
  return value;
}

/** NASA convention for deltaT: y = year + (month - 0.5) / 12. */
export function decimalYear(jd: number): number {
  const c = jdToCalendar(jd);
  return c.year + (c.month - 0.5) / 12;
}

/** TT - UT in seconds. NASA GSFC, Espenak & Meeus polynomial expressions (deltatpoly2004). */
export function deltaT(y: number): number {
  if (y < -500) {
    const u = (y - 1820) / 100;
    return -20 + 32 * u * u;
  }
  if (y < 500) {
    const u = y / 100;
    return 10583.6 - 1014.41 * u + 33.78311 * u ** 2 - 5.952053 * u ** 3 - 0.1798452 * u ** 4 + 0.022174192 * u ** 5 + 0.0090316521 * u ** 6;
  }
  if (y < 1600) {
    const u = (y - 1000) / 100;
    return 1574.2 - 556.01 * u + 71.23472 * u ** 2 + 0.319781 * u ** 3 - 0.8503463 * u ** 4 - 0.005050998 * u ** 5 + 0.0083572073 * u ** 6;
  }
  if (y < 1700) {
    const t = y - 1600;
    return 120 - 0.9808 * t - 0.01532 * t ** 2 + t ** 3 / 7129;
  }
  if (y < 1800) {
    const t = y - 1700;
    return 8.83 + 0.1603 * t - 0.0059285 * t ** 2 + 0.00013336 * t ** 3 - t ** 4 / 1174000;
  }
  if (y < 1860) {
    const t = y - 1800;
    return 13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3 - 0.00037436 * t ** 4 + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7;
  }
  if (y < 1900) {
    const t = y - 1860;
    return 7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233174;
  }
  if (y < 1920) {
    const t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (y < 1941) {
    const t = y - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  }
  if (y < 1961) {
    const t = y - 1950;
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  }
  if (y < 1986) {
    const t = y - 1975;
    return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  }
  if (y < 2005) {
    const t = y - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  if (y < 2050) {
    const t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t ** 2;
  }
  if (y < 2150) {
    return -20 + 32 * ((y - 1820) / 100) ** 2 - 0.5628 * (2150 - y);
  }
  const u = (y - 1820) / 100;
  return -20 + 32 * u * u;
}

/** TT - UTC in seconds (TT - UT via deltaT before 1972). */
export function ttMinusUtc(jdUtc: number): number {
  const tai = taiMinusUtc(jdUtc);
  return tai === null ? deltaT(decimalYear(jdUtc)) : tai + TT_MINUS_TAI;
}

/** UTC (or UT before 1972) -> TDB. TDB is taken equal to TT (|TDB - TT| < 2 ms). */
export function utcToTdb(jdUtc: number): number {
  return jdUtc + ttMinusUtc(jdUtc) / SECONDS_PER_DAY;
}

export function tdbToUtc(jdTdb: number): number {
  let utc = jdTdb - ttMinusUtc(jdTdb) / SECONDS_PER_DAY;
  utc = jdTdb - ttMinusUtc(utc) / SECONDS_PER_DAY;
  return utc;
}
```

- [ ] **Step 5: Create `src/core/time/format.ts`**

```ts
import { calendarToJd, jdToCalendar, type CalendarDate } from './julian';
import { FIRST_LEAP_SECOND_JD } from './timescales';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "4 Oct 2026, 08:40:40 UTC"; BC years as "1001 BC"; "UT" before 1972. */
export function formatUtc(jdUtc: number): string {
  const c = jdToCalendar(jdUtc);
  const year = c.year > 0 ? String(c.year) : `${1 - c.year} BC`;
  const scale = jdUtc >= FIRST_LEAP_SECOND_JD ? 'UTC' : 'UT';
  return `${c.day} ${MONTHS[c.month - 1]} ${year}, ${pad(c.hour)}:${pad(c.minute)}:${pad(Math.floor(c.second))} ${scale}`;
}

export type DateParseResult = { ok: true; jdUtc: number } | { ok: false; error: string };

/** Meeus' calendar algorithms are valid for JD >= 0 (-4712-01-01); 9999 keeps four-digit years. */
export const MIN_YEAR = -4712;
export const MAX_YEAR = 9999;
const FORMAT_ERROR = 'Use YYYY-MM-DD or YYYY-MM-DD HH:MM[:SS]. Use negative years for BC (0 = 1 BC).';
const PATTERN = /^\s*(-?\d{1,6})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?)?\s*$/;

export function parseDateInput(text: string): DateParseResult {
  const m = PATTERN.exec(text);
  if (!m) return { ok: false, error: FORMAT_ERROR };
  const date: CalendarDate = {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: m[4] === undefined ? 0 : Number(m[4]),
    minute: m[5] === undefined ? 0 : Number(m[5]),
    second: m[6] === undefined ? 0 : Number(m[6]),
  };
  if (date.year < MIN_YEAR || date.year > MAX_YEAR) {
    return { ok: false, error: `Years from ${MIN_YEAR} to ${MAX_YEAR} are supported (negative = BC, 0 = 1 BC).` };
  }
  if (date.hour > 23 || date.minute > 59 || date.second >= 60) {
    return { ok: false, error: 'Time must be between 00:00:00 and 23:59:59.' };
  }
  if (date.month < 1 || date.month > 12 || date.day < 1) {
    return { ok: false, error: 'That date does not exist in the calendar.' };
  }
  const midnight = calendarToJd({ ...date, hour: 0, minute: 0, second: 0 });
  const back = jdToCalendar(midnight);
  if (back.year !== date.year || back.month !== date.month || back.day !== date.day) {
    return { ok: false, error: 'That date does not exist in the calendar.' };
  }
  return { ok: true, jdUtc: calendarToJd(date) };
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/core/time`
Expected: all PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/core/time
git commit -m "feat(core): add leap seconds, deltaT, UTC/TDB conversion and date parsing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Kepler's equation and orbit geometry

**Files:**
- Create: `src/core/ephemeris/kepler.ts`, `src/core/ephemeris/conic.ts`
- Test: `src/core/ephemeris/kepler.test.ts`, `src/core/ephemeris/conic.test.ts`

**Interfaces:**
- Consumes: `normalizeRadPi`, `DEG` (Task 2); `Vec3` (Task 2).
- Produces (`kepler.ts`): `solveKeplerElliptic(meanAnomalyRad: number, e: number, tolerance?: number): number`. Returns eccentric anomaly in [−π, π] for the normalized mean anomaly. Throws `RangeError` unless 0 ≤ e < 1. Parabolic and hyperbolic orbits arrive in M3 with comets.
- Produces (`conic.ts`): `interface ConicElements { aKm: number; e: number; iRad: number; nodeRad: number; argPeriRad: number }`; `perifocalToEcliptic(el, xp, yp): Vec3`; `positionAtEccentricAnomaly(el, E): Vec3`; `orbitPolylineKm(el, startE, segments): Vec3[]` (`segments + 1` points, first equals last); `orbitNormal(el): Vec3`.

- [ ] **Step 1: Write the failing tests `src/core/ephemeris/kepler.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { DEG, normalizeRadPi } from '../math/angles';
import { solveKeplerElliptic } from './kepler';

describe('solveKeplerElliptic', () => {
  it('matches Meeus example 30.a (e = 0.1, M = 5 deg -> E = 5.554589 deg)', () => {
    expect(solveKeplerElliptic(5 * DEG, 0.1) / DEG).toBeCloseTo(5.554589, 6);
  });
  it('returns M for circular orbits', () => {
    expect(solveKeplerElliptic(1.234, 0)).toBeCloseTo(1.234, 14);
  });
  it.each([0.2, 0.5, 0.9, 0.99, 0.999999])('satisfies the equation for e = %d', (e) => {
    for (let m = -10; m <= 10; m += 0.37) {
      const E = solveKeplerElliptic(m, e);
      expect(Math.abs(E - e * Math.sin(E) - normalizeRadPi(m))).toBeLessThan(1e-10);
    }
  });
  it('rejects non-elliptic eccentricities', () => {
    expect(() => solveKeplerElliptic(1, 1)).toThrow(RangeError);
    expect(() => solveKeplerElliptic(1, -0.1)).toThrow(RangeError);
    expect(() => solveKeplerElliptic(1, Number.NaN)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Write the failing tests `src/core/ephemeris/conic.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { DEG } from '../math/angles';
import { length, type Vec3 } from '../math/vec3';
import { orbitNormal, orbitPolylineKm, positionAtEccentricAnomaly, type ConicElements } from './conic';

const close = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 6));
const circle = (over: Partial<ConicElements> = {}): ConicElements => ({
  aKm: 1000, e: 0, iRad: 0, nodeRad: 0, argPeriRad: 0, ...over,
});

describe('conic geometry', () => {
  it('places perihelion on +x for zero angles', () => {
    close(positionAtEccentricAnomaly(circle(), 0), [1000, 0, 0]);
  });
  it('rotates by the argument of perihelion', () => {
    close(positionAtEccentricAnomaly(circle({ argPeriRad: 90 * DEG }), 0), [0, 1000, 0]);
  });
  it('tilts by inclination about the node line', () => {
    close(positionAtEccentricAnomaly(circle({ iRad: 90 * DEG, argPeriRad: 90 * DEG }), 0), [0, 0, 1000]);
  });
  it('uses perihelion distance a(1 - e)', () => {
    expect(length(positionAtEccentricAnomaly(circle({ e: 0.5 }), 0))).toBeCloseTo(500, 9);
  });
  it('computes the orbit normal', () => {
    close(orbitNormal(circle()), [0, 0, 1]);
    close(orbitNormal(circle({ iRad: 90 * DEG })), [0, -1, 0]);
  });
  it('builds a closed polyline within perihelion and aphelion', () => {
    const el = circle({ e: 0.2, iRad: 0.3, nodeRad: 1, argPeriRad: 2 });
    const pts = orbitPolylineKm(el, 0.5, 64);
    expect(pts).toHaveLength(65);
    close(pts[0]!, pts[64]!);
    close(pts[0]!, positionAtEccentricAnomaly(el, 0.5));
    for (const p of pts) {
      expect(length(p)).toBeGreaterThanOrEqual(800 - 1e-6);
      expect(length(p)).toBeLessThanOrEqual(1200 + 1e-6);
    }
  });
});
```

- [ ] **Step 3: Run and confirm failure**

Run: `npx vitest run src/core/ephemeris`
Expected: FAIL, modules not found.

- [ ] **Step 4: Create `src/core/ephemeris/kepler.ts`**

```ts
import { normalizeRadPi } from '../math/angles';

/**
 * Solve M = E - e sin E for elliptic orbits (0 <= e < 1).
 * Newton iteration (start per JPL "Approximate Positions" note), falling back to bisection,
 * which always converges because E - M lies in [-e, e].
 * Returns E in [-pi, pi] for the normalized mean anomaly.
 */
export function solveKeplerElliptic(meanAnomalyRad: number, e: number, tolerance = 1e-12): number {
  if (!(e >= 0 && e < 1)) {
    throw new RangeError(`solveKeplerElliptic: eccentricity must be in [0, 1), got ${e}`);
  }
  const m = normalizeRadPi(meanAnomalyRad);
  let E = e < 0.8 ? m + e * Math.sin(m) : m < 0 ? -Math.PI : Math.PI;
  for (let i = 0; i < 50; i++) {
    const dE = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= dE;
    if (!Number.isFinite(E)) break;
    if (Math.abs(dE) < tolerance) return E;
  }
  let lo = m - e;
  let hi = m + e;
  for (let i = 0; i < 200 && hi - lo > tolerance; i++) {
    const mid = (lo + hi) / 2;
    if (mid - e * Math.sin(mid) - m > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
```

- [ ] **Step 5: Create `src/core/ephemeris/conic.ts`**

```ts
import type { Vec3 } from '../math/vec3';

export interface ConicElements {
  aKm: number;
  e: number;
  iRad: number;
  /** Longitude of the ascending node. */
  nodeRad: number;
  /** Argument of perihelion. */
  argPeriRad: number;
}

/** Rotate orbital-plane coordinates (x toward perihelion) into the ecliptic frame (JPL approx_pos formula). */
export function perifocalToEcliptic(el: ConicElements, xp: number, yp: number): Vec3 {
  const cw = Math.cos(el.argPeriRad);
  const sw = Math.sin(el.argPeriRad);
  const cO = Math.cos(el.nodeRad);
  const sO = Math.sin(el.nodeRad);
  const cI = Math.cos(el.iRad);
  const sI = Math.sin(el.iRad);
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ];
}

export function positionAtEccentricAnomaly(el: ConicElements, E: number): Vec3 {
  const xp = el.aKm * (Math.cos(E) - el.e);
  const yp = el.aKm * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  return perifocalToEcliptic(el, xp, yp);
}

/** Closed polyline of the ellipse starting at eccentric anomaly startE. */
export function orbitPolylineKm(el: ConicElements, startE: number, segments: number): Vec3[] {
  const points: Vec3[] = [];
  for (let k = 0; k <= segments; k++) {
    points.push(positionAtEccentricAnomaly(el, startE + (2 * Math.PI * k) / segments));
  }
  return points;
}

export function orbitNormal(el: ConicElements): Vec3 {
  return [Math.sin(el.iRad) * Math.sin(el.nodeRad), -Math.sin(el.iRad) * Math.cos(el.nodeRad), Math.cos(el.iRad)];
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/core/ephemeris`
Expected: all PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/core/ephemeris
git commit -m "feat(core): add Kepler solver and conic orbit geometry" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Catalogue schema, fact definitions and source references

**Files:**
- Create: `src/core/catalog/facts.ts`, `src/core/catalog/schema.ts`, `src/core/catalog/references.ts`, `src/test/approxOrbits.ts`, `src/test/fixtures.ts`
- Test: `src/core/catalog/schema.test.ts`

**Interfaces:**
- Produces (`facts.ts`): `FACT_KEYS` (readonly tuple, display order); `type FactKey`; `type FactGroup = 'physical' | 'orbit'`; `FACT_DEFS: Record<FactKey, { label: string; unit: string; group: FactGroup }>`.
- Produces (`schema.ts`): Zod schemas `SourceSchema`, `SourcedValueSchema`, `ApproxTableSchema`, `PlanetApproxOrbitSchema`, `FixedOrbitSchema`, `OrbitSchema`, `RotationModelSchema`, `BodySchema`, `RegionSchema`, `RegionsFileSchema`, `SourcesFileSchema`, `BodiesFileSchema`, `BODY_CATEGORIES`; types `Source`, `SourcedValue`, `ApproxTable`, `PlanetApproxOrbit`, `FixedOrbit`, `Orbit`, `RotationModel`, `Body`, `BodyCategory`, `Region`, `RegionsFile`, `SourcesFile`, `BodiesFile`.
- Produces (`references.ts`): `collectSourceIds(value: unknown): Array<{ path: string; sourceId: string }>`; `findUnresolvedSources(value: unknown, known: ReadonlySet<string>): string[]`; `formatIssues(prefix: string, error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> }): string[]`.
- Produces (test data): `src/test/approxOrbits.ts` exports `TABLE1_RANGE`, `TABLE2_RANGE`, `APPROX_ORBITS: Record<ApproxBodyKey, PlanetApproxOrbit>`, `type ApproxBodyKey = 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune'`. `src/test/fixtures.ts` exports `TEST_SOURCES`, `makeSun()`, `makeEarth()`, `makeJupiter()`, `makeCatalogFiles(): { regions: RegionsFile; sources: SourcesFile; bodies: BodiesFile }` (bodies in order sun, earth, jupiter).

- [ ] **Step 1: Create `src/core/catalog/facts.ts`**

```ts
export const FACT_KEYS = [
  'massKg',
  'equatorialDiameterKm',
  'meanRadiusKm',
  'densityKgM3',
  'surfaceGravityMS2',
  'escapeVelocityKmS',
  'siderealRotationHours',
  'lengthOfDayHours',
  'obliquityDeg',
  'meanTemperatureC',
  'surfacePressureBar',
  'moonCount',
  'hasRingSystem',
  'hasGlobalMagneticField',
  'luminosityW',
  'spectralType',
  'absoluteMagnitude',
  'semiMajorAxisAu',
  'meanDistanceFromSunKm',
  'perihelionKm',
  'aphelionKm',
  'orbitalPeriodDays',
  'meanOrbitalVelocityKmS',
  'orbitalInclinationDeg',
  'orbitalEccentricity',
] as const;

export type FactKey = (typeof FACT_KEYS)[number];
export type FactGroup = 'physical' | 'orbit';

export const FACT_DEFS: Record<FactKey, { label: string; unit: string; group: FactGroup }> = {
  massKg: { label: 'Mass', unit: 'kg', group: 'physical' },
  equatorialDiameterKm: { label: 'Equatorial diameter', unit: 'km', group: 'physical' },
  meanRadiusKm: { label: 'Mean radius', unit: 'km', group: 'physical' },
  densityKgM3: { label: 'Mean density', unit: 'kg/m³', group: 'physical' },
  surfaceGravityMS2: { label: 'Surface gravity', unit: 'm/s²', group: 'physical' },
  escapeVelocityKmS: { label: 'Escape velocity', unit: 'km/s', group: 'physical' },
  siderealRotationHours: { label: 'Sidereal rotation period', unit: 'h', group: 'physical' },
  lengthOfDayHours: { label: 'Length of day', unit: 'h', group: 'physical' },
  obliquityDeg: { label: 'Axial tilt (obliquity)', unit: '°', group: 'physical' },
  meanTemperatureC: { label: 'Mean temperature', unit: '°C', group: 'physical' },
  surfacePressureBar: { label: 'Surface pressure', unit: 'bar', group: 'physical' },
  moonCount: { label: 'Number of moons', unit: '', group: 'physical' },
  hasRingSystem: { label: 'Ring system', unit: '', group: 'physical' },
  hasGlobalMagneticField: { label: 'Global magnetic field', unit: '', group: 'physical' },
  luminosityW: { label: 'Luminosity', unit: 'W', group: 'physical' },
  spectralType: { label: 'Spectral type', unit: '', group: 'physical' },
  absoluteMagnitude: { label: 'Absolute magnitude', unit: '', group: 'physical' },
  semiMajorAxisAu: { label: 'Semi-major axis (J2000)', unit: 'AU', group: 'orbit' },
  meanDistanceFromSunKm: { label: 'Mean distance from Sun', unit: 'km', group: 'orbit' },
  perihelionKm: { label: 'Perihelion', unit: 'km', group: 'orbit' },
  aphelionKm: { label: 'Aphelion', unit: 'km', group: 'orbit' },
  orbitalPeriodDays: { label: 'Orbital period', unit: 'days', group: 'orbit' },
  meanOrbitalVelocityKmS: { label: 'Mean orbital velocity', unit: 'km/s', group: 'orbit' },
  orbitalInclinationDeg: { label: 'Orbital inclination', unit: '°', group: 'orbit' },
  orbitalEccentricity: { label: 'Orbital eccentricity', unit: '', group: 'orbit' },
};
```

- [ ] **Step 2: Create `src/test/approxOrbits.ts` (values copied from https://ssd.jpl.nasa.gov/planets/approx_pos.html Tables 1, 2a, 2b and the accuracy table)**

```ts
import type { PlanetApproxOrbit } from '../core/catalog/schema';

export const TABLE1_RANGE = { from: 2378496.5, to: 2470172.5 } as const; // 1800-01-01 .. 2051-01-01
export const TABLE2_RANGE = { from: 625673.5, to: 2817152.5 } as const; // 3000 BC .. 3001-01-01

type Row = readonly [number, number, number, number, number, number];
type Err = readonly [number, number, number]; // arcsec, arcsec, 1000 km
type Extra = { b: number; c: number; s: number; f: number };

const kepler = (r: Row) => ({ a: r[0], e: r[1], I: r[2], L: r[3], varpi: r[4], Omega: r[5] });
const err = (e: Err) => ({ longitudeArcsec: e[0], latitudeArcsec: e[1], distanceKm: e[2] * 1000 });

function orbit(
  t1: [Row, Row],
  t2: [Row, Row],
  e1: Err,
  e2: Err,
  extra?: Extra,
  represents: PlanetApproxOrbit['represents'] = 'planet',
): PlanetApproxOrbit {
  return {
    type: 'planet-approx',
    sourceId: 'jpl-approx-pos',
    represents,
    tables: [
      { id: '1800-2050', validFromJdTdb: TABLE1_RANGE.from, validToJdTdb: TABLE1_RANGE.to, elements: kepler(t1[0]), ratesPerCentury: kepler(t1[1]), nominalError: err(e1) },
      { id: '3000BC-3000AD', validFromJdTdb: TABLE2_RANGE.from, validToJdTdb: TABLE2_RANGE.to, elements: kepler(t2[0]), ratesPerCentury: kepler(t2[1]), nominalError: err(e2), ...(extra ? { extraTerms: extra } : {}) },
    ],
  };
}

export const APPROX_ORBITS = {
  mercury: orbit(
    [[0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
    [[0.38709843, 0.20563661, 7.00559432, 252.25166724, 77.45771895, 48.33961819], [0.0, 0.00002123, -0.00590158, 149472.67486623, 0.15940013, -0.12214182]],
    [15, 1, 1], [20, 15, 1],
  ),
  venus: orbit(
    [[0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418]],
    [[0.72332102, 0.00676399, 3.39777545, 181.9797085, 131.76755713, 76.67261496], [-0.00000026, -0.00005107, 0.00043494, 58517.8156026, 0.05679648, -0.27274174]],
    [20, 1, 4], [40, 30, 8],
  ),
  earth: orbit(
    [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
    [[1.00000018, 0.01673163, -0.00054346, 100.46691572, 102.93005885, -5.11260389], [-0.00000003, -0.00003661, -0.01337178, 35999.37306329, 0.3179526, -0.24123856]],
    [20, 8, 6], [40, 15, 15], undefined, 'earth-moon-barycenter',
  ),
  mars: orbit(
    [[1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
    [[1.52371243, 0.09336511, 1.85181869, -4.56813164, -23.91744784, 49.71320984], [0.00000097, 0.00009149, -0.00724757, 19140.29934243, 0.45223625, -0.26852431]],
    [40, 2, 25], [100, 40, 30],
  ),
  jupiter: orbit(
    [[5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
    [[5.20248019, 0.0485359, 1.29861416, 34.33479152, 14.27495244, 100.29282654], [-0.00002864, 0.00018026, -0.00322699, 3034.90371757, 0.18199196, 0.13024619]],
    [400, 10, 600], [600, 100, 1000], { b: -0.00012452, c: 0.0606406, s: -0.35635438, f: 38.35125 },
  ),
  saturn: orbit(
    [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
    [[9.54149883, 0.05550825, 2.49424102, 50.07571329, 92.86136063, 113.63998702], [-0.00003065, -0.00032044, 0.00451969, 1222.11494724, 0.54179478, -0.25015002]],
    [600, 25, 1500], [1000, 100, 4000], { b: 0.00025899, c: -0.13434469, s: 0.87320147, f: 38.35125 },
  ),
  uranus: orbit(
    [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503], [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
    [[19.18797948, 0.0468574, 0.77298127, 314.20276625, 172.43404441, 73.96250215], [-0.00020455, -0.0000155, -0.00180155, 428.49512595, 0.09266985, 0.05739699]],
    [50, 2, 1000], [2000, 30, 8000], { b: 0.00058331, c: -0.97731848, s: 0.17689245, f: 7.67025 },
  ),
  neptune: orbit(
    [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
    [[30.06952752, 0.00895439, 1.7700552, 304.22289287, 46.68158724, 131.78635853], [0.00006447, 0.00000818, 0.000224, 218.46515314, 0.01009938, -0.00606302]],
    [10, 1, 200], [400, 15, 4000], { b: -0.00041348, c: 0.68346318, s: -0.10162547, f: 7.67025 },
  ),
} satisfies Record<string, PlanetApproxOrbit>;

export type ApproxBodyKey = keyof typeof APPROX_ORBITS;
```

- [ ] **Step 3: Create `src/test/fixtures.ts`** (real values from the NSSDCA fact sheets, NAIF PCK00011 and NASA Science; Jupiter's tiny periodic rotation terms are omitted to keep the fixture short)

```ts
import type { Body, BodiesFile, RegionsFile, Source, SourcesFile } from '../core/catalog/schema';
import { APPROX_ORBITS } from './approxOrbits';

export const TEST_SOURCES: Source[] = [
  { id: 'jpl-approx-pos', title: 'Approximate Positions of the Planets', publisher: 'NASA/JPL Solar System Dynamics', url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html', retrievedAt: '2026-10-04', license: 'NASA/JPL public web content (JPL Image Use Policy)' },
  { id: 'jpl-horizons', title: 'Horizons System reference vectors', publisher: 'NASA/JPL Solar System Dynamics', url: 'https://ssd.jpl.nasa.gov/horizons/', retrievedAt: '2026-10-04', license: 'NASA/JPL public web content (JPL Image Use Policy)' },
  { id: 'nssdca-planetary-fact-sheet', title: 'Planetary Fact Sheet - Metric', publisher: 'NASA Goddard Space Flight Center, NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/', retrievedAt: '2026-10-04', license: 'NASA public domain' },
  { id: 'nssdca-sun-fact-sheet', title: 'Sun Fact Sheet', publisher: 'NASA Goddard Space Flight Center, NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html', retrievedAt: '2026-10-04', license: 'NASA public domain' },
  { id: 'naif-pck00011', title: 'PCK00011 planetary constants kernel (IAU WGCCRE 2015 report values)', publisher: 'NASA/JPL Navigation and Ancillary Information Facility (NAIF)', url: 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc', retrievedAt: '2026-10-04', license: 'NASA public domain' },
  { id: 'nasa-science-sun', title: 'The Sun - NASA Science', publisher: 'NASA', url: 'https://science.nasa.gov/sun/', retrievedAt: '2026-10-04', license: 'NASA public domain (NASA media usage guidelines)' },
  { id: 'nasa-science-earth', title: 'Earth Facts - NASA Science', publisher: 'NASA', url: 'https://science.nasa.gov/earth/facts/', retrievedAt: '2026-10-04', license: 'NASA public domain (NASA media usage guidelines)' },
  { id: 'nasa-science-jupiter', title: 'Jupiter - NASA Science', publisher: 'NASA', url: 'https://science.nasa.gov/jupiter/', retrievedAt: '2026-10-04', license: 'NASA public domain (NASA media usage guidelines)' },
];

const PS = 'nssdca-planetary-fact-sheet';

export function makeSun(): Body {
  return {
    id: 'sun', name: 'Sun', category: 'star', parentId: null, regionId: 'solar-system', naifId: 10,
    facts: {
      massKg: { value: 1.9884e30, sourceId: 'nssdca-sun-fact-sheet' },
      meanRadiusKm: { value: 695700, sourceId: 'nssdca-sun-fact-sheet' },
      densityKgM3: { value: 1408, sourceId: 'nssdca-sun-fact-sheet' },
      surfaceGravityMS2: { value: 274, sourceId: 'nssdca-sun-fact-sheet' },
      siderealRotationHours: { value: 609.12, note: 'Adopted period at 16° latitude; the Sun rotates faster at its equator than near its poles.', sourceId: 'nssdca-sun-fact-sheet' },
      spectralType: { value: 'G2 V', sourceId: 'nssdca-sun-fact-sheet' },
    },
    orbit: { type: 'fixed', positionKm: [0, 0, 0], note: 'The Sun is the origin of the heliocentric frame used for all positions.' },
    rotation: { sourceId: 'naif-pck00011', poleRa: [286.13, 0, 0], poleDec: [63.87, 0, 0], pm: [84.176, 14.1844, 0], nutPrecRa: [], nutPrecDec: [], nutPrecPm: [], nutPrecAngles: [] },
    shape: { equatorialRadiusKm: 695700, polarRadiusKm: 695700, sourceId: 'naif-pck00011' },
    description: { text: 'The Sun is the star at the heart of our solar system. Its gravity holds the solar system together, keeping everything – from the biggest planets to the smallest bits of debris – in its orbit.', sourceId: 'nasa-science-sun' },
    texture: null,
    display: { color: '#ffd27a', note: 'illustrative' },
  };
}

export function makeEarth(): Body {
  return {
    id: 'earth', name: 'Earth', category: 'planet', parentId: 'sun', regionId: 'solar-system', naifId: 399,
    facts: {
      massKg: { value: 5.97e24, sourceId: PS },
      equatorialDiameterKm: { value: 12756, sourceId: PS },
      obliquityDeg: { value: 23.4, sourceId: PS },
      surfacePressureBar: { value: 1, sourceId: PS },
      semiMajorAxisAu: { value: 1.00000261, sourceId: 'jpl-approx-pos' },
    },
    orbit: structuredClone(APPROX_ORBITS.earth),
    rotation: { sourceId: 'naif-pck00011', poleRa: [0, -0.641, 0], poleDec: [90, -0.557, 0], pm: [190.147, 360.9856235, 0], nutPrecRa: [], nutPrecDec: [], nutPrecPm: [], nutPrecAngles: [] },
    shape: { equatorialRadiusKm: 6378.1366, polarRadiusKm: 6356.7519, sourceId: 'naif-pck00011' },
    description: { text: "Earth is the third planet from the Sun, and the fifth largest planet. It's the only place we know of inhabited by living things.", sourceId: 'nasa-science-earth' },
    texture: null,
    display: { color: '#4c7bd0', note: 'illustrative' },
  };
}

export function makeJupiter(): Body {
  const orbit = structuredClone(APPROX_ORBITS.jupiter);
  // Test-only values (shape matches what the pipeline emits; not shown to users).
  orbit.tables[0]!.horizonsCheck = { sampleCount: 6, maxAngularErrorArcsec: 310, maxDistanceErrorKm: 552000, sourceId: 'jpl-horizons' };
  return {
    id: 'jupiter', name: 'Jupiter', category: 'planet', parentId: 'sun', regionId: 'solar-system', naifId: 599,
    facts: {
      massKg: { value: 1.898e27, sourceId: PS },
      equatorialDiameterKm: { value: 142984, sourceId: PS },
      densityKgM3: { value: 1326, sourceId: PS },
      surfaceGravityMS2: { value: 23.1, sourceId: PS },
      escapeVelocityKmS: { value: 59.5, sourceId: PS },
      siderealRotationHours: { value: 9.9, sourceId: PS },
      obliquityDeg: { value: 3.1, sourceId: PS },
      meanTemperatureC: { value: -110, sourceId: PS },
      moonCount: { value: 95, sourceId: PS },
      hasRingSystem: { value: true, sourceId: PS },
      semiMajorAxisAu: { value: 5.202887, sourceId: 'jpl-approx-pos' },
      orbitalPeriodDays: { value: 4331, sourceId: PS },
      orbitalEccentricity: { value: 0.049, sourceId: PS },
    },
    orbit,
    rotation: { sourceId: 'naif-pck00011', poleRa: [268.056595, -0.006499, 0], poleDec: [64.495303, 0.002413, 0], pm: [284.95, 870.536, 0], nutPrecRa: [], nutPrecDec: [], nutPrecPm: [], nutPrecAngles: [] },
    shape: { equatorialRadiusKm: 71492, polarRadiusKm: 66854, sourceId: 'naif-pck00011' },
    description: { text: 'Jupiter is the fifth planet from the Sun, and the largest in the solar system – more than twice as massive as the other planets combined.', sourceId: 'nasa-science-jupiter' },
    texture: null,
    display: { color: '#d6b48a', note: 'illustrative' },
  };
}

export function makeCatalogFiles(): { regions: RegionsFile; sources: SourcesFile; bodies: BodiesFile } {
  return {
    regions: {
      schemaVersion: 1,
      regions: [{ id: 'solar-system', name: 'Solar System', parentId: null, frame: 'heliocentric-ecliptic-j2000', unit: 'km', originInParentKm: [0, 0, 0], activeRangeKm: [0, 1e13], dataManifest: 'solar-system/bodies.json' }],
    },
    sources: { schemaVersion: 1, sources: structuredClone(TEST_SOURCES) },
    bodies: { schemaVersion: 1, regionId: 'solar-system', generatedAt: '2026-10-04T12:00:00.000Z', bodies: [makeSun(), makeEarth(), makeJupiter()] },
  };
}
```

- [ ] **Step 4: Write the failing tests `src/core/catalog/schema.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeCatalogFiles } from '../../test/fixtures';
import { BodiesFileSchema, RegionsFileSchema, SourcesFileSchema } from './schema';
import { collectSourceIds, findUnresolvedSources, formatIssues } from './references';

describe('catalogue schema', () => {
  it('accepts the fixture catalogue', () => {
    const files = makeCatalogFiles();
    expect(RegionsFileSchema.safeParse(files.regions).success).toBe(true);
    expect(SourcesFileSchema.safeParse(files.sources).success).toBe(true);
    const parsed = BodiesFileSchema.safeParse(files.bodies);
    if (!parsed.success) throw new Error(formatIssues('bodies.json', parsed.error).join('\n'));
  });

  it('rejects a fact without a sourceId and names the field path', () => {
    const files = makeCatalogFiles();
    delete (files.bodies.bodies[2]!.facts.massKg as { sourceId?: string }).sourceId;
    const parsed = BodiesFileSchema.safeParse(files.bodies);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(formatIssues('bodies.json', parsed.error).join('\n')).toContain('bodies.json: bodies.2.facts.massKg.sourceId');
    }
  });

  it('rejects non-finite numbers, bad eccentricity and unknown categories', () => {
    const nan = makeCatalogFiles();
    nan.bodies.bodies[2]!.facts.massKg!.value = Number.NaN;
    expect(BodiesFileSchema.safeParse(nan.bodies).success).toBe(false);

    const ecc = makeCatalogFiles();
    const orbit = ecc.bodies.bodies[2]!.orbit;
    if (orbit.type !== 'planet-approx') throw new Error('fixture changed');
    orbit.tables[0]!.elements.e = 1.2;
    expect(BodiesFileSchema.safeParse(ecc.bodies).success).toBe(false);

    const cat = makeCatalogFiles();
    (cat.bodies.bodies[2] as { category: string }).category = 'blob';
    expect(BodiesFileSchema.safeParse(cat.bodies).success).toBe(false);
  });
});

describe('source references', () => {
  it('collects every sourceId with its path', () => {
    const refs = collectSourceIds({ a: { sourceId: 'x' }, list: [{ sourceId: 'y' }] });
    expect(refs).toEqual([
      { path: 'a.sourceId', sourceId: 'x' },
      { path: 'list.0.sourceId', sourceId: 'y' },
    ]);
  });

  it('reports unresolved sources in the fixture when a source is removed', () => {
    const files = makeCatalogFiles();
    const known = new Set(files.sources.sources.map((s) => s.id));
    expect(findUnresolvedSources(files.bodies, known)).toEqual([]);
    known.delete('nasa-science-jupiter');
    expect(findUnresolvedSources(files.bodies, known)).toEqual([
      'bodies.2.description.sourceId: unknown sourceId "nasa-science-jupiter"',
    ]);
  });
});
```

- [ ] **Step 5: Run and confirm failure**

Run: `npx vitest run src/core/catalog`
Expected: FAIL, cannot resolve `./schema`.

- [ ] **Step 6: Create `src/core/catalog/schema.ts`**

```ts
import { z } from 'zod';
import { FACT_KEYS } from './facts';

const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
const Poly3Schema = z.tuple([z.number(), z.number(), z.number()]);
const SourceIdSchema = z.string().min(1);
const finite = (n: number) => Number.isFinite(n);

export const SourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.url(),
  retrievedAt: z.iso.date(),
  license: z.string().min(1),
});

export const SourcedValueSchema = z
  .object({
    value: z.union([z.number(), z.string().min(1), z.boolean()]),
    unit: z.string().optional(),
    uncertainty: z.number().nonnegative().optional(),
    note: z.string().min(1).optional(),
    sourceId: SourceIdSchema,
  })
  .refine((v) => typeof v.value !== 'number' || finite(v.value), { message: 'value must be a finite number' });

const KeplerSetSchema = z.object({
  a: z.number(),
  e: z.number(),
  I: z.number(),
  L: z.number(),
  varpi: z.number(),
  Omega: z.number(),
});

const ErrorFigureSchema = z.object({
  longitudeArcsec: z.number().nonnegative(),
  latitudeArcsec: z.number().nonnegative(),
  distanceKm: z.number().nonnegative(),
});

export const ApproxTableSchema = z
  .object({
    id: z.enum(['1800-2050', '3000BC-3000AD']),
    validFromJdTdb: z.number(),
    validToJdTdb: z.number(),
    elements: KeplerSetSchema,
    ratesPerCentury: KeplerSetSchema,
    extraTerms: z.object({ b: z.number(), c: z.number(), s: z.number(), f: z.number() }).optional(),
    nominalError: ErrorFigureSchema,
    horizonsCheck: z
      .object({
        sampleCount: z.number().int().positive(),
        maxAngularErrorArcsec: z.number().nonnegative(),
        maxDistanceErrorKm: z.number().nonnegative(),
        sourceId: SourceIdSchema,
      })
      .optional(),
  })
  .refine((t) => t.validFromJdTdb < t.validToJdTdb, { message: 'validFromJdTdb must precede validToJdTdb' })
  .refine((t) => t.elements.a > 0 && t.elements.e >= 0 && t.elements.e < 1, { message: 'elements out of range (need a > 0, 0 <= e < 1)' });

export const PlanetApproxOrbitSchema = z.object({
  type: z.literal('planet-approx'),
  sourceId: SourceIdSchema,
  represents: z.enum(['planet', 'earth-moon-barycenter']),
  tables: z.array(ApproxTableSchema).min(1),
});

export const FixedOrbitSchema = z.object({
  type: z.literal('fixed'),
  positionKm: Vec3Schema,
  note: z.string().min(1),
});

export const OrbitSchema = z.discriminatedUnion('type', [PlanetApproxOrbitSchema, FixedOrbitSchema]);

export const RotationModelSchema = z.object({
  sourceId: SourceIdSchema,
  poleRa: Poly3Schema,
  poleDec: Poly3Schema,
  pm: Poly3Schema,
  nutPrecRa: z.array(z.number()),
  nutPrecDec: z.array(z.number()),
  nutPrecPm: z.array(z.number()),
  nutPrecAngles: z.array(Poly3Schema),
});

export const BODY_CATEGORIES = ['star', 'planet', 'dwarf-planet', 'moon', 'asteroid', 'comet', 'spacecraft'] as const;

export const BodySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  category: z.enum(BODY_CATEGORIES),
  parentId: z.string().nullable(),
  regionId: z.string().min(1),
  naifId: z.number().int(),
  facts: z.partialRecord(z.enum(FACT_KEYS), SourcedValueSchema),
  orbit: OrbitSchema,
  rotation: RotationModelSchema.nullable(),
  shape: z.object({
    equatorialRadiusKm: z.number().positive(),
    polarRadiusKm: z.number().positive(),
    sourceId: SourceIdSchema,
  }),
  description: z.object({ text: z.string().min(1), sourceId: SourceIdSchema }).nullable(),
  texture: z.object({ url: z.string().min(1), sourceId: SourceIdSchema }).nullable(),
  display: z.object({ color: z.string().regex(/^#[0-9a-f]{6}$/i), note: z.literal('illustrative') }),
});

export const RegionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  parentId: z.string().nullable(),
  frame: z.enum(['heliocentric-ecliptic-j2000']),
  unit: z.enum(['km']),
  originInParentKm: Vec3Schema,
  activeRangeKm: z.tuple([z.number().nonnegative(), z.number().positive()]),
  dataManifest: z.string().min(1),
});

export const RegionsFileSchema = z.object({ schemaVersion: z.literal(1), regions: z.array(RegionSchema).min(1) });
export const SourcesFileSchema = z.object({ schemaVersion: z.literal(1), sources: z.array(SourceSchema).min(1) });
export const BodiesFileSchema = z.object({
  schemaVersion: z.literal(1),
  regionId: z.string().min(1),
  generatedAt: z.iso.datetime(),
  bodies: z.array(BodySchema).min(1),
});

export type Source = z.infer<typeof SourceSchema>;
export type SourcedValue = z.infer<typeof SourcedValueSchema>;
export type ApproxTable = z.infer<typeof ApproxTableSchema>;
export type PlanetApproxOrbit = z.infer<typeof PlanetApproxOrbitSchema>;
export type FixedOrbit = z.infer<typeof FixedOrbitSchema>;
export type Orbit = z.infer<typeof OrbitSchema>;
export type RotationModel = z.infer<typeof RotationModelSchema>;
export type Body = z.infer<typeof BodySchema>;
export type BodyCategory = Body['category'];
export type Region = z.infer<typeof RegionSchema>;
export type RegionsFile = z.infer<typeof RegionsFileSchema>;
export type SourcesFile = z.infer<typeof SourcesFileSchema>;
export type BodiesFile = z.infer<typeof BodiesFileSchema>;
```

- [ ] **Step 7: Create `src/core/catalog/references.ts`**

```ts
export function collectSourceIds(value: unknown, path: string[] = []): Array<{ path: string; sourceId: string }> {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => collectSourceIds(item, [...path, String(i)]));
  }
  if (value !== null && typeof value === 'object') {
    const found: Array<{ path: string; sourceId: string }> = [];
    for (const [key, child] of Object.entries(value)) {
      if (key === 'sourceId' && typeof child === 'string') found.push({ path: [...path, key].join('.'), sourceId: child });
      else found.push(...collectSourceIds(child, [...path, key]));
    }
    return found;
  }
  return [];
}

export function findUnresolvedSources(value: unknown, known: ReadonlySet<string>): string[] {
  return collectSourceIds(value)
    .filter((ref) => !known.has(ref.sourceId))
    .map((ref) => `${ref.path}: unknown sourceId "${ref.sourceId}"`);
}

export function formatIssues(
  prefix: string,
  error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> },
): string[] {
  return error.issues.map((issue) => `${prefix}: ${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`);
}
```

- [ ] **Step 8: Run tests**

Run: `npx vitest run src/core/catalog` then `npm run typecheck`
Expected: all PASS; typecheck exits 0. If a test fails, fix the schema, not the test data, unless the test data disagrees with its cited source.

- [ ] **Step 9: Commit**

```powershell
git add src/core/catalog src/test
git commit -m "feat(core): add catalogue schema, fact definitions and source reference checks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: JPL approximate planet positions, checked against Horizons

**Files:**
- Create: `src/core/ephemeris/types.ts`, `src/core/ephemeris/planetApprox.ts`, `pipeline/sources/horizons.ts`, `pipeline/scripts/fetchHorizonsReference.ts`, `pipeline/reference/horizons-heliocentric.json` (generated)
- Test: `src/core/ephemeris/planetApprox.test.ts`, `pipeline/sources/horizons.test.ts`

**Interfaces:**
- Consumes: `solveKeplerElliptic` (Task 5); `positionAtEccentricAnomaly`, `ConicElements` (Task 5); `PlanetApproxOrbit`, `ApproxTable` (Task 6); `AU_KM`, `J2000_JD`, `DAYS_PER_JULIAN_CENTURY` (Task 1); `DEG`, `normalizeDeg180` (Task 2); `APPROX_ORBITS` (Task 6 test data).
- Produces (`types.ts`): `interface BodyState { positionKm: Vec3; inValidRange: boolean; tableId: string | null }`.
- Produces (`planetApprox.ts`): `centuriesSinceJ2000(jdTdb): number`; `selectTable(tables, jdTdb): { table: ApproxTable; index: number; inValidRange: boolean }`; `type ApproxElements = ConicElements & { meanAnomalyRad: number }`; `elementsAt(table, jdTdb): ApproxElements`; `planetApproxState(orbit, jdTdb): BodyState`.
- Produces (`pipeline/sources/horizons.ts`): `REFERENCE_BODIES` (`{ body: ApproxBodyKey-like string; command: string }[]`, system barycentres 1–8; '3' is the Earth–Moon barycentre); `REFERENCE_JDS: number[]`; `horizonsVectorUrl(command: string, jdTdb: number): string`; `parseHorizonsVector(result: string): Vec3`; `interface HorizonsReference { retrievedAt: string; query: Record<string, string>; samples: Array<{ body: string; command: string; jdTdb: number; positionKm: [number, number, number] }> }`.

Background (verified while writing this plan): Horizons only serves planet-*centre* ephemerides (199, 499, …) for limited spans (e.g. Jupiter 1600–2200), so the reference uses **system barycentres** (1–8), which DE441 covers for all reference dates. With barycentres, every body stays within ~1.6× JPL's published nominal error except **Neptune with Table 1**, which reaches 4.5× (direction) and 7.1× (distance). The tests allow 3× nominal, with a documented 10× override for Neptune/Table 1, and Task 13 shows the measured figure to users.

- [ ] **Step 1: Create `pipeline/sources/horizons.ts`**

```ts
import type { Vec3 } from '../../src/core/math/vec3';

export const HORIZONS_API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

/** System barycentres; JPL's approximate elements are compared against these. '3' = Earth-Moon barycentre. */
export const REFERENCE_BODIES = [
  { body: 'mercury', command: '1' },
  { body: 'venus', command: '2' },
  { body: 'earth', command: '3' },
  { body: 'mars', command: '4' },
  { body: 'jupiter', command: '5' },
  { body: 'saturn', command: '6' },
  { body: 'uranus', command: '7' },
  { body: 'neptune', command: '8' },
] as const;

/** Six dates inside Table 1 (1800-2050) and three outside it but inside Table 2 (3000 BC - AD 3000). */
export const REFERENCE_JDS = [1355795.0, 1721423.5, 2385000.5, 2415020.0, 2433282.5, 2451545.0, 2461317.5, 2469807.5, 2816795.0];

export interface HorizonsReference {
  retrievedAt: string;
  query: Record<string, string>;
  samples: Array<{ body: string; command: string; jdTdb: number; positionKm: [number, number, number] }>;
}

export const REFERENCE_QUERY: Record<string, string> = {
  CENTER: "'500@10'",
  REF_PLANE: "'ECLIPTIC'",
  REF_SYSTEM: "'ICRF'",
  EPHEM_TYPE: "'VECTORS'",
  VEC_TABLE: "'1'",
  OUT_UNITS: "'KM-S'",
  TIME_TYPE: "'TDB'",
  CSV_FORMAT: "'YES'",
};

export function horizonsVectorUrl(command: string, jdTdb: number): string {
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    TLIST: `'${jdTdb}'`,
    TLIST_TYPE: "'JD'",
    ...REFERENCE_QUERY,
  });
  return `${HORIZONS_API}?${params.toString()}`;
}

/** Extract X, Y, Z (km) from the first line between $$SOE and $$EOE of a CSV vector table. */
export function parseHorizonsVector(result: string): Vec3 {
  const block = result.split('$$SOE')[1]?.split('$$EOE')[0];
  if (!block) throw new Error('Horizons result has no $$SOE/$$EOE block');
  const parts = block.trim().split('\n')[0]!.split(',').map((s) => s.trim());
  const xyz = [Number(parts[2]), Number(parts[3]), Number(parts[4])] as const;
  if (xyz.some((n) => !Number.isFinite(n))) throw new Error(`Horizons vector line not numeric: ${block.trim()}`);
  return xyz;
}
```

- [ ] **Step 2: Write `pipeline/sources/horizons.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { horizonsVectorUrl, parseHorizonsVector } from './horizons';

// Trimmed from a real response (Jupiter body centre, 2000-01-01 12:00 TDB, ecliptic J2000, Sun centre).
const RESULT = [
  '*******************************************************************************',
  '            JDTDB,            Calendar Date (TDB),                      X,                      Y,                      Z,',
  '$$SOE',
  '2451545.000000000, A.D. 2000-Jan-01 12:00:00.0000,  5.985676246570644E+08,  4.396046799481729E+08, -1.522686167298746E+07,',
  '$$EOE',
].join('\n');

describe('Horizons helpers', () => {
  it('parses the vector line', () => {
    expect(parseHorizonsVector(RESULT)).toEqual([5.985676246570644e8, 4.396046799481729e8, -1.522686167298746e7]);
  });
  it('throws when there is no ephemeris block', () => {
    expect(() => parseHorizonsVector('No ephemeris for target "Mars" prior to A.D. 1600')).toThrow(/\$\$SOE/);
  });
  it('builds a quoted-parameter URL', () => {
    const url = new URL(horizonsVectorUrl('5', 2451545));
    expect(url.searchParams.get('COMMAND')).toBe("'5'");
    expect(url.searchParams.get('CENTER')).toBe("'500@10'");
    expect(url.searchParams.get('TLIST')).toBe("'2451545'");
  });
});
```

Run: `npx vitest run pipeline/sources/horizons.test.ts`
Expected: PASS.

- [ ] **Step 3: Create `pipeline/scripts/fetchHorizonsReference.ts`**

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { horizonsVectorUrl, parseHorizonsVector, REFERENCE_BODIES, REFERENCE_JDS, REFERENCE_QUERY, type HorizonsReference } from '../sources/horizons';

const OUT = path.resolve('pipeline/reference/horizons-heliocentric.json');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchVector(command: string, jdTdb: number) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await sleep(400); // be polite to the Horizons API
      const res = await fetch(horizonsVectorUrl(command, jdTdb));
      const json = (await res.json()) as { result?: string; error?: string };
      if (json.error) throw new Error(json.error);
      return parseHorizonsVector(json.result ?? '');
    } catch (error) {
      lastError = error;
      console.warn(`retry ${attempt + 1} for ${command} @ ${jdTdb}: ${String(error)}`);
      await sleep(3000);
    }
  }
  throw lastError;
}

const samples: HorizonsReference['samples'] = [];
for (const { body, command } of REFERENCE_BODIES) {
  for (const jdTdb of REFERENCE_JDS) {
    const p = await fetchVector(command, jdTdb);
    samples.push({ body, command, jdTdb, positionKm: [p[0], p[1], p[2]] });
    console.log(`${body} ${jdTdb} ok`);
  }
}
const reference: HorizonsReference = { retrievedAt: new Date().toISOString().slice(0, 10), query: REFERENCE_QUERY, samples };
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(reference, null, 2)}\n`, 'utf8');
console.log(`wrote ${samples.length} samples to ${OUT}`);
```

- [ ] **Step 4: Generate and commit the reference data (network)**

Run: `npm run horizons:reference`
Expected: `wrote 72 samples to ...horizons-heliocentric.json`. Spot-check one value: the `earth` sample at `2451545` must have `positionKm` ≈ `[-2.5e7, 1.45e8, ~0]` (Earth–Moon barycentre on 1 Jan 2000).

- [ ] **Step 5: Write the failing tests `src/core/ephemeris/planetApprox.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import reference from '../../../pipeline/reference/horizons-heliocentric.json';
import { APPROX_ORBITS, TABLE1_RANGE, type ApproxBodyKey } from '../../test/approxOrbits';
import { ARCSEC } from '../math/angles';
import { angleBetween, length, type Vec3 } from '../math/vec3';
import { elementsAt, planetApproxState, selectTable } from './planetApprox';

const TOLERANCE_FACTOR = 3;
/** Measured while writing the plan: JPL's published Table 1 nominal for Neptune is exceeded up to 4.5x / 7.1x. */
const TOLERANCE_OVERRIDES: Record<string, number> = { 'neptune:1800-2050': 10 };

describe('planetApproxState vs JPL Horizons (DE441, system barycentres)', () => {
  const cases = reference.samples.map((s) => [s.body, s.jdTdb, s] as const);
  it.each(cases)('%s at JD %d', (_body, _jd, sample) => {
    const orbit = APPROX_ORBITS[sample.body as ApproxBodyKey];
    const state = planetApproxState(orbit, sample.jdTdb);
    const table = orbit.tables.find((t) => t.id === state.tableId)!;
    const factor = TOLERANCE_OVERRIDES[`${sample.body}:${table.id}`] ?? TOLERANCE_FACTOR;
    const ref = sample.positionKm as unknown as Vec3;
    const angularArcsec = angleBetween(state.positionKm, ref) / ARCSEC;
    const radialKm = Math.abs(length(state.positionKm) - length(ref));
    expect(state.inValidRange).toBe(true);
    expect(angularArcsec).toBeLessThanOrEqual(factor * Math.hypot(table.nominalError.longitudeArcsec, table.nominalError.latitudeArcsec));
    expect(radialKm).toBeLessThanOrEqual(factor * table.nominalError.distanceKm);
  });
});

describe('table selection', () => {
  it('prefers Table 1 inside 1800-2050, inclusive at both ends', () => {
    expect(selectTable(APPROX_ORBITS.mars.tables, TABLE1_RANGE.from)).toMatchObject({ index: 0, inValidRange: true });
    expect(selectTable(APPROX_ORBITS.mars.tables, TABLE1_RANGE.to)).toMatchObject({ index: 0, inValidRange: true });
    expect(selectTable(APPROX_ORBITS.mars.tables, TABLE1_RANGE.from - 1)).toMatchObject({ index: 1, inValidRange: true });
  });
  it('falls back to the widest table, flagged out of range, beyond every table', () => {
    for (const jd of [0, 5373484.5]) {
      for (const orbit of Object.values(APPROX_ORBITS)) {
        const state = planetApproxState(orbit, jd);
        expect(state.inValidRange).toBe(false);
        expect(state.tableId).toBe('3000BC-3000AD');
        expect(state.positionKm.every(Number.isFinite)).toBe(true);
      }
    }
  });
});

describe('elementsAt', () => {
  it('reproduces J2000 Table 1 elements for Jupiter', () => {
    const el = elementsAt(APPROX_ORBITS.jupiter.tables[0]!, 2451545.0);
    expect(el.aKm).toBeCloseTo(5.202887 * 149_597_870.7, 0);
    expect(el.e).toBeCloseTo(0.04838624, 12);
    // M = L - varpi = 34.39644051 - 14.72847983 deg
    expect(el.meanAnomalyRad).toBeCloseTo((19.66796068 * Math.PI) / 180, 12);
  });
});
```

- [ ] **Step 6: Run and confirm failure**

Run: `npx vitest run src/core/ephemeris/planetApprox.test.ts`
Expected: FAIL, cannot resolve `./planetApprox`.

- [ ] **Step 7: Create `src/core/ephemeris/types.ts` and `src/core/ephemeris/planetApprox.ts`**

`types.ts`:
```ts
import type { Vec3 } from '../math/vec3';

export interface BodyState {
  /** Heliocentric ecliptic J2000 position, km. */
  positionKm: Vec3;
  /** False when the date is outside every validity range of the body's model. */
  inValidRange: boolean;
  /** Which model table produced the position (planet-approx only). */
  tableId: string | null;
}
```

`planetApprox.ts`:
```ts
import type { ApproxTable, PlanetApproxOrbit } from '../catalog/schema';
import { DEG, normalizeDeg180 } from '../math/angles';
import { AU_KM, DAYS_PER_JULIAN_CENTURY, J2000_JD } from '../units';
import { positionAtEccentricAnomaly, type ConicElements } from './conic';
import { solveKeplerElliptic } from './kepler';
import type { BodyState } from './types';

export type ApproxElements = ConicElements & { meanAnomalyRad: number };

export function centuriesSinceJ2000(jdTdb: number): number {
  return (jdTdb - J2000_JD) / DAYS_PER_JULIAN_CENTURY;
}

/** First table whose range contains the date; otherwise the widest table, flagged out of range. */
export function selectTable(
  tables: readonly ApproxTable[],
  jdTdb: number,
): { table: ApproxTable; index: number; inValidRange: boolean } {
  const inside = tables.findIndex((t) => jdTdb >= t.validFromJdTdb && jdTdb <= t.validToJdTdb);
  if (inside >= 0) return { table: tables[inside]!, index: inside, inValidRange: true };
  let widest = 0;
  tables.forEach((t, i) => {
    const w = tables[widest]!;
    if (t.validToJdTdb - t.validFromJdTdb > w.validToJdTdb - w.validFromJdTdb) widest = i;
  });
  return { table: tables[widest]!, index: widest, inValidRange: false };
}

/** JPL "Approximate Positions of the Planets": elements at date, including Table 2b terms. */
export function elementsAt(table: ApproxTable, jdTdb: number): ApproxElements {
  const T = centuriesSinceJ2000(jdTdb);
  const el = table.elements;
  const r = table.ratesPerCentury;
  const a = el.a + r.a * T;
  const e = Math.min(Math.max(el.e + r.e * T, 0), 0.99); // clamp guards extrapolation far outside the fit
  const I = el.I + r.I * T;
  const L = el.L + r.L * T;
  const varpi = el.varpi + r.varpi * T;
  const Omega = el.Omega + r.Omega * T;
  let M = L - varpi;
  const x = table.extraTerms;
  if (x) M += x.b * T * T + x.c * Math.cos(x.f * T * DEG) + x.s * Math.sin(x.f * T * DEG);
  return {
    aKm: a * AU_KM,
    e,
    iRad: I * DEG,
    nodeRad: Omega * DEG,
    argPeriRad: (varpi - Omega) * DEG,
    meanAnomalyRad: normalizeDeg180(M) * DEG,
  };
}

export function planetApproxState(orbit: PlanetApproxOrbit, jdTdb: number): BodyState {
  const { table, inValidRange } = selectTable(orbit.tables, jdTdb);
  const el = elementsAt(table, jdTdb);
  const E = solveKeplerElliptic(el.meanAnomalyRad, el.e);
  return { positionKm: positionAtEccentricAnomaly(el, E), inValidRange, tableId: table.id };
}
```

- [ ] **Step 8: Run tests**

Run: `npx vitest run src/core/ephemeris pipeline/sources/horizons.test.ts`
Expected: all PASS (72 Horizons comparisons). If a comparison fails, check the implementation against the formulas on https://ssd.jpl.nasa.gov/planets/approx_pos.html first. Raise a tolerance only with a measured justification recorded in `Space_visualizer/Decisions/`.

- [ ] **Step 9: Commit**

```powershell
git add src/core/ephemeris pipeline/sources/horizons.ts pipeline/sources/horizons.test.ts pipeline/scripts pipeline/reference
git commit -m "feat(core): add JPL approximate planet positions verified against Horizons" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: IAU rotation models

**Files:**
- Create: `src/core/frames/rotation.ts`
- Test: `src/core/frames/rotation.test.ts`

**Interfaces:**
- Consumes: `Mat3`, `mul`, `transpose`, `rotX`, `rotZ`, `column`, `apply` (Task 2); `Vec3` (Task 2); `DEG`, `normalizeDeg360` (Task 2); `J2000_JD`, `DAYS_PER_JULIAN_CENTURY`, `OBLIQUITY_J2000_DEG` (Task 1).
- Produces: `interface RotationTerms { poleRa; poleDec; pm: readonly [number, number, number]; nutPrecRa; nutPrecDec; nutPrecPm: readonly number[]; nutPrecAngles: ReadonlyArray<readonly [number, number, number]> }` (the schema's `RotationModel` satisfies it); `orientationAngles(model, jdTdb): { raDeg: number; decDeg: number; wDeg: number }`; `bodyFixedToEquatorial(model, jdTdb): Mat3`; `bodyFixedToEcliptic(model, jdTdb): Mat3` (columns = body x, y, z axes expressed in the ecliptic frame; z = IAU north pole); `poleEcliptic(model, jdTdb): Vec3`; `eclipticToEquatorial(v): Vec3`; `equatorialToEcliptic(v): Vec3`.

Model (IAU WGCCRE 2015, as encoded in NAIF PCK files): with d = days and T = Julian centuries since J2000 TDB, θₖ = a₀ + a₁T + a₂T² (degrees);
α₀ = ra₀ + ra₁T + ra₂T² + Σ raₖ sin θₖ; δ₀ = dec₀ + dec₁T + dec₂T² + Σ decₖ cos θₖ; W = pm₀ + pm₁d + pm₂d² + Σ pmₖ sin θₖ.
Equatorial → body-fixed = Rz(W) · Rx(90° − δ₀) · Rz(90° + α₀) (passive rotations).

- [ ] **Step 1: Write the failing tests `src/core/frames/rotation.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeEarth } from '../../test/fixtures';
import { DEG, RAD, normalizeDeg360 } from '../math/angles';
import { column } from '../math/mat3';
import { OBLIQUITY_J2000_DEG } from '../units';
import { bodyFixedToEquatorial, eclipticToEquatorial, equatorialToEcliptic, orientationAngles, poleEcliptic, type RotationTerms } from './rotation';

const earth = makeEarth().rotation!;
const eps = OBLIQUITY_J2000_DEG * DEG;

// From NAIF pck00011.tpc (BODY499_* and BODY4_NUT_PREC_ANGLES, MAX_PHASE_DEGREE = 2).
const mars: RotationTerms = {
  poleRa: [317.269202, -0.10927547, 0],
  poleDec: [54.432516, -0.05827105, 0],
  pm: [176.049863, 350.891982443297, 0],
  nutPrecRa: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.000068, 0.000238, 0.000052, 0.000009, 0.419057],
  nutPrecDec: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.000051, 0.000141, 0.000031, 0.000005, 1.591274],
  nutPrecPm: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.000145, 0.000157, 0.00004, 0.000001, 0.000001, 0.584542],
  nutPrecAngles: [
    [190.72646643, 15917.10818695, 0], [21.4689247, 31834.27934054, 0], [332.86082793, 19139.89694742, 0],
    [394.93256437, 38280.79631835, 0], [189.6327156, 41215158.1842005, 12.711923222], [121.46893664, 660.22803474, 0],
    [231.05028581, 660.9912354, 0], [251.37314025, 1320.50145245, 0], [217.98635955, 38279.9612555, 0],
    [196.19729402, 19139.83628608, 0], [198.991226, 19139.4819985, 0], [226.292679, 38280.8511281, 0],
    [249.663391, 57420.7251593, 0], [266.18351, 76560.636795, 0], [79.398797, 0.5042615, 0],
    [122.433576, 19139.9407476, 0], [43.058401, 38280.8753272, 0], [57.663379, 57420.7517205, 0],
    [79.476401, 76560.6495004, 0], [166.325722, 0.5042615, 0], [129.071773, 19140.0328244, 0],
    [36.352167, 38281.0473591, 0], [56.668646, 57420.929536, 0], [67.364003, 76560.2552215, 0],
    [104.79268, 95700.4387578, 0], [95.391654, 0.5042615, 0],
  ],
};

// From pck00011.tpc: BODY899_* with N = 357.85 + 52.316 T (first BODY8 angle).
const neptune: RotationTerms = {
  poleRa: [299.36, 0, 0], poleDec: [43.46, 0, 0], pm: [249.978, 541.1397757, 0],
  nutPrecRa: [0.7], nutPrecDec: [-0.51], nutPrecPm: [-0.48], nutPrecAngles: [[357.85, 52.316, 0]],
};

describe('IAU rotation models', () => {
  it("puts Earth's J2000 pole at ecliptic (0, sin eps, cos eps)", () => {
    const p = poleEcliptic(earth, 2451545.0);
    expect(p[0]).toBeCloseTo(0, 12);
    expect(p[1]).toBeCloseTo(Math.sin(eps), 12);
    expect(p[2]).toBeCloseTo(Math.cos(eps), 12);
  });

  it("places Earth's prime meridian at RA = 90 + alpha0 + W (280.147 deg at J2000)", () => {
    const x = column(bodyFixedToEquatorial(earth, 2451545.0), 0);
    expect(normalizeDeg360(Math.atan2(x[1], x[0]) * RAD)).toBeCloseTo(280.147, 9);
    expect(x[2]).toBeCloseTo(0, 12);
  });

  it('advances W by the daily rate', () => {
    expect(orientationAngles(earth, 2451546.0).wDeg).toBeCloseTo(191.1326235, 7);
  });

  it("applies Neptune's N-angle terms", () => {
    const a = orientationAngles(neptune, 2451545.0);
    expect(a.raDeg).toBeCloseTo(299.3337391, 6);
    expect(a.decDeg).toBeCloseTo(42.950359, 6);
  });

  it("applies Mars' large long-period terms (pole ~ RA 317.68, Dec 52.89 at J2000)", () => {
    const a = orientationAngles(mars, 2451545.0);
    expect(a.raDeg).toBeCloseTo(317.681, 2);
    expect(a.decDeg).toBeCloseTo(52.886, 2);
  });

  it('round-trips ecliptic and equatorial vectors', () => {
    const v = [0.3, -0.4, 0.86] as const;
    const back = equatorialToEcliptic(eclipticToEquatorial(v));
    back.forEach((c, i) => expect(c).toBeCloseTo(v[i]!, 14));
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/core/frames`
Expected: FAIL, module not found.

- [ ] **Step 3: Create `src/core/frames/rotation.ts`**

```ts
import { DEG, normalizeDeg360 } from '../math/angles';
import { apply, column, mul, rotX, rotZ, transpose, type Mat3 } from '../math/mat3';
import type { Vec3 } from '../math/vec3';
import { DAYS_PER_JULIAN_CENTURY, J2000_JD, OBLIQUITY_J2000_DEG } from '../units';

export interface RotationTerms {
  poleRa: readonly [number, number, number];
  poleDec: readonly [number, number, number];
  pm: readonly [number, number, number];
  nutPrecRa: readonly number[];
  nutPrecDec: readonly number[];
  nutPrecPm: readonly number[];
  nutPrecAngles: ReadonlyArray<readonly [number, number, number]>;
}

const poly = (c: readonly [number, number, number], x: number) => c[0] + c[1] * x + c[2] * x * x;

/** IAU WGCCRE pole right ascension/declination and prime meridian angle, degrees. */
export function orientationAngles(model: RotationTerms, jdTdb: number): { raDeg: number; decDeg: number; wDeg: number } {
  const d = jdTdb - J2000_JD;
  const T = d / DAYS_PER_JULIAN_CENTURY;
  let ra = poly(model.poleRa, T);
  let dec = poly(model.poleDec, T);
  let w = poly(model.pm, d);
  model.nutPrecAngles.forEach((angle, k) => {
    const theta = poly(angle, T) * DEG;
    ra += (model.nutPrecRa[k] ?? 0) * Math.sin(theta);
    dec += (model.nutPrecDec[k] ?? 0) * Math.cos(theta);
    w += (model.nutPrecPm[k] ?? 0) * Math.sin(theta);
  });
  return { raDeg: ra, decDeg: dec, wDeg: normalizeDeg360(w) };
}

/** Columns are the body-fixed axes expressed in the ICRF (J2000 equatorial) frame. */
export function bodyFixedToEquatorial(model: RotationTerms, jdTdb: number): Mat3 {
  const { raDeg, decDeg, wDeg } = orientationAngles(model, jdTdb);
  const equatorialToBodyFixed = mul(rotZ(wDeg * DEG), mul(rotX((90 - decDeg) * DEG), rotZ((90 + raDeg) * DEG)));
  return transpose(equatorialToBodyFixed);
}

/** v_equatorial = ECLIPTIC_TO_EQUATORIAL * v_ecliptic. */
const ECLIPTIC_TO_EQUATORIAL: Mat3 = rotX(-OBLIQUITY_J2000_DEG * DEG);
const EQUATORIAL_TO_ECLIPTIC: Mat3 = transpose(ECLIPTIC_TO_EQUATORIAL);

export function eclipticToEquatorial(v: Vec3): Vec3 {
  return apply(ECLIPTIC_TO_EQUATORIAL, v);
}

export function equatorialToEcliptic(v: Vec3): Vec3 {
  return apply(EQUATORIAL_TO_ECLIPTIC, v);
}

/** Columns are the body-fixed axes expressed in the ecliptic J2000 frame (the scene's world frame). */
export function bodyFixedToEcliptic(model: RotationTerms, jdTdb: number): Mat3 {
  return mul(EQUATORIAL_TO_ECLIPTIC, bodyFixedToEquatorial(model, jdTdb));
}

export function poleEcliptic(model: RotationTerms, jdTdb: number): Vec3 {
  return column(bodyFixedToEcliptic(model, jdTdb), 2);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/core/frames`
Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/core/frames
git commit -m "feat(core): add IAU rotation models and frame conversions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Pipeline fetch cache, HTML helpers and the JPL approximate-elements parser

**Files:**
- Create: `pipeline/lib/fetchCached.ts`, `pipeline/lib/html.ts`, `pipeline/sources/jplApproxPos.ts`, `pipeline/fixtures/approx_pos.html` (downloaded)
- Test: `pipeline/lib/fetchCached.test.ts`, `pipeline/sources/jplApproxPos.test.ts`

**Interfaces:**
- Produces (`fetchCached.ts`): `interface FetchedText { text: string; retrievedAt: string; fromCache: boolean }`; `interface FetchOptions { offline: boolean; rawDir: string; fetchImpl?: typeof fetch; now?: () => Date; log?: (message: string) => void }`; `fetchCached(url: string, cacheName: string, options: FetchOptions): Promise<FetchedText>`. `retrievedAt` is an ISO date (`YYYY-MM-DD`).
- Produces (`html.ts`): `parseHtml(html): HTMLElement`; `decodeEntities(text): string`; `cellText(el): string`; re-exports `type HTMLElement`.
- Produces (`jplApproxPos.ts`): `APPROX_ROWS` (`'Mercury' | 'Venus' | 'EM Bary' | 'Mars' | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune'`); `type ApproxRow`; `interface KeplerRow { a; e; I; L; varpi; Omega: number }`; `interface ExtraTerms { b; c; s; f: number }`; `interface ErrorFigure { longitudeArcsec; latitudeArcsec; distanceKm: number }`; `interface ApproxPosData { table1: Record<ApproxRow, { elements: KeplerRow; rates: KeplerRow }>; table2a: same; table2b: Partial<Record<ApproxRow, ExtraTerms>>; nominalErrors: Record<ApproxRow, { table1: ErrorFigure; table2: ErrorFigure }> }`; `parseApproxPos(html: string): ApproxPosData`.

- [ ] **Step 1: Download the fixture**

```powershell
New-Item -ItemType Directory -Force pipeline/fixtures | Out-Null
curl.exe -sSL -o pipeline/fixtures/approx_pos.html https://ssd.jpl.nasa.gov/planets/approx_pos.html
```
Check: the file contains `<h4>Table 1</h4>` and `planet-approx-pos-errors`.

- [ ] **Step 2: Write the failing tests `pipeline/lib/fetchCached.test.ts`**

```ts
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fetchCached } from './fetchCached';

const okFetch = (text: string) => (async () => new Response(text, { status: 200 })) as unknown as typeof fetch;
const failFetch = (async () => {
  throw new Error('network down');
}) as unknown as typeof fetch;
const now = () => new Date('2026-10-04T10:00:00Z');
const tempDir = () => mkdtemp(path.join(os.tmpdir(), 'ssv-pipeline-'));

describe('fetchCached', () => {
  it('fetches, caches and stamps the retrieval date', async () => {
    const rawDir = await tempDir();
    const result = await fetchCached('https://example.org/a', 'a.html', { offline: false, rawDir, fetchImpl: okFetch('hello'), now });
    expect(result).toEqual({ text: 'hello', retrievedAt: '2026-10-04', fromCache: false });
    expect(await readFile(path.join(rawDir, 'a.html'), 'utf8')).toBe('hello');
  });

  it('falls back to the cached copy and logs a warning when the network fails', async () => {
    const rawDir = await tempDir();
    await fetchCached('https://example.org/a', 'a.html', { offline: false, rawDir, fetchImpl: okFetch('cached'), now });
    const log = vi.fn();
    const result = await fetchCached('https://example.org/a', 'a.html', { offline: false, rawDir, fetchImpl: failFetch, log });
    expect(result).toEqual({ text: 'cached', retrievedAt: '2026-10-04', fromCache: true });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('using cached copy'));
  });

  it('throws when the network fails and nothing is cached', async () => {
    await expect(fetchCached('https://example.org/b', 'b.html', { offline: false, rawDir: await tempDir(), fetchImpl: failFetch })).rejects.toThrow(/no cached copy/);
  });

  it('treats HTTP errors as failures', async () => {
    const notFound = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch;
    await expect(fetchCached('https://example.org/c', 'c.html', { offline: false, rawDir: await tempDir(), fetchImpl: notFound })).rejects.toThrow(/HTTP 404/);
  });

  it('offline mode reads only the cache', async () => {
    await expect(fetchCached('https://example.org/d', 'd.html', { offline: true, rawDir: await tempDir() })).rejects.toThrow(/Offline mode/);
  });
});
```

- [ ] **Step 3: Write the failing tests `pipeline/sources/jplApproxPos.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseApproxPos } from './jplApproxPos';

const html = readFileSync('pipeline/fixtures/approx_pos.html', 'utf8');

describe('parseApproxPos (JPL Approximate Positions of the Planets)', () => {
  const data = parseApproxPos(html);

  it('parses Table 1 elements and rates', () => {
    expect(data.table1.Mercury.elements).toEqual({ a: 0.38709927, e: 0.20563593, I: 7.00497902, L: 252.2503235, varpi: 77.45779628, Omega: 48.33076593 });
    expect(data.table1.Neptune.rates).toEqual({ a: 0.00026291, e: 0.00005105, I: 0.00035372, L: 218.45945325, varpi: -0.32241464, Omega: -0.00508664 });
    expect(data.table1['EM Bary'].elements.Omega).toBe(0);
  });

  it('parses Table 2a and the Table 2b extra terms', () => {
    expect(data.table2a['EM Bary'].elements.Omega).toBe(-5.11260389);
    expect(data.table2b.Jupiter).toEqual({ b: -0.00012452, c: 0.0606406, s: -0.35635438, f: 38.35125 });
    expect(data.table2b.Mars).toBeUndefined();
  });

  it('parses nominal errors and converts 1000 km to km', () => {
    expect(data.nominalErrors.Neptune.table1).toEqual({ longitudeArcsec: 10, latitudeArcsec: 1, distanceKm: 200000 });
    expect(data.nominalErrors.Uranus.table2).toEqual({ longitudeArcsec: 2000, latitudeArcsec: 30, distanceKm: 8000000 });
    expect(data.nominalErrors['EM Bary'].table1.latitudeArcsec).toBe(8);
  });

  it('fails loudly when the page layout changes', () => {
    expect(() => parseApproxPos('<html><body></body></html>')).toThrow(/Table 1/);
  });
});
```

- [ ] **Step 4: Run and confirm failure**

Run: `npx vitest run pipeline/lib pipeline/sources/jplApproxPos.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 5: Create `pipeline/lib/fetchCached.ts`**

```ts
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface FetchedText {
  text: string;
  retrievedAt: string;
  fromCache: boolean;
}

export interface FetchOptions {
  offline: boolean;
  rawDir: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  log?: (message: string) => void;
}

const USER_AGENT = 'Mozilla/5.0 (compatible; solar-system-visualizer-data-pipeline)';

export async function fetchCached(url: string, cacheName: string, options: FetchOptions): Promise<FetchedText> {
  const file = path.join(options.rawDir, cacheName);
  const metaFile = `${file}.meta.json`;

  const readCache = async (): Promise<FetchedText | null> => {
    if (!existsSync(file) || !existsSync(metaFile)) return null;
    const meta = JSON.parse(await readFile(metaFile, 'utf8')) as { retrievedAt: string };
    return { text: await readFile(file, 'utf8'), retrievedAt: meta.retrievedAt, fromCache: true };
  };

  if (options.offline) {
    const cached = await readCache();
    if (!cached) throw new Error(`Offline mode: no cached copy of ${url} at ${file}`);
    return cached;
  }

  try {
    const res = await (options.fetchImpl ?? fetch)(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = await res.text();
    const retrievedAt = (options.now ?? (() => new Date()))().toISOString().slice(0, 10);
    await mkdir(options.rawDir, { recursive: true });
    await writeFile(file, text, 'utf8');
    await writeFile(metaFile, JSON.stringify({ url, retrievedAt }, null, 2), 'utf8');
    return { text, retrievedAt, fromCache: false };
  } catch (error) {
    const cached = await readCache();
    if (cached) {
      options.log?.(`WARN fetch failed for ${url} (${String(error)}); using cached copy from ${cached.retrievedAt}`);
      return cached;
    }
    throw new Error(`Could not fetch ${url} and no cached copy exists: ${String(error)}`);
  }
}
```

The `HTTP 404` test expects the message to survive: the final error message includes `String(error)`, which contains `HTTP 404`.

- [ ] **Step 6: Create `pipeline/lib/html.ts`**

```ts
import { parse, type HTMLElement } from 'node-html-parser';

export type { HTMLElement };

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', dagger: '†', deg: '°',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith('#')) {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED[code.toLowerCase()] ?? match;
  });
}

export function parseHtml(html: string): HTMLElement {
  return parse(html);
}

/** Visible text of an element with entities decoded and whitespace collapsed. */
export function cellText(el: HTMLElement): string {
  return decodeEntities(el.rawText).replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 7: Create `pipeline/sources/jplApproxPos.ts`**

```ts
import { cellText, decodeEntities, parseHtml, type HTMLElement } from '../lib/html';

export const APPROX_ROWS = ['Mercury', 'Venus', 'EM Bary', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'] as const;
export type ApproxRow = (typeof APPROX_ROWS)[number];

export interface KeplerRow { a: number; e: number; I: number; L: number; varpi: number; Omega: number }
export interface ExtraTerms { b: number; c: number; s: number; f: number }
export interface ErrorFigure { longitudeArcsec: number; latitudeArcsec: number; distanceKm: number }
type ElementTable = Record<ApproxRow, { elements: KeplerRow; rates: KeplerRow }>;

export interface ApproxPosData {
  table1: ElementTable;
  table2a: ElementTable;
  table2b: Partial<Record<ApproxRow, ExtraTerms>>;
  nominalErrors: Record<ApproxRow, { table1: ErrorFigure; table2: ErrorFigure }>;
}

const ROW_LINE = /^(Mercury|Venus|EM Bary|Mars|Jupiter|Saturn|Uranus|Neptune)\s+(?=[-\d])/;

function preAfterHeading(root: HTMLElement, heading: string): string {
  const h = root.querySelectorAll('h4').find((el) => cellText(el) === heading);
  if (!h) throw new Error(`approx_pos: heading "${heading}" not found`);
  let el = h.nextElementSibling;
  while (el && el.tagName !== 'PRE') el = el.nextElementSibling;
  if (!el) throw new Error(`approx_pos: no <pre> after "${heading}"`);
  return decodeEntities(el.rawText);
}

function numbers(text: string, count: number, context: string): number[] {
  const parts = text.trim().split(/\s+/).map(Number);
  if (parts.length !== count || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`${context}: expected ${count} numbers, got "${text.trim()}"`);
  }
  return parts;
}

const toKepler = (n: number[]): KeplerRow => ({ a: n[0]!, e: n[1]!, I: n[2]!, L: n[3]!, varpi: n[4]!, Omega: n[5]! });

function requireAll<T>(rows: Partial<Record<ApproxRow, T>>, label: string): Record<ApproxRow, T> {
  for (const name of APPROX_ROWS) if (!rows[name]) throw new Error(`${label}: missing row "${name}"`);
  return rows as Record<ApproxRow, T>;
}

function parseElementTable(pre: string, label: string): ElementTable {
  const lines = pre.split(/\r?\n/);
  const rows: Partial<ElementTable> = {};
  for (let i = 0; i < lines.length; i++) {
    const match = ROW_LINE.exec(lines[i]!);
    if (!match) continue;
    const name = match[1] as ApproxRow;
    rows[name] = {
      elements: toKepler(numbers(lines[i]!.slice(name.length), 6, `${label} ${name} elements`)),
      rates: toKepler(numbers(lines[i + 1] ?? '', 6, `${label} ${name} rates`)),
    };
    i += 1;
  }
  return requireAll(rows, label);
}

function parseExtraTerms(pre: string): Partial<Record<ApproxRow, ExtraTerms>> {
  const rows: Partial<Record<ApproxRow, ExtraTerms>> = {};
  for (const line of pre.split(/\r?\n/)) {
    const match = ROW_LINE.exec(line);
    if (!match) continue;
    const name = match[1] as ApproxRow;
    const [b, c, s, f] = numbers(line.slice(name.length), 4, `Table 2b ${name}`);
    rows[name] = { b: b!, c: c!, s: s!, f: f! };
  }
  if (Object.keys(rows).length === 0) throw new Error('Table 2b: no rows found');
  return rows;
}

function parseNominalErrors(root: HTMLElement): ApproxPosData['nominalErrors'] {
  const table = root.querySelector('table.planet-approx-pos-errors');
  if (!table) throw new Error('approx_pos: accuracy table not found');
  const rows: Partial<ApproxPosData['nominalErrors']> = {};
  for (const tr of table.querySelectorAll('tbody tr')) {
    const th = tr.querySelector('th');
    const name = th ? APPROX_ROWS.find((n) => cellText(th).startsWith(n)) : undefined;
    if (!name) continue;
    const v = tr.querySelectorAll('td').map((td) => Number(cellText(td)));
    if (v.length !== 6 || v.some((n) => !Number.isFinite(n))) throw new Error(`accuracy table: bad row for ${name}`);
    rows[name] = {
      table1: { longitudeArcsec: v[0]!, latitudeArcsec: v[1]!, distanceKm: v[2]! * 1000 },
      table2: { longitudeArcsec: v[3]!, latitudeArcsec: v[4]!, distanceKm: v[5]! * 1000 },
    };
  }
  return requireAll(rows, 'accuracy table');
}

export function parseApproxPos(html: string): ApproxPosData {
  const root = parseHtml(html);
  return {
    table1: parseElementTable(preAfterHeading(root, 'Table 1'), 'Table 1'),
    table2a: parseElementTable(preAfterHeading(root, 'Table 2a'), 'Table 2a'),
    table2b: parseExtraTerms(preAfterHeading(root, 'Table 2b')),
    nominalErrors: parseNominalErrors(root),
  };
}
```

- [ ] **Step 8: Run tests**

Run: `npx vitest run pipeline/lib pipeline/sources/jplApproxPos.test.ts`
Expected: all PASS.

- [ ] **Step 9: Commit**

```powershell
git add pipeline/lib pipeline/sources/jplApproxPos.ts pipeline/sources/jplApproxPos.test.ts pipeline/fixtures/approx_pos.html
git commit -m "feat(pipeline): add cached fetching, HTML helpers and JPL approximate elements parser" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: NASA NSSDCA fact sheet parsers

**Files:**
- Create: `pipeline/sources/nssdcFactSheet.ts`, `pipeline/fixtures/planet-factsheet.html`, `pipeline/fixtures/sun-factsheet.html` (downloaded)
- Test: `pipeline/sources/nssdcFactSheet.test.ts`

**Interfaces:**
- Consumes: `parseHtml`, `cellText` (Task 9).
- Produces: `type FactCell = number | boolean | undefined` (`undefined` = "Unknown"); `parseFactCell(raw: string): FactCell`; `interface PlanetFactSheet { columns: string[]; rows: Map<string, Map<string, FactCell>> }`; `parsePlanetFactSheet(html): PlanetFactSheet`; `planetFact(sheet, labelPrefix: string, column: string): FactCell`; `parseSunFactSheet(html): Map<string, string>`; `sunFact(sheet, labelPrefix: string): string`; `parseSunNumber(raw: string): number`.

- [ ] **Step 1: Download fixtures**

```powershell
curl.exe -sSL -o pipeline/fixtures/planet-factsheet.html https://nssdc.gsfc.nasa.gov/planetary/factsheet/
curl.exe -sSL -o pipeline/fixtures/sun-factsheet.html https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html
```

- [ ] **Step 2: Write the failing tests `pipeline/sources/nssdcFactSheet.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFactCell, parsePlanetFactSheet, parseSunFactSheet, parseSunNumber, planetFact, sunFact } from './nssdcFactSheet';

describe('parseFactCell', () => {
  it.each([
    ['12,104', 12104],
    ['0.384*', 0.384],
    ['-5832.5', -5832.5],
    ['Yes', true],
    ['No', false],
    ['Unknown*', undefined],
    ['Unknown', undefined],
    ['', undefined],
  ])('%s -> %s', (raw, expected) => {
    expect(parseFactCell(raw)).toBe(expected);
  });
  it('rejects unrecognized text', () => {
    expect(() => parseFactCell('lots')).toThrow(/Unrecognized/);
  });
});

describe('planetary fact sheet', () => {
  const sheet = parsePlanetFactSheet(readFileSync('pipeline/fixtures/planet-factsheet.html', 'utf8'));
  it('reads the columns', () => {
    expect(sheet.columns).toEqual(['MERCURY', 'VENUS', 'EARTH', 'MOON', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE', 'PLUTO']);
  });
  it('reads values by row prefix and column', () => {
    expect(planetFact(sheet, 'Mass', 'JUPITER')).toBe(1898);
    expect(planetFact(sheet, 'Diameter', 'EARTH')).toBe(12756);
    expect(planetFact(sheet, 'Rotation Period', 'VENUS')).toBe(-5832.5);
    expect(planetFact(sheet, 'Ring System?', 'SATURN')).toBe(true);
    expect(planetFact(sheet, 'Orbital Eccentricity', 'MERCURY')).toBe(0.206);
  });
  it('keeps unknown values as undefined', () => {
    expect(planetFact(sheet, 'Surface Pressure', 'JUPITER')).toBeUndefined();
  });
  it('throws for missing rows or columns', () => {
    expect(() => planetFact(sheet, 'Colour', 'JUPITER')).toThrow(/row "Colour"/);
    expect(() => planetFact(sheet, 'Mass', 'VULCAN')).toThrow(/column "VULCAN"/);
  });
});

describe('sun fact sheet', () => {
  const sheet = parseSunFactSheet(readFileSync('pipeline/fixtures/sun-factsheet.html', 'utf8'));
  it('reads labelled values', () => {
    expect(parseSunNumber(sunFact(sheet, 'Mass ('))).toBe(1988400);
    expect(parseSunNumber(sunFact(sheet, 'Volumetric mean radius'))).toBe(695700);
    expect(parseSunNumber(sunFact(sheet, 'Absolute magnitude'))).toBe(4.83);
    expect(parseSunNumber(sunFact(sheet, 'Sidereal rotation period'))).toBe(609.12);
    expect(sunFact(sheet, 'Spectral type')).toBe('G2 V');
  });
  it('throws for a missing label', () => {
    expect(() => sunFact(sheet, 'Favourite colour')).toThrow(/Favourite colour/);
  });
});
```

- [ ] **Step 3: Run and confirm failure**

Run: `npx vitest run pipeline/sources/nssdcFactSheet.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Create `pipeline/sources/nssdcFactSheet.ts`**

```ts
import { cellText, parseHtml } from '../lib/html';

export type FactCell = number | boolean | undefined;

/** "12,104" -> 12104, "0.384*" -> 0.384, "Yes"/"No" -> boolean, "Unknown*" or "" -> undefined. */
export function parseFactCell(raw: string): FactCell {
  const t = raw.replace(/\*/g, '').replace(/,/g, '').trim();
  if (t === '' || /^unknown$/i.test(t)) return undefined;
  if (/^yes$/i.test(t)) return true;
  if (/^no$/i.test(t)) return false;
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error(`Unrecognized fact sheet value "${raw}"`);
  return n;
}

export interface PlanetFactSheet {
  columns: string[];
  rows: Map<string, Map<string, FactCell>>;
}

export function parsePlanetFactSheet(html: string): PlanetFactSheet {
  const table = parseHtml(html).querySelector('table');
  if (!table) throw new Error('Planetary fact sheet: no table found');
  const trs = table.querySelectorAll('tr');
  const header = trs[0]?.querySelectorAll('td').map(cellText) ?? [];
  const columns = header.slice(1);
  if (columns.length === 0) throw new Error('Planetary fact sheet: header row has no columns');
  const rows = new Map<string, Map<string, FactCell>>();
  for (const tr of trs.slice(1)) {
    const cells = tr.querySelectorAll('td').map(cellText);
    const label = cells[0];
    if (!label) continue; // repeated header row at the bottom
    const values = new Map<string, FactCell>();
    columns.forEach((column, i) => values.set(column, parseFactCell(cells[i + 1] ?? '')));
    rows.set(label, values);
  }
  return { columns, rows };
}

/** Row labels carry units, e.g. "Mass (1024kg)"; match by prefix. */
export function planetFact(sheet: PlanetFactSheet, labelPrefix: string, column: string): FactCell {
  const entry = [...sheet.rows.entries()].find(
    ([label]) => label === labelPrefix || label.startsWith(`${labelPrefix} `) || label.startsWith(`${labelPrefix}(`),
  );
  if (!entry) throw new Error(`Fact sheet row "${labelPrefix}" not found`);
  if (!sheet.columns.includes(column)) throw new Error(`Fact sheet column "${column}" not found`);
  return entry[1].get(column);
}

/** Every table row of the form <th>label</th><td>Sun value</td>...; the first occurrence of a label wins. */
export function parseSunFactSheet(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const tr of parseHtml(html).querySelectorAll('tr')) {
    const ths = tr.querySelectorAll('th');
    const tds = tr.querySelectorAll('td');
    if (ths.length !== 1 || tds.length === 0) continue;
    const label = cellText(ths[0]!);
    if (label && !out.has(label)) out.set(label, cellText(tds[0]!));
  }
  return out;
}

export function sunFact(sheet: Map<string, string>, labelPrefix: string): string {
  const entry = [...sheet.entries()].find(([label]) => label.startsWith(labelPrefix));
  if (!entry) throw new Error(`Sun fact sheet label "${labelPrefix}" not found`);
  return entry[1];
}

/** "1,988,400." -> 1988400, "+4.83" -> 4.83. */
export function parseSunNumber(raw: string): number {
  const n = Number(raw.replace(/,/g, '').replace(/\.$/, '').replace(/^\+/, ''));
  if (!Number.isFinite(n)) throw new Error(`Sun fact sheet value is not a number: "${raw}"`);
  return n;
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run pipeline/sources/nssdcFactSheet.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add pipeline/sources/nssdcFactSheet.ts pipeline/sources/nssdcFactSheet.test.ts pipeline/fixtures/planet-factsheet.html pipeline/fixtures/sun-factsheet.html
git commit -m "feat(pipeline): add NASA NSSDCA fact sheet parsers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: NASA NAIF PCK parser (IAU rotation models and radii)

**Files:**
- Create: `pipeline/sources/naifPck.ts`, `pipeline/fixtures/pck00011.tpc` (downloaded)
- Test: `pipeline/sources/naifPck.test.ts`

**Interfaces:**
- Consumes: `RotationModel` (Task 6).
- Produces: `parsePckAssignments(text: string): Map<string, number[]>` (numeric kernel variables only; supports `+=` and Fortran `D` exponents); `rotationModelFor(pck, naifId: number): Omit<RotationModel, 'sourceId'>`; `radiiFor(pck, naifId: number): { equatorialRadiusKm: number; polarRadiusKm: number }`.

Kernel rules (from the file's own header): data sits between `\begindata` and `\begintext` tokens, each alone on its line (possibly indented; the header prose also mentions the tokens mid-sentence, which must be ignored); assignments are `NAME = value` or `NAME = ( v1 v2 ... )`; list items are separated by blanks or commas. Nutation/precession angles for planet `N99` live in `BODYN_NUT_PREC_ANGLES`, in groups of `BODYN_MAX_PHASE_DEGREE + 1` (default 2).

- [ ] **Step 1: Download the fixture**

```powershell
curl.exe -sSL -o pipeline/fixtures/pck00011.tpc https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
```

- [ ] **Step 2: Write the failing tests `pipeline/sources/naifPck.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePckAssignments, radiiFor, rotationModelFor } from './naifPck';

const pck = parsePckAssignments(readFileSync('pipeline/fixtures/pck00011.tpc', 'utf8'));

describe('parsePckAssignments', () => {
  it('handles lists, scalars, +=, D exponents and skips text blocks and strings', () => {
    const text = [
      'BODY1_IGNORED = ( 9 9 9 )', // before any \\begindata: comment area
      'Data blocks follow a \\begindata token. Example: KEYWORD = VALUE', // prose, not a data block
      '        \\begindata', // indented tokens are real (pck00011 uses them)
      'BODY5_A = ( 1.5D0, -2 )',
      'BODY5_A += ( 3 )',
      "BODY5_NAME = 'JUPITER'",
      'BODY5_MAX_PHASE_DEGREE = 2',
      '\\begintext',
      'BODY5_B = ( 7 )',
    ].join('\n');
    const m = parsePckAssignments(text);
    expect(m.get('BODY5_A')).toEqual([1.5, -2, 3]);
    expect(m.get('BODY5_MAX_PHASE_DEGREE')).toEqual([2]);
    expect(m.has('BODY5_NAME')).toBe(false);
    expect(m.has('BODY5_B')).toBe(false);
    expect(m.has('BODY1_IGNORED')).toBe(false);
  });
});

describe('rotationModelFor (pck00011)', () => {
  it('reads the Sun without periodic terms', () => {
    expect(rotationModelFor(pck, 10)).toEqual({
      poleRa: [286.13, 0, 0], poleDec: [63.87, 0, 0], pm: [84.176, 14.1844, 0],
      nutPrecRa: [], nutPrecDec: [], nutPrecPm: [], nutPrecAngles: [],
    });
  });
  it('reads Jupiter with its 15 angle pairs', () => {
    const j = rotationModelFor(pck, 599);
    expect(j.pm).toEqual([284.95, 870.536, 0]);
    expect(j.nutPrecRa).toHaveLength(15);
    expect(j.nutPrecAngles.length).toBeGreaterThanOrEqual(15);
    expect(j.nutPrecAngles[10]).toEqual([99.360714, 4850.4046, 0]);
  });
  it('groups Mars angles in threes (MAX_PHASE_DEGREE = 2)', () => {
    const m = rotationModelFor(pck, 499);
    expect(m.nutPrecAngles).toHaveLength(26);
    expect(m.nutPrecAngles[4]).toEqual([189.6327156, 41215158.1842005, 12.711923222]);
    expect(m.nutPrecDec[19]).toBe(1.591274);
  });
  it("reads Neptune's N angle and Mercury's angles from the barycentre system", () => {
    expect(rotationModelFor(pck, 899).nutPrecAngles[0]).toEqual([357.85, 52.316, 0]);
    expect(rotationModelFor(pck, 199).nutPrecAngles[0]![0]).toBe(174.7910857);
  });
});

describe('radiiFor', () => {
  it('reads equatorial and polar radii', () => {
    expect(radiiFor(pck, 699)).toEqual({ equatorialRadiusKm: 60268, polarRadiusKm: 54364 });
    expect(radiiFor(pck, 399)).toEqual({ equatorialRadiusKm: 6378.1366, polarRadiusKm: 6356.7519 });
  });
  it('throws for unknown bodies', () => {
    expect(() => radiiFor(pck, 123456)).toThrow(/BODY123456_RADII/);
  });
});
```

- [ ] **Step 3: Run and confirm failure**

Run: `npx vitest run pipeline/sources/naifPck.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Create `pipeline/sources/naifPck.ts`**

```ts
import type { RotationModel } from '../../src/core/catalog/schema';

const ASSIGNMENT = /([A-Z][A-Z0-9_]*)\s*(\+?=)\s*(\([^)]*\)|[^\s()]+)/g;

/** Data lines only: a token counts only when it is alone on its line (NAIF rule; the header prose mentions it mid-sentence). */
function dataSection(text: string): string {
  const lines: string[] = [];
  let inData = false;
  for (const line of text.split(/\r?\n/)) {
    const token = line.trim();
    if (token === '\\begindata') inData = true;
    else if (token === '\\begintext') inData = false;
    else if (inData) lines.push(line);
  }
  return lines.join('\n');
}

export function parsePckAssignments(text: string): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const match of dataSection(text).matchAll(ASSIGNMENT)) {
    const name = match[1]!;
    const op = match[2]!;
    const tokens = match[3]!.replace(/^\(|\)$/g, '').split(/[\s,]+/).filter(Boolean);
    if (tokens.some((t) => t.startsWith("'"))) continue; // string-valued variable
    const values = tokens.map((t) => Number(t.replace(/[dD]/, 'e')));
    if (values.some((v) => !Number.isFinite(v))) throw new Error(`PCK: non-numeric value in ${name}`);
    out.set(name, op === '+=' ? [...(out.get(name) ?? []), ...values] : values);
  }
  return out;
}

export function rotationModelFor(pck: Map<string, number[]>, naifId: number): Omit<RotationModel, 'sourceId'> {
  const get = (key: string) => pck.get(`BODY${naifId}_${key}`);
  const poly3 = (key: string): [number, number, number] => {
    const v = get(key);
    if (!v) throw new Error(`PCK: missing BODY${naifId}_${key}`);
    return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
  };
  const system = naifId >= 100 ? Math.floor(naifId / 100) : null;
  const rawAngles = system === null ? [] : (pck.get(`BODY${system}_NUT_PREC_ANGLES`) ?? []);
  const degree = system === null ? 1 : (pck.get(`BODY${system}_MAX_PHASE_DEGREE`)?.[0] ?? 1);
  const group = degree + 1;
  const nutPrecAngles: Array<[number, number, number]> = [];
  for (let i = 0; i + group <= rawAngles.length; i += group) {
    nutPrecAngles.push([rawAngles[i]!, rawAngles[i + 1]!, group > 2 ? rawAngles[i + 2]! : 0]);
  }
  const nutPrecRa = get('NUT_PREC_RA') ?? [];
  const nutPrecDec = get('NUT_PREC_DEC') ?? [];
  const nutPrecPm = get('NUT_PREC_PM') ?? [];
  const longest = Math.max(nutPrecRa.length, nutPrecDec.length, nutPrecPm.length);
  if (longest > nutPrecAngles.length) {
    throw new Error(`PCK: body ${naifId} has ${longest} periodic coefficients but only ${nutPrecAngles.length} angles`);
  }
  return {
    poleRa: poly3('POLE_RA'),
    poleDec: poly3('POLE_DEC'),
    pm: poly3('PM'),
    nutPrecRa,
    nutPrecDec,
    nutPrecPm,
    nutPrecAngles: longest === 0 ? [] : nutPrecAngles,
  };
}

export function radiiFor(pck: Map<string, number[]>, naifId: number): { equatorialRadiusKm: number; polarRadiusKm: number } {
  const r = pck.get(`BODY${naifId}_RADII`);
  if (!r || r.length !== 3) throw new Error(`PCK: missing or malformed BODY${naifId}_RADII`);
  return { equatorialRadiusKm: r[0]!, polarRadiusKm: r[2]! };
}
```

Bodies with no periodic terms get `nutPrecAngles: []` (Saturn, for example, would otherwise inherit the Saturn-system angles used only by its moons).

- [ ] **Step 5: Run tests**

Run: `npx vitest run pipeline/sources/naifPck.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add pipeline/sources/naifPck.ts pipeline/sources/naifPck.test.ts pipeline/fixtures/pck00011.tpc
git commit -m "feat(pipeline): add NAIF PCK parser for IAU rotation models and radii" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: NASA Science descriptions and the source registry

**Files:**
- Create: `pipeline/sources/nasaScience.ts`, `pipeline/sources/registry.ts`
- Test: `pipeline/sources/nasaScience.test.ts`

**Interfaces:**
- Consumes: `parseHtml`, `decodeEntities` (Task 9); `Source` (Task 6).
- Produces (`nasaScience.ts`): `DESCRIPTION_PAGES: Record<'sun' | 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune', string>`; `parseMetaDescription(html: string): string`.
- Produces (`registry.ts`): `interface SourceSpec { id: string; title: string; publisher: string; url: string; license: string }`; `SOURCE_SPECS: { jplApproxPos; jplHorizons; nssdcaPlanets; nssdcaSun; naifPck: SourceSpec }`; `nasaScienceSpec(bodyId: string, name: string, url: string): SourceSpec`; `toSource(spec: SourceSpec, retrievedAt: string): Source`.

Checked while writing this plan: each overview page's `<meta name="description">` is a one- or two-sentence summary, except Earth's overview (a slogan), so Earth uses `/earth/facts/`.

- [ ] **Step 1: Write the failing tests `pipeline/sources/nasaScience.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { DESCRIPTION_PAGES, parseMetaDescription } from './nasaScience';
import { nasaScienceSpec, SOURCE_SPECS, toSource } from './registry';

describe('parseMetaDescription', () => {
  it('reads and decodes the meta description', () => {
    const html = '<html><head><meta name="description" content="Mercury is the closest planet to the Sun, and the smallest planet in our solar system - only slightly larger than Earth&#039;s Moon."></head></html>';
    expect(parseMetaDescription(html)).toBe("Mercury is the closest planet to the Sun, and the smallest planet in our solar system - only slightly larger than Earth's Moon.");
  });
  it('throws when there is no description', () => {
    expect(() => parseMetaDescription('<html><head></head></html>')).toThrow(/meta description/);
  });
});

describe('source registry', () => {
  it('covers the Sun and eight planets, with Earth on its facts page', () => {
    expect(Object.keys(DESCRIPTION_PAGES)).toEqual(['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
    expect(DESCRIPTION_PAGES.earth).toBe('https://science.nasa.gov/earth/facts/');
  });
  it('builds Source records with a retrieval date', () => {
    expect(toSource(SOURCE_SPECS.naifPck, '2026-10-04')).toMatchObject({ id: 'naif-pck00011', retrievedAt: '2026-10-04' });
    expect(nasaScienceSpec('jupiter', 'Jupiter', DESCRIPTION_PAGES.jupiter)).toMatchObject({ id: 'nasa-science-jupiter', publisher: 'NASA' });
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run pipeline/sources/nasaScience.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Create `pipeline/sources/nasaScience.ts`**

```ts
import { decodeEntities, parseHtml } from '../lib/html';

export const DESCRIPTION_PAGES = {
  sun: 'https://science.nasa.gov/sun/',
  mercury: 'https://science.nasa.gov/mercury/',
  venus: 'https://science.nasa.gov/venus/',
  earth: 'https://science.nasa.gov/earth/facts/',
  mars: 'https://science.nasa.gov/mars/',
  jupiter: 'https://science.nasa.gov/jupiter/',
  saturn: 'https://science.nasa.gov/saturn/',
  uranus: 'https://science.nasa.gov/uranus/',
  neptune: 'https://science.nasa.gov/neptune/',
} as const;

export function parseMetaDescription(html: string): string {
  const meta = parseHtml(html)
    .querySelectorAll('meta')
    .find((m) => m.getAttribute('name') === 'description');
  const text = decodeEntities(meta?.getAttribute('content') ?? '').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('NASA Science page has no meta description');
  return text;
}
```

- [ ] **Step 4: Create `pipeline/sources/registry.ts`**

```ts
import type { Source } from '../../src/core/catalog/schema';

export interface SourceSpec {
  id: string;
  title: string;
  publisher: string;
  url: string;
  license: string;
}

const NASA_PUBLIC_DOMAIN = 'NASA public domain (NASA media usage guidelines)';
const JPL_CONTENT = 'NASA/JPL public web content (JPL Image Use Policy, https://www.jpl.nasa.gov/jpl-image-use-policy)';

export const SOURCE_SPECS = {
  jplApproxPos: {
    id: 'jpl-approx-pos',
    title: 'Approximate Positions of the Planets (E. M. Standish and J. G. Williams)',
    publisher: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
    license: JPL_CONTENT,
  },
  jplHorizons: {
    id: 'jpl-horizons',
    title: 'Horizons System reference vectors (system barycentres, ecliptic J2000)',
    publisher: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/horizons/',
    license: JPL_CONTENT,
  },
  nssdcaPlanets: {
    id: 'nssdca-planetary-fact-sheet',
    title: 'Planetary Fact Sheet - Metric (D. R. Williams)',
    publisher: 'NASA Goddard Space Flight Center, NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/',
    license: NASA_PUBLIC_DOMAIN,
  },
  nssdcaSun: {
    id: 'nssdca-sun-fact-sheet',
    title: 'Sun Fact Sheet (D. R. Williams)',
    publisher: 'NASA Goddard Space Flight Center, NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html',
    license: NASA_PUBLIC_DOMAIN,
  },
  naifPck: {
    id: 'naif-pck00011',
    title: 'PCK00011 planetary constants kernel (IAU WGCCRE 2015 report values)',
    publisher: 'NASA/JPL Navigation and Ancillary Information Facility (NAIF)',
    url: 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc',
    license: NASA_PUBLIC_DOMAIN,
  },
} satisfies Record<string, SourceSpec>;

export function nasaScienceSpec(bodyId: string, name: string, url: string): SourceSpec {
  return { id: `nasa-science-${bodyId}`, title: `${name} - NASA Science`, publisher: 'NASA', url, license: NASA_PUBLIC_DOMAIN };
}

export function toSource(spec: SourceSpec, retrievedAt: string): Source {
  return { ...spec, retrievedAt };
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run pipeline/sources/nasaScience.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add pipeline/sources/nasaScience.ts pipeline/sources/nasaScience.test.ts pipeline/sources/registry.ts
git commit -m "feat(pipeline): add NASA Science descriptions and source registry" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Build, validate and emit the Solar System data; document the sources

**Files:**
- Create: `pipeline/build/buildSolarSystem.ts`, `pipeline/build/validate.ts`, `pipeline/run.ts`, `public/data/regions.json`, `public/data/sources.json`, `public/data/solar-system/bodies.json` (generated)
- Create (vault): `Space_visualizer/Data Sources/JPL Approximate Positions of the Planets.md`, `Space_visualizer/Data Sources/JPL Horizons.md`, `Space_visualizer/Data Sources/NSSDCA Planetary Fact Sheet.md`, `Space_visualizer/Data Sources/NSSDCA Sun Fact Sheet.md`, `Space_visualizer/Data Sources/NAIF PCK00011.md`, `Space_visualizer/Data Sources/NASA Science pages.md`, `Space_visualizer/Data Sources/IERS leap seconds.md`, `Space_visualizer/Data Sources/NASA Delta T polynomials.md`
- Modify (vault): `Space_visualizer/Home.md` (Data Sources list)
- Test: `pipeline/build/buildSolarSystem.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 6, 7, 9, 10, 11, 12; `calendarToJd` (Task 3); `selectTable`, `planetApproxState`, `elementsAt` (Task 7); `poleEcliptic` (Task 8); `orbitNormal` (Task 5).
- Produces (`buildSolarSystem.ts`): `interface PipelineInputs { approxPos: FetchedText; planetSheet: FetchedText; sunSheet: FetchedText; pck: FetchedText; descriptions: Record<keyof typeof DESCRIPTION_PAGES, FetchedText>; horizons: HorizonsReference }`; `interface PipelineOutput { regions: RegionsFile; sources: SourcesFile; bodies: BodiesFile }`; `PLANET_SPECS`; `SOLAR_SYSTEM_REGION`; `buildSolarSystem(inputs, generatedAt: string): PipelineOutput`.
- Produces (`validate.ts`): `validateOutput(output: PipelineOutput): string[]` (empty = valid).
- Produces (files): `public/data/regions.json`, `public/data/sources.json`, `public/data/solar-system/bodies.json`, which the app loads in Task 15.

- [ ] **Step 1: Write the failing tests `pipeline/build/buildSolarSystem.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RAD } from '../../src/core/math/angles';
import { angleBetween } from '../../src/core/math/vec3';
import { orbitNormal } from '../../src/core/ephemeris/conic';
import { elementsAt } from '../../src/core/ephemeris/planetApprox';
import { poleEcliptic } from '../../src/core/frames/rotation';
import type { FetchedText } from '../lib/fetchCached';
import { DESCRIPTION_PAGES } from '../sources/nasaScience';
import type { HorizonsReference } from '../sources/horizons';
import { buildSolarSystem } from './buildSolarSystem';
import { validateOutput } from './validate';

const fixture = (name: string): FetchedText => ({ text: readFileSync(`pipeline/fixtures/${name}`, 'utf8'), retrievedAt: '2026-10-04', fromCache: true });
const descriptions = Object.fromEntries(
  Object.keys(DESCRIPTION_PAGES).map((id) => [id, { text: `<meta name="description" content="Test description for ${id}.">`, retrievedAt: '2026-10-04', fromCache: true }]),
) as Record<keyof typeof DESCRIPTION_PAGES, FetchedText>;
const horizons = JSON.parse(readFileSync('pipeline/reference/horizons-heliocentric.json', 'utf8')) as HorizonsReference;

const out = buildSolarSystem(
  { approxPos: fixture('approx_pos.html'), planetSheet: fixture('planet-factsheet.html'), sunSheet: fixture('sun-factsheet.html'), pck: fixture('pck00011.tpc'), descriptions, horizons },
  '2026-10-04T12:00:00.000Z',
);
const body = (id: string) => out.bodies.bodies.find((b) => b.id === id)!;

describe('buildSolarSystem', () => {
  it('produces valid, fully sourced output', () => {
    expect(validateOutput(out)).toEqual([]);
  });

  it('contains the Sun and the eight planets in order', () => {
    expect(out.bodies.bodies.map((b) => b.id)).toEqual(['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
  });

  it('maps Jupiter facts with SI units and sources, omitting unknown values', () => {
    const j = body('jupiter');
    expect(j.facts.massKg?.value).toBeCloseTo(1.898e27, -22);
    expect(j.facts.massKg?.sourceId).toBe('nssdca-planetary-fact-sheet');
    expect(j.facts.meanDistanceFromSunKm?.value).toBe(778.5e6);
    expect(j.facts.surfacePressureBar).toBeUndefined();
    expect(j.facts.semiMajorAxisAu).toMatchObject({ value: 5.202887, sourceId: 'jpl-approx-pos' });
    expect(j.shape).toEqual({ equatorialRadiusKm: 71492, polarRadiusKm: 66854, sourceId: 'naif-pck00011' });
    expect(j.description).toEqual({ text: 'Test description for jupiter.', sourceId: 'nasa-science-jupiter' });
  });

  it('maps the Sun from the Sun fact sheet', () => {
    const s = body('sun');
    expect(s.facts.massKg?.value).toBeCloseTo(1.9884e30, -25);
    expect(s.facts.spectralType?.value).toBe('G2 V');
    expect(s.orbit).toMatchObject({ type: 'fixed', positionKm: [0, 0, 0] });
  });

  it('marks Earth as the Earth-Moon barycentre and uses calendar-derived table ranges', () => {
    const orbit = body('earth').orbit;
    if (orbit.type !== 'planet-approx') throw new Error('expected planet-approx');
    expect(orbit.represents).toBe('earth-moon-barycenter');
    expect(orbit.tables.map((t) => [t.id, t.validFromJdTdb, t.validToJdTdb])).toEqual([
      ['1800-2050', 2378496.5, 2470172.5],
      ['3000BC-3000AD', 625673.5, 2817152.5],
    ]);
  });

  it('records the error measured against Horizons, showing Neptune exceeds the JPL nominal', () => {
    const orbit = body('neptune').orbit;
    if (orbit.type !== 'planet-approx') throw new Error('expected planet-approx');
    const t1 = orbit.tables[0]!;
    expect(t1.horizonsCheck?.sampleCount).toBe(6);
    expect(t1.horizonsCheck?.sourceId).toBe('jpl-horizons');
    expect(t1.horizonsCheck!.maxDistanceErrorKm).toBeGreaterThan(t1.nominalError.distanceKm);
    expect(orbit.tables[1]!.horizonsCheck?.sampleCount).toBe(3);
  });

  it('agrees with NSSDCA obliquity within 0.15 deg (IAU poles; retrograde rotators measured from the IAU north pole)', () => {
    for (const id of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
      const b = body(id);
      if (b.orbit.type !== 'planet-approx' || !b.rotation) throw new Error(id);
      const angle = angleBetween(poleEcliptic(b.rotation, 2451545.0), orbitNormal(elementsAt(b.orbit.tables[0]!, 2451545.0))) * RAD;
      const obliquity = b.facts.obliquityDeg!.value as number;
      const expected = obliquity > 90 ? 180 - obliquity : obliquity;
      expect(Math.abs(angle - expected), id).toBeLessThanOrEqual(0.15);
    }
  });

  it('fails validation when a referenced source is missing', () => {
    const broken = structuredClone(out);
    broken.sources.sources = broken.sources.sources.filter((s) => s.id !== 'naif-pck00011');
    expect(validateOutput(broken).some((e) => e.includes('unknown sourceId "naif-pck00011"'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run pipeline/build`
Expected: FAIL, modules not found.

- [ ] **Step 3: Create `pipeline/build/validate.ts`**

```ts
import { findUnresolvedSources, formatIssues } from '../../src/core/catalog/references';
import { BodiesFileSchema, RegionsFileSchema, SourcesFileSchema } from '../../src/core/catalog/schema';
import type { PipelineOutput } from './buildSolarSystem';

export function validateOutput(output: PipelineOutput): string[] {
  const errors: string[] = [];
  const regions = RegionsFileSchema.safeParse(output.regions);
  if (!regions.success) errors.push(...formatIssues('regions.json', regions.error));
  const sources = SourcesFileSchema.safeParse(output.sources);
  if (!sources.success) errors.push(...formatIssues('sources.json', sources.error));
  const bodies = BodiesFileSchema.safeParse(output.bodies);
  if (!bodies.success) errors.push(...formatIssues('solar-system/bodies.json', bodies.error));

  const ids = output.sources.sources.map((s) => s.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length) errors.push(`sources.json: duplicate source ids ${duplicates.join(', ')}`);
  errors.push(...findUnresolvedSources(output.bodies, new Set(ids)).map((e) => `solar-system/bodies.json: ${e}`));
  return errors;
}
```

- [ ] **Step 4: Create `pipeline/build/buildSolarSystem.ts`**

```ts
import type { FactKey } from '../../src/core/catalog/facts';
import type { ApproxTable, Body, BodiesFile, PlanetApproxOrbit, Region, RegionsFile, SourcedValue, SourcesFile } from '../../src/core/catalog/schema';
import { planetApproxState, selectTable } from '../../src/core/ephemeris/planetApprox';
import { ARCSEC } from '../../src/core/math/angles';
import { angleBetween, length, type Vec3 } from '../../src/core/math/vec3';
import { calendarToJd } from '../../src/core/time/julian';
import type { FetchedText } from '../lib/fetchCached';
import type { HorizonsReference } from '../sources/horizons';
import { parseApproxPos, type ApproxPosData, type ApproxRow } from '../sources/jplApproxPos';
import { parsePckAssignments, radiiFor, rotationModelFor } from '../sources/naifPck';
import { DESCRIPTION_PAGES, parseMetaDescription } from '../sources/nasaScience';
import { parsePlanetFactSheet, parseSunFactSheet, parseSunNumber, planetFact, sunFact, type PlanetFactSheet } from '../sources/nssdcFactSheet';
import { nasaScienceSpec, SOURCE_SPECS, toSource } from '../sources/registry';

type DescribedBody = keyof typeof DESCRIPTION_PAGES;

export interface PipelineInputs {
  approxPos: FetchedText;
  planetSheet: FetchedText;
  sunSheet: FetchedText;
  pck: FetchedText;
  descriptions: Record<DescribedBody, FetchedText>;
  horizons: HorizonsReference;
}

export interface PipelineOutput {
  regions: RegionsFile;
  sources: SourcesFile;
  bodies: BodiesFile;
}

interface PlanetSpec {
  id: Exclude<DescribedBody, 'sun'>;
  name: string;
  naifId: number;
  column: string;
  approxRow: ApproxRow;
  color: string;
  represents: PlanetApproxOrbit['represents'];
}

/** Display colours are illustrative only (no official surface maps in M1). */
export const PLANET_SPECS: PlanetSpec[] = [
  { id: 'mercury', name: 'Mercury', naifId: 199, column: 'MERCURY', approxRow: 'Mercury', color: '#9a9894', represents: 'planet' },
  { id: 'venus', name: 'Venus', naifId: 299, column: 'VENUS', approxRow: 'Venus', color: '#e2c48e', represents: 'planet' },
  { id: 'earth', name: 'Earth', naifId: 399, column: 'EARTH', approxRow: 'EM Bary', color: '#4c7bd0', represents: 'earth-moon-barycenter' },
  { id: 'mars', name: 'Mars', naifId: 499, column: 'MARS', approxRow: 'Mars', color: '#c4673d', represents: 'planet' },
  { id: 'jupiter', name: 'Jupiter', naifId: 599, column: 'JUPITER', approxRow: 'Jupiter', color: '#d6b48a', represents: 'planet' },
  { id: 'saturn', name: 'Saturn', naifId: 699, column: 'SATURN', approxRow: 'Saturn', color: '#e5d09c', represents: 'planet' },
  { id: 'uranus', name: 'Uranus', naifId: 799, column: 'URANUS', approxRow: 'Uranus', color: '#a3dbe2', represents: 'planet' },
  { id: 'neptune', name: 'Neptune', naifId: 899, column: 'NEPTUNE', approxRow: 'Neptune', color: '#4b70d8', represents: 'planet' },
];

export const SOLAR_SYSTEM_REGION: Region = {
  id: 'solar-system',
  name: 'Solar System',
  parentId: null,
  frame: 'heliocentric-ecliptic-j2000',
  unit: 'km',
  originInParentKm: [0, 0, 0],
  activeRangeKm: [0, 1e13],
  dataManifest: 'solar-system/bodies.json',
};

const midnight = (year: number, month: number, day: number) => calendarToJd({ year, month, day, hour: 0, minute: 0, second: 0 });
const TABLE1_RANGE: [number, number] = [midnight(1800, 1, 1), midnight(2051, 1, 1)];
const TABLE2_RANGE: [number, number] = [midnight(-2999, 1, 1), midnight(3001, 1, 1)];

const PLANET_FACT_ROWS: Array<{ key: FactKey; row: string; scale?: number; note?: string }> = [
  { key: 'massKg', row: 'Mass', scale: 1e24 },
  { key: 'equatorialDiameterKm', row: 'Diameter' },
  { key: 'densityKgM3', row: 'Density' },
  { key: 'surfaceGravityMS2', row: 'Gravity' },
  { key: 'escapeVelocityKmS', row: 'Escape Velocity' },
  { key: 'siderealRotationHours', row: 'Rotation Period', note: 'Negative values indicate retrograde rotation (NSSDCA convention).' },
  { key: 'lengthOfDayHours', row: 'Length of Day' },
  { key: 'meanDistanceFromSunKm', row: 'Distance from Sun', scale: 1e6 },
  { key: 'perihelionKm', row: 'Perihelion', scale: 1e6 },
  { key: 'aphelionKm', row: 'Aphelion', scale: 1e6 },
  { key: 'orbitalPeriodDays', row: 'Orbital Period' },
  { key: 'meanOrbitalVelocityKmS', row: 'Orbital Velocity' },
  { key: 'orbitalInclinationDeg', row: 'Orbital Inclination' },
  { key: 'orbitalEccentricity', row: 'Orbital Eccentricity' },
  { key: 'obliquityDeg', row: 'Obliquity to Orbit' },
  { key: 'meanTemperatureC', row: 'Mean Temperature' },
  { key: 'surfacePressureBar', row: 'Surface Pressure' },
  { key: 'moonCount', row: 'Number of Moons' },
  { key: 'hasRingSystem', row: 'Ring System?' },
  { key: 'hasGlobalMagneticField', row: 'Global Magnetic Field?' },
];

function planetFacts(sheet: PlanetFactSheet, spec: PlanetSpec, approx: ApproxPosData): Body['facts'] {
  const facts: Body['facts'] = {};
  for (const { key, row, scale, note } of PLANET_FACT_ROWS) {
    const cell = planetFact(sheet, row, spec.column);
    if (cell === undefined) continue; // "Unknown" in the source: omit rather than invent
    const value = typeof cell === 'number' && scale ? cell * scale : cell;
    facts[key] = { value, sourceId: SOURCE_SPECS.nssdcaPlanets.id, ...(note ? { note } : {}) };
  }
  facts.semiMajorAxisAu = {
    value: approx.table1[spec.approxRow].elements.a,
    note: 'J2000 value from JPL Table 1 (1800–2050) elements.',
    sourceId: SOURCE_SPECS.jplApproxPos.id,
  };
  return facts;
}

function sunFacts(sheet: Map<string, string>): Body['facts'] {
  const id = SOURCE_SPECS.nssdcaSun.id;
  const num = (label: string, scale = 1, note?: string): SourcedValue => ({
    value: parseSunNumber(sunFact(sheet, label)) * scale,
    sourceId: id,
    ...(note ? { note } : {}),
  });
  return {
    massKg: num('Mass (', 1e24),
    meanRadiusKm: num('Volumetric mean radius'),
    densityKgM3: num('Mean density'),
    surfaceGravityMS2: num('Surface gravity', 1, 'At the equator.'),
    escapeVelocityKmS: num('Escape velocity'),
    absoluteMagnitude: num('Absolute magnitude'),
    luminosityW: num('Luminosity', 1e24),
    spectralType: { value: sunFact(sheet, 'Spectral type'), sourceId: id },
    siderealRotationHours: num('Sidereal rotation period', 1, "Adopted period at 16° latitude; the Sun's rotation rate varies with latitude."),
    obliquityDeg: num('Obliquity to ecliptic', 1, "Tilt of the Sun's equator relative to the ecliptic."),
  };
}

function approxOrbit(approx: ApproxPosData, spec: PlanetSpec): PlanetApproxOrbit {
  const row = spec.approxRow;
  const extra = approx.table2b[row];
  const table1: ApproxTable = {
    id: '1800-2050',
    validFromJdTdb: TABLE1_RANGE[0],
    validToJdTdb: TABLE1_RANGE[1],
    elements: approx.table1[row].elements,
    ratesPerCentury: approx.table1[row].rates,
    nominalError: approx.nominalErrors[row].table1,
  };
  const table2: ApproxTable = {
    id: '3000BC-3000AD',
    validFromJdTdb: TABLE2_RANGE[0],
    validToJdTdb: TABLE2_RANGE[1],
    elements: approx.table2a[row].elements,
    ratesPerCentury: approx.table2a[row].rates,
    nominalError: approx.nominalErrors[row].table2,
    ...(extra ? { extraTerms: extra } : {}),
  };
  return { type: 'planet-approx', sourceId: SOURCE_SPECS.jplApproxPos.id, represents: spec.represents, tables: [table1, table2] };
}

/** Attach the maximum error against the committed Horizons reference to each table. */
function withHorizonsCheck(orbit: PlanetApproxOrbit, bodyId: string, horizons: HorizonsReference): PlanetApproxOrbit {
  const samples = horizons.samples.filter((s) => s.body === bodyId);
  const tables = orbit.tables.map((table, index) => {
    let count = 0;
    let maxAngle = 0;
    let maxDistance = 0;
    for (const sample of samples) {
      const selected = selectTable(orbit.tables, sample.jdTdb);
      if (selected.index !== index || !selected.inValidRange) continue;
      const p = planetApproxState(orbit, sample.jdTdb).positionKm;
      const ref = sample.positionKm as unknown as Vec3;
      count += 1;
      maxAngle = Math.max(maxAngle, angleBetween(p, ref) / ARCSEC);
      maxDistance = Math.max(maxDistance, Math.abs(length(p) - length(ref)));
    }
    if (count === 0) return table;
    return {
      ...table,
      horizonsCheck: {
        sampleCount: count,
        maxAngularErrorArcsec: Math.round(maxAngle * 10) / 10,
        maxDistanceErrorKm: Math.round(maxDistance),
        sourceId: SOURCE_SPECS.jplHorizons.id,
      },
    };
  });
  return { ...orbit, tables };
}

export function buildSolarSystem(inputs: PipelineInputs, generatedAt: string): PipelineOutput {
  const approx = parseApproxPos(inputs.approxPos.text);
  const planetSheet = parsePlanetFactSheet(inputs.planetSheet.text);
  const sunSheet = parseSunFactSheet(inputs.sunSheet.text);
  const pck = parsePckAssignments(inputs.pck.text);
  const pckId = SOURCE_SPECS.naifPck.id;
  const description = (id: DescribedBody) => ({ text: parseMetaDescription(inputs.descriptions[id].text), sourceId: `nasa-science-${id}` });

  const sun: Body = {
    id: 'sun',
    name: 'Sun',
    category: 'star',
    parentId: null,
    regionId: SOLAR_SYSTEM_REGION.id,
    naifId: 10,
    facts: sunFacts(sunSheet),
    orbit: { type: 'fixed', positionKm: [0, 0, 0], note: 'The Sun is the origin of the heliocentric frame used for all positions.' },
    rotation: { sourceId: pckId, ...rotationModelFor(pck, 10) },
    shape: { ...radiiFor(pck, 10), sourceId: pckId },
    description: description('sun'),
    texture: null,
    display: { color: '#ffd27a', note: 'illustrative' },
  };

  const planets: Body[] = PLANET_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    category: 'planet',
    parentId: 'sun',
    regionId: SOLAR_SYSTEM_REGION.id,
    naifId: spec.naifId,
    facts: planetFacts(planetSheet, spec, approx),
    orbit: withHorizonsCheck(approxOrbit(approx, spec), spec.id, inputs.horizons),
    rotation: { sourceId: pckId, ...rotationModelFor(pck, spec.naifId) },
    shape: { ...radiiFor(pck, spec.naifId), sourceId: pckId },
    description: description(spec.id),
    texture: null,
    display: { color: spec.color, note: 'illustrative' },
  }));

  const sources = [
    toSource(SOURCE_SPECS.jplApproxPos, inputs.approxPos.retrievedAt),
    toSource(SOURCE_SPECS.jplHorizons, inputs.horizons.retrievedAt),
    toSource(SOURCE_SPECS.nssdcaPlanets, inputs.planetSheet.retrievedAt),
    toSource(SOURCE_SPECS.nssdcaSun, inputs.sunSheet.retrievedAt),
    toSource(SOURCE_SPECS.naifPck, inputs.pck.retrievedAt),
    toSource(nasaScienceSpec('sun', 'The Sun', DESCRIPTION_PAGES.sun), inputs.descriptions.sun.retrievedAt),
    ...PLANET_SPECS.map((spec) =>
      toSource(nasaScienceSpec(spec.id, spec.id === 'earth' ? 'Earth Facts' : spec.name, DESCRIPTION_PAGES[spec.id]), inputs.descriptions[spec.id].retrievedAt),
    ),
  ];

  return {
    regions: { schemaVersion: 1, regions: [SOLAR_SYSTEM_REGION] },
    sources: { schemaVersion: 1, sources },
    bodies: { schemaVersion: 1, regionId: SOLAR_SYSTEM_REGION.id, generatedAt, bodies: [sun, ...planets] },
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run pipeline/build`
Expected: all PASS.

- [ ] **Step 6: Create `pipeline/run.ts`**

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSolarSystem } from './build/buildSolarSystem';
import { validateOutput } from './build/validate';
import { fetchCached, type FetchedText, type FetchOptions } from './lib/fetchCached';
import type { HorizonsReference } from './sources/horizons';
import { DESCRIPTION_PAGES } from './sources/nasaScience';
import { SOURCE_SPECS } from './sources/registry';

const options: FetchOptions = {
  offline: process.argv.includes('--offline'),
  rawDir: path.resolve('pipeline/raw'),
  log: (message) => console.warn(message),
};
const OUT_DIR = path.resolve('public/data');

async function writeJson(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

try {
  const approxPos = await fetchCached(SOURCE_SPECS.jplApproxPos.url, 'approx_pos.html', options);
  const planetSheet = await fetchCached(SOURCE_SPECS.nssdcaPlanets.url, 'planet-factsheet.html', options);
  const sunSheet = await fetchCached(SOURCE_SPECS.nssdcaSun.url, 'sun-factsheet.html', options);
  const pck = await fetchCached(SOURCE_SPECS.naifPck.url, 'pck00011.tpc', options);
  const descriptions = {} as Record<keyof typeof DESCRIPTION_PAGES, FetchedText>;
  for (const [id, url] of Object.entries(DESCRIPTION_PAGES) as Array<[keyof typeof DESCRIPTION_PAGES, string]>) {
    descriptions[id] = await fetchCached(url, `nasa-science-${id}.html`, options);
  }
  const horizons = JSON.parse(await readFile('pipeline/reference/horizons-heliocentric.json', 'utf8')) as HorizonsReference;

  const output = buildSolarSystem({ approxPos, planetSheet, sunSheet, pck, descriptions, horizons }, new Date().toISOString());
  const errors = validateOutput(output);
  if (errors.length > 0) {
    console.error(`Validation failed; public/data was NOT changed:\n${errors.join('\n')}`);
    process.exit(1);
  }
  await writeJson(path.join(OUT_DIR, 'regions.json'), output.regions);
  await writeJson(path.join(OUT_DIR, 'sources.json'), output.sources);
  await writeJson(path.join(OUT_DIR, 'solar-system/bodies.json'), output.bodies);
  console.log(`Wrote ${output.bodies.bodies.length} bodies and ${output.sources.sources.length} sources to ${OUT_DIR}`);
} catch (error) {
  console.error(`Data pipeline failed; public/data was NOT changed.\n${String(error)}`);
  process.exit(1);
}
```

- [ ] **Step 7: Generate the data (network)**

Run: `npm run data`
Expected: `Wrote 9 bodies and 14 sources to ...public\data`. Open `public/data/solar-system/bodies.json` and check that Jupiter's description begins "Jupiter is the fifth planet from the Sun" and that Neptune's first table has a `horizonsCheck`.

Then run: `npm run data:offline`
Expected: the same output, built only from `pipeline/raw/` (proves the cache path works).

- [ ] **Step 8: Write the Data Sources vault notes**

Create each note in `Space_visualizer/Data Sources/` with this template, filled from the table below:

```markdown
---
title: <Source name>
publisher: <publisher>
url: <url>
used-for: [<list>]
tags: [data-source]
---

# <Source name>

Back to [[Home]]

- **Publisher:** <publisher>
- **URL:** <url>
- **Used for:** <what it feeds in the app>
- **Accuracy / caveats:** <caveats>
- **License:** <license>
- **How it is refreshed:** <command>
- **Parsed by:** `<file>`
```

| Note | Publisher / URL | Used for | Accuracy / caveats | Refresh · Parser |
|---|---|---|---|---|
| JPL Approximate Positions of the Planets | NASA/JPL SSD · https://ssd.jpl.nasa.gov/planets/approx_pos.html | Planet orbits (Tables 1, 2a, 2b), nominal errors, J2000 semi-major axes | Nominal errors 10″–600″ (1800–2050) and up to 2000″ (3000 BC–AD 3000). Elements are a best fit and invalid outside their ranges. Neptune with Table 1 measured at up to ~4.5× / 7× its published nominal (see [[JPL Horizons]]). | `npm run data` · `pipeline/sources/jplApproxPos.ts` |
| JPL Horizons | NASA/JPL SSD · https://ssd.jpl.nasa.gov/horizons/ | Reference vectors (system barycentres 1–8, Sun centre, ecliptic J2000, TDB) to test and measure the planet model | Planet-centre ephemerides only cover limited spans (e.g. Jupiter 1600–2200), hence barycentres. | `npm run horizons:reference` · `pipeline/sources/horizons.ts` |
| NSSDCA Planetary Fact Sheet | NASA GSFC NSSDCA (D. R. Williams) · https://nssdc.gsfc.nasa.gov/planetary/factsheet/ | Planet physical and orbital facts | Values are rounded. "Unknown" entries are omitted. Negative rotation periods mean retrograde rotation. Moon counts change as discoveries are confirmed. | `npm run data` · `pipeline/sources/nssdcFactSheet.ts` |
| NSSDCA Sun Fact Sheet | NASA GSFC NSSDCA · https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html | Sun facts | The rotation period is the adopted value at 16° latitude. | `npm run data` · `pipeline/sources/nssdcFactSheet.ts` |
| NAIF PCK00011 | NASA/JPL NAIF · https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc | IAU WGCCRE 2015 rotation models (pole, prime meridian, periodic terms) and shape radii | The IAU "north pole" is the pole north of the invariable plane, so Venus and Uranus show 180° − obliquity relative to their orbit normal. | `npm run data` · `pipeline/sources/naifPck.ts` |
| NASA Science pages | NASA · https://science.nasa.gov/ | One-sentence descriptions (`meta description`) | Earth uses `/earth/facts/` because its overview description is a slogan. | `npm run data` · `pipeline/sources/nasaScience.ts` |
| IERS leap seconds | IERS · https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat | TAI − UTC table in `src/core/time/timescales.ts` | Checked 2026-10-04: last entry 2017-01-01 (37 s). Update the table if IERS announces a new leap second. | manual · `src/core/time/timescales.ts` |
| NASA Delta T polynomials | NASA GSFC (Espenak & Meeus) · https://eclipse.gsfc.nasa.gov/SEhelp/deltatpoly2004.html | TT − UT before 1972 | Uncertainty grows to minutes or hours in antiquity; negligible for planet positions at this model's accuracy. | manual · `src/core/time/timescales.ts` |

Licenses: JPL pages use `NASA/JPL public web content (JPL Image Use Policy)`; all others use `NASA public domain`, except IERS (`IERS public data product`).

In `Space_visualizer/Home.md`, replace the `_One note per official source..._` line under **Data Sources** with a wikilink list of the eight notes.

- [ ] **Step 9: Run the whole test suite and type checker**

Run: `npm test` then `npm run typecheck`
Expected: all PASS; typecheck exits 0.

- [ ] **Step 10: Commit**

```powershell
git add pipeline/build pipeline/run.ts public/data "Space_visualizer/Data Sources" Space_visualizer/Home.md
git commit -m "feat(pipeline): build, validate and emit sourced Solar System data" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Catalogue access, body state dispatch and region visibility

**Files:**
- Create: `src/core/catalog/catalog.ts`, `src/core/ephemeris/state.ts`, `src/core/regions/regionManager.ts`
- Test: `src/core/catalog/catalog.test.ts`, `src/core/ephemeris/state.test.ts`, `src/core/regions/regionManager.test.ts`

**Interfaces:**
- Consumes: schema types (Task 6); `planetApproxState`, `selectTable` (Task 7); `BodyState` (Task 7); `Vec3`, `add`, `length`, `sub` (Task 2); fixtures (Task 6).
- Produces (`catalog.ts`): `interface Catalog { regions: readonly Region[]; sources: ReadonlyMap<string, Source>; bodies: readonly Body[]; bodyById: ReadonlyMap<string, Body> }`; `createCatalog(regions: RegionsFile, sources: SourcesFile, bodiesFiles: readonly BodiesFile[]): Catalog`; `getBody(catalog, id): Body`.
- Produces (`state.ts`): `bodyState(body: Body, jdTdb: number): BodyState`; `type ValidityStatus = 'high' | 'extended' | 'out-of-range'`; `validityStatus(bodies: readonly Body[], jdTdb: number): ValidityStatus`.
- Produces (`regionManager.ts`): `FADE_BAND_DEX = 0.3`; `regionOpacity(region: Region, cameraDistanceKm: number): number` (0..1); `regionOriginInRootKm(region, byId: ReadonlyMap<string, Region>): Vec3`; `regionVisibility(regions: readonly Region[], cameraPositionKm: Vec3): Map<string, number>`.

- [ ] **Step 1: Write the failing tests**

`src/core/catalog/catalog.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { makeCatalogFiles } from '../../test/fixtures';
import { createCatalog, getBody } from './catalog';

describe('createCatalog', () => {
  it('indexes bodies and sources', () => {
    const f = makeCatalogFiles();
    const catalog = createCatalog(f.regions, f.sources, [f.bodies]);
    expect(catalog.bodies.map((b) => b.id)).toEqual(['sun', 'earth', 'jupiter']);
    expect(getBody(catalog, 'jupiter').name).toBe('Jupiter');
    expect(catalog.sources.get('naif-pck00011')?.publisher).toContain('NAIF');
  });
  it('rejects duplicate body ids and unknown lookups', () => {
    const f = makeCatalogFiles();
    expect(() => createCatalog(f.regions, f.sources, [f.bodies, f.bodies])).toThrow(/Duplicate body id "sun"/);
    expect(() => getBody(createCatalog(f.regions, f.sources, [f.bodies]), 'vulcan')).toThrow(/Unknown body "vulcan"/);
  });
});
```

`src/core/ephemeris/state.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { TABLE1_RANGE, TABLE2_RANGE } from '../../test/approxOrbits';
import { makeEarth, makeJupiter, makeSun } from '../../test/fixtures';
import { bodyState, validityStatus } from './state';

const bodies = [makeSun(), makeEarth(), makeJupiter()];

describe('bodyState', () => {
  it('keeps fixed bodies at their position', () => {
    expect(bodyState(makeSun(), 2451545)).toEqual({ positionKm: [0, 0, 0], inValidRange: true, tableId: null });
  });
  it('dispatches planet-approx orbits', () => {
    const s = bodyState(makeEarth(), 2451545);
    expect(s.tableId).toBe('1800-2050');
    expect(Math.hypot(...s.positionKm)).toBeGreaterThan(1.4e8);
  });
});

describe('validityStatus', () => {
  it('reports the best table available for all bodies, across both table boundaries', () => {
    expect(validityStatus(bodies, 2451545)).toBe('high');
    expect(validityStatus(bodies, TABLE1_RANGE.to)).toBe('high');
    expect(validityStatus(bodies, TABLE1_RANGE.to + 0.001)).toBe('extended');
    expect(validityStatus(bodies, TABLE1_RANGE.from - 0.001)).toBe('extended');
    expect(validityStatus(bodies, TABLE2_RANGE.from - 0.001)).toBe('out-of-range');
    expect(validityStatus(bodies, TABLE2_RANGE.to + 0.001)).toBe('out-of-range');
  });
});
```

`src/core/regions/regionManager.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Region } from '../catalog/schema';
import { regionOpacity, regionOriginInRootKm, regionVisibility } from './regionManager';

const region = (over: Partial<Region>): Region => ({
  id: 'solar-system', name: 'Solar System', parentId: null, frame: 'heliocentric-ecliptic-j2000', unit: 'km',
  originInParentKm: [0, 0, 0], activeRangeKm: [0, 1e13], dataManifest: 'x.json', ...over,
});

describe('regionOpacity', () => {
  it('is fully visible well inside the range and fades out over 0.3 dex at the edges', () => {
    const r = region({ activeRangeKm: [1e3, 1e13] });
    expect(regionOpacity(r, 1e9)).toBe(1);
    expect(regionOpacity(r, 1e13)).toBe(0);
    expect(regionOpacity(r, 1e13 / 10 ** 0.15)).toBeCloseTo(0.5, 9);
    expect(regionOpacity(r, 1e3)).toBe(0);
    expect(regionOpacity(r, 1e3 * 10 ** 0.15)).toBeCloseTo(0.5, 9);
  });
  it('has no lower fade when the range starts at zero, even at distance zero', () => {
    expect(regionOpacity(region({}), 0)).toBe(1);
  });
});

describe('region nesting', () => {
  it('sums origins up the parent chain', () => {
    const root = region({ id: 'galaxy', originInParentKm: [0, 0, 0] });
    const child = region({ id: 'solar-system', parentId: 'galaxy', originInParentKm: [10, 20, 30] });
    const byId = new Map([[root.id, root], [child.id, child]]);
    expect(regionOriginInRootKm(child, byId)).toEqual([10, 20, 30]);
    expect(regionVisibility([root, child], [10, 20, 30 + 1e9]).get('solar-system')).toBe(1);
  });
  it('throws on an unknown parent', () => {
    expect(() => regionOriginInRootKm(region({ parentId: 'nowhere' }), new Map())).toThrow(/unknown parent "nowhere"/);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/core/catalog/catalog.test.ts src/core/ephemeris/state.test.ts src/core/regions`
Expected: FAIL, modules not found.

- [ ] **Step 3: Create `src/core/catalog/catalog.ts`**

```ts
import type { Body, BodiesFile, Region, RegionsFile, Source, SourcesFile } from './schema';

export interface Catalog {
  regions: readonly Region[];
  sources: ReadonlyMap<string, Source>;
  bodies: readonly Body[];
  bodyById: ReadonlyMap<string, Body>;
}

export function createCatalog(regions: RegionsFile, sources: SourcesFile, bodiesFiles: readonly BodiesFile[]): Catalog {
  const bodies = bodiesFiles.flatMap((file) => file.bodies);
  const bodyById = new Map<string, Body>();
  for (const body of bodies) {
    if (bodyById.has(body.id)) throw new Error(`Duplicate body id "${body.id}" in catalogue`);
    bodyById.set(body.id, body);
  }
  return { regions: regions.regions, sources: new Map(sources.sources.map((s) => [s.id, s])), bodies, bodyById };
}

export function getBody(catalog: Catalog, id: string): Body {
  const body = catalog.bodyById.get(id);
  if (!body) throw new Error(`Unknown body "${id}"`);
  return body;
}
```

- [ ] **Step 4: Create `src/core/ephemeris/state.ts`**

```ts
import type { Body } from '../catalog/schema';
import { planetApproxState, selectTable } from './planetApprox';
import type { BodyState } from './types';

export function bodyState(body: Body, jdTdb: number): BodyState {
  switch (body.orbit.type) {
    case 'fixed':
      return { positionKm: body.orbit.positionKm, inValidRange: true, tableId: null };
    case 'planet-approx':
      return planetApproxState(body.orbit, jdTdb);
  }
}

export type ValidityStatus = 'high' | 'extended' | 'out-of-range';

/** 'high' = every body uses its preferred table; 'extended' = some use a fallback table; 'out-of-range' = some are extrapolated. */
export function validityStatus(bodies: readonly Body[], jdTdb: number): ValidityStatus {
  let status: ValidityStatus = 'high';
  for (const body of bodies) {
    if (body.orbit.type !== 'planet-approx') continue;
    const selected = selectTable(body.orbit.tables, jdTdb);
    if (!selected.inValidRange) return 'out-of-range';
    if (selected.index > 0) status = 'extended';
  }
  return status;
}
```

- [ ] **Step 5: Create `src/core/regions/regionManager.ts`**

```ts
import type { Region } from '../catalog/schema';
import { add, length, sub, type Vec3 } from '../math/vec3';

/** Width (in powers of ten of distance) over which a region fades at each edge of its active range. */
export const FADE_BAND_DEX = 0.3;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function regionOpacity(region: Region, cameraDistanceKm: number): number {
  const [min, max] = region.activeRangeKm;
  const logD = Math.log10(Math.max(cameraDistanceKm, Number.MIN_VALUE));
  const upper = clamp01((Math.log10(max) - logD) / FADE_BAND_DEX);
  const lower = min <= 0 ? 1 : clamp01((logD - Math.log10(min)) / FADE_BAND_DEX);
  return Math.min(upper, lower);
}

export function regionOriginInRootKm(region: Region, byId: ReadonlyMap<string, Region>): Vec3 {
  let origin = region.originInParentKm;
  let parentId = region.parentId;
  while (parentId) {
    const parent = byId.get(parentId);
    if (!parent) throw new Error(`Region "${region.id}" has unknown parent "${parentId}"`);
    origin = add(origin, parent.originInParentKm);
    parentId = parent.parentId;
  }
  return origin;
}

export function regionVisibility(regions: readonly Region[], cameraPositionKm: Vec3): Map<string, number> {
  const byId = new Map(regions.map((r) => [r.id, r]));
  return new Map(regions.map((r) => [r.id, regionOpacity(r, length(sub(cameraPositionKm, regionOriginInRootKm(r, byId))))]));
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/core`
Expected: all PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/core/catalog/catalog.ts src/core/catalog/catalog.test.ts src/core/ephemeris/state.ts src/core/ephemeris/state.test.ts src/core/regions
git commit -m "feat(core): add catalogue access, body state dispatch and region visibility" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: State stores and catalogue loading

**Files:**
- Create: `src/state/timeStore.ts`, `src/state/selectionStore.ts`, `src/state/viewStore.ts`, `src/state/loadCatalog.ts`, `src/state/catalogStore.ts`, `src/test/serveCatalog.ts`
- Test: `src/state/timeStore.test.ts`, `src/state/loadCatalog.test.ts`, `src/state/viewStore.test.ts`

**Interfaces:**
- Consumes: `utcToTdb` (Task 4); `unixMsToJd` (Task 3); `SECONDS_PER_DAY` (Task 1); schemas and `formatIssues`, `findUnresolvedSources` (Task 6); `createCatalog`, `Catalog` (Task 14).
- Produces (`timeStore.ts`): `RATE_STEPS: ReadonlyArray<{ secondsPerSecond: number; label: string }>`; `MAX_FRAME_DT_S = 0.1`; `JD_MIN = 0`; `JD_MAX = 5373484.5`; `nowJdTdb(nowMs?: number): number`; `useTimeStore` (Zustand hook) with state `{ jdTdb: number; playing: boolean; rateIndex: number; direction: 1 | -1 }` and actions `advance(realDtSeconds)`, `setJdTdb(jd)`, `setPlaying(p)`, `togglePlaying()`, `setRateIndex(i)`, `toggleDirection()`, `resetToNow(nowMs?)`.
- Produces (`selectionStore.ts`): `useSelectionStore` `{ selectedId: string | null; hoveredId: string | null; select(id | null); hover(id | null) }`.
- Produces (`viewStore.ts`): `type ViewId = 'orbit' | 'follow'`; `type ScaleMode = 'readable' | 'true'`; `useViewStore` `{ view: ViewId; coRotate: boolean; scaleMode: ScaleMode; focusRequest: { bodyId: string; seq: number } | null; setView(v); toggleCoRotate(); setScaleMode(m); requestFocus(bodyId) }`.
- Produces (`loadCatalog.ts`): `loadCatalog(baseUrl: string, fetchImpl?: typeof fetch): Promise<Catalog>`.
- Produces (`src/test/serveCatalog.ts`): `serveCatalog(overrides?: Record<string, unknown>): typeof fetch` (test helper).
- Produces (`catalogStore.ts`): `useCatalogStore` `{ status: 'idle' | 'loading' | 'ready' | 'error'; catalog: Catalog | null; error: string | null; load(fetchImpl?: typeof fetch): Promise<void> }`.

- [ ] **Step 1: Write the failing tests**

`src/state/timeStore.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { JD_MAX, JD_MIN, MAX_FRAME_DT_S, nowJdTdb, RATE_STEPS, useTimeStore } from './timeStore';

const J2000 = 2451545;
beforeEach(() => useTimeStore.setState({ jdTdb: J2000, playing: true, rateIndex: 3, direction: 1 }));

describe('timeStore', () => {
  it('advances by rate x real time', () => {
    useTimeStore.getState().advance(0.05); // 1 day/s for 0.05 s
    expect(useTimeStore.getState().jdTdb).toBeCloseTo(J2000 + 0.05, 12);
  });
  it('clamps a huge frame delta (e.g. returning to a background tab)', () => {
    useTimeStore.getState().advance(30);
    expect(useTimeStore.getState().jdTdb).toBeCloseTo(J2000 + MAX_FRAME_DT_S, 12);
  });
  it('runs backwards and across the 2050 table boundary', () => {
    useTimeStore.setState({ jdTdb: 2470172.6, rateIndex: RATE_STEPS.length - 1, direction: -1 });
    useTimeStore.getState().advance(0.1);
    expect(useTimeStore.getState().jdTdb).toBeLessThan(2470172.5);
  });
  it('does nothing while paused', () => {
    useTimeStore.getState().setPlaying(false);
    useTimeStore.getState().advance(0.05);
    expect(useTimeStore.getState().jdTdb).toBe(J2000);
  });
  it('stops at the supported range limits', () => {
    useTimeStore.setState({ jdTdb: JD_MIN + 1, rateIndex: RATE_STEPS.length - 1, direction: -1 });
    useTimeStore.getState().advance(0.1);
    expect(useTimeStore.getState()).toMatchObject({ jdTdb: JD_MIN, playing: false });
    useTimeStore.getState().setJdTdb(JD_MAX + 100);
    expect(useTimeStore.getState().jdTdb).toBe(JD_MAX);
  });
  it('resets to now in TDB', () => {
    useTimeStore.getState().resetToNow(Date.UTC(2026, 9, 4));
    expect(useTimeStore.getState().jdTdb).toBeCloseTo(2461317.5 + 69.184 / 86400, 9);
    expect(nowJdTdb(Date.UTC(2026, 9, 4))).toBeCloseTo(2461317.5 + 69.184 / 86400, 9);
  });
  it('clamps the rate index', () => {
    useTimeStore.getState().setRateIndex(99);
    expect(useTimeStore.getState().rateIndex).toBe(RATE_STEPS.length - 1);
  });
});
```

`src/state/viewStore.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { useViewStore } from './viewStore';

describe('viewStore', () => {
  it('switches views, toggles co-rotation and scale mode', () => {
    const s = useViewStore.getState();
    s.setView('follow');
    s.toggleCoRotate();
    s.setScaleMode('true');
    expect(useViewStore.getState()).toMatchObject({ view: 'follow', coRotate: true, scaleMode: 'true' });
  });
  it('numbers focus requests so repeated requests for one body are distinct', () => {
    useViewStore.getState().requestFocus('mars');
    const first = useViewStore.getState().focusRequest!;
    useViewStore.getState().requestFocus('mars');
    expect(useViewStore.getState().focusRequest).toEqual({ bodyId: 'mars', seq: first.seq + 1 });
  });
});
```

`src/state/loadCatalog.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { makeCatalogFiles } from '../test/fixtures';
import { serveCatalog as serve } from '../test/serveCatalog';
import { useCatalogStore } from './catalogStore';
import { loadCatalog } from './loadCatalog';

describe('loadCatalog', () => {
  it('loads and validates every file', async () => {
    const catalog = await loadCatalog('/', serve());
    expect(catalog.bodies.map((b) => b.id)).toEqual(['sun', 'earth', 'jupiter']);
  });
  it('names the missing file and HTTP status', async () => {
    await expect(loadCatalog('/', serve({ 'sources.json': undefined }))).rejects.toThrow('Could not load data/sources.json (HTTP 404).');
  });
  it('names the invalid file and field', async () => {
    const f = makeCatalogFiles();
    f.bodies.bodies[0]!.name = '';
    await expect(loadCatalog('/', serve({ 'solar-system/bodies.json': f.bodies }))).rejects.toThrow(/Invalid solar-system\/bodies\.json[\s\S]*bodies\.0\.name/);
  });
  it('rejects data that cites unknown sources', async () => {
    const f = makeCatalogFiles();
    f.sources.sources = f.sources.sources.filter((s) => s.id !== 'jpl-horizons');
    await expect(loadCatalog('/', serve({ 'sources.json': f.sources }))).rejects.toThrow(/unknown sourceId "jpl-horizons"/);
  });
});

describe('catalogStore', () => {
  beforeEach(() => useCatalogStore.setState({ status: 'idle', catalog: null, error: null }));
  it('moves to ready on success', async () => {
    await useCatalogStore.getState().load(serve());
    expect(useCatalogStore.getState().status).toBe('ready');
  });
  it('moves to error with a readable message on failure', async () => {
    await useCatalogStore.getState().load(serve({ 'regions.json': undefined }));
    expect(useCatalogStore.getState()).toMatchObject({ status: 'error', error: 'Could not load data/regions.json (HTTP 404).' });
  });
});
```

`src/test/serveCatalog.ts` (shared fake `fetch` serving the fixture catalogue; also used by the App test in Task 20):
```ts
import { makeCatalogFiles } from './fixtures';

/** Fake fetch for `${BASE_URL}data/<file>`; an override of `undefined` simulates a missing file (HTTP 404). */
export function serveCatalog(overrides: Record<string, unknown> = {}): typeof fetch {
  const f = makeCatalogFiles();
  const table: Record<string, unknown> = {
    'regions.json': f.regions,
    'sources.json': f.sources,
    'solar-system/bodies.json': f.bodies,
    ...overrides,
  };
  return (async (url: string | URL) => {
    const key = String(url).replace(/^.*\/data\//, '');
    if (!(key in table) || table[key] === undefined) return new Response('missing', { status: 404 });
    return new Response(JSON.stringify(table[key]), { status: 200 });
  }) as unknown as typeof fetch;
}
```
- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/state`
Expected: FAIL, modules not found.

- [ ] **Step 3: Create `src/state/timeStore.ts`**

```ts
import { create } from 'zustand';
import { unixMsToJd } from '../core/time/julian';
import { utcToTdb } from '../core/time/timescales';
import { SECONDS_PER_DAY } from '../core/units';

export const RATE_STEPS = [
  { secondsPerSecond: 1, label: 'Real time' },
  { secondsPerSecond: 60, label: '1 min/s' },
  { secondsPerSecond: 3_600, label: '1 hour/s' },
  { secondsPerSecond: 86_400, label: '1 day/s' },
  { secondsPerSecond: 604_800, label: '1 week/s' },
  { secondsPerSecond: 2_629_800, label: '1 month/s' }, // Julian year / 12
  { secondsPerSecond: 31_557_600, label: '1 year/s' }, // Julian year
] as const;

/** Longest real-time step applied in one frame (prevents jumps after a backgrounded tab). */
export const MAX_FRAME_DT_S = 0.1;
/** Supported simulation range: JD 0 (4713 BC) to 10000-01-01. */
export const JD_MIN = 0;
export const JD_MAX = 5_373_484.5;

const clampJd = (jd: number) => Math.min(Math.max(jd, JD_MIN), JD_MAX);

export function nowJdTdb(nowMs: number = Date.now()): number {
  return utcToTdb(unixMsToJd(nowMs));
}

interface TimeState {
  jdTdb: number;
  playing: boolean;
  rateIndex: number;
  direction: 1 | -1;
  advance(realDtSeconds: number): void;
  setJdTdb(jd: number): void;
  setPlaying(playing: boolean): void;
  togglePlaying(): void;
  setRateIndex(index: number): void;
  toggleDirection(): void;
  resetToNow(nowMs?: number): void;
}

export const useTimeStore = create<TimeState>()((set, get) => ({
  jdTdb: nowJdTdb(),
  playing: true,
  rateIndex: 0,
  direction: 1,
  advance: (realDtSeconds) => {
    const s = get();
    if (!s.playing) return;
    const dt = Math.min(Math.max(realDtSeconds, 0), MAX_FRAME_DT_S);
    const next = s.jdTdb + (s.direction * RATE_STEPS[s.rateIndex]!.secondsPerSecond * dt) / SECONDS_PER_DAY;
    const clamped = clampJd(next);
    set({ jdTdb: clamped, playing: clamped === next });
  },
  setJdTdb: (jd) => set({ jdTdb: clampJd(jd) }),
  setPlaying: (playing) => set({ playing }),
  togglePlaying: () => set((s) => ({ playing: !s.playing })),
  setRateIndex: (index) => set({ rateIndex: Math.min(Math.max(Math.round(index), 0), RATE_STEPS.length - 1) }),
  toggleDirection: () => set((s) => ({ direction: s.direction === 1 ? -1 : 1 })),
  resetToNow: (nowMs) => set({ jdTdb: nowJdTdb(nowMs) }),
}));
```

- [ ] **Step 4: Create `src/state/selectionStore.ts` and `src/state/viewStore.ts`**

```ts
// src/state/selectionStore.ts
import { create } from 'zustand';

interface SelectionState {
  selectedId: string | null;
  hoveredId: string | null;
  select(id: string | null): void;
  hover(id: string | null): void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selectedId: null,
  hoveredId: null,
  select: (selectedId) => set({ selectedId }),
  hover: (hoveredId) => set({ hoveredId }),
}));
```

```ts
// src/state/viewStore.ts
import { create } from 'zustand';

export type ViewId = 'orbit' | 'follow';
export type ScaleMode = 'readable' | 'true';

interface ViewState {
  view: ViewId;
  coRotate: boolean;
  scaleMode: ScaleMode;
  /** Orbit view: move the pivot to this body. seq makes repeated requests distinct. */
  focusRequest: { bodyId: string; seq: number } | null;
  setView(view: ViewId): void;
  toggleCoRotate(): void;
  setScaleMode(mode: ScaleMode): void;
  requestFocus(bodyId: string): void;
}

export const useViewStore = create<ViewState>()((set) => ({
  view: 'orbit',
  coRotate: false,
  scaleMode: 'readable',
  focusRequest: null,
  setView: (view) => set({ view }),
  toggleCoRotate: () => set((s) => ({ coRotate: !s.coRotate })),
  setScaleMode: (scaleMode) => set({ scaleMode }),
  requestFocus: (bodyId) => set((s) => ({ focusRequest: { bodyId, seq: (s.focusRequest?.seq ?? 0) + 1 } })),
}));
```

- [ ] **Step 5: Create `src/state/loadCatalog.ts` and `src/state/catalogStore.ts`**

```ts
// src/state/loadCatalog.ts
import type { z } from 'zod';
import { createCatalog, type Catalog } from '../core/catalog/catalog';
import { findUnresolvedSources, formatIssues } from '../core/catalog/references';
import { BodiesFileSchema, RegionsFileSchema, SourcesFileSchema, type BodiesFile } from '../core/catalog/schema';

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(`Invalid ${label}:\n${formatIssues(label, result.error).slice(0, 10).join('\n')}`);
  return result.data;
}

export async function loadCatalog(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<Catalog> {
  const getJson = async (file: string): Promise<unknown> => {
    const res = await fetchImpl(`${baseUrl}data/${file}`);
    if (!res.ok) throw new Error(`Could not load data/${file} (HTTP ${res.status}).`);
    return res.json();
  };
  const regions = parseOrThrow(RegionsFileSchema, await getJson('regions.json'), 'regions.json');
  const sources = parseOrThrow(SourcesFileSchema, await getJson('sources.json'), 'sources.json');
  const bodiesFiles: BodiesFile[] = [];
  for (const region of regions.regions) {
    bodiesFiles.push(parseOrThrow(BodiesFileSchema, await getJson(region.dataManifest), region.dataManifest));
  }
  const known = new Set(sources.sources.map((s) => s.id));
  const unresolved = bodiesFiles.flatMap((file) => findUnresolvedSources(file, known));
  if (unresolved.length > 0) throw new Error(`Data references unknown sources:\n${unresolved.join('\n')}`);
  return createCatalog(regions, sources, bodiesFiles);
}
```

```ts
// src/state/catalogStore.ts
import { create } from 'zustand';
import type { Catalog } from '../core/catalog/catalog';
import { loadCatalog } from './loadCatalog';

interface CatalogState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  catalog: Catalog | null;
  error: string | null;
  load(fetchImpl?: typeof fetch): Promise<void>;
}

export const useCatalogStore = create<CatalogState>()((set, get) => ({
  status: 'idle',
  catalog: null,
  error: null,
  load: async (fetchImpl) => {
    if (get().status === 'loading') return;
    set({ status: 'loading', error: null });
    try {
      const catalog = await loadCatalog(import.meta.env.BASE_URL, fetchImpl);
      set({ status: 'ready', catalog });
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  },
}));
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/state` then `npm run typecheck`
Expected: all PASS; typecheck exits 0.

- [ ] **Step 7: Commit**

```powershell
git add src/state src/test/serveCatalog.ts
git commit -m "feat(state): add time, selection, view and catalogue stores" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Scene: floating origin, bodies, orbits, labels and lighting

**Files:**
- Create: `src/scene/frameState.ts`, `src/scene/FrameStateContext.tsx`, `src/scene/scaleMode.ts`, `src/scene/threeMath.ts`, `src/scene/FrameDriver.tsx`, `src/scene/BodyMesh.tsx`, `src/scene/BodyLabel.tsx`, `src/scene/SunLight.tsx`, `src/scene/OrbitLine.tsx`, `src/scene/Effects.tsx`
- Test: `src/scene/scene.test.ts`

**Interfaces:**
- Consumes: `Catalog` (Task 14); `bodyState` (Task 14); `bodyFixedToEcliptic` (Task 8); `selectTable`, `elementsAt` (Task 7); `solveKeplerElliptic`, `orbitPolylineKm` (Task 5); stores (Task 15); `Vec3`, `sub`, `length` (Task 2); `Mat3` (Task 2).
- Produces (`frameState.ts`): `interface FrameState { jdTdb: number; cameraPositionKm: Vec3; bodyPositionsKm: Map<string, Vec3>; bodyInValidRange: Map<string, boolean>; bodyOrientation: Map<string, Mat3>; viewportHeightPx: number; fovRad: number }`; `createFrameState(): FrameState`; `updateBodies(frame, bodies, jdTdb): void`.
- Produces (`FrameStateContext.tsx`): `FrameStateProvider`, `useFrameState(): FrameState`.
- Produces (`scaleMode.ts`): `MIN_PIXELS = { star: 10, body: 5 }`; `pixelsPerRadian(viewportHeightPx, fovRad): number`; `renderRadiusKm(trueRadiusKm, distanceKm, mode: ScaleMode, minPixels, pxPerRad): number`.
- Produces (`threeMath.ts`): `writeMatrix4(m: Mat3, target: Matrix4): Matrix4`.
- Produces (components): `FrameDriver({ bodies })`, `BodyMesh({ body })`, `BodyLabel({ body })`, `SunLight({ bodyId })`, `OrbitLine({ body })`, `Effects()`; Task 17 assembles them in `SceneRoot`.
- `useFrame` priorities: `FrameDriver` −2 (time + body positions), `CameraSystem` −1 (sets `frame.cameraPositionKm`), everything else 0 (places objects at `position − cameraPosition`). Negative priorities keep R3F's automatic rendering.

- [ ] **Step 1: Write the failing tests `src/scene/scene.test.ts`**

```ts
import { Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { makeEarth, makeJupiter, makeSun } from '../test/fixtures';
import { apply, mul, rotX, rotZ } from '../core/math/mat3';
import { createFrameState, updateBodies } from './frameState';
import { pixelsPerRadian, renderRadiusKm } from './scaleMode';
import { writeMatrix4 } from './threeMath';

describe('updateBodies', () => {
  it('stores positions, validity and orientation for each body', () => {
    const frame = createFrameState();
    updateBodies(frame, [makeSun(), makeEarth(), makeJupiter()], 2451545);
    expect(frame.jdTdb).toBe(2451545);
    expect(frame.bodyPositionsKm.get('sun')).toEqual([0, 0, 0]);
    expect(Math.hypot(...frame.bodyPositionsKm.get('jupiter')!)).toBeGreaterThan(7e8);
    expect(frame.bodyInValidRange.get('earth')).toBe(true);
    expect(frame.bodyOrientation.get('earth')).toHaveLength(9);
  });
});

describe('renderRadiusKm', () => {
  const ppr = pixelsPerRadian(800, (50 * Math.PI) / 180);
  it('returns the true radius in true-scale mode', () => {
    expect(renderRadiusKm(6378, 1e9, 'true', 5, ppr)).toBe(6378);
  });
  it('enforces a minimum on-screen size in readable mode when far away', () => {
    const r = renderRadiusKm(6378, 1e9, 'readable', 5, ppr);
    expect((r / 1e9) * ppr).toBeCloseTo(5, 6);
  });
  it('uses the true radius in readable mode when close', () => {
    expect(renderRadiusKm(6378, 20000, 'readable', 5, ppr)).toBe(6378);
  });
});

describe('writeMatrix4', () => {
  it('produces a Three.js rotation equivalent to the core matrix', () => {
    const m = mul(rotZ(0.4), rotX(1.1));
    const q = new Quaternion().setFromRotationMatrix(writeMatrix4(m, new Matrix4()));
    const v = new Vector3(0.2, -0.5, 0.8).applyQuaternion(q);
    const expected = apply(m, [0.2, -0.5, 0.8]);
    expect(v.x).toBeCloseTo(expected[0], 12);
    expect(v.y).toBeCloseTo(expected[1], 12);
    expect(v.z).toBeCloseTo(expected[2], 12);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/scene`
Expected: FAIL, modules not found.

- [ ] **Step 3: Create `src/scene/frameState.ts`, `src/scene/scaleMode.ts`, `src/scene/threeMath.ts`**

```ts
// src/scene/frameState.ts
import type { Body } from '../core/catalog/schema';
import { bodyState } from '../core/ephemeris/state';
import { bodyFixedToEcliptic } from '../core/frames/rotation';
import { DEG } from '../core/math/angles';
import type { Mat3 } from '../core/math/mat3';
import type { Vec3 } from '../core/math/vec3';
import { J2000_JD } from '../core/units';

/** Mutable per-frame cache shared by scene components (never stored in React state). */
export interface FrameState {
  jdTdb: number;
  cameraPositionKm: Vec3;
  bodyPositionsKm: Map<string, Vec3>;
  bodyInValidRange: Map<string, boolean>;
  bodyOrientation: Map<string, Mat3>;
  viewportHeightPx: number;
  fovRad: number;
}

export function createFrameState(): FrameState {
  return {
    jdTdb: J2000_JD,
    cameraPositionKm: [0, 0, 1e9],
    bodyPositionsKm: new Map(),
    bodyInValidRange: new Map(),
    bodyOrientation: new Map(),
    viewportHeightPx: 800,
    fovRad: 50 * DEG,
  };
}

export function updateBodies(frame: FrameState, bodies: readonly Body[], jdTdb: number): void {
  frame.jdTdb = jdTdb;
  for (const body of bodies) {
    const state = bodyState(body, jdTdb);
    frame.bodyPositionsKm.set(body.id, state.positionKm);
    frame.bodyInValidRange.set(body.id, state.inValidRange);
    if (body.rotation) frame.bodyOrientation.set(body.id, bodyFixedToEcliptic(body.rotation, jdTdb));
  }
}
```

```ts
// src/scene/scaleMode.ts
import type { ScaleMode } from '../state/viewStore';

/** Minimum on-screen radius in readable mode, in CSS pixels. */
export const MIN_PIXELS = { star: 10, body: 5 } as const;

export function pixelsPerRadian(viewportHeightPx: number, fovRad: number): number {
  return viewportHeightPx / fovRad;
}

/** Readable mode never draws a body smaller than minPixels; true mode always uses the real radius. */
export function renderRadiusKm(trueRadiusKm: number, distanceKm: number, mode: ScaleMode, minPixels: number, pxPerRad: number): number {
  if (mode === 'true') return trueRadiusKm;
  return Math.max(trueRadiusKm, (distanceKm * minPixels) / pxPerRad);
}
```

```ts
// src/scene/threeMath.ts
import type { Matrix4 } from 'three';
import type { Mat3 } from '../core/math/mat3';

export function writeMatrix4(m: Mat3, target: Matrix4): Matrix4 {
  return target.set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/scene`
Expected: all PASS.

- [ ] **Step 5: Create the React scene components**

```tsx
// src/scene/FrameStateContext.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createFrameState, type FrameState } from './frameState';

const FrameStateContext = createContext<FrameState | null>(null);

export function FrameStateProvider({ children }: { children: ReactNode }) {
  const [frame] = useState(createFrameState);
  return <FrameStateContext.Provider value={frame}>{children}</FrameStateContext.Provider>;
}

export function useFrameState(): FrameState {
  const frame = useContext(FrameStateContext);
  if (!frame) throw new Error('useFrameState must be used inside <FrameStateProvider>');
  return frame;
}
```

```tsx
// src/scene/FrameDriver.tsx
import { useFrame } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import type { Body } from '../core/catalog/schema';
import { DEG } from '../core/math/angles';
import { useTimeStore } from '../state/timeStore';
import { useFrameState } from './FrameStateContext';
import { updateBodies } from './frameState';

export function FrameDriver({ bodies }: { bodies: readonly Body[] }) {
  const frame = useFrameState();
  useFrame((state, delta) => {
    const time = useTimeStore.getState();
    time.advance(delta);
    updateBodies(frame, bodies, useTimeStore.getState().jdTdb);
    frame.viewportHeightPx = state.size.height;
    frame.fovRad = (state.camera as PerspectiveCamera).fov * DEG;
  }, -2);
  return null;
}
```

```tsx
// src/scene/BodyLabel.tsx
import { Html } from '@react-three/drei';
import type { Body } from '../core/catalog/schema';
import { useSelectionStore } from '../state/selectionStore';
import { useViewStore } from '../state/viewStore';

export function BodyLabel({ body }: { body: Body }) {
  const selected = useSelectionStore((s) => s.selectedId === body.id);
  const select = useSelectionStore((s) => s.select);
  const requestFocus = useViewStore((s) => s.requestFocus);
  return (
    <Html center zIndexRange={[20, 0]}>
      <button
        type="button"
        className={selected ? 'body-label is-selected' : 'body-label'}
        onClick={() => select(body.id)}
        onDoubleClick={() => requestFocus(body.id)}
      >
        {body.name}
      </button>
    </Html>
  );
}
```

```tsx
// src/scene/BodyMesh.tsx
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, Matrix4, SphereGeometry, type Group, type Mesh } from 'three';
import type { Body } from '../core/catalog/schema';
import { length, sub } from '../core/math/vec3';
import { useSelectionStore } from '../state/selectionStore';
import { useViewStore } from '../state/viewStore';
import { BodyLabel } from './BodyLabel';
import { useFrameState } from './FrameStateContext';
import { MIN_PIXELS, pixelsPerRadian, renderRadiusKm } from './scaleMode';
import { writeMatrix4 } from './threeMath';

const CLICK_DRAG_TOLERANCE_PX = 4;

export function BodyMesh({ body }: { body: Body }) {
  const frame = useFrameState();
  const group = useRef<Group>(null);
  const mesh = useRef<Mesh>(null);
  const matrix = useMemo(() => new Matrix4(), []);
  const isStar = body.category === 'star';
  const geometry = useMemo(() => {
    const g = new SphereGeometry(1, 64, 32);
    g.rotateX(Math.PI / 2); // Three's sphere poles are on +Y; body-fixed poles are on +Z
    return g;
  }, []);
  const starColor = useMemo(() => new Color(body.display.color).multiplyScalar(2.2), [body.display.color]);
  const select = useSelectionStore((s) => s.select);
  const hover = useSelectionStore((s) => s.hover);
  const requestFocus = useViewStore((s) => s.requestFocus);

  useFrame(() => {
    const position = frame.bodyPositionsKm.get(body.id);
    if (!position || !group.current || !mesh.current) return;
    const rel = sub(position, frame.cameraPositionKm);
    group.current.position.set(rel[0], rel[1], rel[2]);
    const { equatorialRadiusKm, polarRadiusKm } = body.shape;
    const radius = renderRadiusKm(
      equatorialRadiusKm,
      length(rel),
      useViewStore.getState().scaleMode,
      isStar ? MIN_PIXELS.star : MIN_PIXELS.body,
      pixelsPerRadian(frame.viewportHeightPx, frame.fovRad),
    );
    const k = radius / equatorialRadiusKm;
    mesh.current.scale.set(equatorialRadiusKm * k, equatorialRadiusKm * k, polarRadiusKm * k);
    const orientation = frame.bodyOrientation.get(body.id);
    if (orientation) mesh.current.quaternion.setFromRotationMatrix(writeMatrix4(orientation, matrix));
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_DRAG_TOLERANCE_PX) return; // this was a camera drag, not a click
    select(body.id);
  };

  return (
    <group ref={group}>
      <mesh
        ref={mesh}
        geometry={geometry}
        onClick={onClick}
        onDoubleClick={(e) => {
          e.stopPropagation();
          requestFocus(body.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          hover(body.id);
        }}
        onPointerOut={() => hover(null)}
      >
        {isStar ? (
          <meshBasicMaterial color={starColor} toneMapped={false} />
        ) : (
          <meshStandardMaterial color={body.display.color} roughness={1} metalness={0} />
        )}
      </mesh>
      <BodyLabel body={body} />
    </group>
  );
}
```

```tsx
// src/scene/SunLight.tsx
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { PointLight } from 'three';
import { useFrameState } from './FrameStateContext';

/** The Sun is the scene's only real light. decay 0 keeps the outer planets lit (no inverse-square dimming). */
export function SunLight({ bodyId }: { bodyId: string }) {
  const frame = useFrameState();
  const light = useRef<PointLight>(null);
  useFrame(() => {
    const p = frame.bodyPositionsKm.get(bodyId);
    if (!p || !light.current) return;
    const c = frame.cameraPositionKm;
    light.current.position.set(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
  });
  return <pointLight ref={light} intensity={3} decay={0} distance={0} />;
}
```

```tsx
// src/scene/OrbitLine.tsx
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Line, LineBasicMaterial } from 'three';
import type { Body, PlanetApproxOrbit } from '../core/catalog/schema';
import { orbitPolylineKm } from '../core/ephemeris/conic';
import { solveKeplerElliptic } from '../core/ephemeris/kepler';
import { elementsAt, selectTable } from '../core/ephemeris/planetApprox';
import { useFrameState } from './FrameStateContext';

const SEGMENTS = 360;

/** Rebuilt every frame relative to the camera, so the line stays precise next to the planet. */
export function OrbitLine({ body }: { body: Body & { orbit: PlanetApproxOrbit } }) {
  const frame = useFrameState();
  const positions = useMemo(() => new Float32Array((SEGMENTS + 1) * 3), []);
  const line = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    const l = new Line(geometry, new LineBasicMaterial({ color: body.display.color, transparent: true, opacity: 0.45 }));
    l.frustumCulled = false;
    return l;
  }, [positions, body.display.color]);

  useFrame(() => {
    const { table } = selectTable(body.orbit.tables, frame.jdTdb);
    const el = elementsAt(table, frame.jdTdb);
    const points = orbitPolylineKm(el, solveKeplerElliptic(el.meanAnomalyRad, el.e), SEGMENTS);
    const c = frame.cameraPositionKm;
    points.forEach((p, i) => {
      positions[i * 3] = p[0] - c[0];
      positions[i * 3 + 1] = p[1] - c[1];
      positions[i * 3 + 2] = p[2] - c[2];
    });
    line.geometry.attributes.position!.needsUpdate = true;
  });

  return <primitive object={line} />;
}
```

```tsx
// src/scene/Effects.tsx
import { Bloom, EffectComposer } from '@react-three/postprocessing';

export function Effects() {
  return (
    <EffectComposer>
      <Bloom mipmapBlur luminanceThreshold={1} intensity={1.1} />
    </EffectComposer>
  );
}
```

- [ ] **Step 6: Run unit tests**

Run: `npx vitest run src/scene`
Expected: all PASS. Then run `npm run typecheck`: exits 0.

- [ ] **Step 7: Commit**

```powershell
git add src/scene
git commit -m "feat(scene): add floating-origin scene with bodies, orbits, labels and lighting" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Camera: rig, orbit and follow controllers, transitions and input

**Files:**
- Create: `src/camera/types.ts`, `src/camera/rig.ts`, `src/camera/transition.ts`, `src/camera/orbitController.ts`, `src/camera/followController.ts`, `src/camera/input.ts`, `src/camera/CameraSystem.tsx`, `src/scene/SceneRoot.tsx`
- Test: `src/camera/camera.test.ts`

**Interfaces:**
- Consumes: vector/matrix math (Task 2); `DEG` (Task 2); `FrameState`, `useFrameState`, `writeMatrix4` (Task 16); `useViewStore`, `useSelectionStore`, `ViewId` (Task 15); `Catalog` (Task 14).
- Produces (`types.ts`): `interface CameraPose { positionKm: Vec3; lookAtKm: Vec3 }`; `interface InputDeltas { rotateX; rotateY; panX; panY; zoom: number }` (pixels; `zoom` > 0 moves away); `NO_INPUT`; `interface ControllerContext { bodyPosition(id): Vec3 | undefined; bodyRadiusKm(id): number; bodyOrientation(id): Mat3 | undefined }`.
- Produces (`rig.ts`): `lookRotation(positionKm, lookAtKm, up?): Mat3` (columns: camera right, up, back; Three cameras look down −Z); `keepOutside(pose, centerKm, minDistanceKm): CameraPose`.
- Produces (`transition.ts`): `TRANSITION_SECONDS = 1.6`; `easeInOutCubic(t)`; `interpolatePose(from, to, s): CameraPose` (distance interpolated logarithmically about `to.lookAtKm`).
- Produces (`orbitController.ts`): constants `ROTATE_RAD_PER_PX`, `ZOOM_PER_UNIT`, `PAN_PER_PX`, `MAX_ELEVATION_RAD`, `MIN_SURFACE_FACTOR = 1.2`, `MAX_DISTANCE_KM = 5e11`; `interface OrbitState { targetId; distanceKm; azimuthRad; elevationRad; panOffsetKm }`; `offsetDirection(az, el): Vec3`; `sphericalFromOffset(offset): { distanceKm; azimuthRad; elevationRad }`; `applyOrbitInput(state, input, targetRadiusKm): OrbitState`; `orbitPose(state, targetPositionKm): CameraPose`; `createOrbitController(initial)` → `{ id: 'orbit'; getState(); enter(from: CameraPose | null, ctx); focus(bodyId, ctx); update(input, ctx): CameraPose }`.
- Produces (`followController.ts`): `FOLLOW_DISTANCE_RADII = 4`; `interface FollowState { targetId; distanceKm; azimuthRad; elevationRad; coRotate }`; `followPose(state, targetPositionKm, orientation?): CameraPose`; `createFollowController(initial)` → `{ id: 'follow'; getState(); enter(from: CameraPose | null, ctx, targetId); setTarget(bodyId, ctx); setCoRotate(on, ctx); update(input, ctx): CameraPose }`.
- Produces (`input.ts`): `wheelToZoom(deltaY, deltaMode): number`; `pinchToZoom(previousPx, currentPx): number`; `createPointerInput(): { attach(el: HTMLElement): () => void; consume(): InputDeltas }`.
- Produces (`CameraSystem.tsx`): `CameraSystem({ catalog })`.
- Produces (`src/scene/SceneRoot.tsx`): `SceneRoot({ catalog }: { catalog: Catalog })`, the Canvas with every scene component (used by `App` in Task 20).

Behaviour: in **Orbit** view, clicking selects a body (info panel) without moving the camera; double-clicking a body or its label (or the info panel's "Centre view" button) moves the pivot to it with a transition. In **Follow** view, selecting a body flies to it and tracks it. Co-rotation (follow only) keeps the camera fixed relative to the body's surface. Escape returns to Orbit (Task 20 wires the keys).

- [ ] **Step 1: Write the failing tests `src/camera/camera.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { DEG } from '../core/math/angles';
import { apply, column, rotZ, transpose } from '../core/math/mat3';
import { dot, length, sub, type Vec3 } from '../core/math/vec3';
import { createFollowController, followPose } from './followController';
import { pinchToZoom, wheelToZoom } from './input';
import { applyOrbitInput, createOrbitController, MAX_DISTANCE_KM, MAX_ELEVATION_RAD, MIN_SURFACE_FACTOR, offsetDirection, orbitPose, type OrbitState } from './orbitController';
import { keepOutside, lookRotation } from './rig';
import { interpolatePose } from './transition';
import { NO_INPUT, type ControllerContext } from './types';

const finite = (v: Vec3) => v.every(Number.isFinite);
const base: OrbitState = { targetId: 'jupiter', distanceKm: 1e6, azimuthRad: 0, elevationRad: 0, panOffsetKm: [0, 0, 0] };
const ctx = (orientation = rotZ(0)): ControllerContext => ({
  bodyPosition: (id) => (id === 'jupiter' ? [7e8, 1e8, 0] : [0, 0, 0]),
  bodyRadiusKm: (id) => (id === 'jupiter' ? 71492 : 695700),
  bodyOrientation: () => orientation,
});

describe('lookRotation', () => {
  it('builds an orthonormal camera basis looking at the target', () => {
    const m = lookRotation([0, 0, 0], [0, 10, 0]);
    const close = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 12));
    close(column(m, 0), [1, 0, 0]); // right
    close(column(m, 1), [0, 0, 1]); // up
    close(column(m, 2), [0, -1, 0]); // back (camera looks down -Z)
  });
  it('stays finite when looking straight along the up axis or at its own position', () => {
    for (const m of [lookRotation([0, 0, 10], [0, 0, 0]), lookRotation([1, 2, 3], [1, 2, 3])]) {
      expect(m.every(Number.isFinite)).toBe(true);
      expect(length(column(m, 0))).toBeCloseTo(1, 12);
    }
  });
});

describe('orbit controller', () => {
  it('places the camera on a sphere around the target', () => {
    const pose = orbitPose({ ...base, distanceKm: 10 }, [100, 0, 0]);
    expect(pose).toEqual({ positionKm: [110, 0, 0], lookAtKm: [100, 0, 0] });
  });
  it('clamps zoom between the surface margin and the maximum distance', () => {
    expect(applyOrbitInput(base, { ...NO_INPUT, zoom: -1e6 }, 71492).distanceKm).toBeCloseTo(71492 * MIN_SURFACE_FACTOR, 6);
    expect(applyOrbitInput(base, { ...NO_INPUT, zoom: 1e6 }, 71492).distanceKm).toBe(MAX_DISTANCE_KM);
  });
  it('clamps elevation short of the poles', () => {
    expect(applyOrbitInput(base, { ...NO_INPUT, rotateY: 1e6 }, 1).elevationRad).toBe(MAX_ELEVATION_RAD);
    expect(applyOrbitInput(base, { ...NO_INPUT, rotateY: -1e6 }, 1).elevationRad).toBe(-MAX_ELEVATION_RAD);
  });
  it('pans perpendicular to the viewing direction', () => {
    const s = applyOrbitInput({ ...base, azimuthRad: 0.7, elevationRad: 0.3 }, { ...NO_INPUT, panX: 40, panY: -25 }, 1);
    expect(length(s.panOffsetKm)).toBeGreaterThan(0);
    expect(dot(s.panOffsetKm, offsetDirection(0.7, 0.3))).toBeCloseTo(0, 6);
  });
  it('never puts the camera inside the target body', () => {
    const c = createOrbitController({ ...base, distanceKm: 10 });
    const pose = c.update({ ...NO_INPUT, zoom: -1e6 }, ctx());
    expect(length(sub(pose.positionKm, [7e8, 1e8, 0]))).toBeGreaterThanOrEqual(71492 * MIN_SURFACE_FACTOR - 1e-6);
  });
  it('focus moves the pivot to a new body and clears panning', () => {
    const c = createOrbitController({ ...base, targetId: 'sun', panOffsetKm: [5, 5, 5] });
    c.focus('jupiter', ctx());
    expect(c.getState()).toMatchObject({ targetId: 'jupiter', panOffsetKm: [0, 0, 0], distanceKm: 71492 * 6 });
  });
  it('enter adopts the current camera position for a seamless switch', () => {
    const c = createOrbitController(base);
    c.enter({ positionKm: [7e8, 1e8, 5e5], lookAtKm: [7e8, 1e8, 0] }, ctx());
    expect(c.getState().distanceKm).toBeCloseTo(5e5, 3);
    expect(c.getState().elevationRad).toBeCloseTo(MAX_ELEVATION_RAD, 9);
  });
});

describe('follow controller', () => {
  it('rotates the offset with the body when co-rotating', () => {
    const orientation = rotZ(-90 * DEG); // body x axis -> ecliptic +y
    const pose = followPose({ targetId: 'jupiter', distanceKm: 10, azimuthRad: 0, elevationRad: 0, coRotate: true }, [0, 0, 0], orientation);
    const expected = apply(orientation, [10, 0, 0]);
    pose.positionKm.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 9));
  });
  it('toggling co-rotation keeps the camera where it is', () => {
    const orientation = transpose(rotZ(0.8));
    const c = createFollowController({ targetId: 'jupiter', distanceKm: 3e5, azimuthRad: 0.3, elevationRad: 0.2, coRotate: false });
    const before = c.update(NO_INPUT, ctx(orientation));
    c.setCoRotate(true, ctx(orientation));
    const after = c.update(NO_INPUT, ctx(orientation));
    after.positionKm.forEach((v, i) => expect(v).toBeCloseTo(before.positionKm[i]!, 3));
  });
  it('setTarget frames the body at four radii', () => {
    const c = createFollowController({ targetId: 'sun', distanceKm: 1, azimuthRad: 0, elevationRad: 0, coRotate: false });
    c.setTarget('jupiter', ctx());
    expect(c.getState()).toMatchObject({ targetId: 'jupiter', distanceKm: 71492 * 4 });
  });
});

describe('transitions', () => {
  const from = { positionKm: [1e9, 0, 0] as Vec3, lookAtKm: [0, 0, 0] as Vec3 };
  const to = { positionKm: [7e8 + 3e5, 1e8, 0] as Vec3, lookAtKm: [7e8, 1e8, 0] as Vec3 };
  it('starts at "from" and ends at "to"', () => {
    const start = interpolatePose(from, to, 0);
    const end = interpolatePose(from, to, 1);
    start.positionKm.forEach((v, i) => expect(v).toBeCloseTo(from.positionKm[i]!, 0));
    expect(start.lookAtKm).toEqual(from.lookAtKm);
    end.positionKm.forEach((v, i) => expect(v).toBeCloseTo(to.positionKm[i]!, 0));
    expect(end.lookAtKm).toEqual(to.lookAtKm);
  });
  it('shrinks the distance to the destination monotonically (log interpolation)', () => {
    const d = [0.25, 0.5, 0.75].map((s) => length(sub(interpolatePose(from, to, s).positionKm, to.lookAtKm)));
    expect(d[0]!).toBeGreaterThan(d[1]!);
    expect(d[1]!).toBeGreaterThan(d[2]!);
  });
  it('is finite for identical poses', () => {
    const p = interpolatePose(to, to, 0.5);
    expect(finite(p.positionKm) && finite(p.lookAtKm)).toBe(true);
  });
});

describe('rig helpers and input mapping', () => {
  it('pushes a pose out of a body', () => {
    const pose = keepOutside({ positionKm: [1, 0, 0], lookAtKm: [0, 0, 0] }, [0, 0, 0], 10);
    expect(pose.positionKm).toEqual([10, 0, 0]);
    expect(keepOutside({ positionKm: [0, 0, 0], lookAtKm: [0, 0, 0] }, [0, 0, 0], 10).positionKm).toEqual([0, 0, 10]);
  });
  it('maps wheel and pinch to zoom', () => {
    expect(wheelToZoom(100, 0)).toBe(100);
    expect(wheelToZoom(3, 1)).toBe(48);
    expect(pinchToZoom(100, 150)).toBeLessThan(0); // fingers apart = zoom in
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/camera`
Expected: FAIL, modules not found.

- [ ] **Step 3: Create `src/camera/types.ts`, `src/camera/rig.ts`, `src/camera/transition.ts`**

```ts
// src/camera/types.ts
import type { Mat3 } from '../core/math/mat3';
import type { Vec3 } from '../core/math/vec3';

export type { ViewId } from '../state/viewStore';

export interface CameraPose {
  positionKm: Vec3;
  lookAtKm: Vec3;
}

/** Accumulated pointer input since the last frame, in CSS pixels; zoom > 0 moves away. */
export interface InputDeltas {
  rotateX: number;
  rotateY: number;
  panX: number;
  panY: number;
  zoom: number;
}

export const NO_INPUT: InputDeltas = { rotateX: 0, rotateY: 0, panX: 0, panY: 0, zoom: 0 };

export interface ControllerContext {
  bodyPosition(id: string): Vec3 | undefined;
  bodyRadiusKm(id: string): number;
  bodyOrientation(id: string): Mat3 | undefined;
}
```

```ts
// src/camera/rig.ts
import { fromColumns, type Mat3 } from '../core/math/mat3';
import { add, cross, length, normalize, scale, sub, type Vec3 } from '../core/math/vec3';
import type { CameraPose } from './types';

/** Camera-to-world rotation. Columns: right, up, back (Three.js cameras look down their local -Z). */
export function lookRotation(positionKm: Vec3, lookAtKm: Vec3, up: Vec3 = [0, 0, 1]): Mat3 {
  let forward = normalize(sub(lookAtKm, positionKm));
  if (length(forward) === 0) forward = [0, 1, 0];
  let right = cross(forward, up);
  if (length(right) < 1e-9) right = cross(forward, [0, 1, 0]);
  right = normalize(right);
  const cameraUp = cross(right, forward);
  return fromColumns(right, cameraUp, scale(forward, -1));
}

export function keepOutside(pose: CameraPose, centerKm: Vec3, minDistanceKm: number): CameraPose {
  const offset = sub(pose.positionKm, centerKm);
  const d = length(offset);
  if (d >= minDistanceKm) return pose;
  const direction: Vec3 = d === 0 ? [0, 0, 1] : scale(offset, 1 / d);
  return { ...pose, positionKm: add(centerKm, scale(direction, minDistanceKm)) };
}
```

```ts
// src/camera/transition.ts
import { add, length, lerp, normalize, scale, slerpDirection, sub } from '../core/math/vec3';
import type { CameraPose } from './types';

export const TRANSITION_SECONDS = 1.6;

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Fly from one pose to another. Distance to the destination is interpolated in log space so a jump
 * from 10 AU to 300 000 km looks smooth; the gaze reaches the destination by the halfway point.
 */
export function interpolatePose(from: CameraPose, to: CameraPose, s: number): CameraPose {
  const t = easeInOutCubic(Math.min(1, Math.max(0, s)));
  const fromOffset = sub(from.positionKm, to.lookAtKm);
  const toOffset = sub(to.positionKm, to.lookAtKm);
  const d0 = Math.max(length(fromOffset), 1e-6);
  const d1 = Math.max(length(toOffset), 1e-6);
  const distance = Math.exp(Math.log(d0) + (Math.log(d1) - Math.log(d0)) * t);
  const direction = slerpDirection(normalize(fromOffset), normalize(toOffset), t);
  return {
    positionKm: t >= 1 ? to.positionKm : add(to.lookAtKm, scale(direction, distance)),
    lookAtKm: lerp(from.lookAtKm, to.lookAtKm, Math.min(1, 2 * t)),
  };
}
```

- [ ] **Step 4: Create `src/camera/orbitController.ts` and `src/camera/followController.ts`**

```ts
// src/camera/orbitController.ts
import { DEG } from '../core/math/angles';
import { add, length, scale, sub, ZERO, type Vec3 } from '../core/math/vec3';
import { keepOutside } from './rig';
import type { CameraPose, ControllerContext, InputDeltas } from './types';

export const ROTATE_RAD_PER_PX = 0.005;
export const ZOOM_PER_UNIT = 0.0015;
export const PAN_PER_PX = 0.0015;
export const MAX_ELEVATION_RAD = 89.9 * DEG;
/** The camera never comes closer to a body's centre than this many radii. */
export const MIN_SURFACE_FACTOR = 1.2;
export const MAX_DISTANCE_KM = 5e11;
const FOCUS_DISTANCE_RADII = 6;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export interface OrbitState {
  targetId: string;
  distanceKm: number;
  azimuthRad: number;
  elevationRad: number;
  panOffsetKm: Vec3;
}

export function offsetDirection(azimuthRad: number, elevationRad: number): Vec3 {
  const ce = Math.cos(elevationRad);
  return [ce * Math.cos(azimuthRad), ce * Math.sin(azimuthRad), Math.sin(elevationRad)];
}

export function sphericalFromOffset(offset: Vec3): { distanceKm: number; azimuthRad: number; elevationRad: number } {
  const d = length(offset);
  if (d === 0) return { distanceKm: 0, azimuthRad: 0, elevationRad: 0 };
  return {
    distanceKm: d,
    azimuthRad: Math.atan2(offset[1], offset[0]),
    elevationRad: clamp(Math.asin(clamp(offset[2] / d, -1, 1)), -MAX_ELEVATION_RAD, MAX_ELEVATION_RAD),
  };
}

export function applyOrbitInput(state: OrbitState, input: InputDeltas, targetRadiusKm: number): OrbitState {
  const azimuthRad = state.azimuthRad - input.rotateX * ROTATE_RAD_PER_PX;
  const elevationRad = clamp(state.elevationRad + input.rotateY * ROTATE_RAD_PER_PX, -MAX_ELEVATION_RAD, MAX_ELEVATION_RAD);
  const distanceKm = clamp(state.distanceKm * Math.exp(input.zoom * ZOOM_PER_UNIT), targetRadiusKm * MIN_SURFACE_FACTOR, MAX_DISTANCE_KM);
  const right: Vec3 = [-Math.sin(azimuthRad), Math.cos(azimuthRad), 0];
  const up: Vec3 = [-Math.sin(elevationRad) * Math.cos(azimuthRad), -Math.sin(elevationRad) * Math.sin(azimuthRad), Math.cos(elevationRad)];
  const panScale = distanceKm * PAN_PER_PX;
  const panOffsetKm = add(state.panOffsetKm, add(scale(right, -input.panX * panScale), scale(up, input.panY * panScale)));
  return { ...state, azimuthRad, elevationRad, distanceKm, panOffsetKm };
}

export function orbitPose(state: OrbitState, targetPositionKm: Vec3): CameraPose {
  const lookAtKm = add(targetPositionKm, state.panOffsetKm);
  return { positionKm: add(lookAtKm, scale(offsetDirection(state.azimuthRad, state.elevationRad), state.distanceKm)), lookAtKm };
}

export function createOrbitController(initial: OrbitState) {
  let state = initial;
  const target = (ctx: ControllerContext) => ctx.bodyPosition(state.targetId) ?? ZERO;
  return {
    id: 'orbit' as const,
    getState: () => state,
    enter(from: CameraPose | null, ctx: ControllerContext) {
      if (!from) return;
      const spherical = sphericalFromOffset(sub(from.positionKm, add(target(ctx), state.panOffsetKm)));
      if (spherical.distanceKm > 0) state = { ...state, ...spherical };
    },
    focus(bodyId: string, ctx: ControllerContext) {
      state = { ...state, targetId: bodyId, panOffsetKm: ZERO, distanceKm: ctx.bodyRadiusKm(bodyId) * FOCUS_DISTANCE_RADII };
    },
    update(input: InputDeltas, ctx: ControllerContext): CameraPose {
      const radius = ctx.bodyRadiusKm(state.targetId);
      state = applyOrbitInput(state, input, radius);
      const center = target(ctx);
      return keepOutside(orbitPose(state, center), center, radius * MIN_SURFACE_FACTOR);
    },
  };
}
```

```ts
// src/camera/followController.ts
import { apply, transpose, type Mat3 } from '../core/math/mat3';
import { add, normalize, scale, sub, ZERO, type Vec3 } from '../core/math/vec3';
import { applyOrbitInput, MIN_SURFACE_FACTOR, offsetDirection, sphericalFromOffset } from './orbitController';
import { keepOutside } from './rig';
import type { CameraPose, ControllerContext, InputDeltas } from './types';

export const FOLLOW_DISTANCE_RADII = 4;

export interface FollowState {
  targetId: string;
  distanceKm: number;
  azimuthRad: number;
  elevationRad: number;
  /** When true, azimuth/elevation are measured in the body-fixed frame, so the view turns with the body. */
  coRotate: boolean;
}

function worldDirection(state: FollowState, orientation: Mat3 | undefined): Vec3 {
  const local = offsetDirection(state.azimuthRad, state.elevationRad);
  return state.coRotate && orientation ? apply(orientation, local) : local;
}

export function followPose(state: FollowState, targetPositionKm: Vec3, orientation?: Mat3): CameraPose {
  return { positionKm: add(targetPositionKm, scale(worldDirection(state, orientation), state.distanceKm)), lookAtKm: targetPositionKm };
}

export function createFollowController(initial: FollowState) {
  let state = initial;
  const setDirection = (worldDir: Vec3, orientation: Mat3 | undefined) => {
    const local = state.coRotate && orientation ? apply(transpose(orientation), worldDir) : worldDir;
    const { azimuthRad, elevationRad } = sphericalFromOffset(local);
    state = { ...state, azimuthRad, elevationRad };
  };
  return {
    id: 'follow' as const,
    getState: () => state,
    setTarget(bodyId: string, ctx: ControllerContext) {
      state = { ...state, targetId: bodyId, distanceKm: ctx.bodyRadiusKm(bodyId) * FOLLOW_DISTANCE_RADII };
    },
    enter(from: CameraPose | null, ctx: ControllerContext, targetId: string) {
      this.setTarget(targetId, ctx);
      const center = ctx.bodyPosition(targetId) ?? ZERO;
      if (from) setDirection(normalize(sub(from.positionKm, center)), ctx.bodyOrientation(targetId));
    },
    setCoRotate(on: boolean, ctx: ControllerContext) {
      if (on === state.coRotate) return;
      const orientation = ctx.bodyOrientation(state.targetId);
      const current = worldDirection(state, orientation);
      state = { ...state, coRotate: on };
      setDirection(current, orientation);
    },
    update(input: InputDeltas, ctx: ControllerContext): CameraPose {
      const radius = ctx.bodyRadiusKm(state.targetId);
      const next = applyOrbitInput(
        { targetId: state.targetId, distanceKm: state.distanceKm, azimuthRad: state.azimuthRad, elevationRad: state.elevationRad, panOffsetKm: ZERO },
        { ...input, panX: 0, panY: 0 },
        radius,
      );
      state = { ...state, distanceKm: next.distanceKm, azimuthRad: next.azimuthRad, elevationRad: next.elevationRad };
      const center = ctx.bodyPosition(state.targetId) ?? ZERO;
      return keepOutside(followPose(state, center, ctx.bodyOrientation(state.targetId)), center, radius * MIN_SURFACE_FACTOR);
    },
  };
}
```

- [ ] **Step 5: Create `src/camera/input.ts`**

```ts
import { NO_INPUT, type InputDeltas } from './types';

const LINE_PX = 16;
const PAGE_PX = 400;

export function wheelToZoom(deltaY: number, deltaMode: number): number {
  return deltaY * (deltaMode === 1 ? LINE_PX : deltaMode === 2 ? PAGE_PX : 1);
}

/** Fingers moving apart (current > previous) zoom in (negative zoom). */
export function pinchToZoom(previousDistancePx: number, currentDistancePx: number): number {
  return (previousDistancePx - currentDistancePx) * 4;
}

export function createPointerInput() {
  let acc: InputDeltas = { ...NO_INPUT };
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDistance: number | null = null;
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;
  };

  const onPointerDown = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinchDistance = spread();
  };
  const onPointerMove = (e: PointerEvent) => {
    const previous = pointers.get(e.pointerId);
    if (!previous) return;
    const dx = e.clientX - previous.x;
    const dy = e.clientY - previous.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      if (e.buttons & 2 || e.shiftKey) {
        acc.panX += dx;
        acc.panY += dy;
      } else {
        acc.rotateX += dx;
        acc.rotateY += dy;
      }
    } else if (pointers.size === 2) {
      const current = spread();
      if (current !== null && pinchDistance !== null) acc.zoom += pinchToZoom(pinchDistance, current);
      pinchDistance = current;
    }
  };
  const onPointerUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinchDistance = spread();
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    acc.zoom += wheelToZoom(e.deltaY, e.deltaMode);
  };
  const onContextMenu = (e: Event) => e.preventDefault();

  return {
    attach(el: HTMLElement): () => void {
      el.addEventListener('pointerdown', onPointerDown);
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
      el.addEventListener('pointercancel', onPointerUp);
      el.addEventListener('wheel', onWheel, { passive: false });
      el.addEventListener('contextmenu', onContextMenu);
      return () => {
        el.removeEventListener('pointerdown', onPointerDown);
        el.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerup', onPointerUp);
        el.removeEventListener('pointercancel', onPointerUp);
        el.removeEventListener('wheel', onWheel);
        el.removeEventListener('contextmenu', onContextMenu);
      };
    },
    consume(): InputDeltas {
      const out = acc;
      acc = { ...NO_INPUT };
      return out;
    },
  };
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/camera`
Expected: all PASS.

- [ ] **Step 7: Create `src/camera/CameraSystem.tsx`**

```tsx
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Matrix4 } from 'three';
import type { Catalog } from '../core/catalog/catalog';
import { DEG } from '../core/math/angles';
import { useFrameState } from '../scene/FrameStateContext';
import type { FrameState } from '../scene/frameState';
import { writeMatrix4 } from '../scene/threeMath';
import { useSelectionStore } from '../state/selectionStore';
import { useViewStore, type ViewId } from '../state/viewStore';
import { createFollowController } from './followController';
import { createPointerInput } from './input';
import { createOrbitController } from './orbitController';
import { lookRotation } from './rig';
import { interpolatePose, TRANSITION_SECONDS } from './transition';
import type { CameraPose, ControllerContext } from './types';

const INITIAL_DISTANCE_KM = 2.2e9; // ~14.7 AU: the inner system and Jupiter comfortably in view
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

function makeContext(frame: FrameState, catalog: Catalog): ControllerContext {
  return {
    bodyPosition: (id) => frame.bodyPositionsKm.get(id),
    bodyRadiusKm: (id) => catalog.bodyById.get(id)?.shape.equatorialRadiusKm ?? 1,
    bodyOrientation: (id) => frame.bodyOrientation.get(id),
  };
}

interface Rig {
  orbit: ReturnType<typeof createOrbitController>;
  follow: ReturnType<typeof createFollowController>;
  activeView: ViewId;
  lastPose: CameraPose | null;
  transition: { from: CameraPose; startedAt: number } | null;
  lastFocusSeq: number;
  lastSelectedId: string | null;
  lastCoRotate: boolean;
}

export function CameraSystem({ catalog }: { catalog: Catalog }) {
  const frame = useFrameState();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const input = useMemo(() => createPointerInput(), []);
  const matrix = useMemo(() => new Matrix4(), []);
  useEffect(() => input.attach(gl.domElement), [gl, input]);

  const rig = useRef<Rig | null>(null);
  if (!rig.current) {
    const home = catalog.bodies.find((b) => b.category === 'star')?.id ?? catalog.bodies[0]!.id;
    rig.current = {
      orbit: createOrbitController({ targetId: home, distanceKm: INITIAL_DISTANCE_KM, azimuthRad: -90 * DEG, elevationRad: 30 * DEG, panOffsetKm: [0, 0, 0] }),
      follow: createFollowController({ targetId: home, distanceKm: 1, azimuthRad: 0, elevationRad: 0.3, coRotate: false }),
      activeView: 'orbit',
      lastPose: null,
      transition: null,
      lastFocusSeq: 0,
      lastSelectedId: null,
      lastCoRotate: false,
    };
  }

  useFrame((state) => {
    const r = rig.current!;
    const ctx = makeContext(frame, catalog);
    const now = state.clock.elapsedTime;
    const { view, coRotate, focusRequest } = useViewStore.getState();
    const selectedId = useSelectionStore.getState().selectedId;
    const startTransition = () => {
      if (r.lastPose) r.transition = { from: r.lastPose, startedAt: now };
    };

    if (view !== r.activeView) {
      if (view === 'follow') r.follow.enter(r.lastPose, ctx, selectedId ?? r.orbit.getState().targetId);
      else r.orbit.enter(r.lastPose, ctx);
      r.activeView = view;
      startTransition();
    }
    if (view === 'follow' && selectedId && selectedId !== r.lastSelectedId && selectedId !== r.follow.getState().targetId) {
      r.follow.setTarget(selectedId, ctx);
      startTransition();
    }
    r.lastSelectedId = selectedId;
    if (focusRequest && focusRequest.seq !== r.lastFocusSeq) {
      r.lastFocusSeq = focusRequest.seq;
      if (view === 'orbit') {
        r.orbit.focus(focusRequest.bodyId, ctx);
        startTransition();
      } else {
        useSelectionStore.getState().select(focusRequest.bodyId);
      }
    }
    if (coRotate !== r.lastCoRotate) {
      r.follow.setCoRotate(coRotate, ctx);
      r.lastCoRotate = coRotate;
    }

    let pose = (view === 'follow' ? r.follow : r.orbit).update(input.consume(), ctx);
    if (r.transition) {
      const s = prefersReducedMotion() ? 1 : (now - r.transition.startedAt) / TRANSITION_SECONDS;
      pose = interpolatePose(r.transition.from, pose, s);
      if (s >= 1) r.transition = null;
    }
    r.lastPose = pose;
    frame.cameraPositionKm = pose.positionKm;
    camera.position.set(0, 0, 0);
    camera.quaternion.setFromRotationMatrix(writeMatrix4(lookRotation(pose.positionKm, pose.lookAtKm), matrix));
  }, -1);

  return null;
}
```

- [ ] **Step 8: Create `src/scene/SceneRoot.tsx`**

```tsx
// src/scene/SceneRoot.tsx
import { Canvas } from '@react-three/fiber';
import { CameraSystem } from '../camera/CameraSystem';
import type { Catalog } from '../core/catalog/catalog';
import type { Body, PlanetApproxOrbit } from '../core/catalog/schema';
import { BodyMesh } from './BodyMesh';
import { Effects } from './Effects';
import { FrameDriver } from './FrameDriver';
import { FrameStateProvider } from './FrameStateContext';
import { OrbitLine } from './OrbitLine';
import { SunLight } from './SunLight';

const hasApproxOrbit = (b: Body): b is Body & { orbit: PlanetApproxOrbit } => b.orbit.type === 'planet-approx';

export function SceneRoot({ catalog }: { catalog: Catalog }) {
  const star = catalog.bodies.find((b) => b.category === 'star');
  return (
    <Canvas
      className="scene"
      gl={{ logarithmicDepthBuffer: true, antialias: true }}
      camera={{ fov: 50, near: 0.001, far: 1e13, position: [0, 0, 0] }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#03050b']} />
      <FrameStateProvider>
        <FrameDriver bodies={catalog.bodies} />
        <CameraSystem catalog={catalog} />
        <ambientLight intensity={0.035} />
        {star && <SunLight bodyId={star.id} />}
        {catalog.bodies.map((body) => (
          <BodyMesh key={body.id} body={body} />
        ))}
        {catalog.bodies.filter(hasApproxOrbit).map((body) => (
          <OrbitLine key={`orbit-${body.id}`} body={body} />
        ))}
        <Effects />
      </FrameStateProvider>
    </Canvas>
  );
}
```

- [ ] **Step 9: Type-check and run all tests**

Run: `npm run typecheck` then `npm test`
Expected: typecheck exits 0; all tests PASS.

- [ ] **Step 10: Commit**

```powershell
git add src/camera src/scene/SceneRoot.tsx
git commit -m "feat(camera): add orbit and follow views with smooth transitions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Number formatting and the time bar

**Files:**
- Create: `src/ui/format.ts`, `src/ui/TimeBar.tsx`
- Test: `src/ui/format.test.ts`, `src/ui/TimeBar.test.tsx`

**Interfaces:**
- Consumes: `formatUtc`, `parseDateInput` (Task 4); `utcToTdb`, `tdbToUtc` (Task 4); `validityStatus` (Task 14); `useTimeStore`, `RATE_STEPS` (Task 15); `Catalog`, `createCatalog` (Task 14); `AU_KM` (Task 1); `FACT_DEFS` entry shape (Task 6).
- Produces (`format.ts`): `formatNumber(value: number): string` (grouped up to 6 significant digits; scientific `1.898 × 10²⁷` at ≥ 1e10 or < 1e-3); `formatFact(def: { unit: string }, value: number | string | boolean): string`; `formatDistanceKm(km: number): string`; `formatLightTime(seconds: number): string`.
- Produces (`TimeBar.tsx`): `VALIDITY_MESSAGES: Record<'extended' | 'out-of-range', string>`; `TimeBar({ catalog }: { catalog: Catalog })`.

- [ ] **Step 1: Write the failing tests `src/ui/format.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { formatDistanceKm, formatFact, formatLightTime, formatNumber } from './format';

describe('formatNumber', () => {
  it.each([
    [0, '0'],
    [12756, '12,756'],
    [0.20563593, '0.205636'],
    [778.5e6, '778,500,000'],
    [1.898e27, '1.898 × 10²⁷'],
    [1.9884e30, '1.9884 × 10³⁰'],
    [0.00001, '1 × 10⁻⁵'],
    [-110, '-110'],
  ])('%d -> %s', (value, text) => {
    expect(formatNumber(value)).toBe(text);
  });
});

describe('formatFact', () => {
  it('adds units with the right spacing and renders booleans and strings', () => {
    expect(formatFact({ unit: 'kg' }, 1.898e27)).toBe('1.898 × 10²⁷ kg');
    expect(formatFact({ unit: '°' }, 3.1)).toBe('3.1°');
    expect(formatFact({ unit: '°C' }, -110)).toBe('-110°C');
    expect(formatFact({ unit: '' }, 95)).toBe('95');
    expect(formatFact({ unit: '' }, true)).toBe('Yes');
    expect(formatFact({ unit: '' }, 'G2 V')).toBe('G2 V');
  });
});

describe('distances and light time', () => {
  it('shows km and AU', () => {
    expect(formatDistanceKm(149_597_870.7)).toBe('149,598,000 km (1.0000 AU)');
  });
  it('shows light time in s, min or h', () => {
    expect(formatLightTime(1.28)).toBe('1.3 s');
    expect(formatLightTime(499)).toBe('8 min 19 s');
    expect(formatLightTime(15_000)).toBe('4 h 10 min');
  });
});
```

- [ ] **Step 2: Write the failing tests `src/ui/TimeBar.test.tsx`**

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { calendarToJd } from '../core/time/julian';
import { utcToTdb } from '../core/time/timescales';
import { useTimeStore } from '../state/timeStore';
import { makeCatalogFiles } from '../test/fixtures';
import { TimeBar } from './TimeBar';

const files = makeCatalogFiles();
const catalog = createCatalog(files.regions, files.sources, [files.bodies]);
const J2000_UTC_TDB = utcToTdb(2451545.0);

beforeEach(() => useTimeStore.setState({ jdTdb: J2000_UTC_TDB, playing: true, rateIndex: 0, direction: 1 }));

describe('TimeBar', () => {
  it('shows the simulation date in UTC and no warning inside 1800-2050', () => {
    render(<TimeBar catalog={catalog} />);
    expect(screen.getByLabelText('Simulation date')).toHaveTextContent('1 Jan 2000, 12:00:00 UTC');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('toggles play/pause and reverse', async () => {
    const user = userEvent.setup();
    render(<TimeBar catalog={catalog} />);
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(useTimeStore.getState().playing).toBe(false);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reverse' }));
    expect(useTimeStore.getState().direction).toBe(-1);
    expect(screen.getByRole('button', { name: 'Reverse' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('changes speed', async () => {
    const user = userEvent.setup();
    render(<TimeBar catalog={catalog} />);
    await user.selectOptions(screen.getByLabelText('Speed'), '1 day/s');
    expect(useTimeStore.getState().rateIndex).toBe(3);
  });

  it('jumps to a typed date and warns about lower accuracy before 1800', async () => {
    const user = userEvent.setup();
    render(<TimeBar catalog={catalog} />);
    await user.type(screen.getByLabelText('Go to date (UTC)'), '1500-01-01{Enter}');
    expect(useTimeStore.getState().jdTdb).toBeCloseTo(utcToTdb(calendarToJd({ year: 1500, month: 1, day: 1, hour: 0, minute: 0, second: 0 })), 9);
    expect(screen.getByLabelText('Simulation date')).toHaveTextContent('1 Jan 1500, 00:00:00 UT');
    expect(screen.getByRole('status')).toHaveTextContent('Outside 1800–2050');
  });

  it('rejects an invalid date and leaves time unchanged', async () => {
    const user = userEvent.setup();
    render(<TimeBar catalog={catalog} />);
    await user.type(screen.getByLabelText('Go to date (UTC)'), '2026-02-30{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('That date does not exist in the calendar.');
    expect(useTimeStore.getState().jdTdb).toBe(J2000_UTC_TDB);
  });

  it('says positions are extrapolated far outside every model range', () => {
    useTimeStore.setState({ jdTdb: utcToTdb(calendarToJd({ year: 9999, month: 1, day: 1, hour: 0, minute: 0, second: 0 })) });
    render(<TimeBar catalog={catalog} />);
    expect(screen.getByRole('status')).toHaveTextContent('extrapolated');
  });
});
```

- [ ] **Step 3: Run and confirm failure**

Run: `npx vitest run src/ui`
Expected: FAIL, modules not found.

- [ ] **Step 4: Create `src/ui/format.ts`**

```ts
import { AU_KM } from '../core/units';

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};
const grouped = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 });

export function formatNumber(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e10 || abs < 1e-3) {
    const [mantissa, exponent] = value.toExponential(4).split('e') as [string, string];
    const power = [...String(Number(exponent))].map((ch) => SUPERSCRIPT[ch] ?? ch).join('');
    return `${Number(mantissa)} × 10${power}`;
  }
  return grouped.format(value);
}

export function formatFact(def: { unit: string }, value: number | string | boolean): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = typeof value === 'number' ? formatNumber(value) : value;
  if (!def.unit) return text;
  return def.unit.startsWith('°') ? `${text}${def.unit}` : `${text} ${def.unit}`;
}

export function formatDistanceKm(km: number): string {
  return `${formatNumber(km)} km (${(km / AU_KM).toFixed(4)} AU)`;
}

export function formatLightTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
  return `${Math.floor(seconds / 3600)} h ${Math.round((seconds % 3600) / 60)} min`;
}
```

- [ ] **Step 5: Create `src/ui/TimeBar.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import type { Catalog } from '../core/catalog/catalog';
import { validityStatus } from '../core/ephemeris/state';
import { formatUtc, parseDateInput } from '../core/time/format';
import { tdbToUtc, utcToTdb } from '../core/time/timescales';
import { RATE_STEPS, useTimeStore } from '../state/timeStore';

export const VALIDITY_MESSAGES = {
  extended: 'Outside 1800–2050: planet positions use JPL’s 3000 BC–AD 3000 elements (lower accuracy).',
  'out-of-range': 'Outside 3000 BC–AD 3000: planet positions are extrapolated and only approximate.',
} as const;

export function TimeBar({ catalog }: { catalog: Catalog }) {
  const jdTdb = useTimeStore((s) => s.jdTdb);
  const playing = useTimeStore((s) => s.playing);
  const rateIndex = useTimeStore((s) => s.rateIndex);
  const direction = useTimeStore((s) => s.direction);
  const togglePlaying = useTimeStore((s) => s.togglePlaying);
  const toggleDirection = useTimeStore((s) => s.toggleDirection);
  const setRateIndex = useTimeStore((s) => s.setRateIndex);
  const resetToNow = useTimeStore((s) => s.resetToNow);
  const setJdTdb = useTimeStore((s) => s.setJdTdb);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const status = validityStatus(catalog.bodies, jdTdb);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseDateInput(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setJdTdb(utcToTdb(parsed.jdUtc));
    setDraft('');
  };

  return (
    <section className="panel time-bar" aria-label="Time controls">
      {/* <time>, not <output>: <output> has the implicit ARIA role "status", reserved here for accuracy warnings */}
      <time className="time-bar__date" aria-label="Simulation date">
        {formatUtc(tdbToUtc(jdTdb))}
      </time>
      <div className="time-bar__controls">
        <button type="button" aria-pressed={direction === -1} onClick={toggleDirection}>
          Reverse
        </button>
        <button type="button" className="primary" onClick={togglePlaying}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <label className="time-bar__speed">
          Speed
          <select value={rateIndex} onChange={(e) => setRateIndex(Number(e.target.value))}>
            {RATE_STEPS.map((step, i) => (
              <option key={step.label} value={i}>
                {step.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => resetToNow()}>
          Now
        </button>
      </div>
      <form className="time-bar__jump" onSubmit={onSubmit}>
        <label htmlFor="date-input">Go to date (UTC)</label>
        <input
          id="date-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="2026-10-04 or -1000-07-12 12:00"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'date-error' : undefined}
          autoComplete="off"
        />
        <button type="submit">Go</button>
        {error && (
          <p id="date-error" className="time-bar__error" role="alert">
            {error}
          </p>
        )}
      </form>
      {status !== 'high' && (
        <p className="time-bar__warning" role="status">
          {VALIDITY_MESSAGES[status]}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/ui`
Expected: all PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/ui/format.ts src/ui/format.test.ts src/ui/TimeBar.tsx src/ui/TimeBar.test.tsx
git commit -m "feat(ui): add number formatting and time controls" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Info panel with citations, live values and accuracy

**Files:**
- Create: `src/ui/citations.ts`, `src/ui/accuracy.ts`, `src/ui/InfoPanel.tsx`
- Test: `src/ui/InfoPanel.test.tsx`

**Interfaces:**
- Consumes: `Catalog` (Task 14); `Body`, `BodyCategory` (Task 6); `FACT_KEYS`, `FACT_DEFS`, `FactGroup` (Task 6); `bodyState` (Task 14); `distance` (Task 2); `SPEED_OF_LIGHT_KM_S` (Task 1); stores (Task 15); `formatFact`, `formatNumber`, `formatDistanceKm`, `formatLightTime` (Task 18).
- Produces (`citations.ts`): `citationOrder(body: Body): string[]` (unique source ids in display order); `citationNumbers(order: string[]): Map<string, number>` (1-based).
- Produces (`accuracy.ts`): `accuracyLines(body: Body): string[]`.
- Produces (`InfoPanel.tsx`): `InfoPanel({ catalog }: { catalog: Catalog })`, an `<aside aria-label="Body information">`, rendered only when a body is selected.

- [ ] **Step 1: Write the failing tests `src/ui/InfoPanel.test.tsx`**

```tsx
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { useSelectionStore } from '../state/selectionStore';
import { useTimeStore } from '../state/timeStore';
import { useViewStore } from '../state/viewStore';
import { makeCatalogFiles } from '../test/fixtures';
import { InfoPanel } from './InfoPanel';

const files = makeCatalogFiles();
const catalog = createCatalog(files.regions, files.sources, [files.bodies]);

beforeEach(() => {
  useTimeStore.setState({ jdTdb: 2451545, playing: false });
  useViewStore.setState({ view: 'orbit', focusRequest: null });
  useSelectionStore.setState({ selectedId: 'jupiter' });
});

const panel = () => screen.getByRole('complementary', { name: 'Body information' });

describe('InfoPanel', () => {
  it('renders nothing when nothing is selected', () => {
    useSelectionStore.setState({ selectedId: null });
    const { container } = render(<InfoPanel catalog={catalog} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the name, kind, description and formatted facts', () => {
    render(<InfoPanel catalog={catalog} />);
    expect(within(panel()).getByRole('heading', { name: 'Jupiter' })).toBeInTheDocument();
    expect(panel()).toHaveTextContent('Planet · orbits the Sun');
    expect(panel()).toHaveTextContent('Jupiter is the fifth planet from the Sun');
    const mass = within(panel()).getByText('Mass').closest('.facts__row')!;
    expect(mass).toHaveTextContent('1.898 × 10²⁷ kg');
  });

  it('cites every value and lists the sources with links', () => {
    render(<InfoPanel catalog={catalog} />);
    const mass = within(panel()).getByText('Mass').closest('.facts__row') as HTMLElement;
    const cite = within(mass).getByRole('link');
    expect(cite.getAttribute('href')).toBe('#source-nssdca-planetary-fact-sheet');
    const source = within(panel()).getByRole('link', { name: 'Planetary Fact Sheet - Metric' });
    expect(source).toHaveAttribute('href', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/');
    expect(source.closest('li')).toHaveAttribute('id', 'source-nssdca-planetary-fact-sheet');
  });

  it('never shows undefined or NaN, and omits facts the source lists as unknown', () => {
    render(<InfoPanel catalog={catalog} />);
    expect(panel().textContent).not.toMatch(/undefined|NaN/);
    expect(within(panel()).queryByText('Surface pressure')).not.toBeInTheDocument();
  });

  it('shows live distances and the measured accuracy', () => {
    render(<InfoPanel catalog={catalog} />);
    expect(panel()).toHaveTextContent('Distance from the Sun');
    expect(panel()).toHaveTextContent('Distance from Earth');
    expect(panel()).toHaveTextContent('Light travel time from Earth');
    expect(panel()).toHaveTextContent('Measured against JPL Horizons at 6 dates');
  });

  it("shows the Sun's notes and its frame-origin accuracy note", () => {
    useSelectionStore.setState({ selectedId: 'sun' });
    render(<InfoPanel catalog={catalog} />);
    expect(panel()).toHaveTextContent('Adopted period at 16° latitude');
    expect(panel()).toHaveTextContent('origin of the heliocentric frame');
    expect(panel()).not.toHaveTextContent('Distance from the Sun');
  });

  it('explains that Earth is drawn at the Earth–Moon barycentre', () => {
    useSelectionStore.setState({ selectedId: 'earth' });
    render(<InfoPanel catalog={catalog} />);
    expect(panel()).toHaveTextContent('Earth–Moon barycentre');
  });

  it('centres the view and closes', async () => {
    const user = userEvent.setup();
    render(<InfoPanel catalog={catalog} />);
    await user.click(screen.getByRole('button', { name: 'Centre view' }));
    expect(useViewStore.getState().focusRequest?.bodyId).toBe('jupiter');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(useSelectionStore.getState().selectedId).toBeNull();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/ui/InfoPanel.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Create `src/ui/citations.ts` and `src/ui/accuracy.ts`**

```ts
// src/ui/citations.ts
import { FACT_KEYS } from '../core/catalog/facts';
import type { Body } from '../core/catalog/schema';

/** Unique source ids in the order the panel displays them. */
export function citationOrder(body: Body): string[] {
  const ids: string[] = [];
  const add = (id: string | undefined) => {
    if (id && !ids.includes(id)) ids.push(id);
  };
  add(body.description?.sourceId);
  for (const key of FACT_KEYS) add(body.facts[key]?.sourceId);
  if (body.orbit.type === 'planet-approx') {
    add(body.orbit.sourceId);
    for (const table of body.orbit.tables) add(table.horizonsCheck?.sourceId);
  }
  add(body.rotation?.sourceId);
  add(body.shape.sourceId);
  return ids;
}

export function citationNumbers(order: string[]): Map<string, number> {
  return new Map(order.map((id, i) => [id, i + 1]));
}
```

```ts
// src/ui/accuracy.ts
import type { Body } from '../core/catalog/schema';
import { formatNumber } from './format';

const TABLE_LABELS: Record<string, string> = {
  '1800-2050': '1800–2050',
  '3000BC-3000AD': '3000 BC–AD 3000',
};

export function accuracyLines(body: Body): string[] {
  const orbit = body.orbit;
  if (orbit.type === 'fixed') return [orbit.note];
  const lines = orbit.tables.map((t) => {
    const nominal = `${TABLE_LABELS[t.id] ?? t.id}: JPL nominal error ${formatNumber(t.nominalError.longitudeArcsec)}″ in longitude, ${formatNumber(t.nominalError.latitudeArcsec)}″ in latitude, ${formatNumber(t.nominalError.distanceKm)} km in distance.`;
    const check = t.horizonsCheck
      ? ` Measured against JPL Horizons at ${t.horizonsCheck.sampleCount} dates: up to ${formatNumber(t.horizonsCheck.maxAngularErrorArcsec)}″ in direction and ${formatNumber(t.horizonsCheck.maxDistanceErrorKm)} km in distance.`
      : '';
    return nominal + check;
  });
  if (orbit.represents === 'earth-moon-barycenter') {
    lines.push('Earth is drawn at the Earth–Moon barycentre; the Moon arrives in a later release.');
  }
  return lines;
}
```

- [ ] **Step 4: Create `src/ui/InfoPanel.tsx`**

```tsx
import type { Catalog } from '../core/catalog/catalog';
import { FACT_DEFS, FACT_KEYS, type FactGroup } from '../core/catalog/facts';
import type { Body, BodyCategory } from '../core/catalog/schema';
import { bodyState } from '../core/ephemeris/state';
import { distance } from '../core/math/vec3';
import { SPEED_OF_LIGHT_KM_S } from '../core/units';
import { useSelectionStore } from '../state/selectionStore';
import { useTimeStore } from '../state/timeStore';
import { useViewStore } from '../state/viewStore';
import { accuracyLines } from './accuracy';
import { citationNumbers, citationOrder } from './citations';
import { formatDistanceKm, formatFact, formatLightTime } from './format';

const CATEGORY_LABELS: Record<BodyCategory, string> = {
  star: 'Star', planet: 'Planet', 'dwarf-planet': 'Dwarf planet', moon: 'Moon', asteroid: 'Asteroid', comet: 'Comet', spacecraft: 'Spacecraft',
};
const GROUP_TITLES: Record<FactGroup, string> = { physical: 'Physical characteristics', orbit: 'Orbit' };

function liveDistances(catalog: Catalog, body: Body, jdTdb: number) {
  const position = bodyState(body, jdTdb).positionKm;
  const sun = catalog.bodies.find((b) => b.category === 'star');
  const earth = catalog.bodyById.get('earth');
  return {
    fromSunKm: sun && sun.id !== body.id ? distance(position, bodyState(sun, jdTdb).positionKm) : null,
    fromEarthKm: earth && earth.id !== body.id ? distance(position, bodyState(earth, jdTdb).positionKm) : null,
  };
}

export function InfoPanel({ catalog }: { catalog: Catalog }) {
  const selectedId = useSelectionStore((s) => s.selectedId);
  const select = useSelectionStore((s) => s.select);
  const view = useViewStore((s) => s.view);
  const requestFocus = useViewStore((s) => s.requestFocus);
  const jdTdb = useTimeStore((s) => s.jdTdb);
  const body = selectedId ? catalog.bodyById.get(selectedId) : undefined;
  if (!body) return null;

  const order = citationOrder(body);
  const numbers = citationNumbers(order);
  const cite = (sourceId: string) => (
    <sup className="cite">
      <a href={`#source-${sourceId}`} aria-label={`Source ${numbers.get(sourceId)}`}>
        [{numbers.get(sourceId)}]
      </a>
    </sup>
  );
  const parent = body.parentId ? catalog.bodyById.get(body.parentId) : undefined;
  const live = liveDistances(catalog, body, jdTdb);
  const positionSource = body.orbit.type === 'planet-approx' ? body.orbit.sourceId : null;

  return (
    <aside className="panel info-panel" aria-label="Body information">
      <header className="info-panel__header">
        <div>
          <h2>{body.name}</h2>
          <p className="info-panel__kind">
            {CATEGORY_LABELS[body.category]}
            {parent ? ` · orbits the ${parent.name}` : ''}
          </p>
        </div>
        <div className="info-panel__actions">
          {view === 'orbit' && (
            <button type="button" onClick={() => requestFocus(body.id)}>
              Centre view
            </button>
          )}
          <button type="button" aria-label="Close" onClick={() => select(null)}>
            ×
          </button>
        </div>
      </header>

      {body.description && (
        <blockquote className="info-panel__description">
          {body.description.text}
          {cite(body.description.sourceId)}
        </blockquote>
      )}

      {(['physical', 'orbit'] as const).map((group) => {
        const keys = FACT_KEYS.filter((k) => FACT_DEFS[k].group === group && body.facts[k] !== undefined);
        if (keys.length === 0) return null;
        return (
          <section key={group}>
            <h3>{GROUP_TITLES[group]}</h3>
            <dl className="facts">
              {keys.map((key) => {
                const fact = body.facts[key]!;
                return (
                  <div className="facts__row" key={key}>
                    <dt>{FACT_DEFS[key].label}</dt>
                    <dd>
                      {formatFact(FACT_DEFS[key], fact.value)}
                      {cite(fact.sourceId)}
                      {fact.note && <span className="facts__note">{fact.note}</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        );
      })}

      {positionSource && (live.fromSunKm !== null || live.fromEarthKm !== null) && (
        <section>
          <h3>At the simulation time</h3>
          <dl className="facts">
            {live.fromSunKm !== null && (
              <div className="facts__row">
                <dt>Distance from the Sun</dt>
                <dd>
                  {formatDistanceKm(live.fromSunKm)}
                  {cite(positionSource)}
                </dd>
              </div>
            )}
            {live.fromEarthKm !== null && (
              <>
                <div className="facts__row">
                  <dt>Distance from Earth</dt>
                  <dd>
                    {formatDistanceKm(live.fromEarthKm)}
                    {cite(positionSource)}
                  </dd>
                </div>
                <div className="facts__row">
                  <dt>Light travel time from Earth</dt>
                  <dd>{formatLightTime(live.fromEarthKm / SPEED_OF_LIGHT_KM_S)}</dd>
                </div>
              </>
            )}
          </dl>
        </section>
      )}

      <section>
        <h3>Position accuracy</h3>
        <ul className="info-panel__accuracy">
          {accuracyLines(body).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <p className="info-panel__note">Illustrative colour — no official surface map in this release.</p>

      <section>
        <h3>Sources</h3>
        <ol className="sources">
          {order.map((id) => {
            const source = catalog.sources.get(id);
            if (!source) return null;
            return (
              <li key={id} id={`source-${id}`}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>{' '}
                — {source.publisher}. Retrieved {source.retrievedAt}.
              </li>
            );
          })}
        </ol>
      </section>
    </aside>
  );
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/ui`
Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/ui/citations.ts src/ui/accuracy.ts src/ui/InfoPanel.tsx src/ui/InfoPanel.test.tsx
git commit -m "feat(ui): add info panel with per-value citations, live distances and accuracy" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: Top bar, status screens, app shell and styling

**Files:**
- Create: `src/ui/TopBar.tsx`, `src/ui/StatusScreens.tsx`, `src/ui/webgl.ts`, `src/styles/tokens.css`, `src/styles/app.css`
- Modify: `src/App.tsx` (replace the placeholder), `src/main.tsx` (fonts and styles)
- Test: `src/ui/TopBar.test.tsx`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `useViewStore` (Task 15); `useCatalogStore` (Task 15); `SceneRoot` (Task 17); `InfoPanel` (Task 19); `TimeBar` (Task 18); `serveCatalog` (Task 15).
- Produces: `TopBar()`; `LoadingScreen()`, `ErrorScreen({ message, onRetry })`, `WebGLUnavailable()`; `isWebGLAvailable(doc?: Document): boolean`; `App()`.

Visual direction for M1: a dark, quiet "observatory" look that keeps attention on the scene. Near-black background; translucent navy panels with a hairline border; Inter for text and JetBrains Mono with tabular figures for numbers and dates; one cool accent (`#7cc4ff`) for interactive state; amber (`#ffb454`) only for accuracy warnings.

- [ ] **Step 1: Write the failing tests**

`src/ui/TopBar.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useViewStore } from '../state/viewStore';
import { TopBar } from './TopBar';

beforeEach(() => useViewStore.setState({ view: 'orbit', coRotate: false, scaleMode: 'readable' }));

describe('TopBar', () => {
  it('switches views with buttons and shows co-rotation only in follow view', async () => {
    const user = userEvent.setup();
    render(<TopBar />);
    expect(screen.queryByLabelText('Rotate with body')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Follow' }));
    expect(useViewStore.getState().view).toBe('follow');
    expect(screen.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByLabelText('Rotate with body'));
    expect(useViewStore.getState().coRotate).toBe(true);
  });

  it('supports keys 1, 2 and Escape, but not while typing', async () => {
    const user = userEvent.setup();
    render(
      <>
        <TopBar />
        <input aria-label="typing" />
      </>,
    );
    await user.keyboard('2');
    expect(useViewStore.getState().view).toBe('follow');
    await user.keyboard('{Escape}');
    expect(useViewStore.getState().view).toBe('orbit');
    await user.click(screen.getByLabelText('typing'));
    await user.keyboard('2');
    expect(useViewStore.getState().view).toBe('orbit');
  });

  it('switches scale mode', async () => {
    const user = userEvent.setup();
    render(<TopBar />);
    await user.click(screen.getByRole('button', { name: 'True scale' }));
    expect(useViewStore.getState().scaleMode).toBe('true');
  });
});
```

`src/App.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCatalogStore } from './state/catalogStore';
import { serveCatalog } from './test/serveCatalog';
import { isWebGLAvailable } from './ui/webgl';
import { App } from './App';

vi.mock('./scene/SceneRoot', () => ({ SceneRoot: () => <div data-testid="scene" /> }));
vi.mock('./ui/webgl', () => ({ isWebGLAvailable: vi.fn(() => true) }));

beforeEach(() => {
  useCatalogStore.setState({ status: 'idle', catalog: null, error: null });
  vi.mocked(isWebGLAvailable).mockReturnValue(true);
  vi.stubGlobal('fetch', serveCatalog());
});

describe('App', () => {
  it('loads the data, then shows the scene and the controls', async () => {
    render(<App />);
    expect(await screen.findByTestId('scene')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Time controls' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Camera view' })).toBeInTheDocument();
  });

  it('shows a readable error with a working retry when data fails to load', async () => {
    vi.stubGlobal('fetch', serveCatalog({ 'regions.json': undefined }));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load data/regions.json (HTTP 404).');
    vi.stubGlobal('fetch', serveCatalog());
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('scene')).toBeInTheDocument();
  });

  it('explains when WebGL is unavailable instead of showing a blank page', () => {
    vi.mocked(isWebGLAvailable).mockReturnValue(false);
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent('3D graphics are not available');
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/ui/TopBar.test.tsx src/App.test.tsx`
Expected: FAIL (modules not found; the placeholder `App` has no such content).

- [ ] **Step 3: Create `src/ui/TopBar.tsx`, `src/ui/StatusScreens.tsx`, `src/ui/webgl.ts`**

```tsx
// src/ui/TopBar.tsx
import { useEffect } from 'react';
import { useViewStore } from '../state/viewStore';

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable);

export function TopBar() {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const coRotate = useViewStore((s) => s.coRotate);
  const toggleCoRotate = useViewStore((s) => s.toggleCoRotate);
  const scaleMode = useViewStore((s) => s.scaleMode);
  const setScaleMode = useViewStore((s) => s.setScaleMode);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === '1' || e.key === 'Escape') setView('orbit');
      else if (e.key === '2') setView('follow');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setView]);

  return (
    <header className="panel top-bar">
      <h1 className="top-bar__title">Solar System</h1>
      <div className="segmented" role="group" aria-label="Camera view">
        <button type="button" aria-pressed={view === 'orbit'} onClick={() => setView('orbit')} title="Rotate, zoom and pan around a point (key 1)">
          Orbit
        </button>
        <button type="button" aria-pressed={view === 'follow'} onClick={() => setView('follow')} title="Fly to the selected body and track it (key 2)">
          Follow
        </button>
      </div>
      {view === 'follow' && (
        <label className="toggle">
          <input type="checkbox" checked={coRotate} onChange={toggleCoRotate} />
          Rotate with body
        </label>
      )}
      <div className="segmented" role="group" aria-label="Scale">
        <button type="button" aria-pressed={scaleMode === 'readable'} onClick={() => setScaleMode('readable')} title="Bodies never shrink below a few pixels">
          Readable
        </button>
        <button type="button" aria-pressed={scaleMode === 'true'} onClick={() => setScaleMode('true')} title="Real sizes; labels keep bodies findable">
          True scale
        </button>
      </div>
      <p className="top-bar__hint">Drag to rotate · right-drag or Shift-drag to pan · scroll to zoom · double-click a body to centre it</p>
    </header>
  );
}
```

```tsx
// src/ui/StatusScreens.tsx
export function LoadingScreen() {
  return (
    <div className="status-screen" role="status">
      <p>Loading Solar System data…</p>
    </div>
  );
}

export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="status-screen" role="alert">
      <h1>Could not load the data</h1>
      <pre className="status-screen__detail">{message}</pre>
      <button type="button" className="primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function WebGLUnavailable() {
  return (
    <div className="status-screen" role="alert">
      <h1>3D graphics are not available</h1>
      <p>
        This app needs WebGL. Turn on hardware acceleration in your browser settings, or use a current version of Chrome, Edge,
        Firefox or Safari.
      </p>
    </div>
  );
}
```

```ts
// src/ui/webgl.ts
export function isWebGLAvailable(doc: Document = document): boolean {
  try {
    const canvas = doc.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Replace `src/App.tsx` and update `src/main.tsx`**

```tsx
// src/App.tsx
import { useEffect, useState } from 'react';
import { SceneRoot } from './scene/SceneRoot';
import { useCatalogStore } from './state/catalogStore';
import { InfoPanel } from './ui/InfoPanel';
import { ErrorScreen, LoadingScreen, WebGLUnavailable } from './ui/StatusScreens';
import { TimeBar } from './ui/TimeBar';
import { TopBar } from './ui/TopBar';
import { isWebGLAvailable } from './ui/webgl';

export function App() {
  const [webgl] = useState(() => isWebGLAvailable());
  const status = useCatalogStore((s) => s.status);
  const catalog = useCatalogStore((s) => s.catalog);
  const error = useCatalogStore((s) => s.error);
  const load = useCatalogStore((s) => s.load);

  useEffect(() => {
    if (webgl && status === 'idle') void load();
  }, [webgl, status, load]);

  if (!webgl) return <WebGLUnavailable />;
  if (status === 'error') return <ErrorScreen message={error ?? 'Unknown error'} onRetry={() => void load()} />;
  if (status !== 'ready' || !catalog) return <LoadingScreen />;

  return (
    <div className="app">
      <SceneRoot catalog={catalog} />
      <TopBar />
      <InfoPanel catalog={catalog} />
      <TimeBar catalog={catalog} />
    </div>
  );
}
```

```tsx
// src/main.tsx
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import './styles/tokens.css';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 5: Create `src/styles/tokens.css`**

```css
:root {
  color-scheme: dark;
  --bg: #03050b;
  --panel: rgba(10, 14, 26, 0.84);
  --panel-border: rgba(140, 170, 230, 0.16);
  --text: #e7ebf3;
  --text-muted: #8d97ad;
  --accent: #7cc4ff;
  --accent-soft: rgba(124, 196, 255, 0.16);
  --warning: #ffb454;
  --danger: #ff7a7a;
  --font-ui: 'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Mono', monospace;
  --radius: 10px;
  --gap: 12px;
  --gutter: 16px;
}
```

- [ ] **Step 6: Create `src/styles/app.css`**

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  margin: 0;
}

body {
  background: var(--bg);
  color: var(--text);
  font: 14px/1.45 var(--font-ui);
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

button,
input,
select {
  font: inherit;
  color: inherit;
}

button,
select,
input {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--panel-border);
  border-radius: 7px;
  padding: 6px 10px;
}

button {
  cursor: pointer;
}

button:hover {
  border-color: rgba(124, 196, 255, 0.45);
}

button.primary,
button[aria-pressed='true'] {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: #fff;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.app {
  position: fixed;
  inset: 0;
}

.scene {
  position: absolute !important;
  inset: 0;
  touch-action: none;
}

.panel {
  position: absolute;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius);
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45);
}

/* Top bar */
.top-bar {
  top: var(--gutter);
  left: var(--gutter);
  right: var(--gutter);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--gap);
  padding: 10px 14px;
}

.top-bar__title {
  margin: 0 8px 0 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.top-bar__hint {
  margin: 0 0 0 auto;
  color: var(--text-muted);
  font-size: 12px;
}

.segmented {
  display: inline-flex;
  gap: 4px;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
}

/* Info panel */
.info-panel {
  top: 84px;
  right: var(--gutter);
  bottom: 150px;
  width: min(380px, calc(100% - 2 * var(--gutter)));
  overflow-y: auto;
  padding: 16px 18px;
}

.info-panel__header {
  display: flex;
  justify-content: space-between;
  gap: var(--gap);
}

.info-panel h2 {
  margin: 0;
  font-size: 22px;
}

.info-panel h3 {
  margin: 18px 0 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.info-panel__kind {
  margin: 2px 0 0;
  color: var(--text-muted);
}

.info-panel__actions {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.info-panel__description {
  margin: 14px 0 0;
  padding-left: 10px;
  border-left: 2px solid var(--accent);
  color: var(--text);
}

.facts {
  margin: 0;
}

.facts__row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 12px;
  padding: 5px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.facts dt {
  color: var(--text-muted);
}

.facts dd {
  margin: 0;
  text-align: right;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.facts__note {
  display: block;
  font-family: var(--font-ui);
  font-size: 12px;
  color: var(--text-muted);
  text-align: right;
}

.cite a {
  margin-left: 3px;
  color: var(--accent);
  font-size: 10px;
  text-decoration: none;
}

.info-panel__accuracy,
.sources {
  margin: 0;
  padding-left: 18px;
  color: var(--text-muted);
  font-size: 12.5px;
}

.sources a {
  color: var(--accent);
}

.info-panel__note {
  margin: 14px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

/* Time bar */
.time-bar {
  left: var(--gutter);
  right: var(--gutter);
  bottom: var(--gutter);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--gap) 20px;
  padding: 12px 16px;
}

.time-bar__date {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 16px;
  min-width: 25ch;
}

.time-bar__controls,
.time-bar__jump,
.time-bar__speed {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-bar__jump input {
  width: 24ch;
  font-family: var(--font-mono);
}

.time-bar__error {
  margin: 0;
  color: var(--danger);
}

.time-bar__warning {
  flex-basis: 100%;
  margin: 0;
  color: var(--warning);
}

/* Labels drawn over the scene */
.body-label {
  transform: translateY(16px);
  padding: 1px 7px;
  border: 0;
  border-radius: 999px;
  background: rgba(3, 5, 11, 0.55);
  color: var(--text);
  font-size: 12px;
  white-space: nowrap;
}

.body-label.is-selected {
  background: var(--accent-soft);
  outline: 1px solid var(--accent);
}

/* Loading / error / no-WebGL */
.status-screen {
  display: grid;
  place-content: center;
  gap: 12px;
  height: 100%;
  padding: var(--gutter);
  text-align: center;
}

.status-screen__detail {
  max-width: 70ch;
  white-space: pre-wrap;
  text-align: left;
  color: var(--text-muted);
}

/* Phones: panels become sheets */
@media (max-width: 720px) {
  .top-bar__hint {
    display: none;
  }
  .info-panel {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: auto;
    max-height: 55vh;
    border-radius: var(--radius) var(--radius) 0 0;
    z-index: 2;
  }
  .time-bar__date {
    min-width: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}
```

- [ ] **Step 7: Run tests, type-check and build**

Run: `npm test`, then `npm run typecheck`, then `npm run build`
Expected: all tests PASS; typecheck exits 0; `vite build` writes `dist/`.

- [ ] **Step 8: Look at it**

Run: `npm run dev` and open the printed URL. Check by eye:
1. The Sun glows; the planets appear as small discs with labels; orbit lines are visible.
2. Dragging rotates, right-drag pans, scrolling zooms smoothly from the whole system down to a planet without jitter.
3. Clicking "Jupiter" opens the info panel. Every value has a `[n]` citation that jumps to the source list.
4. "Centre view" flies to Jupiter. Pressing `2` switches to Follow, and "Rotate with body" keeps the surface fixed under the camera while time runs at 1 hour/s.
5. Typing `1500-01-01` shows the amber accuracy warning; "Now" returns to the present.
6. Narrow the window below 720 px: the info panel becomes a bottom sheet.

Fix anything that fails before committing.

- [ ] **Step 9: Commit**

```powershell
git add src
git commit -m "feat(ui): add top bar, status screens, app shell and styling" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 21: End-to-end tests and vault documentation

**Files:**
- Create: `playwright.config.ts`, `e2e/app.spec.ts`
- Create (vault): `Space_visualizer/Architecture/Overview.md`, `Space_visualizer/Architecture/core.md`, `Space_visualizer/Architecture/state.md`, `Space_visualizer/Architecture/scene.md`, `Space_visualizer/Architecture/camera.md`, `Space_visualizer/Architecture/ui.md`, `Space_visualizer/Architecture/pipeline.md`, `Space_visualizer/Decisions/0002-react-three-fiber.md`, `Space_visualizer/Decisions/0003-floating-origin-and-log-depth.md`, `Space_visualizer/Decisions/0004-measured-accuracy.md`
- Modify (vault): `Space_visualizer/Home.md`, `Space_visualizer/Changelog.md`, `Space_visualizer/Plans/2026-10-04-m1-foundation.md` (status), `Space_visualizer/Welcome.md` (delete only if the user agrees)

**Interfaces:**
- Consumes: the running app (Tasks 1–20).

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Write `e2e/app.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  // Let a few frames render, then confirm nothing threw.
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('shows cited information for a planet', async ({ page }) => {
  await page.screenshot({ path: 'test-results/overview.png' });
  // dispatchEvent: the label may sit under another panel at some dates; we test selection, not hit-testing.
  await page.getByRole('button', { name: 'Jupiter', exact: true }).dispatchEvent('click');
  const panel = page.getByRole('complementary', { name: 'Body information' });
  await expect(panel.getByRole('heading', { name: 'Jupiter' })).toBeVisible();
  await expect(panel.getByRole('link', { name: /Planetary Fact Sheet/ })).toHaveAttribute('href', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/');
  await expect(panel).toContainText('Measured against JPL Horizons');
  await page.screenshot({ path: 'test-results/jupiter-panel.png' });
});

test('switches camera views with the keyboard', async ({ page }) => {
  await page.keyboard.press('2');
  await expect(page.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Orbit' })).toHaveAttribute('aria-pressed', 'true');
});

test('jumps in time and warns about accuracy', async ({ page }) => {
  await page.getByLabel('Go to date (UTC)').fill('1500-01-01');
  await page.getByLabel('Go to date (UTC)').press('Enter');
  await expect(page.getByLabel('Simulation date')).toContainText('1500');
  await expect(page.getByRole('status')).toContainText('Outside 1800–2050');
  await page.getByRole('button', { name: 'Now' }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
});
```

- [ ] **Step 3: Run the end-to-end tests**

Run: `npm run e2e`
Expected: 3 tests PASS. Open `test-results/overview.png` and `test-results/jupiter-panel.png` and confirm the scene is rendered, not a blank canvas.

- [ ] **Step 4: Write the Architecture notes**

Each note starts with front matter `tags: [architecture]` and `Back to [[Home]]`, followed by the content below.

`Architecture/Overview.md`:
```markdown
# Architecture overview

Back to [[Home]] · Spec: [[2026-10-04-solar-system-visualizer-design]]

**Data flow:** official sources → [[pipeline]] → `public/data/*.json` (committed) → `loadCatalog` ([[state]]) → `Catalog` → per-frame body positions ([[core]]) → floating-origin rendering ([[scene]]) viewed through a controller ([[camera]]), with panels in [[ui]].

**Frames and units:** heliocentric ecliptic J2000, km, float64, everywhere in `src/core`. Three.js world axes equal this frame (z = ecliptic north). The Three.js camera is always at (0,0,0); objects are placed at `position − cameraPosition` each frame (see [[0003-floating-origin-and-log-depth]]).

**Time:** `jdTdb` (Julian Date, TDB) in `timeStore`; the UI shows UTC (UT before 1972).

**Frame order (`useFrame` priority):** −2 `FrameDriver` (advance time, compute positions and orientations) → −1 `CameraSystem` (camera pose) → 0 meshes, orbit lines, light.

**Regions:** `regions.json` lists nested regions; only `solar-system` exists in M1. `regionManager` computes fade-in/out by camera distance, ready for the Stellar Neighbourhood.
```

`Architecture/core.md`: list each `src/core` folder (math, time, ephemeris, frames, catalog, regions) with one line each on what it does and its key exports (copy them from this plan's Interfaces blocks), plus the rule "no React, Three.js or Zustand imports".

`Architecture/state.md`: the four stores and `loadCatalog`, one line each, plus "time advances at most `MAX_FRAME_DT_S` of real time per frame; JD is clamped to [0, year 10 000]".

`Architecture/scene.md`: `FrameState` and the frame order; `renderRadiusKm` (readable vs true scale); bodies are IAU-oriented ellipsoids (PCK radii); orbit lines rebuilt per frame relative to the camera; Sun = the only real light (decay 0) plus a 3.5% ambient fill.

`Architecture/camera.md`: the controller interface; Orbit vs Follow behaviour (selection vs double-click/"Centre view"); co-rotation; log-distance transitions (1.6 s, instant with reduced motion); never closer than 1.2 radii.

`Architecture/ui.md`: TopBar (keys 1, 2, Esc), TimeBar (speeds, date input rules, validity messages), InfoPanel (citation numbering, live distances, accuracy lines), status screens.

`Architecture/pipeline.md`: `npm run data` / `data:offline` / `horizons:reference`; fetch → cache (`pipeline/raw`, git-ignored) → parse → build → validate → write; validation failures leave `public/data` untouched; links to every note in `Data Sources/`.

- [ ] **Step 5: Write the Decision records**

Template for each (`tags: [decision]`):
```markdown
# <number> <title>

Back to [[Home]] · Date: 2026-10-04 · Status: accepted

## Context
## Decision
## Consequences
```

- `0002-react-three-fiber.md`: the context is a UI-heavy 3D app that must grow to galaxies; the decision is React Three Fiber with plain Three.js for hot paths; considered and rejected plain Three.js (hand-written UI↔scene glue), CesiumJS (Earth-centric) and Babylon.js (smaller ecosystem for this work).
- `0003-floating-origin-and-log-depth.md`: float32 GPUs lose precision at AU distances; the decision is float64 positions in `core`, camera fixed at the origin, and `logarithmicDepthBuffer`; consequences: no jitter from moon to galaxy scales, and objects must be repositioned every frame.
- `0004-measured-accuracy.md`: while planning M1, Horizons showed JPL's published 1800–2050 Neptune nominal error is exceeded (up to ~4.5× in direction, ~7× in distance); the decision is that the pipeline measures every table against committed Horizons reference vectors and the app shows the measured figure next to the nominal one; tests allow 3× nominal (10× for Neptune/Table 1).

- [ ] **Step 6: Update Home, Changelog and plan status**

In `Space_visualizer/Home.md`, under **Plans**, add `- [[2026-10-04-m1-foundation|M1 Foundation]] — complete`; under **Architecture**, list the seven notes; under **Decisions**, list the decision notes (include `0001-stack-versions` only if Task 1 created it).

Append to `Space_visualizer/Changelog.md`:
```markdown
## <date M1 finished>
- M1 Foundation complete: Sun and eight planets at real positions for any date (JPL approximate elements, measured against Horizons), IAU-oriented bodies, orbit and follow views, time controls, info panel with per-value citations.
- Data pipeline: JPL, NSSDCA, NAIF and NASA Science sources with validation; see [[pipeline]].
- Known limits: Earth drawn at the Earth–Moon barycentre; illustrative colours (official textures arrive in M3).
```

In this plan's front matter, set `status: complete`.

Ask the user whether to delete Obsidian's default `Welcome.md`; delete it only if they agree.

- [ ] **Step 7: Final verification**

Run: `npm test`, `npm run typecheck`, `npm run build`, `npm run e2e`
Expected: everything passes. Report the counts.

- [ ] **Step 8: Commit**

```powershell
git add playwright.config.ts e2e Space_visualizer
git commit -m "test: add end-to-end tests; docs: document M1 architecture and decisions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Out of scope for M1 (later milestones per the spec)

Moons, dwarf planets, Saturn's rings, top-down / from-body / fly views, layers, search, star field (M2); curated small bodies, filters, URL state, official textures (M3); bulk populations (M4); spacecraft (M5); deployment and true-scale polish (M6).
