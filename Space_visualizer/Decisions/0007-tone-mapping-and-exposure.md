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

The look constants were tuned against the spec §7 golden-view checklist, using the eight golden views in `e2e/golden.spec.ts`. Every view is forced to `quality=high&fx=1`, rendered by Chromium with SwiftShader.

## Options
1. **AgX** (postprocessing `ToneMappingMode.AGX`).
2. **ACES Filmic** (`ToneMappingMode.ACES_FILMIC`).

Both were rendered with the same scene and the final constants below. The measurements are 10×10 px means on the golden screenshots, in sRGB 0–255:

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
- it reacts in the same frame the Sun is hidden, for example behind Earth in golden 3b, without metering lag or pumping on bright planets.

**Camera effects off uses Neutral tone mapping.** The toggle keeps only bloom (at reduced strength) and the Neutral operator, and turns off the cinematic fill. Exposure stays at 1. The scene then shows the shading without any cinematic grade.

## Final look constants
All illustrative, with no data meaning. "Was" is the value before Task 9. "Start" is the value Task 9 started from.

| Constant | Was | Start | Final | Why |
|---|---|---|---|---|
| `FILMIC_TONE_MAPPING` | AgX | AgX | AgX | Comparison above |
| `CINEMATIC_FILL` | 1 | 0.6 | 0.4 | Night sides deep blue-black (Earth night patch 6.0); continents still readable in 3b |
| `RING_UNLIT_SCALE` | 1 (implicit) | 0.5 | 0.3 | Unlit/lit face ratio 0.45–0.5 (view 2) and about 0.62 (2b); at 0.5 it was about 0.6 and 0.83 |
| `GLINT_STRENGTH` | 0.06 | 0.035 | 0.035 | Brief value; glint no longer a hot spot |
| `GLINT_ROUGHNESS` | 0.35 | 0.45 | 0.45 | Brief value |
| `CLOUD_SHADOW_OFFSET` | 0.0025 (no latitude correction) | 0.004 | 0.004 | Brief value, now with 1/cos(latitude) on u |
| `CORONA_GAIN` | 1.6 | 0.9 | 0.9 | Brief value; no dark ring between limb and corona |
| `GRAN_AMP` | 0.11 | 0.18 | 0.26 | Granulation still lost on the AgX shoulder at 0.18 |
| `EXPOSURE.maxDip` | 0.4 | 0.5 | 0.6 | Sun close-up off the AgX shoulder, so the granulation reads |
| `EXPOSURE.skyDimAtFull` | 0.25 | 0.4 | 0.4 | `skyDim` does not scale with Sun size, so a deeper dim would also erase the overview's Milky Way |
| `EXPOSURE.minDip`, `rayCloseUpOpacity`, `fullSizeRad`, `damping` | 0.15, 0.3, 5°, 4 | same | same | — |
| `FLARE.glareSize` | 0.12 | 0.08 | 0.08 | Tighter glare on the disc |
| `FLARE.colorGain` | (14, 12, 10) | (6, 5.3, 4.3) | (3, 2.7, 2.1) | The library's broad ghost terms scale with this gain and laid a magenta veil over the whole frame. In the overview, the sky (Milky Way / dark sky) went from 17 / 7.5 to 9.8 / 2.6, and the Milky Way contrast is back to about 3.8:1 (3.5:1 in M2a.1); the starburst stays |
| `GOD_RAYS.weight` / `exposure` | 0.35 / 0.5 | 0.3 / 0.35 | 0.3 / 0.35 | Glow 60 px from the Sun in the overview: 62 at the old values, 56 now; keeps the inner orbits and labels clear |
| `BLOOM_INTENSITY` (effects / plain) | 1.1 / 0.6 | same | 1.1 / 0.6 | Named only, not changed |
| `STREAKS.threshold` | 0.8 | 3 | 3 | Above the Earth limb, so only the Sun streaks |
| `STREAKS.strengthFull` / `strengthLight` | 1.6 / 1.0 | 3.5 / 2 | 3 / 1.8 | Faint horizontal streak: a thin line in the overview; the close-up halo is about 15% brighter sideways than below |
| `STREAKS.spreadPx` | 12 | 16 | 14 | At 16 the close-up smeared into a wide horizontal blob |
| `STREAKS.maxExcess` | — | — | 2 | New per-tap bound, so a transient HDR spike cannot smear a whole limb across the frame |
| Earth atmosphere `intensity` | 1.0 | 0.45 | 0.45 | At 1.0 the limb crossed the streak threshold and dotted copies of it covered the disc; at 0.45 the limb stays blue (hue 218°), not white |
| `DOF_RADIUS_RANGE` | — (0) | 2 | 2 | Focus range plus 2 body radii, so Saturn's far side and rings stay sharp; the Earth sharpness ratio went from 0.89 to 0.97 |

Shader changes in the streak pass:
- The excess is now taken from the brightest channel, so a warm highlight still gives a blue-white streak.
- Tap positions are jittered per pixel, so taps 14 px apart do not repeat a highlight edge as separate copies.
- The excess is bounded by `maxExcess`, and NaN reads as 0.

## Consequences
- The Earth guard thresholds are unchanged (night < 35, day > night + 40, max > 40, stars ≥ 30 and under 25%, sharpness ≥ 0.7). The measured values moved from night 10.4 / day 120 / sharpness 0.89 to 6.0 / 100.5 / 0.97.
- The lens flare's full-frame veil comes from the library shader (`@react-three/postprocessing` LensFlareEffect), and its colour gain is the only control. Raising `colorGain` again brings the veil back.
- On a close Sun the streak can only widen the halo sideways: the disc is too large for a thin line. A thin line shows when the Sun is small on screen.
- Final golden screenshots: `Assets/m2a2-golden/`.
- Revisit the operator when the Exhibit style (M2a.3) needs a different grade.
