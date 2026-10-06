import { useFrame } from '@react-three/fiber';
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, EffectGroup, GodRays, LensFlareEffect, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { EffectPass } from 'postprocessing';
import { useEffect, useMemo, useRef, type JSX } from 'react';
import type { DepthOfFieldEffect, EffectComposer as EffectComposerImpl, GodRaysEffect } from 'postprocessing';
import { Color, Mesh, MeshBasicMaterial, SphereGeometry, Vector2, Vector3 } from 'three';
import type { Body } from '../core/catalog/schema';
import { sub } from '../core/math/vec3';
import { useFrameState } from '../scene/FrameStateContext';
import { useRenderStore } from '../state/renderStore';
import { useSelectionStore } from '../state/selectionStore';
import { DOF_BOKEH, dofSettings, focusPoint, patchCocForLogDepth } from './dof';
import { AnamorphicStreakEffect } from './effects/AnamorphicStreakEffect';
import { ExposureEffect } from './effects/ExposureEffect';
import { segmentByAttributes } from './passSegments';
import { activePasses, PRESETS, type PassId } from './quality';
import { useSunFx } from './sunFx';

/** Filmic operator, chosen over ACES on the golden views (Decision 0007). */
export const FILMIC_TONE_MAPPING = ToneMappingMode.AGX;

// Look constants tuned in M2a.2 Task 9 (illustrative; Decision 0007 records start and final values).
/**
 * Anamorphic streaks. threshold and maxExcess are HDR units before exposure and tone mapping; the threshold sits above the
 * Earth limb so only the Sun streaks. Gap-free taps every 2 px (bilinear pairs) reach reachPx: 30 taps a side at High,
 * 18 at Medium (61 and 37 fetches per pixel, one row, so cache-friendly; Low has no streaks).
 */
export const STREAKS = {
  threshold: 3,
  maxExcess: 2,
  full: { strength: 3, reachPx: 60, falloffPx: 20 },
  light: { strength: 1.8, reachPx: 36, falloffPx: 12 },
} as const;
/** Lens flare. colorGain also scales the library's broad ghost terms, which veil the whole frame (magenta) when high. */
export const FLARE = { glareSize: 0.08, colorGain: [3, 2.7, 2.1] as const } as const;
export const GOD_RAYS = { weight: 0.3, exposure: 0.35 } as const;
export const BLOOM_INTENSITY = { effects: 1.1, plain: 0.6 } as const;

const cocStatus = new WeakMap<object, string>();

