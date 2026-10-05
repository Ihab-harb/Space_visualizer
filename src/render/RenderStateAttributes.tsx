import { useEffect } from 'react';
import { useRenderStore } from '../state/renderStore';
import { useSelectionStore } from '../state/selectionStore';
import { activePasses } from './quality';

/** Exposes render state on the scene element for tests and debugging. */
export function RenderStateAttributes({ target }: { target: React.RefObject<HTMLDivElement | null> }) {
  const level = useRenderStore((s) => s.level);
  const mode = useRenderStore((s) => s.mode);
  const effects = useRenderStore((s) => s.effects);
  const selectedId = useSelectionStore((s) => s.selectedId);
  useEffect(() => {
    target.current?.setAttribute('data-quality', level);
    target.current?.setAttribute('data-quality-mode', mode);
    target.current?.setAttribute('data-fx', activePasses(level, effects, selectedId !== null).join(','));
  }, [level, mode, effects, selectedId, target]);
  return null;
}
