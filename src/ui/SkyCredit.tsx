import type { Catalog } from '../core/catalog/catalog';
import { useSkyStore } from '../state/skyStore';

/** Cites the background star map (every image shown is cited). */
export function SkyCredit({ catalog }: { catalog: Catalog }) {
  const ref = useSkyStore((s) => s.ref);
  const source = ref ? catalog.sources.get(ref.sourceId) : undefined;
  if (!source) return null;
  return (
    <p className="sky-credit">
      Sky:{' '}
      <a href={source.url} target="_blank" rel="noreferrer">
        {source.title}
      </a>{' '}
      — {source.publisher}
    </p>
  );
}
