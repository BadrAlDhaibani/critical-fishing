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
 * luck.
 *
 * Both halves of that live in this one file, which is why the line between them
 * is drawn twice below. `attackForBand` rolls, because design.md section 3 asks
 * each band for "a small weighted list" and a list is only a list if something
 * chooses from it. `stepReposition` does not and may not: it reads no random
 * number and there is nowhere one could be added to it without the rule above
 * stopping making sense.
 *
 * Every number this file works with comes off the fish's definition. What is left
 * here is the two rules themselves, which are the engine's.
 *
 * Durations count in ticks, like everything else in sim/. One call to
 * `stepReposition` is exactly one tick.
 */

import { bandById } from '../../data/fish/types.ts';
import type { FishDefinition } from '../../data/fish/types.ts';
import { nextRandom } from '../rng.ts';
import type { BandId, FishState } from '../state.ts';

/** The attack the fish committed to, and the seed the next roll must use. */
export interface AttackChoice {
  patternId: string;
  seed: number;
}

/**
 * Which of the band's attacks the fish commits to.
 *
 * design.md section 3 gives each band "a small weighted list", and the definition
 * carries exactly that. This is the roll over it. Randomness comes in as a seed
 * and goes back out advanced, because `sim/` has no `Math.random` to reach for;
 * `sim/rng.ts` says why at length.
 *
 * **A single-entry list does not roll and returns the seed untouched.** That is a
 * deliberate short-circuit, not an optimisation. Every fish in the game is
 * `common`, which design.md section 3 defines as one attack per band, so if a
 * one-entry list consumed a roll then the random stream would be advancing 60
 * times a second in fights where nothing is ever random. Leaving it alone means
 * two things worth having: this task changed no behaviour in any existing fight,
 * and giving one fish a second attack cannot shift what any other fish rolls.
 *
 * **An empty list throws.** A band with nothing to do is a data fault rather than
 * a game state — `tests/fish.test.ts` refuses to register such a fish — and the
 * throw is what stops it becoming a fish that stands there.
 *
 * The boundary this sits on has not moved and is worth restating: design.md
 * section 3 forbids randomised **positioning** and asks for weighted random
 * **attack choice**. `stepReposition` below still reads no random number and
 * still must not. "The fish is shallow" stays a window the player earned; only
 * "which of the two things it can do from here" is rolled.
 */
export function attackForBand(
  fish: FishDefinition,
  band: BandId,
  seed: number,
): AttackChoice {
  const { attacks } = bandById(fish, band);

  if (attacks.length === 0) {
    throw new Error(`fish ${fish.id} band ${band} has no attacks`);
  }

  if (attacks.length === 1) {
    return { patternId: attacks[0].patternId, seed };
  }

  const total = attacks.reduce((sum, attack) => sum + attack.weight, 0);
  const roll = nextRandom(seed);
  let remaining = roll.value * total;

  for (const attack of attacks) {
    remaining -= attack.weight;

    if (remaining < 0) {
      return { patternId: attack.patternId, seed: roll.seed };
    }
  }

  // Unreachable: `roll.value` is strictly below 1, so `remaining` starts strictly
  // below `total` and the subtractions must take it negative before the list runs
  // out. Returning the last entry rather than throwing, because a rounding error
  // on the final entry is not worth ending a fight over.
  return { patternId: attacks[attacks.length - 1].patternId, seed: roll.seed };
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
