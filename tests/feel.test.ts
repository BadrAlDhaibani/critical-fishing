import { describe, it, expect } from 'vitest';
import { Shake, amplitudeForDamage } from '../src/game/feel/shake.ts';
import { ImpactWatcher } from '../src/game/feel/impacts.ts';
import { createFightState } from '../src/sim/state.ts';
import { TICK_MS } from '../src/sim/loop.ts';
import {
  ATTACK_DAMAGE_MAX,
  FISH_CLOSE_HULL_DAMAGE,
  FISH_FAR_HULL_DAMAGE,
  SHAKE_MAX_AMPLITUDE,
  SHAKE_MAX_DAMAGE,
  SHAKE_MAX_FRAMES,
  SHAKE_MIN_AMPLITUDE,
} from '../src/data/config.ts';

/**
 * architecture.md section 9 says feel is validated by playtest rather than by
 * unit tests, and that stands: nothing here asks whether a shake feels good.
 * What these pin is the arithmetic underneath it, which is ordinary pure code
 * and would otherwise only be checked by noticing the game looked wrong.
 *
 * Derived from the config constants rather than written as literals, the same
 * way the rest of the suite is, so a retune moves them instead of breaking them.
 */

/** The random source, pinned. Corners the offset at its full amplitude. */
const alwaysMax = (): number => 1;
/** The other corner: fully negative. */
const alwaysMin = (): number => 0;

describe('amplitudeForDamage', () => {
  it('puts a far punisher shot on the floor', () => {
    expect(amplitudeForDamage(FISH_FAR_HULL_DAMAGE)).toBe(SHAKE_MIN_AMPLITUDE);
  });

  it('puts a close punisher on the ceiling', () => {
    expect(amplitudeForDamage(FISH_CLOSE_HULL_DAMAGE)).toBe(
      SHAKE_MAX_AMPLITUDE,
    );
  });

  it('puts the players best hit between the two', () => {
    const amplitude = amplitudeForDamage(ATTACK_DAMAGE_MAX);

    expect(amplitude).toBeGreaterThan(SHAKE_MIN_AMPLITUDE);
    expect(amplitude).toBeLessThan(SHAKE_MAX_AMPLITUDE);
  });

  it('never exceeds the ceiling, however heavy the hit gets', () => {
    // Task 3.4's heavy attack and phase 7's bosses both deal more than anything
    // in the fight does today. Three units is already a large fraction of a
    // 480x270 frame and past it the game reads as convulsing rather than as hit.
    expect(amplitudeForDamage(SHAKE_MAX_DAMAGE * 10)).toBe(SHAKE_MAX_AMPLITUDE);
  });
});

