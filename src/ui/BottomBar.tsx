import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Catalog } from '../core/catalog/catalog';
import { validityStatus } from '../core/ephemeris/state';
import { formatUtc, parseDateInput } from '../core/time/format';
import { tdbToUtc, utcToTdb } from '../core/time/timescales';
import { useSkyStore } from '../state/skyStore';
import { RATE_STEPS, useTimeStore } from '../state/timeStore';
import { useTourStore } from '../state/tourStore';
import { fractionForJd, jdForFraction, timelineTicks } from './timeline';

export const VALIDITY_MESSAGES = {
  extended: 'Outside 1800–2050: planet positions use JPL’s 3000 BC–AD 3000 elements (lower accuracy).',
  'out-of-range': 'Outside 3000 BC–AD 3000: planet positions are extrapolated and only approximate.',
} as const;

export function BottomBar({ catalog }: { catalog: Catalog }) {
  const jdTdb = useTimeStore((s) => s.jdTdb);
  const playing = useTimeStore((s) => s.playing);
  const rateIndex = useTimeStore((s) => s.rateIndex);
  const direction = useTimeStore((s) => s.direction);
  const togglePlaying = useTimeStore((s) => s.togglePlaying);
  const toggleDirection = useTimeStore((s) => s.toggleDirection);
  const setRateIndex = useTimeStore((s) => s.setRateIndex);
  const resetToNow = useTimeStore((s) => s.resetToNow);
  const setJdTdb = useTimeStore((s) => s.setJdTdb);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const status = validityStatus(catalog.bodies, jdTdb);
  const tourActive = useTourStore((s) => s.active);
  const toggleTour = useTourStore((s) => s.toggle);
  const skyRef = useSkyStore((s) => s.ref);
  const skySource = skyRef ? catalog.sources.get(skyRef.sourceId) : undefined;
  const { fraction, outside } = fractionForJd(jdTdb);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement.style;
    const publish = () => root.setProperty('--bottom-bar-height', `${Math.round(el.getBoundingClientRect().height + 16)}px`);
    publish();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      root.removeProperty('--bottom-bar-height');
    };
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseDateInput(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setJdTdb(utcToTdb(parsed.jdUtc));
    setDraft('');
  };

  return (
    <section ref={ref} className="glass bottom-bar" aria-label="Time controls">
      {/* <time>, not <output>: <output> has the implicit ARIA role "status", reserved here for accuracy warnings */}
      <time className="time-bar__date num" aria-label="Simulation date">
        {formatUtc(tdbToUtc(jdTdb))}
      </time>
      <div className="time-bar__controls">
        <button type="button" aria-pressed={direction === -1} onClick={toggleDirection}>
          Reverse
        </button>
        <button type="button" className="primary" onClick={togglePlaying}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <label className="time-bar__speed">
          Speed
          <select value={rateIndex} onChange={(e) => setRateIndex(Number(e.target.value))}>
            {RATE_STEPS.map((step, i) => (
              <option key={step.label} value={i}>
                {step.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => resetToNow()}>
          Now
        </button>
      </div>
      <form className="time-bar__jump" onSubmit={onSubmit}>
        <label htmlFor="date-input">Go to date (UTC)</label>
        <input
          id="date-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="2026-10-04 or -1000-07-12 12:00"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'date-error' : undefined}
          autoComplete="off"
        />
        <button type="submit">Go</button>
        {error && (
          <p id="date-error" className="time-bar__error" role="alert">
            {error}
          </p>
        )}
      </form>
      <button type="button" className="tour-button" data-tour-toggle aria-pressed={tourActive} onClick={toggleTour} title="Guided tour (key T)">
        {tourActive ? 'Stop tour' : 'Tour'}
      </button>
      <div className="timeline">
        <input
          type="range"
          aria-label="Timeline 1800–2050"
          min={0}
          max={1000}
          step={1}
          value={Math.round(fraction * 1000)}
          onChange={(e) => setJdTdb(jdForFraction(Number(e.target.value) / 1000))}
        />
        <ol className="timeline__ticks" aria-hidden="true">
          {timelineTicks().map((t) => (
            <li key={t.year} style={{ left: `${t.fraction * 100}%` }}>
              {t.year}
            </li>
          ))}
        </ol>
        {outside && <p className="timeline__outside">Outside 1800–2050 — use Go to date</p>}
      </div>
      <footer className="bottom-bar__footer">
        {status !== 'high' && (
          <p className="time-bar__warning" role="status">
            {VALIDITY_MESSAGES[status]}
          </p>
        )}
        {skySource && (
          <p className="sky-credit">
            Sky:{' '}
            <a href={skySource.url} target="_blank" rel="noreferrer">
              {skySource.title}
            </a>{' '}
            — {skySource.publisher}
          </p>
        )}
      </footer>
    </section>
  );
}
