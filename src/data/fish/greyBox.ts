/**
 * The grey box fish. Data only, no logic.
 *
 * The fish the whole of phase 1 was tuned against, and the first thing written
 * in this format. Every number below was chosen between 2026-08-19 and
 * 2026-08-20 and argued about in decisions.md; task 3.1 moved them here without
 * changing one of them, so the entries under those dates are still the reasoning
 * for what is in this file.
 *
 * design.md section 3's **common** rarity: two bands, one attack each. The close
 * band gets the lunge and the far band the volley, which is the minimum design.md
 * allows — one attack that punishes standing close and one that punishes standing
 * far, or the optimal strategy collapses to one position.
 *
 * **Reading convention.** The numbers written inside `ticksAtPace` and
 * `speedPerTick` are the **authored** ones, at pace 1.0, and the prose here quotes
 * those. `GAME_PACE` scales speeds up and durations down, so divide any wall-clock
 * time quoted below by it. Ratios between two paced values are unchanged and
 * distances are never paced at all, so every "clears the hitbox in N units" claim
 * is exact as written. Do not collapse `ticksAtPace(34)` to 27: that would lose
 * both the reasoning and the pace axis at once.
 */

import { speedPerTick, ticksAtPace } from '../config.ts';
import type { FishDefinition } from './types.ts';

/**
 * The close punisher. Chosen 2026-08-19, see decisions.md.
 *
 * design.md section 3 requires every fish to have an attack that punishes being
 * close, because otherwise the best damage position is also the safest one and
 * the movement axis stops mattering. This is that attack.
 *
 * Durations are authored in ticks rather than per second, unlike the speeds
 * below. Telegraphs are reasoned about in frames: the question being answered is
 * "how many frames does the player have to read this and move", and converting
 * that through a rate would only obscure it.
 *
 * The wind-up is the telegraph and cannot be cancelled once it starts, which
 * design.md section 3 calls non-negotiable. The recovery is the player's reward
 * for reading it: 45 ticks is two attacks at the boat's 20-tick cadence, or one
 * attack and a reposition.
 *
 * The wind-up was cut from 45 to 34 at the 1.13 tuning pass. Walking clear of the
 * hitbox takes 28 ticks, so the slack fell from 17 ticks to 6: the tell now has
 * to be read as it appears rather than at leisure, or the dash pays for it. 28 is
 * a hard floor and a test pins it — below that the attack becomes undodgeable on
 * foot, which would make the dash mandatory rather than insurance.
 *
 * The cooldown was cut from 60 at the same pass. Recovery plus cooldown is 85
 * ticks of safety after the hitbox clears, about four boat attacks and 32
 * stamina, during which the refill never runs because every one of them restarts
 * its 30-tick pause. That is the exchange the fight is built on: the safe window
 * is also the window in which the pool is being emptied. The old 105-tick window
 * was half of why camping close worked.
 *
 * 25 hull damage is priced against the default boat's 100, so four of them end a
 * fight. A single hit is a real setback rather than a scratch, which is the Souls
 * flavour design.md section 1 asks for, but one misread is survivable.
 *
 * The 60-unit box: the hull is 24 wide, so the boat is clear of it at 42 units
 * from the fish's centre. One dash covers 55 and escapes with room; walking
 * covers it in the 28 ticks above.
 */
const LUNGE = {
  id: 'lunge',
  behaviour: 'meleeColumn',
  windUpTicks: ticksAtPace(34),
  activeTicks: ticksAtPace(8),
  recoveryTicks: ticksAtPace(45),
  cooldownTicks: ticksAtPace(40),
  hullDamage: 25,
  hitboxWidth: 60,
  punishes: 'close',
} as const;

/**
 * The far punisher, a slow tracking volley. Chosen 2026-08-20, see decisions.md.
 *
 * The other half of design.md section 3's no-safe-camping-spot rule: without it
 * the best place to stand is across the lane, chipping away at the damage floor
 * in complete safety, and the movement axis only matters in one direction.
 *
 * design.md section 3 asks for it to be "trivially sidestepped up close, hard to
 * read from across the screen". Both halves are bought with the two rates below:
 * the shots rise slowly, so the warning is the wind-up plus the whole flight, and
 * they steer at well under walking pace, so a player who reads the tell walks out
 * of the way without spending anything.
 *
 * Three shots, spaced far enough apart that one lazy sidestep does not clear all
 * of them, which is what makes it a volley rather than three copies of the same
 * dodge. There is no active duration here: it is derived from the count and the
 * interval by `activeTicksOf`, so the phase lasts exactly until the last shot has
 * left and a fourth number cannot disagree with the first two.
 *
 * The 90-tick cooldown is longer than the lunge's 40, because the shots are still
 * in the air during it: the fish being idle is not the same as the attack being
 * over.
 *
 * 8 hull a shot against the default boat's 100, so a whole volley eaten is 24,
 * about one lunge. Deliberately cheaper per hit: a single shot is a scratch that
 * says "move", and it is only camping across the lane and ignoring all of them
 * that ends a fight. The hull is 24 wide against a 10-wide shot, so the boat is
 * clear 17 units away, which is 11 ticks of walking.
 *
 * 96 a second of climb is 1.6 units a tick, so from the far band's resting depth
 * of 100 a shot is in the air for about 63 ticks. With the 40-tick wind-up in
 * front of it that is about 1.7 seconds of warning, and it scales with depth for
 * free. Raised from 72 at the 1.13 tuning pass, on "projectiles could be faster".
 *
 * 48 a second of tracking is 53% of the 90 the boat walks at, and a test pins
 * that inequality rather than the value, so a retune cannot quietly turn the
 * volley into something only a dash answers. Tracking is a correction on top of
 * the lob each shot is thrown with: a shot left alone lands where the boat was
 * standing when it was fired, from anywhere on the lane, and the cap is only how
 * far it may follow from there, about 50 units over a full flight. Tracking alone
 * could never cross the lane, and a volley that could not reach a boat parked
 * across it would leave exactly the safe camping spot design.md section 3 forbids.
 */
