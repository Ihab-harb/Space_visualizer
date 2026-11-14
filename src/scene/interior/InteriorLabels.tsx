import { useFrame, useThree } from '@react-three/fiber';
import { Fragment, useEffect, useLayoutEffect, useMemo } from 'react';
import { Vector3 } from 'three';
import type { Catalog } from '../../core/catalog/catalog';
import { apply, transpose } from '../../core/math/mat3';
import { add, length, normalize, scale, sub, type Vec3 } from '../../core/math/vec3';
import { readyDetails, useBodyDetails } from '../../state/detailsStore';
import { useExploreStore } from '../../state/exploreStore';
import { citationModel } from '../../ui/citations';
import { depthRulerTicks, placeRuler, type RulerTick } from '../../ui/explore/depthRuler';
import { useNarrowViewport } from '../../ui/explore/ExploreOverlay';
import { labelLayout, type LabelAnchor, type Rect, type Size } from '../../ui/explore/labelLayout';
import { layerLabelText } from '../../ui/interiorText';
import { useFrameState } from '../FrameStateContext';
import { pixelsPerRadian } from '../scaleMode';
import { layerAnchors, sectionAxes } from './labelAnchors';
import { drawnForDetails } from './useExploreTransition';

/** The DOM nodes of one layer's label, registered by InteriorLabels and moved each frame by InteriorLabelProjector. */
interface LabelItem {
  label: HTMLElement | null;
  dot: HTMLElement | null;
  line: SVGLineElement | null;
  tip: SVGCircleElement | null;
  full: Size;
  collapsed: Size;
}

/** The depth ruler's DOM nodes (Half-section, desktop), registered by InteriorLabels and placed each frame by the projector. */
interface RulerItems {
  root: HTMLDivElement | null;
  spine: SVGLineElement | null;
  title: HTMLElement | null;
  ticks: Array<SVGLineElement | null>;
  leaders: Array<SVGLineElement | null>;
  values: Array<HTMLElement | null>;
  /** Measured sizes of each value (0 x 0 for a tick with no number) and of the title. */
  sizes: Size[];
  titleSize: Size;
  model: RulerTick[];
  /** Polar over equatorial radius of the explored body: the surface tick sits on the flattened globe. */
  flattening: number;
}

/** Shared between the projector (inside the Canvas) and the DOM labels (in the label layer, outside the Canvas). */
export interface LabelBridge {
  root: HTMLDivElement | null;
  items: Map<string, LabelItem>;
  narrow: boolean;
  ruler: RulerItems;
}

export function createLabelBridge(): LabelBridge {
  return {
    root: null,
    items: new Map(),
    narrow: false,
    ruler: { root: null, spine: null, title: null, ticks: [], leaders: [], values: [], sizes: [], titleSize: { width: 0, height: 0 }, model: [], flattening: 1 },
  };
}

const item = (bridge: LabelBridge, id: string): LabelItem => {
  let it = bridge.items.get(id);
  if (!it) {
    it = { label: null, dot: null, line: null, tip: null, full: { width: 0, height: 0 }, collapsed: { width: 0, height: 0 } };
    bridge.items.set(id, it);
  }
  return it;
};

/** Labels fade in over the last part of the opening, and go at once when the view closes or Explore is left. */
const FADE_FROM = 0.6;
/** After the Explore driver (-0.9), the body positions (-0.5) and the interior model (-0.4); below 0 so R3F keeps rendering. */
const LABEL_PRIORITY = -0.3;
/** A phone dot's box (CSS .xdot), px. */
const DOT = { width: 26, height: 26 };
/** The depth ruler's spine sits this far right of the face's edge; its values start this far right of the spine, px. */
const RULER_GAP = 22;
const RULER_VALUE_LEFT = 12;
/** Angles either side of the face's vertical searched for the top of each ring, radians. */
const RING_TOP_SAMPLES = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50].map((d) => (d * Math.PI) / 180);

/** Rects the labels must keep clear of: every overlay part marked `data-explore-reserved`, relative to the label root. */
function reservedRects(root: HTMLElement): Rect[] {
  const origin = root.getBoundingClientRect();
  return [...document.querySelectorAll<HTMLElement>('[data-explore-reserved]')].map((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left - origin.left, top: r.top - origin.top, right: r.right - origin.left, bottom: r.bottom - origin.top };
  });
}

