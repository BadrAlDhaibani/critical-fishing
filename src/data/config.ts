/**
 * Tunable constants. Named values only, never inline literals at the call site.
 *
 * design.md section 6: the game renders at a fixed low internal resolution and
 * is scaled up with nearest-neighbour filtering. That internal resolution is
 * the coordinate space the entire simulation lives in. Boat speed, dash
 * distance, hitbox sizes and distance band edges are all expressed in these
 * units. Rendering scales; the simulation never does.
 */

import { TICK_HZ } from '../sim/loop.ts';

/** Locked 2026-08-18. 16:9, exact 4x to 1080p. See decisions.md. */
export const INTERNAL_WIDTH = 480;
export const INTERNAL_HEIGHT = 270;

/**
 * Global pace. Chosen 2026-08-20 at the 1.13 tuning pass, see decisions.md.
 *
 * One knob for how fast the whole fight runs. Speeds scale **up** with it and
 * durations scale **down**, while every distance, cost, damage and pool stays
 * exactly where it is. That combination is time dilation rather than a rebalance:
 * the boat still covers the same ground during a wind-up, the hitbox is still
 * cleared by the same number of units, and every inequality below is a ratio
 * between two things that scale together, so all of them survive by
 * construction.
 *
 * What it is not is difficulty-neutral. Reaction time does not scale, so a
 * 34-tick tell that was 567ms is 450ms at 1.25. The geometry is untouched and the
 * clock is not, which is exactly the "faster, more stimulating" this was asked
 * for, but if the fight starts reading as unfair this is the first number to
 * suspect.
 *
 * The authored values below stay written as themselves, so `ticksAtPace(34)`
 * still records that this telegraph was designed as 34 ticks. Pace is a separate
 * axis from tuning, and collapsing the two would lose the reasoning.
 *
 * **Reading convention for everything below.** Prose in this file quotes the
 * **authored** numbers, which are the ones written in the call and the ones the
 * design reasoning is about. Anything wrapped in `atPace` or `ticksAtPace` is
 * that number at pace 1.0, and the effective value is scaled. Where a comment
 * quotes a wall-clock time, divide it by GAME_PACE. The two exceptions worth
 * knowing are that ratios between two paced values are unchanged (the fish still
 * swims at 47% of the boat's speed, the dash is still 2.67x walking), and
 * distances are never paced at all, so every "clears the hitbox in N units"
 * claim is exact as written.
 */
export const GAME_PACE = 1.25;

/** A speed in units per second, scaled by the global pace. */
const atPace = (unitsPerSecond: number): number => unitsPerSecond * GAME_PACE;

/**
 * A duration in ticks, scaled by the global pace. Rounded, because a tick count
 * has to be whole: at 1.25 that costs the close punisher's wind-up a fifth of a
 * tick, which is the one place the dilation is not quite exact.
 */
const ticksAtPace = (ticks: number): number => Math.round(ticks / GAME_PACE);

/**
 * Y of the water surface, where the boat sits. Everything below is water.
 *
 * Confirmed by playtest 2026-08-19. The 70 units of sky are not waste: the fish
 * breaching needs headroom (design.md section 6) and the hull and line bars go
 * up there at task 1.5. Leaves 200 units of depth for the fish to work in.
 */
export const WATER_LINE_Y = 70;

/**
 * Grey box palette. Replaced wholesale by the art pass in phase 8.
 *
 * Water is one flat colour on purpose. The arena has no floor: fish depth is
 * AI-driven through open water, so any horizontal band down there reads as a
 * seabed boundary that does not exist.
 */
export const COLOUR_SKY = 0x1b2b3a;
export const COLOUR_WATER = 0x1c5c86;
export const COLOUR_SURFACE = 0x3f8fbf;
export const COLOUR_BOAT = 0xd8cfc0;
export const COLOUR_FISH = 0x2b2f3a;
export const COLOUR_LINE = 0xe8e4da;

/**
 * Bar colours. `COLOUR_LINE` above is the tether; this is the stamina bar. The
 * two share the word "line" because design.md section 2 does, so the `BAR`
 * prefix is what keeps them apart.
 *
 * The backdrop is darker than `COLOUR_SKY` rather than lighter, so an empty bar
 * still reads as a bar rather than as a hole in the UI.
 */
