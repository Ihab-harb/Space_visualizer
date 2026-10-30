import type { Catalog } from '../core/catalog/catalog';
import { useExploreStore } from '../state/exploreStore';
import { BottomBar } from './BottomBar';
import { ControlPanel } from './ControlPanel';
import { FactsDrawer } from './FactsDrawer';
import { Header } from './Header';

/** The normal interface. Explore steps it aside: nothing is rendered while it is open. */
export function AppChrome({ catalog }: { catalog: Catalog }) {
  const exploring = useExploreStore((s) => s.active);
  if (exploring) return null;
  return (
    <>
      <Header catalog={catalog} />
      <ControlPanel />
      <FactsDrawer catalog={catalog} />
      <BottomBar catalog={catalog} />
    </>
  );
}
