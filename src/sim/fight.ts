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
  ATTACK_COOLDOWN_TICKS,
  ATTACK_LINE_COST,
  BOAT_SPEED_PER_TICK,
  BOAT_WIDTH,
  DASH_DURATION_TICKS,
  DASH_LINE_COST,
  DASH_SPEED_PER_TICK,
  INTERNAL_WIDTH,
  LINE_REGEN_DELAY_TICKS,
  LINE_REGEN_PER_TICK,
} from '../data/config.ts';
import { basicAttackDamage } from './damage.ts';
import { lineLength } from './distance.ts';
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

  // Counted down before the press is looked at, so a cooldown of exactly one
  // tick is over by the time the next input arrives rather than swallowing it.
  let attackCooldownRemaining = Math.max(
    0,
    state.boat.attackCooldownRemaining - 1,
  );
  let resistance = state.fish.resistance;

  const attackPressed = inputs.attack && !state.boat.attackHeld;

  // All or nothing, the same as the dash above. A pool that cannot pay the
  // whole cost fires nothing rather than a weaker hit, so the last few points
  // in the bar are a decision about which action to spend them on rather than
  // a fraction of both.
  //
  // Nothing here consults the dash. design.md section 2 makes the shared pool
  // the thing that limits both, and attacking out of a dash is a real choice
  // rather than a free one: it is the stamina that would have bought the next
  // dodge.
  if (
    attackPressed &&
    attackCooldownRemaining === 0 &&
    line >= ATTACK_LINE_COST
  ) {
    line -= ATTACK_LINE_COST;
    attackCooldownRemaining = ATTACK_COOLDOWN_TICKS;

    // Measured from the x this tick just resolved, not the one the tick opened
    // on, so a hit landed while moving is priced at the position the boat
    // actually ends up in and the debug readout agrees with what was dealt.
    const damage = basicAttackDamage(lineLength({ x }, state.fish));
    resistance = Math.max(0, resistance - damage);
  }

  // Any spend at all restarts the delay, read off the pool itself rather than
  // from a flag each action has to remember to set. Both a dash and an attack
  // in the same tick is still one delay, which is correct: it is the pool
  // recovering, not the actions.
  const spent = line < state.boat.line;
  const regenDelayRemaining = spent
    ? LINE_REGEN_DELAY_TICKS
    : Math.max(0, state.boat.regenDelayRemaining - 1);

  if (regenDelayRemaining === 0) {
    line = Math.min(state.boat.lineMax, line + LINE_REGEN_PER_TICK);
  }

  // Both objects are rebuilt from scratch every tick, so every field has to be
  // named here or it silently disappears one tick into the fight. Nothing
  // touches hull yet: 1.9 is what damages it.
  //
  // The fish used to be carried forward by reference, which was only ever safe
  // while nothing wrote to it. The basic attack writes to it.
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
      attackCooldownRemaining,
      attackHeld: inputs.attack,
      regenDelayRemaining,
    },
    fish: {
      x: state.fish.x,
      depth: state.fish.depth,
      resistance,
      resistanceMax: state.fish.resistanceMax,
    },
  };
}
