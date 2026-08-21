/**
 * The duelling perch. Data only, no logic.
 *
 * design.md section 1's own example — "a perch that pulls a tiny sword" — so the
 * name is read off the design document rather than invented. Twitchy, always in
 * your face, and every hit is a scratch. The short breathless fight, and the
 * first of the three fish added at task 3.3.
 *
 * design.md section 3's **common** rarity: two bands, one attack each. What makes
 * it a different fight from the grey box fish is not any single number but the
 * shape all of them make together — a close band covering most of the lane, tells
 * short enough to have to be read as they appear, and damage low enough that no
 * one misread decides anything. It kills by volume.
 *
 * **Reading convention**, the same as `greyBox.ts`: numbers written inside
 * `ticksAtPace` and `speedPerTick` are the **authored** ones, at pace 1.0, and the
 * prose here quotes those. Divide any wall-clock time by `GAME_PACE`. Distances
 * are never paced, so every "clears the hitbox in N units" claim is exact.
 */

import { speedPerTick, ticksAtPace } from '../config.ts';
import type { FishDefinition } from './types.ts';

/**
 * The close punisher, and the attack this fish is really made of.
 *
 * Everything about it is the grey box lunge scaled down and sped up. The box is
 * 48 wide against 60, so the boat is clear of it 24 + 12 of hull = 36 units from
 * the fish's centre, which is 24 ticks of walking. A 28-tick tell therefore
 * leaves **4 ticks of slack** where the grey box fish's leaves 6. That is
 * design.md section 3's "faster tells" made literal, and 24 is the hard floor
 * underneath it: below that the attack stops being dodgeable on foot and the dash
 * becomes mandatory rather than insurance.
 *
 * The pressure is in the recovery and cooldown rather than in the damage.
 * 30 + 22 is 52 ticks of safety after the hitbox clears, against the grey box
 * fish's 85 — barely two boat attacks, and every one of them restarts the 30-tick
 * refill pause. The pool never really recovers while this fish is alive, which is
 * the whole feel: you are always slightly behind on stamina.
 *
 * 12 hull damage against the default boat's 100 is nine jabs to end a fight,
 * where the grey box fish needs four lunges. No single misread is a disaster and
 * a run of them still is.
 */
const JAB = {
  id: 'jab',
  behaviour: 'meleeColumn',
  windUpTicks: ticksAtPace(28),
  activeTicks: ticksAtPace(6),
  recoveryTicks: ticksAtPace(30),
  cooldownTicks: ticksAtPace(22),
  hullDamage: 12,
  hitboxWidth: 48,
  punishes: 'close',
} as const;

/**
 * The far punisher, and a grudging one.
 *
 * design.md section 3 requires it — without an attack that punishes standing far
 * the best place to stand is across the lane in complete safety — but this fish
 * does not want to be out here and the numbers say so. Two shots rather than
 * three, 5 hull each, and a 70-tick cooldown it spends closing the distance.
 *
 * The shots are fast: 130 a second is 2.17 units a tick, so from the far station
 * at depth 120 one is in the air for about 55 ticks. With the 30-tick wind-up in
 * front of it that is well under half the warning the grey box volley gives, and
 * it is the compensation for there being only two of them. Tracking at 30 is 33%
 * of the boat's 90, the gentlest correction of any fish, so reading it is
 * genuinely enough and no dash is needed.
 */
const SPIT = {
  id: 'spit',
  behaviour: 'volley',
  windUpTicks: ticksAtPace(30),
  recoveryTicks: ticksAtPace(20),
  cooldownTicks: ticksAtPace(70),
  hullDamage: 5,
  shotCount: 2,
  shotIntervalTicks: ticksAtPace(12),
  shotWidth: 8,
  risePerTick: speedPerTick(130),
  trackPerTick: speedPerTick(30),
  punishes: 'far',
} as const;

/**
 * Where the bands are cut, and the single number that makes this fish itself.
 *
 * 170 against the grey box fish's 140. In the units the fight is actually played
 * in, and remembering that a band only changes once the length is past the edge
 * by the hysteresis margin: against a perch resting at its far station of 120 the
 * close band starts about **98** horizontal away, against the grey box fish's 75,
 * and against one risen to 40 it does not end until about **181**, against 147.
 * The perch is in your face for most of the fight, and backing off far enough to
 * make it stop is a long walk under fire.
 *
 * The invariant from roadmap invariant 1 holds with room to spare: the far
 * station of 120 is well inside `170 - FISH_BAND_HYSTERESIS`, which is 155, so a
 * boat standing overhead can always pull it into the close band.
 */
const BAND_EDGE = 170;

/**
 * The duelling perch.
 *
 * 260 resistance against the grey box fish's 400, so the fight is roughly two
 * thirds the length. It has to be: a fish attacking at this cadence for a full
 * minute stops being pressure and becomes attrition, and the point of this one is
 * that it is over before you have caught your breath.
 *
 * 14 by 9 units, small and quick, against the grey box fish's 20 by 12. Grey box
 * proportions, replaced by the phase 8 art pass.
 *
 * **44 a second of swim is the number to watch on this fish.** Roadmap invariant
 * 2: the lane is 480 units with the boat clamped to it, which caps swim speed near
 * 47 whatever the pinned `swimPerTick < BOAT_SPEED_PER_TICK` inequality says —
 * above that the fish corners a fleeing boat against a wall permanently. 44 is
 * deliberately closer to that cap than the grey box fish's 42, because the perch
 * is supposed to be hard to shake off, and it leaves only a few ticks of margin.
 * If any fish in the game walls the boat, it is this one, and this is the number
 * to lower.
 *
 * 44 a second of dive as well, half again the grey box fish's 30. It commits to a
 * depth in about 1.8 seconds authored, so it arrives where its band wants it well
 * before it is ready to attack from there. An eager fish, in both axes.
 *
 * The two stations are further apart than the grey box fish's, 40 and 120 against
 * 50 and 100. Rising to 40 hands the player better than full damage range and
 * halves the warning its own shots give, and it does that more often than any
 * other fish because of how wide the close band is. Both directions of that are
 * the trade design.md section 2 asks depth to make.
 */
export const DUELLING_PERCH: FishDefinition = {
  id: 'duelling-perch',
  name: 'Duelling Perch',
  rarity: 'common',
  resistance: 260,
  width: 14,
  height: 9,
  swimPerTick: speedPerTick(44),
  divePerTick: speedPerTick(44),
  // Ordered nearest first, which `bandFor` depends on.
  bands: [
    {
      id: 'close',
      maxDistance: BAND_EDGE,
      restingDepth: 40,
      // The close band is far wider than the 48-unit hitbox at its centre, so
      // without the approach the perch would spend most of the band sitting in
      // the gap with nothing it could do.
      approaches: true,
      attacks: [{ patternId: JAB.id, weight: 1 }],
    },
    {
      id: 'far',
      // No far edge: the outermost band is everything past the one before it.
      maxDistance: Infinity,
      restingDepth: 120,
      // The spit already reaches across the whole lane, so there is nothing out
      // here worth chasing for.
      approaches: false,
      attacks: [{ patternId: SPIT.id, weight: 1 }],
    },
  ],
  patterns: [JAB, SPIT],
};
