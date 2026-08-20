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
   * refilling over time once `regenDelayRemaining` has run out.
   *
   * Fractional, because the refill is a per-tick rate rather than whole points.
   * Nothing rounds it: the costs are checked against the real number, so the
   * readout floors it rather than rounding, and never claims an attack is
   * affordable when it is not.
   *
   * Not the tether. `sim/distance.ts` computes the length of the thing joining
   * the boat to the fish, which is a derived distance and unrelated to this
   * pool. design.md section 2 calls both of them "line", so they will be
   * confused unless the difference is stated where each one lives.
   */
  line: number;
  /** Full stamina pool. A property of the line equipped, same as `hullMax`. */
  lineMax: number;
  /**
   * Ticks left in the dash currently under way, or 0 when not dashing.
   *
   * A dash is committed once started, the same way design.md section 3 commits
   * the fish to a wind-up. A dash that could be steered or cancelled mid-flight
   * would be a strictly better walk, and the panic button is supposed to be a
   * decision with a wrong answer.
   */
  dashTicksRemaining: number;
  /**
   * Which way that dash is going: -1 left, 1 right, 0 when not dashing. Locked
   * at the moment of the input and not read from the keys again.
   */
  dashDirection: number;
  /**
   * Whether the dash key was held on the previous tick, so that a dash needs a
   * fresh press rather than repeating while the key is down.
   *
   * The edge is detected here rather than in the input layer on purpose. In
   * phase 7 the server cannot trust a client to send an honest "pressed this
   * frame", but it can hold the previous tick's raw held state itself and work
   * the edge out. The same code then runs on both sides.
   */
  dashHeld: boolean;
  /**
   * Ticks until the basic attack can be fired again, or 0 when it is ready.
   *
   * One press is one attack regardless of this, so the cooldown is not what
   * stops the key being held down. It is what stops the pool being emptied in a
   * fraction of a second, and from task 1.9 it is the gap the fish's telegraphs
   * have to be read through.
   */
  attackCooldownRemaining: number;
  /**
   * Whether the attack key was held on the previous tick. The same edge
   * detection as `dashHeld` above, done in the same place for the same phase 7
   * reason.
   */
  attackHeld: boolean;
  /**
   * Ticks until the stamina pool starts refilling again, or 0 when it is
   * already refilling. Reset in full by any spend, dash or attack.
   *
   * One counter for both actions rather than one each, because the pool they
   * share is the thing being recovered. A dash taken during an attack's
   * recovery has to buy the whole delay again, which is what makes panicking
   * twice in a row expensive.
   */
  regenDelayRemaining: number;
}

/**
 * Where the fish is in its attack cycle.
 *
 * `windUp` is the telegraph and is the only one of these the player is expected
 * to read. design.md section 3 forbids cancelling it, so there is no transition
 * out of it except into `active`: a phase the fish can back out of would make
 * every read worthless.
 */
export type FishAttackPhase = 'idle' | 'windUp' | 'active' | 'recovery';

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
  /**
   * Which part of the close punisher is running, or `idle` between attempts.
   *
   * Hard-coded to one attack for now. Task 3.1 is what turns this into a
   * selection from a fish definition's pattern list, and task 1.11 is what gives
   * the fish bands to select by; until then a cooldown decides when it commits.
   */
  attackPhase: FishAttackPhase;
  /**
   * Ticks left in whichever phase is currently running. Zero while `idle`.
   *
   * One counter shared by all three phases rather than one each, because exactly
   * one of them is ever running and three counters would allow states that mean
   * nothing, like being half way through a wind-up and a recovery at once.
   */
  attackPhaseTicksRemaining: number;
  /**
   * Ticks until the fish may commit to another attack, counted down while
   * `idle`. Reloaded in full when a recovery ends.
   */
  attackCooldownRemaining: number;
  /**
   * Whether this swing has already connected.
   *
   * The hitbox is live for several ticks and is tested on every one of them, so
   * a boat that dashes into it after it opens is still hit. This is what stops
   * that costing the hull once per tick: one swing is one hit, however long the
   * player stands in it. Cleared when a wind-up ends and the next swing opens.
   */
  attackHasHit: boolean;
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
  /**
   * Whether the dash key is held right now, not whether it was pressed this
   * tick. The simulation works the press edge out itself from `boat.dashHeld`,
   * so this stays a plain snapshot of the hardware and a network client cannot
   * manufacture presses.
   */
  dash: boolean;
  /**
   * Whether the attack key is held right now. Held state for the same reason
   * `dash` is: the press edge is the simulation's to work out, not the input
   * layer's and certainly not a network client's.
   */
  attack: boolean;
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
      dashTicksRemaining: 0,
      dashDirection: 0,
      dashHeld: false,
      attackCooldownRemaining: 0,
      attackHeld: false,
      regenDelayRemaining: 0,
    },
    fish: {
      x: FISH_START_X,
      depth: FISH_START_DEPTH,
      resistance: FISH_RESISTANCE_MAX,
      resistanceMax: FISH_RESISTANCE_MAX,
      // Ready rather than on cooldown, so the fish answers the moment the
      // player closes on it. It opens the fight 100 units clear of the boat,
      // which is outside the hitbox, so this costs nothing on tick one.
      attackPhase: 'idle',
      attackPhaseTicksRemaining: 0,
      attackCooldownRemaining: 0,
      attackHasHit: false,
    },
  };
}

/** No input at all. Useful as a starting value and in tests. */
export function noInputs(): FightInputs {
  return { moveLeft: false, moveRight: false, dash: false, attack: false };
}
