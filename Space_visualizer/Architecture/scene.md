---
title: scene
tags: [architecture]
---

# scene (`src/scene`)

Back to [[Home]] · [[Overview]]

- **FrameState:** a mutable per-frame cache (positions, validity, orientations, camera position), shared through context and never stored in React state.
- **Scale modes:** `renderRadiusKm` keeps the real radius in true-scale mode. In readable mode it enforces a minimum on-screen size (10 px for the Sun, 5 px for other bodies).
- **Bodies:** ellipsoids with PCK radii, oriented by the IAU rotation models (sphere geometry rotated so its poles lie on +Z). Colours are illustrative.
- **Orbit lines:** rebuilt every frame relative to the camera, so they stay precise next to the planet.
- **Light:** the Sun is the only real light (point light, decay 0), plus a 3.5 % ambient fill and bloom.
- **Labels:** drei `<Html>` rendered into a fixed `.label-layer` portal (`LabelLayerContext`). `BodyMesh` positions at priority −0.5 so labels never project from the camera's own position (which would cache `NaN`).
- **SceneRoot:** `div.scene` (an isolated stacking context, so the panels stay above the labels) containing the Canvas and the label layer.
