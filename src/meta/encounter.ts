/**
 * The encounter roll: what a cast hooks. The first file in `meta/`.
 *
 * architecture.md section 2 gives this directory the record book, the inventory,
 * the casting and the shop — everything that is the game around the fight rather
 * than the fight. A cast is the first of those to exist.
 *
 * **This is where `Math.random` is allowed and `sim/rng.ts` is not used.** The
 * determinism rule belongs to `sim/`, which moves to the Colyseus server in phase
 * 7 and has to replay a fight identically from its opening seed. A cast has
 * nothing to replay: it happens once, outside any fight, and its result is handed
 * to `createFightState` as a plain argument. Borrowing the seeded generator would
 * mean carrying an encounter seed through the meta layer to buy reproducibility
 * that nothing wants. Decided at task 4.1 rather than drifted into; see
 * decisions.md.
 *
 * The `random` parameter is how this stays testable without that machinery. A
 * test hands in a stub and drives the boundaries exactly.
 *
 * The walk below is the same shape as `attackForBand` in `sim/ai/bands.ts`, and
 * deliberately a second copy rather than a shared helper: that one threads a seed
 * in and back out because it is inside the simulation, and this one takes a
 * function because it is not. Merging them would drag `sim/`'s constraint out to
 * a caller that does not have it, or hide this one's `Math.random` inside `sim/`.
 */

import { ENCOUNTER_TABLE } from '../data/encounters.ts';
import type { EncounterEntry } from '../data/encounters.ts';
import { ALL_FISH } from '../data/fish/index.ts';
import type { FishDefinition } from '../data/fish/types.ts';

/**
 * Roll one encounter.
 *
 * @param table Defaults to the real table. Passed in by tests, and by task 4.7
 *   once a cast's bait and spot produce a shifted copy of it.
 * @param random Defaults to `Math.random`. Anything returning `[0, 1)`.
 *
 * **Throws** on an empty table and on an entry naming a fish that does not
 * exist, both for the reason `patternById` gives in `data/fish/types.ts`: those
 * are faults in a data file, and a cast that quietly hooked the wrong fish, or
 * hooked nothing, is far harder to notice than an error.
 */
export function rollEncounter(
  table: readonly EncounterEntry[] = ENCOUNTER_TABLE,
  random: () => number = Math.random,
): FishDefinition {
  if (table.length === 0) {
    throw new Error('the encounter table is empty');
  }

  const total = table.reduce((sum, entry) => sum + entry.weight, 0);
  let remaining = random() * total;

  for (const entry of table) {
    remaining -= entry.weight;

    if (remaining < 0) {
      return fishById(entry.fishId);
    }
  }

  // Unreachable while `random` honours its contract: a value strictly below 1
  // starts `remaining` strictly below `total`, so the subtractions must take it
  // negative before the list runs out. Returning the last entry rather than
  // throwing, for the same reason `attackForBand` does: a rounding error on the
  // final entry is not worth refusing to start a fight over.
  return fishById(table[table.length - 1].fishId);
}

/** Resolve an id against the registry, throwing on one that names nothing. */
function fishById(id: string): FishDefinition {
  const fish = ALL_FISH.find((candidate) => candidate.id === id);

  if (fish === undefined) {
    throw new Error(`the encounter table names an unknown fish: ${id}`);
  }

  return fish;
}
