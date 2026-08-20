import { describe, it, expect } from 'vitest';
import { stepFight, BOAT_MIN_X, BOAT_MAX_X } from '../src/sim/fight.ts';
import { createFightState, noInputs } from '../src/sim/state.ts';
import type { FightInputs, FightState } from '../src/sim/state.ts';
import { FixedStepDriver, TICK_MS } from '../src/sim/loop.ts';
import { basicAttackDamage } from '../src/sim/damage.ts';
import { lineLength } from '../src/sim/distance.ts';
import {
  ATTACK_COOLDOWN_TICKS,
  ATTACK_LINE_COST,
  BOAT_SPEED_PER_TICK,
  BOAT_WIDTH,
  DASH_DISTANCE,
  DASH_DURATION_TICKS,
  DASH_LINE_COST,
  DEFAULT_HULL_MAX,
  DEFAULT_LINE_MAX,
  FISH_CLOSE_ACTIVE_TICKS,
  FISH_CLOSE_COOLDOWN_TICKS,
  FISH_CLOSE_HULL_DAMAGE,
  FISH_CLOSE_RECOVERY_TICKS,
  FISH_CLOSE_WINDUP_TICKS,
  FISH_RESISTANCE_MAX,
  INTERNAL_WIDTH,
  LINE_REGEN_DELAY_TICKS,
  LINE_REGEN_PER_SECOND,
  LINE_REGEN_PER_TICK,
} from '../src/data/config.ts';

const LEFT: FightInputs = { ...noInputs(), moveLeft: true };
const RIGHT: FightInputs = { ...noInputs(), moveRight: true };
const BOTH: FightInputs = { ...noInputs(), moveLeft: true, moveRight: true };

const DASH_RIGHT: FightInputs = { ...RIGHT, dash: true };
const DASH_LEFT: FightInputs = { ...LEFT, dash: true };
const DASH_NEUTRAL: FightInputs = { ...noInputs(), dash: true };

const ATTACK: FightInputs = { ...noInputs(), attack: true };

/** Run n ticks of one held input. */
function hold(state: FightState, inputs: FightInputs, n: number): FightState {
  let next = state;
  for (let i = 0; i < n; i++) {
    next = stepFight(next, inputs);
  }
  return next;
}

/**
 * The lowest the pool gets over n ticks of one held input.
 *
 * How much was spent cannot be read off the final pool any more, because the
 * refill starts putting it back half a second later. The floor is what says how
 * many times an action was actually charged.
 */
function lowestLine(state: FightState, inputs: FightInputs, n: number): number {
  let next = state;
  let lowest = state.boat.line;

  for (let i = 0; i < n; i++) {
    next = stepFight(next, inputs);
    lowest = Math.min(lowest, next.boat.line);
  }
  return lowest;
}

describe('createFightState: opening resources', () => {
  it('starts both sides on a full bar', () => {
    const start = createFightState();

    expect(start.boat.hull).toBe(start.boat.hullMax);
    expect(start.boat.line).toBe(start.boat.lineMax);
    expect(start.fish.resistance).toBe(start.fish.resistanceMax);
  });

  it('seeds the maxima from the default loadout', () => {
    const start = createFightState();

    expect(start.boat.hullMax).toBe(DEFAULT_HULL_MAX);
    expect(start.boat.lineMax).toBe(DEFAULT_LINE_MAX);
    expect(start.fish.resistanceMax).toBe(FISH_RESISTANCE_MAX);
  });

  // Stamina below hull is deliberate, see decisions.md. Two bars on the same
  // number read as one value shown twice, and they have to be told apart at a
  // glance while being hit.
  it('gives the starting line a smaller pool than the starting hull', () => {
    const start = createFightState();

    expect(start.boat.lineMax).toBeLessThan(start.boat.hullMax);
  });
});

