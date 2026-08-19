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
} from '../data/config.ts';

/**
 * True inverse rather than a straight line between the two anchors, chosen
 * 2026-08-19. Derived from the anchors instead of tuned separately, so the
 * curve cannot drift away from the damage it is supposed to deal at full range.
 */
const CURVE_CONSTANT = ATTACK_DAMAGE_MAX * ATTACK_FULL_DAMAGE_RANGE;

/**
 * What one basic attack takes off the fish's resistance at a given line length.
 *
 * Whole numbers. Rounded here rather than at the call site so the debug
 * readout, the tests and the resistance actually dealt can never disagree by a
 * fraction, and so the tuning pass reasons in the numbers it sees on screen.
 *
 * Clamped at both ends. The ceiling matters because the length can never quite
 * reach zero but could pass under the full-damage range once the fish surfaces
 * at 1.11, and an uncapped `k / length` would spike towards infinity there. The
 * floor keeps a long-range hit worth making rather than a rounding error.
 */
export function basicAttackDamage(length: number): number {
  const raw = CURVE_CONSTANT / length;
  const clamped = Math.min(Math.max(raw, ATTACK_DAMAGE_MIN), ATTACK_DAMAGE_MAX);

  return Math.round(clamped);
}
