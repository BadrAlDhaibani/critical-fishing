/**
 * Line length, and the distance bands cut out of it. Pure TypeScript, no Phaser.
 *
 * This is the number the whole fight hangs off. design.md section 2 scales
 * attack damage inversely with it, so it is what makes moving cost something:
 * sidestepping an attack also weakens the next hit. design.md section 3 then
 * cuts it into bands and hands the fish a different moveset in each, so the same
 * number decides how hard you hit and what is about to be thrown at you.
 *
 * The length itself is derived, never stored. Keeping a copy on FightState would
 * be a second source of truth that can go stale by a tick, and recomputing it is
 * one hypot. The band is the opposite and has to be stored, for the reason given
 * on `bandFor` below.
 */

import { FISH_BAND_EDGE, FISH_BAND_HYSTERESIS } from '../data/config.ts';
import type { BandId, BoatState, FishState } from './state.ts';

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

/**
 * The band a given line length falls in, given the band it is already in.
 *
 * Takes the current band because the edge is not a single line. Below
 * `edge - margin` the answer is always close and above `edge + margin` it is
 * always far, but in between the fish keeps whatever it already had. That is
 * design.md section 3's second fairness rule: without it, a player standing on
 * the boundary makes the fish flip movesets every time the length wobbles by a
 * fraction of a unit, and no read is possible.
 *
 * This is the one thing about the fight's geometry that cannot be derived on
 * demand. The band depends on where the band already was, so it is state, and it
 * lives on the fish rather than being recomputed from scratch like the length
 * it is cut out of.
 */
export function bandFor(length: number, current: BandId): BandId {
  if (length <= FISH_BAND_EDGE - FISH_BAND_HYSTERESIS) return 'close';
  if (length >= FISH_BAND_EDGE + FISH_BAND_HYSTERESIS) return 'far';

  return current;
}
