/**
 * Tunable constants. Named values only, never inline literals at the call site.
 *
 * **What belongs here and what does not.** Since task 3.1 a fish's own numbers
 * live in `data/fish/`, one file per fish, and this file holds everything that is
 * not any one fish's: the boat, the arena, the player's damage curve, the feel
 * layer, and the presentation constants a telegraph is drawn with. The test to
 * apply before adding a constant is whether **two different fish could disagree
 * about it**. If they could, it is fish data and putting it here is what makes
 * adding a fish need an engine edit, which architecture.md section 4 forbids.
 *
 * The line runs through some near neighbours, so a few are worth stating. A band
 * edge is the fish's; the hysteresis margin around every edge is the game's. A
 * shot's width is the pattern's, because the boat is measured against it; the
 * height it is drawn at is the game's. Hull and stamina maxima are the *boat's*
 * and are seeded onto the state from the default loadout at the bottom of this
 * file, which is the same shape one step further out.
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

/**
 * A speed in units per second, scaled by the global pace.
 *
 * Exported because the fish definitions in `data/fish/` are paced by the same
 * knob as everything else, and pacing that only reached the constants in this
 * file would leave every fish's speeds and telegraphs off the one clock.
 */
export const atPace = (unitsPerSecond: number): number =>
  unitsPerSecond * GAME_PACE;

/**
 * A duration in ticks, scaled by the global pace. Rounded, because a tick count
 * has to be whole: at 1.25 that costs the close punisher's wind-up a fifth of a
 * tick, which is the one place the dilation is not quite exact.
 */
export const ticksAtPace = (ticks: number): number =>
  Math.round(ticks / GAME_PACE);

/**
 * A speed authored per second, paced, and handed back per tick.
 *
 * The two steps every speed in the game takes, in one call, so a fish definition
 * can write `speedPerTick(42)` and keep the authored number visible the way
 * `ticksAtPace(34)` does. The constants below spell the same thing out in two
 * lines each because they export the per-second form as well; nothing outside
 * `data/fish/` needs a fish's speed in anything but ticks.
 */
export const speedPerTick = (unitsPerSecond: number): number =>
  atPace(unitsPerSecond) / TICK_HZ;

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
 * 1.3. Worked backwards from the fish: the grey box fish's 400 resistance split
 * across attacking and dashing lands the fight in the 60 to 90 seconds that fish
 * was sized for. Attacking flat out spends 24 a second, so a burst always has to be
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
 * The hysteresis margin on every band edge, in line-length units.
 *
 * design.md section 3's second fairness rule, and an **engine** constant rather
 * than a fish's: inside the margin the fish keeps whichever band it already had,
 * so a player standing on a boundary cannot make it flicker between two
 * movesets. That is a promise the game makes about every fish, not a knob one
 * fish gets to turn.
 *
 * Where the edges themselves are is fish data and lives in `data/fish/`. The
 * consequence worth knowing before moving one: a band's usable width is
 * `edge - HYSTERESIS`, not `edge`, so a resting depth deeper than that could
 * never be pulled into the band inside it at all. A test pins that.
 */
export const FISH_BAND_HYSTERESIS = 15;

/**
 * How tall a shot is drawn. Presentation, not a hit test.
 *
 * A shot's *width* belongs to the pattern that fired it, because it is what the
 * boat is measured against and what makes the drawn rectangle honest. Its height
 * is nobody's: the attack is tested horizontally against a boat that is always on
 * the surface, so this only has to stop a shot being mistaken for a small boat or
 * a small fish. Square against the grey box fish's 10-wide shot, which is where
 * the number came from.
 */
export const PROJECTILE_DRAW_HEIGHT = 10;

/**
 * How far outside the fish an on-the-body tell is drawn.
 *
 * A column attack owns a stretch of water and is telegraphed on it. An attack
 * that owns no water until its shots exist puts its tell on the fish instead, and
 * it has to be a plainly different shape from the column rather than a variation
 * on it: the two reads ask for opposite movements.
 *
 * Presentation, so it stays here rather than going per-fish. It is measured
 * outwards from whatever size the fish is, so it already fits every fish without
 * being restated by each one.
 */
export const TELEGRAPH_OUTLINE_PADDING = 4;

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
 * SHAKE_MAX_DAMAGE is the hit the whole scale is calibrated to, and it is a game
 * constant rather than the current fish's biggest hit. Until task 3.1 it was
 * `FISH_CLOSE_HULL_DAMAGE`, which pinned the biggest shake to the biggest hit in
 * a game that only had one fish. Once damage is per-fish that stops being a
 * definition and becomes a choice, and the choice made at 3.1 is that **the shake
 * means the same thing across every fish**: a minnow's chip hit has to read as
 * lighter than a boss's, which it cannot if each fish rescales the ceiling to its
 * own worst attack. 25 is the number it already was. A future fish hitting for 40
 * simply maxes it out, because `shake.ts` clamps above the ceiling.
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
export const SHAKE_MAX_DAMAGE = 25;
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

