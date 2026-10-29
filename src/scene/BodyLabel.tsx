import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import type { Body } from '../core/catalog/schema';
import { length, sub } from '../core/math/vec3';
import { SPEED_OF_LIGHT_KM_S } from '../core/units';
import { useSelectionStore } from '../state/selectionStore';
import { useViewStore } from '../state/viewStore';
import { formatAu, formatLightTimeShort } from '../ui/format';
import { useFrameState } from './FrameStateContext';
import { labelPriority } from './labels/labelLayout';
import { useLabelLayer } from './LabelLayerContext';
import { pixelsPerRadian } from './scaleMode';

const DATUM_INTERVAL_S = 0.25;

/** sunId: the catalogue's star (Earth's label shows its distance from it); BodyMesh passes it from `bodies`. */
export function BodyLabel({ body, sunId }: { body: Body; sunId: string | undefined }) {
  const selected = useSelectionStore((s) => s.selectedId === body.id);
  const hovered = useSelectionStore((s) => s.hoveredId === body.id);
  const select = useSelectionStore((s) => s.select);
  const requestFocus = useViewStore((s) => s.requestFocus);
  const layer = useLabelLayer();
  const frame = useFrameState();
  const button = useRef<HTMLButtonElement>(null);
  const datum = useRef<HTMLSpanElement>(null);
  const since = useRef(DATUM_INTERVAL_S);

  useFrame((_, delta) => {
    if (button.current) button.current.hidden = frame.bodyHidden.has(body.id);
    since.current += delta;
    if (since.current < DATUM_INTERVAL_S || !button.current || !datum.current) return;
    since.current = 0;
    const pos = frame.bodyPositionsKm.get(body.id);
    const earth = frame.bodyPositionsKm.get('earth');
    const parentPos = body.parentId && body.parentId !== sunId ? frame.bodyPositionsKm.get(body.parentId) : undefined;
    const ref = body.category === 'moon' ? parentPos : body.id === 'earth' ? (sunId ? frame.bodyPositionsKm.get(sunId) : undefined) : earth;
    if (pos && ref) {
      const d = length(sub(pos, ref));
      const expanded = selected || hovered;
      datum.current.textContent =
        body.category === 'moon'
          ? Math.round(d).toLocaleString('en-US') + ' km' // placeholder until formatKm (Task 7)
          : body.id === 'earth' ? `${formatAu(d)} from Sun` : expanded ? `${formatAu(d)} · ${formatLightTimeShort(d / SPEED_OF_LIGHT_KM_S)} light` : formatAu(d);
    }
    const r = frame.bodyRenderRadiusKm.get(body.id);
    if (pos && r) {
      const pixelRadius = (r / Math.max(length(sub(pos, frame.cameraPositionKm)), 1e-9)) * pixelsPerRadian(frame.viewportHeightPx, frame.fovRad);
      button.current.dataset.priority = String(labelPriority({ selected, hovered, pixelRadius }));
    }
  });

  return (
    <Html center zIndexRange={[20, 0]} portal={layer as RefObject<HTMLElement>}>
      <button
        ref={button}
        type="button"
        aria-label={body.name}
        data-label-id={body.id}
        className={selected ? 'body-label is-selected' : 'body-label'}
        onClick={() => select(body.id)}
        onDoubleClick={() => requestFocus(body.id)}
      >
        <span className="body-label__dot" style={{ background: body.display.color }} />
        <span className="body-label__name">{body.name}</span>
        <span ref={datum} className="body-label__datum num" />
      </button>
    </Html>
  );
}
