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

import { FISH_BAND_HYSTERESIS } from '../data/config.ts';
import type { BandDefinition } from '../data/fish/types.ts';
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
 * Takes the current band because an edge is not a single line. Inside
 * `edge - margin` the answer is always the nearer band and outside
 * `edge + margin` it is always the further one, but in between the fish keeps
 * whatever it already had. That is design.md section 3's second fairness rule:
 * without it, a player standing on a boundary makes the fish flip movesets every
 * time the length wobbles by a fraction of a unit, and no read is possible.
 *
 * This is the one thing about the fight's geometry that cannot be derived on
 * demand. The band depends on where the band already was, so it is state, and it
 * lives on the fish rather than being recomputed from scratch like the length
 * it is cut out of.
 *
 * Takes the fish's own bands, ordered nearest first, so a fish with three of them
 * is data rather than an engine change. The walk reads each band's far edge in
 * turn: inside it minus the margin the answer is that band, still within the
 * margin the answer is whatever it already was, and otherwise the question moves
 * outwards to the next band. The outermost band's edge is `Infinity`, which is
 * what terminates the loop — every length is inside it.
 *
 * The margin is the game's rather than the fish's, so it is the same at every
 * edge of every fish. See `FISH_BAND_HYSTERESIS` in data/config.ts.
 */
export function bandFor(
  length: number,
  current: BandId,
  bands: readonly BandDefinition[],
): BandId {
  for (const band of bands) {
    if (length <= band.maxDistance - FISH_BAND_HYSTERESIS) return band.id;
    if (length < band.maxDistance + FISH_BAND_HYSTERESIS) return current;
  }

  // Unreachable while the outermost band's edge is Infinity, which every fish
  // definition sets and no engine code may assume it forgot. Thrown rather than
  // defaulted to the last band, because a fish whose bands do not cover the whole
  // lane has a hole in it that silently picking a band would hide.
  throw new Error(`no band covers a line length of ${length}`);
}