export function EffectsStack({ bodies }: { bodies: readonly Body[] }) {
  const frame = useFrameState();
  const level = useRenderStore((s) => s.level);
  const effects = useRenderStore((s) => s.effects);
  const hasFocus = useSelectionStore((s) => s.selectedId !== null);
  const preset = PRESETS[level];
  const passes = activePasses(level, effects, hasFocus);

  const sun = bodies.find((b) => b.category === 'star');
  // Proxy sphere for the god rays; deliberately not in the scene graph (useSunFx places it camera-relative each frame).
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
        glareSize: FLARE.glareSize,
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
        colorGain: new Color(...FLARE.colorGain),
        opacity: 1, // library semantics: 1 hides the flare; useSunFx drives it from the Sun's weight
      }),
    [],
  );
  useEffect(() => () => flare.dispose(), [flare]);
  const godRays = useRef<GodRaysEffect | null>(null);
  useSunFx({ sun, bodies, proxy, flare, godRays });

  const streaks = useMemo(
    () => new AnamorphicStreakEffect({ threshold: STREAKS.threshold, maxExcess: STREAKS.maxExcess, ...(preset.detailFx === 'full' ? STREAKS.full : STREAKS.light) }),
    [preset.detailFx],
  );
  useEffect(() => () => streaks.dispose(), [streaks]);
  const dof = useRef<DepthOfFieldEffect | null>(null);
  const dofTarget = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const id = useSelectionStore.getState().selectedId;
    const effect = dof.current;
    if (!effect) return;
    const mat = effect.cocMaterial;
    if (cocStatus.get(mat) !== 'failed') cocStatus.set(mat, patchCocForLogDepth(mat));
    if (!id || preset.detailFx === 'off') return;
    const pos = frame.bodyPositionsKm.get(id);
    const r = frame.bodyRenderRadiusKm.get(id);
    if (!pos || !r) return;
    const p = focusPoint(sub(pos, frame.cameraPositionKm), r);
    dofTarget.set(p[0], p[1], p[2]);
    effect.target = dofTarget;
    const s = dofSettings(Math.hypot(p[0], p[1], p[2]), preset.detailFx, r);
    effect.cocMaterial.focusRange = s.focusRange;
    effect.bokehScale = s.bokehScale;
  });

  const exposure = useMemo(() => new ExposureEffect(1), []);
  useEffect(() => () => exposure.dispose(), [exposure]);
  useFrame(() => {
    exposure.exposure = effects ? frame.fx.exposure : 1;
  });
  const caOffset = useMemo(() => (preset.detailFx === 'full' ? new Vector2(0.0012, 0.0012) : new Vector2(0.0007, 0.0007)), [preset.detailFx]);

  const composerRef = useRef<EffectComposerImpl>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // EffectPass.effects is private in the typings only; read it for e2e assembly checks.
    window.__svPasses = () => (composerRef.current?.passes ?? []).filter((p): p is EffectPass => p instanceof EffectPass).map((p) => (p as unknown as { effects: Array<{ name: string }> }).effects.map((e) => e.name));
    return () => {
      delete window.__svPasses;
    };
  }, []);

  // HDR stage (merged into passes by the composer) ends with tone mapping. The display stage is its own EffectPass:
  // chromatic aberration samples the raw input buffer for R and B, so it must not share a pass with exposure or tone mapping.
  const element = (pass: PassId): JSX.Element => {
    switch (pass) {
      case 'bloom':
        return <Bloom key="bloom" mipmapBlur levels={preset.bloomLevels} luminanceThreshold={1} intensity={effects ? BLOOM_INTENSITY.effects : BLOOM_INTENSITY.plain} />;
      case 'rays':
        return <GodRays key="rays" ref={godRays} sun={proxy} samples={preset.detailFx === 'full' ? 60 : 40} density={0.96} decay={0.93} weight={GOD_RAYS.weight} exposure={GOD_RAYS.exposure} clampMax={1} blur />;
      case 'flare':
        return <primitive key="flare" object={flare} />;
      case 'streaks':
        return <primitive key="streaks" object={streaks} />;
      case 'dof':
        return <DepthOfField key="dof" ref={dof} bokehScale={preset.detailFx === 'full' ? DOF_BOKEH.full : DOF_BOKEH.light} />;
      case 'exposure':
        return <primitive key="exposure" object={exposure} />;
      case 'tonemap':
        return <ToneMapping key={`tonemap-${effects}`} mode={effects ? FILMIC_TONE_MAPPING : ToneMappingMode.NEUTRAL} />;
      case 'chromatic':
        return <ChromaticAberration key="chromatic" offset={caOffset} radialModulation modulationOffset={0.35} />;
      case 'vignette':
        return <Vignette key="vignette" offset={0.3} darkness={0.55} />;
      case 'grain':
        return <Noise key="grain" premultiply opacity={preset.detailFx === 'full' ? 0.035 : 0.02} />;
    }
  };
  const isDisplay = (p: PassId) => p === 'chromatic' || p === 'vignette' || p === 'grain';
  const display = passes.filter(isDisplay);
  // Each HDR segment is one EffectPass (merged effects are re-sorted by attributes; see passSegments.ts), so the
  // composer's assembly equals the spec order and no pass ever holds two convolution effects.
  const children: JSX.Element[] = segmentByAttributes(passes.filter((p) => !isDisplay(p))).map((segment) => (
    <EffectGroup key={`hdr-${segment.join('+')}`}>{segment.map(element)}</EffectGroup>
  ));
  if (display.length) children.push(<EffectGroup key="display">{display.map(element)}</EffectGroup>);
  // autoClear stays at its default despite GodRays' console warning: with autoClear={false} the kept depth hides the ray
  // proxy (inside the drawn Sun) behind the Sun's own mesh, so the rays lose their glow, and a square artifact appears around
  // the Sun. Occlusion by bodies comes from float64 sunVisibilityFromObserver instead (Task 9 fix round, item 5).
  return <EffectComposer key={passes.join(',')} ref={composerRef} multisampling={level === 'low' ? 0 : 4}>{children}</EffectComposer>;
}