/** Projects each layer's anchor every frame, lays the labels out (labelLayout) and moves the DOM labels, leaders and dots. */
export function InteriorLabelProjector({ bridge }: { bridge: LabelBridge }) {
  const frame = useFrameState();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const v = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const root = bridge.root;
    if (!root) return;
    const ex = frame.explore;
    const store = useExploreStore.getState();
    const R = ex ? frame.bodyRenderRadiusKm.get(ex.bodyId) : undefined;
    const pos = ex ? frame.bodyPositionsKm.get(ex.bodyId) : undefined;
    // The open chart is the focus: labels step aside until it closes.
    if (!ex || !R || !pos || !store.active || store.chartOpen || store.bodyId !== ex.bodyId || ex.view === 'whole' || ex.progress <= FADE_FROM) {
      if (root.style.visibility !== 'hidden') root.style.visibility = 'hidden';
      return;
    }
    const ruler = bridge.ruler;
    root.style.visibility = 'visible';
    root.style.opacity = String(Math.min(1, (ex.progress - FADE_FROM) / (1 - FADE_FROM)));

    camera.updateMatrixWorld();
    const m = camera.matrixWorld.elements;
    const right: Vec3 = [m[0]!, m[1]!, m[2]!];
    const rel = sub(pos, frame.cameraPositionKm);
    const toScreen = (p: Vec3): { x: number; y: number } => {
      v.set(p[0], p[1], p[2]).applyMatrix4(camera.matrixWorldInverse);
      if (v.z >= 0) return { x: Number.NaN, y: Number.NaN }; // behind the camera
      v.applyMatrix4(camera.projectionMatrix);
      return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height };
    };
    const centre = add(rel, scale(ex.upWorld, ex.shiftRadii * R));
    const c = toScreen(centre);
    const body = { x: c.x, y: c.y, r: (R / Math.max(length(centre), 1e-9)) * pixelsPerRadian(size.height, frame.fovRad) };
    const anchors = layerAnchors(ex, right).map((a) => ({ ...a, screen: toScreen(add(rel, scale(a.offset, R))) }));

    const reserved = reservedRects(root);
    // The depth ruler (Half-section, desktop): beside the face's right edge, from the surface down to the centre. It is placed
    // first; the labels then keep clear of it.
    let rulerMode: 'full' | 'compact' | 'hidden' = 'hidden';
    if (ruler.root && ex.view === 'section' && !bridge.narrow && ruler.model.length > 1) {
      const { n, faceUp, h, po } = sectionAxes(ex, right);
      const orientation = frame.bodyOrientation.get(ex.bodyId);
      const toObj = orientation ? transpose(orientation) : null;
      // Distance to the flattened surface along a world direction, in body radii.
      const reach = (d: Vec3) => {
        const o = toObj ? apply(toObj, d) : d;
        return 1 / Math.sqrt(o[0] * o[0] + o[1] * o[1] + (o[2] / ruler.flattening) ** 2);
      };
      const faceCentre = add(rel, scale(n, po * R));
      const along = (dir: Vec3, r: number) => add(faceCentre, scale(dir, Math.sqrt(Math.max((r * reach(dir)) ** 2 - po * po, 0)) * R));
      // Each tick at the top of its ring as drawn: the highest point of the ring near the face's vertical (seen at an angle,
      // that is not exactly straight up from the centre).
      const ys = ruler.model.map((t) => {
        let y = Infinity;
        for (const a of RING_TOP_SAMPLES) y = Math.min(y, toScreen(along(normalize(add(scale(faceUp, Math.cos(a)), scale(h, Math.sin(a)))), t.r)).y);
        return y;
      });
      const edge = Math.max(toScreen(along(h, 1)).x, toScreen(along(faceUp, 1)).x);
      const x = edge + RULER_GAP;
      const placed = placeRuler({ x, ys, sizes: ruler.sizes, title: ruler.titleSize }, { width: size.width, height: size.height }, reserved);
      rulerMode = placed.mode;
      if (placed.mode !== 'hidden') {
        const y0 = ys[0]!;
        ruler.root.style.transform = `translate(${x}px, ${y0}px)`;
        ruler.root.dataset.mode = placed.mode;
        ruler.spine?.setAttribute('y2', String(ys.at(-1)! - y0));
        ys.forEach((y, i) => {
          const tick = ruler.ticks[i];
          if (tick) {
            tick.setAttribute('y1', String(y - y0));
            tick.setAttribute('y2', String(y - y0));
          }
          const vy = placed.valueYs[i] ?? y;
          const leader = ruler.leaders[i];
          if (leader) {
            leader.setAttribute('y1', String(y - y0));
            leader.setAttribute('y2', String(vy - y0));
          }
          const value = ruler.values[i];
          if (value) value.style.transform = `translate(${RULER_VALUE_LEFT}px, ${vy - y0 - (ruler.sizes[i]?.height ?? 0) / 2}px)`;
        });
        reserved.push(placed.rect);
      }
    }
    if (ruler.root && ruler.root.dataset.mode !== rulerMode) ruler.root.dataset.mode = rulerMode;
    if (bridge.narrow) {
      // Phone: numbered dots on their anchors, pulled on screen, off the bars and apart (same layout, a dot-sized box).
      const dots = labelLayout(
        anchors.map((a, i) => ({ id: a.id, x: a.screen.x, y: a.screen.y, side: a.side, priority: anchors.length - i, full: DOT, collapsed: DOT })),
        { width: size.width, height: size.height },
        reserved,
        { lead: -DOT.width / 2, gap: 4, selectedId: store.selectedLayerId },
      );
      for (const p of dots) {
        const dot = bridge.items.get(p.id)?.dot;
        if (!dot) continue;
        dot.hidden = p.mode === 'hidden';
        dot.style.transform = `translate(${p.rect.left}px, ${p.rect.top}px)`;
      }
      return;
    }
    const n = anchors.length;
    const input: LabelAnchor[] = anchors.map((a, i) => {
      const it = bridge.items.get(a.id);
      return { id: a.id, x: a.screen.x, y: a.screen.y, side: a.side, priority: n - i, full: it?.full ?? { width: 0, height: 0 }, collapsed: it?.collapsed ?? { width: 0, height: 0 } };
    });
    const placed = labelLayout(input, { width: size.width, height: size.height }, reserved, { body, selectedId: store.selectedLayerId });
    for (const p of placed) {
      const it = bridge.items.get(p.id);
      if (!it?.label) continue;
      it.label.dataset.mode = p.mode;
      it.label.dataset.side = p.side;
      if (p.mode !== 'hidden') it.label.style.transform = `translate(${p.rect.left}px, ${p.rect.top}px)`;
      if (it.line && it.tip) {
        const show = p.leader !== null;
        it.line.style.display = show ? '' : 'none';
        it.tip.style.display = show ? '' : 'none';
        if (p.leader) {
          it.line.setAttribute('x1', String(p.leader.x1));
          it.line.setAttribute('y1', String(p.leader.y1));
          it.line.setAttribute('x2', String(p.leader.x2));
          it.line.setAttribute('y2', String(p.leader.y2));
          it.tip.setAttribute('cx', String(p.leader.x1));
          it.tip.setAttribute('cy', String(p.leader.y1));
        }
      }
    }
  }, LABEL_PRIORITY);
  return null;
}

