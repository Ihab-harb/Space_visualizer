import { useEffect, useState } from 'react';
import { SceneRoot } from './scene/SceneRoot';
import { useCatalogStore } from './state/catalogStore';
import { applyUrlOverrides, parseUrlOverrides } from './state/urlParams';
import { InfoPanel } from './ui/InfoPanel';
import { ErrorScreen, LoadingScreen, WebGLUnavailable } from './ui/StatusScreens';
import { SkyCredit } from './ui/SkyCredit';
import { TimeBar } from './ui/TimeBar';
import { TopBar } from './ui/TopBar';
import { isWebGLAvailable } from './ui/webgl';

export function App() {
  const [webgl] = useState(() => isWebGLAvailable());
  const status = useCatalogStore((s) => s.status);
  const catalog = useCatalogStore((s) => s.catalog);
  const error = useCatalogStore((s) => s.error);
  const load = useCatalogStore((s) => s.load);

  useEffect(() => {
    if (webgl && status === 'idle') void load();
  }, [webgl, status, load]);

  useEffect(() => {
    if (status === 'ready' && catalog) applyUrlOverrides(parseUrlOverrides(window.location.search), catalog);
  }, [status, catalog]);

  if (!webgl) return <WebGLUnavailable />;
  if (status === 'error') return <ErrorScreen message={error ?? 'Unknown error'} onRetry={() => void load()} />;
  if (status !== 'ready' || !catalog) return <LoadingScreen />;

  return (
    <div className="app">
      <SceneRoot catalog={catalog} />
      <TopBar />
      <InfoPanel catalog={catalog} />
      <TimeBar catalog={catalog} />
      <SkyCredit catalog={catalog} />
    </div>
  );
}
