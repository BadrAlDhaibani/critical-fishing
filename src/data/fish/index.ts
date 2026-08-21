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

import { GREY_BOX } from './greyBox.ts';
import type { FishDefinition } from './types.ts';

export const ALL_FISH: readonly FishDefinition[] = [GREY_BOX];