/** Reads each label's size in its full and collapsed forms (they change only with content, selection, fonts or width). */
function measure(bridge: LabelBridge): void {
  const ruler = bridge.ruler;
  ruler.sizes = ruler.model.map((_, i) => {
    const el = ruler.values[i];
    return el && el.textContent ? { width: el.offsetWidth, height: el.offsetHeight } : { width: 0, height: 0 };
  });
  ruler.titleSize = ruler.title ? { width: ruler.title.offsetWidth, height: ruler.title.offsetHeight + 8 } : { width: 0, height: 0 };
  for (const it of bridge.items.values()) {
    const el = it.label;
    if (!el) continue;
    const mode = el.dataset.mode;
    el.dataset.mode = 'full';
    it.full = { width: el.offsetWidth, height: el.offsetHeight };
    el.dataset.mode = 'collapsed';
    it.collapsed = { width: el.offsetWidth, height: el.offsetHeight };
    el.dataset.mode = mode ?? 'hidden';
  }
}

/**
 * The floating layer labels (spec §3.3), rendered into the label layer: one button per layer (name over state · bound [n]
 * and an Estimate or Illustrative size tag) with a leader line to its anchor; at phone width, numbered dots instead. A click
 * or tap selects the layer. Positions are written by InteriorLabelProjector each frame.
 */
