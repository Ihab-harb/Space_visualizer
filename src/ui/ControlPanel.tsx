import { useEffect, useRef } from 'react';
import type { QualityLevel, QualityMode } from '../render/quality';
import { useRenderStore } from '../state/renderStore';
import { useUiStore } from '../state/uiStore';
import { useViewStore } from '../state/viewStore';

const MODE_LABEL: Record<QualityMode, string> = { auto: 'Auto', high: 'High', medium: 'Medium', low: 'Low' };
const LEVEL_LABEL: Record<QualityLevel, string> = { high: 'High', medium: 'Medium', low: 'Low' };

/** CSS custom property the drawer uses to sit below this panel, whose height grows when its controls wrap. */
export const CONTROL_PANEL_BOTTOM_VAR = '--control-panel-bottom';

export function ControlPanel() {
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
  const controlsOpen = useUiStore((s) => s.controlsOpen);
  const toggleControls = useUiStore((s) => s.toggleControls);

  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement.style;
    const publish = () => root.setProperty(CONTROL_PANEL_BOTTOM_VAR, `${Math.round(el.getBoundingClientRect().bottom)}px`);
    publish();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      root.removeProperty(CONTROL_PANEL_BOTTOM_VAR);
    };
  }, []);

  return (
    <nav ref={ref} className={controlsOpen ? 'glass control-panel is-open' : 'glass control-panel'} aria-label="Controls">
      <button type="button" className="control-panel__toggle" aria-expanded={controlsOpen} onClick={toggleControls}>
        Controls
      </button>
      <div className="control-panel__body">
        <div className="group">
          <span className="group__label">View</span>
          <div className="segmented" role="group" aria-label="Camera view">
            <button type="button" aria-pressed={view === 'orbit'} onClick={() => setView('orbit')} title="Rotate, zoom and pan around a point (key 1)">Orbit</button>
            <button type="button" aria-pressed={view === 'follow'} onClick={() => setView('follow')} title="Fly to the selected body and track it (key 2)">Follow</button>
          </div>
          {view === 'follow' && (
            <label className="toggle">
              <input type="checkbox" checked={coRotate} onChange={toggleCoRotate} />
              Rotate with body
            </label>
          )}
        </div>
        <div className="group">
          <span className="group__label">Style</span>
          <div className="segmented" role="group" aria-label="Style">
            <button type="button" aria-pressed="true" title="Official NASA/USGS/STScI imagery">Realistic</button>
            <button type="button" disabled title="Exhibit mode arrives in M2c">Exhibit</button>
          </div>
        </div>
        <div className="group">
          <span className="group__label">Scale</span>
          <div className="segmented" role="group" aria-label="Scale">
            <button type="button" aria-pressed={scaleMode === 'readable'} onClick={() => setScaleMode('readable')} title="Bodies never shrink below a few pixels">Readable</button>
            <button type="button" aria-pressed={scaleMode === 'true'} onClick={() => setScaleMode('true')} title="Real sizes; labels keep bodies findable">True scale</button>
          </div>
        </div>
        <div className="group">
          <span className="group__label">Quality</span>
          <div className="segmented" role="group" aria-label="Quality">
            {(['auto', 'high', 'medium', 'low'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} title="Rendering quality; Auto adapts to your frame rate (key Q cycles)">
                {m === 'auto' && mode === 'auto' ? `Auto · ${LEVEL_LABEL[level]}` : MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <label className="toggle" title="Bloom stays on; god rays, lens flare, depth of field, grain and the other camera effects switch off (key E)">
          <input type="checkbox" checked={effects} onChange={toggleEffects} />
          Camera effects
        </label>
        <p className="control-panel__hint">1/2 view · Q quality · E effects · F facts · T tour · drag, right-drag and scroll to move</p>
      </div>
    </nav>
  );
}
