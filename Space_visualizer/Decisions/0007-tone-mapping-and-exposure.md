---
title: 0007 Tone mapping and exposure
tags: [decision]
---

# 0007 Tone mapping and exposure

Back to [[Home]] · Spec: [[2026-10-04-m2-cinematic-and-rich-bodies-design]] · Plan: [[2026-10-05-m2a2-cinematic-effects-and-quality]] · Date: 2026-10-06 · Status: accepted

## Context
M2a.2 renders the scene in HDR and runs a post-processing stack: bloom, god rays and lens flare, anamorphic streaks, depth of field, exposure, tone mapping, then chromatic aberration, vignette and grain. The stack needs:
- a filmic operator that maps HDR to the display;
- an exposure rule for the moment the Sun enters the frame.

The look constants were tuned against the spec §7 golden-view checklist, using the nine golden views in `e2e/golden.spec.ts`. Every view is forced to `quality=high&fx=1`, rendered by Chromium with SwiftShader.

## Options
1. **AgX** (postprocessing `ToneMappingMode.AGX`).
2. **ACES Filmic** (`ToneMappingMode.ACES_FILMIC`).

Both were rendered with the same scene and the look constants as they stood before the review fix round. The fix round changed only depth of field, the streak kernel and cloud-shadow darkness, none of which touch these patches' hue or low end. The measurements are 10×10 px means on the golden screenshots, in sRGB 0–255:

| Check | AgX | ACES |
|---|---|---|
| Earth day-side hue (three patches) | 213–216° | 215–219° |
| Mars ochre hue / saturation (three patches) | 7–14° / 0.27–0.40 | 6–12° / 0.36–0.53 |
| Earth blue limb (luminance) | 21.7, blue (hue 218°) | 10.3 |
| Earth night side (near terminator / deep) | 6.1 / 1.4, blue-black | 2.6 / 0.1, black |
| Earth guard patches (night / day) | 6.0 / 100.5 | 2.5 / 86.9 |
| Night-side continents in 3b (fill only) | 46 | 27 |
| Overview sky (Milky Way / dark sky) | 9.8 / 2.6 | 4.2 / 1.1 |
| Sun halo 70 px below the disc (saturation) | 0.51 | 0.65, pushed to yellow-orange |

## Decision
**AgX is the filmic operator.** `FILMIC_TONE_MAPPING = ToneMappingMode.AGX` in `src/render/EffectsStack.tsx`.
- **Colour fidelity:** both keep the hue of the official maps within about 5°. ACES adds saturation: Mars ochre goes from 0.40 to 0.53. AgX stays closer to the source imagery.
- **Highlight roll-off:** AgX rolls the Sun's halo and the Earth limb off toward white. ACES pushes the halo to saturated yellow-orange.
- **Night sides and faint light:** ACES crushes the low end. The Earth's limb glow halves (21.7 to 10.3), the fill on night sides drops from 46 to 27, and the Milky Way from 9.8 to 4.2. AgX keeps them visible, and night sides still read as deep blue-black.

**Exposure is scene-driven, not metered** (a plan scope ruling). The exposure dip and the star dimming follow from two things:
- the Sun's visibility from the camera, computed in float64 with occlusion by bodies (`sunVisibilityFromObserver`);
- the Sun's position in the frame and its angular size (`src/render/exposure.ts`).

The reasons:
- it is deterministic, so the golden views and e2e tests are stable;
- it needs no luminance read-back or mip reduction;
- it does not pump on bright planets.

The exposure target changes in the same frame the Sun is hidden, for example behind Earth in golden 3b. Exposure and star dimming then ease toward that target (`EXPOSURE.damping` = 4 per second, a 0.25 s time constant), so a cut does not flash. The lens-flare and god-ray opacities follow visibility in the same frame, without damping.

**Camera effects off uses Neutral tone mapping.** The toggle keeps only bloom (at reduced strength) and the Neutral operator, and turns off the cinematic fill. Exposure stays at 1. The scene then shows the shading without any cinematic grade.

