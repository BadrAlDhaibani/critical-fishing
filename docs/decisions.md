# Decisions

**Tier: Append only.** Add new entries at the bottom. Never rewrite or delete
an existing one, even if it was later reversed. A reversal is a new entry.

Format: date, decision, why, what was rejected.

Append here whenever Badr explicitly approves or rejects something in
conversation. Also append when something is tried and it feels bad, because
"we tried X and it did not work" is the highest value information in this
project and the thing most easily lost between sessions.

---

## 2026-08-18: Browser client, not Discord bot, not pygame

Real-time dodging with frame-level timing is the core mechanic. Discord button
interactions have 200 to 500 ms round trips, rate limits, and no continuous
input, so the core mechanic is impossible there. Pygame would give the best
input feel but costs a download per friend and loses Discord integration.

Rejected: pure Discord bot game, pygame standalone. Discord stays as the social
and identity layer.

## 2026-08-18: TypeScript end to end, not Python

Original preference was Python. Set aside deliberately in favour of getting the
multiplayer right. In co-op the server must be authoritative for the fish, and
client-side prediction is dramatically easier when client and server run
literally the same simulation code. A TypeScript client with a Python server
means maintaining two implementations of one fight and debugging their
disagreements.

Rejected: Python client (no path to a smooth browser action game), split
TypeScript client with Python realtime server.

## 2026-08-18: Obstacles are decoration, not mechanics

Rocks, kelp and snags interacting with the line were cut. They added randomness
to a fight that should be about reading the fish, and they were the single most
expensive thing in the early design.

## 2026-08-18: One movement axis, not two

`W`/`S` for slack control was cut in favour of `A`/`D` only, with line length
derived from horizontal distance to the fish.

This is the most important decision in the design. It means one input carries
three meanings at once: dodging, positioning, and damage output. Games that
feel deep usually have fewer inputs than expected, not more.

Rejected: direct slack control, and with it the line tension band and
line-snapping fail state. Hull HP became the sole fail state and the line
became a stamina resource.

## 2026-08-18: The line is a contested resource

Both dashing and attacking spend the same pool. That contest, spend it on a
heavy attack or hold it in case a dodge is needed, is the Dark Souls stamina
bar and most of where the intended feel comes from.

## 2026-08-18: Fish positioning is never random

Depth and horizontal movement are always intent-driven and telegraphed. If
depth were random then damage output would be random, and the player would have
no way to earn a good moment. "The fish is shallow right now" must read as a
learned window, not luck.

## 2026-08-18: Every fish needs a close punisher and a far punisher

Without both, optimal play collapses to a single position and the movement axis
stops mattering. Enforced by a validation test rather than by discipline.

## 2026-08-18: Co-op roles come from equipment, not classes

Heavy hull, light hull, stun lure. Same code path, different numbers plus one
special effect. Nobody picks a class; the role emerges from the loadout, which
makes progression and roles the same system.

## 2026-08-18: Aggro by recent damage, boat collision pushes

Aggro by damage produces a tank role with no class system and lets a player
bait aggro to protect a weaker friend. Collision pushes rather than blocks,
because blocking lets one person wall a friend into a projectile, which is
funny once and poisons playtests thereafter.

## 2026-08-18: Solo runs entirely client-side

Boss fights are the only thing needing a server. Since most play is solo
grinding, the hard part of the architecture applies to roughly a tenth of the
gameplay, and the entire single player game can ship before any networking
exists.

## 2026-08-18: Feel before art, art last

Hit stop, screen shake and hit flash come in phase 2 with rectangles still on
screen. Effects hide bad timing, and a fight tuned underneath visual noise only
feels good while the screen is full of noise.

## 2026-08-18: One basic and one heavy attack for v1

Fire, electric and poison were cut from v1. They are three different systems
(damage over time, status, burst) and would mean balancing five interacting
systems before knowing whether the base loop is fun. Equipment changes numbers
only until that is proven.

## 2026-08-18: Submarines and the depth axis deferred to v2

A player depth axis turns a one-axis arena into a two-axis one and complicates
attack patterns, collision and netcode simultaneously. Good feature, wrong time.

## 2026-08-18: Documentation tiers and batch discipline

design.md is locked, architecture.md is firm, roadmap.md and patterns.md are
fluid, decisions.md is append only. One roadmap task per batch, then stop and
wait for a playtest.

Reasoning: each session starts with no memory of the previous one, so a fresh
session with edit rights and a plausible idea could weaken a decision reached
over a long discussion, and it would not be noticed because code gets reviewed
and docs do not. `git diff docs/` before each commit makes drift visible.

