import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type CSSProperties } from 'react';
import type { Catalog } from '../../core/catalog/catalog';
import type { Body } from '../../core/catalog/schema';
import type { BodyDetails } from '../../core/details/schema';
import { drawnForDetails } from '../../scene/interior/useExploreTransition';
import { readyDetails, useBodyDetails, useDetailsStore } from '../../state/detailsStore';
import { tabOf, useExploreStore, type ExploreTab } from '../../state/exploreStore';
import { useRadarShown } from '../../state/viewStore';
import { citationModel } from '../citations';
import { radarShown } from '../imagery';
import { interiorNotes, layerLabelText } from '../interiorText';
import { CompositionChart, Cite, CiteTargetContext, type CiteTarget } from './CompositionChart';
import { compositionModel, compositionPreview } from './compositionModel';
import { COLOURS_NOTE_ID, LayerCard } from './LayerCard';
import { SourcesList, sourceTitle } from './SourcesList';

/** Phone width (spec §3.3): floating labels become numbered dots with a tap-to-open list. */
export const NARROW_QUERY = '(max-width: 720px)';

function subscribeNarrow(onChange: () => void): () => void {
  const mq = typeof window !== 'undefined' ? window.matchMedia?.(NARROW_QUERY) : undefined;
  mq?.addEventListener?.('change', onChange);
  return () => mq?.removeEventListener?.('change', onChange);
}
const isNarrow = () => (typeof window !== 'undefined' && window.matchMedia?.(NARROW_QUERY).matches) === true;

export function useNarrowViewport(): boolean {
  return useSyncExternalStore(subscribeNarrow, isNarrow, () => false);
}

type Choice<T extends string> = { value: T; name: string; key?: string; keys?: string[] };

const TABS: Array<Choice<ExploreTab>> = [
  { value: 'surface', name: 'Surface', key: '1' },
  { value: 'interior', name: 'Interior', key: '2', keys: ['2', '3'] },
];
const INTERIOR_VIEWS: Array<Choice<'exploded' | 'section'>> = [
  { value: 'exploded', name: 'Exploded', key: '2' },
  { value: 'section', name: 'Half-section', key: '3' },
];