**Golden 3-sun waiver.** In the close-up `3-sun` (Sun about 18° across), the lens flare and god rays read only as halo: the flare ghosts line up on the centred disc, and the rays fall to their close-up opacity floor. The checklist item "lens flare and god rays" is waived for that view. The view where they must read is `3c-sun-far` (Sun at 4e7 km), which shows the flare starburst, the warm god-ray glow and the horizontal streak.

**The composer keeps `autoClear` at its default.** The GodRays wrapper warns about this on every run. With `autoClear={false}`, the kept depth buffer hides the ray proxy (0.98 of the drawn Sun's radius) behind the Sun's own mesh. The rays then lose their glow (overview, 60 px from the Sun: 55.6 → 44.4), and a square artifact appears around the Sun. Golden 3b was identical with either setting (max difference 2.6 grey levels), because occlusion by bodies comes from the float64 visibility, not the ray depth mask.

## Final look constants
All illustrative, with no data meaning.
- **Was:** the value before Task 9.
- **Start:** the value Task 9 started from, labelled **(brief)** for the Task 9 brief or **(prev)** for the first Task 9 implementer's uncommitted work.
- **Final:** includes the review fix round.

| Constant | Was | Start | Final | Why |
|---|---|---|---|---|
| `FILMIC_TONE_MAPPING` | AgX | AgX (brief) | AgX | Comparison above |
| `CINEMATIC_FILL` | 1 | 0.6 (brief); 0.4 (prev) | 0.4 | Night sides deep blue-black (Earth night patch 6.0); continents still readable in 3b |
| `RING_UNLIT_SCALE` | 1 (implicit) | 0.5 (brief) | 0.3 | Unlit/lit face ratio 0.45–0.5 (view 2) and about 0.62 (2b); at 0.5 it was about 0.6 and 0.83 |
| `GLINT_STRENGTH` | 0.06 | 0.035 (brief) | 0.035 | Glint no longer a hot spot |
| `GLINT_ROUGHNESS` | 0.35 | 0.45 (brief) | 0.45 | — |
| `CLOUD_SHADOW_OFFSET` | 0.0025, same in u and v | 0.004 (brief) | 0.004 | In v units. The u term is halved (u spans 360°, v 180°) and divided by cos(latitude) |
| `CLOUD_SHADOW_DARKNESS` | 0.45 (literal) | 0.45 | 0.8 | Thick cloud blocks most direct sunlight. It reads over land. Over the ocean in golden 1 it cannot: see Consequences |
| `CORONA_GAIN` | 1.6 | 0.9 (brief) | 0.9 | No dark ring between limb and corona |
| `GRAN_AMP` | 0.11 | 0.18 (prev) | 0.26 | Granulation was still lost on the AgX shoulder at 0.18 |
| `EXPOSURE.maxDip` | 0.4 | 0.5 (prev) | 0.6 | Sun close-up off the AgX shoulder, so the granulation reads |
| `EXPOSURE.skyDimAtFull` | 0.25 | 0.4 (prev) | 0.4 | `skyDim` does not scale with Sun size, so a deeper dim would also erase the overview's Milky Way |
| `EXPOSURE.minDip`, `rayCloseUpOpacity`, `fullSizeRad`, `damping` | 0.15, 0.3, 5°, 4 | same | same | — |
| `FLARE.glareSize` | 0.12 | 0.08 (prev) | 0.08 | Tighter glare on the disc |
| `FLARE.colorGain` | (14, 12, 10) | (6, 5.3, 4.3) (prev) | (3, 2.7, 2.1) | The library's broad ghost terms scale with this gain and laid a magenta veil over the whole frame. Overview sky (Milky Way / dark sky) went from 17 / 7.5 to 9.8 / 2.6, Milky Way contrast about 3.8:1 (3.5:1 in M2a.1); the starburst stays |
| `GOD_RAYS.weight` / `exposure` | 0.35 / 0.5 | 0.3 / 0.35 (prev) | 0.3 / 0.35 | Overview glow 60 px from the Sun: 62 at the old values, 56 now; keeps the inner orbits and labels clear |
| `BLOOM_INTENSITY` (effects / plain) | 1.1 / 0.6 | same | 1.1 / 0.6 | Named only, not changed |
| `STREAKS.threshold` | 0.8 | 3 (prev) | 3 | Measured HDR peaks: the Earth limb ≤ 2.0, the close-up Sun disc just over 3. The threshold keeps a 50% margin over the limb; at 2.4 the streak washed a white band across the close-up disc |
| `STREAKS.maxExcess` | — | — | 2 | Caps any one tap's excess, so a single extreme pixel cannot dominate the average |
| `STREAKS.full` strength / reachPx / falloffPx | 1.6 / ±144 px, taps 12 px apart | 3.5 / ±192 px, taps 16 px apart (prev) | 3 / 60 / 20 | Gap-free kernel (below) out to ±60 px; a faint smooth line when the Sun is small (3c, overview) |
| `STREAKS.light` strength / reachPx / falloffPx | 1.0 / as above | 2 (prev) | 1.8 / 36 / 12 | Medium: a shorter, lighter kernel (37 fetches per pixel) |
| Earth atmosphere `intensity` | 1.0 | 0.45 (prev) | 0.45 | At 1.0 the limb crossed the streak threshold and was streaked across the disc; at 0.45 the limb stays blue (hue 218°), not white |
| `DOF_RADIUS_RANGE` | — (0) | 2 (prev) | 2 | Focus range plus 2 body radii, so a large body's far side and rings fall inside the focus range |
| `DOF_FOCUS_PLATEAU` | — (0) | — | 0.25 | In-focus plateau: CoC = smoothstep(0.25·range, range, \|Δ\|) |
| `DOF_BOKEH` (full / light) | 2 / 1 | — | 1 / 0.6 | Mild depth of field (spec §5): stars are no longer 6–10 px bokeh discs |

**Streak kernel.** Each tap sits between two texels, where bilinear filtering (the composer's buffers use LinearFilter) averages the pair. Taps 2 px apart therefore cover every texel out to `reachPx`: 30 taps a side at High, 18 at Medium (61 and 37 fetches per pixel, all in one row). A highlight thinner than the step can no longer be skipped and repeated as separate copies, so the earlier per-pixel jitter was removed. The excess is taken from the brightest channel, so a warm highlight still gives a blue-white streak, and NaN reads as 0. On SwiftShader, a 60 px reach costs about 10% more golden time than 24 px (3-sun 23.6 s vs 21.6 s).

**Depth of field.** The plateau and the milder bokeh sharpen golden 2 (local contrast: far ring 5.14 → 6.40, near ring 5.33 → 6.74, globe unchanged at 4.94). They also shrink the stars' bokeh (Earth guard: bright sky pixels 191 → 143–144).

## Consequences
- **Earth guard thresholds are unchanged:** night < 35, day > night + 40, max > 40, stars ≥ 30 and under 25%, sharpness ≥ 0.7. Measured values: night 10.4 → 6.0, day 120 → 100.5, stars 191 → 143–144, sharpness 0.89 → 0.996–0.998 (two runs).
- **Cloud shadows over the ocean:** in golden 1 the day side is almost all ocean. Its ground diffuse (albedo about 0.05) is small next to the atmosphere's in-scatter. Forcing a full 80% shadow everywhere changes ocean pixels by under 1 grey level and land by up to 29. Offset shadows over the ocean would need the in-scatter of the shadowed air column to be attenuated too. That is a model change, left open.
- **Lens-flare veil:** the full-frame veil comes from the library shader (`@react-three/postprocessing` LensFlareEffect), and its colour gain is the only control. Raising `colorGain` brings the veil back.
- **Streak on a close Sun:** within the ±60 px reach, the close-up's streak stays inside the bloom halo. The streak reads when the Sun is small on screen.
- **Final golden screenshots:** `Assets/m2a2-golden/`.
- **Revisit** the operator when the Exhibit style (M2a.3) needs a different grade.
