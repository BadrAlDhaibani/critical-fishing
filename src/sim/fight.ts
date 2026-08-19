/**
 * The fight simulation. Pure TypeScript, no Phaser, no globals, no randomness.
 *
 * architecture.md section 1: this is the code that moves to the Colyseus server
 * in phase 7, so it takes inputs and previous state and returns new state, and
 * does nothing else.
 *
 * There is no `dt` parameter. architecture.md section 3 fixes the timestep at
 * 60 Hz, so one call to stepFight is exactly one tick, and every duration in
 * here counts in ticks. A dt argument would only be an invitation to derive
 * gameplay timing from a render delta, which is the one thing that must not
 * happen.
 */

import {
  BOAT_SPEED_PER_TICK,
  BOAT_WIDTH,
  INTERNAL_WIDTH,
} from '../data/config.ts';
import type { FightInputs, FightState } from './state.ts';

/**
 * Leftmost and rightmost the boat's centre may sit, so the hull never leaves
 * the lane. Derived rather than tuned: they follow from the hull width.
 */
export const BOAT_MIN_X = BOAT_WIDTH / 2;
export const BOAT_MAX_X = INTERNAL_WIDTH - BOAT_WIDTH / 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Advance the fight by exactly one tick.
 *
 * Returns a new state object and never mutates the one passed in. This is not
 * stylistic. FixedStepDriver keeps the previous state by reference so the
 * renderer can interpolate towards the current one; mutating in place would
 * make both names point at the same object, and interpolation would quietly
 * stop working while still looking almost right.
 */
export function stepFight(state: FightState, inputs: FightInputs): FightState {
  // Holding both directions cancels to a standstill rather than favouring one
  // of them. Nothing is gained by picking a winner, and a tie that resolves to
  // movement reads as the game ignoring an input.
  const direction = (inputs.moveRight ? 1 : 0) - (inputs.moveLeft ? 1 : 0);

  const x = clamp(
    state.boat.x + direction * BOAT_SPEED_PER_TICK,
    BOAT_MIN_X,
    BOAT_MAX_X,
  );

  return {
    tick: state.tick + 1,
    boat: { x },
  };
}
