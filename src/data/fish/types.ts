/**
 * The fish definition format. Pure data types, no logic and no Phaser.
 *
 * architecture.md section 4: **a fish is data, and adding a fish must never
 * require an engine change.** That is the rule this file exists to make true,
 * and task 3.3 is the test of whether it worked: three fish added as three files
 * and nothing else. If one of them needs a field that is not here, the template
 * is wrong and that is worth flagging rather than working around.
 *
 * The line this format draws is **behaviour is code, everything else is data**.
 * A pattern's `behaviour` names which of the engine's attack shapes it runs, and
 * every number that shape uses is authored beside it. Two melee patterns with
 * different reaches, damages and telegraphs are therefore two data entries, not
 * two code paths, which is what open finding 2's second close-band attack needs.
 *
 * Read alongside `data/config.ts`, which keeps what is *not* the fish's: the
 * boat, the arena, the damage curve the player's attacks use, and the
 * presentation constants a telegraph is drawn with.
 */

import type { BandId } from '../../sim/state.ts';

/**
 * design.md section 3's rarity ladder. Common is two bands with one attack each,
 * and every step up the ladder is more to read rather than bigger numbers.
 *
 * Carried on the definition rather than derived from counting bands and attacks,
 * because it is the author's statement of intent and phase 4's encounter table
 * weights against it. A fish whose shape and rarity disagree is worth noticing.
 */
export type FishRarity = 'common' | 'uncommon' | 'rare' | 'boss';

/** The fields every attack has, whatever shape it takes. */
interface PatternCommon {
  /**
   * Unique within one fish. Referenced by a band's attack list and carried on
   * `FishState.attackPatternId` while the attack runs, so it is what the
   * renderer looks the pattern back up with.
   */
  id: string;
  /**
   * The telegraph, and the one phase the player is expected to read. design.md
   * section 3 forbids cancelling it once it starts.
   */
  windUpTicks: number;
  /** The player's reward for reading the tell. */
  recoveryTicks: number;
  /** The gap after the recovery before the fish may commit to anything again. */
  cooldownTicks: number;
  /** What one connecting hit takes off the hull. */
  hullDamage: number;
  /**
   * Which camping spot this attack punishes. design.md section 3 requires every
   * fish to have both, or the optimal strategy collapses to one position and the
   * movement axis stops mattering. Task 3.2 asserts the coverage on this field.
   *
   * Stated rather than inferred from which band the attack appears in. The two
   * usually agree, but a rare fish's overlapping lists deliberately put one
   * attack in two bands, and what the attack punishes is a fact about the attack.
   */
  punishes: 'close' | 'far';
}

/**
 * A column of water above the fish, live for a few ticks. The close punisher's
 * shape: telegraphed on the water it owns, and answered by not being in it.
 */
export interface MeleeColumnPattern extends PatternCommon {
  behaviour: 'meleeColumn';
  /** How long the hitbox is live. Authored, unlike a volley's. */
  activeTicks: number;
  /**
   * How much of the lane the box covers, centred on the fish. The renderer draws
   * it at exactly this width, so what the player can see is what hits.
   *
   * Width is the only dimension. The attack is tested horizontally against a
   * boat that is always on the surface, so the box has no meaningful height.
   */
  hitboxWidth: number;
}

/**
 * A volley of slow tracking shots. The far punisher's shape: trivially
 * sidestepped up close, hard to read from across the screen.
 *
 * There is no `activeTicks` here. It is derived from the count and the interval
 * by `activeTicksOf` below, because a fourth number could disagree with them.
 */
export interface VolleyPattern extends PatternCommon {
  behaviour: 'volley';
  shotCount: number;
  /** Ticks between shots. The first leaves on the volley's first active tick. */
  shotIntervalTicks: number;
  /** Hit-test width of one shot, and the width it is drawn at. */
  shotWidth: number;
  /**
   * How fast a shot climbs. The flight time is derived from the depth it was
   * fired from rather than being a number of its own, so a deep fish telegraphs
   * further ahead and a shallow one gives barely any notice, for free.
   */
  risePerTick: number;
  /**
   * How far a shot may drift sideways chasing the boat, per tick. A correction
   * on top of the lob it was thrown with, not the whole of its aim.
   *
   * This staying under the boat's walking speed is the whole design of the
   * attack: walking always outruns the correction, so the volley is answered by
   * reading it rather than by spending a dash.
   */
  trackPerTick: number;
}

export type FishPattern = MeleeColumnPattern | VolleyPattern;

/** One entry in a band's weighted attack list. */
export interface BandAttack {
  patternId: string;
  /**
   * Relative likelihood within its band. design.md section 3 gives each band "a
   * small weighted list", and this is that.
   *
   * **Nothing reads this yet.** Weighted selection needs a source of randomness
   * inside a `sim/` that is deliberately deterministic, which is its own task
   * (roadmap open finding 3). Until it lands `attackForBand` throws on a list
   * longer than one entry rather than quietly always picking the first, so a
   * second attack cannot be added and appear to do nothing.
   */
  weight: number;
}

