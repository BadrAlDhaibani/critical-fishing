import { describe, it, expect } from 'vitest';
import { bandFor, lineLength } from '../src/sim/distance.ts';
import { createFightState } from '../src/sim/state.ts';
import type { BoatState, FishState } from '../src/sim/state.ts';
import { FISH_BAND_HYSTERESIS, INTERNAL_WIDTH } from '../src/data/config.ts';
import { GREY_BOX } from '../src/data/fish/greyBox.ts';
import type { BandDefinition } from '../src/data/fish/types.ts';

// Built off a real fight rather than from literals, so fields lineLength does
// not care about (hull, resistance and the rest) cannot break these helpers
// every time the state grows one.
const OPENING = createFightState();

const boatAt = (x: number): BoatState => ({ ...OPENING.boat, x });
const fishAt = (x: number, depth: number): FishState => ({
  ...OPENING.fish,
  x,
  depth,
});

describe('lineLength', () => {
  it('is the depth when the boat is directly above the fish', () => {
    expect(lineLength(boatAt(200), fishAt(200, 100))).toBe(100);
  });

  // The whole tradeoff in design.md section 2 rests on this: the best damage is
  // directly above the fish, so no other position may produce a shorter line.
  it('is shortest directly above the fish, from anywhere in the lane', () => {
    const fish = fishAt(340, 100);
    const best = lineLength(boatAt(fish.x), fish);

    for (let x = 0; x <= INTERNAL_WIDTH; x++) {
      expect(lineLength(boatAt(x), fish)).toBeGreaterThanOrEqual(best);
    }
  });

  it('measures a known triangle', () => {
    expect(lineLength(boatAt(240), fishAt(340, 100))).toBeCloseTo(
      Math.hypot(100, 100),
      10,
    );
  });

  // Neither side of the fish is a better place to stand. If this ever fails the
  // arena has a handedness nobody designed.
  it('is symmetric about the fish', () => {
    const fish = fishAt(240, 80);

    expect(lineLength(boatAt(fish.x - 60), fish)).toBeCloseTo(
      lineLength(boatAt(fish.x + 60), fish),
      10,
    );
  });

  it('grows as the boat moves away', () => {
    const fish = fishAt(100, 50);
    let previous = lineLength(boatAt(fish.x), fish);

    for (let x = fish.x + 1; x <= INTERNAL_WIDTH; x++) {
      const current = lineLength(boatAt(x), fish);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });

  // Depth is a real leg of the triangle, not decoration. A deeper fish is a
  // longer line from the same spot, which is what makes the fish rising at task
  // 1.11 a window worth waiting for.
  it('grows with depth at a fixed horizontal offset', () => {
    const shallow = lineLength(boatAt(240), fishAt(300, 40));
    const deep = lineLength(boatAt(240), fishAt(300, 160));

    expect(deep).toBeGreaterThan(shallow);
  });

  it('degenerates to horizontal distance at zero depth', () => {
    expect(lineLength(boatAt(180), fishAt(300, 0))).toBe(120);
  });

  it('is never negative', () => {
    expect(lineLength(boatAt(400), fishAt(20, 30))).toBeGreaterThan(0);
  });

  it('reads the opening state of a fight', () => {
    const start = createFightState();
    const opening = lineLength(start.boat, start.fish);

    expect(opening).toBeCloseTo(
      Math.hypot(start.fish.x - start.boat.x, start.fish.depth),
      10,
    );
    expect(opening).toBeGreaterThan(start.fish.depth);
  });
});

describe('bandFor: the distance bands', () => {
  // Read off the fish rather than off a constant, since task 3.1: where the edge
  // is, is the fish's business. The margin around it is still the game's.
  const BANDS = GREY_BOX.bands;
  const EDGE = BANDS[0].maxDistance;
  const INSIDE = EDGE - FISH_BAND_HYSTERESIS;
  const OUTSIDE = EDGE + FISH_BAND_HYSTERESIS;

  it('is close well inside the edge, whichever band it came from', () => {
    expect(bandFor(INSIDE - 20, 'close', BANDS)).toBe('close');
    expect(bandFor(INSIDE - 20, 'far', BANDS)).toBe('close');
  });

  it('is far well outside the edge, whichever band it came from', () => {
    expect(bandFor(OUTSIDE + 20, 'close', BANDS)).toBe('far');
    expect(bandFor(OUTSIDE + 20, 'far', BANDS)).toBe('far');
  });

  it('switches exactly on the inner and outer edges', () => {
    expect(bandFor(INSIDE, 'far', BANDS)).toBe('close');
    expect(bandFor(OUTSIDE, 'close', BANDS)).toBe('far');
  });

  // design.md section 3's second fairness rule. Without this the fish flips
  // moveset every time the length wobbles by a fraction of a unit, and standing
  // near the edge means reading two telegraphs at once.
  it('keeps whichever band it already had everywhere inside the margin', () => {
    for (let length = INSIDE + 1; length < OUTSIDE; length++) {
      expect(bandFor(length, 'close', BANDS)).toBe('close');
      expect(bandFor(length, 'far', BANDS)).toBe('far');
    }
  });

  it('does not oscillate when parked on the edge itself', () => {
    let band = bandFor(EDGE, 'far', BANDS);

    for (let tick = 0; tick < 600; tick++) {
      expect(bandFor(EDGE, band, BANDS)).toBe(band);
      band = bandFor(EDGE, band, BANDS);
    }
    expect(band).toBe('far');
  });

  it('needs the whole margin walked to get back out again', () => {
    // Entering costs the player one edge and leaving costs them the other, so
    // the two are a full 2 * hysteresis apart. This is what stops a boat
    // shuffling on the boundary from being able to hold the fish in either band.
    expect(bandFor(INSIDE, 'far', BANDS)).toBe('close');
    expect(bandFor(OUTSIDE - 1, 'close', BANDS)).toBe('close');
    expect(bandFor(OUTSIDE, 'close', BANDS)).toBe('far');
  });

  it('covers the whole lane, however far the boat gets', () => {
    // The outermost band's edge is Infinity, which is what terminates the walk.
    // A fish definition that forgot it would throw here rather than in play.
    expect(bandFor(Number.MAX_SAFE_INTEGER, 'close', BANDS)).toBe('far');
    expect(bandFor(0, 'far', BANDS)).toBe('close');
  });

  it('reads the opening state of a fight as the band it is seeded with', () => {
    // The opening line is inside the margin, so this is not a computation. It is
    // the reason `createFightState` has to seed the band rather than derive it,
    // and the reason the fight opens on a volley.
    const start = createFightState();
    const opening = lineLength(start.boat, start.fish);

    expect(opening).toBeGreaterThan(INSIDE);
    expect(opening).toBeLessThan(OUTSIDE);
    expect(bandFor(opening, start.fish.band, BANDS)).toBe(start.fish.band);
    expect(start.fish.band).toBe('far');
  });
});

/**
 * The band walk over three bands rather than two.
 *
 * design.md section 3's rarity ladder gives a rare fish three bands, and task 3.3
 * is supposed to be able to add one as data alone. Nothing in the game has three
 * yet, so without this the generality would be untested and the first fish to use
 * it would be the test. The bands here are synthetic on purpose: this is about
 * the walk, not about any fish's numbers.
 */
describe('bandFor: three bands', () => {
  const THREE: readonly BandDefinition[] = [
    { ...GREY_BOX.bands[0], id: 'close', maxDistance: 100 },
    { ...GREY_BOX.bands[0], id: 'mid', maxDistance: 200 },
    { ...GREY_BOX.bands[1], id: 'far', maxDistance: Infinity },
  ];

  it('picks each band well inside it', () => {
    expect(bandFor(50, 'far', THREE)).toBe('close');
    expect(bandFor(150, 'close', THREE)).toBe('mid');
    expect(bandFor(400, 'close', THREE)).toBe('far');
  });

  it('applies the margin at both boundaries, not just the first', () => {
    const margin = FISH_BAND_HYSTERESIS;

    // The inner boundary.
    expect(bandFor(100 - margin, 'mid', THREE)).toBe('close');
    expect(bandFor(100, 'mid', THREE)).toBe('mid');
    expect(bandFor(100, 'close', THREE)).toBe('close');

    // The outer one, which a walk that only handled the first edge would miss.
    expect(bandFor(200 - margin, 'far', THREE)).toBe('mid');
    expect(bandFor(200, 'far', THREE)).toBe('far');
    expect(bandFor(200, 'mid', THREE)).toBe('mid');
    expect(bandFor(200 + margin, 'mid', THREE)).toBe('far');
  });

  // Two edges means two margins, and a fish that jumped a band would skip one of
  // them. Walking the lane one unit at a time may never move more than one band.
  it('never skips the middle band while crossing the lane', () => {
    let band = bandFor(0, 'close', THREE);
    const order = ['close', 'mid', 'far'];
    let seen = 0;

    for (let length = 0; length < 400; length++) {
      const next = bandFor(length, band, THREE);
      const step = order.indexOf(next) - order.indexOf(band);

      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(1);
      if (step === 1) seen++;
      band = next;
    }

    expect(seen).toBe(2);
    expect(band).toBe('far');
  });
});
