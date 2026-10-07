---
title: camera
tags: [architecture]
---

# camera (`src/camera`)

Back to [[Home]] · [[Overview]]

- **Controllers** each provide `enter`, `update(input, ctx) → CameraPose`, plus view-specific actions. `CameraSystem` owns one of each and switches between them with a transition.
- **Orbit:** rotate, zoom and pan around a pivot body. Clicking a body only selects it; double-clicking (or "Centre view") moves the pivot to it.
- **Follow:** selecting a body flies to it (4 radii away) and tracks it. "Rotate with body" measures the camera offset in the body-fixed frame, so the surface stays still under the camera.
- **Screen up:** ecliptic north, except co-rotating Follow, where it is the body's pole, so the body stays upright instead of rocking by its axial tilt. Transitions blend `up` too.
- **Leaving Follow:** Orbit view takes the followed body as its pivot.
- **Transitions:** 1.6 s, with distance to the destination interpolated logarithmically; instant when the system's reduced-motion setting is on.
- **Safety:** the camera never comes closer than 1.2 radii to the body it looks at; elevation is clamped to ±89.9°; `lookRotation` handles looking straight along the up axis.
- **Input:** drag on the canvas to rotate, right-drag or Shift-drag to pan, wheel (anywhere over the scene, including labels) or pinch to zoom; drags longer than 4 px don't count as clicks.

## Tour (`src/camera/tour.ts`, spec §5)
Started by **T** or the bottom bar's Tour button; `tourStore` holds `active` and a `seq` that restarts it.
- **Stops (`buildTour`):** the Sun (10 radii away), the planets in order of semi-major axis (6 radii away), then the overview (2.2 × 10⁹ km, 30° elevation, nothing selected).
- **Phases (`tourPhase`):** each stop is a 5 s flight followed by a 7 s dwell. Flights reuse the transition's easing with distance interpolated in log space. During a dwell the camera orbits the body at 4°/s at 14° elevation, on the lit side (azimuth toward the Sun plus 35° so the terminator shows).
- **Selection:** each stop selects its body, so the header and drawer follow the tour; the overview deselects.
- **Time:** the tour never changes or pauses time.
- **Exit:** any user input stops it: any key except a bare modifier or an auto-repeat (`useHotkeys`), pointer, wheel and touch (`useTourExit`), or the Tour button / **T**, which toggle. Finishing the last stop also stops it. On exit control returns to Orbit around the current stop, from the camera's present pose, so there is no jump.
- **Reduced motion:** flights become cuts. The dwell rotation continues (a known gap, listed in the carry-over note).
- **Implementation:** a `tour` block in `CameraSystem` runs before the controllers; `tour.test.ts` covers stops, phases and poses.
