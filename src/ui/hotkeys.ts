import { useEffect } from 'react';
import { useRenderStore } from '../state/renderStore';
import { useTourStore } from '../state/tourStore';
import { useUiStore } from '../state/uiStore';
import { useViewStore } from '../state/viewStore';

export type HotkeyAction = 'orbit' | 'follow' | 'tour' | 'quality' | 'effects' | 'drawer';

/** jsdom does not implement isContentEditable, so the contentEditable property is read too. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable || target.contentEditable === 'true');
}

const KEYS: Record<string, HotkeyAction> = {
  '1': 'orbit', Escape: 'orbit', '2': 'follow', t: 'tour', T: 'tour', q: 'quality', Q: 'quality', e: 'effects', E: 'effects', f: 'drawer', F: 'drawer',
};

/** Spec §4 keyboard. Browser shortcuts (Ctrl/Cmd/Alt) and auto-repeat are never ours. */
export function hotkeyAction(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; repeat: boolean; target: EventTarget | null }): HotkeyAction | null {
  if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return null;
  return KEYS[e.key] ?? null;
}

const MODIFIER_ONLY = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

export function useHotkeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Auto-repeat is never input: holding T must not start the tour and then stop it.
      if (e.repeat) return;
      const action = hotkeyAction(e);
      const tour = useTourStore.getState();
      // Spec §5: any user input exits the tour (T toggles it instead).
      if (tour.active && action !== 'tour' && !MODIFIER_ONLY.has(e.key) && !isTypingTarget(e.target)) tour.stop();
      if (!action) return;
      if (action === 'orbit') useViewStore.getState().setView('orbit');
      else if (action === 'follow') useViewStore.getState().setView('follow');
      else if (action === 'tour') tour.toggle();
      else if (action === 'quality') useRenderStore.getState().cycleMode();
      else if (action === 'effects') useRenderStore.getState().toggleEffects();
      else if (action === 'drawer') useUiStore.getState().toggleDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
