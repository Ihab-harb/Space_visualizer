---
title: M2a.2 Cinematic Effects and Adaptive Quality — Implementation Plan
date: 2026-10-05
status: awaiting review
milestone: M2a.2
tags: [plan, m2a]
---

# M2a.2 Cinematic Effects and Adaptive Quality Implementation Plan

Back to [[Home]] · Spec: [[2026-10-04-m2-cinematic-and-rich-bodies-design]] (§5, §7) · Follows [[2026-10-04-m2a1-imagery-and-shading]] · Inputs: [[2026-10-05-m2a1-carry-over]]

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn M2a.1's raw HDR render into a cinematic, adaptive one. Add the effects stack: bloom, god rays and lens flare, depth of field, filmic tone mapping with exposure, chromatic aberration, vignette, grain and anamorphic streaks. Add a Camera-effects toggle and four quality settings (Auto, High, Medium, Low) driven by measured frame time. The texture-loading fixes that M2a.1 carried over land first.

**Architecture:**
- A new `src/render/` module holds the pure quality model (presets, Auto controller, active-pass list, exposure maths) and the React pieces that apply it: `QualityGovernor` inside the canvas, `EffectsStack` (the composer) and `RenderStateAttributes` on the DOM.
- A new `renderStore` (Zustand) holds the quality mode, effective level and the effects switch. Every consumer reads presets from it, so one source decides the sphere segments, texture tier, atmosphere samples and effect passes.
- Sun occlusion for the flare and the exposure is computed in float64 in `src/core`, never by raycasting the scene.

**Tech Stack:** The M2a.1 stack. Effects come from `@react-three/postprocessing` 3.1.3 on `postprocessing` 6.39.5, plus two small custom `Effect` classes (exposure, anamorphic streaks). A tiny Vite plugin lists which HD texture tiers exist in the build.

**Spec:** `Space_visualizer/Specs/2026-10-04-m2-cinematic-and-rich-bodies-design.md`. This plan covers §5 (except Tour), the §7 tests that apply to it, and the "must do at the start of M2a.2" items of `Space_visualizer/Plans/2026-10-05-m2a1-carry-over.md`. The spec §4 interface redesign, Tour mode and the Venus radar toggle are plan **M2a.3**.

## Scope rulings (decided while planning; executors must not undo them)

| Spec says | This plan does | Why |
|---|---|---|
| M2a interface redesign (§4) and Tour (§5) | Moved to section M2a.3. Here, Quality and Camera effects get plain controls in the M1 top bar, plus the Q and E keys | Each section gets its own PR. Effects and quality are independent of the redesign and testable without it |
| Filmic tone mapping "with auto-exposure" | Scene-driven exposure: a damped exposure and sky dimming computed from how much of the Sun is visible and where it sits in the frame. No luminance metering | Space frames are mostly black, so metering would over-expose planets and flicker as the Sun enters or leaves. Scene-driven exposure is deterministic and unit-testable |
| Camera effects off "disables 2–5" (including tone mapping) | Effects off keeps a **Neutral** tone mapper (Khronos PBR Neutral) and drops exposure, god rays, flare, depth of field, chromatic aberration, vignette, grain and streaks. Bloom stays, at reduced strength | With no tone mapper, HDR values clip to white. Neutral is the closest thing to "no filmic look" that still displays correctly |
| Lens flare "occluded by bodies" | Our own occlusion: `sunVisibilityFromObserver` (float64, Readable-mode render radii) drives the flare's opacity. The `<LensFlare>` component's built-in raycast is not used | That component counts any hit, including the Sun itself, as visible, and raycasts every frame |
| God rays from the Sun | Rays come from a proxy sphere kept outside the scene graph (positioned each frame). The Sun's ShaderMaterial mesh is not used | `GodRaysEffect` re-parents and re-renders its light source. A proxy avoids touching the real Sun mesh |
| Anamorphic streaks listed with the step-5 effects | Streaks run **before** exposure and tone mapping | Extracting the "brightest highlights" needs HDR values |
| Medium pixel ratio 1.25 | `min(devicePixelRatio, 1.25)` | Never render above the device's native ratio |
| ACES or AgX "chosen visually in the plan" | AgX by default. Task 9 compares ACES and AgX on the golden views and records the choice in Decision 0007 | The choice needs the finished stack on screen |
| Texture tier max "8k / 4k" at High | High asks for 8k. Only tiers that exist in the build are requested, and a build-time list says which HD files are present | Carry-over item: git-ignored HD tiers must never be requested where they are absent |

## Global Constraints

- All M1 and M2a.1 global constraints still hold:
  - every value cited; the imagery rule (spec §2);
  - Windows PowerShell;
  - GLSL strings ASCII-only;
  - every custom `ShaderMaterial` includes three's log-depth chunks;
  - every `ShaderMaterial` or geometry created with `useMemo` is disposed on change or unmount;
  - NaN-safe GLSL;
  - every commit message ends with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Quality presets, verbatim from spec §5:

  | Setting | High | Medium | Low |
  |---|---|---|---|
  | Pixel ratio | min(devicePixelRatio, 2) | 1.25 | 1 |
  | Sphere segments | 192 | 96 | 48 |
  | Texture tier (max) | 8k / 4k | 2k | 1k |
  | Atmosphere samples | 16 | 8 | 4 |
  | Bloom levels | 8 | 5 | 3 |
  | Depth of field / grain / chromatic aberration / streaks | on | on (lighter) | off |
  | Sun rays | on | on | off |

- Auto mode, verbatim from spec §5: "after a 3 s warm-up, it measures the median frame time over a 2 s window. It steps down when that exceeds 18 ms, and steps up after 10 s under 12 ms, with a 5 s cooldown after any change." Phones (coarse pointer and narrow viewport) start at Low.
- Effects order, from spec §5 with this plan's rulings:
  1. bloom;
  2. god rays and lens flare;
  3. anamorphic streaks;
  4. depth of field;
  5. exposure;
  6. tone mapping;
  7. chromatic aberration;
  8. vignette;
  9. grain.

  The Camera-effects toggle disables everything except bloom (at reduced strength) and Neutral tone mapping, and it disables the cinematic fill. **Effects never alter data.**
- `useFrame` priorities, extending M1/M2a.1. `EffectComposer` renders at `renderPriority` 1, after all of these.

  | Priority | Component |
  |---|---|
  | −2 | FrameDriver |
  | −1 | CameraSystem |
  | −0.5 | BodyMesh |
  | −0.4 | body uniforms |
  | −0.3 | Sun effects (proxy, flare, exposure) |
  | 0 | QualityGovernor and others |

- Golden views force `quality=high&fx=1` so the look checklist sees every effect. Everyday e2e tests run at `quality=low`, because SwiftShader is slow.
- Data attributes on `.scene` let e2e tests see render state: `data-quality` (effective level), `data-quality-mode` (`auto|high|medium|low`), `data-fx` (comma-separated active passes, in order) and the existing `data-textures-ready`.

## Review Focus

1. **Toggling Quality and Camera effects repeatedly at runtime** must not throw, leak GPU memory or leave stale passes. Pinned by a Task 8 e2e test: it cycles Q and E eight times, then checks that the WebGL texture and geometry counts (dev-only `window.__svRenderInfo`) return within a small margin of the baseline, and that no page or shader errors occur.
2. **Frame-time spikes** must not make Auto step down or oscillate. Spikes come from a tab switch (a delta of seconds), a texture upload hitch, or a value sitting between thresholds. Pinned by Task 3 unit tests: deltas over 250 ms are ignored, the median rejects single spikes, and a steady 15 ms never changes level.
3. **The Sun behind a planet or off-screen** must drop the flare, god rays and exposure dip; a Sun partly hidden by a limb must dim them proportionally. Pinned by Task 6 unit tests on `sunVisibilityFromObserver` (occluded, partial, occluder behind the Sun, no occluders) and on `sceneExposure` (off-screen gives no dip).
4. **Depth of field must not black out the frame or wipe out the star field.** The logarithmic depth buffer and a sky sphere that writes no depth risk both. Pinned by a Task 7 e2e test at `quality=high` with Earth selected: the existing night/day pixel guard still passes, and a sky patch still contains bright star pixels.
5. **A fresh clone or static host has no HD tiers.** Asking for High must never request a missing `_4k`/`_8k` file, so there are no 404s in the console. Pinned by Task 1 unit tests (`availableRef`) and a Task 4 e2e test that loads `?quality=high` and asserts that no response has status 404.

## File Structure

```
pipeline/vite/localTiers.ts            Vite plugin: virtual module listing HD texture files present in public/textures
src/types/local-tiers.d.ts             typing for 'virtual:local-tiers'
src/scene/textures/availableTiers.ts   drop HD tiers absent from the build
src/scene/textures/useTieredTexture.ts (modified) keep old texture across tier changes; per-texture ref counts; TextureCacheContext
src/render/quality.ts                  pure: presets, levels, modes, pixel ratio, initial level, active passes
src/render/autoQuality.ts              pure: Auto controller (warm-up, median window, thresholds, hold, cooldown)
src/render/exposure.ts                 pure: scene-driven exposure + sky dim, damping
src/render/dof.ts                      pure: depth-of-field focus range and bokeh per preset
src/render/useMaxTier.ts               hook: texture tier override ?? preset max tier
src/render/QualityGovernor.tsx         in-canvas: feeds frame times to Auto, applies pixel ratio
src/render/RenderStateAttributes.tsx   DOM: data-quality / data-quality-mode / data-fx on .scene
src/render/EffectsStack.tsx            the EffectComposer: passes per preset and toggle
src/render/sunFx.ts                    hook useSunFx: god-ray proxy, flare position/opacity, exposure targets (priority -0.3)
src/render/effects/ExposureEffect.ts   custom Effect: multiply by exposure
src/render/effects/AnamorphicStreakEffect.ts  custom Effect: horizontal HDR highlight streaks
src/state/renderStore.ts               quality mode, level, effects switch
src/core/shadows/eclipse.ts            (modified) + sunVisibilityFromObserver
e2e/quality.spec.ts                    forced presets, fx off passes, no HD 404s, toggle stress
e2e-perf/perf.spec.ts + playwright.perf.config.ts   frame-time probe on the real GPU (npm run perf)
```

---

### Task 1: Texture runtime hardening (keep textures across tier changes, exact ref counts, HD availability)

**Files:**
- Create: `pipeline/vite/localTiers.ts`, `pipeline/vite/localTiers.test.ts`, `src/types/local-tiers.d.ts`, `src/scene/textures/availableTiers.ts`, `src/scene/textures/availableTiers.test.ts`, `src/scene/textures/useTieredTexture.hook.test.tsx`
- Modify: `vite.config.ts` (register the plugin), `src/scene/textures/useTieredTexture.ts`

**Interfaces:**
- Consumes: `TextureCache`, `loadBestTier`, `tierChain`, `TextureLoaderLike` (M2a.1, `useTieredTexture.ts`); `TIERS`, `TextureRef`, `Tier` (schema).
- Produces:
  - `listLocalHdFiles(texturesDir: string): string[]` (paths like `textures/earth/color_4k.webp`, sorted);
  - `localTiersPlugin(): Plugin`;
  - virtual module `virtual:local-tiers` exporting `LOCAL_HD_FILES: readonly string[]`;
  - `availableRef(ref: TextureRef, localHd?: ReadonlySet<string>): TextureRef`, which keeps 1k/2k always and keeps 4k/8k only if listed;
  - `TextureCacheContext: React.Context<TextureCache | null>` (null means use the shared cache).
- Behaviour changes in `useTieredTexture`:
  - a change of `maxTier`, `srgb` or `mipmaps` keeps the current texture on screen until its replacement is committed (no blank frame);
  - `ref` becoming `undefined` clears it;
  - the hook counts references per texture, so a consumer that acquires the same cached texture twice releases it twice;
  - HD tiers are filtered through `availableRef` inside the load effect.

- [ ] **Step 1: Write the failing tests**

`pipeline/vite/localTiers.test.ts`:
```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listLocalHdFiles } from './localTiers';

describe('listLocalHdFiles', () => {
  it('lists only 4k/8k WebP files, as site-relative paths', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tiers-'));
    mkdirSync(path.join(root, 'earth'));
    mkdirSync(path.join(root, 'sky'));
    for (const f of ['earth/color_1k.webp', 'earth/color_4k.webp', 'earth/night_8k.webp', 'sky/color_4k.webp', 'imagery.json']) writeFileSync(path.join(root, f), '');
    expect(listLocalHdFiles(root)).toEqual(['textures/earth/color_4k.webp', 'textures/earth/night_8k.webp', 'textures/sky/color_4k.webp']);
  });
  it('returns an empty list when the folder does not exist', () => {
    expect(listLocalHdFiles(path.join(tmpdir(), 'does-not-exist-tiers'))).toEqual([]);
  });
});
```

