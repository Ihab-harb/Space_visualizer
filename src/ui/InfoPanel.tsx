import type { Catalog } from '../core/catalog/catalog';
import { FACT_DEFS, FACT_KEYS, type FactGroup } from '../core/catalog/facts';
import type { Body, BodyCategory } from '../core/catalog/schema';
import { bodyState } from '../core/ephemeris/state';
import { distance } from '../core/math/vec3';
import { SPEED_OF_LIGHT_KM_S } from '../core/units';
import { useSelectionStore } from '../state/selectionStore';
import { useTimeStore } from '../state/timeStore';
import { useViewStore } from '../state/viewStore';
import { accuracyLines } from './accuracy';
import { citationNumbers, citationOrder } from './citations';
import { formatDistanceKm, formatFact, formatLightTime } from './format';

const CATEGORY_LABELS: Record<BodyCategory, string> = {
  star: 'Star', planet: 'Planet', 'dwarf-planet': 'Dwarf planet', moon: 'Moon', asteroid: 'Asteroid', comet: 'Comet', spacecraft: 'Spacecraft',
};
const GROUP_TITLES: Record<FactGroup, string> = { physical: 'Physical characteristics', orbit: 'Orbit' };

function liveDistances(catalog: Catalog, body: Body, jdTdb: number) {
  const position = bodyState(body, jdTdb).positionKm;
  const sun = catalog.bodies.find((b) => b.category === 'star');
  const earth = catalog.bodyById.get('earth');
  return {
    fromSunKm: sun && sun.id !== body.id ? distance(position, bodyState(sun, jdTdb).positionKm) : null,
    fromEarthKm: earth && earth.id !== body.id ? distance(position, bodyState(earth, jdTdb).positionKm) : null,
  };
}

export function InfoPanel({ catalog }: { catalog: Catalog }) {
  const selectedId = useSelectionStore((s) => s.selectedId);
  const select = useSelectionStore((s) => s.select);
  const view = useViewStore((s) => s.view);
  const requestFocus = useViewStore((s) => s.requestFocus);
  const jdTdb = useTimeStore((s) => s.jdTdb);
  const body = selectedId ? catalog.bodyById.get(selectedId) : undefined;
  if (!body) return null;

  const order = citationOrder(body);
  const numbers = citationNumbers(order);
  const cite = (sourceId: string) => (
    <sup className="cite">
      <a href={`#source-${sourceId}`} aria-label={`Source ${numbers.get(sourceId)}`}>
        [{numbers.get(sourceId)}]
      </a>
    </sup>
  );
  const parent = body.parentId ? catalog.bodyById.get(body.parentId) : undefined;
  const live = liveDistances(catalog, body, jdTdb);
  const positionSource = body.orbit.type === 'planet-approx' ? body.orbit.sourceId : null;

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

      {positionSource && (live.fromSunKm !== null || live.fromEarthKm !== null) && (
        <section>
          <h3>At the simulation time</h3>
          <dl className="facts">
            {live.fromSunKm !== null && (
              <div className="facts__row">
                <dt>Distance from the Sun</dt>
                <dd>
                  {formatDistanceKm(live.fromSunKm)}
                  {cite(positionSource)}
                </dd>
              </div>
            )}
            {live.fromEarthKm !== null && (
              <>
                <div className="facts__row">
                  <dt>Distance from Earth</dt>
                  <dd>
                    {formatDistanceKm(live.fromEarthKm)}
                    {cite(positionSource)}
                  </dd>
                </div>
                <div className="facts__row">
                  <dt>Light travel time from Earth</dt>
                  <dd>{formatLightTime(live.fromEarthKm / SPEED_OF_LIGHT_KM_S)}</dd>
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
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <p className="info-panel__note">Illustrative colour — no official surface map in this release.</p>

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
