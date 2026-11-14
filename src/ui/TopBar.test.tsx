// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
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
