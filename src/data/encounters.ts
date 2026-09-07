/**
 * The encounter table: which fish a cast can hook, and how often.
 *
 * Data rather than code, so it sits beside `config.ts` and `fish/` for the same
 * reason those do. The roll over it is `meta/encounter.ts`, which is where the
 * only logic lives; this file is the numbers and nothing else.
 *
 * **Weights are relative**, the same convention `BandAttack.weight` uses in
 * `data/fish/types.ts`: they only have to make sense against each other, so
 * `4 3 2 1` and `40 30 20 10` are the same table. The percentages in the comments
 * below are therefore a *reading* of the current list rather than authored
 * numbers — adding a fifth entry moves all four of them and none of the weights.
 *
 * **Task 4.7 multiplies these entries rather than replacing this list.** design.md
 * section 5 is emphatic that casting must not be a slot machine: bait, depth,
 * spot, weather and time of day are supposed to shift the table in ways a player
 * can read and learn, and a bad fight should be a bad read rather than bad luck.
 * That is the whole reason the table is a per-fish list with a weight on each
 * entry instead of a flat list of fish. A modifier that doubles the weight of
 * everything `rare`, or of one named fish, has somewhere to apply itself.
 *
 * It is per fish rather than per rarity tier for a reason worth keeping: all four
 * fish are `common` today, so a rarity table could not tell any two of them apart
 * and every cast would be a flat quarter. `rarity` stays on the definition as the
 * axis 4.7's modifiers can key on, which is what `data/fish/types.ts` says it is
 * carried for.
 */

/** One row of the table: a fish, and how strongly a cast leans towards it. */
export interface EncounterEntry {
  /**
   * The fish's own `id`, resolved against `ALL_FISH` at roll time.
   *
   * An id rather than the definition itself, so this file stays data a save game
   * or a server could hold. `rollEncounter` throws on one that resolves to
   * nothing, the same way `patternById` does.
   */
  fishId: string;
  /**
   * Relative likelihood. Must be finite and greater than zero: a zero can never
   * be drawn and a negative one lets the entry after it be drawn in its place,
   * neither of which throws. `tests/encounter.test.ts` is what refuses both.
   */
  weight: number;
}

/**
 * Every fish a cast can currently hook.
 *
 * The grey box fish is the one phase 1 was tuned against and is deliberately the
 * one you meet most; the three from task 3.3 are the variety around it. Nothing
 * about the ordering is load bearing — `rollEncounter` walks the list, but a
 * reordered list with the same weights is the same table.
 *
 * Every registered fish appears here exactly once, and `tests/encounter.test.ts`
 * fails if one does not, so a fish added to `data/fish/index.ts` cannot be
 * silently unfishable.
 */
export const ENCOUNTER_TABLE: readonly EncounterEntry[] = [
  { fishId: 'grey-box', weight: 4 }, // 40%
  { fishId: 'duelling-perch', weight: 3 }, // 30%
  { fishId: 'managerial-carp', weight: 2 }, // 20%
  { fishId: 'deadeye-gar', weight: 1 }, // 10%
];
