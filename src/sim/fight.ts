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
  DASH_DURATION_TICKS,
  DASH_LINE_COST,
  DASH_SPEED_PER_TICK,
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

  let { line, dashDirection, dashTicksRemaining } = state.boat;

  // A fresh press, not the key being held. Holding shift would otherwise empty
  // the pool into five back-to-back dashes without another decision being made.
  const dashPressed = inputs.dash && !state.boat.dashHeld;

  // Every condition here is a refusal to start, and all of them are silent. A
  // dash that fired at half price or in no particular direction would be worse
  // than one that does not fire: the pool is the only thing limiting the panic
  // button, so it cannot be part-charged.
  if (
    dashTicksRemaining === 0 &&
    dashPressed &&
    direction !== 0 &&
    line >= DASH_LINE_COST
  ) {
    line -= DASH_LINE_COST;
    dashDirection = direction;
    dashTicksRemaining = DASH_DURATION_TICKS;
  }

  let x: number;

  if (dashTicksRemaining > 0) {
    // Steering input is ignored for the whole dash, including a reversal. This
    // is the commitment: the cost is paid up front and the distance is not
    // negotiable afterwards. Walls still clamp, and a dash into one is spent
    // rather than refunded, because the input was made.
    x = clamp(
      state.boat.x + dashDirection * DASH_SPEED_PER_TICK,
      BOAT_MIN_X,
      BOAT_MAX_X,
    );

    dashTicksRemaining -= 1;
    if (dashTicksRemaining === 0) {
      dashDirection = 0;
    }
  } else {
    x = clamp(
      state.boat.x + direction * BOAT_SPEED_PER_TICK,
      BOAT_MIN_X,
      BOAT_MAX_X,
    );
  }

  // The boat object is rebuilt from scratch every tick, so every field has to
  // be named here or it silently disappears one tick into the fight. Nothing
  // spends hull yet: 1.7 charges the attack, 1.8 refills the pool and 1.9
  // damages the hull.
  //
  // The fish is static until task 1.11, so its state is carried forward by
  // reference rather than copied. Safe only while nothing writes to it: the
  // moment the AI lands, this becomes a new object like the boat's.
  return {
    tick: state.tick + 1,
    boat: {
      x,
      hull: state.boat.hull,
      hullMax: state.boat.hullMax,
      line,
      lineMax: state.boat.lineMax,
      dashTicksRemaining,
      dashDirection,
      dashHeld: inputs.dash,
    },
    fish: state.fish,
  };
}
