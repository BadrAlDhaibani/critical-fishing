/**
 * Fight state types. Pure data, no Phaser, no logic.
 *
 * architecture.md section 1: this is what the simulation takes in and hands
 * back, and in phase 7 it is what crosses the wire. Nothing in here may know
 * how anything is drawn.
 */

import { BOAT_START_X } from '../data/config.ts';

export interface BoatState {
  /**
   * Horizontal position in internal-resolution units, at the centre of the
   * hull. The only axis the player controls: design.md section 2, and the
   * "one movement axis" decision in decisions.md.
   */
  x: number;
}

export interface FightState {
  /** Ticks since the fight began. Every duration in the fight counts in these. */
  tick: number;
  boat: BoatState;
}

/**
 * What the player is asking for on a given tick.
 *
 * Lives in sim/ rather than game/ because it is the simulation's own contract:
 * game/input/ produces one of these from the keyboard, and in phase 7 the
 * server receives one from the network. sim/ can never import from game/.
 */
export interface FightInputs {
  moveLeft: boolean;
  moveRight: boolean;
}

/** A fight at tick zero. Boat centred, nothing else in the water yet. */
export function createFightState(): FightState {
  return {
    tick: 0,
    boat: { x: BOAT_START_X },
  };
}

/** No input at all. Useful as a starting value and in tests. */
export function noInputs(): FightInputs {
  return { moveLeft: false, moveRight: false };
}