`src/scene/textures/availableTiers.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { TextureRef } from '../../core/catalog/schema';
import { availableRef } from './availableTiers';

const ref: TextureRef = {
  tiers: { '1k': 'textures/earth/color_1k.webp', '2k': 'textures/earth/color_2k.webp', '4k': 'textures/earth/color_4k.webp', '8k': 'textures/earth/color_8k.webp' },
  sourceId: 'x',
};

describe('availableRef', () => {
  it('keeps committed tiers and drops HD tiers that are not in the build', () => {
    expect(Object.keys(availableRef(ref, new Set()).tiers)).toEqual(['1k', '2k']);
    expect(Object.keys(availableRef(ref, new Set(['textures/earth/color_4k.webp'])).tiers)).toEqual(['1k', '2k', '4k']);
  });
  it('keeps the rest of the reference unchanged', () => {
    expect(availableRef(ref, new Set()).sourceId).toBe('x');
  });
});
```

`src/scene/textures/useTieredTexture.hook.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { TextureRef } from '../../core/catalog/schema';
import { TextureCache, TextureCacheContext, useTieredTexture, type TextureLoaderLike } from './useTieredTexture';

/** Let pending promise chains (loadBestTier's awaits) settle. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function deferredLoader() {
  const waiting = new Map<string, (t: Texture) => void>();
  let disposed = 0;
  const loader: TextureLoaderLike = {
    loadAsync: (url) =>
      new Promise<Texture>((resolve) => {
        waiting.set(url, (t) => resolve(t));
      }),
  };
  const resolve = async (url: string) => {
    const t = new Texture();
    t.addEventListener('dispose', () => disposed++);
    await act(async () => {
      waiting.get(url)!(t);
      await flush();
    });
    return t;
  };
  return { loader, resolve, disposedCount: () => disposed, pending: () => [...waiting.keys()] };
}

const oneTier: TextureRef = { tiers: { '1k': 'a_1k.webp' }, sourceId: 'x' };
const twoTiers: TextureRef = { tiers: { '1k': 'b_1k.webp', '2k': 'b_2k.webp' }, sourceId: 'x' };

describe('useTieredTexture', () => {
  it('keeps showing the current texture while a new tier loads', async () => {
    const d = deferredLoader();
    const cache = new TextureCache(d.loader);
    const wrapper = ({ children }: { children: React.ReactNode }) => <TextureCacheContext.Provider value={cache}>{children}</TextureCacheContext.Provider>;
    const { result, rerender } = renderHook(({ max }: { max: '1k' | '2k' }) => useTieredTexture(twoTiers, { maxTier: max, srgb: true }), { wrapper, initialProps: { max: '1k' } });
    const first = await d.resolve('/b_1k.webp');
    expect(result.current).toBe(first);
    rerender({ max: '2k' });
    expect(result.current).toBe(first); // not blanked while 2k loads
  });

  it('releases a texture as many times as it acquired it', async () => {
    const d = deferredLoader();
    const cache = new TextureCache(d.loader);
    const wrapper = ({ children }: { children: React.ReactNode }) => <TextureCacheContext.Provider value={cache}>{children}</TextureCacheContext.Provider>;
    const { rerender, unmount } = renderHook(({ max }: { max: '1k' | '2k' }) => useTieredTexture(oneTier, { maxTier: max, srgb: true }), { wrapper, initialProps: { max: '1k' } });
    await d.resolve('/a_1k.webp');
    rerender({ max: '2k' }); // re-acquires the same cached 1k texture
    await act(async () => {
      await flush();
    });
    unmount();
    expect(cache.size).toBe(0);
    expect(d.disposedCount()).toBe(1);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run pipeline/vite src/scene/textures`
Expected: FAIL (modules `./localTiers` and `./availableTiers` missing, `TextureCacheContext` not exported).

- [ ] **Step 3: Create `pipeline/vite/localTiers.ts` and register it**

```ts
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export const LOCAL_TIERS_ID = 'virtual:local-tiers';
const RESOLVED_ID = `\0${LOCAL_TIERS_ID}`;

/** HD texture files (_4k / _8k .webp) present under a textures folder, as site-relative paths. */
export function listLocalHdFiles(texturesDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      const full = path.join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      if (statSync(full).isDirectory()) walk(full, relPath);
      else if (/_(4k|8k)\.webp$/.test(name)) out.push(`textures/${relPath}`);
    }
  };
  walk(texturesDir, '');
  return out.sort();
}

/** Exposes which HD tiers exist in this build, so the app never requests a git-ignored tier that is absent. */
export function localTiersPlugin(): Plugin {
  let texturesDir = '';
  return {
    name: 'local-tiers',
    configResolved(config) {
      texturesDir = path.join(config.publicDir, 'textures');
    },
    resolveId(id) {
      return id === LOCAL_TIERS_ID ? RESOLVED_ID : null;
    },
    load(id) {
      return id === RESOLVED_ID ? `export const LOCAL_HD_FILES = ${JSON.stringify(listLocalHdFiles(texturesDir))};` : null;
    },
  };
}
```

In `vite.config.ts`, add `import { localTiersPlugin } from './pipeline/vite/localTiers';` and set `plugins: [react(), localTiersPlugin()]`.

Create `src/types/local-tiers.d.ts`:
```ts
declare module 'virtual:local-tiers' {
  /** Site-relative paths of HD (_4k/_8k) texture files present when this build started. */
  export const LOCAL_HD_FILES: readonly string[];
}
```

- [ ] **Step 4: Create `src/scene/textures/availableTiers.ts`**

```ts
import { LOCAL_HD_FILES } from 'virtual:local-tiers';
import type { TextureRef, Tier } from '../../core/catalog/schema';

const HD_TIERS: ReadonlySet<Tier> = new Set<Tier>(['4k', '8k']);
const LOCAL_HD: ReadonlySet<string> = new Set(LOCAL_HD_FILES);

/** Committed tiers are always kept; HD tiers only when their file is present in this build. */
export function availableRef(ref: TextureRef, localHd: ReadonlySet<string> = LOCAL_HD): TextureRef {
  const tiers = Object.fromEntries(
    Object.entries(ref.tiers).filter(([tier, file]) => !HD_TIERS.has(tier as Tier) || localHd.has(file!)),
  ) as TextureRef['tiers'];
  return { ...ref, tiers };
}
```

- [ ] **Step 5: Update `useTieredTexture` in `src/scene/textures/useTieredTexture.ts`**

Add the context next to the shared cache:
```ts
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { availableRef } from './availableTiers';

/** Lets tests supply their own cache; null means the shared app-wide cache. */
export const TextureCacheContext = createContext<TextureCache | null>(null);
```

Replace the hook with:
```ts
export function useTieredTexture(ref: TextureRef | undefined, opts: { maxTier: Tier; srgb: boolean; mipmaps?: boolean }): Texture | null {
  const cache = useContext(TextureCacheContext) ?? getSharedCache();
  const [texture, setTexture] = useState<Texture | null>(null);
  /** How many times this consumer acquired each texture from the cache. */
  const owned = useRef(new Map<Texture, number>());

  const releaseAll = (t: Texture) => {
    const n = owned.current.get(t) ?? 0;
    owned.current.delete(t);
    for (let i = 0; i < n; i++) cache.release(t);
  };

  // Release textures only after React has committed their replacement (or null), so nothing on screen is released.
  useEffect(() => {
    for (const t of [...owned.current.keys()]) if (t !== texture) releaseAll(t);
  }, [texture]);
  useEffect(
    () => () => {
      for (const t of [...owned.current.keys()]) releaseAll(t);
    },
    [],
  );

  useEffect(() => {
    if (!ref) {
      setTexture(null);
      return;
    }
    let cancelled = false;
    void loadBestTier(
      availableRef(ref),
      opts.maxTier,
      import.meta.env.BASE_URL,
      cache.loaderFor({ srgb: opts.srgb, mipmaps: opts.mipmaps }),
      (t) => {
        owned.current.set(t, (owned.current.get(t) ?? 0) + 1);
        setTexture(t);
      },
      () => cancelled,
    );
    return () => {
      cancelled = true; // the current texture stays on screen until a replacement arrives
    };
  }, [ref, opts.maxTier, opts.srgb, opts.mipmaps, cache]);
  return texture;
}
```

If the linter or typecheck asks for `releaseAll` in effect dependencies, wrap it in `useCallback` keyed on `cache`. The behaviour is unchanged.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run pipeline/vite src/scene/textures`, then `npm test`, `npm run typecheck`
Expected: all PASS.

The hook test "releases a texture as many times as it acquired it" must fail if the `Map` is replaced by a `Set`. Check it by temporarily reverting the count increment to `owned.current.set(t, 1)`, watching it fail, then restoring.

- [ ] **Step 7: Commit**

```powershell
git add pipeline/vite src/types src/scene/textures vite.config.ts
git commit -m "fix(textures): keep textures across tier changes, count references exactly, request HD tiers only when built" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Quality model, render store, URL parameters and the max texture tier

**Files:**
- Create: `src/render/quality.ts`, `src/render/quality.test.ts`, `src/state/renderStore.ts`, `src/state/renderStore.test.ts`, `src/render/useMaxTier.ts`
- Modify:
  - `src/state/viewStore.ts`: `textureTier` becomes `textureTierOverride: Tier | null`;
  - `src/state/urlParams.ts` and `src/state/urlParams.test.ts`;
  - `src/scene/sky/skyMath.ts` and `src/scene/sky/skyMath.test.ts`: `skyTier`;
  - the material files `CloudShell.tsx`, `EarthMaterial.tsx`, `GiantMaterial.tsx`, `RockyMaterial.tsx` and `src/scene/sky/SkyBackground.tsx`: use `useMaxTier()`.

**Interfaces:**
- Produces (`quality.ts`):
  - `type QualityLevel = 'high' | 'medium' | 'low'`;
  - `type QualityMode = 'auto' | QualityLevel`;
  - `LEVELS_LOW_TO_HIGH: readonly QualityLevel[]` (`['low','medium','high']`);
  - `interface QualityPreset { maxPixelRatio: number; sphereSegments: readonly [number, number]; maxTier: Tier; atmosphereSamples: number; bloomLevels: number; detailFx: 'full' | 'light' | 'off'; sunRays: boolean }`;
  - `PRESETS: Record<QualityLevel, QualityPreset>`;
  - `pixelRatioFor(level, devicePixelRatio): number`;
  - `initialLevel(env: { coarsePointer: boolean; viewportWidth: number }): QualityLevel`;
  - `nextMode(mode): QualityMode` (auto → high → medium → low → auto);
  - `stepDown(level)` and `stepUp(level)`;
  - `parseQualityMode(s: string | null): QualityMode | undefined`.
- Produces (`renderStore.ts`): `useRenderStore` with
  - state `{ mode: QualityMode; level: QualityLevel; effects: boolean }`;
  - actions `setMode(m)` (a fixed level also sets `level`; `auto` keeps the current level), `cycleMode()`, `setLevel(l)` (used by Auto), `setEffects(on)` and `toggleEffects()`.
- Produces (`useMaxTier.ts`): `useMaxTier(): Tier`, which returns `textureTierOverride ?? PRESETS[level].maxTier`.
- Produces (`urlParams`): `UrlOverrides` gains `quality?: QualityMode` and `effects?: boolean`. The parameters are `quality=auto|high|medium|low` and `fx=0|1`; `tier` sets `textureTierOverride`.
- `skyTier(tier)`: 8k → 8k, 1k → 2k, otherwise 4k.

- [ ] **Step 1: Write the failing tests**

`src/render/quality.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { initialLevel, nextMode, parseQualityMode, pixelRatioFor, PRESETS, stepDown, stepUp } from './quality';

describe('quality presets (spec §5)', () => {
  it('match the spec table', () => {
    expect(PRESETS.high).toMatchObject({ maxPixelRatio: 2, sphereSegments: [192, 96], maxTier: '8k', atmosphereSamples: 16, bloomLevels: 8, detailFx: 'full', sunRays: true });
    expect(PRESETS.medium).toMatchObject({ maxPixelRatio: 1.25, sphereSegments: [96, 48], maxTier: '2k', atmosphereSamples: 8, bloomLevels: 5, detailFx: 'light', sunRays: true });
    expect(PRESETS.low).toMatchObject({ maxPixelRatio: 1, sphereSegments: [48, 24], maxTier: '1k', atmosphereSamples: 4, bloomLevels: 3, detailFx: 'off', sunRays: false });
  });
  it('never renders above the device pixel ratio', () => {
    expect(pixelRatioFor('high', 3)).toBe(2);
    expect(pixelRatioFor('high', 1)).toBe(1);
    expect(pixelRatioFor('medium', 2)).toBe(1.25);
    expect(pixelRatioFor('medium', 1)).toBe(1);
    expect(pixelRatioFor('low', 2)).toBe(1);
  });
  it('starts phones at Low and everything else at High', () => {
    expect(initialLevel({ coarsePointer: true, viewportWidth: 390 })).toBe('low');
    expect(initialLevel({ coarsePointer: true, viewportWidth: 1366 })).toBe('high');
    expect(initialLevel({ coarsePointer: false, viewportWidth: 390 })).toBe('high');
  });
  it('cycles modes and steps levels within bounds', () => {
    expect([nextMode('auto'), nextMode('high'), nextMode('medium'), nextMode('low')]).toEqual(['high', 'medium', 'low', 'auto']);
    expect([stepDown('high'), stepDown('medium'), stepDown('low')]).toEqual(['medium', 'low', 'low']);
    expect([stepUp('low'), stepUp('medium'), stepUp('high')]).toEqual(['medium', 'high', 'high']);
  });
  it('parses quality modes from text', () => {
    expect(parseQualityMode('medium')).toBe('medium');
    expect(parseQualityMode('ultra')).toBeUndefined();
    expect(parseQualityMode(null)).toBeUndefined();
  });
});
```