export const COLOUR_BAR_BACKDROP = 0x0e1720;
export const COLOUR_BAR_HULL = 0xd8cfc0;
export const COLOUR_BAR_LINE = 0x4fbf9f;
export const COLOUR_BAR_RESISTANCE = 0xbf4f4f;

/**
 * Boat movement. Chosen 2026-08-19, see decisions.md.
 *
 * Instant velocity: pressing a key is full speed, releasing is a dead stop.
 * No acceleration and no momentum, because design.md pillar 3 puts every loss
 * on the player, and a boat that coasts turns a misread into a fight with the
 * controls. The weight comes from the speed value and later from what a dash
 * costs, not from input lag.
 *
 * 90 units per second crosses the 480-unit lane in about 5.3 seconds, which
 * leaves room above it for a dash to read as a genuine burst. This is the
 * single number most likely to move during the 1.13 tuning pass.
 *
 * Authored per second because that is how it gets reasoned about while tuning.
 * The per-tick value is derived from TICK_HZ so the two can never disagree.
 */
export const BOAT_SPEED_PER_SECOND = atPace(90);
export const BOAT_SPEED_PER_TICK = BOAT_SPEED_PER_SECOND / TICK_HZ;

/**
 * The dash. Chosen 2026-08-19, see decisions.md.
 *
 * design.md section 2 calls it the panic button and the reason you cannot dodge
 * everything, so the shape that matters is: fast enough to beat a telegraph,
 * short enough to commit to, expensive enough that spending it is a decision.
 *
 * 55 units over 14 ticks is roughly 236 units per second, about 2.6x walking.
 * It clears the boat's own width and a bit, which is the distance an attack
 * telegraph has to be dodged by, and it shifts line length far enough that the
 * damage traded away is felt rather than theoretical.
 *
 * Authored as distance and duration because that is how a dash is judged while
 * playing. The per-tick speed is derived, so the two cannot disagree and the
 * total travelled is exactly DASH_DISTANCE.
 */
export const DASH_DISTANCE = 55;
export const DASH_DURATION_TICKS = ticksAtPace(14);
export const DASH_SPEED_PER_TICK = DASH_DISTANCE / DASH_DURATION_TICKS;

/**
 * What one dash takes out of the pool. Five dashes from a full default line.
 *
 * Deliberately leaves room underneath it for the basic attack at task 1.7, so
 * that panicking twice still leaves something to fight with. Which of dashing
 * and attacking is the expensive habit is set here, and it is the number most
 * likely to move at the 1.13 tuning pass.
 */
export const DASH_LINE_COST = 16;

/**
 * The basic attack. Chosen 2026-08-19, see decisions.md.
 *
 * Half a dash, so ten attacks come out of a full default pool against five
 * dashes. That ordering is the point: attacking is the ordinary habit and the
 * dash is the expensive panic, which is how design.md section 2 frames the
 * contested resource. Every dash taken is two hits not landed.
 *
 * The cooldown is what stops the attack being held down. One press is one
 * attack regardless, but at 20 ticks the pool also cannot be emptied faster
 * than about 3.3 seconds, and there is a readable gap between hits to watch the
 * fish through once it starts attacking at 1.9.
 */
export const ATTACK_LINE_COST = 8;
export const ATTACK_COOLDOWN_TICKS = ticksAtPace(20);

/**
 * Stamina regeneration. Chosen 2026-08-19, see decisions.md.
 *
 * 6 a second refills the whole pool in 13.3 seconds and one attack's cost in
 * 1.3. Worked backwards from the fish: 400 resistance split across attacking
 * and dashing lands the fight in the 60 to 90 seconds FISH_RESISTANCE_MAX was
 * sized for. Attacking flat out spends 24 a second, so a burst always has to be
 * paid off afterwards.
 *
 * The delay is the Dark Souls rule and is where most of the feel lives. Any
 * spend, dash or attack, stops the refill for half a second, so attacking at
 * full cadence means it never runs at all and recovering is something you
 * disengage to do. From task 1.9 the moments spent recovering are the fish's
 * attack windows, which is the point. It also means the refill never runs
 * during a dash, since 14 ticks of dash sit inside the 30-tick pause its own
 * cost started, without that needing to be coded as a special case.
 *
 * Authored per second, per-tick derived from TICK_HZ, same as the boat's speed.
 */
