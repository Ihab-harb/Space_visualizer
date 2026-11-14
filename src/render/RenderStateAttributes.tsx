import { useEffect } from 'react';
import { useRenderStore } from '../state/renderStore';
import { activePasses } from './quality';

/** Exposes render state on the scene element for tests and debugging. */
export function RenderStateAttributes({ target }: { target: React.RefObject<HTMLDivElement | null> }) {
  const level = useRenderStore((s) => s.level);
  const mode = useRenderStore((s) => s.mode);
  const effects = useRenderStore((s) => s.effects);
  useEffect(() => {
    target.current?.setAttribute('data-quality', level);
    target.current?.setAttribute('data-quality-mode', mode);
    target.current?.setAttribute('data-fx', activePasses(level, effects).join(','));
  }, [level, mode, effects, target]);
  return null;
}