describe('stepFight: boat movement', () => {
  it('moves right by exactly one tick of speed', () => {
    const start = createFightState();
    const after = stepFight(start, RIGHT);

    expect(after.boat.x).toBeCloseTo(start.boat.x + BOAT_SPEED_PER_TICK, 10);
  });

  it('moves left by exactly one tick of speed', () => {
    const start = createFightState();
    const after = stepFight(start, LEFT);

    expect(after.boat.x).toBeCloseTo(start.boat.x - BOAT_SPEED_PER_TICK, 10);
  });

  it('stands still with no input', () => {
    const start = createFightState();
    expect(stepFight(start, noInputs()).boat.x).toBe(start.boat.x);
  });

  it('stands still with both directions held', () => {
    const start = createFightState();
    expect(stepFight(start, BOTH).boat.x).toBe(start.boat.x);
  });

  it('accumulates over many ticks', () => {
    const start = createFightState();
    const after = hold(start, RIGHT, 30);

    expect(after.boat.x).toBeCloseTo(
      start.boat.x + 30 * BOAT_SPEED_PER_TICK,
      8,
    );
  });

  it('counts one tick per step', () => {
    const after = hold(createFightState(), noInputs(), 7);
    expect(after.tick).toBe(7);
  });
});

describe('stepFight: walls', () => {
  // Far more ticks than it takes to cross the lane, so the clamp is what stops
  // the boat rather than the test running out of ticks.
  const PLENTY = 1000;

  it('stops flush against the left wall', () => {
    const after = hold(createFightState(), LEFT, PLENTY);
    expect(after.boat.x).toBe(BOAT_MIN_X);
  });

  it('stops flush against the right wall', () => {
    const after = hold(createFightState(), RIGHT, PLENTY);
    expect(after.boat.x).toBe(BOAT_MAX_X);
  });

  it('keeps the whole hull on screen at both walls', () => {
    const left = hold(createFightState(), LEFT, PLENTY);
    const right = hold(createFightState(), RIGHT, PLENTY);

    expect(left.boat.x - BOAT_WIDTH / 2).toBeGreaterThanOrEqual(0);
    expect(right.boat.x + BOAT_WIDTH / 2).toBeLessThanOrEqual(INTERNAL_WIDTH);
  });

  it('can drive back off a wall', () => {
    const pinned = hold(createFightState(), LEFT, PLENTY);
    const released = stepFight(pinned, RIGHT);

    expect(released.boat.x).toBeCloseTo(BOAT_MIN_X + BOAT_SPEED_PER_TICK, 10);
  });
});

