import type { ExploreView } from '../../state/exploreStore';

/** Whole to a view (or back) takes this long, eased in and out (spec §3.4). */
export const OPEN_SECONDS = 1.2;
/** Dimming of the other bodies and the Sun's effects fade in and out over this time. */
export const FOCUS_SECONDS = 0.6;

/**
 * What the scene shows of Explore. It outlives the store: after a leave the store is idle at once, while the scene still
 * closes the body (t back to 0) and fades the dimming out (focus back to 0); then the session ends (bodyId null) and the
 * camera, rings, rotation and dimming are restored.
 */
export interface TransitionState {
  /** The body being shown; null when no session is open. */
  bodyId: string | null;
  /** The view whose geometry is drawn. It lags the store's view while one view closes before the next opens. */
  view: ExploreView;
  /** Linear progress of `view`, 0 (closed) to 1 (open). Ease it with `easeInOut` before drawing. */
  t: number;
  /** Linear 0 to 1: dimming of the other bodies, effects. */
  focus: number;
  /** The store's sectionSeq the current Half-section was opened for. */
  sectionSeq: number;
}

export interface TransitionInput {
  active: boolean;
  bodyId: string | null;
  view: ExploreView;
  sectionSeq: number;
  reducedMotion: boolean;
  /** The body's layers are loaded (until then it stays closed). */
  ready: boolean;
}

export const CLOSED: TransitionState = Object.freeze({ bodyId: null, view: 'whole', t: 0, focus: 0, sectionSeq: 0 }) as TransitionState;

export function easeInOut(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

const toward = (x: number, target: number, step: number) => (x < target ? Math.min(target, x + step) : Math.max(target, x - step));

/**
 * One frame of the Explore transition. A change of view, a new Half-section (sectionSeq) or a leave first closes the view
 * from wherever it is (a leave mid-opening reverses from the current progress), then opens the next one.
 */
export function stepTransition(prev: TransitionState, input: TransitionInput, dtSeconds: number): TransitionState {
  const dt = Number.isFinite(dtSeconds) ? Math.max(0, dtSeconds) : 0;
  const rate = input.reducedMotion ? Infinity : dt / OPEN_SECONDS;
  const focusRate = input.reducedMotion ? Infinity : dt / FOCUS_SECONDS;
  const want = input.active ? input.bodyId : null;
  let s: TransitionState = prev;
  if (s.bodyId === null) {
    if (!want) return CLOSED;
    s = { bodyId: want, view: 'whole', t: 0, focus: 0, sectionSeq: input.sectionSeq };
  }
  const sameBody = want === s.bodyId;
  const target: ExploreView = sameBody && input.ready ? input.view : 'whole';
  const reface = s.view === 'section' && target === 'section' && input.sectionSeq !== s.sectionSeq;
  let { bodyId, view, t, sectionSeq } = s;
  if (view !== target || reface) {
    t = toward(t, 0, rate);
    if (t === 0) {
      if (!sameBody && want) {
        bodyId = want;
        view = 'whole';
      } else {
        view = target;
      }
      sectionSeq = input.sectionSeq;
    }
  }
  const settled = view === target && !(view === 'section' && sectionSeq !== input.sectionSeq) && bodyId === (want ?? bodyId);
  if (settled && view !== 'whole') t = toward(t, 1, rate);
  const focus = toward(s.focus, want ? 1 : 0, focusRate);
  if (!want && t === 0 && focus === 0) return CLOSED;
  return { bodyId, view, t, focus, sectionSeq };
}