`src/state/renderStore.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useRenderStore } from './renderStore';

describe('renderStore', () => {
  beforeEach(() => useRenderStore.setState({ mode: 'auto', level: 'high', effects: true }));
  it('a fixed mode also fixes the level; auto keeps the current level', () => {
    useRenderStore.getState().setMode('low');
    expect(useRenderStore.getState()).toMatchObject({ mode: 'low', level: 'low' });
    useRenderStore.getState().setMode('auto');
    expect(useRenderStore.getState()).toMatchObject({ mode: 'auto', level: 'low' });
  });
  it('cycles modes and toggles effects', () => {
    useRenderStore.getState().cycleMode();
    expect(useRenderStore.getState()).toMatchObject({ mode: 'high', level: 'high' });
    useRenderStore.getState().toggleEffects();
    expect(useRenderStore.getState().effects).toBe(false);
  });
});
```

Extend `src/state/urlParams.test.ts`:
- In the existing tests, change every `textureTier` to `textureTierOverride`. Also change the store reset in `beforeEach` to `useViewStore.setState({ cameraOverride: null, textureTierOverride: null })`.
- Add:
```ts
  it('reads quality and camera-effects parameters', () => {
    expect(parseUrlOverrides('?quality=low&fx=0')).toEqual({ quality: 'low', effects: false });
    expect(parseUrlOverrides('?quality=ultra&fx=2')).toEqual({});
  });
```
and, in the `applyUrlOverrides` describe:
```ts
  it('applies quality and effects', () => {
    applyUrlOverrides({ quality: 'medium', effects: false }, catalog);
    expect(useRenderStore.getState()).toMatchObject({ mode: 'medium', level: 'medium', effects: false });
  });
```
(Import `useRenderStore`.)

In `src/scene/sky/skyMath.test.ts`, replace the tier test with:
```ts
  it('uses the committed sky tiers unless 8k is asked for', () => {
    expect(skyTier('1k')).toBe('2k');
    expect(skyTier('2k')).toBe('4k');
    expect(skyTier('4k')).toBe('4k');
    expect(skyTier('8k')).toBe('8k');
  });
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/render src/state src/scene/sky`
Expected: FAIL (modules missing; `textureTierOverride` unknown; `skyTier('1k')` returns 4k).

- [ ] **Step 3: Create `src/render/quality.ts`**

```ts
import type { Tier } from '../core/catalog/schema';

export type QualityLevel = 'high' | 'medium' | 'low';
export type QualityMode = 'auto' | QualityLevel;

export const LEVELS_LOW_TO_HIGH: readonly QualityLevel[] = ['low', 'medium', 'high'];

export interface QualityPreset {
  maxPixelRatio: number;
  /** [widthSegments, heightSegments] for body spheres. */
  sphereSegments: readonly [number, number];
  maxTier: Tier;
  atmosphereSamples: number;
  bloomLevels: number;
  /** Depth of field, grain, chromatic aberration and streaks. */
  detailFx: 'full' | 'light' | 'off';
  sunRays: boolean;
}

/** Spec §5 quality table. */
export const PRESETS: Record<QualityLevel, QualityPreset> = {
  high: { maxPixelRatio: 2, sphereSegments: [192, 96], maxTier: '8k', atmosphereSamples: 16, bloomLevels: 8, detailFx: 'full', sunRays: true },
  medium: { maxPixelRatio: 1.25, sphereSegments: [96, 48], maxTier: '2k', atmosphereSamples: 8, bloomLevels: 5, detailFx: 'light', sunRays: true },
  low: { maxPixelRatio: 1, sphereSegments: [48, 24], maxTier: '1k', atmosphereSamples: 4, bloomLevels: 3, detailFx: 'off', sunRays: false },
};

export function pixelRatioFor(level: QualityLevel, devicePixelRatio: number): number {
  return Math.min(devicePixelRatio, PRESETS[level].maxPixelRatio);
}

/** Phones (coarse pointer and a narrow viewport) start at Low. */
export function initialLevel(env: { coarsePointer: boolean; viewportWidth: number }): QualityLevel {
  return env.coarsePointer && env.viewportWidth < 900 ? 'low' : 'high';
}

const MODE_CYCLE: readonly QualityMode[] = ['auto', 'high', 'medium', 'low'];
export function nextMode(mode: QualityMode): QualityMode {
  return MODE_CYCLE[(MODE_CYCLE.indexOf(mode) + 1) % MODE_CYCLE.length]!;
}

export function stepDown(level: QualityLevel): QualityLevel {
  return LEVELS_LOW_TO_HIGH[Math.max(0, LEVELS_LOW_TO_HIGH.indexOf(level) - 1)]!;
}
export function stepUp(level: QualityLevel): QualityLevel {
  return LEVELS_LOW_TO_HIGH[Math.min(LEVELS_LOW_TO_HIGH.length - 1, LEVELS_LOW_TO_HIGH.indexOf(level) + 1)]!;
}

export function parseQualityMode(s: string | null): QualityMode | undefined {
  return s !== null && (MODE_CYCLE as readonly string[]).includes(s) ? (s as QualityMode) : undefined;
}
```

- [ ] **Step 4: Create `src/state/renderStore.ts` and `src/render/useMaxTier.ts`**

```ts
import { create } from 'zustand';
import { initialLevel, nextMode, type QualityLevel, type QualityMode } from '../render/quality';

const environment = () =>
  typeof window === 'undefined'
    ? { coarsePointer: false, viewportWidth: 1920 }
    : { coarsePointer: window.matchMedia?.('(pointer: coarse)').matches === true, viewportWidth: window.innerWidth };

interface RenderState {
  mode: QualityMode;
  /** Effective level: the fixed mode's level, or Auto's current choice. */
  level: QualityLevel;
  /** Camera effects (spec §5 toggle). */
  effects: boolean;
  setMode(mode: QualityMode): void;
  cycleMode(): void;
  setLevel(level: QualityLevel): void;
  setEffects(on: boolean): void;
  toggleEffects(): void;
}

export const useRenderStore = create<RenderState>()((set, get) => ({
  mode: 'auto',
  level: initialLevel(environment()),
  effects: true,
  setMode: (mode) => set(mode === 'auto' ? { mode } : { mode, level: mode }),
  cycleMode: () => get().setMode(nextMode(get().mode)),
  setLevel: (level) => set({ level }),
  setEffects: (effects) => set({ effects }),
  toggleEffects: () => set((s) => ({ effects: !s.effects })),
}));
```

```ts
import type { Tier } from '../core/catalog/schema';
import { useRenderStore } from '../state/renderStore';
import { useViewStore } from '../state/viewStore';
import { PRESETS } from './quality';

/** The texture tier to aim for: an explicit ?tier= override, otherwise the quality preset's maximum. */
export function useMaxTier(): Tier {
  const override = useViewStore((s) => s.textureTierOverride);
  const level = useRenderStore((s) => s.level);
  return override ?? PRESETS[level].maxTier;
}
```

- [ ] **Step 5: Update `viewStore`, `urlParams`, `skyTier` and the material call sites**

In `src/state/viewStore.ts`:
- replace `textureTier: Tier;` with `textureTierOverride: Tier | null;` and `setTextureTier(tier: Tier): void;` with `setTextureTierOverride(tier: Tier | null): void;`;
- in the store, use `textureTierOverride: null,` and `setTextureTierOverride: (textureTierOverride) => set({ textureTierOverride }),`.

In `src/state/urlParams.ts`:
- add `quality?: QualityMode; effects?: boolean;` to `UrlOverrides`;
- in `parseUrlOverrides`, add:
```ts
  const quality = parseQualityMode(p.get('quality'));
  if (quality) o.quality = quality;
  const fx = p.get('fx');
  if (fx === '0' || fx === '1') o.effects = fx === '1';
```
- in `applyUrlOverrides`, replace the tier line with `if (o.tier) useViewStore.getState().setTextureTierOverride(o.tier);` and add:
```ts
  if (o.quality) useRenderStore.getState().setMode(o.quality);
  if (o.effects !== undefined) useRenderStore.getState().setEffects(o.effects);
```

In `src/scene/sky/skyMath.ts`:
```ts
export function skyTier(textureTier: Tier): Tier {
  if (textureTier === '8k') return '8k';
  return textureTier === '1k' ? '2k' : '4k';
}
```

In `CloudShell.tsx`, `EarthMaterial.tsx`, `GiantMaterial.tsx`, `RockyMaterial.tsx` and `SkyBackground.tsx`:
- replace `const tier = useViewStore((s) => s.textureTier);` with `const tier = useMaxTier();` (import from `../../render/useMaxTier`);
- remove the `useViewStore` import where it becomes unused.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/render src/state src/scene`, then `npm test`, `npm run typecheck`, `npx playwright test e2e/app.spec.ts --reporter=line`
Expected: all PASS.

- [ ] **Step 7: Commit**

```powershell
git add src
git commit -m "feat(render): add quality presets, render store and quality/fx URL parameters; drive texture tiers from quality" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Auto quality controller, governor and pixel ratio

**Files:**
- Create: `src/render/autoQuality.ts`, `src/render/autoQuality.test.ts`, `src/render/QualityGovernor.tsx`, `src/render/RenderStateAttributes.tsx`
- Modify: `src/scene/SceneRoot.tsx` (mount `QualityGovernor` inside the Canvas and `RenderStateAttributes` next to `TextureReadiness`)

**Interfaces:**
- Consumes: `QualityLevel`, `stepDown`, `stepUp`, `pixelRatioFor` (Task 2); `useRenderStore` (Task 2).
- Produces (`autoQuality.ts`):
  - `AUTO_QUALITY = { warmupMs: 3000, windowMs: 2000, downAboveMs: 18, upBelowMs: 12, upHoldMs: 10000, cooldownMs: 5000, ignoreAboveMs: 250 }`;
  - `median(values: readonly number[]): number`;
  - `createAutoQuality(start: QualityLevel, config?)`, which returns `{ readonly level: QualityLevel; sample(frameMs: number, nowMs: number): QualityLevel | null }`. `sample` returns the new level when it changes, otherwise null.
- Produces: `QualityGovernor()`, an in-canvas component. It feeds frame times to the controller while in Auto and applies the pixel ratio for the current level with `setDpr`. Also `RenderStateAttributes({ target })`, which writes `data-quality` and `data-quality-mode` (Task 5 adds `data-fx`).
- Behaviour:
  - Samples arrive once per frame.
  - Frames longer than `ignoreAboveMs` (a tab switch or debugger) are dropped.
  - No decision is made during warm-up, during cooldown, or until the window is full.
  - Stepping down needs median > 18 ms. Stepping up needs median < 12 ms held continuously for 10 s.
  - Any change clears the window and starts the cooldown.

- [ ] **Step 1: Write the failing test `src/render/autoQuality.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { createAutoQuality, median } from './autoQuality';

/** Feed a constant frame time from t0 for durationMs; return the levels it changed to. */
function run(ctrl: ReturnType<typeof createAutoQuality>, frameMs: number, t0: number, durationMs: number): { changes: string[]; end: number } {
  const changes: string[] = [];
  let t = t0;
  while (t < t0 + durationMs) {
    t += frameMs;
    const next = ctrl.sample(frameMs, t);
    if (next) changes.push(next);
  }
  return { changes, end: t };
}

describe('median', () => {
  it('handles odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('Auto quality (spec §5)', () => {
  it('ignores everything during the 3 s warm-up', () => {
    const c = createAutoQuality('high');
    expect(run(c, 40, 0, 2900).changes).toEqual([]);
  });
  it('steps down once the 2 s median exceeds 18 ms, then waits out the cooldown', () => {
    const c = createAutoQuality('high');
    const a = run(c, 25, 0, 5200); // first decision at ~3.0 s (warm-up over, window full)
    expect(a.changes).toEqual(['medium']);
    // Still slow, but inside the 5 s cooldown that started at ~3.0 s.
    const b = run(c, 25, a.end, 2700); // until ~7.9 s
    expect(b.changes).toEqual([]);
    const d = run(c, 25, b.end, 1000); // cooldown ends at ~8.0 s; the window refilled during it
    expect(d.changes).toEqual(['low']);
    expect(run(c, 25, d.end, 20000).changes).toEqual([]); // never below Low
  });
  it('steps up only after 10 s continuously under 12 ms', () => {
    const c = createAutoQuality('low');
    // Decisions start at ~3.0 s (warm-up); the 10 s "fast" hold therefore completes at ~13.0 s.
    const a = run(c, 8, 0, 12900);
    expect(a.changes).toEqual([]);
    const b = run(c, 8, a.end, 500);
    expect(b.changes).toEqual(['medium']);
  });
  it('holds steady between the thresholds (no oscillation)', () => {
    const c = createAutoQuality('medium');
    expect(run(c, 15, 0, 60000).changes).toEqual([]);
  });
  it('rejects single spikes and ignores tab-switch gaps', () => {
    const c = createAutoQuality('high');
    let t = 0;
    const changes: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const ms = i % 50 === 0 ? 120 : 10; // one 120 ms hitch every 50 frames
      t += ms;
      const next = c.sample(ms, t);
      if (next) changes.push(next);
    }
    const afterGap = c.sample(5000, t + 5000); // tab was hidden for 5 s
    expect(changes).toEqual([]);
    expect(afterGap).toBeNull();
    expect(c.level).toBe('high');
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/render/autoQuality.test.ts`
Expected: FAIL, cannot resolve `./autoQuality`.