describe('stepFight: dash', () => {
  it('covers exactly the dash distance over the dash duration', () => {
    const start = createFightState();
    // The dash key is up at tick zero, so the first tick is already a press.
    const after = hold(start, DASH_RIGHT, DASH_DURATION_TICKS);

    expect(after.boat.x - start.boat.x).toBeCloseTo(DASH_DISTANCE, 8);
  });

  it('goes left when dashed left', () => {
    const start = createFightState();
    const after = hold(start, DASH_LEFT, DASH_DURATION_TICKS);

    expect(start.boat.x - after.boat.x).toBeCloseTo(DASH_DISTANCE, 8);
  });

  it('outruns walking over the same ticks', () => {
    const start = createFightState();
    const dashed = hold(start, DASH_RIGHT, DASH_DURATION_TICKS);
    const walked = hold(start, RIGHT, DASH_DURATION_TICKS);

    expect(dashed.boat.x).toBeGreaterThan(walked.boat.x);
  });

  it('costs the pool once, not once per tick', () => {
    const start = createFightState();
    const after = hold(start, DASH_RIGHT, DASH_DURATION_TICKS);

    expect(after.boat.line).toBe(start.boat.line - DASH_LINE_COST);
  });

  it('charges at the moment of the press', () => {
    const after = stepFight(createFightState(), DASH_RIGHT);

    expect(after.boat.line).toBe(DEFAULT_LINE_MAX - DASH_LINE_COST);
    expect(after.boat.dashTicksRemaining).toBe(DASH_DURATION_TICKS - 1);
  });

  it('ends cleanly and hands control back to walking', () => {
    const start = createFightState();
    const finished = hold(start, DASH_RIGHT, DASH_DURATION_TICKS);

    expect(finished.boat.dashTicksRemaining).toBe(0);
    expect(finished.boat.dashDirection).toBe(0);

    // Releasing the key and walking on, one ordinary tick of speed.
    const walking = stepFight(finished, RIGHT);
    expect(walking.boat.x - finished.boat.x).toBeCloseTo(
      BOAT_SPEED_PER_TICK,
      10,
    );
  });

  // The commitment. design.md section 3 will not let the fish cancel a wind-up,
  // and the panic button does not get to be a strictly better walk either.
  it('ignores steering for the whole dash, including a reversal', () => {
    const start = createFightState();
    const committed = stepFight(start, DASH_RIGHT);

    // Turn hard the other way, mid-flight, dash key released.
    let state = committed;
    for (let i = 0; i < DASH_DURATION_TICKS - 1; i++) {
      state = stepFight(state, LEFT);
    }

    expect(state.boat.x - start.boat.x).toBeCloseTo(DASH_DISTANCE, 8);
  });

  it('does nothing without a direction', () => {
    const start = createFightState();
    const after = stepFight(start, DASH_NEUTRAL);

    expect(after.boat.x).toBe(start.boat.x);
    expect(after.boat.line).toBe(start.boat.line);
    expect(after.boat.dashTicksRemaining).toBe(0);
  });

  it('does nothing with both directions held', () => {
    const start = createFightState();
    const after = stepFight(start, { ...BOTH, dash: true });

    expect(after.boat.x).toBe(start.boat.x);
    expect(after.boat.line).toBe(start.boat.line);
  });

  it('refuses to start on a pool that cannot pay in full', () => {
    const start = createFightState();
    const broke: FightState = {
      ...start,
      boat: { ...start.boat, line: DASH_LINE_COST - 1 },
    };
    const after = stepFight(broke, DASH_RIGHT);

    // Still walks. It is a refusal to dash, not a refusal to move. Nothing was
    // charged, so the pool went up by one tick of refill rather than down.
    expect(after.boat.line).toBeCloseTo(
      broke.boat.line + LINE_REGEN_PER_TICK,
      8,
    );
    expect(after.boat.dashTicksRemaining).toBe(0);
    expect(after.boat.x - broke.boat.x).toBeCloseTo(BOAT_SPEED_PER_TICK, 10);
  });

  it('starts on a pool holding exactly the cost', () => {
    const start = createFightState();
    const exact: FightState = {
      ...start,
      boat: { ...start.boat, line: DASH_LINE_COST },
    };
    const after = stepFight(exact, DASH_RIGHT);

    expect(after.boat.line).toBe(0);
    expect(after.boat.dashTicksRemaining).toBe(DASH_DURATION_TICKS - 1);
  });

  // Holding shift would otherwise empty the whole pool without a second
  // decision being made.
  it('does not chain while the key stays held', () => {
    const start = createFightState();
    const lowest = lowestLine(start, DASH_RIGHT, DASH_DURATION_TICKS * 4);

    // The floor rather than the final pool: four dash durations is long enough
    // for the refill to have started putting the one dash back.
    expect(lowest).toBe(DEFAULT_LINE_MAX - DASH_LINE_COST);
  });

  it('dashes again once the key is released and pressed afresh', () => {
    const start = createFightState();
    const first = hold(start, DASH_RIGHT, DASH_DURATION_TICKS);
    const released = stepFight(first, noInputs());
    const second = stepFight(released, DASH_RIGHT);

    expect(second.boat.line).toBe(DEFAULT_LINE_MAX - 2 * DASH_LINE_COST);
  });

  it('cannot start a second dash during the first', () => {
    const start = createFightState();
    let state = stepFight(start, DASH_RIGHT);

    // Release and press again mid-dash. The dash under way owns the boat.
    state = stepFight(state, RIGHT);
    state = stepFight(state, DASH_LEFT);

    expect(state.boat.line).toBe(DEFAULT_LINE_MAX - DASH_LINE_COST);
    expect(state.boat.dashDirection).toBe(1);
  });

  it('spends the pool even when the dash is eaten by a wall', () => {
    const pinned = hold(createFightState(), RIGHT, 1000);
    const after = hold(pinned, DASH_RIGHT, DASH_DURATION_TICKS);

    expect(after.boat.x).toBe(BOAT_MAX_X);
    expect(after.boat.line).toBe(pinned.boat.line - DASH_LINE_COST);
  });

  it('runs the pool down over five dashes and then refuses', () => {
    let state = createFightState();

    // Five is what the default pool buys. Each dash is the full duration plus
    // one released tick so the next press registers as an edge.
    for (let i = 0; i < 5; i++) {
      state = hold(state, DASH_RIGHT, DASH_DURATION_TICKS);
      state = stepFight(state, noInputs());
    }
    expect(state.boat.line).toBe(DEFAULT_LINE_MAX - 5 * DASH_LINE_COST);
    expect(state.boat.line).toBe(0);

    const sixth = stepFight(state, DASH_LEFT);
    expect(sixth.boat.dashTicksRemaining).toBe(0);
  });
});

