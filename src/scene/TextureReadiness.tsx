import { useEffect, useSyncExternalStore } from 'react';
import { pendingTextures, subscribePending } from './textures/useTieredTexture';

/** Marks the scene element with data-textures-ready="true" when no texture loads are pending (used by golden views). */
export function TextureReadiness({ target }: { target: React.RefObject<HTMLDivElement | null> }) {
  const pending = useSyncExternalStore(subscribePending, pendingTextures);
  useEffect(() => {
    const t = setTimeout(() => target.current?.setAttribute('data-textures-ready', pending === 0 ? 'true' : 'false'), 300);
    return () => clearTimeout(t);
  }, [pending, target]);
  return null;
}