/**
 * The grey box sound bank. Chosen 2026-08-20, see decisions.md.
 *
 * design.md section 6 asks for three or four core sounds. These are synthesised
 * from oscillators at run time rather than loaded from files, which is the same
 * bet the coloured rectangles are: no assets to make before the thing can be
 * judged, every value a number that can be argued about, and nothing to re-export
 * when one of them is wrong. **Explicitly placeholder.** Real audio replaces the
 * player behind `FightAudioPlayer`, not this table.
 *
 * Read as: slide from `fromHz` to `toHz` over `ms`, at `gain`, on `wave`. A flat
 * sound sets both frequencies the same. `noise` mixes in a burst of white noise,
 * which is what stops a percussive hit reading as a musical note.
 *
 * The four are pitched to stay apart from each other, because they routinely
 * overlap: the boat can be hit while a wind-up starts and a shot is landing.
 * High and short for the player's own hit, low and blunt for taking one, a
 * mid-range rise for the warning, and a long fall for the loss — the only one
 * long enough to be a statement rather than a tick.
 *
 * **Not paced**, like every other feel number: wall-clock, nothing in the
 * simulation timed against it, and no inequality involves it.
 *
 * Numbers picked rather than asked for, deliberately and unusually. A frequency
 * cannot be judged without hearing it, so these were a first cut for task 2.5 to
 * argue with — and at that pass they were auditioned one by one and kept
 * unchanged, master gain included. They are approved values now, not a guess
 * nobody has heard.
 */
export interface SoundDefinition {
  fromHz: number;
  toHz: number;
  ms: number;
  gain: number;
  wave: OscillatorType;
  noise: number;
}

/** Your hit landing. Short and bright, because it fires most often. */
export const SOUND_ATTACK: SoundDefinition = {
  fromHz: 660,
  toHz: 440,
  ms: 70,
  gain: 0.18,
  wave: 'square',
  noise: 0.25,
};

/** The boat taking one. Low, blunt and mostly noise, so it reads as a thud. */
export const SOUND_HURT: SoundDefinition = {
  fromHz: 180,
  toHz: 70,
  ms: 200,
  gain: 0.3,
  wave: 'triangle',
  noise: 0.6,
};

/**
 * The fish committing to an attack. The only cue that is a warning rather than a
 * report, so it rises where the others fall, and it is the one sound worth
 * hearing over everything else.
 */
export const SOUND_TELEGRAPH: SoundDefinition = {
  fromHz: 300,
  toHz: 520,
  ms: 180,
  gain: 0.22,
  wave: 'sawtooth',
  noise: 0,
};

/** The fight lost. Long, and the only one that is allowed to be. */
export const SOUND_LOSS: SoundDefinition = {
  fromHz: 320,
  toHz: 60,
  ms: 900,
  gain: 0.32,
  wave: 'triangle',
  noise: 0.1,
};

/**
 * A master level over all of the above, so the whole bank moves with one number
 * at the 2.5 tuning pass rather than four.
 */
export const SOUND_MASTER_GAIN = 0.6;

/** Hull size. Grey box proportions, replaced by the phase 8 art pass. */
export const BOAT_WIDTH = 24;
export const BOAT_HEIGHT = 10;

/** Boat starts centred, so neither wall is nearer at the opening of a fight. */
export const BOAT_START_X = INTERNAL_WIDTH / 2;

/**
 * Where in the lane a fight opens with the fish. The AI owns its position from
 * tick one onwards; this is only where it is put.
 *
 * Arena placement rather than fish data, which is why it survived task 3.1 in
 * here. Any fish hooked in this spot opens the fight from it, and phase 4.1's
 * encounter roll is what will eventually decide it per cast.
 *
 * Chosen 2026-08-19, see decisions.md: 100 units right of the boat's start opens
 * the fight on a diagonal line rather than a vertical one.
 *
 * There is no matching start depth. The fish opens at its outermost band's
 * resting station, so that number is the fish's and `createFightState` reads it
 * off the definition. Against the grey box fish the opening line is 141 units,
 * which sits inside the hysteresis margin, so the opening band has to be seeded
 * rather than worked out from the geometry.
 */
export const FISH_START_X = 340;

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
