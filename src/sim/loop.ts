/**
 * Fixed timestep clock. Pure TypeScript, no Phaser, no globals.
 *
 * architecture.md section 3: the simulation advances at a fixed 60 Hz,
 * accumulated and decoupled from the render loop. Gameplay timing is never
 * derived from a render delta, so a friend on a 144 Hz monitor plays exactly
 * the same fight as one on a 60 Hz laptop. Durations elsewhere in sim/ are
 * expressed in ticks, never in seconds or rendered frames.
 */

/** Simulation rate. Not a tunable: changing it changes every tuned duration. */
export const TICK_HZ = 60;

/** Real milliseconds one simulation tick represents. */
export const TICK_MS = 1000 / TICK_HZ;

/**
 * Longest frame delta the accumulator will honour.
 *
 * A backgrounded tab, a breakpoint or a garbage collection pause can hand us a
 * multi-second delta. Without this clamp the loop would try to catch up by
 * running hundreds of ticks in one frame, which takes longer than a frame, so
 * the next delta is larger still: the spiral of death. Clamping drops the
 * missed time instead, which is the right trade for a game.
 */
export const MAX_FRAME_MS = 250;

export interface AccumulateResult {
  /** Whole simulation ticks to run for this frame. */
  ticks: number;
  /** Real milliseconds carried into the next frame. Always in [0, TICK_MS). */
  accumulator: number;
  /**
   * Fraction of the way from the previous tick to the next, in [0, 1).
   * The render layer interpolates between the last two states by this amount.
   */
  alpha: number;
}

/**
 * Advance the accumulator by one frame's worth of real time.
 *
 * Pure: same inputs, same result, every time. The caller owns the accumulator
 * value and threads it through frames.
 */
export function accumulate(
  accumulator: number,
  frameMs: number,
): AccumulateResult {
  // A non-finite or negative delta contributes nothing rather than corrupting
  // the accumulator. Browsers do occasionally hand out a negative first delta.
  const safeFrameMs =
    Number.isFinite(frameMs) && frameMs > 0
      ? Math.min(frameMs, MAX_FRAME_MS)
      : 0;

  const total = accumulator + safeFrameMs;
  const ticks = Math.floor(total / TICK_MS);
  const remainder = Math.max(0, total - ticks * TICK_MS);

  return {
    ticks,
    accumulator: remainder,
    alpha: remainder / TICK_MS,
  };
}

/** Linear interpolation, for the render layer to blend two simulation states. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Drives a simulation state forward at the fixed rate and keeps the previous
 * state around so rendering can interpolate between the two.
 *
 * Generic over the state type on purpose: it knows how to run a clock, not what
 * a fight is.
 */
export class FixedStepDriver<TState> {
  private accumulatorMs = 0;
  private alphaValue = 0;
  private previousState: TState;
  private currentState: TState;
  private readonly stepFn: (state: TState) => TState;

  /** Total ticks run since construction. Useful for debug readouts and tests. */
  public totalTicks = 0;

  constructor(initialState: TState, step: (state: TState) => TState) {
    this.previousState = initialState;
    this.currentState = initialState;
    this.stepFn = step;
  }

  /** Feed one frame of real elapsed time. Runs zero or more fixed ticks. */
  advance(frameMs: number): number {
    const result = accumulate(this.accumulatorMs, frameMs);
    this.accumulatorMs = result.accumulator;
    this.alphaValue = result.alpha;

    for (let i = 0; i < result.ticks; i++) {
      this.previousState = this.currentState;
      this.currentState = this.stepFn(this.currentState);
    }

    this.totalTicks += result.ticks;
    return result.ticks;
  }

  /** State as of the tick before last. Render blends from here. */
  get previous(): TState {
    return this.previousState;
  }

  /** State as of the most recent tick. Render blends to here. */
  get current(): TState {
    return this.currentState;
  }

  /** Blend factor between previous and current, in [0, 1). */
  get alpha(): number {
    return this.alphaValue;
  }
}
