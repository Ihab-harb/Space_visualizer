import { useEffect } from 'react';
import { resolveOverlaps, type LabelBox } from '../scene/labels/labelLayout';

/** Spec §4: labels fade when bodies overlap. Reads label rectangles at 10 Hz and hides the lower-priority ones. */
export function useLabelDeclutter(layer: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const id = window.setInterval(() => {
      const root = layer.current;
      if (!root) return;
      const els = [...root.querySelectorAll<HTMLElement>('.body-label')];
      const boxes: LabelBox[] = els.map((el) => {
        const r = el.getBoundingClientRect();
        return { id: el.dataset.labelId ?? '', left: r.left, top: r.top, width: r.width, height: r.height, priority: Number(el.dataset.priority ?? 0), hidden: el.hidden === true };
      });
      const shown = resolveOverlaps(boxes.filter((b) => b.width > 0));
      for (const el of els) el.classList.toggle('is-hidden', !shown.has(el.dataset.labelId ?? ''));
    }, 100);
    return () => window.clearInterval(id);
  }, [layer]);
}
