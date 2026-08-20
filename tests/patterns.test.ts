import { describe, it, expect } from 'vitest';
import {
  CLOSE_PUNISHER_REACH,
  closePunisherHits,
  stepClosePunisher,
} from '../src/sim/ai/patterns.ts';
import { createFightState } from '../src/sim/state.ts';
import type { FishState } from '../src/sim/state.ts';
import {
  BOAT_SPEED_PER_TICK,
  DASH_DISTANCE,
  FISH_CLOSE_ACTIVE_TICKS,
  FISH_CLOSE_COOLDOWN_TICKS,
  FISH_CLOSE_HULL_DAMAGE,
  FISH_CLOSE_RECOVERY_TICKS,
  FISH_CLOSE_WINDUP_TICKS,
} from '../src/data/config.ts';

/**
 * A fish built from a real starting state, so growing FishState cannot silently
 * break these the way it would with a hand-written literal.
 */
function fishAt(overrides: Partial<FishState> = {}): FishState {
  return { ...createFightState().fish, ...overrides };
}

/** The boat's x when it is standing directly above the fish. */
const ON_TOP = createFightState().fish.x;
/** Comfortably outside the hitbox, and outside it by more than one dash. */
const FAR_AWAY = ON_TOP - 200;

/**
 * Run n ticks of the pattern with the boat parked at one x, returning the fish
 * and everything the hull was charged along the way.
 */
function run(
  fish: FishState,
  boatX: number,
  n: number,
): { fish: FishState; totalDamage: number; hits: number } {
  let next = fish;
  let totalDamage = 0;
  let hits = 0;

  for (let i = 0; i < n; i++) {
    const result = stepClosePunisher(next, boatX);
    next = { ...next, ...result };
    totalDamage += result.hullDamage;
    if (result.hullDamage > 0) hits++;
  }
  return { fish: next, totalDamage, hits };
}

describe('closePunisherHits: the hitbox', () => {
  it('catches a boat directly above the fish', () => {
    expect(closePunisherHits(ON_TOP, ON_TOP)).toBe(true);
  });

  it('catches a boat one unit inside the reach', () => {
    expect(closePunisherHits(ON_TOP, ON_TOP + CLOSE_PUNISHER_REACH - 1)).toBe(
      true,
    );
  });

  it('lets a boat flush with the edge go', () => {
    expect(closePunisherHits(ON_TOP, ON_TOP + CLOSE_PUNISHER_REACH)).toBe(
      false,
    );
  });

  it('reaches the same distance on both sides', () => {
    const inside = CLOSE_PUNISHER_REACH - 1;
    expect(closePunisherHits(ON_TOP, ON_TOP - inside)).toBe(true);
    expect(closePunisherHits(ON_TOP, ON_TOP + inside)).toBe(true);
  });

  it('is escapable in one dash, and on foot inside the wind-up', () => {
    // Both of these are why the width and the wind-up are the numbers they are:
    // the dash is insurance rather than the only answer, and reading the tell
    // early enough means walking is enough. A retune that breaks either should
    // fail here rather than during a playtest.
    expect(CLOSE_PUNISHER_REACH).toBeLessThan(DASH_DISTANCE);
    expect(CLOSE_PUNISHER_REACH / BOAT_SPEED_PER_TICK).toBeLessThan(
      FISH_CLOSE_WINDUP_TICKS,
    );
  });
});

describe('stepClosePunisher: committing to an attack', () => {
  it('winds up as soon as the boat is in range', () => {
    const { fish } = run(fishAt(), ON_TOP, 1);

    expect(fish.attackPhase).toBe('windUp');
    expect(fish.attackPhaseTicksRemaining).toBe(FISH_CLOSE_WINDUP_TICKS);
  });

  it('never starts while the boat stays out of range', () => {
    const { fish, totalDamage } = run(fishAt(), FAR_AWAY, 600);

    expect(fish.attackPhase).toBe('idle');
    expect(totalDamage).toBe(0);
  });

  it('counts the cooldown down before checking the range, not after', () => {
    // One tick of cooldown left and the boat already in range: the tick that
    // clears the cooldown is also the tick the wind-up starts on.
    const fish = fishAt({ attackCooldownRemaining: 1 });

    expect(run(fish, ON_TOP, 1).fish.attackPhase).toBe('windUp');
  });

  it('waits out a cooldown that has not expired', () => {
    const fish = fishAt({ attackCooldownRemaining: 10 });
    const { fish: after } = run(fish, ON_TOP, 9);

    expect(after.attackPhase).toBe('idle');
    expect(after.attackCooldownRemaining).toBe(1);
  });
});