/**
 * One distance band: what the fish does about the fight being at a given range.
 *
 * Bands are ordered nearest first on the definition, and each one states only
 * where it *ends*. The previous band's end is the next one's start, so a boundary
 * is one number rather than two that can disagree.
 */
export interface BandDefinition {
  id: BandId;
  /**
   * The line length this band ends at, exclusive of the hysteresis margin either
   * side of it. `Infinity` on the outermost band, which has no far edge.
   *
   * Measured on line length, which is euclidean and includes depth, not on
   * horizontal distance. That is what lets the fish's own depth move it between
   * bands, so rising and diving mean something beyond damage and telegraph
   * length.
   */
  maxDistance: number;
  /**
   * The depth the fish holds station at while it is in this band.
   *
   * design.md section 3's intent rule: depth is never random, so being shallow
   * is always something the player did. Rising to punish a boat that has closed
   * and sinking back once one has backed off is that rule at its simplest.
   */
  restingDepth: number;
  /**
   * Whether the fish closes horizontally on the boat while it is in this band.
   *
   * False is not laziness. A band whose attack already reaches across the lane
   * has no reason to chase, and a fish that chased anyway would eventually walk
   * every fight into a wall.
   */
  approaches: boolean;
  attacks: readonly BandAttack[];
}

export interface FishDefinition {
  /** Unique across all fish. Phase 4's record book and encounter table key on it. */
  id: string;
  name: string;
  rarity: FishRarity;
  /**
   * The fish's health, and what `FishState.resistanceMax` is seeded from.
   *
   * It is seeded onto the state rather than read from here during the fight,
   * because design.md section 4 scales resistance by player count in a co-op
   * room. This is the solo number; the room may start a fight with a bigger one.
   */
  resistance: number;
  /**
   * Body size in internal-resolution units. **The renderer reads these**, which
   * is the half of this format most easily forgotten: a definition only `sim/`
   * could see would draw every fish at the first one's size.
   */
  width: number;
  height: number;
  /** How fast it repositions horizontally while idle in a band that approaches. */
  swimPerTick: number;
  /** How fast it rises and dives towards its band's resting depth. */
  divePerTick: number;
  /**
   * Ordered nearest first. `bandFor` in `sim/distance.ts` walks them in this
   * order, so the order is load bearing rather than cosmetic.
   */
  bands: readonly BandDefinition[];
  patterns: readonly FishPattern[];
}

/**
 * How long a pattern's hitbox or volley is live.
 *
 * Authored on a melee column and derived on a volley: shots fire on the first
 * active tick and every interval after it, so the phase lasts exactly until the
 * last one has left.
 */
export function activeTicksOf(pattern: FishPattern): number {
  if (pattern.behaviour === 'meleeColumn') {
    return pattern.activeTicks;
  }

  return (pattern.shotCount - 1) * pattern.shotIntervalTicks + 1;
}

/**
 * Look a pattern up by id, throwing if the fish has no such pattern.
 *
 * Thrown rather than defaulted, for the same reason `stepFishAttack` throws on a
 * phase with no attack: a fish quietly running the wrong attack's timings for a
 * second and a half is far harder to notice than an error. A bad id here is a
 * typo in a data file, and it should surface the first time that fish is fought.
 */
export function patternById(fish: FishDefinition, id: string): FishPattern {
  const pattern = fish.patterns.find((candidate) => candidate.id === id);

  if (pattern === undefined) {
    throw new Error(`fish ${fish.id} has no pattern ${id}`);
  }

  return pattern;
}

/**
 * The same, narrowed to one behaviour.
 *
 * Everything that reads a pattern's own numbers rather than the four every
 * pattern shares needs the union narrowed first, and doing it with a bare
 * `behaviour !== ...` check at each call site puts the same unreachable branch in
 * several places. These two put it in one, and the thrown message names the id,
 * which is what a data-file typo needs it to say.
 */
export function meleePatternById(
  fish: FishDefinition,
  id: string,
): MeleeColumnPattern {
  const pattern = patternById(fish, id);

  if (pattern.behaviour !== 'meleeColumn') {
    throw new Error(`pattern ${id} of fish ${fish.id} is not a melee column`);
  }

  return pattern;
}

/** The same for volleys. */
export function volleyPatternById(
  fish: FishDefinition,
  id: string,
): VolleyPattern {
  const pattern = patternById(fish, id);

  if (pattern.behaviour !== 'volley') {
    throw new Error(`pattern ${id} of fish ${fish.id} is not a volley`);
  }

  return pattern;
}

/** The same for bands, thrown for the same reason. */
export function bandById(fish: FishDefinition, id: BandId): BandDefinition {
  const band = fish.bands.find((candidate) => candidate.id === id);

  if (band === undefined) {
    throw new Error(`fish ${fish.id} has no band ${id}`);
  }

  return band;
}
