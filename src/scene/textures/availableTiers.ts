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