export const LINE_REGEN_PER_SECOND = atPace(6);
export const LINE_REGEN_PER_TICK = LINE_REGEN_PER_SECOND / TICK_HZ;
export const LINE_REGEN_DELAY_TICKS = ticksAtPace(30);

/**
 * The damage-by-distance curve. Chosen 2026-08-19, see decisions.md.
 *
 * design.md section 2: damage scales inversely with line length, and that
 * coupling is the whole fight. Twenty perfect hits land the 400-resistance grey
 * box fish; sixty-six from across the lane do the same job far more slowly.
 *
 * ATTACK_FULL_DAMAGE_RANGE is where the curve tops out rather than a separate
 * tuned number: it is the fish's starting depth, so being directly above the
 * fish is a reachable perfect hit rather than a theoretical one. Once the AI
 * owns depth at task 1.11 a diving fish puts full damage out of reach and a
 * shallow one hands it back, which is exactly the earned window design.md
 * section 3 asks depth to produce.
 */
export const ATTACK_DAMAGE_MAX = 20;
export const ATTACK_DAMAGE_MIN = 6;
export const ATTACK_FULL_DAMAGE_RANGE = 100;

/**
 * The fish's close punisher. Chosen 2026-08-19, see decisions.md.
 *
 * design.md section 3 requires every fish to have an attack that punishes being
 * close, because otherwise the best damage position is also the safest one and
 * the movement axis stops mattering. This is that attack, and until task 1.11
 * gives the fish distance bands it is the only thing it does.
 *
 * Durations are authored in ticks rather than per second and derived, unlike the
 * boat's speed and the refill rate. Telegraphs are reasoned about in frames: the
 * question being answered is "how many frames does the player have to read this
 * and move", and converting that through a rate would only obscure it.
 *
 * The wind-up is the telegraph and cannot be cancelled once it starts, which
 * design.md section 3 calls non-negotiable. The recovery is the player's reward
 * for reading it: 45 ticks is two attacks at the 20-tick cadence, or one attack
 * and a reposition.
 *
 * The wind-up was cut from 45 to 34 at the 1.13 tuning pass. Walking clear of
 * the hitbox takes 28 ticks, so the slack fell from 17 ticks to 6: the tell now
 * has to be read as it appears rather than at leisure, or the dash pays for it.
 * 28 is a hard floor, and a test pins it — below that the attack becomes
 * undodgeable on foot, which would make the dash mandatory rather than
 * insurance.
 */
export const FISH_CLOSE_WINDUP_TICKS = ticksAtPace(34);
export const FISH_CLOSE_ACTIVE_TICKS = ticksAtPace(8);
export const FISH_CLOSE_RECOVERY_TICKS = ticksAtPace(45);

/**
 * The gap between the end of one attack and the earliest start of the next.
 *
 * A stand-in for attack selection, which arrives with the distance bands at task
 * 1.11. A static fish with no bands still needs some rule for when to commit,
 * and a cooldown is the cheapest one that does not invent band edges early.
 *
 * Recovery plus cooldown is 85 ticks of safety after the hitbox clears, about
 * four attacks at the 20-tick cadence and 32 stamina, during which the refill
 * never runs because the 30-tick pause is restarted by every one of them. That
 * is the exchange the fight is built on: the safe window is also the window in
 * which the pool is being emptied. Full cycle is 127 ticks, about 2.1 seconds.
 *
 * Cut from 60 at the 1.13 tuning pass. The old 105-tick safe window was half of
 * why camping close worked: one dodge on foot bought nearly two seconds of free
 * damage from the highest-damage position in the fight.
 */
export const FISH_CLOSE_COOLDOWN_TICKS = ticksAtPace(40);

/**
 * What one landed close punisher takes off the hull.
 *
 * Priced against the default boat's 100, so four of them end a fight. A single
 * hit is a real setback rather than a scratch, which is the Souls flavour
 * design.md section 1 asks for, but one misread is survivable.
 */
export const FISH_CLOSE_HULL_DAMAGE = 25;

/**
 * How much of the lane above the fish the attack covers, centred on the fish.
 *
 * The hull is 24 wide, so the boat is clear of a 60-wide box at 42 units from
 * the fish's centre. One dash covers 55 and escapes with room; walking covers it
 * in 28 ticks, which since the 1.13 tuning pass fits inside the 34-tick wind-up
 * with only 6 ticks to spare. The dash is therefore insurance rather than the
 * only answer, which is what keeps it a decision, but walking out is now a
 * read made immediately rather than at leisure.
 *
 * Width is the only number here. The attack is tested horizontally against a
 * boat that is always on the surface, so the box has no meaningful height: what
 * it is drawn as covering vertically is the renderer's business.
 */
