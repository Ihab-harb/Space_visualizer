import { useFrame, useThree } from '@react-three/fiber';
import { Fragment, useEffect, useLayoutEffect, useMemo } from 'react';
import { Vector3 } from 'three';
import type { Catalog } from '../../core/catalog/catalog';
import type { BodyDetails } from '../../core/details/schema';
import { add, length, scale, sub, type Vec3 } from '../../core/math/vec3';
import { readyDetails, useBodyDetails } from '../../state/detailsStore';
import { useExploreStore } from '../../state/exploreStore';
import { useNarrowViewport } from '../../ui/explore/ExploreOverlay';
import { labelLayout, type PlacedLabel, type Size } from '../../ui/explore/labelLayout';
import { useFrameState } from '../FrameStateContext';
import { reservedRects } from '../interior/InteriorLabels';
import { pixelsPerRadian } from '../scaleMode';
import { PIN_NAME_LAYOUT, pinNameAnchors, pinPoints, type PinInput } from './pinAnchors';

/** The DOM nodes of one pin, registered by FeaturePins and moved each frame by FeaturePinProjector. */
interface PinItem {
  dot: HTMLButtonElement | null;
  name: HTMLElement | null;
  line: SVGLineElement | null;
}

/** A shown pin: a landmark (numbered on phones), or the selected feature when it is not a landmark (the temporary pin). */
interface ShownPin extends PinInput {
  name: string;
  landmark: boolean;
}

/** Shared between the projector (inside the Canvas) and the DOM pins (in the label layer, outside the Canvas). */
export interface PinBridge {
  root: HTMLDivElement | null;
  items: Map<string, PinItem>;
  /** The shown pins in rank order, the temporary pin last. */
  pins: ShownPin[];
  /** Measured name sizes (they change only with content, fonts or width). */
  sizes: Map<string, Size>;
  /** Polar over equatorial radius of the explored body. */
  flattening: number;
  narrow: boolean;
  /** The pin under the pointer or with keyboard focus: its name is placed first. */
  hoveredId: string | null;
}

export function createPinBridge(): PinBridge {
  return { root: null, items: new Map(), pins: [], sizes: new Map(), flattening: 1, narrow: false, hoveredId: null };
}

const item = (bridge: PinBridge, id: string): PinItem => {
  let it = bridge.items.get(id);
  if (!it) {
    it = { dot: null, name: null, line: null };
    bridge.items.set(id, it);
  }
  return it;
};

/** After the Explore driver (-0.9), the body positions (-0.5) and the interior model (-0.4); below 0 so R3F keeps rendering. */
const PIN_PRIORITY = -0.3;

/** The pins of a body: its landmarks in rank order, then the selected feature if it is not one of them. */
export function shownPins(details: BodyDetails | null, selectedFeatureId: string | null): ShownPin[] {
  if (!details) return [];
  const out: ShownPin[] = details.landmarks.map((l, rank) => ({ id: l.id, name: l.name, latDeg: l.latDeg, lonDegE: l.lonDegE, rank, landmark: true }));
  if (selectedFeatureId && !out.some((p) => p.id === selectedFeatureId)) {
    const f = details.features?.items.find((x) => x.id === selectedFeatureId);
    if (f) out.push({ id: f.id, name: f.name, latDeg: f.latDeg, lonDegE: f.lonDegE, rank: out.length, landmark: false });
  }
  return out;
}

const setIfChanged = (el: HTMLElement | SVGElement, key: string, value: string) => {
  if (el.dataset[key] !== value) el.dataset[key] = value;
};

/**
 * Projects each pin every frame, shows it by how much it faces the camera, lays the names out beside the globe
 * (labelLayout) and draws the leaders. Runs only on Surface with the body closed and the chart shut; no React updates.
 */
