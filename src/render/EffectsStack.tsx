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