export function InteriorLabels({ bridge, catalog }: { bridge: LabelBridge; catalog: Catalog }) {
  const active = useExploreStore((s) => s.active);
  const bodyId = useExploreStore((s) => s.bodyId);
  const selectedLayerId = useExploreStore((s) => s.selectedLayerId);
  const selectLayer = useExploreStore((s) => s.selectLayer);
  const body = bodyId ? catalog.bodyById.get(bodyId) : undefined;
  const details = readyDetails(useBodyDetails(active ? (bodyId ?? undefined) : undefined));
  const narrow = useNarrowViewport();
  bridge.narrow = narrow;
  const drawn = useMemo(() => (body && details ? drawnForDetails(body, details) : []), [body, details]);
  const layers = details?.interior?.layers ?? [];
  const numbers = body && details ? citationModel(catalog, body, details).numbers : new Map<string, number>();
  const shownLayers = active ? layers : [];
  // The depth ruler: Half-section on a wide screen only (on a phone the body fills the width; the layer list has the bounds).
  const rulerTicks = useMemo(() => (active && body && details && !narrow ? depthRulerTicks(body.id, details, drawn) : []), [active, body, details, drawn, narrow]);
  bridge.ruler.model = rulerTicks;
  bridge.ruler.flattening = body ? body.shape.polarRadiusKm / body.shape.equatorialRadiusKm : 1;

  useLayoutEffect(() => measure(bridge), [bridge, shownLayers, narrow, selectedLayerId, rulerTicks]);
  useEffect(() => {
    const again = () => measure(bridge);
    window.addEventListener('resize', again);
    void document.fonts?.ready.then(again);
    return () => window.removeEventListener('resize', again);
  }, [bridge]);

  const sup = (id: string | undefined) => (id && numbers.has(id) ? <sup className="xlabel__cite">[{numbers.get(id)}]</sup> : null);
  const ruler = bridge.ruler;

  return (
    <div className="xlabels" ref={(el) => void (bridge.root = el)} style={{ visibility: 'hidden' }}>
      {rulerTicks.length > 1 && (
        <div className="xruler" ref={(el) => void (ruler.root = el)} data-mode="hidden" role="group" aria-label="Depth below the surface">
          <span className="xruler__title" ref={(el) => void (ruler.title = el)}>
            Depth
          </span>
          <svg className="xruler__lines" aria-hidden="true">
            <line ref={(el) => void (ruler.spine = el)} x1={0} y1={0} x2={0} y2={0} />
            {rulerTicks.map((t, i) => (
              <Fragment key={i}>
                <line ref={(el) => void (ruler.ticks[i] = el)} className={t.kind === 'boundary' ? undefined : 'is-end'} x1={-4} x2={t.value ? 5 : 4} y1={0} y2={0} />
                {t.value && <line ref={(el) => void (ruler.leaders[i] = el)} className="xruler__leader" x1={5} x2={RULER_VALUE_LEFT - 3} y1={0} y2={0} />}
              </Fragment>
            ))}
          </svg>
          {rulerTicks.map((t, i) => (
            <span key={i} ref={(el) => void (ruler.values[i] = el)} className="xruler__value num">
              {t.value && (
                <>
                  {t.value}
                  {t.kind === 'centre' && <span className="xruler__where"> (centre)</span>}
                  {sup(t.sourceId)}
                  {t.estimate && <span className="xlabel__tag tag--estimate">Estimate</span>}
                </>
              )}
            </span>
          ))}
        </div>
      )}
      {!narrow && (
        <svg className="xlabels__leaders" aria-hidden="true">
          {shownLayers.map((layer) => (
            <g key={layer.id} className={layer.id === selectedLayerId ? 'is-selected' : undefined}>
              <line ref={(el) => void (item(bridge, layer.id).line = el)} />
              <circle ref={(el) => void (item(bridge, layer.id).tip = el)} r={2.5} />
            </g>
          ))}
        </svg>
      )}
      {shownLayers.map((layer, i) => {
        const selected = layer.id === selectedLayerId;
        const t = layerLabelText(body!.id, layer, i === layers.length - 1, drawn[i]);
        if (narrow) {
          return (
            <button
              key={layer.id}
              ref={(el) => void (item(bridge, layer.id).dot = el)}
              type="button"
              className={selected ? 'xdot is-selected' : 'xdot'}
              aria-label={`${i + 1} ${layer.name}`}
              aria-pressed={selected}
              onClick={() => selectLayer(layer.id)}
            >
              {i + 1}
            </button>
          );
        }
        return (
          <button
            key={layer.id}
            ref={(el) => void (item(bridge, layer.id).label = el)}
            type="button"
            className={selected ? 'xlabel is-selected' : 'xlabel'}
            data-mode="hidden"
            aria-pressed={selected}
            title="Show this layer's facts"
            onClick={() => selectLayer(layer.id)}
          >
            <span className="xlabel__head">
              <span className="xlabel__name">{layer.name}</span>
              {t.tag && <span className={t.tag === 'Estimate' ? 'xlabel__tag tag--estimate' : 'xlabel__tag tag--illustrative'}>{t.tag}</span>}
            </span>
            <span className="xlabel__detail">
              {[t.state && (
                <Fragment key="state">
                  {t.state}
                  {sup(t.stateSourceId)}
                </Fragment>
              ), t.bound && (
                <span key="bound" className="num">
                  {t.bound}
                  {sup(t.boundSourceId)}
                </span>
              )]
                .filter(Boolean)
                .flatMap((part, k) => (k === 0 ? [part] : [<span key={`sep${k}`} className="xlabel__sep"> · </span>, part]))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
