import { useEffect, useRef, useState } from 'react';
import type { Catalog } from '../core/catalog/catalog';
import type { BodyCategory } from '../core/catalog/schema';
import { formatUtc } from '../core/time/format';
import { tdbToUtc } from '../core/time/timescales';
import { useSceneStatsStore } from '../state/sceneStatsStore';
import { useSelectionStore } from '../state/selectionStore';
import { useTimeStore } from '../state/timeStore';
import { useUiStore } from '../state/uiStore';
import { useViewStore } from '../state/viewStore';
import { citationModel } from './citations';
import { formatAu, formatDuration, formatLightTimeShort, formatNumber } from './format';
import { liveStats } from './liveStats';
import { buildNarrative } from './narrative';

const CATEGORY: Record<BodyCategory, string> = { star: 'Star', planet: 'Planet', 'dwarf-planet': 'Dwarf planet', moon: 'Moon', asteroid: 'Asteroid', comet: 'Comet', spacecraft: 'Spacecraft' };

/** CSS custom property the phone drawer uses to stay clear of this card, whose height changes with the selection. */
export const HEADER_BOTTOM_VAR = '--header-bottom';

export function Header({ catalog }: { catalog: Catalog }) {
  const ref = useRef<HTMLElement>(null);
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement.style;
    const publish = () => root.setProperty(HEADER_BOTTOM_VAR, `${Math.round(el.getBoundingClientRect().bottom)}px`);
    publish();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      root.removeProperty(HEADER_BOTTOM_VAR);
    };
  }, []);
  const selectedId = useSelectionStore((s) => s.selectedId);
  const select = useSelectionStore((s) => s.select);
  const jdTdb = useTimeStore((s) => s.jdTdb);
  const scaleMode = useViewStore((s) => s.scaleMode);
  const view = useViewStore((s) => s.view);
  const requestFocus = useViewStore((s) => s.requestFocus);
  const inView = useSceneStatsStore((s) => s.bodiesInView);
  const revealSource = useUiStore((s) => s.revealSource);
  const toggleDrawer = useUiStore((s) => s.toggleDrawer);
  const body = selectedId ? catalog.bodyById.get(selectedId) : undefined;

  if (!body) {
    return (
      <header ref={ref} className="glass header" aria-label="Overview">
        <p className="header__subtitle">Overview</p>
        <h1 className="header__headline">Solar System</h1>
        <ul className="chips">
          <li className="chip"><span className="chip__label">Date (UTC)</span><span className="num">{formatUtc(tdbToUtc(jdTdb))}</span></li>
          <li className="chip"><span className="chip__label">Scale</span><span>{scaleMode === 'true' ? 'True scale' : 'Readable'}</span></li>
          <li className="chip"><span className="chip__label">Bodies in view</span><span className="num">{inView}</span></li>
        </ul>
      </header>
    );
  }

  const stats = liveStats(catalog, body, jdTdb);
  const { numbers } = citationModel(catalog, body);
  const cite = (sourceId: string) => (
    <sup className="cite">
      <a
        href={`#source-${sourceId}`}
        aria-label={`Source ${numbers.get(sourceId)}`}
        onClick={(e) => {
          e.preventDefault();
          revealSource(sourceId);
        }}
      >
        [{numbers.get(sourceId)}]
      </a>
    </sup>
  );
  const distanceKm = stats.fromEarthKm ?? stats.fromSunKm;
  const distanceLabel = stats.fromEarthKm !== null ? 'From Earth' : 'From the Sun';
  const dayFact = body.facts.lengthOfDayHours;
  const tempFact = body.facts.meanTemperatureC;
  const day = dayFact && typeof dayFact.value === 'number' ? { value: dayFact.value, sourceId: dayFact.sourceId } : null;
  const temp = tempFact && typeof tempFact.value === 'number' ? { value: tempFact.value, sourceId: tempFact.sourceId } : null;
  const narrative = buildNarrative(body, stats);
  const expanded = expandedFor === body.id;

  return (
    <header ref={ref} className="glass header" aria-label="Selected body" style={{ ['--body-accent' as string]: body.display.color }}>
      <p className="header__subtitle">
        {CATEGORY[body.category]}
        {distanceKm !== null ? ` · ${formatAu(distanceKm)} ${stats.fromEarthKm !== null ? 'from Earth' : 'from the Sun'}` : ''}
      </p>
      <h1 key={body.id} className="header__headline">{body.name}</h1>
      <ul className="chips">
        {distanceKm !== null && stats.sourceId && (
          <li className="chip"><span className="chip__label">{distanceLabel}</span><span className="num">{formatAu(distanceKm)}</span>{cite(stats.sourceId)}</li>
        )}
        {stats.lightTimeS !== null && stats.sourceId && (
          <li className="chip"><span className="chip__label">Light time</span><span className="num">{formatLightTimeShort(stats.lightTimeS)}</span>{cite(stats.sourceId)}</li>
        )}
        {day && (
          <li className="chip"><span className="chip__label">Day length</span><span className="num">{formatDuration(day.value)}</span>{cite(day.sourceId)}</li>
        )}
        {temp && (
          <li className="chip"><span className="chip__label">Mean temp.</span><span className="num">{formatNumber(temp.value)} °C</span>{cite(temp.sourceId)}</li>
        )}
      </ul>
      <p id="header-narrative" className={expanded ? 'header__narrative is-expanded' : 'header__narrative'}>
        {narrative.map((p, i) =>
          p.kind === 'text' ? <span key={i}>{p.text}</span> : (
            <span key={i}>
              <strong className="num">{p.text}</strong>
              {cite(p.sourceId)}
            </span>
          ),
        )}
      </p>
      <button type="button" className="header__narrative-toggle" aria-expanded={expanded} aria-controls="header-narrative" onClick={() => setExpandedFor(expanded ? null : body.id)}>
        {expanded ? 'Show less' : 'Show more'}
      </button>
      <div className="header__actions">
        <button type="button" onClick={toggleDrawer} title="Facts & sources (key F)">Facts &amp; sources</button>
        {view === 'orbit' && <button type="button" onClick={() => requestFocus(body.id)}>Centre view</button>}
        <button type="button" aria-label="Deselect" onClick={() => select(null)}>×</button>
      </div>
    </header>
  );
}
