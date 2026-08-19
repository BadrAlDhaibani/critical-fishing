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

/** Hull size. Grey box proportions, replaced by the phase 8 art pass. */
export const BOAT_WIDTH = 24;
export const BOAT_HEIGHT = 10;

/** Boat starts centred, so neither wall is nearer at the opening of a fight. */
export const BOAT_START_X = INTERNAL_WIDTH / 2;

/** Fish size. Wider than tall, so it reads as a fish and not as a second boat. */
export const FISH_WIDTH = 20;
export const FISH_HEIGHT = 12;

/**
 * Where the fish sits. Static for task 1.4; the AI takes both over at 1.11.
 *
 * Depth counts down from the waterline, so 100 draws at y 170 and the boat is
 * implicitly at depth 0. Chosen 2026-08-19, see decisions.md: 100 units right of
 * the boat's start opens the fight on a diagonal line rather than a vertical
 * one, and mid-water leaves room either side for the fish to rise and dive once
 * it can.
 */
export const FISH_START_X = 340;
export const FISH_START_DEPTH = 100;

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
