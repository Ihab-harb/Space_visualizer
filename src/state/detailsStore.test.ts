// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMarsDetails } from '../test/detailsFixtures';
import { useBodyDetails, useDetailsStore } from './detailsStore';

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
beforeEach(() => useDetailsStore.setState({ entries: {} }));

describe('detailsStore', () => {
  it('loads, validates and caches a body', async () => {
    const fetchImpl = vi.fn(() => ok(makeMarsDetails()));
    await useDetailsStore.getState().load('mars', fetchImpl as unknown as typeof fetch);
    await useDetailsStore.getState().load('mars', fetchImpl as unknown as typeof fetch);
    expect(useDetailsStore.getState().entries.mars).toMatchObject({ status: 'ready' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('does not start a second fetch for concurrent loads of the same body', async () => {
    const fetchImpl = vi.fn(() => ok(makeMarsDetails()));
    const f = fetchImpl as unknown as typeof fetch;
    await Promise.all([useDetailsStore.getState().load('mars', f), useDetailsStore.getState().load('mars', f)]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(useDetailsStore.getState().entries.mars).toMatchObject({ status: 'ready' });
  });
  it('reports missing on 404 and error on a schema failure or a wrong bodyId (Review Focus #4)', async () => {
    const s = useDetailsStore.getState();
    await s.load('venus', (() => Promise.resolve(new Response('', { status: 404 }))) as unknown as typeof fetch);
    await s.load('earth', (() => ok({ nonsense: true })) as unknown as typeof fetch);
    await s.load('jupiter', (() => ok(makeMarsDetails())) as unknown as typeof fetch);
    expect(useDetailsStore.getState().entries).toMatchObject({ venus: { status: 'missing' }, earth: { status: 'error' }, jupiter: { status: 'error' } });
  });
  it('retries after an error', async () => {
    await useDetailsStore.getState().load('mars', (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch);
    expect(useDetailsStore.getState().entries.mars).toMatchObject({ status: 'error' });
    await useDetailsStore.getState().retry('mars', (() => ok(makeMarsDetails())) as unknown as typeof fetch);
    expect(useDetailsStore.getState().entries.mars).toMatchObject({ status: 'ready' });
  });
  it('never puts one body’s late response under another body (Review Focus #3)', async () => {
    let resolveMars!: (r: Response) => void;
    const marsPending = new Promise<Response>((r) => (resolveMars = r));
    const p = useDetailsStore.getState().load('mars', (() => marsPending) as unknown as typeof fetch);
    await useDetailsStore.getState().load('venus', (() => Promise.resolve(new Response('', { status: 404 }))) as unknown as typeof fetch);
    resolveMars(new Response(JSON.stringify(makeMarsDetails()), { status: 200 }));
    await p;
    expect(useDetailsStore.getState().entries.venus).toEqual({ status: 'missing' });
    expect(useDetailsStore.getState().entries.mars).toMatchObject({ status: 'ready', details: { bodyId: 'mars' } });
  });
  it('useBodyDetails starts loading the selected body', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok(makeMarsDetails())));
    const { result } = renderHook(() => useBodyDetails('mars'));
    await waitFor(() => expect(result.current).toMatchObject({ status: 'ready' }));
    vi.unstubAllGlobals();
  });
});