describe('stepClosePunisher: the phases', () => {
  it('holds the wind-up for exactly its duration', () => {
    const started = run(fishAt(), ON_TOP, 1).fish;

    expect(
      run(started, ON_TOP, FISH_CLOSE_WINDUP_TICKS - 1).fish.attackPhase,
    ).toBe('windUp');
    expect(run(started, ON_TOP, FISH_CLOSE_WINDUP_TICKS).fish.attackPhase).toBe(
      'active',
    );
  });

  it('holds the active frames for exactly their duration', () => {
    const opened = run(fishAt(), ON_TOP, 1 + FISH_CLOSE_WINDUP_TICKS).fish;

    expect(
      run(opened, ON_TOP, FISH_CLOSE_ACTIVE_TICKS - 1).fish.attackPhase,
    ).toBe('active');
    expect(run(opened, ON_TOP, FISH_CLOSE_ACTIVE_TICKS).fish.attackPhase).toBe(
      'recovery',
    );
  });

  it('holds the recovery for exactly its duration, then reloads the cooldown', () => {
    const recovering = run(
      fishAt(),
      ON_TOP,
      1 + FISH_CLOSE_WINDUP_TICKS + FISH_CLOSE_ACTIVE_TICKS,
    ).fish;

    expect(
      run(recovering, ON_TOP, FISH_CLOSE_RECOVERY_TICKS - 1).fish.attackPhase,
    ).toBe('recovery');

    const idle = run(recovering, ON_TOP, FISH_CLOSE_RECOVERY_TICKS).fish;
    expect(idle.attackPhase).toBe('idle');
    expect(idle.attackCooldownRemaining).toBe(FISH_CLOSE_COOLDOWN_TICKS);
  });

  it('comes back round to a fresh wind-up after exactly one cycle', () => {
    const cycle =
      FISH_CLOSE_WINDUP_TICKS +
      FISH_CLOSE_ACTIVE_TICKS +
      FISH_CLOSE_RECOVERY_TICKS +
      FISH_CLOSE_COOLDOWN_TICKS;

    // One tick to leave idle, then the whole cycle lands the fish back in a
    // wind-up that has just started, having hit once on the way round.
    const { fish, hits } = run(fishAt(), ON_TOP, 1 + cycle);

    expect(fish.attackPhase).toBe('windUp');
    expect(fish.attackPhaseTicksRemaining).toBe(FISH_CLOSE_WINDUP_TICKS);
    expect(hits).toBe(1);
  });
});

describe('stepClosePunisher: commitment', () => {
  it('resolves an attack the boat has already run away from', () => {
    // architecture.md section 9 asks for this by name and design.md section 3
    // calls it non-negotiable: a wind-up that started always finishes.
    const started = run(fishAt(), ON_TOP, 1).fish;
    const { fish, totalDamage } = run(
      started,
      FAR_AWAY,
      FISH_CLOSE_WINDUP_TICKS + FISH_CLOSE_ACTIVE_TICKS,
    );

    expect(fish.attackPhase).toBe('recovery');
    expect(totalDamage).toBe(0);
  });

  it('does not shorten or extend the wind-up based on where the boat is', () => {
    const started = run(fishAt(), ON_TOP, 1).fish;

    expect(
      run(started, FAR_AWAY, FISH_CLOSE_WINDUP_TICKS - 1).fish.attackPhase,
    ).toBe('windUp');
    expect(
      run(started, FAR_AWAY, FISH_CLOSE_WINDUP_TICKS).fish.attackPhase,
    ).toBe('active');
  });
});

describe('stepClosePunisher: landing the hit', () => {
  it('takes the configured damage once', () => {
    const { totalDamage, hits } = run(
      fishAt(),
      ON_TOP,
      1 + FISH_CLOSE_WINDUP_TICKS + FISH_CLOSE_ACTIVE_TICKS,
    );

    expect(hits).toBe(1);
    expect(totalDamage).toBe(FISH_CLOSE_HULL_DAMAGE);
  });

  it('hits a boat that walks in after the hitbox has opened', () => {
    // The box is drawn solid for several ticks, so it has to be live for all of
    // them. Otherwise walking into a visible hitbox costs nothing.
    const opened = run(fishAt(), ON_TOP, 1 + FISH_CLOSE_WINDUP_TICKS).fish;
    const grazed = run(opened, FAR_AWAY, 1).fish;

    expect(grazed.attackPhase).toBe('active');

    const { totalDamage, hits } = run(
      grazed,
      ON_TOP,
      FISH_CLOSE_ACTIVE_TICKS - 1,
    );
    expect(hits).toBe(1);
    expect(totalDamage).toBe(FISH_CLOSE_HULL_DAMAGE);
  });

  it('charges one swing once however long the boat stands in it', () => {
    const opened = run(fishAt(), ON_TOP, 1 + FISH_CLOSE_WINDUP_TICKS).fish;
    const { hits } = run(opened, ON_TOP, FISH_CLOSE_ACTIVE_TICKS);

    expect(hits).toBe(1);
  });

  it('misses entirely when the boat is clear for every active tick', () => {
    const opened = run(fishAt(), ON_TOP, 1 + FISH_CLOSE_WINDUP_TICKS).fish;
    const { totalDamage } = run(opened, FAR_AWAY, FISH_CLOSE_ACTIVE_TICKS);

    expect(totalDamage).toBe(0);
  });
});
