/**
 * Fight state types. Pure data, no Phaser, no logic.
 *
 * architecture.md section 1: this is what the simulation takes in and hands
 * back, and in phase 7 it is what crosses the wire. Nothing in here may know
 * how anything is drawn.
 */

import {
  BOAT_START_X,
  DEFAULT_HULL_MAX,
  DEFAULT_LINE_MAX,
  FISH_RESISTANCE_MAX,
  FISH_START_DEPTH,
  FISH_START_X,
} from '../data/config.ts';

export interface BoatState {
  /**
   * Horizontal position in internal-resolution units, at the centre of the
   * hull. The only axis the player controls: design.md section 2, and the
   * "one movement axis" decision in decisions.md.
   */
  x: number;
  /** Health. Reaches zero and the fight is lost. design.md section 2. */
  hull: number;
  /**
   * Full hull, so the bar has something to divide by.
   *
   * On the state rather than in config because it is a property of the boat the
   * player has unlocked, not a constant of the game. Phase 4 gear and phase 7
   * per-player boats seed a different number here and nothing else changes.
   */
  hullMax: number;
  /**
   * The contested stamina resource. Spent by both dashing and attacking, and
   * regenerating over time from task 1.8.
   *
   * Not the tether. `sim/distance.ts` computes the length of the thing joining
   * the boat to the fish, which is a derived distance and unrelated to this
   * pool. design.md section 2 calls both of them "line", so they will be
   * confused unless the difference is stated where each one lives.
   */
  line: number;
  /** Full stamina pool. A property of the line equipped, same as `hullMax`. */
  lineMax: number;
}

export interface FishState {
  /** Horizontal position in internal-resolution units, at the fish's centre. */
  x: number;
  /**
   * How far below the water surface the fish is, in the same units. Not a
   * screen y: the surface is depth 0 and the boat sits on it, so the simulation
   * never has to know where the waterline was drawn.
   *
   * design.md section 2: both axes are AI-driven, never random. Static until
   * task 1.11.
   */
  depth: number;
  /** The fish's health. Reaches zero and it is landed. design.md section 2. */
  resistance: number;
  /**
   * Full resistance. On the state for the same reason the boat's maxima are:
   * design.md section 3 scales it by rarity and section 4 scales it by player
   * count, so it is a per-fish and per-room number rather than a constant.
   */
  resistanceMax: number;
}

export interface FightState {
  /** Ticks since the fight began. Every duration in the fight counts in these. */
  tick: number;
  boat: BoatState;
  fish: FishState;
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

/**
 * A fight at tick zero. Boat centred, fish off to one side and mid-water, and
 * every pool full on both sides.
 *
 * The only place the default loadout's numbers are read. Everything downstream
 * takes its maxima off the state, so equipping a different boat later means
 * seeding this differently and changing nothing else.
 */
export function createFightState(): FightState {
  return {
    tick: 0,
    boat: {
      x: BOAT_START_X,
      hull: DEFAULT_HULL_MAX,
      hullMax: DEFAULT_HULL_MAX,
      line: DEFAULT_LINE_MAX,
      lineMax: DEFAULT_LINE_MAX,
    },
    fish: {
      x: FISH_START_X,
      depth: FISH_START_DEPTH,
      resistance: FISH_RESISTANCE_MAX,
      resistanceMax: FISH_RESISTANCE_MAX,
    },
  };
}

/** No input at all. Useful as a starting value and in tests. */
export function noInputs(): FightInputs {
  return { moveLeft: false, moveRight: false };
}