describe('stepFight: basic attack', () => {
  /** What the fish would take from where this state's boat is standing. */
  function expectedDamage(state: FightState): number {
    return basicAttackDamage(lineLength(state.boat, state.fish));
  }

  it('charges the pool at the moment of the press', () => {
    const start = createFightState();
    const after = stepFight(start, ATTACK);

    expect(after.boat.line).toBe(DEFAULT_LINE_MAX - ATTACK_LINE_COST);
    expect(after.boat.attackCooldownRemaining).toBe(ATTACK_COOLDOWN_TICKS);
  });

  it('takes the resistance the curve says it should', () => {
    const start = createFightState();
    const after = stepFight(start, ATTACK);

    expect(after.fish.resistance).toBe(
      start.fish.resistance - expectedDamage(after),
    );
  });

  // design.md section 2's central tradeoff, and the reason the movement axis
  // carries three meanings at once. If this ever stops holding, the fight has
  // stopped being about position.
  it('hits harder from directly above the fish than from the wall', () => {
    const start = createFightState();
    const overhead: FightState = {
      ...start,
      boat: { ...start.boat, x: start.fish.x },
    };
    const wall: FightState = {
      ...start,
      boat: { ...start.boat, x: BOAT_MIN_X },
    };

    const close =
      start.fish.resistance - stepFight(overhead, ATTACK).fish.resistance;
    const far = start.fish.resistance - stepFight(wall, ATTACK).fish.resistance;

    expect(close).toBeGreaterThan(far);
  });

  it('does not attack every tick while the key stays held', () => {
    const start = createFightState();
    const after = hold(start, ATTACK, 200);

    // 200 ticks is ten cooldowns, so a key repeat would have emptied the pool
    // several times over. One press is one attack, and the floor is what shows
    // it: by tick 200 the refill has long since topped the pool back up.
    expect(lowestLine(start, ATTACK, 200)).toBe(
      DEFAULT_LINE_MAX - ATTACK_LINE_COST,
    );
    expect(after.fish.resistance).toBe(
      start.fish.resistance - expectedDamage(after),
    );
  });

  it('refuses a fresh press while the cooldown is running', () => {
    const start = createFightState();
    const first = stepFight(start, ATTACK);

    // Released and pressed again well inside the cooldown.
    const released = stepFight(first, noInputs());
    const second = stepFight(released, ATTACK);

    expect(second.boat.line).toBe(DEFAULT_LINE_MAX - ATTACK_LINE_COST);
  });

  it('fires again on a fresh press once the cooldown has run out', () => {
    const start = createFightState();
    let state = stepFight(start, ATTACK);
    state = hold(state, noInputs(), ATTACK_COOLDOWN_TICKS);

    expect(state.boat.attackCooldownRemaining).toBe(0);

    const second = stepFight(state, ATTACK);
    expect(second.boat.line).toBe(DEFAULT_LINE_MAX - 2 * ATTACK_LINE_COST);
  });

  it('refuses entirely on a pool that cannot pay in full', () => {
    const start = createFightState();
    const broke: FightState = {
      ...start,
      boat: { ...start.boat, line: ATTACK_LINE_COST - 1 },
    };
    const after = stepFight(broke, ATTACK);

    // Nothing charged, so the pool rose by a tick of refill instead.
    expect(after.boat.line).toBeCloseTo(
      broke.boat.line + LINE_REGEN_PER_TICK,
      8,
    );
    expect(after.fish.resistance).toBe(start.fish.resistance);
    expect(after.boat.attackCooldownRemaining).toBe(0);
  });

  it('fires on a pool holding exactly the cost', () => {
    const start = createFightState();
    const exact: FightState = {
      ...start,
      boat: { ...start.boat, line: ATTACK_LINE_COST },
    };
    const after = stepFight(exact, ATTACK);

    expect(after.boat.line).toBe(0);
    expect(after.fish.resistance).toBeLessThan(start.fish.resistance);
  });

  it('runs the pool down over ten attacks and then refuses', () => {
    let state = createFightState();

    // Ten is what the default pool buys. Each attack is a press, a release, and
    // the cooldown, so the next press registers as an edge on a ready attack.
    for (let i = 0; i < 10; i++) {
      state = stepFight(state, ATTACK);
      state = hold(state, noInputs(), ATTACK_COOLDOWN_TICKS);
    }
    expect(state.boat.line).toBe(0);

    const resistanceLeft = state.fish.resistance;
    const eleventh = stepFight(state, ATTACK);

    expect(eleventh.fish.resistance).toBe(resistanceLeft);
  });

  it('lands during a dash without disturbing it', () => {
    const start = createFightState();
    const dashing = stepFight(start, DASH_RIGHT);

    // Attacking mid-flight. The dash key is released, so this is not a second
    // dash press; the pool pays for both actions.
    const attacked = hold(dashing, ATTACK, DASH_DURATION_TICKS - 1);

    expect(attacked.boat.x - start.boat.x).toBeCloseTo(DASH_DISTANCE, 8);
    expect(attacked.boat.line).toBe(
      DEFAULT_LINE_MAX - DASH_LINE_COST - ATTACK_LINE_COST,
    );
    expect(attacked.fish.resistance).toBeLessThan(start.fish.resistance);
  });

  // The win state is task 1.12. Until then the fish sits at zero rather than
  // going negative and dragging the bar backwards.
  it('clamps resistance at zero rather than going negative', () => {
    const start = createFightState();
    const nearlyLanded: FightState = {
      ...start,
      fish: { ...start.fish, resistance: 1 },
    };
    const after = stepFight(nearlyLanded, ATTACK);

    expect(after.fish.resistance).toBe(0);
  });

  it('leaves the fish alone when nothing is pressed', () => {
    const start = createFightState();
    const after = hold(start, RIGHT, 300);

    expect(after.fish.resistance).toBe(start.fish.resistance);
  });
});