export function FeaturePinProjector({ bridge }: { bridge: PinBridge }) {
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
    const orientation = ex ? frame.bodyOrientation.get(ex.bodyId) : undefined;
    const closed = ex !== null && (ex.view === 'whole' || ex.progress === 0);
    if (!ex || !R || !pos || !orientation || !closed || !store.active || store.chartOpen || store.bodyId !== ex.bodyId || store.view !== 'whole') {
      if (root.style.visibility !== 'hidden') root.style.visibility = 'hidden';
      return;
    }
    root.style.visibility = 'visible';
    // On entry the pins come in with the dimming of the other bodies.
    root.style.opacity = String(ex.focus);

    camera.updateMatrixWorld();
    const toScreen = (p: Vec3): { x: number; y: number } => {
      v.set(p[0], p[1], p[2]).applyMatrix4(camera.matrixWorldInverse);
      if (v.z >= 0) return { x: Number.NaN, y: Number.NaN }; // behind the camera
      v.applyMatrix4(camera.projectionMatrix);
      return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height };
    };
    // Camera-relative world positions, km (the scene renders with the camera at the origin).
    const rel = sub(pos, frame.cameraPositionKm);
    const dist = Math.max(length(rel), 1e-9);
    const points = pinPoints(bridge.pins, orientation, bridge.flattening, scale(rel, -1 / dist), dist / R).map((p) => ({ ...p, ...toScreen(add(rel, scale(p.offsetWorld, R))) }));
    const c = toScreen(rel);
    const body = { x: c.x, y: c.y, r: (R / dist) * pixelsPerRadian(size.height, frame.fovRad) };

    for (const p of points) {
      const dot = bridge.items.get(p.id)?.dot;
      if (!dot) continue;
      const hidden = !(p.facing > 0) || !Number.isFinite(p.x);
      if (dot.hidden !== hidden) dot.hidden = hidden;
      if (hidden) continue;
      dot.style.transform = `translate(${p.x}px, ${p.y}px)`;
      dot.style.opacity = String(p.facing);
    }
    if (bridge.narrow) return;

    const selectedId = store.selectedFeatureId;
    // Only a dot on screen is named: zoomed in, a pin off the edge would pull a leader out of the picture.
    const onScreen = points.filter((p) => p.x >= 0 && p.x <= size.width && p.y >= 0 && p.y <= size.height);
    const placed = labelLayout(
      pinNameAnchors(onScreen, bridge.sizes, body.x, { selectedId, hoveredId: bridge.hoveredId }),
      { width: size.width, height: size.height },
      reservedRects(root),
      { ...PIN_NAME_LAYOUT, body, selectedId },
    );
    const byId = new Map<string, PlacedLabel>(placed.map((p) => [p.id, p]));
    points.forEach((p, i) => {
      const it = bridge.items.get(p.id);
      if (!it) return;
      const at = byId.get(p.id);
      const named = at !== undefined && at.mode !== 'hidden' && !(it.dot?.hidden ?? true);
      if (it.name) {
        setIfChanged(it.name, 'mode', named ? 'full' : 'hidden');
        if (named) {
          setIfChanged(it.name, 'side', at.side);
          it.name.style.transform = `translate(${at.rect.left}px, ${at.rect.top}px)`;
        }
      }
      if (it.dot) {
        // A pin without a name on screen names itself on hover.
        const title = named ? '' : (bridge.pins[i]?.name ?? '');
        if (it.dot.title !== title) it.dot.title = title;
      }
      if (it.line) {
        setIfChanged(it.line, 'shown', named ? 'true' : 'false');
        // A leader fading out stays where it was, with its name (its dot may have gone behind the limb).
        if (named && at.leader) {
          it.line.setAttribute('x1', String(at.leader.x1));
          it.line.setAttribute('y1', String(at.leader.y1));
          it.line.setAttribute('x2', String(at.leader.x2));
          it.line.setAttribute('y2', String(at.leader.y2));
        }
      }
    });
  }, PIN_PRIORITY);
  return null;
}