## 2026-08-19: Internal render resolution locked at 480x270

The open question from design.md section 8, answered. Every tuned number in the
game is now expressed in these units: boat speed, dash distance, hitbox sizes,
distance band edges.

480x270 scales by exactly 4x to 1080p. The deciding factor over 320x180 was
horizontal room: one axis carries dodging, positioning and damage output all at
once, and 320 units of lane makes distance band edges and dash distances coarse
in a way that would be felt during tuning. 640x360 was also available and was
passed over as less chunky than the Terraria neighbourhood the art direction
asks for.

Rejected: 320x180, 640x360.

## 2026-08-19: Prettier added to the toolchain

Formatting is automatic and never something Badr has to review or correct.
Two devDependencies, `prettier` and `eslint-config-prettier`, the latter purely
to switch off the eslint rules that would fight it.

The dependency set approved this session: phaser, vitest, eslint, @eslint/js,
typescript-eslint, prettier, eslint-config-prettier. The sim-must-not-import-
Phaser boundary from architecture.md section 1 is enforced by eslint's built-in
`no-restricted-imports` scoped to `src/sim/**`, so it needed no extra plugin.

## 2026-08-19: Phase 1 infrastructure done as one batch

Tasks 1.1, 1.2 and 1.2b were run together rather than as three stop-and-wait
batches. None of the three produces anything playable, so the "Badr has played
it and said it feels right" gate could not close on any of them individually,
and three round trips would have bought nothing.

This is a deliberate exception, not a loosening of the one-task-per-batch rule.
The rule exists so that design decisions do not get chained together unreviewed,
and infrastructure with no gameplay surface carries no design decisions. From
1.3 onward, where every task is a fight decision Badr can feel, the normal
one-task rule applies.

Rejected: 1.1 alone (ends at a blue rectangle with nothing to judge), pushing
through to 1.5 (five tasks of unreviewed gameplay decisions at once).

## 2026-08-19: Debug and tuning text lives in the DOM, not the canvas

Tried first as a Phaser text object at 8px inside the 480x270 canvas. It looked
mushy next to the rectangles. The browser rasterises the font with antialiasing,
then the whole canvas is scaled up by a whole number with nearest-neighbour
filtering, so every soft grey edge pixel becomes a solid 3x3 block of grey.
Canvas text and pixel-art upscaling cannot both be right.

Moved to a DOM element layered over the canvas. It renders at the monitor's
native resolution, is sharp at any zoom, and costs none of the internal
resolution budget. This applies to any future debug or tuning display.

It does not apply to in-game UI. The hull and line bars at task 1.5 are game
objects, they belong inside the pixel grid, and they are rectangles rather than
text so none of this bites them.

Rejected: a bitmap font, which is the correct answer for in-canvas text but
needs a font asset and belongs with the phase 8 art pass.

## 2026-08-19: The arena has no floor

A darker band across the lower water was tried as a depth cue and read as a
seabed. Removed in favour of one flat water colour.

Fish depth is AI-driven through open water, and a horizontal line down there
implies a boundary the fight does not have. During the tuning pass it would be
read as the bottom of the arena and would quietly distort judgements about
depth and line length.

Also confirmed by the same playtest: `WATER_LINE_Y = 70`, giving 70 units of sky
above the surface and 200 of water below. The sky is not waste. The fish
breaching needs headroom and the bars go up there at task 1.5.

## 2026-08-19: Boat movement is instant velocity at 90 units/second

Key down is full speed, key up is a dead stop. No acceleration, no momentum, no
coast.

design.md pillar 3 puts every loss on the player. A boat that coasts turns a
misread into a fight with the controls, which moves the blame from the player to
the input handling and is the wrong kind of hard. The weight the fight wants
comes from the speed value and from what a dash costs, not from input lag.

90 units per second crosses the 480-unit lane in about 5.3 seconds, leaving
headroom above it for a dash to read as a genuine burst. Confirmed by playtest
the same day and not adjusted. Expected to move during the 1.13 tuning pass;
authored per second, with the per-tick value derived from TICK_HZ so the two
cannot disagree.

Also settled: inputs are sampled once per render frame, not once per tick. A
frame running catch-up ticks applies the same snapshot to all of them, which is
correct, since keys cannot change part way through a frame.

Rejected: acceleration plus friction, instant-with-stop-slide, 60 u/s, 120 u/s.
