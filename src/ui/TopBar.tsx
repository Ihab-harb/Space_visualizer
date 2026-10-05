import { useEffect } from 'react';
import { useRenderStore } from '../state/renderStore';
import { useViewStore } from '../state/viewStore';
import type { QualityLevel, QualityMode } from '../render/quality';

const MODE_LABEL: Record<QualityMode, string> = { auto: 'Auto', high: 'High', medium: 'Medium', low: 'Low' };
const LEVEL_LABEL: Record<QualityLevel, string> = { high: 'High', medium: 'Medium', low: 'Low' };

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable);

export function TopBar() {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const coRotate = useViewStore((s) => s.coRotate);
  const toggleCoRotate = useViewStore((s) => s.toggleCoRotate);
  const scaleMode = useViewStore((s) => s.scaleMode);
  const setScaleMode = useViewStore((s) => s.setScaleMode);
  const mode = useRenderStore((s) => s.mode);
  const level = useRenderStore((s) => s.level);
  const setMode = useRenderStore((s) => s.setMode);
  const effects = useRenderStore((s) => s.effects);
  const toggleEffects = useRenderStore((s) => s.toggleEffects);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === '1' || e.key === 'Escape') setView('orbit');
      else if (e.key === '2') setView('follow');
      else if (e.key === 'q' || e.key === 'Q') useRenderStore.getState().cycleMode();
      else if (e.key === 'e' || e.key === 'E') useRenderStore.getState().toggleEffects();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setView]);

  return (
    <header className="panel top-bar">
      <h1 className="top-bar__title">Solar System</h1>
      <div className="segmented" role="group" aria-label="Camera view">
        <button type="button" aria-pressed={view === 'orbit'} onClick={() => setView('orbit')} title="Rotate, zoom and pan around a point (key 1)">
          Orbit
        </button>
        <button type="button" aria-pressed={view === 'follow'} onClick={() => setView('follow')} title="Fly to the selected body and track it (key 2)">
          Follow
        </button>
      </div>
      {view === 'follow' && (
        <label className="toggle">
          <input type="checkbox" checked={coRotate} onChange={toggleCoRotate} />
          Rotate with body
        </label>
      )}
      <div className="segmented" role="group" aria-label="Scale">
        <button type="button" aria-pressed={scaleMode === 'readable'} onClick={() => setScaleMode('readable')} title="Bodies never shrink below a few pixels">
          Readable
        </button>
        <button type="button" aria-pressed={scaleMode === 'true'} onClick={() => setScaleMode('true')} title="Real sizes; labels keep bodies findable">
          True scale
        </button>
      </div>
      <div className="segmented" role="group" aria-label="Quality">
        {(['auto', 'high', 'medium', 'low'] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} title="Rendering quality; Auto adapts to your frame rate (key Q cycles)">
            {m === 'auto' && mode === 'auto' ? `Auto · ${LEVEL_LABEL[level]}` : MODE_LABEL[m]}
          </button>
        ))}
      </div>
      <label className="toggle" title="Bloom stays on; god rays, lens flare, depth of field, grain and the other camera effects switch off (key E)">
        <input type="checkbox" checked={effects} onChange={toggleEffects} />
        Camera effects
      </label>
      <p className="top-bar__hint">Drag to rotate · right-drag or Shift-drag to pan · scroll to zoom · double-click a body to centre it · Q quality · E camera effects</p>
    </header>
  );
}