describe('stepFight: the pool refills', () => {
  /**
   * This suite used to assert the pool never rises at all. Task 1.8 is the one
   * task allowed to change that, and this is that change: the rule is now that
   * it only rises when nothing has been spent for the delay, and never past
   * the maximum.
   *
   * It exists because a playtest of 1.6 reported the stamina regenerating
   * before anything regenerated it. That turned out to be a page reload, but
   * nothing in the suite could have told the two apart. Now that a refill is
   * real, the guard has to be that it refills on exactly the rule intended.
   */
  const START_EMPTY: FightState = (() => {
    const start = createFightState();
    return { ...start, boat: { ...start.boat, line: 0 } };
  })();

  it('never exceeds the maximum, under any combination of inputs', () => {
    const combinations: FightInputs[] = [];
    for (const moveLeft of [false, true]) {
      for (const moveRight of [false, true]) {
        for (const dash of [false, true]) {
          for (const attack of [false, true]) {
            combinations.push({ moveLeft, moveRight, dash, attack });
          }
        }
      }
    }

    let state = createFightState();

    // Several hundred ticks, cycling the inputs so dashes and attacks start,
    // finish, get interrupted and are re-pressed against every steering
    // combination, with the refill running between them throughout.
    for (let tick = 0; tick < 600; tick++) {
      state = stepFight(state, combinations[tick % combinations.length]);

      expect(state.boat.line).toBeLessThanOrEqual(state.boat.lineMax);
      expect(state.boat.line).toBeGreaterThanOrEqual(0);
    }
  });

  it('refills at the rate it is configured with', () => {
    const after = hold(START_EMPTY, noInputs(), 60);

    expect(after.boat.line).toBeCloseTo(LINE_REGEN_PER_SECOND, 8);
  });

  it('fills an empty pool in about the time the rate implies', () => {
    const ticks = Math.ceil(DEFAULT_LINE_MAX / LINE_REGEN_PER_TICK);

    // A tick of slack, because eight hundred additions of a per-tick rate land
    // a hair either side of the total and the cap is what makes it exact.
    expect(hold(START_EMPTY, noInputs(), ticks + 1).boat.line).toBe(
      DEFAULT_LINE_MAX,
    );

    // And not appreciably sooner, which is what catches a rate set too high.
    expect(hold(START_EMPTY, noInputs(), ticks - 60).boat.line).toBeLessThan(
      DEFAULT_LINE_MAX,
    );
  });

  it('tops out at the maximum rather than overfilling', () => {
    const after = hold(createFightState(), noInputs(), 600);

    expect(after.boat.line).toBe(DEFAULT_LINE_MAX);
  });

  // The Dark Souls rule, and where most of the feel lives. Recovering has to be
  // something the player disengages to do.
  it('does not refill at all during the delay after a spend', () => {
    const start = createFightState();
    const dashed = stepFight(start, DASH_RIGHT);

    let state = dashed;
    for (let i = 0; i < LINE_REGEN_DELAY_TICKS - 1; i++) {
      state = stepFight(state, noInputs());
      expect(state.boat.line).toBe(dashed.boat.line);
    }

    // The tick the counter reaches zero is the tick the refill resumes on.
    expect(stepFight(state, noInputs()).boat.line).toBeGreaterThan(
      dashed.boat.line,
    );
  });

  it('starts the delay again from the top on a second spend', () => {
    const start = createFightState();
    let state = stepFight(start, DASH_RIGHT);

    // Most of the way through the first delay, then attack.
    state = hold(state, noInputs(), LINE_REGEN_DELAY_TICKS - 5);
    state = stepFight(state, ATTACK);

    const spent = state.boat.line;

    // The five ticks left on the old delay do not carry the refill forward:
    // the whole delay has to run again from the attack.
    state = hold(state, noInputs(), LINE_REGEN_DELAY_TICKS - 1);
    expect(state.boat.line).toBe(spent);
  });

  // Falls out of the delay rather than being coded: the dash's own cost pauses
  // the refill for longer than the dash itself lasts.
  it('does not refill mid-dash', () => {
    const start = createFightState();
    const dashing = stepFight(start, DASH_RIGHT);
    const finished = hold(dashing, noInputs(), DASH_DURATION_TICKS - 1);

    expect(finished.boat.dashTicksRemaining).toBe(0);
    expect(finished.boat.line).toBe(DEFAULT_LINE_MAX - DASH_LINE_COST);
  });

  // The contest design.md section 2 is built on. If the refill ever outran
  // attacking, the pool would stop being a resource and start being decoration.
  it('cannot keep up with attacking at full cadence', () => {
    let state = createFightState();

    // Press, release, press again the moment the cooldown allows it, for as
    // long as the pool holds out.
    for (let i = 0; i < 10; i++) {
      state = stepFight(state, ATTACK);
      state = hold(state, noInputs(), ATTACK_COOLDOWN_TICKS);
    }

    expect(state.boat.line).toBeLessThan(DEFAULT_LINE_MAX / 2);
  });

  // Task 1.9 retired the old version of this, which asserted the hull was never
  // touched at all. The fish is what touches it now, and only from close range.
  it('leaves the hull alone while the boat keeps its distance', () => {
    const start = createFightState();
    const after = hold(start, LEFT, 600);

    expect(after.boat.hull).toBe(start.boat.hull);
  });
});

