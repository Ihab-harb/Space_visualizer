import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Catalog } from '../../core/catalog/catalog';
import type { Body } from '../../core/catalog/schema';
import type { BodyDetails } from '../../core/details/schema';
import { useExploreStore } from '../../state/exploreStore';
import { formatKm } from '../format';
import { useNarrowViewport } from './ExploreOverlay';
import { featureEntries, searchFeatures } from './featureModel';

/** Ten or fewer entries need no search box. */
const SEARCH_MIN = 11;

export interface FeatureListProps {
  catalog: Catalog;
  body: Body;
  details: BodyDetails;
}

/**
 * The "All features" button and its panel: every landmark and Gazetteer feature of the body by name, with a search box.
 * A body with landmarks but no Gazetteer list is titled "Landmarks (N)". Picking a row selects the feature.
 */
export function FeatureList({ details }: FeatureListProps) {
  const open = useExploreStore((s) => s.featureListOpen);
  const toggle = useExploreStore((s) => s.toggleFeatureList);
  const selectFeature = useExploreStore((s) => s.selectFeature);
  const selectedFeatureId = useExploreStore((s) => s.selectedFeatureId);
  const featureSeq = useExploreStore((s) => s.featureSeq);
  const narrow = useNarrowViewport();
  const entries = useMemo(() => featureEntries(details), [details]);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => searchFeatures(entries, query), [entries, query]);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // On a phone the card and the panel are both sheets: a feature picked elsewhere (a pin) closes the panel.
  const lastSeq = useRef(featureSeq);
  useEffect(() => {
    if (featureSeq !== lastSeq.current && narrow && selectedFeatureId) toggle(false);
    lastSeq.current = featureSeq;
  }, [featureSeq, narrow, selectedFeatureId, toggle]);
  // Opening the panel moves focus to the search box (or the list when there is none).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) (search.current ?? panel.current?.querySelector<HTMLElement>('button'))?.focus();
    wasOpen.current = open;
  }, [open]);

  if (entries.length === 0) return null;
  const hasGazetteer = !!details.features;
  const title = hasGazetteer ? `All features (${entries.length}) · Search` : `Landmarks (${entries.length})`;
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    // The same order as the global Esc: the open card first, then the list.
    if (useExploreStore.getState().selectedFeatureId !== null) {
      selectFeature(null);
      return;
    }
    toggle(false);
    button.current?.focus();
  };

  return (
    <div className="explore-features">
      <button ref={button} type="button" className="explore-features__toggle glass" aria-expanded={open} aria-controls={panelId} data-explore-reserved="features" onClick={() => toggle()}>
        {title}
      </button>
      {open && (
        <div ref={panel} id={panelId} className="explore-features__panel glass" role="region" aria-label={hasGazetteer ? 'All features' : 'Landmarks'} data-explore-reserved="features">
          {entries.length >= SEARCH_MIN && (
            <input ref={search} type="search" className="explore-features__search" aria-label="Search features" placeholder="Search features" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKey} autoComplete="off" spellCheck={false} />
          )}
          <div className="explore-features__bar">
            <p className="explore-features__count num" role="status">
              {shown.length} of {entries.length}
            </p>
            {narrow && (
              <button type="button" className="explore-link" onClick={() => toggle(false)}>
                Close list
              </button>
            )}
          </div>
          {shown.length === 0 ? (
            <p className="explore-features__empty">No features match</p>
          ) : (
            <ul className="explore-features__list" aria-label="Features">
              {shown.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className={e.id === selectedFeatureId ? 'is-selected' : undefined}
                    aria-pressed={e.id === selectedFeatureId}
                    onClick={() => {
                      selectFeature(e.id);
                      if (narrow) toggle(false);
                    }}
                  >
                    {narrow && e.landmark && (
                      <span className="explore-dot__n num" aria-hidden="true">
                        {e.landmark.rank + 1}
                      </span>
                    )}
                    <span className="explore-features__name">{e.name}</span>
                    <span className="explore-features__meta">
                      {e.type}
                      {e.diameterKm !== null && ` · ${formatKm(e.diameterKm)}`}
                    </span>
                    {e.landmark && <span className="explore-features__mark">Landmark</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
