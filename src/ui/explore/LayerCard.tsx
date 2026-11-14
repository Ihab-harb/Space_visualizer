import { useId, type ReactNode } from 'react';
import type { Catalog } from '../../core/catalog/catalog';
import type { Body } from '../../core/catalog/schema';
import type { BodyDetails } from '../../core/details/schema';
import type { DrawnLayer } from '../../core/interior/geometry';
import { citationModel } from '../citations';
import { layerExtent, layerLabelText } from '../interiorText';
import { Cite, CiteTargetContext } from './CompositionChart';
import { SourcesList, sourceTitle } from './SourcesList';

export interface LayerCardProps {
  catalog: Catalog;
  body: Body;
  details: BodyDetails;
  layerId: string;
  /** The drawn layers (thickened and illustrative flags, soft bands); same order as the details' layers. */
  drawn: readonly DrawnLayer[];
  onClose(): void;
}

/** The id of the card's "Illustrative colours" note, so the overlay's note link can point at it. */
export const COLOURS_NOTE_ID = 'explore-card-colours';

/**
 * The selected layer's full facts (spec §3.3): bounds as the source states them (the drawer's formatting), state,
 * composition, uncertainty, the estimate or illustrative-size note, the illustrative-colours note and the cited sources.
 */
export function LayerCard({ catalog, body, details, layerId, drawn, onClose }: LayerCardProps) {
  const titleId = useId();
  const layers = details.interior?.layers ?? [];
  const index = layers.findIndex((l) => l.id === layerId);
  const layer = layers[index];
  if (!layer) return null;
  const shape = drawn[index];
  const { numbers } = citationModel(catalog, body, details);
  const text = layerLabelText(body.id, layer, index === layers.length - 1, shape);
  const used: string[] = [];
  const cite = (id: string | undefined): ReactNode => {
    if (!id || !numbers.has(id)) return null;
    if (!used.includes(id)) used.push(id);
    return <Cite sourceId={id} numbers={numbers} />;
  };
  const boundSources = [...new Set([layer.outerRadiusKm?.sourceId, layer.innerRadiusKm?.sourceId].filter((id): id is string => !!id))];
  // A range note only for a bound the source gives as a range; a gradual boundary has its own note.
  const isRange = (r: { min: number; max: number } | undefined) => !!r && r.max > r.min;
  const banded = isRange(layer.outerRadiusKm) || isRange(layer.innerRadiusKm);
  const below = layers[index + 1];
  const extent = layerExtent(body.id, layer);

  // The card's [n] links point at its own Sources list.
  return (
    <CiteTargetContext.Provider value={{ prefix: 'source-', title: (id) => sourceTitle(catalog, id) }}>
      <section className="explore-card glass" aria-labelledby={titleId} data-explore-reserved="card">
        <div className="explore-card__head">
          <div>
            <p className="explore-kicker">
              Layer {index + 1} of {layers.length}
            </p>
            <h2 id={titleId} className="explore-card__title">
              {layer.name}
            </h2>
          </div>
          <button type="button" className="explore-icon-button" aria-label="Close layer card" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="explore-card__tags">
          {text.state && (
            <span className="tag">
              {text.state}
              {cite(text.stateSourceId)}
            </span>
          )}
          {text.tag === 'Estimate' && <span className="tag tag--estimate">Estimate</span>}
          {text.tag === 'Illustrative size' && <span className="tag tag--illustrative">Illustrative size</span>}
          {layer.uncertain && <span className="tag uncertain">Uncertain</span>}
          {shape?.thickened && <span className="tag tag--illustrative">Drawn thicker than scale</span>}
        </p>
        <dl className="explore-card__facts">
          {extent && (
            <div>
              <dt>Extent</dt>
              <dd className="num">
                {extent}
                {boundSources.map((id) => (
                  <span key={id}>{cite(id)}</span>
                ))}
              </dd>
            </div>
          )}
          {layer.composition && (
            <div>
              <dt>Made of</dt>
              <dd>
                {layer.composition.text}
                {cite(layer.composition.sourceId)}
              </dd>
            </div>
          )}
        </dl>
        <ul className="explore-card__notes">
          {text.tag === 'Estimate' && <li>Estimate: this size comes from a peer-reviewed research paper, not an official source.</li>}
          {text.tag === 'Illustrative size' && <li>Illustrative size: no source gives a size for this layer, so it is drawn to show its place, not its size.</li>}
          {layer.uncertain && <li>Uncertain: the sources are not sure about this layer.</li>}
          {banded && <li>The source gives a range, drawn as a soft band.</li>}
          {layer.gradual && index > 0 && (
            <li>
              No sharp edge: the source describes a gradual change into the layer above{cite(layer.gradual.sourceId)}. The soft edge is illustrative.
            </li>
          )}
          {below?.gradual && (
            <li>
              No sharp lower edge: the source describes a gradual change into the {below.name.toLowerCase()} below{cite(below.gradual.sourceId)}. The soft edge is illustrative.
            </li>
          )}
          <li id={COLOURS_NOTE_ID} tabIndex={-1}>
            Illustrative colours: they show state and heat, not real colours.
            {shape?.thickened && ' Drawn thicker than scale, so this thin layer stays visible.'}
          </li>
        </ul>
        <SourcesList catalog={catalog} numbers={numbers} ids={used} idPrefix="source-" className="explore-card__sources" />
      </section>
    </CiteTargetContext.Provider>
  );
}