/** Reads each name's size (it changes only with content, fonts or width). */
function measure(bridge: PinBridge): void {
  bridge.sizes = new Map();
  for (const [id, it] of bridge.items) {
    if (it.name) bridge.sizes.set(id, { width: it.name.offsetWidth, height: it.name.offsetHeight });
  }
}

/**
 * The landmark pins on the globe (Explore, Surface), rendered into the label layer: a small glowing dot per landmark and,
 * on the facing side, its name beside the globe with a leader line to the dot; at phone width, numbered dots. The selected
 * feature gets a pin of its own when it is not a landmark. A click or tap selects the feature. Positions are written by
 * FeaturePinProjector each frame.
 */
export function FeaturePins({ bridge, catalog }: { bridge: PinBridge; catalog: Catalog }) {
  const active = useExploreStore((s) => s.active);
  const bodyId = useExploreStore((s) => s.bodyId);
  const selectedFeatureId = useExploreStore((s) => s.selectedFeatureId);
  const selectFeature = useExploreStore((s) => s.selectFeature);
  const body = bodyId ? catalog.bodyById.get(bodyId) : undefined;
  const details = readyDetails(useBodyDetails(active ? (bodyId ?? undefined) : undefined));
  const narrow = useNarrowViewport();
  const pins = useMemo(() => (active ? shownPins(details, selectedFeatureId) : []), [active, details, selectedFeatureId]);
  bridge.narrow = narrow;
  bridge.pins = pins;
  bridge.flattening = body ? body.shape.polarRadiusKm / body.shape.equatorialRadiusKm : 1;

  useLayoutEffect(() => {
    // A temporary pin that has gone leaves no nodes behind.
    for (const id of [...bridge.items.keys()]) if (!pins.some((p) => p.id === id)) bridge.items.delete(id);
    if (bridge.hoveredId && !pins.some((p) => p.id === bridge.hoveredId)) bridge.hoveredId = null;
    measure(bridge);
  }, [bridge, pins, narrow]);
  useEffect(() => {
    const again = () => measure(bridge);
    window.addEventListener('resize', again);
    void document.fonts?.ready.then(again);
    return () => window.removeEventListener('resize', again);
  }, [bridge]);

  if (pins.length === 0) return null;
  const hover = (id: string) => () => void (bridge.hoveredId = id);
  const unhover = (id: string) => () => {
    if (bridge.hoveredId === id) bridge.hoveredId = null;
  };

  return (
    <div className="xpins" ref={(el) => void (bridge.root = el)} style={{ visibility: 'hidden' }}>
      {!narrow && (
        <svg className="xpins__leaders" aria-hidden="true">
          {pins.map((p) => (
            <line key={p.id} ref={(el) => void (item(bridge, p.id).line = el)} className={p.id === selectedFeatureId ? 'is-selected' : undefined} data-shown="false" />
          ))}
        </svg>
      )}
      {pins.map((p) => {
        const selected = p.id === selectedFeatureId;
        const numbered = narrow && p.landmark;
        return (
          <Fragment key={p.id}>
            <button
              ref={(el) => void (item(bridge, p.id).dot = el)}
              type="button"
              className={['xpin', selected && 'is-selected', numbered && 'is-numbered', !p.landmark && 'is-temporary'].filter(Boolean).join(' ')}
              aria-label={numbered ? `${p.rank + 1} ${p.name}` : p.name}
              aria-pressed={selected}
              hidden
              onClick={() => selectFeature(p.id)}
              onPointerEnter={hover(p.id)}
              onPointerLeave={unhover(p.id)}
              onFocus={hover(p.id)}
              onBlur={unhover(p.id)}
            >
              {numbered ? p.rank + 1 : null}
            </button>
            {!narrow && (
              <span
                ref={(el) => void (item(bridge, p.id).name = el)}
                className={selected ? 'xpin-name is-selected' : 'xpin-name'}
                data-mode="hidden"
                aria-hidden="true"
                onClick={() => selectFeature(p.id)}
                onPointerEnter={hover(p.id)}
                onPointerLeave={unhover(p.id)}
              >
                {p.name}
              </span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
