/**
 * Screen shake. Pure TypeScript, no Phaser: it produces two numbers a frame and
 * does not know that a camera exists.
 *
 * architecture.md section 2 files hit stop, screen shake and hit flash under
 * `game/feel/`, on the render side of the one rule. That is what the effect is
 * rather than where it is convenient: the shake never crosses the wire, never
 * affects the fight, and in phase 7 every client is free to shake at a different
 * moment from every other one without any of them disagreeing about the fight.
 *
 * Counted in real milliseconds rather than in ticks. Feel is wall-clock: the
 * shake is a thing the player's eye is doing, not a duration the fight is timed
 * against, and CLAUDE.md's rule about never deriving gameplay timing from a
 * render delta is not in tension with it because no gameplay timing is derived
 * here. It also means the decay stays smooth on a 144 Hz monitor instead of
 * stepping at 60.
 */

import {
  SHAKE_DECAY_PER_FRAME,
  SHAKE_MAX_AMPLITUDE,
  SHAKE_MAX_DAMAGE,
  SHAKE_MIN_AMPLITUDE,
} from '../../data/config.ts';
import { MAX_FRAME_MS, TICK_MS } from '../../sim/loop.ts';

/** A camera offset in whole internal-resolution units. */
export interface ShakeOffset {
  x: number;
  y: number;
}

/** No shake at all. Shared rather than allocated fresh sixty times a second. */
const STILL: ShakeOffset = { x: 0, y: 0 };

/**
 * How far a hit of this size throws the frame, in units.
 *
 * A straight ramp from nothing to SHAKE_MAX_DAMAGE, with a floor under it so any
 * hit at all registers as something. Fractional on purpose: this is what decays,
 * and rounding it here would make the last unit of a shake vanish in one step
 * instead of fading.
 *
 * The ceiling clamps because damage above SHAKE_MAX_DAMAGE is coming: task 3.4's
 * heavy attack and phase 7's bosses both deal more than anything in the fight
 * does today, and the shake is not allowed to grow with them. The ceiling was
 * already lowered once for being too much on a 480x270 frame, so a bigger hit
 * arriving is not a reason to raise it.
 */
export function amplitudeForDamage(damage: number): number {
  const scaled = (damage / SHAKE_MAX_DAMAGE) * SHAKE_MAX_AMPLITUDE;

  return Math.min(SHAKE_MAX_AMPLITUDE, Math.max(SHAKE_MIN_AMPLITUDE, scaled));
}

/**
 * Holds a decaying shake and hands out one offset per rendered frame.
 *
 * One of these per scene. It does not know what a fight is: something else
 * decides an impact happened and hands it the damage.
 */
export class Shake {
  private amplitude = 0;
  private readonly random: () => number;

  /**
   * The random source is injectable so the tests can pin it. This is the only
   * randomness in the project and it stays in this directory: `sim/` is
   * deterministic, which is what makes the fight unit testable at all and what
   * lets a phase 7 server and client agree, and a shake is neither of those.
   */
  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  /**
   * Shake for however far a hit of this size throws the frame.
   *
   * Takes the larger of the live shake and the new one rather than adding, so
   * two impacts landing in the same tick are one shake. Trading blows is a real
   * occurrence — `stepFight` charges both sides in one tick — and stacking would
   * turn a jolt into a lurch. Taking the max rather than replacing also means a
   * chip hit landing during a close punisher's shake cannot cut it short.
   */
  trigger(damage: number): void {
    this.amplitude = Math.max(this.amplitude, amplitudeForDamage(damage));
  }

  /** Which way this axis is thrown this frame. Never zero. */
  private direction(): number {
    return this.random() < 0.5 ? -1 : 1;
  }

  /**
   * Return where to put the camera, then decay by one frame of real time.
   *
   * The offset is **whole units**, always. One unit is four physical pixels at
   * 1080p and a fractional scroll at that zoom puts every edge between physical
   * pixels, which shimmers: the pixel grid is the one thing this effect is not
   * allowed to break, whatever design.md section 6 permits elsewhere.
   *
   * **A live shake always moves the frame, and that has to be built in rather
   * than left to the arithmetic.** The magnitude is the amplitude rounded, with a
   * floor of one unit under it, and the randomness only chooses a direction. The
   * first version scaled a random number by the amplitude and rounded the result,
   * which looks equivalent and is not: at the one-unit amplitude a hit from
   * across the lane gets, `Math.round` collapsed roughly two frames in three to
   * zero, so those hits shook only sometimes. Found at the 2.2 playtest. The
   * floor in SHAKE_MIN_AMPLITUDE exists to make every hit register, and rounding
   * was quietly throwing it away.
   *
   * The offset comes out **before** the decay, so the first frame is thrown at
   * the full amplitude the hit earned. Decaying first spent a quarter of the
   * shake before any of it was drawn, which the heaviest hits could absorb and
   * the lightest could not.
   *
   * The delta is clamped for the same reason `accumulate` clamps it in
   * sim/loop.ts: a backgrounded tab or a breakpoint hands out a multi-second
   * delta, and that should end the shake rather than mean anything.
   */
  update(deltaMs: number): ShakeOffset {
    if (this.amplitude <= 0) {
      return STILL;
    }

    const magnitude = Math.max(1, Math.round(this.amplitude));
    const offset = {
      x: magnitude * this.direction(),
      y: magnitude * this.direction(),
    };

    const safeDeltaMs =
      Number.isFinite(deltaMs) && deltaMs > 0
        ? Math.min(deltaMs, MAX_FRAME_MS)
        : 0;

    const frames = safeDeltaMs / TICK_MS;
    this.amplitude = Math.max(
      0,
      this.amplitude - frames * SHAKE_DECAY_PER_FRAME,
    );

    return offset;
  }

  /** How far the frame is currently being thrown. For the debug readout. */
  get current(): number {
    return this.amplitude;
  }

  /**
   * Stop dead. A restart builds a whole new fight, and a shake left over from
   * the killing blow of the last one would open the next one moving.
   */
  reset(): void {
    this.amplitude = 0;
  }
}
