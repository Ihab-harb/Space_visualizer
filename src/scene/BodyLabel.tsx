import { Html } from '@react-three/drei';
import type { RefObject } from 'react';
import type { Body } from '../core/catalog/schema';
import { useSelectionStore } from '../state/selectionStore';
import { useViewStore } from '../state/viewStore';
import { useLabelLayer } from './LabelLayerContext';

export function BodyLabel({ body }: { body: Body }) {
  const selected = useSelectionStore((s) => s.selectedId === body.id);
  const select = useSelectionStore((s) => s.select);
  const requestFocus = useViewStore((s) => s.requestFocus);
  const layer = useLabelLayer();
  return (
    <Html center zIndexRange={[20, 0]} portal={layer as RefObject<HTMLElement>}>
      <button
        type="button"
        className={selected ? 'body-label is-selected' : 'body-label'}
        onClick={() => select(body.id)}
        onDoubleClick={() => requestFocus(body.id)}
      >
        {body.name}
      </button>
    </Html>
  );
}
