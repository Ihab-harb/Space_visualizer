import { useEffect } from 'react';
import { useTourStore } from '../state/tourStore';

/** Spec section 5: any user input exits the tour. Keys are handled by useHotkeys; the Tour button toggles instead. */
export function useTourExit(): void {
  useEffect(() => {
    const stop = (e: Event) => {
      if (!useTourStore.getState().active) return;
      if (e.target instanceof Element && e.target.closest('[data-tour-toggle]')) return;
      useTourStore.getState().stop();
    };
    const opts = { capture: true, passive: true } as const;
    window.addEventListener('pointerdown', stop, opts);
    window.addEventListener('wheel', stop, opts);
    window.addEventListener('touchstart', stop, opts);
    return () => {
      window.removeEventListener('pointerdown', stop, opts);
      window.removeEventListener('wheel', stop, opts);
      window.removeEventListener('touchstart', stop, opts);
    };
  }, []);
}