- [ ] **Step 3: Create `src/render/autoQuality.ts`**

```ts
import { stepDown, stepUp, type QualityLevel } from './quality';

/** Spec §5 Auto mode. */
export const AUTO_QUALITY = {
  warmupMs: 3000,
  windowMs: 2000,
  downAboveMs: 18,
  upBelowMs: 12,
  upHoldMs: 10000,
  cooldownMs: 5000,
  /** Frames longer than this (tab switch, debugger pause) are not performance evidence. */
  ignoreAboveMs: 250,
} as const;

export function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function createAutoQuality(start: QualityLevel, config: typeof AUTO_QUALITY = AUTO_QUALITY) {
  let level = start;
  let startedAt: number | null = null;
  let lastChangeAt = Number.NEGATIVE_INFINITY;
  let fastSince: number | null = null;
  let window: Array<{ t: number; ms: number }> = [];

  const change = (next: QualityLevel, now: number): QualityLevel | null => {
    if (next === level) return null;
    level = next;
    lastChangeAt = now;
    window = [];
    fastSince = null;
    return level;
  };

  return {
    get level() {
      return level;
    },
    sample(frameMs: number, nowMs: number): QualityLevel | null {
      if (startedAt === null) startedAt = nowMs;
      if (!(frameMs > 0) || frameMs > config.ignoreAboveMs) return null;
      window.push({ t: nowMs, ms: frameMs });
      while (window.length > 0 && window[0]!.t < nowMs - config.windowMs) window.shift();
      if (nowMs - startedAt < config.warmupMs) return null;
      if (nowMs - lastChangeAt < config.cooldownMs) return null;
      const covered = window.length > 1 ? nowMs - window[0]!.t : 0;
      if (covered < config.windowMs * 0.9) return null;
      const m = median(window.map((s) => s.ms));
      if (m > config.downAboveMs) return change(stepDown(level), nowMs);
      if (m < config.upBelowMs) {
        fastSince ??= nowMs;
        if (nowMs - fastSince >= config.upHoldMs) return change(stepUp(level), nowMs);
      } else {
        fastSince = null;
      }
      return null;
    },
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/render/autoQuality.test.ts`
Expected: 6 PASS. If a timing expectation is off by a frame, adjust the controller rather than the test, unless the test arithmetic is wrong (check the window coverage rule). Record any change in the report.

- [ ] **Step 5: Create `src/render/QualityGovernor.tsx` and `src/render/RenderStateAttributes.tsx`**

```tsx
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useRenderStore } from '../state/renderStore';
import { createAutoQuality } from './autoQuality';
import { pixelRatioFor } from './quality';

/** Applies the pixel ratio for the current level and, in Auto mode, adjusts the level from measured frame times. */
export function QualityGovernor() {
  const setDpr = useThree((s) => s.setDpr);
  const level = useRenderStore((s) => s.level);
  const mode = useRenderStore((s) => s.mode);
  const controller = useRef(createAutoQuality(level));

  useEffect(() => {
    setDpr(pixelRatioFor(level, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
  }, [level, setDpr]);
  useEffect(() => {
    if (mode === 'auto') controller.current = createAutoQuality(useRenderStore.getState().level);
  }, [mode]);

  useFrame((_, delta) => {
    if (useRenderStore.getState().mode !== 'auto') return;
    const next = controller.current.sample(delta * 1000, performance.now());
    if (next) useRenderStore.getState().setLevel(next);
  });
  return null;
}
```

```tsx
import { useEffect } from 'react';
import { useRenderStore } from '../state/renderStore';

/** Exposes render state on the scene element for tests and debugging. */
export function RenderStateAttributes({ target }: { target: React.RefObject<HTMLDivElement | null> }) {
  const level = useRenderStore((s) => s.level);
  const mode = useRenderStore((s) => s.mode);
  useEffect(() => {
    target.current?.setAttribute('data-quality', level);
    target.current?.setAttribute('data-quality-mode', mode);
  }, [level, mode, target]);
  return null;
}
```

In `SceneRoot.tsx`, render `<QualityGovernor />` inside `<FrameStateProvider>` (after `<CameraSystem>`), and `<RenderStateAttributes target={sceneRef} />` next to `<TextureReadiness …/>`.

- [ ] **Step 6: Type-check, test, commit**

Run: `npm test`, `npm run typecheck`, `npx playwright test e2e/app.spec.ts --reporter=line`
Expected: all PASS.

```powershell
git add src
git commit -m "feat(render): add the Auto quality controller with warm-up, median window, hysteresis and cooldown" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Apply presets to the scene, and forced-preset e2e tests

**Files:**
- Create: `e2e/quality.spec.ts`
- Modify:
  - `src/scene/BodyMesh.tsx`, `src/scene/materials/CloudShell.tsx`: sphere segments from the preset;
  - `src/scene/materials/AtmosphereShell.tsx`: samples from the preset;
  - `e2e/app.spec.ts`: run at `quality=low`;
  - `e2e/golden.spec.ts`: all URLs force `quality=high&fx=1`.

**Interfaces:**
- Consumes: `PRESETS`, `useRenderStore` (Task 2); `availableRef` behaviour (Task 1).
- Produces (behaviour): body and cloud spheres use `PRESETS[level].sphereSegments`, and the old geometry is disposed when it changes. The atmosphere `uSamples` uniform follows `PRESETS[level].atmosphereSamples` (the GLSL loop already supports up to 16).
- Produces (tests), in `e2e/quality.spec.ts`:
  - one test per forced preset;
  - a test that no HD tier request is answered with HTML or an error status;
  - page and shader error gates.

- [ ] **Step 1: Write the failing e2e test `e2e/quality.spec.ts`**

The Vite dev server answers a missing file with `index.html` (status 200), so the HD check looks at the content type, not just the status.
```ts
import { expect, test } from '@playwright/test';

let pageErrors: string[] = [];
let shaderErrors: string[] = [];
let badHdResponses: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  shaderErrors = [];
  badHdResponses = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Shader Error|THREE\.WebGLProgram/.test(msg.text())) shaderErrors.push(msg.text().slice(0, 500));
  });
  page.on('response', (r) => {
    if (!/_(4k|8k)\.webp(\?|$)/.test(r.url())) return;
    const type = r.headers()['content-type'] ?? '';
    if (!r.ok() || !type.startsWith('image/')) badHdResponses.push(`${r.status()} ${type} ${r.url()}`);
  });
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
  expect(shaderErrors).toEqual([]);
  expect(badHdResponses).toEqual([]);
});

for (const q of ['high', 'medium', 'low'] as const) {
  test(`quality ${q} can be forced`, async ({ page }) => {
    await page.goto(`/?pause=1&quality=${q}`);
    await expect(page.locator(`.scene[data-quality="${q}"][data-quality-mode="${q}"]`)).toBeAttached();
    await page.waitForTimeout(1500);
  });
}

test('High only requests HD tiers that exist in the build', async ({ page }) => {
  await page.goto('/?pause=1&quality=high&target=earth&dist=36000&azSun=90&el=12');
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 });
  await page.waitForTimeout(1000);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx playwright test e2e/quality.spec.ts --reporter=line`
Expected: the three preset tests PASS (Task 3 already sets the attributes). The HD test may already pass because of Task 1; if so, note it in the report.

Before Task 1, this test failed: Earth's `color_4k.webp` was requested and the dev server answered with `text/html`. To confirm the test discriminates, temporarily bypass `availableRef` in `useTieredTexture` (pass `ref` directly), re-run, watch it fail, then restore.

- [ ] **Step 3: Apply the presets**

`src/scene/BodyMesh.tsx`:
```tsx
  const [widthSegments, heightSegments] = useRenderStore((s) => PRESETS[s.level].sphereSegments);
  const geometry = useMemo(() => {
    const g = new SphereGeometry(1, widthSegments, heightSegments);
    g.rotateX(Math.PI / 2); // Three's sphere poles are on +Y; body-fixed poles are on +Z
    return g;
  }, [widthSegments, heightSegments]);
  useEffect(() => () => geometry.dispose(), [geometry]);
```
(Import `useEffect`, `useRenderStore` and `PRESETS`.) Make the same change in `CloudShell.tsx` in place of its fixed `SphereGeometry(1, 128, 64)`. Keep its existing dispose effect keyed on `geometry`.

`src/scene/materials/AtmosphereShell.tsx`, after the material `useMemo`:
```tsx
  const samples = useRenderStore((s) => PRESETS[s.level].atmosphereSamples);
  useEffect(() => {
    material.uniforms.uSamples!.value = samples;
  }, [material, samples]);
```

- [ ] **Step 4: Run e2e at Low by default, and goldens at High**

In `e2e/app.spec.ts`, change `page.goto('/')` to `page.goto('/?quality=low')` and `page.goto('/?target=earth&pause=1')` to `page.goto('/?target=earth&pause=1&quality=low')`.

In `e2e/golden.spec.ts`, append `&quality=high&fx=1` to every view URL. That includes the phone view, the overview (`/?jd=2461317.5&pause=1&quality=high&fx=1`) and the Earth guard URL.

- [ ] **Step 5: Run everything**

Run: `npm test`, `npm run typecheck`, `npx playwright test --reporter=line`
Expected: all PASS, including the Earth guard (effects are not added yet, so its numbers should match M2a.1: night about 19.6, day about 108).

- [ ] **Step 6: Commit**

```powershell
git add src e2e
git commit -m "feat(render): apply quality presets to sphere detail and atmosphere samples; e2e forced presets and HD-tier guard" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Effects stack: bloom, exposure, tone mapping, chromatic aberration, vignette, grain; Camera-effects toggle

**Files:**
- Create: `src/render/effects/ExposureEffect.ts`, `src/render/effects/effects.test.ts`, `src/render/EffectsStack.tsx`
- Modify:
  - `src/render/quality.ts` and `quality.test.ts`: `activePasses`;
  - `src/render/RenderStateAttributes.tsx`: `data-fx`;
  - `src/scene/frameState.ts`: `fx`;
  - `src/scene/materials/useBodyUniforms.ts`: cinematic fill follows the toggle;
  - `src/scene/materials/illustrative.ts`: `CINEMATIC_FILL`;
  - `src/scene/SceneRoot.tsx`: use `EffectsStack`;
  - `e2e/quality.spec.ts`.
- Delete: `src/scene/Effects.tsx`

**Interfaces:**
- Produces (`quality.ts`):
  - `type PassId = 'bloom' | 'rays' | 'flare' | 'streaks' | 'dof' | 'exposure' | 'tonemap' | 'chromatic' | 'vignette' | 'grain'`;
  - `activePasses(level: QualityLevel, effects: boolean, hasFocus: boolean): PassId[]`, in render order. Tasks 6 and 7 render `rays`, `flare`, `streaks` and `dof`.
- Produces (`ExposureEffect`): `class ExposureEffect extends Effect`, with a `constructor(exposure = 1)` and an `exposure: number` accessor.
- Produces (`FrameState`): `fx: { exposure: number; skyDim: number }`, default `{ exposure: 1, skyDim: 1 }`. Task 6 writes it.
- Produces (`illustrative.ts`): `CINEMATIC_FILL = 1`. `useBodyUniforms` writes `uFill = effects ? CINEMATIC_FILL : 0` every frame.
- Produces (`EffectsStack`): `EffectsStack({ bodies }: { bodies: readonly Body[] })`, which renders the passes in `activePasses` order. `bodies` is used from Task 6.
- Constants:
  - `FILMIC_TONE_MAPPING = ToneMappingMode.AGX` (Task 9 may switch it to ACES and record why);
  - multisampling 4 at High and Medium, 0 at Low;
  - bloom: `mipmapBlur`, `levels = PRESETS[level].bloomLevels`, `luminanceThreshold` 1, intensity 1.1 with effects on and 0.6 with effects off.

- [ ] **Step 1: Write the failing tests**

Append to `src/render/quality.test.ts`:
```ts
describe('activePasses', () => {
  it('keeps only bloom and a neutral tone map when camera effects are off', () => {
    expect(activePasses('high', false, true)).toEqual(['bloom', 'tonemap']);
  });
  it('orders the full stack at High with a focused body', () => {
    expect(activePasses('high', true, true)).toEqual(['bloom', 'rays', 'flare', 'streaks', 'dof', 'exposure', 'tonemap', 'chromatic', 'vignette', 'grain']);
  });
  it('drops depth of field without a focus, and the detail effects and sun rays at Low', () => {
    expect(activePasses('medium', true, false)).not.toContain('dof');
    expect(activePasses('low', true, true)).toEqual(['bloom', 'exposure', 'tonemap', 'vignette']);
  });
});
```
(Add `activePasses` to the import.)