describe('Shake', () => {
  it('is still until something lands', () => {
    expect(new Shake(alwaysMax).update(TICK_MS)).toEqual({ x: 0, y: 0 });
  });

  it('only ever offsets by whole units', () => {
    // The pixel grid guarantee, and the one thing here that would break
    // silently: a fractional scroll at a 4x nearest-neighbour zoom puts every
    // edge between physical pixels and shimmers as things move.
    const shake = new Shake(() => Math.random());
    shake.trigger(FISH_CLOSE_HULL_DAMAGE);

    for (let i = 0; i < SHAKE_MAX_FRAMES; i++) {
      const { x, y } = shake.update(TICK_MS);

      expect(Number.isInteger(x)).toBe(true);
      expect(Number.isInteger(y)).toBe(true);
    }
  });

  it('never throws the frame further than the amplitude', () => {
    const shake = new Shake(alwaysMax);
    shake.trigger(FISH_CLOSE_HULL_DAMAGE);

    for (let i = 0; i < SHAKE_MAX_FRAMES; i++) {
      const { x, y } = shake.update(TICK_MS);

      expect(Math.abs(x)).toBeLessThanOrEqual(SHAKE_MAX_AMPLITUDE);
      expect(Math.abs(y)).toBeLessThanOrEqual(SHAKE_MAX_AMPLITUDE);
    }
  });

  it('moves the frame on every live frame, even at the lightest hit', () => {
    // The bug found at the 2.2 playtest. Scaling a random number by a sub-one
    // amplitude and rounding the result collapsed roughly two frames in three to
    // zero, so hits from across the lane shook only sometimes while close-range
    // ones were solid. SHAKE_MIN_AMPLITUDE exists to stop exactly that.
    const shake = new Shake(alwaysMax);
    shake.trigger(FISH_FAR_HULL_DAMAGE);

    let frames = 0;
    while (shake.current > 0) {
      const { x, y } = shake.update(TICK_MS);

      expect(x).not.toBe(0);
      expect(y).not.toBe(0);
      frames += 1;
    }

    expect(frames).toBeGreaterThan(0);
  });

  it('throws the full amplitude on the frame the hit lands', () => {
    // Decaying before the offset was produced spent a quarter of the shake
    // before any of it reached the screen, which the heaviest hits absorbed and
    // the lightest could not.
    const shake = new Shake(alwaysMax);
    shake.trigger(FISH_CLOSE_HULL_DAMAGE);

    expect(shake.update(TICK_MS).x).toBe(SHAKE_MAX_AMPLITUDE);
  });

  it('throws both ways rather than sliding one way', () => {
    // Rounding rather than flooring is what makes this true. A floor would bias
    // every offset down and left, which over twelve frames reads as the screen
    // sliding off rather than shaking.
    const positive = new Shake(alwaysMax);
    positive.trigger(FISH_CLOSE_HULL_DAMAGE);

    const negative = new Shake(alwaysMin);
    negative.trigger(FISH_CLOSE_HULL_DAMAGE);

    expect(positive.update(TICK_MS).x).toBeGreaterThan(0);
    expect(negative.update(TICK_MS).x).toBeLessThan(0);
  });

  it('decays to a dead stop and stays there', () => {
    const shake = new Shake(alwaysMax);
    shake.trigger(FISH_CLOSE_HULL_DAMAGE);

    for (let i = 0; i < SHAKE_MAX_FRAMES; i++) {
      shake.update(TICK_MS);
    }

    expect(shake.current).toBe(0);
    expect(shake.update(TICK_MS)).toEqual({ x: 0, y: 0 });
  });

  it('runs the heaviest hit for about its full length', () => {
    const shake = new Shake(alwaysMax);
    shake.trigger(FISH_CLOSE_HULL_DAMAGE);

    let movingFrames = 0;
    for (let i = 0; i < SHAKE_MAX_FRAMES * 2; i++) {
      const { x, y } = shake.update(TICK_MS);
      if (x !== 0 || y !== 0) {
        movingFrames += 1;
      }
    }

    expect(movingFrames).toBeGreaterThan(SHAKE_MAX_FRAMES / 2);
    expect(movingFrames).toBeLessThanOrEqual(SHAKE_MAX_FRAMES);
  });

  it('fades a light hit sooner than a heavy one', () => {
    const light = new Shake(alwaysMax);
    light.trigger(FISH_FAR_HULL_DAMAGE);

    const heavy = new Shake(alwaysMax);
    heavy.trigger(FISH_CLOSE_HULL_DAMAGE);

    for (let i = 0; i < SHAKE_MAX_FRAMES / 2; i++) {
      light.update(TICK_MS);
      heavy.update(TICK_MS);
    }

    expect(light.current).toBe(0);
    expect(heavy.current).toBeGreaterThan(0);
  });

  it('takes the larger of two impacts rather than adding them', () => {
    // Trading blows lands both in one tick. Stacking would turn a jolt into a
    // lurch, which reads as the game glitching rather than as weight.
    const shake = new Shake(alwaysMax);
    shake.trigger(FISH_CLOSE_HULL_DAMAGE);
    shake.trigger(FISH_FAR_HULL_DAMAGE);

    expect(shake.current).toBe(SHAKE_MAX_AMPLITUDE);
  });

  it('is not cut short by a light hit landing mid-shake', () => {
    const shake = new Shake(alwaysMax);
    shake.trigger(FISH_CLOSE_HULL_DAMAGE);
    shake.update(TICK_MS);
    const before = shake.current;

    shake.trigger(FISH_FAR_HULL_DAMAGE);

    expect(shake.current).toBe(before);
  });

  it('stops dead on reset, so a restart opens still', () => {
    const shake = new Shake(alwaysMax);
    shake.trigger(FISH_CLOSE_HULL_DAMAGE);
    shake.reset();

    expect(shake.update(TICK_MS)).toEqual({ x: 0, y: 0 });
  });

  it('survives the multi-second delta a backgrounded tab hands out', () => {
    const shake = new Shake(alwaysMax);
    shake.trigger(FISH_CLOSE_HULL_DAMAGE);

    // That frame is still drawn and still shakes, since the hit did land. What
    // the clamp guarantees is that the whole shake is spent by the end of it.
    shake.update(10_000);

    expect(shake.current).toBe(0);
    expect(shake.update(TICK_MS)).toEqual({ x: 0, y: 0 });
  });
});

