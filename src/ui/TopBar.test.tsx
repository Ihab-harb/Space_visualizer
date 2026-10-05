// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRenderStore } from '../state/renderStore';
import { useViewStore } from '../state/viewStore';
import { TopBar } from './TopBar';

beforeEach(() => useViewStore.setState({ view: 'orbit', coRotate: false, scaleMode: 'readable' }));

describe('TopBar', () => {
  it('switches views with buttons and shows co-rotation only in follow view', async () => {
    const user = userEvent.setup();
    render(<TopBar />);
    expect(screen.queryByLabelText('Rotate with body')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Follow' }));
    expect(useViewStore.getState().view).toBe('follow');
    expect(screen.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByLabelText('Rotate with body'));
    expect(useViewStore.getState().coRotate).toBe(true);
  });

  it('supports keys 1, 2 and Escape, but not while typing', async () => {
    const user = userEvent.setup();
    render(
      <>
        <TopBar />
        <input aria-label="typing" />
      </>,
    );
    await user.keyboard('2');
    expect(useViewStore.getState().view).toBe('follow');
    await user.keyboard('{Escape}');
    expect(useViewStore.getState().view).toBe('orbit');
    await user.click(screen.getByLabelText('typing'));
    await user.keyboard('2');
    expect(useViewStore.getState().view).toBe('orbit');
  });

  it('switches scale mode', async () => {
    const user = userEvent.setup();
    render(<TopBar />);
    await user.click(screen.getByRole('button', { name: 'True scale' }));
    expect(useViewStore.getState().scaleMode).toBe('true');
  });
});

describe('quality and camera effects', () => {
  beforeEach(() => useRenderStore.setState({ mode: 'auto', level: 'high', effects: true }));
  it('shows the Auto level and switches quality from the buttons', async () => {
    render(<TopBar />);
    expect(screen.getByRole('button', { name: /Auto · High/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Medium' }));
    expect(useRenderStore.getState()).toMatchObject({ mode: 'medium', level: 'medium' });
  });
  it('cycles quality with Q and toggles effects with E, but not while typing', async () => {
    render(
      <>
        <TopBar />
        <input aria-label="typing" />
      </>,
    );
    await userEvent.keyboard('q');
    expect(useRenderStore.getState().mode).toBe('high');
    await userEvent.keyboard('e');
    expect(useRenderStore.getState().effects).toBe(false);
    await userEvent.click(screen.getByRole('textbox', { name: 'typing' }));
    await userEvent.keyboard('qe');
    expect(useRenderStore.getState()).toMatchObject({ mode: 'high', effects: false });
  });
  it('toggles camera effects from the checkbox', async () => {
    render(<TopBar />);
    await userEvent.click(screen.getByRole('checkbox', { name: /Camera effects/ }));
    expect(useRenderStore.getState().effects).toBe(false);
  });
});
