import { useEffect } from 'react';
import { useViewStore } from '../state/viewStore';

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable);

export function TopBar() {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const coRotate = useViewStore((s) => s.coRotate);
  const toggleCoRotate = useViewStore((s) => s.toggleCoRotate);
  const scaleMode = useViewStore((s) => s.scaleMode);
  const setScaleMode = useViewStore((s) => s.setScaleMode);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === '1' || e.key === 'Escape') setView('orbit');
      else if (e.key === '2') setView('follow');
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
      <p className="top-bar__hint">Drag to rotate · right-drag or Shift-drag to pan · scroll to zoom · double-click a body to centre it</p>
    </header>
  );
}