describe('ImpactWatcher', () => {
  it('reports nothing when nothing has been hurt', () => {
    const state = createFightState();

    expect(new ImpactWatcher(state).sample(state)).toEqual([]);
  });

  it('reports the hull losing a close punisher', () => {
    const state = createFightState();
    const watcher = new ImpactWatcher(state);

    const hit = {
      ...state,
      boat: { ...state.boat, hull: state.boat.hull - FISH_CLOSE_HULL_DAMAGE },
    };

    expect(watcher.sample(hit)).toEqual([
      { target: 'boat', damage: FISH_CLOSE_HULL_DAMAGE },
    ]);
  });

  it('reports the fish losing resistance', () => {
    const state = createFightState();
    const watcher = new ImpactWatcher(state);

    const hit = {
      ...state,
      fish: {
        ...state.fish,
        resistance: state.fish.resistance - ATTACK_DAMAGE_MAX,
      },
    };

    expect(watcher.sample(hit)).toEqual([
      { target: 'fish', damage: ATTACK_DAMAGE_MAX },
    ]);
  });

  it('reports both when blows are traded in the same tick', () => {
    const state = createFightState();
    const watcher = new ImpactWatcher(state);

    const traded = {
      ...state,
      boat: { ...state.boat, hull: state.boat.hull - FISH_CLOSE_HULL_DAMAGE },
      fish: {
        ...state.fish,
        resistance: state.fish.resistance - ATTACK_DAMAGE_MAX,
      },
    };

    expect(watcher.sample(traded)).toEqual([
      { target: 'boat', damage: FISH_CLOSE_HULL_DAMAGE },
      { target: 'fish', damage: ATTACK_DAMAGE_MAX },
    ]);
  });

  it('reports a hit once and not again on the next sample', () => {
    const state = createFightState();
    const watcher = new ImpactWatcher(state);

    const hit = {
      ...state,
      boat: { ...state.boat, hull: state.boat.hull - FISH_CLOSE_HULL_DAMAGE },
    };
    watcher.sample(hit);

    expect(watcher.sample(hit)).toEqual([]);
  });

  it('merges damage taken across several ticks in one frame', () => {
    // A slow frame runs several catch-up ticks before anything is drawn. The
    // watcher holds its own last value rather than reading the driver's previous
    // state, so damage from the earlier tick cannot be lost.
    const state = createFightState();
    const watcher = new ImpactWatcher(state);

    const hit = {
      ...state,
      boat: {
        ...state.boat,
        hull: state.boat.hull - FISH_FAR_HULL_DAMAGE * 3,
      },
    };

    expect(watcher.sample(hit)).toEqual([
      { target: 'boat', damage: FISH_FAR_HULL_DAMAGE * 3 },
    ]);
  });

  it('does not read a refilled pool as an impact', () => {
    const drained = createFightState();
    const watcher = new ImpactWatcher({
      ...drained,
      boat: { ...drained.boat, hull: 0 },
      fish: { ...drained.fish, resistance: 0 },
    });

    expect(watcher.sample(createFightState())).toEqual([]);
  });
});
