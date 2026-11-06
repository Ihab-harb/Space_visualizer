import { useEffect, useRef } from 'react';
import type { Catalog } from '../core/catalog/catalog';
import { useExploreOwnsScreen } from '../state/exploreStore';
import { BottomBar } from './BottomBar';
import { ControlPanel } from './ControlPanel';
import { FactsDrawer } from './FactsDrawer';
import { Header } from './Header';

/** Where focus goes when the normal view returns: the Explore button, else the first control that takes focus. */
function restoreFocus(): void {
  const active = document.activeElement;
  // Someone (the user, a test) already put focus somewhere: leave it.
  if (active && active !== document.body) return;
  const candidates = [
    ...document.querySelectorAll<HTMLElement>('[aria-label="Selected body"] [aria-keyshortcuts="X"]'),
    ...document.querySelectorAll<HTMLElement>('[aria-label="Controls"] button'),
  ];
  for (const el of candidates) {
    el.focus();
    if (document.activeElement === el) return; // a display:none control does not take focus
  }
}

/**
 * The normal interface. Explore steps it aside: nothing is rendered while Explore is active, nor while the scene is still
 * closing the body after a leave (spec §3.1: the body closes, then the normal view returns). Focus then returns to the
 * Explore button.
 */
export function AppChrome({ catalog }: { catalog: Catalog }) {
  const hidden = useExploreOwnsScreen();
  const wasHidden = useRef(false);
  useEffect(() => {
    if (hidden) {
      wasHidden.current = true;
      return;
    }
    if (!wasHidden.current) return;
    wasHidden.current = false;
    restoreFocus();
  }, [hidden]);
  if (hidden) return null;
  return (
    <>
      <Header catalog={catalog} />
      <ControlPanel />
      <FactsDrawer catalog={catalog} />
      <BottomBar catalog={catalog} />
    </>
  );
}
