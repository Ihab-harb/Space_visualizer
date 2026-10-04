import { create } from 'zustand';
import type { Catalog } from '../core/catalog/catalog';
import { loadCatalog } from './loadCatalog';

interface CatalogState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  catalog: Catalog | null;
  error: string | null;
  load(fetchImpl?: typeof fetch): Promise<void>;
}

export const useCatalogStore = create<CatalogState>()((set, get) => ({
  status: 'idle',
  catalog: null,
  error: null,
  load: async (fetchImpl) => {
    if (get().status === 'loading') return;
    set({ status: 'loading', error: null });
    try {
      const catalog = await loadCatalog(import.meta.env.BASE_URL, fetchImpl);
      set({ status: 'ready', catalog });
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  },
}));
