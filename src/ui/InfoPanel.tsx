import type { Catalog } from '../core/catalog/catalog';
import { FACT_DEFS, FACT_KEYS, type FactGroup } from '../core/catalog/facts';
import type { BodyCategory } from '../core/catalog/schema';
import { useSelectionStore } from '../state/selectionStore';
import { useTimeStore } from '../state/timeStore';
import { useViewStore } from '../state/viewStore';
import { accuracyLines } from './accuracy';
import { citationModel } from './citations';
import { formatDistanceKm, formatFact, formatLightTime } from './format';
import { illustrativeNotes, imageryLines } from './imagery';
import { liveStats } from './liveStats';

const CATEGORY_LABELS: Record<BodyCategory, string> = {
  star: 'Star', planet: 'Planet', 'dwarf-planet': 'Dwarf planet', moon: 'Moon', asteroid: 'Asteroid', comet: 'Comet', spacecraft: 'Spacecraft',
};
const GROUP_TITLES: Record<FactGroup, string> = { physical: 'Physical characteristics', orbit: 'Orbit' };

export function InfoPanel({ catalog }: { catalog: Catalog }) {
  const selectedId = useSelectionStore((s) => s.selectedId);
  const select = useSelectionStore((s) => s.select);
  const view = useViewStore((s) => s.view);
  const requestFocus = useViewStore((s) => s.requestFocus);
  const jdTdb = useTimeStore((s) => s.jdTdb);
  const body = selectedId ? catalog.bodyById.get(selectedId) : undefined;
  if (!body) return null;

  const { order, numbers, liveSource } = citationModel(catalog, body);
  const cite = (sourceId: string) => (
    <sup className="cite">
      <a href={`#source-${sourceId}`} aria-label={`Source ${numbers.get(sourceId)}`}>
        [{numbers.get(sourceId)}]
      </a>
    </sup>
  );
  const parent = body.parentId ? catalog.bodyById.get(body.parentId) : undefined;
  const live = liveStats(catalog, body, jdTdb);

  return (
    <aside className="panel info-panel" aria-label="Body information">
      <header className="info-panel__header">
        <div>
          <h2>{body.name}</h2>
          <p className="info-panel__kind">
            {CATEGORY_LABELS[body.category]}
            {parent ? ` · orbits the ${parent.name}` : ''}
          </p>
        </div>
        <div className="info-panel__actions">
          {view === 'orbit' && (
            <button type="button" onClick={() => requestFocus(body.id)}>
              Centre view
            </button>
          )}
          <button type="button" aria-label="Close" onClick={() => select(null)}>
            ×
          </button>
        </div>
      </header>

      {body.description && (
        <blockquote className="info-panel__description">
          {body.description.text}
          {cite(body.description.sourceId)}
        </blockquote>
      )}

      {(['physical', 'orbit'] as const).map((group) => {
        const keys = FACT_KEYS.filter((k) => FACT_DEFS[k].group === group && body.facts[k] !== undefined);
        if (keys.length === 0) return null;
        return (
          <section key={group}>
            <h3>{GROUP_TITLES[group]}</h3>
            <dl className="facts">
              {keys.map((key) => {
                const fact = body.facts[key]!;
                return (
                  <div className="facts__row" key={key}>
                    <dt>{FACT_DEFS[key].label}</dt>
                    <dd>
                      {formatFact(FACT_DEFS[key], fact.value)}
                      {cite(fact.sourceId)}
                      {fact.note && <span className="facts__note">{fact.note}</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        );
      })}

      {liveSource && (live.fromSunKm !== null || live.fromEarthKm !== null) && (
        <section>
          <h3>At the simulation time</h3>
          <dl className="facts">
            {live.fromSunKm !== null && (
              <div className="facts__row">
                <dt>Distance from the Sun</dt>
                <dd>
                  {formatDistanceKm(live.fromSunKm)}
                  {cite(liveSource)}
                </dd>
              </div>
            )}
            {live.fromEarthKm !== null && (
              <>
                <div className="facts__row">
                  <dt>Distance from Earth</dt>
                  <dd>
                    {formatDistanceKm(live.fromEarthKm)}
                    {cite(liveSource)}
                  </dd>
                </div>
                <div className="facts__row">
                  <dt>Light travel time from Earth</dt>
                  <dd>
                    {formatLightTime(live.lightTimeS ?? 0)}
                    {cite(liveSource)}
                    <span className="facts__note">Distance ÷ speed of light (299,792.458 km/s, exact SI value).</span>
                  </dd>
                </div>
              </>
            )}
          </dl>
        </section>
      )}

      <section>
        <h3>Position accuracy</h3>
        <ul className="info-panel__accuracy">
          {accuracyLines(body).map((line) => (
            <li key={line.text}>
              {line.text}
              {line.sourceIds.map((id) => (
                <span key={id}>{cite(id)}</span>
              ))}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Imagery</h3>
        {imageryLines(body).length > 0 && (
          <ul className="info-panel__imagery">
            {imageryLines(body).map((l) => (
              <li key={l.label}>
                <strong>{l.label}</strong>
                {l.illustrative && <span className="tag">illustrative</span>}
                {cite(l.sourceId)}
                {l.derivation && <span className="info-panel__derivation"> — {l.derivation}</span>}
              </li>
            ))}
          </ul>
        )}
        {illustrativeNotes(body).map((note) => (
          <p key={note} className="info-panel__note">
            {note}
          </p>
        ))}
      </section>

      <section>
        <h3>Sources</h3>
        <ol className="sources">
          {order.map((id) => {
            const source = catalog.sources.get(id);
            if (!source) return null;
            return (
              <li key={id} id={`source-${id}`}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>{' '}
                — {source.publisher}. Retrieved {source.retrievedAt}.
              </li>
            );
          })}
        </ol>
      </section>
    </aside>
  );
}
