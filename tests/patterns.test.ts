import { describe, it, expect } from 'vitest';
import {
  CLOSE_PUNISHER_REACH,
  FAR_SHOT_REACH,
  closePunisherHits,
  shotFlightTicks,
  stepFishAttack,
  stepProjectiles,
} from '../src/sim/ai/patterns.ts';
import { createFightState } from '../src/sim/state.ts';
import type {
  FishAttackKind,
  FishState,
  ProjectileState,
} from '../src/sim/state.ts';
import {
  BOAT_SPEED_PER_TICK,
  DASH_DISTANCE,
  FISH_CLOSE_ACTIVE_TICKS,
  FISH_CLOSE_COOLDOWN_TICKS,
  FISH_CLOSE_HULL_DAMAGE,
  FISH_CLOSE_RECOVERY_TICKS,
  FISH_CLOSE_WINDUP_TICKS,
  FISH_FAR_ACTIVE_TICKS,
  FISH_FAR_COOLDOWN_TICKS,
  FISH_FAR_HULL_DAMAGE,
  FISH_FAR_RECOVERY_TICKS,
  FISH_FAR_RISE_PER_TICK,
  FISH_FAR_SHOT_COUNT,
  FISH_FAR_SHOT_INTERVAL_TICKS,
  FISH_FAR_TRACK_PER_TICK,
  FISH_FAR_WINDUP_TICKS,
  FISH_START_DEPTH,
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
 * A fish already in the close band, which is what selects the close punisher.
 *
 * The band is state and `stepFishAttack` only reads it, so these tests set it
 * rather than getting there by standing somewhere: `sim/distance.ts` decides
 * which band a length falls in and `tests/distance.test.ts` is where that is
 * tested. Everything here is about what the fish does once it has decided.
 */
const IN_CLOSE_BAND = { band: 'close' } as const;

interface Run {
  fish: FishState;
  totalDamage: number;
  hits: number;
  /** Every shot fired during the run, oldest first. */
  spawned: ProjectileState[];
  /** Which tick of the run each of those was fired on. */
  spawnTicks: number[];
  /** Every attack the fish committed to during the run. */
  kinds: Set<FishAttackKind>;
}

/**
 * Run n ticks of the pattern with the boat parked at one x, returning the fish
 * and everything it did along the way.
 */
function run(fish: FishState, boatX: number, n: number): Run {
  let next = fish;
  let totalDamage = 0;
  let hits = 0;
  const spawned: ProjectileState[] = [];
  const spawnTicks: number[] = [];
  const kinds = new Set<FishAttackKind>();

  for (let i = 0; i < n; i++) {
    const result = stepFishAttack(next, boatX);
    next = { ...next, ...result };
    totalDamage += result.hullDamage;
    if (result.hullDamage > 0) hits++;
    for (const shot of result.spawned) {
      spawned.push(shot);
      spawnTicks.push(i);
    }
    if (result.attackKind !== null) kinds.add(result.attackKind);
  }
  return { fish: next, totalDamage, hits, spawned, spawnTicks, kinds };
}

/** Run n ticks of the shots in the air with the boat parked at one x. */
function fly(
  projectiles: ProjectileState[],
  boatX: number,
  n: number,
): { projectiles: ProjectileState[]; totalDamage: number } {
  let next = projectiles;
  let totalDamage = 0;

  for (let i = 0; i < n; i++) {
    const result = stepProjectiles(next, boatX);
    next = result.projectiles;
    totalDamage += result.hullDamage;
  }
  return { projectiles: next, totalDamage };
}

/** One shot, fired from where the fish starts the fight and aimed straight up. */
function shotAt(x: number, depth = FISH_START_DEPTH, vx = 0): ProjectileState {
  return { x, depth, vx };
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

describe('the close punisher: committing to an attack', () => {
  it('winds up as soon as the boat is in range', () => {
    const { fish } = run(fishAt(IN_CLOSE_BAND), ON_TOP, 1);

    expect(fish.attackPhase).toBe('windUp');
    expect(fish.attackKind).toBe('close');
    expect(fish.attackPhaseTicksRemaining).toBe(FISH_CLOSE_WINDUP_TICKS);
  });

  // The band picks which attack; the hitbox still picks whether it is worth
  // starting. The close band is a good deal wider than the box at its centre, so
  // this is the ordinary case of being drawn in rather than an edge case, and
  // what the fish does about it is swim, which `tests/bands.test.ts` covers.
  it('commits to nothing at all while the boat is out of reach', () => {
    const { fish, kinds, totalDamage } = run(
      fishAt(IN_CLOSE_BAND),
      FAR_AWAY,
      600,
    );

    expect(fish.attackPhase).toBe('idle');
    expect(kinds.size).toBe(0);
    expect(totalDamage).toBe(0);
  });

  it('does not swing at a boat flush with the edge of the box', () => {
    const { fish } = run(
      fishAt(IN_CLOSE_BAND),
      ON_TOP + CLOSE_PUNISHER_REACH,
      1,
    );

    expect(fish.attackPhase).toBe('idle');
  });

  it('commits on the very tick the boat comes into reach', () => {
    // Waiting does not cost a second cooldown. A fish that has spent its whole
    // gap closing has to swing the moment it arrives, or the approach would buy
    // the player free time rather than costing them ground.
    const waited = run(fishAt(IN_CLOSE_BAND), FAR_AWAY, 300).fish;

    expect(waited.attackCooldownRemaining).toBe(0);
    expect(run(waited, ON_TOP, 1).fish.attackPhase).toBe('windUp');
  });

  it('never runs while the fish is in the far band, however close the boat', () => {
    const { kinds, totalDamage } = run(fishAt({ band: 'far' }), ON_TOP, 600);

    expect(kinds.has('close')).toBe(false);
    expect(totalDamage).toBe(0);
  });

  it('counts the cooldown down before checking the range, not after', () => {
    // One tick of cooldown left and the boat already in range: the tick that
    // clears the cooldown is also the tick the wind-up starts on.
    const fish = fishAt({ ...IN_CLOSE_BAND, attackCooldownRemaining: 1 });

    expect(run(fish, ON_TOP, 1).fish.attackPhase).toBe('windUp');
  });

  it('waits out a cooldown that has not expired', () => {
    const fish = fishAt({ ...IN_CLOSE_BAND, attackCooldownRemaining: 10 });
    const { fish: after } = run(fish, ON_TOP, 9);

    expect(after.attackPhase).toBe('idle');
    expect(after.attackCooldownRemaining).toBe(1);
  });
});

describe('the close punisher: the phases', () => {
  it('holds the wind-up for exactly its duration', () => {
    const started = run(fishAt(IN_CLOSE_BAND), ON_TOP, 1).fish;

    expect(
      run(started, ON_TOP, FISH_CLOSE_WINDUP_TICKS - 1).fish.attackPhase,
    ).toBe('windUp');
    expect(run(started, ON_TOP, FISH_CLOSE_WINDUP_TICKS).fish.attackPhase).toBe(
      'active',
    );
  });

  it('holds the active frames for exactly their duration', () => {
    const opened = run(
      fishAt(IN_CLOSE_BAND),
      ON_TOP,
      1 + FISH_CLOSE_WINDUP_TICKS,
    ).fish;

    expect(
      run(opened, ON_TOP, FISH_CLOSE_ACTIVE_TICKS - 1).fish.attackPhase,
    ).toBe('active');
    expect(run(opened, ON_TOP, FISH_CLOSE_ACTIVE_TICKS).fish.attackPhase).toBe(
      'recovery',
    );
  });

  it('holds the recovery for exactly its duration, then reloads the cooldown', () => {
    const recovering = run(
      fishAt(IN_CLOSE_BAND),
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
    const { fish, hits } = run(fishAt(IN_CLOSE_BAND), ON_TOP, 1 + cycle);

    expect(fish.attackPhase).toBe('windUp');
    expect(fish.attackPhaseTicksRemaining).toBe(FISH_CLOSE_WINDUP_TICKS);
    expect(hits).toBe(1);
  });
});

describe('the close punisher: commitment', () => {
  it('resolves an attack the boat has already run away from', () => {
    // architecture.md section 9 asks for this by name and design.md section 3
    // calls it non-negotiable: a wind-up that started always finishes.
    const started = run(fishAt(IN_CLOSE_BAND), ON_TOP, 1).fish;
    const { fish, totalDamage } = run(
      started,
      FAR_AWAY,
      FISH_CLOSE_WINDUP_TICKS + FISH_CLOSE_ACTIVE_TICKS,
    );

    expect(fish.attackPhase).toBe('recovery');
    expect(totalDamage).toBe(0);
  });

  it('does not shorten or extend the wind-up based on where the boat is', () => {
    const started = run(fishAt(IN_CLOSE_BAND), ON_TOP, 1).fish;

    expect(
      run(started, FAR_AWAY, FISH_CLOSE_WINDUP_TICKS - 1).fish.attackPhase,
    ).toBe('windUp');
    expect(
      run(started, FAR_AWAY, FISH_CLOSE_WINDUP_TICKS).fish.attackPhase,
    ).toBe('active');
  });
});

describe('the close punisher: landing the hit', () => {
  it('takes the configured damage once', () => {
    const { totalDamage, hits } = run(
      fishAt(IN_CLOSE_BAND),
      ON_TOP,
      1 + FISH_CLOSE_WINDUP_TICKS + FISH_CLOSE_ACTIVE_TICKS,
    );

    expect(hits).toBe(1);
    expect(totalDamage).toBe(FISH_CLOSE_HULL_DAMAGE);
  });

  it('hits a boat that walks in after the hitbox has opened', () => {
    // The box is drawn solid for several ticks, so it has to be live for all of
    // them. Otherwise walking into a visible hitbox costs nothing.
    const opened = run(
      fishAt(IN_CLOSE_BAND),
      ON_TOP,
      1 + FISH_CLOSE_WINDUP_TICKS,
    ).fish;
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
    const opened = run(
      fishAt(IN_CLOSE_BAND),
      ON_TOP,
      1 + FISH_CLOSE_WINDUP_TICKS,
    ).fish;
    const { hits } = run(opened, ON_TOP, FISH_CLOSE_ACTIVE_TICKS);

    expect(hits).toBe(1);
  });

  it('misses entirely when the boat is clear for every active tick', () => {
    const opened = run(
      fishAt(IN_CLOSE_BAND),
      ON_TOP,
      1 + FISH_CLOSE_WINDUP_TICKS,
    ).fish;
    const { totalDamage } = run(opened, FAR_AWAY, FISH_CLOSE_ACTIVE_TICKS);

    expect(totalDamage).toBe(0);
  });
});

describe('the far punisher: committing to a volley', () => {
  it('winds up on the first tick of the far band', () => {
    const { fish } = run(fishAt(), FAR_AWAY, 1);

    expect(fish.attackPhase).toBe('windUp');
    expect(fish.attackKind).toBe('far');
    expect(fish.attackPhaseTicksRemaining).toBe(FISH_FAR_WINDUP_TICKS);
  });

  it('needs no range of its own, however close the boat is standing', () => {
    // The close punisher has the hitbox gating its commit; the volley has
    // nothing, because it is aimed at wherever the boat is and reaches. A
    // minimum range here would open a dead ring around the fish.
    const { fish } = run(fishAt(), ON_TOP, 1);

    expect(fish.attackKind).toBe('far');
  });

  it('runs one attack at a time and never both', () => {
    // Two phase machines would allow a fish half way through a lunge and a
    // volley at once. One machine plus one kind is what makes that unspellable,
    // and one attack per band is what stops it ever being asked for.
    const { kinds } = run(fishAt(), FAR_AWAY, 600);

    expect([...kinds]).toEqual(['far']);
  });

  it('resolves a volley the boat has since closed in on', () => {
    // The same commitment the close punisher has, from the other direction: a
    // player who sprints in after the tell starts still eats the volley, and the
    // fish does not switch to the attack that suits the new distance.
    const started = run(fishAt(), FAR_AWAY, 1).fish;
    const { fish, spawned } = run(
      started,
      ON_TOP,
      FISH_FAR_WINDUP_TICKS + FISH_FAR_ACTIVE_TICKS,
    );

    expect(fish.attackKind).toBe('far');
    expect(fish.attackPhase).toBe('recovery');
    expect(spawned).toHaveLength(FISH_FAR_SHOT_COUNT);
  });

  it('does not shorten or extend the wind-up based on where the boat is', () => {
    const started = run(fishAt(), FAR_AWAY, 1).fish;

    expect(
      run(started, ON_TOP, FISH_FAR_WINDUP_TICKS - 1).fish.attackPhase,
    ).toBe('windUp');
    expect(run(started, ON_TOP, FISH_FAR_WINDUP_TICKS).fish.attackPhase).toBe(
      'active',
    );
  });
});

describe('the far punisher: the volley', () => {
  /** One tick to leave idle, then the whole tell. */
  const OPENED = 1 + FISH_FAR_WINDUP_TICKS;

  it('fires the configured number of shots and no more', () => {
    const { spawned } = run(fishAt(), FAR_AWAY, OPENED + FISH_FAR_ACTIVE_TICKS);

    expect(spawned).toHaveLength(FISH_FAR_SHOT_COUNT);
  });

  it('spaces them by the configured interval', () => {
    const { spawnTicks } = run(
      fishAt(),
      FAR_AWAY,
      OPENED + FISH_FAR_ACTIVE_TICKS,
    );

    // The first leaves on the first tick the fish actually spends in the active
    // phase, the same tick the close punisher's hitbox first gets tested on, so
    // the two attacks measure their durations the same way.
    expect(spawnTicks[0]).toBe(OPENED);
    for (let i = 1; i < spawnTicks.length; i++) {
      expect(spawnTicks[i] - spawnTicks[i - 1]).toBe(
        FISH_FAR_SHOT_INTERVAL_TICKS,
      );
    }
  });

  it('fires them from the fish itself, thrown at the boat', () => {
    const fish = fishAt();
    const { spawned } = run(fish, FAR_AWAY, OPENED + FISH_FAR_ACTIVE_TICKS);

    for (const shot of spawned) {
      expect(shot.x).toBe(fish.x);
      expect(shot.depth).toBe(fish.depth);
      // Left alone, the lob puts it on the boat by the time it surfaces. Without
      // that a shot could only reach as far as its tracking cap carried it and a
      // boat across the lane would be safe standing still.
      expect(shot.x + shot.vx * shotFlightTicks(shot.depth)).toBeCloseTo(
        FAR_AWAY,
      );
    }
  });

  it('holds each phase for exactly its own duration', () => {
    const started = run(fishAt(), FAR_AWAY, 1).fish;

    expect(
      run(started, FAR_AWAY, FISH_FAR_WINDUP_TICKS - 1).fish.attackPhase,
    ).toBe('windUp');

    const opened = run(started, FAR_AWAY, FISH_FAR_WINDUP_TICKS).fish;
    expect(opened.attackPhase).toBe('active');
    expect(opened.attackPhaseTicksRemaining).toBe(FISH_FAR_ACTIVE_TICKS);

    const recovering = run(opened, FAR_AWAY, FISH_FAR_ACTIVE_TICKS).fish;
    expect(recovering.attackPhase).toBe('recovery');
    expect(recovering.attackPhaseTicksRemaining).toBe(FISH_FAR_RECOVERY_TICKS);
  });

  it('reloads its own cooldown rather than the close punisher’s', () => {
    const recovering = run(
      fishAt(),
      FAR_AWAY,
      OPENED + FISH_FAR_ACTIVE_TICKS,
    ).fish;
    const idle = run(recovering, FAR_AWAY, FISH_FAR_RECOVERY_TICKS).fish;

    expect(idle.attackPhase).toBe('idle');
    expect(idle.attackKind).toBe(null);
    expect(idle.attackCooldownRemaining).toBe(FISH_FAR_COOLDOWN_TICKS);
    expect(idle.attackCooldownRemaining).not.toBe(FISH_CLOSE_COOLDOWN_TICKS);
  });

  it('comes back round to a fresh wind-up after exactly one cycle', () => {
    const cycle =
      FISH_FAR_WINDUP_TICKS +
      FISH_FAR_ACTIVE_TICKS +
      FISH_FAR_RECOVERY_TICKS +
      FISH_FAR_COOLDOWN_TICKS;
    const { fish, spawned } = run(fishAt(), FAR_AWAY, 1 + cycle);

    expect(fish.attackPhase).toBe('windUp');
    expect(fish.attackPhaseTicksRemaining).toBe(FISH_FAR_WINDUP_TICKS);
    expect(spawned).toHaveLength(FISH_FAR_SHOT_COUNT);
  });
});

describe('shots in flight', () => {
  /** Ticks from the fish's starting depth to the surface. */
  const FLIGHT = shotFlightTicks(FISH_START_DEPTH);

  it('lands where the boat was standing when it was fired', () => {
    // The lob on its own, with the boat gone from the place it was aimed at, so
    // what is being measured is only where it was thrown. This is what lets the
    // volley reach a boat parked across the lane at all.
    const target = ON_TOP - 200;
    const thrown: ProjectileState = {
      x: ON_TOP,
      depth: FISH_START_DEPTH,
      vx: (target - ON_TOP) / FLIGHT,
    };

    let shots = [thrown];
    for (let i = 0; i < FLIGHT - 1; i++) {
      // Well beyond the tracking cap's reach in the time available, so the
      // correction is pinned against it the whole way and cannot be what carries
      // the shot to its target.
      shots = stepProjectiles(shots, ON_TOP + 400).projectiles;
    }

    // Measured on the last tick before it resolves, so one lob step is still
    // outstanding on top of the correction it has been pulled away by. Without
    // the lob it would still be sitting within fifty units of the fish, which is
    // two hundred short of where it needs to be.
    const slack = FLIGHT * FISH_FAR_TRACK_PER_TICK + Math.abs(thrown.vx);
    expect(shots[0]?.x).toBeGreaterThan(target);
    expect(shots[0]?.x).toBeLessThan(target + slack);
  });

  it('climbs at the configured rate', () => {
    const { projectiles } = fly([shotAt(ON_TOP)], ON_TOP, 1);

    expect(projectiles[0]?.depth).toBeCloseTo(
      FISH_START_DEPTH - FISH_FAR_RISE_PER_TICK,
    );
  });

  it('stays in the air for the whole climb, then resolves', () => {
    // The warning the player actually gets is the wind-up plus this, which is
    // why the wind-up is allowed to be shorter than the close punisher's.
    expect(fly([shotAt(ON_TOP)], ON_TOP, FLIGHT - 1).projectiles).toHaveLength(
      1,
    );

    const arrived = fly([shotAt(ON_TOP)], ON_TOP, FLIGHT);
    expect(arrived.projectiles).toHaveLength(0);
    expect(arrived.totalDamage).toBe(FISH_FAR_HULL_DAMAGE);
  });

  it('corrects towards the boat more slowly than the boat can walk', () => {
    // The inequality the whole attack is built on: walking always outruns the
    // correction, so the volley is answered by reading it rather than by
    // spending a dash. Pinned as an inequality rather than as a value so the
    // 1.13 tuning pass cannot break it by moving either number.
    expect(FISH_FAR_TRACK_PER_TICK).toBeLessThan(BOAT_SPEED_PER_TICK);

    // Fired straight up, so the correction is the only thing moving it.
    const { projectiles } = fly([shotAt(ON_TOP)], FAR_AWAY, 1);
    expect(projectiles[0]?.x).toBeCloseTo(ON_TOP - FISH_FAR_TRACK_PER_TICK);
  });

  it('never oversteers past the boat', () => {
    const nearly = ON_TOP + FISH_FAR_TRACK_PER_TICK / 2;
    const { projectiles } = fly([shotAt(nearly)], ON_TOP, 1);

    expect(projectiles[0]?.x).toBeCloseTo(ON_TOP);
  });

  it('catches a boat inside its reach and lets one outside it go', () => {
    // Fired from one tick below the surface, so there is exactly one drift step
    // to account for and the boundary can be checked a whole unit either side of
    // itself rather than on top of accumulated arithmetic.
    //
    // The shot closes FISH_FAR_TRACK_PER_TICK on that last tick, so a boat that
    // much further out is still caught by it. Strict at the edge, the same as
    // the close punisher's hitbox: a shot the player can see they are clear of
    // must not cost them anything.
    const arriving = shotAt(ON_TOP, FISH_FAR_RISE_PER_TICK);
    const edge = FAR_SHOT_REACH + FISH_FAR_TRACK_PER_TICK;

    expect(fly([arriving], ON_TOP + edge - 1, 1).totalDamage).toBe(
      FISH_FAR_HULL_DAMAGE,
    );
    expect(fly([arriving], ON_TOP + edge + 1, 1).totalDamage).toBe(0);
  });

  it('never catches a boat that walked away as it was fired', () => {
    // design.md section 3 asks for a volley that is trivially sidestepped. This
    // is that sentence as a test: one direction held from the moment of the shot
    // and nothing lands, without a dash being spent.
    let shots = [shotAt(ON_TOP)];
    let boatX = ON_TOP;
    let totalDamage = 0;

    for (let i = 0; i < FLIGHT; i++) {
      boatX -= BOAT_SPEED_PER_TICK;
      const result = stepProjectiles(shots, boatX);
      shots = result.projectiles;
      totalDamage += result.hullDamage;
    }

    expect(totalDamage).toBe(0);
  });

  it('charges the hull once for every shot that lands', () => {
    const volley = Array.from({ length: FISH_FAR_SHOT_COUNT }, () =>
      shotAt(ON_TOP),
    );
    const arrived = fly(volley, ON_TOP, FLIGHT);

    expect(arrived.projectiles).toHaveLength(0);
    expect(arrived.totalDamage).toBe(
      FISH_FAR_SHOT_COUNT * FISH_FAR_HULL_DAMAGE,
    );
  });
});