describe('stepFight: the fish punishes standing close', () => {
  /** Long enough for the fish to wind up and swing once. */
  const ONE_SWING = 1 + FISH_CLOSE_WINDUP_TICKS + FISH_CLOSE_ACTIVE_TICKS;

  /** A fight with the boat parked directly above the fish. */
  function overhead(overrides: Partial<FightState['boat']> = {}): FightState {
    const start = createFightState();
    return {
      ...start,
      boat: { ...start.boat, x: start.fish.x, ...overrides },
    };
  }

  it('takes the hull damage the close punisher is worth', () => {
    const after = hold(overhead(), noInputs(), ONE_SWING);

    expect(after.boat.hull).toBe(DEFAULT_HULL_MAX - FISH_CLOSE_HULL_DAMAGE);
  });

  it('ends the boat in four swings', () => {
    // The whole point of pricing the damage against the hull. Four cycles plus
    // the tick that leaves idle, and there is nothing left.
    const cycle =
      FISH_CLOSE_WINDUP_TICKS +
      FISH_CLOSE_ACTIVE_TICKS +
      FISH_CLOSE_RECOVERY_TICKS +
      FISH_CLOSE_COOLDOWN_TICKS;
    const after = hold(overhead(), noInputs(), 1 + 4 * cycle);

    expect(after.boat.hull).toBe(0);
  });

  // The lose state is task 1.12. Until then the hull sits at zero rather than
  // going negative and dragging its bar backwards, the same as resistance does.
  it('clamps the hull at zero rather than going negative', () => {
    const after = hold(overhead({ hull: 1 }), noInputs(), ONE_SWING);

    expect(after.boat.hull).toBe(0);
  });

  // The 1.9 decision, pinned so it cannot drift back into a Souls roll by
  // accident. The dash is 55 units of distance, and distance is the only thing
  // it buys: a dash that stays inside the box is a dash that gets hit.
  it('grants no invulnerability frames to a dash inside the hitbox', () => {
    // Winding up already, so the active frames land during the dash rather than
    // after it. The dash is towards the fish, so the boat cannot leave the box.
    const winding = hold(overhead(), noInputs(), FISH_CLOSE_WINDUP_TICKS);
    expect(winding.fish.attackPhase).toBe('windUp');

    const dashed = hold(winding, DASH_LEFT, DASH_DURATION_TICKS - 1);

    // Still mid-dash when the hull was charged, which is the whole point.
    expect(dashed.boat.dashTicksRemaining).toBeGreaterThan(0);
    expect(dashed.boat.hull).toBe(DEFAULT_HULL_MAX - FISH_CLOSE_HULL_DAMAGE);
  });

  it('lets a boat that dashes clear of the box off entirely', () => {
    // The same attack, answered by moving instead of by phasing. One dash
    // covers more ground than the box reaches, which is what makes reading the
    // tell worth anything.
    const winding = hold(overhead(), noInputs(), 1);
    expect(winding.fish.attackPhase).toBe('windUp');

    const after = hold(
      winding,
      DASH_LEFT,
      FISH_CLOSE_WINDUP_TICKS + FISH_CLOSE_ACTIVE_TICKS,
    );

    expect(after.fish.attackPhase).toBe('recovery');
    expect(after.boat.hull).toBe(DEFAULT_HULL_MAX);
  });

  it('never attacks a boat that stays across the lane', () => {
    const after = hold(createFightState(), LEFT, 600);

    expect(after.fish.attackPhase).toBe('idle');
    expect(after.boat.hull).toBe(DEFAULT_HULL_MAX);
  });
});

