---
title: 0005 WebGL2 with custom shaders
tags: [decision]
---

# 0005 WebGL2 with custom shaders

Back to [[Home]] · Spec: [[2026-10-04-m2-cinematic-and-rich-bodies-design]] · Date: 2026-10-04 · Status: accepted

## Context
M2a.1 needs body shading that three's stock materials cannot give: object-space lighting on flattened ellipsoids, a terminator with Lommel-Seeliger and GGX terms, atmosphere scattering, ring and planet shadows, and eclipses. The renderer already uses a logarithmic depth buffer ([[0003-floating-origin-and-log-depth]]).

## Decision
Stay on WebGL2 and write `ShaderMaterial`s, one per `render.shader` (earth, rocky, giant, venus, sun), built by `createBodyMaterial`. Every shader works in the mesh's object space, with the Sun and camera directions computed on the CPU in float64. Every shader includes three's `logdepthbuf` chunks. We do not use WebGPU/TSL or `onBeforeCompile` patches of stock materials.

## Reasons
- Browser reach: WebGL2 runs everywhere the app is meant to run; WebGPU does not yet.
- The e2e runner uses Chromium with SwiftShader (software WebGL2), so the shaders can be checked in CI, including the golden-view screenshots and a pixel guard on the Earth view.
- Full control of precision and of the lighting model, which patched stock materials would hide behind chunk replacements.

## Consequences
- Shared GLSL lives in `src/scene/materials/chunks.ts`. GLSL strings must be ASCII-only.
- Any shader compile error fails the e2e suite (`Shader Error`, `THREE.WebGLProgram`).
- Revisit when WebGPU runs in the CI browser.
