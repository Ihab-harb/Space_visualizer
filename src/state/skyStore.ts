import { create } from 'zustand';
import { ImageryFileSchema, type TextureRef } from '../core/catalog/schema';

interface SkyState {
  ref: TextureRef | null;
  status: 'idle' | 'loading' | 'ready' | 'missing';
  load(fetchJson?: (url: string) => Promise<unknown>): Promise<void>;
}

const defaultFetch = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json() as Promise<unknown>;
};

export const useSkyStore = create<SkyState>((set) => ({
  ref: null,
  status: 'idle',
  async load(fetchJson = defaultFetch) {
    set({ status: 'loading' });
    try {
      const parsed = ImageryFileSchema.safeParse(await fetchJson(`${import.meta.env.BASE_URL}textures/imagery.json`));
      const ref = parsed.success ? parsed.data.bodies.sky?.color : undefined;
      set(ref ? { ref, status: 'ready' } : { ref: null, status: 'missing' });
    } catch {
      set({ ref: null, status: 'missing' });
    }
  },
}));
