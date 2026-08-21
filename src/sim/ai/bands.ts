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
 * Every number this file works with comes off the fish's definition. What is left
 * here is the two rules themselves, which are the engine's.
 *
 * Durations count in ticks, like everything else in sim/. One call to
 * `stepReposition` is exactly one tick.
 */

import { bandById } from '../../data/fish/types.ts';
import type { FishDefinition } from '../../data/fish/types.ts';
import type { BandId, FishState } from '../state.ts';

/**
 * Which of the band's attacks the fish commits to.
 *
 * design.md section 3 gives each band "a small weighted list", and the definition
 * carries exactly that. **What is not built yet is the roll.** Weighted selection
 * needs a source of randomness, and `sim/` is deliberately deterministic —
 * `Math.random` appears in `game/feel/shake.ts` and `game/audio/synth.ts` and
 * nowhere else — so it needs a seed on the fight state and is its own task, in
 * the roadmap as open finding 3.
 *
 * Until then a list of one is the only list this can answer, and it **throws** on
 * anything longer rather than quietly returning the first entry. That is the
 * whole point of the check: a second attack added to a band is a data change that
 * would otherwise look like it worked, play like it did nothing, and take a
 * playtest to notice.
 */
export function attackForBand(fish: FishDefinition, band: BandId): string {
  const { attacks } = bandById(fish, band);

  if (attacks.length !== 1) {
    throw new Error(
      `fish ${fish.id} band ${band} has ${attacks.length} attacks; weighted ` +
        `selection is not built yet, so exactly one is the only supported list`,
    );
  }

  return attacks[0].patternId;
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
 * has already resolved for this tick. The definition is one of those fields,
 * since it is where the resting depth, the swim rate and the dive rate live.
 *
 * **Only while idle.** An attack in any of its three phases pins the fish where
 * it stands. design.md section 3's commitment rule is about not cancelling a
 * wind-up rather than about not moving during one, so this is a choice on top of
 * it, and it is made for two concrete reasons. A melee column's telegraph is
 * drawn on the water above the fish, so a fish that drifted during its own tell
 * would drag the hitbox after the player and turn a read into a chase. And a
 * volley's flight time is derived from the depth it fired from, so a fish that
 * rose mid-wind-up would be shortening the warning it had already started giving.
 * design.md section 3's "rises while winding up something slow" is a real thing
 * to build, but it belongs to an attack designed around it rather than being
 * bolted onto every attack at once.
 *
 * Depth is the intent. The fish moves to the station its band names, so being
 * shallow is always something the player did.
 *
 * Horizontally it closes on the boat in bands that say they approach and holds
 * station in the ones that do not. Both are the fish's declaration rather than
 * the engine's rule: a band whose attack already reaches across the lane has no
 * reason to chase, and one that chased anyway would eventually walk every fight
 * into a wall, while a band far wider than the hitbox at its centre needs the
 * approach or the fish would sit in the gap with nothing it could do.
 *
 * Nothing clamps the fish to the lane and nothing needs to. It only ever moves
 * towards the boat's x and `towards` will not carry it past, and the boat is
 * already clamped, so the fish cannot be anywhere the boat could not be.
 */
export function stepReposition(
  fish: Pick<FishState, 'band' | 'attackPhase' | 'definition'> & PositionFields,
  boatX: number,
): PositionFields {
  if (fish.attackPhase !== 'idle') {
    return { x: fish.x, depth: fish.depth };
  }

  const { definition } = fish;
  const band = bandById(definition, fish.band);

  return {
    x: band.approaches
      ? towards(fish.x, boatX, definition.swimPerTick)
      : fish.x,
    depth: towards(fish.depth, band.restingDepth, definition.divePerTick),
  };
}
