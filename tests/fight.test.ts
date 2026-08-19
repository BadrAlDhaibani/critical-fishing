import { describe, it, expect } from 'vitest';
import { stepFight, BOAT_MIN_X, BOAT_MAX_X } from '../src/sim/fight.ts';
import { createFightState, noInputs } from '../src/sim/state.ts';
import type { FightInputs, FightState } from '../src/sim/state.ts';
import { FixedStepDriver, TICK_MS } from '../src/sim/loop.ts';
import {
  BOAT_SPEED_PER_TICK,
  BOAT_WIDTH,
  DASH_DISTANCE,
  DASH_DURATION_TICKS,
  DASH_LINE_COST,
  DEFAULT_HULL_MAX,
  DEFAULT_LINE_MAX,
  FISH_RESISTANCE_MAX,
  INTERNAL_WIDTH,
} from '../src/data/config.ts';

const LEFT: FightInputs = { moveLeft: true, moveRight: false, dash: false };
const RIGHT: FightInputs = { moveLeft: false, moveRight: true, dash: false };
const BOTH: FightInputs = { moveLeft: true, moveRight: true, dash: false };

const DASH_RIGHT: FightInputs = { ...RIGHT, dash: true };
const DASH_LEFT: FightInputs = { ...LEFT, dash: true };
const DASH_NEUTRAL: FightInputs = { ...noInputs(), dash: true };

/** Run n ticks of one held input. */
function hold(state: FightState, inputs: FightInputs, n: number): FightState {
  let next = state;
  for (let i = 0; i < n; i++) {
    next = stepFight(next, inputs);
  }
  return next;
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

    // Still walks. It is a refusal to dash, not a refusal to move.
    expect(after.boat.line).toBe(DASH_LINE_COST - 1);
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
    const after = hold(start, DASH_RIGHT, DASH_DURATION_TICKS * 4);

    expect(after.boat.line).toBe(DEFAULT_LINE_MAX - DASH_LINE_COST);
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

describe('stepFight: the pool only goes down', () => {
  /**
   * Task 1.8 is what adds regeneration, and it is expected to change this test
   * deliberately. Until then a failure here is a real regression: a pool that
   * quietly refills makes the dash free and takes the contest out of design.md
   * section 2's contested resource.
   *
   * This exists because a playtest of 1.6 reported the stamina regenerating.
   * It was a page reload restarting the fight, not the simulation, but nothing
   * in the suite would have distinguished the two.
   */
  it('never rises, under any combination of inputs', () => {
    const combinations: FightInputs[] = [];
    for (const moveLeft of [false, true]) {
      for (const moveRight of [false, true]) {
        for (const dash of [false, true]) {
          combinations.push({ moveLeft, moveRight, dash });
        }
      }
    }

    let state = createFightState();

    // Several hundred ticks, cycling the inputs so dashes start, finish, get
    // interrupted and are re-pressed against every steering combination.
    for (let tick = 0; tick < 600; tick++) {
      const inputs = combinations[tick % combinations.length];
      const next = stepFight(state, inputs);

      expect(next.boat.line).toBeLessThanOrEqual(state.boat.line);
      state = next;
    }
  });

  it('never rises above the pool it started with', () => {
    const start = createFightState();
    const after = hold(start, DASH_RIGHT, 600);

    expect(after.boat.line).toBeLessThanOrEqual(start.boat.lineMax);
  });

  it('leaves the hull alone entirely, since nothing damages it yet', () => {
    const start = createFightState();
    const after = hold(start, DASH_RIGHT, 600);

    expect(after.boat.hull).toBe(start.boat.hull);
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
  it('carries the fish forward unchanged', () => {
    const start = createFightState();
    const after = hold(start, RIGHT, 300);

    expect(after.fish).toEqual(start.fish);
  });

  // The boat object is rebuilt every tick around the one field that changes,
  // so it falls into the same trap the fish test above guards against.
  it('carries the boat resources forward unchanged', () => {
    const start = createFightState();
    const after = hold(start, RIGHT, 300);

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
