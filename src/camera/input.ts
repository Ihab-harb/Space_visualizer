import { NO_INPUT, type InputDeltas } from './types';

const LINE_PX = 16;
const PAGE_PX = 400;

export function wheelToZoom(deltaY: number, deltaMode: number): number {
  return deltaY * (deltaMode === 1 ? LINE_PX : deltaMode === 2 ? PAGE_PX : 1);
}

/** Fingers moving apart (current > previous) zoom in (negative zoom). */
export function pinchToZoom(previousDistancePx: number, currentDistancePx: number): number {
  return (previousDistancePx - currentDistancePx) * 4;
}

export function createPointerInput() {
  let acc: InputDeltas = { ...NO_INPUT };
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDistance: number | null = null;
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;
  };

  const onPointerDown = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinchDistance = spread();
  };
  const onPointerMove = (e: PointerEvent) => {
    const previous = pointers.get(e.pointerId);
    if (!previous) return;
    const dx = e.clientX - previous.x;
    const dy = e.clientY - previous.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      if (e.buttons & 2 || e.shiftKey) {
        acc.panX += dx;
        acc.panY += dy;
      } else {
        acc.rotateX += dx;
        acc.rotateY += dy;
      }
    } else if (pointers.size === 2) {
      const current = spread();
      if (current !== null && pinchDistance !== null) acc.zoom += pinchToZoom(pinchDistance, current);
      pinchDistance = current;
    }
  };
  const onPointerUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinchDistance = spread();
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    acc.zoom += wheelToZoom(e.deltaY, e.deltaMode);
  };
  const onContextMenu = (e: Event) => e.preventDefault();

  return {
    attach(el: HTMLElement): () => void {
      el.addEventListener('pointerdown', onPointerDown);
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
      el.addEventListener('pointercancel', onPointerUp);
      el.addEventListener('wheel', onWheel, { passive: false });
      el.addEventListener('contextmenu', onContextMenu);
      return () => {
        el.removeEventListener('pointerdown', onPointerDown);
        el.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerup', onPointerUp);
        el.removeEventListener('pointercancel', onPointerUp);
        el.removeEventListener('wheel', onWheel);
        el.removeEventListener('contextmenu', onContextMenu);
      };
    },
    consume(): InputDeltas {
      const out = acc;
      acc = { ...NO_INPUT };
      return out;
    },
  };
}
