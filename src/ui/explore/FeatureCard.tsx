import { useId, useMemo, type ReactNode } from 'react';
import type { Catalog } from '../../core/catalog/catalog';
import type { Body } from '../../core/catalog/schema';
import type { BodyDetails } from '../../core/details/schema';
import { citationModel } from '../citations';
import { formatKm } from '../format';
import { Cite, CiteTargetContext } from './CompositionChart';
import { featureEntry, tidyQuote } from './featureModel';
import { SourcesList, sourceTitle } from './SourcesList';

export interface FeatureCardProps {
  catalog: Catalog;
  body: Body;
  details: BodyDetails;
  featureId: string;
  onClose(): void;
}

/** The fixed line under a names-database position. */
export const NAMES_DATABASE_NOTE = "The position is the names database's point for this name, not a measured centre.";

/**
 * The selected feature's facts (spec: feature pins): type, name, the landmark's quoted sentence, size, position, what it is
 * named for and the year the name was approved. Every value carries its own `[n]`; a quote and a Gazetteer size stay
 * separate rows, so two sources that differ are plainly two sources.
 */
export function FeatureCard({ catalog, body, details, featureId, onClose }: FeatureCardProps) {
  const titleId = useId();
  const entry = useMemo(() => featureEntry(details, featureId), [details, featureId]);
  if (!entry) return null;
  const { numbers } = citationModel(catalog, body, details);
  const used: string[] = [];
  const cite = (id: string | null | undefined): ReactNode => {
    if (!id || !numbers.has(id)) return null;
    if (!used.includes(id)) used.push(id);
    return <Cite sourceId={id} numbers={numbers} />;
  };
  const typeSource = entry.typeMeaning?.sourceId ?? entry.positionSourceId;
  const sources = () => [...used].sort((a, b) => numbers.get(a)! - numbers.get(b)!);

  const kicker = (
    <>
      {entry.type}
      {entry.typeMeaning && ` · ${entry.typeMeaning.text}`}
      {cite(typeSource)}
      {entry.landmark && ' · Landmark'}
    </>
  );
  // Built first so the Sources list below knows every source the rows used.
  const rows: Array<{ label: string; value: ReactNode }> = [];
  if (entry.diameterKm !== null) rows.push({ label: 'Size', value: <><span className="num">{formatKm(entry.diameterKm)}</span>{cite(entry.sizeSourceId)}</> });
  rows.push({ label: 'Position', value: <><span className="num">{entry.positionText}</span>{cite(entry.positionSourceId)}</> });
  if (entry.origin) rows.push({ label: 'Named for', value: <>{entry.origin}{cite(entry.gazetteerSourceId)}</> });
  if (entry.approvedYear !== null) rows.push({ label: 'Name approved', value: <><span className="num">{entry.approvedYear}</span>{cite(entry.gazetteerSourceId)}</> });
  const quote = entry.landmark ? (
    <p className="explore-card__quote">
      {'“'}
      {tidyQuote(entry.landmark.quote.text)}
      {'”'}
      {cite(entry.landmark.quote.sourceId)}
    </p>
  ) : null;

  return (
    <CiteTargetContext.Provider value={{ prefix: 'feature-source-', title: (id) => sourceTitle(catalog, id) }}>
      <section className="explore-card glass" aria-labelledby={titleId} data-explore-reserved="card">
        <div className="explore-card__head">
          <div>
            <p className="explore-kicker">{kicker}</p>
            <h2 id={titleId} className="explore-card__title">
              {entry.name}
            </h2>
          </div>
          <button type="button" className="explore-icon-button" aria-label="Close feature card" onClick={onClose}>
            ✕
          </button>
        </div>
        {quote}
        <dl className="explore-card__rows">
          {rows.map((r) => (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
        {entry.positionKind === 'names-database' && <p className="explore-card__note">{NAMES_DATABASE_NOTE}</p>}
        <SourcesList catalog={catalog} numbers={numbers} ids={sources()} idPrefix="feature-source-" className="explore-card__sources" />
      </section>
    </CiteTargetContext.Provider>
  );
}