export const FISH_CLOSE_HITBOX_WIDTH = 60;

/**
 * The fish's far punisher, a slow tracking volley. Chosen 2026-08-20, see
 * decisions.md.
 *
 * The other half of design.md section 3's no-safe-camping-spot rule: without it
 * the best place to stand is across the lane, chipping away at the damage floor
 * in complete safety, and the movement axis only matters in one direction.
 *
 * design.md section 3 asks for it to be "trivially sidestepped up close, hard to
 * read from across the screen". Both halves of that are bought with the same two
 * numbers below: the shots rise slowly, so the warning is the wind-up plus the
 * whole flight, and they steer at well under walking pace, so a player who reads
 * the tell walks out of the way without spending anything.
 *
 * Durations in ticks, for the same reason the close punisher's are: a telegraph
 * is reasoned about in frames.
 */
export const FISH_FAR_WINDUP_TICKS = ticksAtPace(40);
export const FISH_FAR_RECOVERY_TICKS = ticksAtPace(30);

/**
 * The volley. Three shots spaced far enough apart that one lazy sidestep does
 * not clear all of them, which is what makes it a volley rather than three
 * copies of the same dodge.
 *
 * The active duration is derived from the two: shots fire on the first tick and
 * every interval after it, so the phase lasts until the last one has left. A
 * fourth constant here could disagree with them.
 */
export const FISH_FAR_SHOT_COUNT = 3;
export const FISH_FAR_SHOT_INTERVAL_TICKS = ticksAtPace(15);
export const FISH_FAR_ACTIVE_TICKS =
  (FISH_FAR_SHOT_COUNT - 1) * FISH_FAR_SHOT_INTERVAL_TICKS + 1;

/**
 * The gap after the volley before the fish may commit to anything again. Longer
 * than the close punisher's 40, because the shots are still in the air during
 * it: the fish being idle is not the same as the attack being over.
 */
export const FISH_FAR_COOLDOWN_TICKS = ticksAtPace(90);

/**
 * How fast a shot climbs towards the surface, and how fast it may drift
 * sideways chasing the boat.
 *
 * Authored per second with the per-tick values derived from TICK_HZ, same as the
 * boat's speed and the stamina refill.
 *
 * 96 a second is 1.6 units a tick, so from the fish's resting depth of 100 a
 * shot is in the air for about 63 ticks. With the 40-tick wind-up in front of it
 * that is about 1.7 seconds of warning, and it scales with depth for free: a
 * deep fish telegraphs further ahead and a shallow one gives barely any notice.
 * Raised from 72 at the 1.13 tuning pass, on "projectiles could be faster".
 *
 * 48 a second of tracking is 53% of the 90 the boat walks at. That inequality is
 * the whole design of the attack and a test pins it: walking always outruns the
 * correction, so the volley is answered by reading it rather than by spending a
 * dash, while a player who only shuffles gets followed.
 *
 * Tracking is a correction on top of the lob each shot is thrown with, not the
 * whole of its aim. A shot left alone lands where the boat was standing when it
 * was fired, from anywhere on the lane; the cap is how far it is allowed to
 * follow the player from there, about 50 units over a full flight. Tracking
 * alone could never cross the lane, and a volley that could not reach a boat
 * parked across it would leave exactly the safe camping spot design.md section 3
 * forbids.
 *
 * Both are pinned by tests, the tracking one as an inequality against the boat's
 * walking speed rather than as a value, so a retune during task 1.13 cannot
 * quietly turn the volley into something only a dash answers.
 */
export const FISH_FAR_RISE_PER_SECOND = atPace(96);
export const FISH_FAR_RISE_PER_TICK = FISH_FAR_RISE_PER_SECOND / TICK_HZ;
export const FISH_FAR_TRACK_PER_SECOND = atPace(48);
export const FISH_FAR_TRACK_PER_TICK = FISH_FAR_TRACK_PER_SECOND / TICK_HZ;

