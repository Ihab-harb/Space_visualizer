// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createPointerInput } from './input';

describe('createPointerInput', () => {
  it('zooms when the wheel is used over a label on top of the canvas', () => {
    const scene = document.createElement('div');
    const canvas = document.createElement('canvas');
    const label = document.createElement('button');
    scene.append(canvas, label);
    document.body.append(scene);
    const input = createPointerInput();
    const detach = input.attach(canvas, scene);
    label.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
    expect(input.consume().zoom).toBe(100);
    detach();
    label.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
    expect(input.consume().zoom).toBe(0);
  });
});
