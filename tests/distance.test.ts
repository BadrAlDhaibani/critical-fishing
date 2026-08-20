import { describe, it, expect } from 'vitest';
import { bandFor, lineLength } from '../src/sim/distance.ts';
import { createFightState } from '../src/sim/state.ts';
import type { BoatState, FishState } from '../src/sim/state.ts';
import {
  FISH_BAND_EDGE,
  FISH_BAND_HYSTERESIS,
  INTERNAL_WIDTH,
} from '../src/data/config.ts';

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
  const INSIDE = FISH_BAND_EDGE - FISH_BAND_HYSTERESIS;
  const OUTSIDE = FISH_BAND_EDGE + FISH_BAND_HYSTERESIS;

  it('is close well inside the edge, whichever band it came from', () => {
    expect(bandFor(INSIDE - 20, 'close')).toBe('close');
    expect(bandFor(INSIDE - 20, 'far')).toBe('close');
  });

  it('is far well outside the edge, whichever band it came from', () => {
    expect(bandFor(OUTSIDE + 20, 'close')).toBe('far');
    expect(bandFor(OUTSIDE + 20, 'far')).toBe('far');
  });

  it('switches exactly on the inner and outer edges', () => {
    expect(bandFor(INSIDE, 'far')).toBe('close');
    expect(bandFor(OUTSIDE, 'close')).toBe('far');
  });

  // design.md section 3's second fairness rule. Without this the fish flips
  // moveset every time the length wobbles by a fraction of a unit, and standing
  // near the edge means reading two telegraphs at once.
  it('keeps whichever band it already had everywhere inside the margin', () => {
    for (let length = INSIDE + 1; length < OUTSIDE; length++) {
      expect(bandFor(length, 'close')).toBe('close');
      expect(bandFor(length, 'far')).toBe('far');
    }
  });

  it('does not oscillate when parked on the edge itself', () => {
    let band = bandFor(FISH_BAND_EDGE, 'far');

    for (let tick = 0; tick < 600; tick++) {
      expect(bandFor(FISH_BAND_EDGE, band)).toBe(band);
      band = bandFor(FISH_BAND_EDGE, band);
    }
    expect(band).toBe('far');
  });

  it('needs the whole margin walked to get back out again', () => {
    // Entering costs the player one edge and leaving costs them the other, so
    // the two are a full 2 * hysteresis apart. This is what stops a boat
    // shuffling on the boundary from being able to hold the fish in either band.
    expect(bandFor(INSIDE, 'far')).toBe('close');
    expect(bandFor(OUTSIDE - 1, 'close')).toBe('close');
    expect(bandFor(OUTSIDE, 'close')).toBe('far');
  });

  it('reads the opening state of a fight as the band it is seeded with', () => {
    // The opening line is inside the margin, so this is not a computation. It is
    // the reason `createFightState` has to seed the band rather than derive it,
    // and the reason the fight opens on a volley.
    const start = createFightState();
    const opening = lineLength(start.boat, start.fish);

    expect(opening).toBeGreaterThan(INSIDE);
    expect(opening).toBeLessThan(OUTSIDE);
    expect(bandFor(opening, start.fish.band)).toBe(start.fish.band);
    expect(start.fish.band).toBe('far');
  });
});
