import { useState, type FormEvent } from 'react';
import type { Catalog } from '../core/catalog/catalog';
import { validityStatus } from '../core/ephemeris/state';
import { formatUtc, parseDateInput } from '../core/time/format';
import { tdbToUtc, utcToTdb } from '../core/time/timescales';
import { RATE_STEPS, useTimeStore } from '../state/timeStore';

export const VALIDITY_MESSAGES = {
  extended: 'Outside 1800–2050: planet positions use JPL’s 3000 BC–AD 3000 elements (lower accuracy).',
  'out-of-range': 'Outside 3000 BC–AD 3000: planet positions are extrapolated and only approximate.',
} as const;

export function TimeBar({ catalog }: { catalog: Catalog }) {
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
    <section className="panel time-bar" aria-label="Time controls">
      {/* <time>, not <output>: <output> has the implicit ARIA role "status", reserved here for accuracy warnings */}
      <time className="time-bar__date" aria-label="Simulation date">
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
      {status !== 'high' && (
        <p className="time-bar__warning" role="status">
          {VALIDITY_MESSAGES[status]}
        </p>
      )}
    </section>
  );
}
