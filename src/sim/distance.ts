/**
 * Line length. Pure TypeScript, no Phaser.
 *
 * This is the number the whole fight hangs off. design.md section 2 scales
 * attack damage inversely with it, so it is what makes moving cost something:
 * sidestepping an attack also weakens the next hit.
 *
 * Derived, never stored. Keeping a copy on FightState would be a second source
 * of truth that can go stale by a tick, and recomputing it is one hypot.
 */

import type { BoatState, FishState } from './state.ts';

/**
 * Distance from the boat to the fish, in internal-resolution units.
 *
 * Euclidean, and depth counts. This is deliberate and was decided 2026-08-19,
 * so do not reduce it to a horizontal distance: depth has to feed line length,
 * or a fish rising and diving changes nothing about damage output and the
 * "fish positioning is never random" decision loses its point. It also keeps
 * the length off zero directly above the fish, which inverse-distance damage
 * at task 1.7 needs.
 *
 * The boat is on the surface, which is depth 0, so the vertical leg of the
 * triangle is just the fish's depth.
 *
 * Takes only the fields it reads rather than whole states, so `stepFight` can
 * measure from the x it has just resolved for this tick without building a
 * throwaway BoatState. The alternative was a second `hypot` at that call site,
 * which is a second definition of line length that can drift from this one.
 */
export function lineLength(
  boat: Pick<BoatState, 'x'>,
  fish: Pick<FishState, 'x' | 'depth'>,
): number {
  return Math.hypot(fish.x - boat.x, fish.depth);
}
