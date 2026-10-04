import { Html } from '@react-three/drei';
import type { Body } from '../core/catalog/schema';
import { useSelectionStore } from '../state/selectionStore';
import { useViewStore } from '../state/viewStore';

export function BodyLabel({ body }: { body: Body }) {
  const selected = useSelectionStore((s) => s.selectedId === body.id);
  const select = useSelectionStore((s) => s.select);
  const requestFocus = useViewStore((s) => s.requestFocus);
  return (
    <Html center zIndexRange={[20, 0]}>
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