`src/render/effects/effects.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ExposureEffect } from './ExposureEffect';

describe('ExposureEffect', () => {
  it('stores the exposure in a uniform', () => {
    const e = new ExposureEffect(0.5);
    expect(e.exposure).toBe(0.5);
    e.exposure = 0.8;
    expect(e.uniforms.get('exposure')!.value).toBe(0.8);
    expect(e.getFragmentShader()).toContain('mainImage');
    e.dispose();
  });
});
```

Append to `e2e/quality.spec.ts`:
```ts
test('camera effects off leaves only bloom and a neutral tone map', async ({ page }) => {
  await page.goto('/?pause=1&quality=high&fx=0');
  await expect(page.locator('.scene')).toHaveAttribute('data-fx', 'bloom,tonemap');
});

test('Low runs the reduced stack', async ({ page }) => {
  await page.goto('/?pause=1&quality=low&fx=1');
  await expect(page.locator('.scene')).toHaveAttribute('data-fx', 'bloom,exposure,tonemap,vignette');
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/render`, then `npx playwright test e2e/quality.spec.ts --reporter=line`
Expected: FAIL (`activePasses` and `ExposureEffect` are missing, and no `data-fx` attribute is set).

- [ ] **Step 3: Implement `activePasses` in `src/render/quality.ts`**

```ts
export type PassId = 'bloom' | 'rays' | 'flare' | 'streaks' | 'dof' | 'exposure' | 'tonemap' | 'chromatic' | 'vignette' | 'grain';

/** Post-processing passes in render order (plan Global Constraints). Effects off keeps bloom and a neutral tone map. */
export function activePasses(level: QualityLevel, effects: boolean, hasFocus: boolean): PassId[] {
  if (!effects) return ['bloom', 'tonemap'];
  const p = PRESETS[level];
  const detail = p.detailFx !== 'off';
  const out: PassId[] = ['bloom'];
  if (p.sunRays) out.push('rays', 'flare');
  if (detail) out.push('streaks');
  if (detail && hasFocus) out.push('dof');
  out.push('exposure', 'tonemap');
  if (detail) out.push('chromatic');
  out.push('vignette');
  if (detail) out.push('grain');
  return out;
}
```

- [ ] **Step 4: Create `src/render/effects/ExposureEffect.ts`**

```ts
import { Effect } from 'postprocessing';
import { Uniform } from 'three';

const FRAGMENT = /* glsl */ `
uniform float exposure;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
}`;

/** Scene-driven exposure (plan scope ruling): multiplies HDR colour before tone mapping. */
export class ExposureEffect extends Effect {
  constructor(exposure = 1) {
    super('ExposureEffect', FRAGMENT, { uniforms: new Map([['exposure', new Uniform(exposure)]]) });
  }
  get exposure(): number {
    return this.uniforms.get('exposure')!.value as number;
  }
  set exposure(value: number) {
    this.uniforms.get('exposure')!.value = value;
  }
}
```

- [ ] **Step 5: Add `fx` to FrameState and the cinematic-fill toggle**

In `src/scene/frameState.ts`, add `fx: { exposure: number; skyDim: number };` to `FrameState` and `fx: { exposure: 1, skyDim: 1 },` to `createFrameState()`.

In `src/scene/materials/illustrative.ts`:
```ts
/** Strength of the cinematic fill light (spec §5), applied only while Camera effects is on. */
export const CINEMATIC_FILL = 1;
```

In `useBodyUniforms.ts`, inside the per-material loop, add:
```ts
      un.uFill!.value = useRenderStore.getState().effects ? CINEMATIC_FILL : 0;
```
(Import `useRenderStore` and `CINEMATIC_FILL`.)

- [ ] **Step 6: Create `src/render/EffectsStack.tsx`, and expose `data-fx`**

The composer gets an explicit array of children, with stable keys, so passes come and go cleanly.
```tsx
import { useFrame } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEffect, useMemo, type JSX } from 'react';
import { Vector2 } from 'three';
import type { Body } from '../core/catalog/schema';
import { useFrameState } from '../scene/FrameStateContext';
import { useRenderStore } from '../state/renderStore';
import { useSelectionStore } from '../state/selectionStore';
import { ExposureEffect } from './effects/ExposureEffect';
import { activePasses, PRESETS } from './quality';

/** Filmic operator; Task 9 compares ACES and AgX on the golden views (Decision 0007). */
export const FILMIC_TONE_MAPPING = ToneMappingMode.AGX;

export function EffectsStack({ bodies }: { bodies: readonly Body[] }) {
  void bodies; // used by the Sun effects (Task 6)
  const frame = useFrameState();
  const level = useRenderStore((s) => s.level);
  const effects = useRenderStore((s) => s.effects);
  const hasFocus = useSelectionStore((s) => s.selectedId !== null);
  const preset = PRESETS[level];
  const passes = activePasses(level, effects, hasFocus);

  const exposure = useMemo(() => new ExposureEffect(1), []);
  useEffect(() => () => exposure.dispose(), [exposure]);
  useFrame(() => {
    exposure.exposure = effects ? frame.fx.exposure : 1;
  });
  const caOffset = useMemo(() => (preset.detailFx === 'full' ? new Vector2(0.0012, 0.0012) : new Vector2(0.0007, 0.0007)), [preset.detailFx]);

  const children: JSX.Element[] = [];
  for (const pass of passes) {
    if (pass === 'bloom') children.push(<Bloom key="bloom" mipmapBlur levels={preset.bloomLevels} luminanceThreshold={1} intensity={effects ? 1.1 : 0.6} />);
    else if (pass === 'exposure') children.push(<primitive key="exposure" object={exposure} />);
    else if (pass === 'tonemap') children.push(<ToneMapping key={`tonemap-${effects}`} mode={effects ? FILMIC_TONE_MAPPING : ToneMappingMode.NEUTRAL} />);
    else if (pass === 'chromatic') children.push(<ChromaticAberration key="chromatic" offset={caOffset} radialModulation modulationOffset={0.35} />);
    else if (pass === 'vignette') children.push(<Vignette key="vignette" offset={0.3} darkness={0.55} />);
    else if (pass === 'grain') children.push(<Noise key="grain" premultiply opacity={preset.detailFx === 'full' ? 0.035 : 0.02} />);
  }
  return <EffectComposer multisampling={level === 'low' ? 0 : 4}>{children}</EffectComposer>;
}
```

If the installed `@react-three/postprocessing` types reject a prop:
- `levels` on `Bloom`;
- `radialModulation` or `modulationOffset` on `ChromaticAberration`;
- `opacity` on `Noise`.

Check the `.d.ts` under `node_modules/@react-three/postprocessing/dist/effects/` and use the equivalent prop (for example, set it on the effect through a `ref`). Record any adaptation in the report.

In `SceneRoot.tsx`, replace `<Effects />` with `<EffectsStack bodies={catalog.bodies} />`, and delete `src/scene/Effects.tsx`.

In `RenderStateAttributes.tsx`, also read `effects` and `selectedId`, and set:
```ts
    target.current?.setAttribute('data-fx', activePasses(level, effects, selectedId !== null).join(','));
```

- [ ] **Step 7: Run tests, and check that the guard still holds**

Run: `npx vitest run src/render`, `npm test`, `npm run typecheck`, `npx playwright test --reporter=line`
Expected: all PASS. For now `data-fx` at High also lists `rays`, `flare`, `streaks` and `dof`; Tasks 6 and 7 render them.

Watch the Earth guard numbers: tone mapping changes the night and day patch values. If a threshold fails:
- read the new numbers;
- confirm by viewing the PNG that the night side is still dark and the frame is not black;
- adjust only the night/day thresholds;
- record the before and after values in the report;
- never relax the `max > 40` "not black" check.

View `test-results/golden/1-earth-terminator.png` and `3-sun.png`. The limb should no longer clip to flat white, and the Sun should have a bloom halo.

- [ ] **Step 8: Commit**

```powershell
git add -A src e2e
git commit -m "feat(render): add the effects stack with exposure, filmic tone mapping, chromatic aberration, vignette and grain; camera-effects toggle" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Sun effects: god rays, lens flare, scene-driven exposure and star dimming

**Files:**
- Create: `src/render/exposure.ts`, `src/render/exposure.test.ts`, `src/render/sunFx.ts`
- Modify:
  - `src/core/shadows/eclipse.ts` and `eclipse.test.ts`: `sunVisibilityFromObserver`;
  - `src/render/EffectsStack.tsx`: `GodRays` and lens flare;
  - `src/scene/sky/SkyBackground.tsx`: sky dimming.

**Interfaces:**
- Produces (core):
  ```ts
  sunVisibilityFromObserver(observerKm: Vec3, sunKm: Vec3, sunRadiusKm: number, occluders: ReadonlyArray<{ posKm: Vec3; radiusKm: number }>): number
  ```
  It returns the visible fraction of the Sun's disc (0–1). Occluders behind the Sun, or containing the observer, are ignored.
- Produces (`exposure.ts`):
  - `EXPOSURE = { minDip: 0.15, maxDip: 0.4, skyDimAtFull: 0.25, fullSizeRad: 5° in radians, damping: 4 }`;
  - `sunFrameWeight(sunVisible: number, ndc: readonly [number, number] | null): number` (`null` means behind the camera);
  - `sceneExposure(weight: number, sunAngularRadiusRad: number): { exposure: number; skyDim: number }`;
  - `damp(current, target, lambda, dt): number`.
- Produces (`sunFx.ts`):
  ```ts
  useSunFx(opts: { sun: Body | undefined; bodies: readonly Body[]; proxy: Mesh; flare: LensFlareEffect; godRays: React.RefObject<GodRaysEffect | null> }): void
  ```
  At `useFrame` priority −0.3, it:
  - positions and scales the god-ray proxy (0.98 × the Sun's render radius, camera-relative);
  - sets the flare's `lensPosition` (NDC) and `opacity` (the weight);
  - sets the god-ray opacity (0 when the Sun is behind the camera, otherwise the visible fraction);
  - damps `frame.fx.exposure` and `frame.fx.skyDim` toward `sceneExposure`.
- Occluders use **render** radii (`frame.bodyRenderRadiusKm`), so the effects match what is drawn in Readable mode.

- [ ] **Step 1: Write the failing tests**

Append to `src/core/shadows/eclipse.test.ts`:
```ts
describe('sunVisibilityFromObserver', () => {
  const sun: Vec3 = [1000, 0, 0];
  it('is fully visible with nothing in the way', () => {
    expect(sunVisibilityFromObserver([0, 0, 0], sun, 10, [])).toBe(1);
    expect(sunVisibilityFromObserver([0, 0, 0], sun, 10, [{ posKm: [0, 500, 0], radiusKm: 50 }])).toBe(1);
  });
  it('is hidden by a planet straight in front of it', () => {
    expect(sunVisibilityFromObserver([0, 0, 0], sun, 10, [{ posKm: [100, 0, 0], radiusKm: 20 }])).toBe(0);
  });
  it('ignores bodies behind the Sun', () => {
    expect(sunVisibilityFromObserver([0, 0, 0], sun, 10, [{ posKm: [2000, 0, 0], radiusKm: 500 }])).toBe(1);
  });
  it('dims partially when a limb covers part of the disc', () => {
    // Sun angular radius ~0.01 rad; occluder of equal angular size offset by one radius.
    const v = sunVisibilityFromObserver([0, 0, 0], sun, 10, [{ posKm: [100, 1, 0], radiusKm: 1 }]);
    expect(v).toBeGreaterThan(0.2);
    expect(v).toBeLessThan(0.8);
  });
});
```
(Import `sunVisibilityFromObserver`, and the `Vec3` type if it isn't already imported.)

`src/render/exposure.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { damp, EXPOSURE, sceneExposure, sunFrameWeight } from './exposure';

