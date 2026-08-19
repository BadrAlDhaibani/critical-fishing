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
