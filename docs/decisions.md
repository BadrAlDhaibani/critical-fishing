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

## 2026-08-19: Line length is euclidean and includes depth

`hypot(fish.x - boat.x, fish.depth)`, not `abs(fish.x - boat.x)`.

The "one movement axis" entry above says line length is "derived from horizontal
distance to the fish". This supersedes that wording. The "fish positioning is
never random" entry argues that depth must drive damage output, "if depth were
random then damage output would be random", and that only holds if depth is a leg
of the triangle. Horizontal-only would make a fish rising and diving change
nothing about damage, which makes the depth half of the fish AI cosmetic and
throws away the learned window that entry exists to protect.

It also keeps the length off zero directly above the fish, which the
inverse-distance damage at task 1.7 needs. Being directly above the fish is still
the shortest line; it is now the depth rather than zero.

Depth is stored as units below the waterline, not as a screen y, so `sim/` has no
knowledge of where the surface was drawn and the boat is implicitly at depth 0.
The renderer owns the single conversion, `WATER_LINE_Y + depth`.

Line length is derived on demand and never stored on `FightState`. A cached copy
is a second source of truth that can go stale by a tick, and recomputing it is
one `hypot`.

The static fish for task 1.4 sits at x 340, depth 100, so the opening line is
diagonal and proves both axes of the render at a glance. That is a grey box
placement rather than a design number; task 1.11 takes both over.

Rejected: horizontal-only distance, caching the length on the state.

## 2026-08-19: Bar values are gear, not constants

Default boat hull 100, default line stamina pool 80, grey box fish resistance 400. Part of the design.md section 8 open questions, answered.

Hull HP and the stamina pool are properties of the boat and line the player has
unlocked, Dark Souls style, rather than fixed numbers. Later boats run 140, 200, 1000. A bigger pool is what makes the expensive attacks unlocked later
affordable, so a newbie line cannot fire a heavy attack without draining the
whole bar, and upgrading the line is what unlocks using them properly.

This is why the maxima live on `FightState` (`hullMax`, `lineMax`,
`resistanceMax`) rather than as constants imported wherever they are needed.
`data/config.ts` holds the default loadout only and is read in one place,
`createFightState`. Phase 4.5 gear and phase 7 per-player boats seed different
numbers and touch nothing else.

Stamina sits below hull deliberately. Badr asked for the two not to be matchy
matchy and left the figure to me; two bars on the same number read as one value
shown twice, and they have to be told apart at a glance while being hit. 80 also
divides cleanly into the dash and attack costs 1.6 and 1.7 price against it. A
test asserts the inequality so it cannot drift back.

Bar layout picked from a mockup: hull and line stacked top left, fish resistance
top right. The DOM debug readout moved to the bottom left as a consequence,
since it sat on top of them at 4x.

Rejected: hull and line both on 100, global `HULL_MAX`/`LINE_MAX` constants, 200
and 800 resistance.

## 2026-08-19: The dash is 55 units over 14 ticks for 16 stamina, and it commits

Roughly 236 units per second against 90 walking, about 2.6x. It clears the
boat's own width and a bit, which is the distance a telegraph has to be dodged
by, and it shifts line length far enough that the damage traded away is felt
rather than theoretical. Five dashes from a full default pool, deliberately
leaving room underneath for the basic attack at task 1.7.

Direction locks at the press and is not read again. Steering and reversal are
ignored for all 14 ticks and no second dash can start until the first ends. A
steerable dash is a strictly better walk, and design.md section 3 forbids the
fish cancelling a wind-up for the same reason: commitment is what makes a read
worth making. A dash that cannot be paid for in full does not fire at all, and
one eaten by a wall is still charged, because the input was made.

Edge-triggered inside `sim/` from `boat.dashHeld` rather than in the input
layer, so holding shift cannot chain dashes. Done this way because a phase 7
server cannot trust a client's claim that a key went down this frame, but it can
hold the previous tick's raw held state and work the edge out itself. The edge
is then decided at 60 Hz rather than at whatever rate the monitor runs.

Invulnerability frames deliberately still open. design.md section 8 lists them
and there is nothing to be invulnerable to until the fish attacks at 1.9, so it
is 1.9's decision, made with something on screen to judge it against.

Rejected: 40 units over 10 ticks, 75 over 18, costs of 10 and 20, a steerable
dash, edge detection in the input layer.

## 2026-08-19: A bar refilling during a playtest means the page reloaded

Recorded because it cost a diagnosis and will otherwise cost another one.

The 1.6 playtest reported the stamina regenerating, which nothing before task
1.8 does. `sim/fight.ts` has exactly two writes to `line`, a subtraction and a
carry-forward, and nothing in `sim/loop.ts`, `main.ts` or `game/config.ts`
restarts a scene, so the simulation could not have done it. The `ticks` counter
in the debug readout settled it by resetting to zero: the page had reloaded.

Vite is running all through a session and a Phaser game has no HMR handler, so
every source edit forces a full page reload, and a reload is a fresh
`createFightState` at full everything. This is correct behaviour and is not
worth suppressing. `ticks` dropping back to zero is the tell.

Two things came out of it. The readout now shows `hull` and `stam` as numbers,
because the question could not be answered by looking at the screen while the
bars only showed proportions, and 1.7 and 1.8 both need the real figures while
playing. And a test now asserts the pool never rises under any combination of
inputs, so the question cannot be reopened by accident. **Task 1.8 is expected
to change that test deliberately.**

