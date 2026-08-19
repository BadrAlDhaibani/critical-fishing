import { describe, it, expect } from 'vitest';
import { barFillWidth } from '../src/game/render/barGeometry.ts';

const WIDTH = 100;

describe('barFillWidth', () => {
  it('is empty at zero', () => {
    expect(barFillWidth(0, 100, WIDTH)).toBe(0);
  });

  it('is full at max', () => {
    expect(barFillWidth(100, 100, WIDTH)).toBe(WIDTH);
  });

  it('is half at half', () => {
    expect(barFillWidth(50, 100, WIDTH)).toBe(WIDTH / 2);
  });

  it('scales against a max that is not the bar width', () => {
    // The fish's 400 resistance in a 100 unit bar.
    expect(barFillWidth(300, 400, WIDTH)).toBe(75);
  });

  // The readability rule this function exists for. A boat on 1 hull is alive,
  // and a bar showing nothing says it is not.
  it('draws at least one unit for any value above zero', () => {
    expect(barFillWidth(1, 100, WIDTH)).toBe(1);
    expect(barFillWidth(0.01, 400, WIDTH)).toBe(1);
  });

  it('only reads empty at exactly zero', () => {
    expect(barFillWidth(0.0001, 100, WIDTH)).toBeGreaterThan(0);
    expect(barFillWidth(0, 100, WIDTH)).toBe(0);
  });

  it('clamps a value above max to a full bar', () => {
    expect(barFillWidth(150, 100, WIDTH)).toBe(WIDTH);
  });

  it('clamps a negative value to empty', () => {
    // An overkill hit can drive a hull below zero before the loss state reads it.
    expect(barFillWidth(-20, 100, WIDTH)).toBe(0);
  });

  it('survives a max of zero without dividing by it', () => {
    expect(barFillWidth(10, 0, WIDTH)).toBe(0);
  });

  // Fractional widths land on a half pixel, which the nearest-neighbour upscale
  // renders as a soft edge next to rectangles that have none.
  it('always returns a whole number of units', () => {
    for (let value = 0; value <= 400; value += 7) {
      expect(Number.isInteger(barFillWidth(value, 400, WIDTH))).toBe(true);
    }
  });
});
