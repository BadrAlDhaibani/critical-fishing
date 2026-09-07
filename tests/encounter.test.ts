import { describe, it, expect } from 'vitest';
import { ENCOUNTER_TABLE } from '../src/data/encounters.ts';
import type { EncounterEntry } from '../src/data/encounters.ts';
import { ALL_FISH } from '../src/data/fish/index.ts';
import { rollEncounter } from '../src/meta/encounter.ts';

/**
 * The encounter roll, and the rules the table itself has to obey.
 *
 * Two different kinds of test are in here on purpose. The first half drives
 * `rollEncounter` with a stubbed random and checks it lands on the entry the
 * arithmetic says it should, including on every boundary between two entries —
 * that is the half that would catch an off-by-one in the walk. The second half
 * asserts things about `ENCOUNTER_TABLE` that nothing else would notice: a fish
 * missing from it is simply never hooked, and a zero weight is an entry that can
 * never be drawn. Neither fails anywhere else, which is what
 * `tests/fish.test.ts` exists for on the fish side and this exists for here.
 *
 * What is **not** here is whether 4/3/2/1 is a good table. That is a playtest
 * question, the same way whether 400 resistance is a good fight is.
 */

/**
 * A table whose weights are unlike the real one's and whose ids are real fish.
 *
 * Sized so every cumulative boundary is an exact tenth and can be written down
 * without rounding: 1, 2, 3, 4 out of 10, cumulative at 0.1, 0.3 and 0.6.
 *
 * A fixture rather than the real table for the reason `DUMMY` exists in
 * `fight.test.ts`: a test written against the shipped numbers passes for two
 * reasons at once, and stops being a test of the walk the moment the table is
 * retuned.
 */
const FIXTURE: readonly EncounterEntry[] = [
  { fishId: 'grey-box', weight: 1 },
  { fishId: 'duelling-perch', weight: 2 },
  { fishId: 'managerial-carp', weight: 3 },
  { fishId: 'deadeye-gar', weight: 4 },
];

/** A `random` that returns exactly what the test asks for. */
function fixed(value: number): () => number {
  return () => value;
}

describe('rollEncounter', () => {
  it('draws the first entry at zero', () => {
    expect(rollEncounter(FIXTURE, fixed(0)).id).toBe('grey-box');
  });

  it('draws the last entry as the roll approaches one', () => {
    // Not 1 itself: `Math.random` is `[0, 1)` and the fallback at the bottom of
    // the walk is the only thing that would answer for a value it never returns.
    expect(rollEncounter(FIXTURE, fixed(0.999999)).id).toBe('deadeye-gar');
  });

  /**
   * Every boundary, from both sides.
   *
   * The cumulative edges of the fixture are 0.1, 0.3 and 0.6. A value just under
   * an edge belongs to the entry before it and a value at or just over it to the
   * entry after, because the walk subtracts and takes the entry that drives the
   * remainder below zero. An implementation using `<=` instead of `<`, or
   * subtracting after the test rather than before, moves exactly these eight
   * answers and nothing else.
   */
  it.each([
    [0.099999, 'grey-box'],
    [0.1, 'duelling-perch'],
    [0.100001, 'duelling-perch'],
    [0.299999, 'duelling-perch'],
    [0.3, 'managerial-carp'],
    [0.300001, 'managerial-carp'],
    [0.599999, 'managerial-carp'],
    [0.6, 'deadeye-gar'],
    [0.600001, 'deadeye-gar'],
  ])('draws %s as %s', (roll, expected) => {
    expect(rollEncounter(FIXTURE, fixed(roll)).id).toBe(expected);
  });

  it('scales the roll by the summed weight rather than assuming it is one', () => {
    // The same proportions as the fixture written as much larger numbers. A walk
    // that forgot to multiply by the total would answer the first entry for
    // every roll here, since a raw `[0, 1)` never reaches the first weight.
    const large: readonly EncounterEntry[] = [
      { fishId: 'grey-box', weight: 100 },
      { fishId: 'duelling-perch', weight: 200 },
      { fishId: 'managerial-carp', weight: 300 },
      { fishId: 'deadeye-gar', weight: 400 },
    ];

    expect(rollEncounter(large, fixed(0.05)).id).toBe('grey-box');
    expect(rollEncounter(large, fixed(0.5)).id).toBe('managerial-carp');
    expect(rollEncounter(large, fixed(0.95)).id).toBe('deadeye-gar');
  });

  it('returns the definition itself, not a copy of it', () => {
    // The fight holds `fish.definition` by reference and shares it every tick,
    // per `sim/state.ts`. A roll returning a clone would give a fight a
    // definition that is equal to a registered fish without being it, and every
    // identity check downstream — the picker's highlight, a record book keyed on
    // the object — would quietly stop matching.
    const fish = rollEncounter(FIXTURE, fixed(0));

    expect(ALL_FISH).toContain(fish);
  });

  it('refuses a table naming a fish that does not exist', () => {
    expect(() =>
      rollEncounter([{ fishId: 'not-a-fish', weight: 1 }], fixed(0)),
    ).toThrow(/not-a-fish/);
  });

  it('refuses an empty table', () => {
    expect(() => rollEncounter([], fixed(0))).toThrow();
  });

  it('uses the real table by default', () => {
    // The default argument is the whole reason `FightScene` can call this with
    // no arguments, so it is worth one test that it points at the shipped table
    // rather than at a fixture or an empty list.
    expect(rollEncounter(undefined, fixed(0)).id).toBe(
      ENCOUNTER_TABLE[0].fishId,
    );
  });
});

describe('the encounter table', () => {
  it('can hook every fish in the registry, exactly once each', () => {
    // A fish in `ALL_FISH` and not in here is validated by `tests/fish.test.ts`,
    // playable through `?fish=`, and never rolled — unfishable without failing
    // anything. A fish listed twice is drawn at the sum of its weights, which is
    // legal arithmetic and almost certainly not what was meant.
    //
    // The rule that would change deliberately: a fish gated behind something,
    // such as phase 7's boss tier, is not supposed to be in the open table. When
    // the first one exists this becomes "every fish that is not gated".
    const listed = ENCOUNTER_TABLE.map((entry) => entry.fishId);

    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...ALL_FISH.map((f) => f.id)].sort());
  });

  it('gives every entry a usable weight', () => {
    // The same fault the band weights have in `tests/fish.test.ts`: a zero can
    // never be drawn, a negative one lets the entry after it be drawn in its
    // place, and a table summing to zero divides by zero and draws the first
    // entry every time. None of the three throws.
    for (const entry of ENCOUNTER_TABLE) {
      expect(Number.isFinite(entry.weight), entry.fishId).toBe(true);
      expect(entry.weight, entry.fishId).toBeGreaterThan(0);
    }
  });
});
