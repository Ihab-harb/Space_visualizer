import type { Catalog } from '../../core/catalog/catalog';

/**
 * A compact "Sources" list for Explore (the layer card and the chart panel): `[n] title · publisher`, each linking to its page.
 * Items carry the id `<idPrefix><sourceId>`, so the `[n]` links beside the values have a target on screen.
 */
export function SourcesList({ catalog, numbers, ids, idPrefix, className }: { catalog: Catalog; numbers: ReadonlyMap<string, number>; ids: readonly string[]; idPrefix: string; className: string }) {
  if (ids.length === 0) return null;
  return (
    <ol className={className} aria-label="Sources">
      {ids.map((id) => {
        const source = catalog.sources.get(id);
        return (
          <li key={id} id={`${idPrefix}${id}`} tabIndex={-1}>
            <span className="num">[{numbers.get(id)}]</span>{' '}
            {source ? (
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title}
              </a>
            ) : (
              id
            )}
            {source && <span className="explore-card__publisher"> · {source.publisher}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** The tooltip for a `[n]` link in Explore: the source's title and publisher. */
export function sourceTitle(catalog: Catalog, sourceId: string): string | undefined {
  const s = catalog.sources.get(sourceId);
  return s ? `${s.title} · ${s.publisher}` : undefined;
}
