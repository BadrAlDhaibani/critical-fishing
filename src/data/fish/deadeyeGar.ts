/**
 * The deadeye gar. Data only, no logic.
 *
 * Long, thin, and it would rather you stayed over there. The third of the three
 * fish added at task 3.3, and deliberately the inverse of the duelling perch:
 * crossing the lane under fire **is** the fight, and once you have arrived it has
 * very little left.
 *
 * design.md section 3's **common** rarity: two bands, one attack each. What makes
 * it a different fight is which of the two attacks it is built around. Every other
 * fish so far treats its far punisher as the thing it does while it waits to get
 * close; this one treats the close punisher as the price of being caught.
 *
 * **Reading convention**, the same as `greyBox.ts`: numbers written inside
 * `ticksAtPace` and `speedPerTick` are the **authored** ones, at pace 1.0, and the
 * prose here quotes those. Divide any wall-clock time by `GAME_PACE`. Distances
 * are never paced, so every "clears the hitbox in N units" claim is exact.
 */

import { speedPerTick, ticksAtPace } from '../config.ts';
import type { FishDefinition } from './types.ts';

/**
 * The close punisher, and the weakest one in the game.
 *
 * design.md section 3 requires it and this fish resents it. The 52-unit box means
 * the boat is clear 26 + 12 = 38 units from the fish's centre, which is 26 ticks
 * of walking, and the 34-tick tell leaves 8 ticks of slack — comfortably readable,
 * between the grey box lunge's 6 and the carp's 19.
 *
 * 16 hull is a little over half the carp's slam. Seven flails end a fight, so
 * standing on top of this fish and ignoring the tell is still fatal eventually,
 * which is what stops close range being the safe camping spot design.md section 3
 * forbids. It just takes a while.
 *
 * **The 55-tick recovery is the real number here**, and it is the longest punish
 * window any single attack offers. At the boat's 20-tick attack cadence that is
 * nearly three free hits at close range, where the damage curve is paying full
 * rate. Closing the distance is expensive and this is what it buys. The whole
 * fish is built to make that trade legible: everything up to the crossing hurts,
 * and everything after it is yours.
 */
const FLAIL = {
  id: 'flail',
  behaviour: 'meleeColumn',
  windUpTicks: ticksAtPace(34),
  activeTicks: ticksAtPace(5),
  recoveryTicks: ticksAtPace(55),
  cooldownTicks: ticksAtPace(45),
  hullDamage: 16,
  hitboxWidth: 52,
  punishes: 'close',
} as const;

/**
 * The far punisher, and what this fish actually is.
 *
 * Five shots, the most in the game, on a 34-tick wind-up, the shortest any volley
 * gets. design.md section 3 asks the far punisher to be "hard to read from across
 * the screen", and this is that line taken further than any other fish takes it:
 * the tell is as long as a melee tell, and what follows it is not one thing to
 * dodge but five, 11 ticks apart, which is close enough that a lazy sidestep
 * clears one and walks into the next.
 *
 * **Tracking at 62 is the highest in the game and the number that defines the
 * attack.** That is 69% of the boat's 90, against the grey box volley's 53%.
 * Walking still outruns the correction — the inequality a test pins is what keeps
 * this an attack answered by reading rather than by spending a dash — but only
 * just, and only if the movement starts early. Read it late and walking is no
 * longer enough, which is the one place in this fish's design where the dash is
 * meant to look attractive.
 *
 * 84 a second of climb is 1.4 units a tick, so from the far station at depth 95 a
 * shot is in the air about 68 ticks. 7 hull each, 35 for the whole salvo, and a
 * 75-tick cooldown: short for a volley of this size, because the fish holding
 * station across the lane has nothing else to do with the time.
 */
const SALVO = {
  id: 'salvo',
  behaviour: 'volley',
  windUpTicks: ticksAtPace(34),
  recoveryTicks: ticksAtPace(25),
  cooldownTicks: ticksAtPace(75),
  hullDamage: 7,
  shotCount: 5,
  shotIntervalTicks: ticksAtPace(11),
  shotWidth: 12,
  risePerTick: speedPerTick(84),
  trackPerTick: speedPerTick(62),
  punishes: 'far',
} as const;

/**
 * Where the bands are cut, and the geometry that makes the crossing a crossing.
 *
 * 115, the narrowest close band in the game against the grey box fish's 140 and
 * the perch's 170. What that costs the player is much more than the 25 units it
 * looks like, because **line length is euclidean and depth is a leg of it.**
 *
 * Work it through against a gar resting at its far station of 95. The band only
 * changes once the length is inside `115 - FISH_BAND_HYSTERESIS`, which is 100, and
 * with 95 of that already spent on depth the horizontal budget left is
 * `sqrt(100² - 95²)`, about **31 units**. The boat has to be almost directly
 * overhead before this fish acknowledges it is close at all, and every step of the
 * way there is under salvo fire at full tracking.
 *
 * Roadmap invariant 1 is tight here for the same reason it is on the carp, from
 * the other direction: the far station of 95 sits 5 units inside the 100 above. A
 * shallower band edge on this fish means a shallower far station too, or the gar
 * would hold its outer station for the whole fight and the flail would never fire.
 */
const BAND_EDGE = 115;

/**
 * The deadeye gar.
 *
 * 340 resistance, between the perch's 260 and the grey box fish's 400. Sized down
 * from the grey box deliberately: most of a fight against this fish is spent out
 * of range doing floor damage, so the same pool would read as a much longer fight
 * than the number suggests.
 *
 * 26 by 8 units, the longest and thinnest body in the game against the carp's 30
 * by 18. Grey box proportions, replaced by the phase 8 art pass, but the
 * silhouette is doing work even as a rectangle: a gar is a rifle with fins and it
 * should not read as the same animal as the carp.
 *
 * 34 a second of swim is 38% of the boat's 90, slower than the grey box fish's 42
 * and far under the ~47 cap roadmap invariant 2 warns about. It closes badly and
 * that is correct — a fish whose whole design is preferring range should not be
 * good at chasing.
 *
 * 36 a second of dive is faster than it swims, which is the one place it is
 * genuinely quick. Its answer to a boat arriving overhead is to sink back towards
 * 95 and start shooting again, and the 40 units between its stations take about
 * 1.1 seconds authored. Getting close is hard; **staying** close is the fight.
 */
export const DEADEYE_GAR: FishDefinition = {
  id: 'deadeye-gar',
  name: 'Deadeye Gar',
  rarity: 'common',
  resistance: 340,
  width: 26,
  height: 8,
  swimPerTick: speedPerTick(34),
  divePerTick: speedPerTick(36),
  // Ordered nearest first, which `bandFor` depends on.
  bands: [
    {
      id: 'close',
      maxDistance: BAND_EDGE,
      restingDepth: 45,
      // Narrow as this band is, it is still wider than the 52-unit flail box, so
      // the approach is what stops the gar stranding itself just out of its own
      // reach with nothing it can do.
      approaches: true,
      attacks: [{ patternId: FLAIL.id, weight: 1 }],
    },
    {
      id: 'far',
      // No far edge: the outermost band is everything past the one before it.
      maxDistance: Infinity,
      // 5 units inside `BAND_EDGE - FISH_BAND_HYSTERESIS`. See BAND_EDGE above,
      // which works through why this leaves only ~31 units of horizontal room.
      restingDepth: 95,
      // Holding station is the entire personality. The salvo reaches across the
      // lane and the gar has no interest in being anywhere else.
      approaches: false,
      attacks: [{ patternId: SALVO.id, weight: 1 }],
    },
  ],
  patterns: [FLAIL, SALVO],
};