/**
 * What one shot takes off the hull, and how wide it is.
 *
 * 8 against the default boat's 100, so a whole volley eaten is 24, about one
 * close punisher. Deliberately cheaper per hit than the close punisher's 25: a
 * single shot is a scratch that says "move", and it is only camping across the
 * lane and ignoring all of them that ends a fight.
 *
 * The hull is 24 wide against a 10-wide shot, so the boat is clear 17 units
 * away, which is 11 ticks of walking. Trivially sidestepped, exactly as
 * design.md section 3 asks, provided the tell was read.
 */
export const FISH_FAR_HULL_DAMAGE = 8;
export const FISH_FAR_SHOT_WIDTH = 10;
/** Square, so a shot cannot be mistaken for a small boat or a small fish. */
export const FISH_FAR_SHOT_HEIGHT = 10;

/**
 * The distance bands. Chosen 2026-08-20, see decisions.md.
 *
 * design.md section 3: the fish reads the current distance, picks from that
 * band's attacks, and repositions if it wants a different band. Two bands, one
 * attack each, which is the "common" rarity in that section. The close band gets
 * the close punisher and the far band the volley.
 *
 * Measured on line length, which is euclidean and includes depth, not on
 * horizontal distance. That is what lets the fish's own depth move it between
 * bands, so rising and diving mean something beyond damage and telegraph length.
 *
 * The hysteresis is design.md section 3's second fairness rule: inside the
 * margin the fish keeps whichever band it already had, so a player standing on
 * the boundary cannot make it flicker between two movesets.
 *
 * In units the fight is actually played in: against a fish resting at
 * FISH_FAR_BAND_DEPTH, the close band starts about 75 horizontal away, and
 * against one risen to FISH_CLOSE_BAND_DEPTH it does not end until about 147.
 * That asymmetry is not a mistake. Rising shortens the line by itself, so a fish
 * that has committed to being close is harder to shake off than it was to draw
 * in, which is what makes closing a decision rather than a toggle.
 */
export const FISH_BAND_EDGE = 140;
export const FISH_BAND_HYSTERESIS = 15;

/**
 * Where the fish wants to sit in each band. It rises to punish a boat that has
 * closed and sinks back once one has backed off.
 *
 * The intent design.md section 3 asks for, and the only depth script the grey
 * box fish has: "the fish is shallow right now" reads as an earned window
 * because closing in is what earned it.
 *
 * Both are levers the fish already had, now pointed at something. Depth is a leg
 * of line length, so rising to 50 hands the player full damage for as long as
 * they are willing to stand in the hitbox, and it is the divisor in
 * `shotFlightTicks`, so a shallow fish's volley gives half the warning a resting
 * one's does. Neither needed a new number.
 *
 * FISH_FAR_BAND_DEPTH is the depth the fish already starts a fight at, so the
 * opening position is its resting station rather than somewhere it immediately
 * drifts away from.
 *
 * It must stay at or under FISH_BAND_EDGE - FISH_BAND_HYSTERESIS, and a test
 * pins that. A boat directly above the fish is exactly `depth` away, so a fish
 * resting deeper than the edge could never be pulled into the close band at all:
 * it would dive out of reach for the whole fight and the close punisher would
 * never fire. That is design.md section 3's no-safe-camping-spot rule broken
 * from the fish's side of it.
 */
export const FISH_CLOSE_BAND_DEPTH = 50;
export const FISH_FAR_BAND_DEPTH = 100;

/**
 * How fast the fish repositions, horizontally and vertically.
 *
 * Authored per second with the per-tick values derived from TICK_HZ, same as the
 * boat's speed, the stamina refill and the shots' climb.
 *
 * 42 a second is 47% of the 90 the boat walks at, and a test pins that
 * inequality rather than the value. Walking always breaks contact, so a fish
 * gliding towards you is pressure rather than a trap, and the dash is still
 * insurance rather than the only way out. It closes about 28 units over a
 * close-punisher cooldown, most of the way from the edge of the hitbox to
 * underneath you.
 *
 * **The pinned inequality is necessary but not sufficient, and this number is
 * capped well below it.** Being slower than the boat only guarantees breaking
 * contact in an unbounded lane; the lane is 480 units and the boat is clamped to
 * it. A boat that starts directly above the fish and runs has about 205 ticks
 * before it hits a wall, and it needs the gap to reach ~147 units for the band
 * to flip back to far. That caps the swim speed near 47 whatever the pinned
 * inequality says, and 42 is chosen to keep about 20 ticks of margin. Raised
 * from 36 at the 1.13 tuning pass; 54 was tried first and let the fish corner a
 * fleeing boat against the wall permanently, which is the trap decisions.md
 * rules out.
 *
 * 30 a second of rise and dive takes the fish between its two resting depths in
 * about 1.7 seconds, a little under one attack cycle, so it arrives at the depth
 * its band wants at roughly the moment it is ready to attack from there.
 */
