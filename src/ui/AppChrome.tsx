import { useEffect, useRef, useState } from 'react';
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

/** How long the interface takes to fade out on entering Explore and back in after it (matches the CSS animation). */
export const CHROME_FADE_MS = 200;

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

type Phase = 'shown' | 'leaving' | 'gone' | 'entering';

/**
 * The normal interface. Explore steps it aside (spec §3.2): it fades out (inert while it fades) and is then removed, and it
 * stays away while Explore is active and while the scene is still closing the body after a leave (spec §3.1: the body
 * closes, then the normal view returns). It then fades back in and focus returns to the Explore button. Under reduced motion
 * it goes and comes back at once.
 */
export function AppChrome({ catalog }: { catalog: Catalog }) {
  const hidden = useExploreOwnsScreen();
  const wasHidden = useRef(false);
  const [phase, setPhase] = useState<Phase>(hidden ? 'gone' : 'shown');
  const [prevHidden, setPrevHidden] = useState(hidden);
  if (hidden !== prevHidden) {
    // Adjusted while rendering, so the first frame after the change already fades (no frame without the interface).
    setPrevHidden(hidden);
    setPhase(hidden ? (prefersReducedMotion() ? 'gone' : 'leaving') : prefersReducedMotion() ? 'shown' : 'entering');
  }
  useEffect(() => {
    if (phase !== 'leaving' && phase !== 'entering') return;
    const timer = window.setTimeout(() => setPhase(phase === 'leaving' ? 'gone' : 'shown'), CHROME_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (hidden) {
      wasHidden.current = true;
      return;
    }
    if (!wasHidden.current) return;
    wasHidden.current = false;
    restoreFocus();
  }, [hidden]);
  if (phase === 'gone') return null;
  const leaving = phase === 'leaving';
  return (
    <div className="app-chrome" data-state={phase} inert={leaving} aria-hidden={leaving || undefined}>
      <Header catalog={catalog} />
      <ControlPanel />
      <FactsDrawer catalog={catalog} />
      <BottomBar catalog={catalog} />
    </div>
  );
}
