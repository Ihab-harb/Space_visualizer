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