describe('scene-driven exposure', () => {
  it('weights the Sun by visibility and position in frame', () => {
    expect(sunFrameWeight(1, [0, 0])).toBe(1);
    expect(sunFrameWeight(0.5, [0.2, -0.3])).toBe(0.5);
    expect(sunFrameWeight(1, [1.15, 0])).toBeCloseTo(0.5, 6);
    expect(sunFrameWeight(1, [2, 0])).toBe(0);
    expect(sunFrameWeight(1, null)).toBe(0);
  });
  it('leaves exposure and the sky alone when the Sun is not in frame', () => {
    expect(sceneExposure(0, 0.1)).toEqual({ exposure: 1, skyDim: 1 });
  });
  it('dips exposure more for a large Sun and dims the stars', () => {
    const small = sceneExposure(1, 0.001);
    const large = sceneExposure(1, EXPOSURE.fullSizeRad);
    expect(small.exposure).toBeCloseTo(1 - EXPOSURE.minDip, 2);
    expect(large.exposure).toBeCloseTo(1 - EXPOSURE.maxDip, 6);
    expect(large.skyDim).toBeCloseTo(EXPOSURE.skyDimAtFull, 6);
  });
  it('damps toward the target without overshoot', () => {
    let x = 1;
    for (let i = 0; i < 120; i++) x = damp(x, 0.6, EXPOSURE.damping, 1 / 60);
    expect(x).toBeGreaterThan(0.6);
    expect(x).toBeLessThan(0.61);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/core/shadows src/render/exposure.test.ts`
Expected: FAIL (both functions are missing).

- [ ] **Step 3: Implement `sunVisibilityFromObserver` in `src/core/shadows/eclipse.ts`**

```ts
/** Visible fraction of the Sun's disc seen from an observer, with spherical occluders (all in km). */
export function sunVisibilityFromObserver(
  observerKm: Vec3,
  sunKm: Vec3,
  sunRadiusKm: number,
  occluders: ReadonlyArray<{ posKm: Vec3; radiusKm: number }>,
): number {
  const toSun = sub(sunKm, observerKm);
  const dSun = length(toSun);
  if (dSun <= sunRadiusKm) return 1;
  const sunAngular = Math.asin(Math.min(1, sunRadiusKm / dSun));
  let visible = 1;
  for (const o of occluders) {
    const toOcc = sub(o.posKm, observerKm);
    const dOcc = length(toOcc);
    if (dOcc >= dSun || dOcc <= o.radiusKm) continue;
    const occAngular = Math.asin(Math.min(1, o.radiusKm / dOcc));
    const separation = Math.atan2(length(cross(toSun, toOcc)), dot(toSun, toOcc));
    visible *= sunVisibleFraction(sunAngular, occAngular, separation);
  }
  return visible;
}
```
(Add `cross`, `length` and `sub` to the `../math/vec3` import.)

- [ ] **Step 4: Create `src/render/exposure.ts`**

```ts
/** Scene-driven exposure (plan scope ruling). */
export const EXPOSURE = {
  minDip: 0.15,
  maxDip: 0.4,
  skyDimAtFull: 0.25,
  fullSizeRad: (5 * Math.PI) / 180,
  damping: 4,
} as const;

export function sunFrameWeight(sunVisible: number, ndc: readonly [number, number] | null): number {
  if (!ndc) return 0;
  const edge = Math.max(Math.abs(ndc[0]), Math.abs(ndc[1]));
  const onScreen = edge <= 1 ? 1 : edge >= 1.3 ? 0 : 1 - (edge - 1) / 0.3;
  return sunVisible * onScreen;
}

export function sceneExposure(weight: number, sunAngularRadiusRad: number): { exposure: number; skyDim: number } {
  const size = Math.min(1, Math.max(0, sunAngularRadiusRad / EXPOSURE.fullSizeRad));
  const dip = EXPOSURE.minDip + (EXPOSURE.maxDip - EXPOSURE.minDip) * size;
  return { exposure: 1 - weight * dip, skyDim: 1 - weight * (1 - EXPOSURE.skyDimAtFull) };
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}
```

- [ ] **Step 5: Create `src/render/sunFx.ts`**

```ts
import { useFrame, useThree } from '@react-three/fiber';
import type { LensFlareEffect } from '@react-three/postprocessing';
import { useMemo } from 'react';
import type { GodRaysEffect } from 'postprocessing';
import { Vector3, type Mesh } from 'three';
import type { Body } from '../core/catalog/schema';
import { length, sub, type Vec3 } from '../core/math/vec3';
import { sunVisibilityFromObserver } from '../core/shadows/eclipse';
import { useFrameState } from '../scene/FrameStateContext';
import { damp, EXPOSURE, sceneExposure, sunFrameWeight } from './exposure';

const SUN_FX_PRIORITY = -0.3;

export function useSunFx(opts: {
  sun: Body | undefined;
  bodies: readonly Body[];
  proxy: Mesh;
  flare: LensFlareEffect;
  godRays: React.RefObject<GodRaysEffect | null>;
}): void {
  const frame = useFrameState();
  const size = useThree((s) => s.size);
  const rel = useMemo(() => new Vector3(), []);
  const view = useMemo(() => new Vector3(), []);
  useFrame((state, delta) => {
    const { sun, bodies, proxy, flare, godRays } = opts;
    const sunKm = sun && frame.bodyPositionsKm.get(sun.id);
    const sunR = sun && frame.bodyRenderRadiusKm.get(sun.id);
    if (!sun || !sunKm || !sunR) return;
    const d = sub(sunKm, frame.cameraPositionKm);
    rel.set(d[0], d[1], d[2]);
    proxy.position.copy(rel);
    proxy.scale.setScalar(sunR * 0.98);
    proxy.updateMatrix();
    proxy.updateMatrixWorld(true);

    const occluders: Array<{ posKm: Vec3; radiusKm: number }> = [];
    for (const b of bodies) {
      if (b.id === sun.id) continue;
      const p = frame.bodyPositionsKm.get(b.id);
      const r = frame.bodyRenderRadiusKm.get(b.id);
      if (p && r) occluders.push({ posKm: p, radiusKm: r });
    }
    const visible = sunVisibilityFromObserver(frame.cameraPositionKm, sunKm, sunR, occluders);
    view.copy(rel).applyMatrix4(state.camera.matrixWorldInverse);
    const inFront = view.z < 0;
    const ndc = inFront ? rel.clone().project(state.camera) : null;
    const weight = sunFrameWeight(visible, ndc ? [ndc.x, ndc.y] : null);
    const target = sceneExposure(weight, Math.asin(Math.min(1, sunR / length(d))));
    frame.fx.exposure = damp(frame.fx.exposure, target.exposure, EXPOSURE.damping, delta);
    frame.fx.skyDim = damp(frame.fx.skyDim, target.skyDim, EXPOSURE.damping, delta);

    const lens = flare.uniforms.get('lensPosition')!.value as { x: number; y: number };
    lens.x = ndc ? ndc.x : 10;
    lens.y = ndc ? ndc.y : 10;
    flare.uniforms.get('opacity')!.value = weight;
    const res = flare.uniforms.get('screenRes')!.value as { x: number; y: number };
    res.x = size.width;
    res.y = size.height;
    if (godRays.current) godRays.current.blendMode.opacity.value = inFront ? visible : 0;
  }, SUN_FX_PRIORITY);
}
```

Allocation note: `rel.clone()` allocates one vector per frame. To avoid it, use a third preallocated vector if the reviewer asks.

- [ ] **Step 6: Add the god rays and lens flare to `EffectsStack`, and dim the sky**

In `EffectsStack.tsx`:
```tsx
import { GodRays, LensFlareEffect } from '@react-three/postprocessing';
import type { GodRaysEffect } from 'postprocessing';
import { Color, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import { useRef } from 'react';
import { useSunFx } from './sunFx';

  // inside EffectsStack, replacing `void bodies;`
  const sun = bodies.find((b) => b.category === 'star');
  const proxy = useMemo(
    () => new Mesh(new SphereGeometry(1, 32, 16), new MeshBasicMaterial({ color: new Color(sun?.display.color ?? '#ffd27a').multiplyScalar(1.5), transparent: true, depthWrite: false })),
    [sun?.display.color],
  );
  useEffect(
    () => () => {
      proxy.geometry.dispose();
      (proxy.material as MeshBasicMaterial).dispose();
    },
    [proxy],
  );
  const flare = useMemo(
    () =>
      new LensFlareEffect({
        glareSize: 0.12,
        flareSize: 0.004,
        flareSpeed: 0.004,
        flareShape: 0.1,
        animated: false,
        starPoints: 6,
        haloScale: 0.5,
        secondaryGhosts: true,
        aditionalStreaks: false,
        ghostScale: 0.1,
        starBurst: false,
        colorGain: new Color(14, 12, 10),
        opacity: 0,
      }),
    [],
  );
  useEffect(() => () => flare.dispose(), [flare]);
  const godRays = useRef<GodRaysEffect | null>(null);
  useSunFx({ sun, bodies, proxy, flare, godRays });
```
and in the pass loop:
```tsx
    else if (pass === 'rays') children.push(<GodRays key="rays" ref={godRays} sun={proxy} samples={preset.detailFx === 'full' ? 60 : 40} density={0.96} decay={0.93} weight={0.35} exposure={0.5} clampMax={1} blur />);
    else if (pass === 'flare') children.push(<primitive key="flare" object={flare} />);
```

`useSunFx` must run even when `rays` and `flare` are not active, because the exposure targets depend on it. It always runs; with effects off, `ExposureEffect` simply isn't in the stack and the sky ignores `skyDim` (below).

In `src/scene/sky/SkyBackground.tsx`, add:
```tsx
  const frame = useFrameState();
  useFrame(() => {
    material.uniforms.uExposure!.value = SKY_EXPOSURE * (useRenderStore.getState().effects ? frame.fx.skyDim : 1);
  });
```
(Import `useFrame`, `useFrameState` and `useRenderStore`.)

- [ ] **Step 7: Run tests and review the Sun view**

Run: `npx vitest run src/core src/render`, `npm test`, `npm run typecheck`, `npx playwright test --reporter=line`
Expected: all PASS, with no page or shader errors.

View `test-results/golden/3-sun.png`. Expect:
- god rays streaming from the disc;
- a lens flare and ghosts along the line through the frame centre;
- the stars visibly dimmer than in `4-overview.png`;
- the disc not blown out.

Then view `1-earth-terminator.png`: the Sun is out of frame, so there should be no flare and no dimming.

Add a temporary view with the Sun just behind Earth's limb, for example `/?jd=2461317.5&pause=1&target=earth&dist=20000&azSun=180&el=0&quality=high&fx=1` (camera on Earth's night side, looking toward the Sun). Confirm that the flare and rays fade out completely, or nearly, when the disc is hidden. Remove the view afterwards and describe the result in the report.

- [ ] **Step 8: Commit**

```powershell
git add src
git commit -m "feat(render): add god rays, an occlusion-aware lens flare and scene-driven exposure with star dimming" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Depth of field on the selected body, and anamorphic streaks

**Files:**
- Create: `src/render/dof.ts`, `src/render/dof.test.ts`, `src/render/effects/AnamorphicStreakEffect.ts`
- Modify: `src/render/EffectsStack.tsx`, `src/render/effects/effects.test.ts`, `e2e/golden.spec.ts` (guard extended), `e2e/quality.spec.ts` (full stack at High)

**Interfaces:**
- Produces (`dof.ts`):
  - `dofSettings(distanceKm: number, detail: 'full' | 'light'): { focusRange: number; bokehScale: number }`. Full: range = 0.35 × distance, bokeh 2. Light: range = 0.6 × distance, bokeh 1.
  - `focusPoint(relKm: Vec3, renderRadiusKm: number): Vec3`, the point on the body's near surface along the line of sight (`rel × (|rel| − r)/|rel|`).
- Produces (`AnamorphicStreakEffect`): `class AnamorphicStreakEffect extends Effect`, with `constructor({ threshold = 2, strength = 0.8, spreadPx = 6 } = {})` and the `EffectAttribute.CONVOLUTION` attribute. Strength is 0.8 at High and 0.5 at Medium.
- Behaviour: `dof` is active only with a selected body, effects on and `detailFx ≠ 'off'`. Its `target` is updated every frame to `focusPoint` of the selected body, and its focus range comes from `dofSettings`.

- [ ] **Step 1: Write the failing tests**

`src/render/dof.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { dofSettings, focusPoint } from './dof';

describe('depth of field', () => {
  it('keeps the selected body sharp with a range proportional to distance', () => {
    expect(dofSettings(100000, 'full')).toEqual({ focusRange: 35000, bokehScale: 2 });
    expect(dofSettings(100000, 'light')).toEqual({ focusRange: 60000, bokehScale: 1 });
  });
  it('focuses on the near surface, not the centre', () => {
    const p = focusPoint([0, 0, -10000], 2000);
    expect(p[2]).toBeCloseTo(-8000, 9);
  });
});
```

Append to `src/render/effects/effects.test.ts`:
```ts
import { EffectAttribute } from 'postprocessing';
import { AnamorphicStreakEffect } from './AnamorphicStreakEffect';

describe('AnamorphicStreakEffect', () => {
  it('is a convolution effect with tunable uniforms', () => {
    const e = new AnamorphicStreakEffect({ strength: 0.5 });
    expect(e.getAttributes() & EffectAttribute.CONVOLUTION).toBeTruthy();
    expect(e.uniforms.get('strength')!.value).toBe(0.5);
    expect(e.getFragmentShader()).toContain('inputBuffer');
    e.dispose();
  });
});
```

Append to `e2e/quality.spec.ts`:
```ts
test('High with a focused body runs the full stack', async ({ page }) => {
  await page.goto('/?pause=1&quality=high&fx=1&target=earth');
  await expect(page.locator('.scene')).toHaveAttribute('data-fx', 'bloom,rays,flare,streaks,dof,exposure,tonemap,chromatic,vignette,grain');
  await page.waitForTimeout(1500);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/render`
Expected: FAIL (both modules are missing).

- [ ] **Step 3: Create `src/render/dof.ts` and `src/render/effects/AnamorphicStreakEffect.ts`**

```ts
import { length, scale, type Vec3 } from '../core/math/vec3';

export function dofSettings(distanceKm: number, detail: 'full' | 'light'): { focusRange: number; bokehScale: number } {
  return detail === 'full' ? { focusRange: distanceKm * 0.35, bokehScale: 2 } : { focusRange: distanceKm * 0.6, bokehScale: 1 };
}

/** The point on the body's near surface along the line of sight (camera at the origin). */
export function focusPoint(relKm: Vec3, renderRadiusKm: number): Vec3 {
  const d = length(relKm);
  return d > renderRadiusKm ? scale(relKm, (d - renderRadiusKm) / d) : relKm;
}
```

```ts
import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform } from 'three';

const FRAGMENT = /* glsl */ `
uniform float threshold;
uniform float strength;
uniform float spreadPx;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 sum = vec3(0.0);
  float wsum = 0.0;
  for (int i = -12; i <= 12; i++) {
    float fi = float(i);
    vec3 c = texture2D(inputBuffer, uv + vec2(fi * spreadPx * texelSize.x, 0.0)).rgb;
    float w = exp(-abs(fi) / 5.0);
    sum += max(c - vec3(threshold), vec3(0.0)) * w;
    wsum += w;
  }
  vec3 streak = (sum / wsum) * strength * vec3(0.55, 0.75, 1.0);
  outputColor = vec4(inputColor.rgb + streak, inputColor.a);
}`;

/** Horizontal streaks from the brightest HDR highlights (illustrative camera effect). */
export class AnamorphicStreakEffect extends Effect {
  constructor({ threshold = 2, strength = 0.8, spreadPx = 6 }: { threshold?: number; strength?: number; spreadPx?: number } = {}) {
    super('AnamorphicStreakEffect', FRAGMENT, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['threshold', new Uniform(threshold)],
        ['strength', new Uniform(strength)],
        ['spreadPx', new Uniform(spreadPx)],
      ]),
    });
  }
}
```

The postprocessing `EffectMaterial` provides the `inputBuffer` and `texelSize` uniforms to effect fragments. If the compiled shader complains that they are undeclared, confirm the names in `node_modules/postprocessing/build/index.js` (search for `uniform vec2 texelSize`) and adjust.

- [ ] **Step 4: Add the streaks and depth of field to `EffectsStack`**

```tsx
import { DepthOfField } from '@react-three/postprocessing';
import type { DepthOfFieldEffect } from 'postprocessing';
import { Vector3 } from 'three';
import { sub } from '../core/math/vec3';
import { dofSettings, focusPoint } from './dof';
import { AnamorphicStreakEffect } from './effects/AnamorphicStreakEffect';

  const streaks = useMemo(() => new AnamorphicStreakEffect({ strength: preset.detailFx === 'full' ? 0.8 : 0.5 }), [preset.detailFx]);
  useEffect(() => () => streaks.dispose(), [streaks]);
  const dof = useRef<DepthOfFieldEffect | null>(null);
  const dofTarget = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const id = useSelectionStore.getState().selectedId;
    const effect = dof.current;
    if (!effect || !id || preset.detailFx === 'off') return;
    const pos = frame.bodyPositionsKm.get(id);
    const r = frame.bodyRenderRadiusKm.get(id);
    if (!pos || !r) return;
    const rel = sub(pos, frame.cameraPositionKm);
    const p = focusPoint(rel, r);
    dofTarget.set(p[0], p[1], p[2]);
    effect.target = dofTarget;
    const s = dofSettings(Math.hypot(p[0], p[1], p[2]), preset.detailFx);
    effect.cocMaterial.focusRange = s.focusRange;
    effect.bokehScale = s.bokehScale;
  });
```
and in the pass loop:
```tsx
    else if (pass === 'streaks') children.push(<primitive key="streaks" object={streaks} />);
    else if (pass === 'dof') children.push(<DepthOfField key="dof" ref={dof} bokehScale={preset.detailFx === 'full' ? 2 : 1} />);
```

In postprocessing 6.39, `CircleOfConfusionMaterial.focusRange` and `focusDistance` are in world units, and `worldFocusRange` is a deprecated alias (see `node_modules/postprocessing/build/index.js` around the `set worldFocusRange` definition). `effect.target` is a world-space `Vector3`; the effect computes the focus distance from the camera to it each frame. If the installed API differs, use its world-space equivalent and record it.

- [ ] **Step 5: Extend the Earth guard with a star-field check (Review Focus #4)**

In `e2e/golden.spec.ts`, the guard URL already selects Earth and, since Task 4, forces `quality=high&fx=1`, so depth of field is active. After the existing assertions, count bright pixels in a sky region of the same screenshot:
```ts
  const brightPixels = (x0: number, y0: number, w: number, h: number) => {
    let n = 0;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const i = (y * info.width + x) * 3;
        if (Math.max(data[i]!, data[i + 1]!, data[i + 2]!) > 90) n++;
      }
    }
    return n;
  };
  // Sky region chosen from the current render: left of the disc, below the top bar, no labels or orbit lines.
  const stars = brightPixels(SKY_X, SKY_Y, SKY_W, SKY_H);
  console.log(`atmosphere guard: stars=${stars}`);
  expect(stars).toBeGreaterThanOrEqual(3);
```

To pick the region:
1. Choose `SKY_X/Y/W/H` from `test-results/golden/1-earth-terminator.png`, rendered with depth of field disabled (temporarily force `detailFx` off). Pick a 200×120 px region that contains several stars and no planet, label, orbit line or panel.
2. Define the constants with a comment saying how they were chosen.
3. Re-enable depth of field and run. If the stars fall below 3 because depth of field blurs them away, reduce the blur (lower `bokehScale` or a wider `focusRange` in `dofSettings`) rather than loosening the check, and record the values.

- [ ] **Step 6: Run everything and review**

Run: `npx vitest run src/render`, `npm test`, `npm run typecheck`, `npx playwright test --reporter=line`
Expected: all PASS.

View the Earth, Saturn and Sun golden PNGs:
- the selected body is sharp, and background stars are softened but present;
- the Sun has faint horizontal streaks;
- there is no black frame and no banding beyond a slight softness.

- [ ] **Step 7: Commit**

```powershell
git add src e2e
git commit -m "feat(render): add depth of field on the selected body and anamorphic highlight streaks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Quality and Camera-effects controls, keys Q and E, and a toggle stress test

**Files:**
- Create: `src/types/render-info.d.ts`
- Modify:
  - `src/ui/TopBar.tsx` and `src/ui/TopBar.test.tsx`;
  - `src/render/QualityGovernor.tsx`: a dev-only render-info hook;
  - `src/styles/app.css`, if needed for wrapping;
  - `e2e/quality.spec.ts`: keyboard and stress tests.

**Interfaces:**
- Consumes: `useRenderStore` (`mode`, `level`, `effects`, `setMode`, `cycleMode`, `toggleEffects`).
- Produces (UI):
  - a segmented **Quality** group with Auto, High, Medium and Low. The pressed state follows `mode`, and while in Auto the label reads "Auto · High" and so on.
  - a **Camera effects** checkbox.
  - keyboard: **Q** cycles the quality mode and **E** toggles camera effects. Keys are ignored while typing, as in M1.
  - tooltips naming the keys.
- Produces (dev only): `window.__svRenderInfo?: () => { textures: number; geometries: number; programs: number }`, installed by `QualityGovernor` when `import.meta.env.DEV`.

- [ ] **Step 1: Write the failing tests**

Add to `src/ui/TopBar.test.tsx` (follow the file's existing render and setup style):
```tsx
describe('quality and camera effects', () => {
  beforeEach(() => useRenderStore.setState({ mode: 'auto', level: 'high', effects: true }));
  it('shows the Auto level and switches quality from the buttons', async () => {
    render(<TopBar />);
    expect(screen.getByRole('button', { name: /Auto · High/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Medium' }));
    expect(useRenderStore.getState()).toMatchObject({ mode: 'medium', level: 'medium' });
  });
  it('cycles quality with Q and toggles effects with E, but not while typing', async () => {
    render(
      <>
        <TopBar />
        <input aria-label="typing" />
      </>,
    );
    await userEvent.keyboard('q');
    expect(useRenderStore.getState().mode).toBe('high');
    await userEvent.keyboard('e');
    expect(useRenderStore.getState().effects).toBe(false);
    await userEvent.click(screen.getByRole('textbox', { name: 'typing' }));
    await userEvent.keyboard('qe');
    expect(useRenderStore.getState()).toMatchObject({ mode: 'high', effects: false });
  });
  it('toggles camera effects from the checkbox', async () => {
    render(<TopBar />);
    await userEvent.click(screen.getByRole('checkbox', { name: /Camera effects/ }));
    expect(useRenderStore.getState().effects).toBe(false);
  });
});
```

Append to `e2e/quality.spec.ts`:
```ts
test('Q cycles quality and E toggles camera effects', async ({ page }) => {
  await page.goto('/?pause=1&quality=low');
  await expect(page.locator('.scene[data-quality-mode="low"]')).toBeAttached();
  await page.keyboard.press('q');
  await expect(page.locator('.scene[data-quality-mode="auto"]')).toBeAttached();
  await page.keyboard.press('e');
  await expect(page.locator('.scene')).toHaveAttribute('data-fx', 'bloom,tonemap');
});

test('toggling quality and effects repeatedly does not leak GPU resources', async ({ page }) => {
  await page.goto('/?pause=1&quality=low&target=earth');
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 30_000 });
  await page.waitForTimeout(1500);
  const info = () => page.evaluate(() => window.__svRenderInfo!());
  const baseline = await info();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('q');
    await page.waitForTimeout(400);
    await page.keyboard.press('e');
    await page.waitForTimeout(400);
  }
  // Eight presses of each return to the start: quality Low, effects on.
  await expect(page.locator('.scene[data-quality-mode="low"]')).toBeAttached();
  await page.waitForTimeout(2000);
  const after = await info();
  console.log(`render info baseline=${JSON.stringify(baseline)} after=${JSON.stringify(after)}`);
  expect(after.textures).toBeLessThanOrEqual(baseline.textures + 4);
  expect(after.geometries).toBeLessThanOrEqual(baseline.geometries + 4);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/ui/TopBar.test.tsx`, then `npx playwright test e2e/quality.spec.ts --reporter=line`
Expected: FAIL (no Quality controls, keys or `__svRenderInfo`).

- [ ] **Step 3: Add the controls and keys to `src/ui/TopBar.tsx`**

```tsx
import { useRenderStore } from '../state/renderStore';
import type { QualityLevel, QualityMode } from '../render/quality';

const MODE_LABEL: Record<QualityMode, string> = { auto: 'Auto', high: 'High', medium: 'Medium', low: 'Low' };
const LEVEL_LABEL: Record<QualityLevel, string> = { high: 'High', medium: 'Medium', low: 'Low' };

// inside TopBar:
  const mode = useRenderStore((s) => s.mode);
  const level = useRenderStore((s) => s.level);
  const setMode = useRenderStore((s) => s.setMode);
  const effects = useRenderStore((s) => s.effects);
  const toggleEffects = useRenderStore((s) => s.toggleEffects);

// extend the existing keydown handler:
      else if (e.key === 'q' || e.key === 'Q') useRenderStore.getState().cycleMode();
      else if (e.key === 'e' || e.key === 'E') useRenderStore.getState().toggleEffects();

// after the Scale group:
      <div className="segmented" role="group" aria-label="Quality">
        {(['auto', 'high', 'medium', 'low'] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} title="Rendering quality; Auto adapts to your frame rate (key Q cycles)">
            {m === 'auto' && mode === 'auto' ? `Auto · ${LEVEL_LABEL[level]}` : MODE_LABEL[m]}
          </button>
        ))}
      </div>
      <label className="toggle" title="Bloom stays on; god rays, lens flare, depth of field, grain and the other camera effects switch off (key E)">
        <input type="checkbox" checked={effects} onChange={toggleEffects} />
        Camera effects
      </label>
```
Extend the hint text with `· Q quality · E camera effects`. If the top bar wraps badly at desktop widths, allow `flex-wrap: wrap` on `.top-bar` in `app.css`. The full redesign is M2a.3.

- [ ] **Step 4: Add the dev-only render-info hook**

`src/types/render-info.d.ts`:
```ts
export {};
declare global {
  interface Window {
    /** Dev builds only: live WebGL resource counts for leak tests. */
    __svRenderInfo?: () => { textures: number; geometries: number; programs: number };
  }
}
```

In `QualityGovernor.tsx`:
```tsx
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__svRenderInfo = () => ({ textures: gl.info.memory.textures, geometries: gl.info.memory.geometries, programs: gl.info.programs?.length ?? 0 });
    return () => {
      delete window.__svRenderInfo;
    };
  }, [gl]);
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/ui`, `npm test`, `npm run typecheck`, `npx playwright test --reporter=line`
Expected: all PASS. If the stress test fails, the counts it prints show what leaks. Common causes:
- an effect created in `useMemo` and never disposed;
- a geometry rebuilt per level without disposal.

Fix the leak; do not raise the margin.

- [ ] **Step 6: Commit**

```powershell
git add src e2e
git commit -m "feat(ui): add Quality and Camera-effects controls with Q and E keys; guard against GPU leaks when toggling" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Look pass: tone-mapping choice, constant tuning and new golden views

**Files:**
- Create: `Space_visualizer/Decisions/0007-tone-mapping-and-exposure.md`
- Modify:
  - `src/render/EffectsStack.tsx`: `FILMIC_TONE_MAPPING`, and flare and ray constants if tuned;
  - `src/render/exposure.ts`: `EXPOSURE`, if tuned;
  - `src/scene/materials/illustrative.ts`: `CINEMATIC_FILL`, plus new `RING_UNLIT_SCALE`, `GLINT_STRENGTH`, `GLINT_ROUGHNESS`, `CLOUD_SHADOW_OFFSET`, `CORONA_GAIN`;
  - `RingShell.tsx`, `EarthMaterial.tsx`, `CoronaGlow.tsx`: use those constants;
  - `AtmosphereShell.tsx`: the Earth preset intensity, if needed;
  - `e2e/golden.spec.ts`: new views; guard thresholds only if tone mapping moved them.

**Interfaces:**
- Produces: the named constants above, in `illustrative.ts` (all illustrative, no data meaning).
- Starting values (tune from here and record the finals):

  | Constant | Start | Was |
  |---|---|---|
  | `CINEMATIC_FILL` | 0.6 | 1 |
  | `RING_UNLIT_SCALE` | 0.5 | implicit 1 |
  | `GLINT_STRENGTH` | 0.035 | 0.06 |
  | `GLINT_ROUGHNESS` | 0.45 | 0.35 |
  | `CLOUD_SHADOW_OFFSET` | 0.004 | 0.0025, now with a 1/cos(latitude) correction |
  | `CORONA_GAIN` | 0.9 | 1.6, the colour multiplier in CoronaGlow |

- New golden views:
  - `2b-saturn-equinox`: `/?jd=2454710.5&pause=1&target=saturn&dist=420000&azSun=55&el=6&quality=high&fx=1`, 2008-09-01, with the Sun about 4° from the ring plane;
  - `3b-sun-behind-earth`: `/?jd=2461317.5&pause=1&target=earth&dist=20000&azSun=180&el=0&quality=high&fx=1`, to check occlusion.

- [ ] **Step 1: Move the look constants into `illustrative.ts` and wire them**

Add to `src/scene/materials/illustrative.ts`:
```ts
/** Look constants tuned in M2a.2 Task 9 (illustrative; no data meaning). */
export const RING_UNLIT_SCALE = 0.5;
export const GLINT_STRENGTH = 0.035;
export const GLINT_ROUGHNESS = 0.45;
export const CLOUD_SHADOW_OFFSET = 0.004;
export const CORONA_GAIN = 0.9;
```
and set `CINEMATIC_FILL = 0.6`. Interpolate them into the GLSL with `.toFixed(4)`, so every literal is a valid float:
- **`RingShell.tsx`:** `float transmitted = ${RING_UNLIT_SCALE.toFixed(4)} * 4.0 * ring.a * (1.0 - ring.a) * mu0 / max(mu0 + mu, 1e-4);`
- **`EarthMaterial.tsx`, glint:** `float spec = ocean * ggx(n, v, l, ${GLINT_ROUGHNESS.toFixed(4)}) * max(geo, 0.0) * ${GLINT_STRENGTH.toFixed(4)} * (1.0 - cloudHere);`
- **`EarthMaterial.tsx`, cloud shadow:** `vec2(dot(l, east) / max(length(n.xy), 0.2), dot(l, north)) * ${CLOUD_SHADOW_OFFSET.toFixed(4)}`. The 1/cos(latitude) correction keeps the shadow offset constant on the ground.
- **`CoronaGlow.tsx`:** the colour becomes `new Color(body.display.color).multiplyScalar(CORONA_GAIN)`.

- [ ] **Step 2: Add the new golden views and render the set twice (AgX and ACES)**

Add the two views to `VIEWS` in `e2e/golden.spec.ts`.
1. Run `npx playwright test e2e/golden.spec.ts --reporter=line` with `FILMIC_TONE_MAPPING = ToneMappingMode.AGX`, and copy `test-results/golden/` to `test-results/golden-agx/`.
2. Switch to `ToneMappingMode.ACES_FILMIC`, run again, and copy to `test-results/golden-aces/`.
3. View the pairs: Earth, the Sun, the overview and the two Saturn views. Judge them on:
   - colour fidelity of the official maps (Earth's blues and Mars's ochre should not shift hue);
   - highlight roll-off on the Sun and the Earth limb;
   - contrast on the night sides.
4. Pick one, set it in `EffectsStack.tsx`, and write the comparison in Decision 0007 (Step 5).

- [ ] **Step 3: Tune against the spec §7 look checklist**

Work through each view and adjust only the named constants: the table above, `EXPOSURE`, the flare (`colorGain`, `glareSize`), the god rays (`weight`, `exposure`), bloom intensity, and the Earth atmosphere `intensity`.

| View | Must show |
|---|---|
| 1 Earth | Twilight band; city lights only at night; offset cloud shadows visible at this framing; blue limb not clipped to white; night side deep blue-black (the fill is no longer grey) |
| 2 / 2b Saturn | Ring shadow on the globe and the globe's shadow on the rings; rings translucent; unlit face clearly dimmer than the lit face |
| 3 Sun | Granulation; bloom halo; lens flare and god rays; stars dimmed; no dark ring between the limb and the corona |
| 3b Sun behind Earth | No flare and no rays while the disc is hidden; an atmospheric rim glow is fine |
| 4 Overview | Orbits visible; Milky Way present; frame not blown out (label clutter is M2a.3) |
| 0 Mars | Real colour; relief at the terminator; faint limb |

Re-run the Earth pixel guard. If tone mapping moved the night or day patch values past a threshold:
- adjust only those two thresholds;
- record the old and new numbers;
- keep `max > 40` and the star check unchanged.

- [ ] **Step 4: Run everything**

Run: `npm test`, `npm run typecheck`, `npx playwright test --reporter=line`
Expected: all PASS.

Copy the final golden PNGs to `Space_visualizer/Assets/m2a2-golden/`.

- [ ] **Step 5: Write `Space_visualizer/Decisions/0007-tone-mapping-and-exposure.md`**

Follow the format of the existing decisions: context, options, decision, consequences, and links back to [[Home]] and the M2 spec. Record:
- the operator chosen and why, from the Step 2 comparison;
- scene-driven exposure instead of luminance metering, and why (the plan's scope ruling);
- Neutral tone mapping when Camera effects is off;
- the final look constants (the table, with start and final values).

- [ ] **Step 6: Commit**

```powershell
git add src e2e Space_visualizer
git commit -m "feat(render): choose the filmic tone mapper and tune the cinematic look against the golden-view checklist" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Performance probe on the real GPU, and documentation

**Files:**
- Create: `playwright.perf.config.ts`, `e2e-perf/perf.spec.ts`, `Space_visualizer/Architecture/render.md`
- Modify:
  - `package.json`: the `perf` script;
  - `tsconfig.json`: include `e2e-perf` and `playwright.perf.config.ts`;
  - `README.md` and `docs/SETUP.md`;
  - the vault: `Space_visualizer/Architecture/scene.md` (link to render.md), `Space_visualizer/Changelog.md`, `Space_visualizer/Home.md`, `Space_visualizer/Plans/2026-10-05-m2a1-carry-over.md` (mark items done).

**Interfaces:**
- Produces:
  - `npm run perf` runs Chromium on the real GPU (no SwiftShader).
  - For each forced preset, it measures frame times over 5 s on the Earth golden view at 1600×900: median, 95th percentile, frame count and the GPU renderer string.
  - In Auto mode, it records `data-quality` every 500 ms for 20 s.
  - Results go to `test-results/perf/perf.json` and the console.

- [ ] **Step 1: Create the perf config and spec**

`playwright.perf.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

/** Real-GPU frame-time probe (spec §7). Not part of `npx playwright test`. */
export default defineConfig({
  testDir: 'e2e-perf',
  timeout: 180_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1600, height: 900 } },
  projects: [
    {
      name: 'gpu',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 }, launchOptions: { args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] } },
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

`e2e-perf/perf.spec.ts`:
```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const VIEW = '/?jd=2461317.5&pause=1&target=earth&dist=36000&azSun=90&el=12&fx=1';
const results: Record<string, unknown> = {};

async function gpuName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
  });
}

async function frameTimes(page: Page, ms: number) {
  return page.evaluate(async (duration) => {
    const times: number[] = [];
    let last = performance.now();
    const end = last + duration;
    await new Promise<void>((resolve) => {
      const tick = (t: number) => {
        times.push(t - last);
        last = t;
        if (t < end) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    times.sort((a, b) => a - b);
    return { medianMs: times[times.length >> 1]!, p95Ms: times[Math.floor(times.length * 0.95)]!, frames: times.length };
  }, ms);
}

for (const q of ['high', 'medium', 'low'] as const) {
  test(`frame time at ${q}`, async ({ page }) => {
    await page.goto(`${VIEW}&quality=${q}`);
    await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 60_000 });
    await page.waitForTimeout(3000);
    const gpu = await gpuName(page);
    const r = await frameTimes(page, 5000);
    results[q] = { gpu, ...r };
    console.log(`perf ${q}: ${JSON.stringify(results[q])}`);
    test.info().annotations.push({ type: 'gpu', description: gpu });
  });
}

test('Auto settles without oscillating', async ({ page }) => {
  await page.goto(`${VIEW}&quality=auto`);
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 60_000 });
  const levels: string[] = [];
  for (let i = 0; i < 40; i++) {
    levels.push((await page.locator('.scene').getAttribute('data-quality')) ?? '?');
    await page.waitForTimeout(500);
  }
  const changes = levels.filter((l, i) => i > 0 && l !== levels[i - 1]).length;
  results.auto = { levels, changes };
  console.log(`perf auto: ${levels.join(' ')}`);
  const oscillates = levels.some((l, i) => i >= 2 && l === levels[i - 2] && l !== levels[i - 1]);
  expect(oscillates).toBe(false);
});

test.afterAll(() => {
  mkdirSync('test-results/perf', { recursive: true });
  writeFileSync('test-results/perf/perf.json', JSON.stringify(results, null, 2));
});
```

Add `"perf": "playwright test -c playwright.perf.config.ts"` to `package.json` scripts, and add `"e2e-perf"` and `"playwright.perf.config.ts"` to `include` in `tsconfig.json`.

- [ ] **Step 2: Run the probe and record the numbers**

Run: `npm run perf`
Expected:
- the GPU renderer string names the real GPU, not "SwiftShader";
- the three preset measurements print;
- Auto does not oscillate.

If the renderer reports SwiftShader, set `headless: false` in the project's `use`, run again, and note this in the report.

Record the table (GPU, median and p95 per preset, Auto sequence) in `Space_visualizer/Architecture/render.md` under **Performance (development machine)**. Spec §1 targets:
- High under 16.7 ms median on a desktop GPU;
- Medium under 16.7 ms on a mid-range laptop.

If High misses the target here, find the most expensive pass by disabling passes one at a time with `?fx=0` versus `fx=1`, and through `activePasses`. Report the findings; don't change presets beyond the spec table without a ledgered ruling.

- [ ] **Step 3: Documentation**

**`README.md`:** add a **Quality and camera effects** section covering:
- the Quality control and the **Q** key (Auto, High, Medium, Low);
- the Camera effects toggle and the **E** key;
- the `?quality=` and `?fx=0|1` URL parameters;
- `npm run perf`.

**`docs/SETUP.md`:**
- HD tiers are only requested when their files exist when the dev server or build starts, so restart `npm run dev` after `npm run textures:hd`;
- the perf probe needs a real GPU;
- troubleshooting: "very slow in a VM or remote desktop" means Auto will drop to Low, and you can force it with `?quality=low`.

**Vault:**
- **`Architecture/render.md` (new):**
  - the `src/render/` modules;
  - the quality model and the Auto rules;
  - the pass order and toggle rules;
  - scene-driven exposure, and Sun occlusion from core;
  - the god-ray proxy;
  - the data attributes;
  - the performance table.
- **`Architecture/scene.md`:** link to [[render]] and remove the old single-bloom note.
- **`Changelog.md`:** an M2a.2 entry.
- **`Home.md`:** add render under Architecture, decision 0007 under Decisions, and the M2a.2 plan under Plans (status complete when done).
- **`Plans/2026-10-05-m2a1-carry-over.md`:**
  - mark these done: the three "Must do at the start of M2a.2" items; tone mapping; "stars dimmed / flare / god rays / equinox Saturn"; the look-tuning items addressed in Task 9;
  - leave the rest open for M2a.3 and later.

- [ ] **Step 4: Final verification and commit**

Run: `npm test`, `npm run typecheck`, `npx playwright test --reporter=line`
Expected: all PASS.

```powershell
git add -A playwright.perf.config.ts e2e-perf package.json tsconfig.json README.md docs Space_visualizer
git commit -m "docs: M2a.2 render architecture, decisions, performance probe and carry-over status" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

