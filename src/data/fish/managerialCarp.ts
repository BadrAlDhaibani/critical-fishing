/**
 * The managerial carp. Data only, no logic.
 *
 * design.md section 1's other example — "a carp in a business suit" — so this
 * name too is read off the design document rather than invented. Unhurried,
 * self-important, and it hits like a filing cabinet. The second of the three fish
 * added at task 3.3, and the Souls fish of the set: everything it does is legible
 * and everything it does is lethal.
 *
 * design.md section 3's **common** rarity: two bands, one attack each. Difficulty
 * comes from more to read rather than from bigger numbers, and this fish is the
 * honest test of where that line sits. It has no more to read than the grey box
 * fish. What it has is time — long enough tells that a misread is never the
 * game's fault — and the damage to make being wrong anyway matter. That is a
 * different fight without being a harder rung on the ladder.
 *
 * **Reading convention**, the same as `greyBox.ts`: numbers written inside
 * `ticksAtPace` and `speedPerTick` are the **authored** ones, at pace 1.0, and the
 * prose here quotes those. Divide any wall-clock time by `GAME_PACE`. Distances
 * are never paced, so every "clears the hitbox in N units" claim is exact.
 */

import { speedPerTick, ticksAtPace } from '../config.ts';
import type { FishDefinition } from './types.ts';

/**
 * The close punisher, and the biggest single hit in the game.
 *
 * The 84-unit box is the widest any fish owns. The hull is 24 wide, so the boat
 * is clear of it 42 + 12 = 54 units from the fish's centre, which is 36 ticks of
 * walking — more than the grey box fish's whole clearing distance. The 55-tick
 * tell leaves **19 ticks of slack** against the grey box lunge's 6, so this is the
 * one attack in the game that can be read at leisure. One dash covers 55 units and
 * clears it outright with a unit to spare.
 *
 * 34 hull against the default boat's 100 means **three slams end a fight**, where
 * four grey box lunges do. That is the trade the long tell buys: design.md pillar
 * 3 puts every loss on the player, and an attack this readable is allowed to cost
 * this much precisely because nothing about it is hidden.
 *
 * It is also the first hit in the game above `SHAKE_MAX_DAMAGE`, which is 25.
 * `shake.ts` clamps above the ceiling, so this simply maxes the shake out. That is
 * the behaviour `config.ts` wrote in anticipation at task 3.1 when it made the
 * ceiling a game constant rather than the current fish's biggest hit — the shake
 * has to mean the same thing across every fish, and a minnow's chip hit has to
 * read as lighter than this.
 *
 * 60 recovery and 55 cooldown is 115 ticks of safety afterwards, the longest
 * window any fish leaves, which is where the damage to answer 560 resistance
 * comes from.
 */
const SLAM = {
  id: 'slam',
  behaviour: 'meleeColumn',
  windUpTicks: ticksAtPace(55),
  activeTicks: ticksAtPace(12),
  recoveryTicks: ticksAtPace(60),
  cooldownTicks: ticksAtPace(55),
  hullDamage: 34,
  hitboxWidth: 84,
  punishes: 'close',
} as const;

/**
 * The far punisher. Slow, heavy, and impossible to miss coming.
 *
 * Four shots at 14 hull each is 56 if the whole barrage lands, over half the
 * default hull and more than the grey box fish's entire volley twice over. It is
 * the one attack in the game where eating all of it is close to fatal on its own.
 *
 * Everything about the delivery apologises for that. 70 a second of climb is 1.17
 * units a tick, so from the far station at depth 130 a shot is in the air for
 * about 111 ticks — nearly two seconds authored — and the 60-tick wind-up sits in
 * front of that. The shots are 14 wide, the fattest in the game, so they are also
 * the easiest to see coming and the widest to have to clear: the boat is clear 7 +
 * 12 = 19 units away, which is 13 ticks of walking. The 20-tick spacing means one
 * sidestep clears one shot and no more.
 *
 * Tracking at 40 is 44% of the boat's 90, below the grey box fish's 53%. Walking
 * comfortably outruns the correction, which is the point: nothing here should ever
 * need a dash, so every hit is a hit the player chose to stand in.
 *
 * The 110-tick cooldown is the longest in the game and it has to be. The shots are
 * still climbing during it, so the fish going idle is nowhere near the attack
 * being over.
 */