const VOLLEY = {
  id: 'volley',
  behaviour: 'volley',
  windUpTicks: ticksAtPace(40),
  recoveryTicks: ticksAtPace(30),
  cooldownTicks: ticksAtPace(90),
  hullDamage: 8,
  shotCount: 3,
  shotIntervalTicks: ticksAtPace(15),
  shotWidth: 10,
  risePerTick: speedPerTick(96),
  trackPerTick: speedPerTick(48),
  punishes: 'far',
} as const;

/**
 * Where the bands are cut. Chosen 2026-08-20, see decisions.md.
 *
 * Named because two things read it and one invariant is stated against it: the
 * close band's real width is this minus the hysteresis margin in `config.ts`, not
 * this, and a resting depth deeper than `edge - hysteresis` could never be pulled
 * into the close band at all. A test pins that.
 *
 * In units the fight is actually played in: against a fish resting at the far
 * band's depth the close band starts about 75 horizontal away, and against one
 * risen to the close band's depth it does not end until about 147. That asymmetry
 * is not a mistake. Rising shortens the line by itself, so a fish that has
 * committed to being close is harder to shake off than it was to draw in, which
 * is what makes closing a decision rather than a toggle.
 */
const BAND_EDGE = 140;

/**
 * The grey box fish.
 *
 * 400 resistance is sized for roughly a 48 to 72 second fight. Deliberately not
 * paced at the 1.13 tuning pass and deliberately not raised to compensate for
 * pacing either: attacks come 25% more often at GAME_PACE 1.25 while this stays
 * at 400. A longer fast fight reads as padded.
 *
 * 20 by 12 units, wider than tall so it reads as a fish and not as a second boat.
 * Grey box proportions, replaced by the phase 8 art pass.
 *
 * 42 a second of swim is 47% of the 90 the boat walks at, and a test pins that
 * inequality rather than the value. Walking always breaks contact, so a fish
 * gliding towards you is pressure rather than a trap. **The pinned inequality is
 * necessary but not sufficient and this number is capped well below it**: being
 * slower than the boat only guarantees breaking contact in an unbounded lane, and
 * the lane is 480 units with the boat clamped to it. That caps the swim speed near
 * 47 whatever the inequality says, and 42 keeps about 20 ticks of margin. Raised
 * from 36 at the 1.13 tuning pass; 54 was tried first and let the fish corner a
 * fleeing boat against a wall permanently.
 *
 * 30 a second of rise and dive takes it between its two resting depths in about
 * 1.7 seconds, a little under one attack cycle, so it arrives at the depth its
 * band wants at roughly the moment it is ready to attack from there.
 *
 * The two resting depths are levers the fish already had, now pointed at
 * something. Depth is a leg of line length, so rising to 50 hands the player full
 * damage for as long as they are willing to stand in the hitbox, and it is the
 * divisor in the volley's flight time, so a shallow fish's shots give half the
 * warning a resting one's do. Neither needed a new number.
 *
 * The close band approaches and the far band holds station. Holding station is
 * not laziness: the volley already reaches across the whole lane, so a far-band
 * fish has no reason to chase, and one that did would eventually walk every fight
 * into a wall. The approach exists because the close band is much wider than the
 * 60-unit hitbox at its centre, and without it the fish would sit in the gap
 * between the two with nothing it could do.
 */
export const GREY_BOX: FishDefinition = {
  id: 'grey-box',
  name: 'Grey Box',
  rarity: 'common',
  resistance: 400,
  width: 20,
  height: 12,
  swimPerTick: speedPerTick(42),
  divePerTick: speedPerTick(30),
  // Ordered nearest first, which `bandFor` depends on.
  bands: [
    {
      id: 'close',
      maxDistance: BAND_EDGE,
      restingDepth: 50,
      approaches: true,
      attacks: [{ patternId: LUNGE.id, weight: 1 }],
    },
    {
      id: 'far',
      // No far edge: the outermost band is everything past the one before it.
      maxDistance: Infinity,
      restingDepth: 100,
      approaches: false,
      attacks: [{ patternId: VOLLEY.id, weight: 1 }],
    },
  ],
  patterns: [LUNGE, VOLLEY],
};