export const FISH_SWIM_PER_SECOND = atPace(42);
export const FISH_SWIM_PER_TICK = FISH_SWIM_PER_SECOND / TICK_HZ;
export const FISH_DIVE_PER_SECOND = atPace(30);
export const FISH_DIVE_PER_TICK = FISH_DIVE_PER_SECOND / TICK_HZ;

/**
 * How far outside the fish its far-punisher tell is drawn.
 *
 * The close punisher owns a column of water and is telegraphed on it. The far
 * punisher owns nothing until the shots exist, so its tell goes on the fish, and
 * it has to be a plainly different shape from the column rather than a variation
 * on it: the two reads ask for opposite movements.
 */
export const FISH_FAR_TELL_PADDING = 4;

/**
 * The reel-in. Chosen 2026-08-20, see decisions.md.
 *
 * design.md section 2 is explicit that resistance reaching zero must not end the
 * fight instantly: it cuts to a short final run, which is the payoff beat and the
 * moment the music hard swaps. This is the length of that beat.
 *
 * A stub. There is no timed input or mash inside it yet, so all it currently does
 * is hold the frozen fight on screen for two seconds with the line straining.
 * Two seconds is the short end of design.md's "a few seconds", chosen because
 * dead air is what a stub is made of and because task 1.13 plays the fight twenty
 * times. It gets longer once there is something in it.
 *
 * In ticks rather than derived from a per-second rate, for the same reason the
 * attack durations are: a beat is reasoned about in frames.
 *
 * Paced with everything else at the 1.13 tuning pass, so the effective beat is
 * 1.6 seconds rather than two. Worth watching: design.md section 2 asks for "a
 * few seconds", and pacing is walking this away from that rather than towards
 * it. If it starts reading as a blink instead of a beat, exempt this one
 * constant from `ticksAtPace` rather than lowering GAME_PACE.
 */
export const REEL_IN_TICKS = ticksAtPace(120);

/**
 * How the two endings are drawn: one flat wash over the whole screen.
 *
 * Grey box, and no text. The 2026-08-19 decisions.md entry puts debug chrome in
 * the DOM and in-game UI in the canvas, and an ending is in-game UI, so it cannot
 * be DOM text; canvas text at a 4x nearest-neighbour zoom is what that entry
 * rejected in the first place. A colour is the whole vocabulary available, so the
 * two have to be unmistakable at a glance rather than two shades of one idea.
 *
 * Named rather than borrowed from the palette above. A wash that means "you won"
 * must never be the same value as one that means "this is the sky", or retuning
 * one silently retunes the other.
 *
 * The alpha leaves the frozen fight readable underneath, deliberately: the last
 * thing that happened is the information the player wants, and covering it would
 * hide the misread they are supposed to be annoyed at themselves about.
 */
export const COLOUR_ENDING_LANDED = 0xf2e6c8;
export const COLOUR_ENDING_ESCAPED = 0x0a0d14;
export const ENDING_TINT_ALPHA = 0.55;

/**
 * The tether while the reel-in is running.
 *
 * design.md pillar 4 makes the line the identity, and the reel-in is the one beat
 * that is entirely about it, so the stub is drawn on the line rather than as a
 * caption. Thicker and in its own colour, so two seconds of a frozen fight reads
 * as the line under load rather than as the game having hung.
 *
 * Kept clear of COLOUR_TELEGRAPH below: that colour means the fish is about to
 * hurt you, and by the reel-in it can no longer do anything at all.
 */
export const COLOUR_REEL_IN_LINE = 0xf2e6c8;
export const REEL_IN_LINE_WIDTH = 2;

