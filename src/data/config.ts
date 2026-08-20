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
export const BOAT_SPEED_PER_SECOND = 90;
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
export const DASH_DURATION_TICKS = 14;
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
export const ATTACK_COOLDOWN_TICKS = 20;

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
export const LINE_REGEN_PER_SECOND = 6;
export const LINE_REGEN_PER_TICK = LINE_REGEN_PER_SECOND / TICK_HZ;
export const LINE_REGEN_DELAY_TICKS = 30;

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
 */
export const FISH_CLOSE_WINDUP_TICKS = 45;
export const FISH_CLOSE_ACTIVE_TICKS = 8;
export const FISH_CLOSE_RECOVERY_TICKS = 45;

/**
 * The gap between the end of one attack and the earliest start of the next.
 *
 * A stand-in for attack selection, which arrives with the distance bands at task
 * 1.11. A static fish with no bands still needs some rule for when to commit,
 * and a cooldown is the cheapest one that does not invent band edges early.
 *
 * Recovery plus cooldown is 105 ticks of safety after the hitbox clears, about
 * five attacks at the 20-tick cadence and 40 stamina, during which the refill
 * never runs because the 30-tick pause is restarted by every one of them. That
 * is the exchange the fight is built on: the safe window is also the window in
 * which the pool is being emptied. Full cycle is 158 ticks, about 2.6 seconds.
 */
export const FISH_CLOSE_COOLDOWN_TICKS = 60;

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
 * in 28 ticks, which fits inside the 45-tick wind-up only if the tell is read
 * immediately. The dash is therefore insurance rather than the only answer,
 * which is what keeps it a decision.
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
export const FISH_FAR_WINDUP_TICKS = 40;
export const FISH_FAR_RECOVERY_TICKS = 30;

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
export const FISH_FAR_SHOT_INTERVAL_TICKS = 15;
export const FISH_FAR_ACTIVE_TICKS =
  (FISH_FAR_SHOT_COUNT - 1) * FISH_FAR_SHOT_INTERVAL_TICKS + 1;

/**
 * The gap after the volley before the fish may commit to anything again. Longer
 * than the close punisher's 60, because the shots are still in the air during
 * it: the fish being idle is not the same as the attack being over.
 */
export const FISH_FAR_COOLDOWN_TICKS = 90;

/**
 * How fast a shot climbs towards the surface, and how fast it may drift
 * sideways chasing the boat.
 *
 * Authored per second with the per-tick values derived from TICK_HZ, same as the
 * boat's speed and the stamina refill.
 *
 * 72 a second is 1.2 units a tick, so from the fish's starting depth of 100 a
 * shot is in the air for 84 ticks. With the 40-tick wind-up in front of it that
 * is about two seconds of warning, and it scales with depth for free: once the
 * AI owns depth at task 1.11, a deep fish telegraphs further ahead and a shallow
 * one gives barely any notice.
 *
 * 36 a second of tracking is 40% of the 90 the boat walks at. That inequality is
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
export const FISH_FAR_RISE_PER_SECOND = 72;
export const FISH_FAR_RISE_PER_TICK = FISH_FAR_RISE_PER_SECOND / TICK_HZ;
export const FISH_FAR_TRACK_PER_SECOND = 36;
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
 * 36 a second is 40% of the 90 the boat walks at, and a test pins that
 * inequality rather than the value. Walking always breaks contact, so a fish
 * gliding towards you is pressure rather than a trap, and the dash is still
 * insurance rather than the only way out. It closes about 36 units over a
 * close-punisher cooldown, which is most of the way from the edge of the hitbox
 * to underneath you.
 *
 * 30 a second of rise and dive takes the fish between its two resting depths in
 * about 1.7 seconds, a little under one attack cycle, so it arrives at the depth
 * its band wants at roughly the moment it is ready to attack from there.
 */
export const FISH_SWIM_PER_SECOND = 36;
export const FISH_SWIM_PER_TICK = FISH_SWIM_PER_SECOND / TICK_HZ;
export const FISH_DIVE_PER_SECOND = 30;
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
