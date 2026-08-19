import { describe, it, expect } from 'vitest';
import { stepFight, BOAT_MIN_X, BOAT_MAX_X } from '../src/sim/fight.ts';
import { createFightState, noInputs } from '../src/sim/state.ts';
import type { FightInputs, FightState } from '../src/sim/state.ts';
import { FixedStepDriver, TICK_MS } from '../src/sim/loop.ts';
import {
  BOAT_SPEED_PER_TICK,
  BOAT_WIDTH,
  DEFAULT_HULL_MAX,
  DEFAULT_LINE_MAX,
  FISH_RESISTANCE_MAX,
  INTERNAL_WIDTH,
} from '../src/data/config.ts';

const LEFT: FightInputs = { moveLeft: true, moveRight: false };
const RIGHT: FightInputs = { moveLeft: false, moveRight: true };
const BOTH: FightInputs = { moveLeft: true, moveRight: true };

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