Also renamed in the readout: the tether's length is now labelled `tether`, since
`stam` sits next to it and design.md calls both of them the line.

## 2026-08-19: The basic attack costs 8, deals 20 to 6, and the curve is a true inverse

Six of the design.md section 8 open questions answered at once, because the
attack cannot be judged with any of them missing.

Cost **8**, half a dash, so a full default pool buys ten attacks or five dashes.
The ordering is the point: attacking is the ordinary habit and the dash is the
expensive panic, which is how design.md section 2 frames the contested resource.
Every dash taken is two hits not landed.

Cooldown **20 ticks**, three attacks a second. One press is one attack
regardless, so this is not what stops the key being held; it is what stops the
pool being emptied in a fraction of a second, and from 1.9 it is the gap the
fish's telegraphs have to be read through.

Damage **20 close, 6 far**. Twenty perfect hits land the 400-resistance grey box
fish, sixty-six from across the lane do the same job far more slowly.

The curve is a **true inverse**, `k / length`, not a straight line between the
anchors and not a smoothstep. Chosen because it is steepest exactly where the
decision is hardest: fifty units off perfect already costs a third of the hit,
while the far half of the lane is uniformly weak, so there is a real gradient to
climb rather than a flat outside. It is also the literal reading of design.md
section 2's "damage scales inversely with line length".

`k` is derived as `ATTACK_DAMAGE_MAX * ATTACK_FULL_DAMAGE_RANGE`, so the anchors
and the curve cannot drift apart during the 1.13 tuning pass. The full-damage
range is **100**, the fish's starting depth, so a perfect hit is reachable in
this playtest rather than theoretical. Once the AI owns depth at 1.11, a diving
fish puts full damage out of reach and a shallow one hands it back, which is the
earned window the "fish positioning is never random" entry exists to protect.
Damage is rounded to a whole number inside the curve rather than at the call
site, so the readout, the tests and the resistance actually dealt are all one
number.

**Space** fires it, so the thumb has it while the fingers hold A and D and the
little finger holds shift. **Attacking during a dash is allowed**: the shared
pool is already what limits both, and getting a weak long-range hit off while
fleeing is a real choice rather than a free one.

Confirmed by playtest the same day and not retuned.

Two consequences worth recording. The fish is no longer carried forward by
reference in `stepFight`, because the attack is the first code that writes to
it; the previous entry expected that to happen at 1.11. And the readout gained
`resist` and `dmg`, the latter running the same function the simulation charges
with, since the curve is the one thing in the fight that cannot be judged from a
bar.

Rejected: costs of 12 and 16, cooldowns of 12 and 30 ticks, 15/5 and 28/7
damage, a linear curve, a smoothstep curve, J and the left mouse button, and
locking attacks out for the duration of a dash.

## 2026-08-19: Stamina refills at 6 a second, and any spend pauses it for half a second

The regeneration rate from design.md section 8, answered, together with the
rule for how it behaves after spending, which is the half of the question the
open questions list does not spell out but which carries most of the feel.

**6 a second**, authored per second with the per-tick value derived from
TICK_HZ, same as the boat's speed. Empty to full is 13.3 seconds and one
attack's cost comes back in 1.3. Worked backwards from the fish rather than
picked: 400 resistance, split across attacking and dashing at their 1.6 and 1.7
costs, lands the fight in the 60 to 90 seconds FISH_RESISTANCE_MAX was sized
for. 9 a second shortened it to 45 and made dashing a habit rather than a
decision; 4 a second pushed it past 100 and risked boring rather than tense.

**Any spend pauses the refill for 30 ticks**, half a second, dash or attack
alike. This is the Dark Souls rule and it was chosen over a constant trickle
because the trickle gives the player no reason to ever stop pressing: it just
discounts each attack from 8 to about 6 and changes nothing about how the fight
is played.

The load-bearing consequence, and the reason 30 was picked rather than any other
delay: **the attack cooldown is 20 ticks and the pause is 30, so attacking at
full cadence means the refill never runs at all.** Ten attacks in 3.3 seconds
and then nothing comes back until the player disengages. Recovering is a
positional decision, and from task 1.9 the moments spent recovering are exactly
the fish's attack windows. A 60-tick pause was rejected as punishing to commit
to before the fish is even attacking.

One thing falls out rather than being coded: a dash lasts 14 ticks, which sits
inside the 30-tick pause its own cost started, so the pool never moves
mid-dash. There is no special case for it and there should not be one.

Two implementation notes that are decisions rather than detail. "Spent this
tick" is read off the pool itself rather than from a flag each action sets, so a
dash and an attack in the same tick is one delay, not two: it is the pool
recovering, not the actions. And the pool is **fractional** now, since the rate
is per tick. Nothing rounds it, because the costs are checked against the real
number, so the debug readout floors it instead: 7.6 shown as 8 would claim an
8-cost attack is affordable a tick before the simulation refuses it.

This also retired the "the pool only goes down" test, which the 1.6 handoff had
been carrying a warning about since a playtest misread a page reload as
regeneration. It was rewritten into the new rule rather than deleted, and four
older dash and attack tests moved from asserting an exact final pool to
asserting the floor the pool reached, since how much was spent can no longer be
read off the end state.

Rejected: 9 and 4 a second, a constant trickle with no pause, a 60-tick pause,
and pausing only during a dash.
