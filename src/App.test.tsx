// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCatalogStore } from './state/catalogStore';
import { serveCatalog } from './test/serveCatalog';
import { isWebGLAvailable } from './ui/webgl';
import { App } from './App';

vi.mock('./scene/SceneRoot', () => ({ SceneRoot: () => <div data-testid="scene" /> }));
vi.mock('./ui/webgl', () => ({ isWebGLAvailable: vi.fn(() => true) }));

beforeEach(() => {
  useCatalogStore.setState({ status: 'idle', catalog: null, error: null });
  vi.mocked(isWebGLAvailable).mockReturnValue(true);
  vi.stubGlobal('fetch', serveCatalog());
});

describe('App', () => {
  it('loads the data, then shows the scene and the controls', async () => {
    render(<App />);
    expect(await screen.findByTestId('scene')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Time controls' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Camera view' })).toBeInTheDocument();
  });

  it('shows a readable error with a working retry when data fails to load', async () => {
    vi.stubGlobal('fetch', serveCatalog({ 'regions.json': undefined }));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load data/regions.json (HTTP 404).');
    vi.stubGlobal('fetch', serveCatalog());
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('scene')).toBeInTheDocument();
  });

  it('explains when WebGL is unavailable instead of showing a blank page', () => {
    vi.mocked(isWebGLAvailable).mockReturnValue(false);
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent('3D graphics are not available');
  });
});
