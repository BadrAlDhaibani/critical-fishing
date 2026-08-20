/**
 * Band selection and repositioning. Pure TypeScript, no Phaser.
 *
 * architecture.md section 2 puts both here. `sim/distance.ts` says which band
 * the fight is in; this file says what the fish does about it.
 *
 * design.md section 3 asks for two things from this code and forbids a third.
 * The fish picks its attack from the band it is in, and it repositions with
 * intent. What it must never do is reposition randomly: "the fish is shallow
 * right now" has to read as a window the player earned by closing in, not as
 * luck. Nothing in here reads a random number, and there is nowhere one could be
 * added without the two rules below stopping making sense.
 *
 * Durations count in ticks, like everything else in sim/. One call to
 * `stepReposition` is exactly one tick.
 */

import {
  FISH_CLOSE_BAND_DEPTH,
  FISH_DIVE_PER_TICK,
  FISH_FAR_BAND_DEPTH,
  FISH_SWIM_PER_TICK,
} from '../../data/config.ts';
import type { BandId, FishAttackKind, FishState } from '../state.ts';

/**
 * The attack this band's list holds.
 *
 * One attack per band, which is design.md section 3's "common" rarity, so the
 * list is not a list yet and there is no weighted roll to make. Task 3.1 is what
 * turns this into a lookup in a fish definition, at which point this function
 * becomes the thing that reads it rather than the thing that hard-codes it.
 *
 * The mapping is one to one and still worth writing down. `BandId` and
 * `FishAttackKind` are separate types precisely because they stop agreeing the
 * moment a fish has two attacks in one band, and this is the single place they
 * are allowed to meet.
 */
export function attackForBand(band: BandId): FishAttackKind {
  return band === 'close' ? 'close' : 'far';
}

/** The depth the fish holds station at while it is in a given band. */
export function restingDepth(band: BandId): number {
  return band === 'close' ? FISH_CLOSE_BAND_DEPTH : FISH_FAR_BAND_DEPTH;
}

/** Move `from` towards `to` by at most `step`, never overshooting it. */
function towards(from: number, to: number, step: number): number {
  const delta = to - from;

  return Math.abs(delta) <= step ? to : from + Math.sign(delta) * step;
}

/** The position fields `stepReposition` reads and returns. */
type PositionFields = Pick<FishState, 'x' | 'depth'>;

/**
 * Move the fish one tick towards where its band wants it.
 *
 * Takes only the fields it reads and returns a patch, the same convention as
 * `stepFishAttack` and `lineLength`, so `stepFight` can hand it the boat x it
 * has already resolved for this tick.
 *
 * **Only while idle.** An attack in any of its three phases pins the fish where
 * it stands. design.md section 3's commitment rule is about not cancelling a
 * wind-up rather than about not moving during one, so this is a choice on top of
 * it, and it is made for two concrete reasons. The close punisher's telegraph is
 * drawn on the column of water above the fish, so a fish that drifted during its
 * own tell would drag the hitbox after the player and turn a read into a chase.
 * And the far punisher's flight time is derived from the depth it fired from, so
 * a fish that rose mid-wind-up would be shortening the warning it had already
 * started giving. design.md section 3's "rises while winding up something slow"
 * is a real thing to build, but it belongs to an attack designed around it
 * rather than bolted onto these two.
 *
 * Depth is the intent. The fish rises to punish a boat that has closed and sinks
 * back once one has backed off, so being shallow is always something the player
 * did.
 *
 * Horizontally it closes on the boat in the close band and holds station in the
 * far band. Holding station is not laziness: the volley already reaches across
 * the whole lane, so a far-band fish has no reason to chase, and one that did
 * would eventually walk every fight into a wall. The approach exists because the
 * close band is much wider than the 60-unit hitbox at its centre, and without it
 * the fish would sit in the gap between the two with nothing it could do.
 *
 * Nothing clamps the fish to the lane and nothing needs to. It only ever moves
 * towards the boat's x and `towards` will not carry it past, and the boat is
 * already clamped, so the fish cannot be anywhere the boat could not be.
 */
export function stepReposition(
  fish: Pick<FishState, 'band' | 'attackPhase'> & PositionFields,
  boatX: number,
): PositionFields {
  if (fish.attackPhase !== 'idle') {
    return { x: fish.x, depth: fish.depth };
  }

  return {
    x:
      fish.band === 'close'
        ? towards(fish.x, boatX, FISH_SWIM_PER_TICK)
        : fish.x,
    depth: towards(fish.depth, restingDepth(fish.band), FISH_DIVE_PER_TICK),
  };
}
