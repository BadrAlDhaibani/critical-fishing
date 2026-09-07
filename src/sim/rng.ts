/**
 * The simulation's source of randomness. Pure TypeScript, no Phaser.
 *
 * `sim/` is deterministic on purpose. architecture.md section 1 makes this
 * directory the code that moves to the Colyseus server in phase 7, where the
 * same inputs replayed against the same state have to produce the same fight on
 * the server and on every client predicting it. `Math.random` cannot do that: it
 * is seeded by the engine, differs per tab, and has no way to be replayed. It
 * appears in `game/feel/shake.ts` and `game/audio/synth.ts` and must never
 * appear in here.
 *
 * So randomness arrives the only way it can, as a **number carried on the fight
 * state**. `FightState.rngSeed` is advanced by each roll and threaded back
 * through `stepFight`, which makes a fight a pure function of its opening seed
 * and its input sequence. That is what makes a replay a replay.
 *
 * **`nextRandom` returns the advanced seed rather than mutating anything.** The
 * awkwardness is the point: a caller has to thread the new seed back out to its
 * own caller, so a roll cannot be slipped into a function that does not already
 * admit to being random. A generator object holding its own state would let any
 * code with a reference to it roll invisibly, and the seed would stop being on
 * the state where phase 7 needs it.
 *
 * The algorithm is mulberry32, chosen for three reasons and no others: it is
 * five lines with no dependency, its whole state is one 32-bit integer so it
 * fits on the wire beside `tick`, and it is integer arithmetic throughout, so
 * it produces bit-identical results on the server and the client rather than
 * depending on floating-point rounding. Its statistical quality is far beyond
 * anything a fish choosing between two attacks needs.
 */

/** A rolled value, and the seed the next roll must be made with. */
export interface Roll {
  /** In `[0, 1)`, the same range as `Math.random`. */
  value: number;
  /**
   * The advanced seed. Feed it to the next `nextRandom`, or store it back on
   * `FightState`. Discarding it means the next roll returns this same value.
   */
  seed: number;
}

/**
 * The seed a fight opens with unless it is told otherwise.
 *
 * Not a tunable number and deliberately not in `data/config.ts`: nothing about
 * the game changes if it changes, it just picks which of the possible fights
 * you get. Any non-zero 32-bit integer is as good as any other.
 *
 * A fixed default rather than a random one is what keeps `createFightState()`
 * usable in a test without a seed argument, and what keeps `Math.random` out of
 * this directory. The game layer supplies real entropy; see `FightScene`.
 */
export const DEFAULT_SEED = 0x1f4b3d2c;

/**
 * One roll, and the seed to make the next one with.
 *
 * Pure: the same seed always produces the same `Roll`.
 */
export function nextRandom(seed: number): Roll {
  // `| 0` keeps the state a signed 32-bit integer, which is what makes this
  // reproducible: every operation below is defined on exactly 32 bits, so there
  // is no float precision for two machines to disagree about.
  const next = (seed + 0x6d2b79f5) | 0;

  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  // `>>> 0` reads the 32 bits back as unsigned before the divide, so the result
  // is in [0, 1) rather than half of it being negative.
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: next };
}
