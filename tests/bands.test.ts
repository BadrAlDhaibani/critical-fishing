import { describe, it, expect } from 'vitest';
import {
  attackForBand,
  restingDepth,
  stepReposition,
} from '../src/sim/ai/bands.ts';
import { CLOSE_PUNISHER_REACH } from '../src/sim/ai/patterns.ts';
import { createFightState } from '../src/sim/state.ts';
import type { BandId, FishState } from '../src/sim/state.ts';
import {
  BOAT_SPEED_PER_SECOND,
  FISH_BAND_EDGE,
  FISH_BAND_HYSTERESIS,
  FISH_CLOSE_BAND_DEPTH,
  FISH_DIVE_PER_TICK,
  FISH_FAR_BAND_DEPTH,
  FISH_SWIM_PER_SECOND,
  FISH_SWIM_PER_TICK,
} from '../src/data/config.ts';

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
  return Math.sqrt((FISH_BAND_EDGE - FISH_BAND_HYSTERESIS) ** 2 - depth ** 2);
}

describe('attackForBand: selecting by band', () => {
  it('answers the close band with the close punisher', () => {
    expect(attackForBand('close')).toBe('close');
  });

  it('answers the far band with the volley', () => {
    expect(attackForBand('far')).toBe('far');
  });

  // design.md section 3's no-safe-camping-spot rule, from the selection side of
  // it. Both attacks have to be reachable or one position on the lane is free.
  it('reaches both attacks between the two bands', () => {
    const bands: BandId[] = ['close', 'far'];

    expect(new Set(bands.map(attackForBand)).size).toBe(2);
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
    expect(FISH_FAR_BAND_DEPTH).toBeLessThanOrEqual(
      FISH_BAND_EDGE - FISH_BAND_HYSTERESIS,
    );
  });

  // Otherwise the band edge is decoration: the fish would only ever be in the
  // close band when it could already swing, and the approach would have no
  // ground to cover.
  it('opens a close band wider than the hitbox at its centre', () => {
    expect(closeBandWidth(FISH_FAR_BAND_DEPTH)).toBeGreaterThan(
      CLOSE_PUNISHER_REACH,
    );
  });

  // The same inequality the volley's tracking cap is held to, for the same
  // reason: an approach the boat cannot outwalk turns the dash from insurance
  // into the only answer.
  it('swims more slowly than the boat walks', () => {
    expect(FISH_SWIM_PER_SECOND).toBeLessThan(BOAT_SPEED_PER_SECOND);
  });

  it('rises in the close band and sinks in the far one', () => {
    expect(FISH_CLOSE_BAND_DEPTH).toBeLessThan(FISH_FAR_BAND_DEPTH);
    expect(restingDepth('close')).toBe(FISH_CLOSE_BAND_DEPTH);
    expect(restingDepth('far')).toBe(FISH_FAR_BAND_DEPTH);
  });

  // The close band is deliberately harder to leave than to enter, because the
  // fish rising shortens the line by itself. Worth pinning so a retune that
  // accidentally inverted it would fail here rather than read as the fish
  // flickering between movesets during a playtest.
  it('is harder to break out of than it was to fall into', () => {
    const entering = closeBandWidth(FISH_FAR_BAND_DEPTH);
    const leaving = Math.sqrt(
      (FISH_BAND_EDGE + FISH_BAND_HYSTERESIS) ** 2 - FISH_CLOSE_BAND_DEPTH ** 2,
    );

    expect(leaving).toBeGreaterThan(entering);
  });
});

describe('stepReposition: depth', () => {
  it('rises towards the close band depth', () => {
    const after = stepReposition(fishAt({ band: 'close' }), 0);

    expect(after.depth).toBeCloseTo(FISH_FAR_BAND_DEPTH - FISH_DIVE_PER_TICK);
  });

  it('sinks towards the far band depth', () => {
    const shallow = fishAt({ band: 'far', depth: FISH_CLOSE_BAND_DEPTH });
    const after = stepReposition(shallow, 0);

    expect(after.depth).toBeCloseTo(FISH_CLOSE_BAND_DEPTH + FISH_DIVE_PER_TICK);
  });

  it('arrives exactly on the resting depth rather than overshooting it', () => {
    const travel = FISH_FAR_BAND_DEPTH - FISH_CLOSE_BAND_DEPTH;
    const ticks = Math.ceil(travel / FISH_DIVE_PER_TICK);
    const after = swim(fishAt({ band: 'close' }), 0, ticks);

    expect(after.depth).toBe(FISH_CLOSE_BAND_DEPTH);
  });

  it('holds station once it is there, however long it waits', () => {
    const resting = fishAt({ band: 'close', depth: FISH_CLOSE_BAND_DEPTH });

    expect(swim(resting, resting.x, 600).depth).toBe(FISH_CLOSE_BAND_DEPTH);
  });

  it('opens a fight already at its resting depth', () => {
    // Not a coincidence and not to be undone: the fish starts in the far band at
    // the depth that band wants, so nothing drifts on tick one.
    const start = createFightState().fish;

    expect(start.depth).toBe(restingDepth(start.band));
  });
});

describe('stepReposition: closing the distance', () => {
  it('swims towards the boat in the close band', () => {
    const fish = fishAt({ band: 'close' });
    const after = stepReposition(fish, fish.x - 200);

    expect(after.x).toBeCloseTo(fish.x - FISH_SWIM_PER_TICK);
  });

  it('goes the other way for a boat on the other side', () => {
    const fish = fishAt({ band: 'close' });
    const after = stepReposition(fish, fish.x + 200);

    expect(after.x).toBeCloseTo(fish.x + FISH_SWIM_PER_TICK);
  });

  // The volley already reaches the whole lane, so a far-band fish has no reason
  // to chase, and one that did would eventually walk every fight into a wall.
  it('holds its ground in the far band', () => {
    const fish = fishAt({ band: 'far', depth: FISH_FAR_BAND_DEPTH });

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
    const fish = fishAt({ band: 'close', depth: FISH_CLOSE_BAND_DEPTH });
    const boatX = fish.x - closeBandWidth(FISH_CLOSE_BAND_DEPTH);
    const ticks = Math.ceil(
      (Math.abs(fish.x - boatX) - CLOSE_PUNISHER_REACH) / FISH_SWIM_PER_TICK,
    );

    expect(Math.abs(swim(fish, boatX, ticks).x - boatX)).toBeLessThan(
      CLOSE_PUNISHER_REACH,
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
    const fish = fishAt({ band: 'close', attackPhase, attackKind: 'close' });
    const after = swim(fish, fish.x - 200, 200);

    expect(after.x).toBe(fish.x);
    expect(after.depth).toBe(fish.depth);
  });

  it('picks up where it left off once the attack ends', () => {
    const busy = fishAt({
      band: 'close',
      attackPhase: 'recovery',
      attackKind: 'close',
    });
    const idle = swim({ ...busy, attackPhase: 'idle' }, busy.x - 200, 1);

    expect(idle.x).toBeLessThan(busy.x);
    expect(idle.depth).toBeLessThan(busy.depth);
  });
});
