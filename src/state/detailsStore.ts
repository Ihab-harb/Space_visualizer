import { useEffect } from 'react';
import { create } from 'zustand';
import { formatIssues } from '../core/catalog/references';
import { BodyDetailsSchema, type BodyDetails } from '../core/details/schema';

export const DETAILS_DIR = 'data/solar-system/details/';

export type DetailsEntry =
  | { status: 'loading' }
  | { status: 'ready'; details: BodyDetails }
  | { status: 'missing' }
  | { status: 'error'; message: string };

interface DetailsState {
  entries: Record<string, DetailsEntry>;
  /** Fetches one body's details once; a no-op if that body already has an entry (loading, ready, missing or error). */
  load(bodyId: string, fetchImpl?: typeof fetch): Promise<void>;
  /** Fetches again after a missing or error entry. */
  retry(bodyId: string, fetchImpl?: typeof fetch): Promise<void>;
}

async function fetchDetails(bodyId: string, fetchImpl: typeof fetch): Promise<DetailsEntry> {
  try {
    const res = await fetchImpl(`${import.meta.env.BASE_URL}${DETAILS_DIR}${bodyId}.json`);
    if (res.status === 404) return { status: 'missing' };
    if (!res.ok) return { status: 'error', message: `Could not load details for ${bodyId} (HTTP ${res.status}).` };
    const parsed = BodyDetailsSchema.safeParse(await res.json());
    if (!parsed.success) {
      return { status: 'error', message: `Invalid details for ${bodyId}:\n${formatIssues(bodyId, parsed.error).slice(0, 5).join('\n')}` };
    }
    if (parsed.data.bodyId !== bodyId) {
      return { status: 'error', message: `Details file for ${bodyId} describes "${parsed.data.bodyId}".` };
    }
    return { status: 'ready', details: parsed.data };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

export const useDetailsStore = create<DetailsState>()((set, get) => {
  const run = async (bodyId: string, fetchImpl?: typeof fetch) => {
    set((s) => ({ entries: { ...s.entries, [bodyId]: { status: 'loading' } } }));
    // The global fetch is read at call time so tests can stub it.
    const entry = await fetchDetails(bodyId, fetchImpl ?? fetch);
    // Always keyed by the id this call was started for.
    set((s) => ({ entries: { ...s.entries, [bodyId]: entry } }));
  };
  return {
    entries: {},
    load: async (bodyId, fetchImpl) => {
      if (get().entries[bodyId]) return;
      await run(bodyId, fetchImpl);
    },
    retry: async (bodyId, fetchImpl) => {
      const current = get().entries[bodyId];
      if (current?.status === 'loading' || current?.status === 'ready') return;
      await run(bodyId, fetchImpl);
    },
  };
});

/** The details entry for a body, starting its load the first time the body is selected. */
export function useBodyDetails(bodyId: string | undefined): DetailsEntry | undefined {
  const entry = useDetailsStore((s) => (bodyId ? s.entries[bodyId] : undefined));
  const load = useDetailsStore((s) => s.load);
  useEffect(() => {
    if (bodyId && !entry) void load(bodyId);
  }, [bodyId, entry, load]);
  return entry;
}

export function readyDetails(entry: DetailsEntry | undefined): BodyDetails | null {
  return entry?.status === 'ready' ? entry.details : null;
}
