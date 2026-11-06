import { useFrame, useThree } from '@react-three/fiber';
import { Fragment, useEffect, useLayoutEffect, useMemo } from 'react';
import { Vector3 } from 'three';
import type { Catalog } from '../../core/catalog/catalog';
import { add, length, scale, sub, type Vec3 } from '../../core/math/vec3';
import { readyDetails, useBodyDetails } from '../../state/detailsStore';
import { useExploreStore } from '../../state/exploreStore';
import { citationModel } from '../../ui/citations';
import { useNarrowViewport } from '../../ui/explore/ExploreOverlay';
import { labelLayout, type LabelAnchor, type Rect, type Size } from '../../ui/explore/labelLayout';
import { layerLabelText } from '../../ui/interiorText';
import { useFrameState } from '../FrameStateContext';
import { pixelsPerRadian } from '../scaleMode';
import { layerAnchors } from './labelAnchors';
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

/** Shared between the projector (inside the Canvas) and the DOM labels (in the label layer, outside the Canvas). */
export interface LabelBridge {
  root: HTMLDivElement | null;
  items: Map<string, LabelItem>;
  narrow: boolean;
}

export function createLabelBridge(): LabelBridge {
  return { root: null, items: new Map(), narrow: false };
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

  useLayoutEffect(() => measure(bridge), [bridge, shownLayers, narrow, selectedLayerId]);
  useEffect(() => {
    const again = () => measure(bridge);
    window.addEventListener('resize', again);
    void document.fonts?.ready.then(again);
    return () => window.removeEventListener('resize', again);
  }, [bridge]);

  const sup = (id: string | undefined) => (id && numbers.has(id) ? <sup className="xlabel__cite">[{numbers.get(id)}]</sup> : null);

  return (
    <div className="xlabels" ref={(el) => void (bridge.root = el)} style={{ visibility: 'hidden' }}>
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