/** A radio group of pill buttons with a roving tabindex and arrow keys; shared by the tabs and the interior sub-switch. */
function PillSwitch<T extends string>({ label, className, reserved, choices, value, onChange }: { label: string; className: string; reserved: string; choices: Array<Choice<T>>; value: T; onChange: (v: T) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + choices.length) % choices.length;
    onChange(choices[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div className={`${className} glass`} role="radiogroup" aria-label={label} data-explore-reserved={reserved}>
      {choices.map((c, i) => (
        <button
          key={c.value}
          ref={(el) => void (refs.current[i] = el)}
          type="button"
          role="radio"
          aria-checked={value === c.value}
          tabIndex={value === c.value ? 0 : -1}
          {...(c.key ? { title: `${c.name} (${c.keys ? 'keys ' + c.keys.join(', ') : 'key ' + c.key})`, 'aria-keyshortcuts': (c.keys ?? [c.key]).join(' ') } : {})}
          onClick={() => onChange(c.value)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

/** Top centre: Surface · Interior (keys 1–3 work anywhere in Explore: 1 is Surface, 2 and 3 are the interior views). */
function SectionSwitch() {
  const view = useExploreStore((s) => s.view);
  const setTab = useExploreStore((s) => s.setTab);
  return <PillSwitch label="Explore section" className="explore-switch" reserved="switch" choices={TABS} value={tabOf(view)} onChange={setTab} />;
}

/** Under the tabs, on Interior only: Exploded · Half-section. */
function InteriorSwitch() {
  const view = useExploreStore((s) => s.view);
  const setView = useExploreStore((s) => s.setView);
  return <PillSwitch label="Interior view" className="explore-subswitch" reserved="subswitch" choices={INTERIOR_VIEWS} value={view === 'section' ? 'section' : 'exploded'} onChange={setView} />;
}

/** Bottom strip: the top two gases (or the cited note, or "No atmosphere") and the button that opens the full chart. */
function CompositionStrip({ catalog, body, details, openRef }: { catalog: Catalog; body: Body; details: BodyDetails; openRef: React.RefObject<HTMLButtonElement | null> }) {
  const toggleChart = useExploreStore((s) => s.toggleChart);
  const model = useMemo(() => compositionModel(body, details), [body, details]);
  const { numbers } = citationModel(catalog, body, details);
  const { parts } = compositionPreview(model, details, body);
  const kind = model ? model.title.split(' · ')[0] : details.atmosphere?.kind === 'exosphere' ? 'Exosphere' : 'Atmosphere';
  const lo = model ? Math.log10(model.ticks[0]!.value) : 0;
  const hi = model ? Math.log10(model.ticks.at(-1)!.value) : 1;
  const more = model ? model.bars.length - 2 : 0;
  let bar = 0;
  return (
    <section className="explore-strip glass" aria-label="Composition" data-explore-reserved="strip">
      <span className="explore-kicker">{kind}</span>
      <span className="explore-strip__preview">
        {parts.map((p, i) => {
          if (!p.sourceId) return p.text.trim() === '·' ? null : <span key={i}>{p.text}</span>;
          const b = model?.bars[bar++];
          const frac = b ? Math.min(1, Math.max(0.04, (b.logValue - lo) / Math.max(hi - lo, 1e-9))) : 0;
          return (
            <span key={i} className="explore-strip__gas">
              {b && (
                <span className="explore-strip__track" aria-hidden="true">
                  <span className="explore-strip__bar" style={{ width: `${frac * 100}%` }} />
                </span>
              )}
              <span className={b ? 'num' : undefined}>{p.text}</span>
              <Cite sourceId={p.sourceId} numbers={numbers} />
            </span>
          );
        })}
      </span>
      {model && (
        <button ref={openRef} type="button" className="explore-strip__open" aria-haspopup="dialog" onClick={() => toggleChart(true)}>
          {more > 0 && <span className="explore-strip__more">+{more} more · </span>}
          Open full chart ›
        </button>
      )}
    </section>
  );
}

/** Prefix of the chart panel's source items: the target of every `[n]` in the strip and the chart while exploring. */
const CHART_SOURCE = 'chart-source-';

/**
 * The full ranked-bar chart, slid up over the strip (a bottom sheet on phones), with the sources its values cite. ✕ or Esc
 * closes it. Opened from a strip citation, focus goes to that source; otherwise to ✕.
 */
function ChartPanel({ catalog, body, details, focusSourceId }: { catalog: Catalog; body: Body; details: BodyDetails; focusSourceId: string | null }) {
  const toggleChart = useExploreStore((s) => s.toggleChart);
  const close = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const { numbers } = citationModel(catalog, body, details);
  const model = compositionModel(body, details);
  const ids = [...new Set([...(model?.bars.map((b) => b.sourceId) ?? []), ...(model?.note ? [model.note.sourceId] : []), ...compositionPreview(model, details, body).parts.flatMap((p) => (p.sourceId ? [p.sourceId] : []))])];
  useEffect(() => {
    const target = focusSourceId ? document.getElementById(`${CHART_SOURCE}${focusSourceId}`) : null;
    (target ?? close.current)?.focus();
  }, [focusSourceId]);
  return (
    <section className="explore-chart glass" role="dialog" aria-labelledby={titleId} data-explore-reserved="chart">
      <div className="explore-chart__head">
        <p id={titleId} className="explore-kicker">
          Composition chart
        </p>
        <button ref={close} type="button" className="explore-icon-button" aria-label="Close chart" title="Close chart (Esc)" onClick={() => toggleChart(false)}>
          ✕
        </button>
      </div>
      <div className="composition-box explore-chart__body">
        <CompositionChart catalog={catalog} body={body} details={details} />
        <SourcesList catalog={catalog} numbers={numbers} ids={ids} idPrefix={CHART_SOURCE} className="explore-sources" />
      </div>
    </section>
  );
}

/** Phone: the layers as a numbered list (matching the numbered dots), opened from the bottom. */
function LayerList({ body, details, drawnIds }: { body: Body; details: BodyDetails; drawnIds: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const selectLayer = useExploreStore((s) => s.selectLayer);
  const layers = details.interior?.layers ?? [];
  if (layers.length === 0) return null;
  return (
    <div className="explore-layers" data-explore-reserved="layers">
      {open && (
        <ol className="explore-layers__list glass" aria-label="Layers">
          {layers.map((layer, i) => {
            const t = layerLabelText(body.id, layer, i === layers.length - 1);
            return (
              <li key={layer.id}>
                <button
                  type="button"
                  onClick={() => {
                    selectLayer(layer.id);
                    setOpen(false);
                  }}
                >
                  <span className="explore-dot__n num" aria-hidden="true">
                    {drawnIds.indexOf(layer.id) + 1 || i + 1}
                  </span>
                  <span className="explore-layers__name">{layer.name}</span>
                  {(t.bound || t.tag) && <span className="explore-layers__detail">{t.bound ?? t.tag}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <button type="button" className="explore-layers__toggle glass" aria-expanded={open} onClick={() => setOpen(!open)}>
        Layers {open ? '▾' : '▴'}
      </button>
    </div>
  );
}

/**
 * Explore's own interface (spec §3.3, mockup B "centre stage"): kind and name top left, the view switch top centre, ✕ top
 * right, the composition strip at the bottom with its full-chart panel, and the selected layer's card. The floating labels
 * are drawn by the scene (InteriorLabels). Rendered only while Explore is active.
 */
export function ExploreOverlay({ catalog }: { catalog: Catalog }) {
  const active = useExploreStore((s) => s.active);
  const bodyId = useExploreStore((s) => s.bodyId);
  if (!active || !bodyId) return null;
  const body = catalog.bodyById.get(bodyId);
  if (!body) return null;
  return <Overlay key={bodyId} catalog={catalog} body={body} />;
}

function Overlay({ catalog, body }: { catalog: Catalog; body: Body }) {
  const entry = useBodyDetails(body.id);
  const details = readyDetails(entry);
  const chartOpen = useExploreStore((s) => s.chartOpen);
  const tab = useExploreStore((s) => tabOf(s.view));
  const radarOn = useRadarShown();
  const selectedLayerId = useExploreStore((s) => s.selectedLayerId);
  const selectLayer = useExploreStore((s) => s.selectLayer);
  const leave = useExploreStore((s) => s.leave);
  const narrow = useNarrowViewport();
  const root = useRef<HTMLDivElement>(null);
  const openChart = useRef<HTMLButtonElement>(null);
  const [focusNote, setFocusNote] = useState(false);
  const [chartSourceId, setChartSourceId] = useState<string | null>(null);
  const toggleChart = useExploreStore((s) => s.toggleChart);
  // Explore's [n] links: a tooltip naming the source, and a target on screen (the chart panel's Sources list, opened if needed).
  const citeTarget = useMemo<CiteTarget>(
    () => ({
      prefix: CHART_SOURCE,
      title: (id) => sourceTitle(catalog, id),
      follow: (id) => {
        setChartSourceId(id);
        if (!useExploreStore.getState().chartOpen) toggleChart(true);
        else document.getElementById(`${CHART_SOURCE}${id}`)?.focus();
      },
    }),
    [catalog, toggleChart],
  );
  const retry = useDetailsStore((s) => s.retry);
  const drawn = useMemo(() => drawnForDetails(body, details), [body, details]);
  const layers = details?.interior?.layers ?? [];
  const notes = interiorNotes(layers, drawn);
  // What stands in for the view switch when nothing can open: still loading, no details file, a failed load, or no interior.
  const status = entry?.status ?? 'loading';
  const noInterior = status === 'missing' || (!!details && !details.interior);
  const onInterior = tab === 'interior';
  // Surface notes: Venus's radar tag, and a plain line for a body whose ready details name no features at all.
  const radarTag = !onInterior && !!details && radarOn && radarShown(body, true);
  const noFeatures = !onInterior && !!details && details.landmarks.length === 0 && !(details.features && details.features.items.length > 0);
  const showInteriorNotes = onInterior && layers.length > 0;

  // On entry, focus moves into the overlay: the checked view.
  useEffect(() => {
    root.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
  }, []);
  // When the focused control goes away (Retry once the data loads, the card closed by Esc), focus stays in the overlay.
  useEffect(() => {
    const el = document.activeElement;
    if (el && el !== document.body) return;
    root.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
  }, [status, selectedLayerId, tab]);
  // After the chart closes, focus returns to the button that opened it.
  const wasOpen = useRef(chartOpen);
  useEffect(() => {
    if (wasOpen.current && !chartOpen) {
      openChart.current?.focus();
      setChartSourceId(null);
    }
    wasOpen.current = chartOpen;
  }, [chartOpen]);
  useEffect(() => {
    if (!focusNote) return;
    document.getElementById(COLOURS_NOTE_ID)?.focus();
    setFocusNote(false);
  }, [focusNote, selectedLayerId]);

  return (
    <CiteTargetContext.Provider value={citeTarget}>
      <div ref={root} className={narrow ? 'explore-overlay is-narrow' : 'explore-overlay'} style={{ ['--body-accent' as string]: body.display.color } as CSSProperties}>
        <div className="explore-top">
          <div className="explore-title" data-explore-reserved="title">
            <p className="explore-kicker">{onInterior ? 'Explore · Interior' : 'Explore · Surface'}</p>
            <h1 className="explore-title__name">{body.name}</h1>
          </div>
          <SectionSwitch />
          {onInterior &&
            (status === 'loading' ? (
              <p className="explore-subswitch explore-subswitch--empty glass" role="status" data-explore-reserved="subswitch">
                Loading the interior…
              </p>
            ) : status === 'error' ? (
              <div className="explore-subswitch explore-subswitch--empty explore-subswitch--error glass" role="alert" data-explore-reserved="subswitch">
                <span>Could not load the interior.</span>
                <button type="button" className="explore-link" onClick={() => void retry(body.id)}>
                  Retry
                </button>
              </div>
            ) : noInterior ? (
              <p className="explore-subswitch explore-subswitch--empty glass" data-explore-reserved="subswitch">
                No interior data yet
              </p>
            ) : (
              <InteriorSwitch />
            ))}
          <button type="button" className="explore-leave explore-icon-button glass" aria-label="Leave Explore" title="Leave Explore (Esc)" onClick={leave} data-explore-reserved="leave">
            ✕
          </button>
          {(radarTag || noFeatures) && (
            <p className="explore-notes" data-explore-reserved="notes">
              {radarTag && <span className="header__radar-tag">Radar view · not visible light</span>}
              {noFeatures && <span className="explore-note-text">No named surface features</span>}
            </p>
          )}
          {showInteriorNotes && (
            <p className="explore-notes" data-explore-reserved="notes">
              {notes.estimate && (
                <span className="tag tag--estimate" title="Some layer sizes come from peer-reviewed research papers">
                  Estimate
                </span>
              )}
              {notes.notToScale && <span className="tag tag--illustrative">Layer sizes are not to scale</span>}
              <button
                type="button"
                className="explore-link"
                aria-controls={COLOURS_NOTE_ID}
                onClick={() => {
                  if (!selectedLayerId && layers[0]) selectLayer(layers[0].id);
                  setFocusNote(true);
                }}
              >
                Illustrative colours
              </button>
            </p>
          )}
        </div>
        {details && selectedLayerId && (
          <LayerCard catalog={catalog} body={body} details={details} layerId={selectedLayerId} drawn={drawn} onClose={() => selectLayer(null)} />
        )}
        {details && (
          <div className="explore-bottom">
            {narrow && onInterior && <LayerList body={body} details={details} drawnIds={drawn.map((d) => d.id)} />}
            <CompositionStrip catalog={catalog} body={body} details={details} openRef={openChart} />
          </div>
        )}
        {details && chartOpen && <ChartPanel catalog={catalog} body={body} details={details} focusSourceId={chartSourceId} />}
      </div>
    </CiteTargetContext.Provider>
  );
}
