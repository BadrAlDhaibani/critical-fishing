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