const BARRAGE = {
  id: 'barrage',
  behaviour: 'volley',
  windUpTicks: ticksAtPace(60),
  recoveryTicks: ticksAtPace(40),
  cooldownTicks: ticksAtPace(110),
  hullDamage: 14,
  shotCount: 4,
  shotIntervalTicks: ticksAtPace(20),
  shotWidth: 14,
  risePerTick: speedPerTick(70),
  trackPerTick: speedPerTick(40),
  punishes: 'far',
} as const;

/**
 * Where the bands are cut.
 *
 * 150, close to the grey box fish's 140, but **the edge is the misleading number
 * here** and the depth underneath it does most of the work. Line length is
 * euclidean, so a station of 130 has already spent almost the whole 135-unit
 * budget on depth before any horizontal distance is counted: against a resting
 * carp the close band starts only about **36** horizontal away, where the grey box
 * fish's starts at 75. Once it has risen to 55 the band does not end until about
 * **156**. So the carp is nearly overhead or it is not close at all, and there is
 * very little middle — which is what makes its two attacks feel like two separate
 * fights rather than a gradient between them.
 *
 * **Roadmap invariant 1 is close to its edge here on purpose.** The far station of
 * 130 sits 5 units inside `150 - FISH_BAND_HYSTERESIS`, which is 135. A boat
 * directly overhead is exactly `depth` away, so a station any deeper than 135
 * could never be pulled into the close band at all and the slam would never fire
 * once in a whole fight. Deepening this fish means moving the band edge with it.
 * `tests/fish.test.ts` pins the rule, and this fish is what stops it passing
 * vacuously.
 */
const BAND_EDGE = 150;

/**
 * The managerial carp.
 *
 * 560 resistance against the grey box fish's 400, so the fight runs about 40%
 * longer. Sized to the safety it gives away rather than to a target time: 115
 * ticks of window after every slam is a great deal of free damage, and a smaller
 * pool would end before the fish had shown the player its second attack twice.
 *
 * 30 by 18 units, half again the grey box fish's size in both axes and the
 * largest body in the game. It reads as a thing with weight before it has done
 * anything, which is most of what a common fish gets to say about itself at grey
 * box fidelity.
 *
 * 26 a second of swim is 29% of the boat's 90, the slowest approach in the game
 * and well under the ~47 cap roadmap invariant 2 warns about. It will never corner
 * anybody. Backing off from this fish always works; the question the fight asks is
 * whether you can afford to.
 *
 * 18 a second of dive is the slow half of what makes it readable. It takes about
 * 4.2 seconds authored to travel between its two stations, roughly a whole attack
 * cycle, so its depth is a commitment made well in advance rather than a
 * correction. design.md section 3 wants "the fish is shallow right now" to read as
 * an earned window, and against this fish the window is visible opening.
 */
export const MANAGERIAL_CARP: FishDefinition = {
  id: 'managerial-carp',
  name: 'Managerial Carp',
  rarity: 'common',
  resistance: 560,
  width: 30,
  height: 18,
  swimPerTick: speedPerTick(26),
  divePerTick: speedPerTick(18),
  // Ordered nearest first, which `bandFor` depends on.
  bands: [
    {
      id: 'close',
      maxDistance: BAND_EDGE,
      restingDepth: 55,
      // Wide as the slam's box is, the close band is wider, so the approach is
      // still what stops the fish stranding itself in the gap between the two.
      approaches: true,
      attacks: [{ patternId: SLAM.id, weight: 1 }],
    },
    {
      id: 'far',
      // No far edge: the outermost band is everything past the one before it.
      maxDistance: Infinity,
      // 5 units inside `BAND_EDGE - FISH_BAND_HYSTERESIS`. See BAND_EDGE above:
      // this is the deepest station this band edge can carry.
      restingDepth: 130,
      // The barrage reaches across the whole lane, so there is nothing to chase.
      approaches: false,
      attacks: [{ patternId: BARRAGE.id, weight: 1 }],
    },
  ],
  patterns: [SLAM, BARRAGE],
};