/**
 * The telegraph. Outlined during the wind-up, filled solid while the hitbox is
 * live, absent otherwise.
 *
 * Kept clear of COLOUR_BAR_RESISTANCE above, which is also red: one of them is
 * information about the fish's health and the other is about to take a quarter
 * of the hull off, and they must not be confused at a glance.
 *
 * The far punisher's shots are drawn in it too. One colour means danger in the
 * grey box, whatever shape it happens to be in, so the player learns to read the
 * colour rather than a vocabulary of them.
 */
export const COLOUR_TELEGRAPH = 0xe07a3c;

/**
 * Screen shake. Chosen 2026-08-20 and toned down the same day after a playtest,
 * see decisions.md for both entries.
 *
 * design.md section 6: short, sharp, decaying, scaled to damage dealt. Both
 * sides' hits shake, which is that line read literally, and the scaling is what
 * keeps it from being constant noise at attack cadence: a typical far-band hit
 * deals 6 to 10 and moves the frame one unit, while an earned close-range hit
 * moves it two. The damage-by-distance curve in design.md section 2, made felt
 * rather than only read off the debug line.
 *
 * **Amplitude is in whole internal-resolution units and the offset must stay
 * whole.** One unit is four physical pixels at 1080p, so a close punisher throws
 * the frame about eight of them. Fractional camera scroll at a 4x
 * nearest-neighbour zoom puts everything between physical pixels and shimmers,
 * which is the same failure `game/config.ts` chose `Phaser.Scale.NONE` to avoid.
 * The amplitude below decays fractionally; only what reaches the camera rounds.
 * SHAKE_MIN_AMPLITUDE is a hard floor and not a suggestion: a live shake always
 * moves the frame by at least one unit, so every hit registers as something. See
 * `update` in game/feel/shake.ts, where getting that wrong made hits from across
 * the lane shake only about a third of the time.
 *
 * **The duration is derived, not tuned separately.** The shake decays at a fixed
 * rate, so a bigger one lasts longer for free: 2 units fades over 8 frames and
 * 1 unit over 4. SHAKE_MAX_FRAMES is how long the heaviest hit in the game lasts
 * and is authored as such, but what the effect actually runs on is the rate. A
 * fourth constant holding the duration could only drift away from these.
 *
 * The pair below halved from 3 units over 12 frames on "make it a little more
 * subtle". Both moved together on purpose, so the decay rate stayed at a quarter
 * unit a frame and only the peak and the length changed: retuning the amplitude
 * alone would have left a heavy hit trailing eight frames of one-unit jitter,
 * which reads as buzzing rather than as a decaying jolt. **A hit at the damage
 * floor is untouched by this** — it was already on SHAKE_MIN_AMPLITUDE for four
 * frames and still is, which is what keeps the consistency that retune bought.
 *
 * SHAKE_MAX_DAMAGE is the close punisher's hull damage rather than a number of
 * its own, so the biggest shake in the game is pinned to the biggest hit in the
 * game and the two cannot come apart.
 *
 * **Deliberately not paced.** Like every other feel number and unlike every
 * gameplay duration above, this is not wrapped in `ticksAtPace`. Shake is
 * wall-clock feel rather than fight geometry: nothing in the simulation is timed
 * against it, no inequality involves it, and design.md states it in frames.
 * Frames are converted to milliseconds with TICK_MS at the call site.
 */
export const SHAKE_MAX_AMPLITUDE = 2;
export const SHAKE_MIN_AMPLITUDE = 1;
export const SHAKE_MAX_FRAMES = 8;
export const SHAKE_MAX_DAMAGE = FISH_CLOSE_HULL_DAMAGE;
export const SHAKE_DECAY_PER_FRAME = SHAKE_MAX_AMPLITUDE / SHAKE_MAX_FRAMES;

/**
 * Hit flash. Chosen 2026-08-20, see decisions.md.
 *
 * design.md section 6 is exact about this one: render the struck sprite pure
 * white for 2 frames. Taken literally, including the "pure", because a flash that
 * is a tint of the thing it is flashing reads as the object changing colour and a
 * flash that is white reads as being hit.
 *
 * Two frames is 33ms, which is short enough that it registers without being
 * something the eye tracks. It is not scaled by damage, unlike the shake: the
 * shake says how hard, and stacking a second magnitude on top of it would only
 * make the smallest hits read as misses. This one says *that*, and *which*.
 *
 * **Not paced**, for the reason no feel number is: wall-clock rather than fight
 * geometry, nothing in the simulation timed against it, and design.md states it
 * in frames. Converted to milliseconds with TICK_MS at the call site.
 *
 * Worth knowing at the phase 8 art pass: COLOUR_BOAT is already a warm off-white,
 * so the hull's flash has far less contrast to work with than the dark fish's. If
 * one of the two reads weakly, that is why, and the fix is the hull's colour
 * rather than this one.
 */
