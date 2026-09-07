/**
 * The damage-by-distance curve. Pure TypeScript, no Phaser.
 *
 * design.md section 2 calls this the central tradeoff: damage scales inversely
 * with line length, so the best damage is directly above the fish, which is
 * also where its melee moveset reaches. Sidestepping a projectile weakens the
 * next hit. Moving is never a neutral act, and this function is where that
 * costs something.
 */

import {
  ATTACK_DAMAGE_MAX,
  ATTACK_DAMAGE_MIN,
  ATTACK_FULL_DAMAGE_RANGE,
  HEAVY_DAMAGE_MULTIPLIER,
} from '../data/config.ts';

/**
 * True inverse rather than a straight line between the two anchors, chosen
 * 2026-08-19. Derived from the anchors instead of tuned separately, so the
 * curve cannot drift away from the damage it is supposed to deal at full range.
 */
const CURVE_CONSTANT = ATTACK_DAMAGE_MAX * ATTACK_FULL_DAMAGE_RANGE;

/**
 * The curve itself, scaled by how hard the attack using it hits.
 *
 * One curve for both attacks rather than one each, so they cannot drift apart in
 * shape and the heavy inherits the inverse-distance coupling design.md section 2
 * calls the whole fight. **Both anchors scale with it**, not just the ceiling, so
 * "a heavy is three basics" is exactly true at every distance rather than only in
 * the middle of the range.
 *
 * Whole numbers. Rounded here rather than at the call site so the debug readout,
 * the tests and the resistance actually dealt can never disagree by a fraction,
 * and so the tuning pass reasons in the numbers it sees on screen. Scaled
 * **before** the rounding, so a heavy is three times the real basic rather than
 * three times an already-rounded one.
 *
 * Clamped at both ends. The ceiling matters because the length can never quite
 * reach zero but could pass under the full-damage range once the fish surfaces
 * at 1.11, and an uncapped `k / length` would spike towards infinity there. The
 * floor keeps a long-range hit worth making rather than a rounding error.
 */
function damageAt(length: number, scale: number): number {
  const raw = (CURVE_CONSTANT * scale) / length;
  const clamped = Math.min(
    Math.max(raw, ATTACK_DAMAGE_MIN * scale),
    ATTACK_DAMAGE_MAX * scale,
  );

  return Math.round(clamped);
}

/** What one basic attack takes off the fish's resistance at a given length. */
export function basicAttackDamage(length: number): number {
  return damageAt(length, 1);
}

/**
 * The same for a heavy, which is the same curve three times over.
 *
 * The length it is priced at is the one at the moment the wind-up **ends**, not
 * the one it was started from. See `stepFight`: that is what makes a fish diving
 * away mid-wind-up a real answer to the attack.
 */
export function heavyAttackDamage(length: number): number {
  return damageAt(length, HEAVY_DAMAGE_MULTIPLIER);
}