describe('stepFight: purity', () => {
  // FixedStepDriver holds the previous state by reference for interpolation.
  // If step mutated, previous and current would be the same object and the
  // renderer would have nothing to blend between.
  it('returns a new state and leaves the old one untouched', () => {
    const start = createFightState();
    const startX = start.boat.x;
    const after = stepFight(start, RIGHT);

    expect(after).not.toBe(start);
    expect(after.boat).not.toBe(start.boat);
    expect(start.boat.x).toBe(startX);
    expect(start.tick).toBe(0);
  });

  // stepFight builds a fresh state object every tick, so any field it forgets
  // to carry forward silently disappears one tick into the fight.
  //
  // Away from the fish rather than towards it, deliberately. The fish is
  // entitled to change once the boat is inside its reach, so driving right here
  // would be asserting that it does nothing while walking into its hitbox.
  it('carries the fish forward unchanged while the boat keeps away', () => {
    const start = createFightState();
    const after = hold(start, LEFT, 300);

    expect(after.fish).toEqual(start.fish);
  });

  // The fish used to be carried forward by reference. The basic attack writes
  // to its resistance, so it is now rebuilt field by field like the boat, and
  // it falls into the same trap: a field left unnamed there disappears one tick
  // into the fight.
  it('rebuilds the fish rather than sharing it, keeping every field', () => {
    const start = createFightState();
    const after = stepFight(start, ATTACK);

    expect(after.fish).not.toBe(start.fish);
    expect(after.fish.x).toBe(start.fish.x);
    expect(after.fish.depth).toBe(start.fish.depth);
    expect(after.fish.resistanceMax).toBe(start.fish.resistanceMax);
    expect(after.fish.attackPhase).toBe(start.fish.attackPhase);
    expect(after.fish.attackPhaseTicksRemaining).toBe(
      start.fish.attackPhaseTicksRemaining,
    );
    expect(after.fish.attackCooldownRemaining).toBe(
      start.fish.attackCooldownRemaining,
    );
    expect(after.fish.attackHasHit).toBe(start.fish.attackHasHit);
    expect(start.fish.resistance).toBe(FISH_RESISTANCE_MAX);
  });

  // The boat object is rebuilt every tick around the one field that changes,
  // so it falls into the same trap the fish test above guards against.
  // Away from the fish, for the same reason as the fish test above: the hull is
  // no longer untouchable, it is untouched by anything the boat does itself.
  it('carries the boat resources forward unchanged', () => {
    const start = createFightState();
    const after = hold(start, LEFT, 300);

    expect(after.boat.hull).toBe(start.boat.hull);
    expect(after.boat.hullMax).toBe(start.boat.hullMax);
    expect(after.boat.line).toBe(start.boat.line);
    expect(after.boat.lineMax).toBe(start.boat.lineMax);
  });

  it('is deterministic', () => {
    const a = hold(createFightState(), RIGHT, 25);
    const b = hold(createFightState(), RIGHT, 25);

    expect(a).toEqual(b);
  });
});