export const COLOUR_HIT_FLASH = 0xffffff;
export const HIT_FLASH_FRAMES = 2;

/** Hull size. Grey box proportions, replaced by the phase 8 art pass. */
export const BOAT_WIDTH = 24;
export const BOAT_HEIGHT = 10;

/** Boat starts centred, so neither wall is nearer at the opening of a fight. */
export const BOAT_START_X = INTERNAL_WIDTH / 2;

/** Fish size. Wider than tall, so it reads as a fish and not as a second boat. */
export const FISH_WIDTH = 20;
export const FISH_HEIGHT = 12;

/**
 * Where the fish opens a fight. The AI owns both from task 1.11 onwards.
 *
 * Depth counts down from the waterline, so 100 draws at y 170 and the boat is
 * implicitly at depth 0. Chosen 2026-08-19, see decisions.md: 100 units right of
 * the boat's start opens the fight on a diagonal line rather than a vertical
 * one, and mid-water leaves room either side for the fish to rise and dive.
 *
 * The depth is FISH_FAR_BAND_DEPTH rather than a number of its own, because it
 * is the same fact twice: the fish opens the fight at its resting station in the
 * band it opens in, so nothing drifts on tick one. The opening line is 141
 * units, which sits inside the hysteresis margin, so the opening band is seeded
 * in `createFightState` rather than worked out from the geometry.
 */
export const FISH_START_X = 340;
export const FISH_START_DEPTH = FISH_FAR_BAND_DEPTH;

/**
 * The default loadout. Chosen 2026-08-19, see decisions.md.
 *
 * These are the starting boat's and starting line's numbers, not fixed game
 * constants. Hull HP is a property of the boat the player has unlocked and the
 * stamina pool is a property of their line, Dark Souls style: later boats run
 * 140, 200 and up, and a bigger pool is what makes the expensive attacks
 * unlocked later affordable. Phase 4 gear seeds different values into the same
 * fields, which is why the maxima live on FightState and this module is read in
 * exactly one place, `createFightState`.
 *
 * Stamina deliberately sits below hull rather than matching it. A pool that
 * mirrored the hull would read as one number shown twice, and the two bars need
 * to be told apart at a glance while being hit.
 *
 * 80 also divides cleanly into the dash and attack costs that tasks 1.6 and 1.7
 * price against it. Those costs are still open questions in design.md section 8.
 */
export const DEFAULT_HULL_MAX = 100;
export const DEFAULT_LINE_MAX = 80;

/**
 * The grey box fish's health. Chosen 2026-08-19, see decisions.md.
 *
 * Sized for roughly a 60 to 90 second fight once the basic attack lands at task
 * 1.7, which is long enough for the fish to cycle its moveset several times.
 * Like FISH_START_X and FISH_START_DEPTH above, this belongs to one fish and
 * moves into a fish definition file at task 3.1.
 *
 * Deliberately **not** paced at the 1.13 tuning pass, and deliberately not
 * raised to compensate for pacing either. Attacks come 25% more often at
 * GAME_PACE 1.25 while this stays at 400, so the fight now runs about 48 to 72
 * seconds. Chosen over holding the original 60 to 90: a longer fast fight reads
 * as padded, and a shorter one suits a phase that is played twenty times over.
 */
export const FISH_RESISTANCE_MAX = 400;

/**
 * Bar geometry, in internal-resolution units.
 *
 * The bars are game objects inside the pixel grid, not DOM: see the 2026-08-19
 * decisions.md entry, which puts debug text in the DOM and in-game UI in the
 * canvas. They live in the 70 units of sky above the waterline.
 *
 * Two stacked bars plus the top margin come to 17 units, so the sky keeps the
 * headroom the same entry reserved for the fish breaching.
 */
export const BAR_WIDTH = 100;
export const BAR_HEIGHT = 5;
/** Distance from the top and from the nearest side wall. */
export const BAR_MARGIN = 4;
/** Vertical space between the stacked hull and line bars. */
export const BAR_GAP = 3;
