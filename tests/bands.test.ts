import { describe, it, expect } from 'vitest';
import { attackForBand, stepReposition } from '../src/sim/ai/bands.ts';
import { meleeReach } from '../src/sim/ai/patterns.ts';
import { createFightState } from '../src/sim/state.ts';
import type { FishState } from '../src/sim/state.ts';
import {
  BOAT_SPEED_PER_TICK,
  FISH_BAND_HYSTERESIS,
} from '../src/data/config.ts';
import { GREY_BOX } from '../src/data/fish/greyBox.ts';
import { bandById, meleePatternById } from '../src/data/fish/types.ts';

// Read off the fish rather than off config, since task 3.1. What the engine
// still owns is the hysteresis margin and the boat, which is why those two are
// the only constants left above.
const CLOSE_BAND = bandById(GREY_BOX, 'close');
const FAR_BAND = bandById(GREY_BOX, 'far');
const BAND_EDGE = CLOSE_BAND.maxDistance;
const LUNGE = meleePatternById(GREY_BOX, 'lunge');
const LUNGE_REACH = meleeReach(LUNGE);

/**
 * A fish built from a real starting state, so growing FishState cannot silently
 * break these the way a hand-written literal would.
 */
function fishAt(overrides: Partial<FishState> = {}): FishState {
  return { ...createFightState().fish, ...overrides };
}

/** Run n ticks of repositioning with the boat parked at one x. */
function swim(fish: FishState, boatX: number, n: number): FishState {
  let next = fish;

  for (let i = 0; i < n; i++) {
    next = { ...next, ...stepReposition(next, boatX) };
  }
  return next;
}

/** How far a fish in this band can be horizontally and still be in it. */
function closeBandWidth(depth: number): number {
  return Math.sqrt((BAND_EDGE - FISH_BAND_HYSTERESIS) ** 2 - depth ** 2);
}

describe('attackForBand: selecting by band', () => {
  it('answers each band with the attack its list names', () => {
    expect(attackForBand(GREY_BOX, 'close')).toBe('lunge');
    expect(attackForBand(GREY_BOX, 'far')).toBe('volley');
  });

  // design.md section 3's no-safe-camping-spot rule, from the selection side of
  // it. Both attacks have to be reachable or one position on the lane is free.
  it('reaches a different attack in each band', () => {
    const reachable = GREY_BOX.bands.map((band) =>
      attackForBand(GREY_BOX, band.id),
    );

    expect(new Set(reachable).size).toBe(GREY_BOX.bands.length);
  });

  /**
   * The guard that keeps a half-built feature honest. design.md section 3 gives
   * each band "a small weighted list" and the format carries the weights, but
   * the roll that would read them needs a seeded RNG inside a deterministic
   * `sim/` and is its own task.
   *
   * Until then a second attack in a band must fail loudly. Returning the first
   * entry instead would make a data change look like it worked, play like it did
   * nothing, and cost a playtest to notice.
   */
  it('refuses a band holding more than one attack, for now', () => {
    const twoAttacks = {
      ...GREY_BOX,
      bands: [
        {
          ...CLOSE_BAND,
          attacks: [
            { patternId: 'lunge', weight: 1 },
            { patternId: 'volley', weight: 1 },
          ],
        },
        FAR_BAND,
      ],
    };

    expect(() => attackForBand(twoAttacks, 'close')).toThrow(/selection/);
  });

  it('refuses a band the fish does not have', () => {
    expect(() => attackForBand(GREY_BOX, 'mid')).toThrow(/no band/);
  });
});

describe('the shape of the bands', () => {
  // Pinned as inequalities rather than as values, so the 1.13 tuning pass can
  // move any of these numbers without being able to break what they are for.

  // A boat directly above the fish is exactly `depth` away, so a fish resting
  // deeper than the inner edge could never be drawn into the close band at all.
  // It would dive out of reach for the whole fight and the close punisher would
  // never fire once, which is design.md section 3's no-safe-camping-spot rule
  // broken from the fish's side of it.
  it('lets a boat directly overhead pull a resting fish into the close band', () => {
    expect(FAR_BAND.restingDepth).toBeLessThanOrEqual(
      BAND_EDGE - FISH_BAND_HYSTERESIS,
    );
  });

  // Otherwise the band edge is decoration: the fish would only ever be in the
  // close band when it could already swing, and the approach would have no
  // ground to cover.
  it('opens a close band wider than the hitbox at its centre', () => {
    expect(closeBandWidth(FAR_BAND.restingDepth)).toBeGreaterThan(LUNGE_REACH);
  });

  // The same inequality the volley's tracking cap is held to, for the same
  // reason: an approach the boat cannot outwalk turns the dash from insurance
  // into the only answer.
  it('swims more slowly than the boat walks', () => {
    expect(GREY_BOX.swimPerTick).toBeLessThan(BOAT_SPEED_PER_TICK);
  });

  it('rises in the close band and sinks in the far one', () => {
    expect(CLOSE_BAND.restingDepth).toBeLessThan(FAR_BAND.restingDepth);
  });

  // The close band is deliberately harder to leave than to enter, because the
  // fish rising shortens the line by itself. Worth pinning so a retune that
  // accidentally inverted it would fail here rather than read as the fish
  // flickering between movesets during a playtest.
  it('is harder to break out of than it was to fall into', () => {
    const entering = closeBandWidth(FAR_BAND.restingDepth);
    const leaving = Math.sqrt(
      (BAND_EDGE + FISH_BAND_HYSTERESIS) ** 2 - CLOSE_BAND.restingDepth ** 2,
    );

    expect(leaving).toBeGreaterThan(entering);
  });
});

