---
title: camera
tags: [architecture]
---

# camera (`src/camera`)

Back to [[Home]] · [[Overview]]

- **Controllers** each provide `enter`, `update(input, ctx) → CameraPose`, plus view-specific actions. `CameraSystem` owns one of each and switches between them with a transition.
- **Orbit:** rotate, zoom and pan around a pivot body. Clicking a body only selects it; double-clicking (or "Centre view") moves the pivot to it.
- **Follow:** selecting a body flies to it (4 radii away) and tracks it. "Rotate with body" measures the camera offset in the body-fixed frame, so the surface stays still under the camera.
- **Transitions:** 1.6 s, with distance to the destination interpolated logarithmically; instant when the system's reduced-motion setting is on.
- **Safety:** the camera never comes closer than 1.2 radii to the body it looks at; elevation is clamped to ±89.9°; `lookRotation` handles looking straight along the up axis.
- **Input:** drag to rotate, right-drag or Shift-drag to pan, wheel or pinch to zoom; drags longer than 4 px don't count as clicks.
