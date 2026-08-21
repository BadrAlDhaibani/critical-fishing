/**
 * Hit flash. Pure TypeScript, no Phaser: it answers one question, "is this thing
 * white right now", and does not know what a rectangle is.
 *
 * architecture.md section 2 files it under `game/feel/` with the other two
 * effects. Like them it never crosses the wire and never affects the fight, and
 * like them it counts in real milliseconds rather than ticks, because a flash is
 * something the player's eye is doing rather than a duration the fight is timed
 * against.
 *
 * One of these per thing that can be struck. The scene owns two, a boat's and a
 * fish's, rather than one object tracking both: they are independent, they
 * regularly overlap when blows are traded, and a single counter would make the
 * fish's hit cut the boat's flash short.
 */

import { HIT_FLASH_FRAMES } from '../../data/config.ts';
import { MAX_FRAME_MS, TICK_MS } from '../../sim/loop.ts';

/**
 * A two-frame white-out, restarted by every hit.
 *
 * Unlike the shake there is no magnitude here and nothing decays. design.md
 * section 6 gives the flash one job — say *that* something was hit, and *which*
 * something — and the shake beside it already says how hard. A flash that scaled
 * with damage would make the lightest hits read as near misses, which is the
 * opposite of what the effect is for.
 */
export class Flash {
  private remainingMs = 0;

  /**
   * Light up for the full duration.
   *
   * Restarts rather than extends. Two hits in quick succession should read as
   * two flashes of the same length, not as one long one that happens to cover
   * both: the duration is what makes it legible as a flash at all.
   */
  trigger(): void {
    this.remainingMs = HIT_FLASH_FRAMES * TICK_MS;
  }

  /**
   * Spend one frame of real time and say whether to draw this thing white.
   *
   * The delta is clamped for the same reason `accumulate` clamps it in
   * sim/loop.ts: a backgrounded tab or a breakpoint hands out a multi-second
   * delta, and that should end the flash rather than mean anything.
   */
  update(deltaMs: number): boolean {
    if (this.remainingMs <= 0) {
      return false;
    }

    const safeDeltaMs =
      Number.isFinite(deltaMs) && deltaMs > 0
        ? Math.min(deltaMs, MAX_FRAME_MS)
        : 0;

    this.remainingMs = Math.max(0, this.remainingMs - safeDeltaMs);

    return true;
  }

  /**
   * Go dark immediately. A restart builds a whole new fight, and a rectangle
   * left white by the killing blow of the last one would open the next one lit.
   */
  reset(): void {
    this.remainingMs = 0;
  }
}