describe('stepReposition: depth', () => {
  it('rises towards the close band depth', () => {
    const after = stepReposition(fishAt({ band: 'close' }), 0);

    expect(after.depth).toBeCloseTo(
      FAR_BAND.restingDepth - GREY_BOX.divePerTick,
    );
  });

  it('sinks towards the far band depth', () => {
    const shallow = fishAt({ band: 'far', depth: CLOSE_BAND.restingDepth });
    const after = stepReposition(shallow, 0);

    expect(after.depth).toBeCloseTo(
      CLOSE_BAND.restingDepth + GREY_BOX.divePerTick,
    );
  });

  it('arrives exactly on the resting depth rather than overshooting it', () => {
    const travel = FAR_BAND.restingDepth - CLOSE_BAND.restingDepth;
    const ticks = Math.ceil(travel / GREY_BOX.divePerTick);
    const after = swim(fishAt({ band: 'close' }), 0, ticks);

    expect(after.depth).toBe(CLOSE_BAND.restingDepth);
  });

  it('holds station once it is there, however long it waits', () => {
    const resting = fishAt({ band: 'close', depth: CLOSE_BAND.restingDepth });

    expect(swim(resting, resting.x, 600).depth).toBe(CLOSE_BAND.restingDepth);
  });

  it('opens a fight already at its resting depth', () => {
    // Not a coincidence and not to be undone: the fish starts in the far band at
    // the depth that band wants, so nothing drifts on tick one.
    const start = createFightState().fish;

    expect(start.depth).toBe(bandById(GREY_BOX, start.band).restingDepth);
  });
});

describe('stepReposition: closing the distance', () => {
  it('swims towards the boat in the close band', () => {
    const fish = fishAt({ band: 'close' });
    const after = stepReposition(fish, fish.x - 200);

    expect(after.x).toBeCloseTo(fish.x - GREY_BOX.swimPerTick);
  });

  it('goes the other way for a boat on the other side', () => {
    const fish = fishAt({ band: 'close' });
    const after = stepReposition(fish, fish.x + 200);

    expect(after.x).toBeCloseTo(fish.x + GREY_BOX.swimPerTick);
  });

  // The volley already reaches the whole lane, so a far-band fish has no reason
  // to chase, and one that did would eventually walk every fight into a wall.
  it('holds its ground in the far band', () => {
    const fish = fishAt({ band: 'far', depth: FAR_BAND.restingDepth });

    expect(swim(fish, fish.x - 200, 600).x).toBe(fish.x);
  });

  it('stops under the boat rather than swimming past it', () => {
    const fish = fishAt({ band: 'close' });
    const boatX = fish.x - 30;

    expect(swim(fish, boatX, 600).x).toBe(boatX);
  });

  it('closes the gap to inside the hitbox in a readable number of ticks', () => {
    // The approach is the answer to a close band wider than the box at its
    // centre. If it could not cross that gap the fish would sit in it doing
    // nothing, which is the dead spot task 1.10 removed from the lane.
    const fish = fishAt({ band: 'close', depth: CLOSE_BAND.restingDepth });
    const boatX = fish.x - closeBandWidth(CLOSE_BAND.restingDepth);
    const ticks = Math.ceil(
      (Math.abs(fish.x - boatX) - LUNGE_REACH) / GREY_BOX.swimPerTick,
    );

    expect(Math.abs(swim(fish, boatX, ticks).x - boatX)).toBeLessThan(
      LUNGE_REACH,
    );
  });

  it('cannot leave the lane, because it never passes the boat', () => {
    // Why there is no clamp here and why none should be added. The boat is
    // already clamped, and the fish only ever moves towards it.
    const fish = fishAt({ band: 'close' });

    expect(swim(fish, 0, 2000).x).toBe(0);
  });
});

describe('stepReposition: an attack pins the fish', () => {
  const PHASES = ['windUp', 'active', 'recovery'] as const;

  // The close punisher's telegraph is drawn on the water above the fish, so a
  // fish that drifted during its own tell would drag the hitbox after the
  // player, and the far punisher's flight time is derived from the depth it
  // fired from, so a fish that rose mid-wind-up would shorten the warning it had
  // already started giving.
  it.each(PHASES)('does not move at all during %s', (attackPhase) => {
    const fish = fishAt({
      band: 'close',
      attackPhase,
      attackPatternId: 'lunge',
    });
    const after = swim(fish, fish.x - 200, 200);

    expect(after.x).toBe(fish.x);
    expect(after.depth).toBe(fish.depth);
  });

  it('picks up where it left off once the attack ends', () => {
    const busy = fishAt({
      band: 'close',
      attackPhase: 'recovery',
      attackPatternId: 'lunge',
    });
    const idle = swim({ ...busy, attackPhase: 'idle' }, busy.x - 200, 1);

    expect(idle.x).toBeLessThan(busy.x);
    expect(idle.depth).toBeLessThan(busy.depth);
  });
});