describe('boat movement through the fixed timestep', () => {
  it('travels the same distance at any frame rate', () => {
    const step = (state: FightState): FightState => stepFight(state, RIGHT);
    const steady = new FixedStepDriver<FightState>(createFightState(), step);
    const stuttering = new FixedStepDriver<FightState>(
      createFightState(),
      step,
    );

    // Two seconds of real time each. Every stutter chunk stays under
    // MAX_FRAME_MS so none of it is dropped by the spiral-of-death clamp.
    for (let i = 0; i < 120; i++) {
      steady.advance(TICK_MS);
    }
    const stutter = [
      200, 33.4, 8.1, 16.7, 120, 60, 41.8, 240, 240, 240, 240, 240, 239.9, 80.1,
    ];
    for (const delta of stutter) {
      stuttering.advance(delta);
    }

    // Same two seconds means the same 120 ticks of travel, give or take where
    // the final fraction of a tick lands.
    const drift = Math.abs(stuttering.current.boat.x - steady.current.boat.x);
    expect(drift).toBeLessThanOrEqual(BOAT_SPEED_PER_TICK);
  });

  it('interpolates between two distinct states while moving', () => {
    const driver = new FixedStepDriver<FightState>(
      createFightState(),
      (state) => stepFight(state, RIGHT),
    );
    driver.advance(100);

    expect(driver.previous.boat.x).not.toBe(driver.current.boat.x);
    expect(driver.alpha).toBeGreaterThanOrEqual(0);
    expect(driver.alpha).toBeLessThan(1);
  });
});
