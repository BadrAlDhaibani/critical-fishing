/**
 * Every fish in the game.
 *
 * One list, and the only place a fish becomes part of the game rather than a
 * file sitting in this directory. Adding a fish is writing its definition and
 * adding it here; `tests/fish.test.ts` fails if a file in `data/fish/` is not in
 * this list, so the second half cannot be forgotten.
 *
 * What reads it: the validation test today, and phase 4.1's encounter table when
 * it arrives. It is deliberately **not** how `createFightState` finds its default
 * fish — that imports `greyBox.ts` directly, because the default is a particular
 * fish rather than whichever one happens to be first here.
 */

import { DEADEYE_GAR } from './deadeyeGar.ts';
import { DUELLING_PERCH } from './duellingPerch.ts';
import { GREY_BOX } from './greyBox.ts';
import { MANAGERIAL_CARP } from './managerialCarp.ts';
import type { FishDefinition } from './types.ts';

/**
 * Grey box first, since it is the one every number in the game was tuned against
 * and the default `createFightState` still reaches for. The three after it are
 * task 3.3's, in the order they were written rather than in any order that means
 * anything: nothing reads this list positionally.
 */
export const ALL_FISH: readonly FishDefinition[] = [
  GREY_BOX,
  DUELLING_PERCH,
  MANAGERIAL_CARP,
  DEADEYE_GAR,
];
