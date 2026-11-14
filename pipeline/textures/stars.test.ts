import { describe, expect, it } from 'vitest';
import { findBrightBlobs, linearToSrgb8, ORIENTATION_STARS, pixelToRaDec, raDecToPixel, verifySkyOrientation } from './stars';

const W = 720;
const H = 360;

function skyWith(stars: Array<{ raDeg: number; decDeg: number }>, mirror = false): Float32Array {
  const img = new Float32Array(W * H).fill(0.1);
  for (const s of stars) {
    let { x, y } = raDecToPixel(s.raDeg, s.decDeg, W, H);
    if (mirror) x = W - 1 - x;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) img[(y + dy) * W + ((x + dx + W) % W)] = 1;
  }
  return img;
}

describe('star map orientation', () => {
  it('maps the centre column to RA 0 with RA increasing to the left and north at the top', () => {
    expect(pixelToRaDec(W / 2, 0, W, H).decDeg).toBeCloseTo(90 - 90 / H, 6);
    expect(pixelToRaDec(W / 2, H / 2, W, H).raDeg).toBeCloseTo(359.75, 1);
    const p = raDecToPixel(90, 0, W, H);
    expect(p.x).toBeLessThan(W / 2);
  });
  it('round-trips pixel and sky coordinates', () => {
    const p = raDecToPixel(213.9, 19.2, W, H);
    const back = pixelToRaDec(p.x, p.y, W, H);
    expect(back.raDeg).toBeCloseTo(213.9, 0);
    expect(back.decDeg).toBeCloseTo(19.2, 0);
  });
  it('finds blobs, including one straddling the RA seam', () => {
    const img = new Float32Array(W * H);
    for (const x of [W - 1, 0]) img[100 * W + x] = 1;
    const blobs = findBrightBlobs(img, W, H, 0.9);
    expect(blobs).toHaveLength(1);
    expect(blobs[0]!.pixels).toBe(2);
  });
  it('accepts a correctly oriented sky and rejects a mirrored one', () => {
    expect(verifySkyOrientation(skyWith(ORIENTATION_STARS), W, H).missing).toEqual([]);
    expect(verifySkyOrientation(skyWith(ORIENTATION_STARS, true), W, H).matched.length).toBeLessThan(3);
  });
  it('encodes linear light as sRGB bytes', () => {
    expect([...linearToSrgb8(Float32Array.from([0, 0.5, 1]), 1)]).toEqual([0, 188, 255]);
  });
});
