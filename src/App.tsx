import { useEffect, useState } from 'react';
import { SceneRoot } from './scene/SceneRoot';
import { useCatalogStore } from './state/catalogStore';
import { applyUrlOverrides, parseUrlOverrides } from './state/urlParams';
import { ErrorScreen, LoadingScreen, WebGLUnavailable } from './ui/StatusScreens';
import { AppChrome } from './ui/AppChrome';
import { ExploreOverlay } from './ui/explore/ExploreOverlay';
import { useHotkeys } from './ui/hotkeys';
import { useTourExit } from './ui/useTourExit';
import { isWebGLAvailable } from './ui/webgl';

export function App() {
  useHotkeys();
  useTourExit();
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
      <AppChrome catalog={catalog} />
      <ExploreOverlay catalog={catalog} />
    </div>
  );
}
