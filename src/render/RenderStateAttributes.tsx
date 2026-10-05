import { useEffect } from 'react';
import { useRenderStore } from '../state/renderStore';

/** Exposes render state on the scene element for tests and debugging. */
export function RenderStateAttributes({ target }: { target: React.RefObject<HTMLDivElement | null> }) {
  const level = useRenderStore((s) => s.level);
  const mode = useRenderStore((s) => s.mode);
  useEffect(() => {
    target.current?.setAttribute('data-quality', level);
    target.current?.setAttribute('data-quality-mode', mode);
  }, [level, mode, target]);
  return null;
}
