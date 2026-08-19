import { describe, it, expect } from 'vitest';
import {
  accumulate,
  lerp,
  FixedStepDriver,
  TICK_MS,
  MAX_FRAME_MS,
} from '../src/sim/loop.ts';

/** Feed a sequence of frame deltas and collect what came out. */
function run(deltas: number[]): { ticks: number; accumulator: number } {
  let accumulator = 0;
  let ticks = 0;
  for (const delta of deltas) {
    const result = accumulate(accumulator, delta);
    accumulator = result.accumulator;
    ticks += result.ticks;
  }
  return { ticks, accumulator };
}

describe('accumulate', () => {
  it('runs exactly one tick per frame at 60 Hz', () => {
    let accumulator = 0;
    for (let i = 0; i < 60; i++) {
      const result = accumulate(accumulator, TICK_MS);
      expect(result.ticks).toBe(1);
      accumulator = result.accumulator;
    }
  });

  it('catches up with six ticks after a 100 ms frame', () => {
    const result = accumulate(0, 100);
    expect(result.ticks).toBe(6);
    // 100 ms is 6 ticks (99.999 ms) plus a sliver carried forward.
    expect(result.accumulator).toBeCloseTo(100 - 6 * TICK_MS, 10);
  });

  it('runs no tick when a frame is shorter than a tick', () => {
    const result = accumulate(0, 5);
    expect(result.ticks).toBe(0);
    expect(result.accumulator).toBeCloseTo(5, 10);
  });

  it('simulates the same rate at 144 Hz as at 60 Hz', () => {
    const frame144 = 1000 / 144;
    const at144 = run(new Array<number>(144).fill(frame144));
    const at60 = run(new Array<number>(60).fill(TICK_MS));

    // One second of real time is 60 ticks either way. Allow a single tick of
    // slack: a second's worth of 6.94 ms deltas lands either side of the
    // boundary depending on floating point, and the leftover is carried, not
    // lost. The conservation test below is the strict guarantee.
    expect(at144.ticks).toBeGreaterThanOrEqual(59);
    expect(at144.ticks).toBeLessThanOrEqual(60);
    expect(at60.ticks).toBe(60);
  });

  it('neither creates nor loses time', () => {
    const deltas = [16.7, 8.3, 33.4, 4, 21.9, 16.6, 12.2, 40.1];
    const { ticks, accumulator } = run(deltas);
    const fed = deltas.reduce((sum, delta) => sum + delta, 0);

    expect(ticks * TICK_MS + accumulator).toBeCloseTo(fed, 8);
  });

  it('clamps a huge frame instead of spiralling', () => {
    const result = accumulate(0, 5000);
    // Without the clamp this would be 300 ticks in a single frame.
    expect(result.ticks).toBe(Math.floor(MAX_FRAME_MS / TICK_MS));
    expect(result.ticks).toBeLessThan(20);
  });

  it('ignores negative and non-finite deltas', () => {
    expect(accumulate(0, -16).ticks).toBe(0);
    expect(accumulate(0, -16).accumulator).toBe(0);
    expect(accumulate(0, Number.NaN).ticks).toBe(0);
    expect(accumulate(0, Number.POSITIVE_INFINITY).ticks).toBe(0);
  });

  it('keeps alpha within [0, 1)', () => {
    const deltas = [0, 1, 5, TICK_MS, 16.7, 33.4, 100, 5000, -4, Number.NaN];
    let accumulator = 0;
    for (const delta of deltas) {
      const result = accumulate(accumulator, delta);
      expect(result.alpha).toBeGreaterThanOrEqual(0);
      expect(result.alpha).toBeLessThan(1);
      accumulator = result.accumulator;
    }
  });

  it('is deterministic for the same sequence of deltas', () => {
    const deltas = [16.7, 3.2, 48.9, 16.7, 16.7, 0.4, 120];
    expect(run(deltas)).toEqual(run(deltas));
  });
});

describe('lerp', () => {
  it('returns the endpoints at 0 and 1', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('interpolates in between', () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
    expect(lerp(-40, 40, 0.25)).toBe(-20);
  });
});

describe('FixedStepDriver', () => {
  const increment = (n: number): number => n + 1;

  it('steps the state once per tick', () => {
    const driver = new FixedStepDriver(0, increment);
    driver.advance(100);

    expect(driver.totalTicks).toBe(6);
    expect(driver.current).toBe(6);
  });

  it('holds the state one tick behind for interpolation', () => {
    const driver = new FixedStepDriver(0, increment);
    driver.advance(100);

    expect(driver.previous).toBe(5);
    expect(driver.current).toBe(6);
  });

  it('leaves the state alone on a frame too short to tick', () => {
    const driver = new FixedStepDriver(0, increment);
    driver.advance(5);

    expect(driver.totalTicks).toBe(0);
    expect(driver.previous).toBe(0);
    expect(driver.current).toBe(0);
    expect(driver.alpha).toBeGreaterThan(0);
  });

  it('reaches the same state from wildly different frame rates', () => {
    const steady = new FixedStepDriver(0, increment);
    const stuttering = new FixedStepDriver(0, increment);

    for (let i = 0; i < 120; i++) {
      steady.advance(TICK_MS);
    }
    // The same two seconds of real time, delivered in ugly chunks. Every chunk
    // stays under MAX_FRAME_MS, so none of it gets dropped by the clamp.
    const stutter = [
      200, 33.4, 8.1, 16.7, 120, 60, 41.8, 240, 240, 240, 240, 240, 239.9, 80.1,
    ];
    expect(stutter.reduce((sum, delta) => sum + delta, 0)).toBeCloseTo(2000, 6);
    for (const delta of stutter) {
      stuttering.advance(delta);
    }

    expect(steady.totalTicks).toBe(120);
    // Frame pacing must not change the simulation rate. One tick of slack for
    // where the final fraction of a tick lands.
    expect(Math.abs(stuttering.totalTicks - 120)).toBeLessThanOrEqual(1);
    // And the state advanced exactly once per tick, however it was delivered.
    expect(stuttering.current).toBe(stuttering.totalTicks);
    expect(steady.current).toBe(steady.totalTicks);
  });
});
