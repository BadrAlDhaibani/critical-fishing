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

## 2026-08-19: The close punisher is 45/8/45 for 25 hull, and the dash gets no i-frames

Five of the design.md section 8 open questions answered, plus the
invulnerability frames question left open at 1.6 on purpose so that 1.9 could
decide it with something on screen to be invulnerable to.

**45 wind-up, 8 active, 45 recovery, 60 cooldown.** A 60-wide hitbox against a
24-wide hull puts the boat clear 42 units from the fish's centre, so a dash (55)
escapes with room and walking out takes 28 ticks, which fits inside the 45-tick
tell only if it is read immediately. That gap is the point: the dash is
insurance rather than the only answer, and a player who reads the tell early
does not have to spend stamina on it. Recovery plus cooldown is 105 ticks of
safety, about five attacks and 40 stamina, during which the 1.8 refill never
runs, so the safe window is also the window the pool is emptied in.

**25 hull damage** against the default boat's 100, so four mistakes end a fight.
A single hit is a real setback rather than a scratch, which is the Souls flavour
design.md section 1 asks for, but one misread is survivable.

**The fish commits only when the boat is already in range, and the range is the
hitbox itself.** One predicate, `closePunisherHits`, answers both "does this
connect" and "is it worth starting", so the two can never drift apart into two
separately tuned numbers, and the telegraph appearing is always the consequence
of the player standing somewhere the attack reaches. This is a stand-in for
attack selection, which arrives with the distance bands at task 1.11, and it was
chosen over inventing band edges early. Rejected: swinging on a metronome
regardless of where the boat is, which makes the tell background noise from
across the lane rather than information.

**No invulnerability frames on the dash.** It buys 55 units of distance and
nothing else, so escaping the box is done by leaving it rather than by phasing
through it. design.md pillar 3 stays literal that way, since every hit is then a
question of where the boat was standing. It is also the easy direction to change
later: i-frames can be added, but they cannot be taken away once players have
learned to rely on them. A test pins it. Rejected: full 14-tick invulnerability,
and i-frames on the first 8 ticks only.

Three implementation notes that are decisions rather than detail. The hitbox is
re-tested on **every** active tick rather than once as it opens, with an
`attackHasHit` flag keeping it to one hit per swing, because a boat that dashes
into a box drawn solid on screen has to be hit by it or the drawing is a lie.
The wind-up branch of `stepClosePunisher` **does not read the boat at all**,
which is design.md section 3's commitment rule expressed as code rather than
promised in a comment. And the telegraph draws **nothing during recovery**:
reading the recovery and choosing to close is the punish, and marking it on
screen would do that for the player.

Rejected: 30/6/30 and 60/10/60 timings, 30- and 90-tick cooldowns, 15 and 34
hull damage, 44- and 80-wide hitboxes, a solid box throughout the wind-up, and
telegraphing on the fish's own rectangle instead of on the water above it.

## 2026-08-20: The far punisher is a lobbed volley of three, 40/31/30 for 8 a shot

The other half of design.md section 3's no-safe-camping-spot rule, and the last
of the attack timings in the section 8 open questions. Confirmed by playtest the
same day and not retuned.

**40 wind-up, 3 shots one every 15 ticks, 30 recovery, 90 cooldown.** The active
duration is derived from the count and the interval rather than tuned, so the
phase always lasts exactly as long as the volley takes to leave. The tell is
shorter than the close punisher's 45 because it is not the whole warning: the
shots then spend 84 ticks in the air from the fish's starting depth, so the
player has about two seconds in total. Spreading the three over half a second is
what makes it a volley rather than three copies of one dodge, since a single lazy
sidestep does not clear all of them. Full cycle 191 ticks against the close
punisher's 158.

**8 hull damage a shot, 24 for a whole volley**, against the close punisher's 25
for one lunge. Deliberately cheaper per hit: one shot is a scratch that says
move, and it is only camping across the lane and ignoring every one of them that
ends a fight. 10 units wide against the 24-wide hull puts the boat clear 17 units
away, which is 11 ticks of walking.

**Each shot is thrown at where the boat was standing on the tick it fired, and
corrects towards it at 36 u/s on top of that.** The plan agreed before
implementation had no lob: shots would rise from the fish and steer at the capped
rate, and nothing else. Built that way the attack does not work, and the reason
is worth keeping. The correction cap has to stay under the 90 u/s walking speed
or the volley becomes something only a dash answers, and at any such rate it
closes about fifty units over a full flight. A boat parked two hundred units away
is then untouchable, which is precisely the safe camping spot this attack exists
to remove. Tracking alone cannot cross the lane at any speed that is still fair.

So the lob is the aim and the tracking is the correction. The lob answers where
the player _was_, which is what lets the volley reach anywhere on the lane; the
cap answers where they are going, slowly enough that walking always wins. That is
design.md section 3's "trivially sidestepped up close, hard to read from across
the screen" as two numbers: reading the tell and walking costs nothing at all,
and ignoring it costs a quarter of the hull.

**The trigger is the exact negation of `closePunisherHits`.** The far punisher
fires whenever the close one would not, so the two cover the lane between them,
overlap nowhere, and no attack selection code exists yet to be thrown away when
the distance bands arrive at task 1.11. It also means no second range number was
invented. The cost, accepted knowingly, is that there is now nowhere on the lane
where the fish does nothing.

**Shots are entities in `FightState.projectiles`, not part of the attack.** The
fish recovers and goes idle with its volley still climbing. At the starting depth
that changes nothing, since recovery plus cooldown is 120 ticks against an
84-tick flight, but once the AI owns depth at 1.11 a deep fish will be winding
something up while its own shots are still in the water. Flight time is derived
from depth rather than tuned, so a fish that dives telegraphs further ahead and
one that surfaces gives barely any notice, without a number moving.

Three implementation notes that are decisions rather than detail. Both attacks
run through **one phase machine with one cooldown**, plus a `fish.attackKind`
saying which owns it, because the fish does one thing at a time and two machines
would allow a lunge and a volley half finished at once; a non-idle phase with no
kind throws rather than defaulting, since a silent fallback would be the fish
quietly running the wrong attack for a second and a half. The far punisher's tell
is an **outline on the fish**, not a column of water, and deliberately a
different shape rather than a variation, because the two tells ask for opposite
movements and must never be read for one another. And the shots are drawn
**without interpolation**, since the list changes length as they resolve and
index-matching two ticks would smear a shot that just landed into one just fired.

One consequence for the tests. There is no longer anywhere to park a boat while
something else is being measured, so three tests that assumed a quiet fish were
rewritten and `tests/fight.test.ts` gained a `quietFish()` helper that seeds a
cooldown the fish will not finish. A test that needs the fish silent cannot get
there by standing somewhere any more.

Rejected: two shots at 12 damage and four at 5, full homing at a constant speed,
aiming at launch with no tracking at all, a separate minimum range for the far
punisher with a dead band between the two attacks, firing on a metronome
regardless of where the boat is, and holding the fish busy until the last shot of
its volley lands.

## 2026-08-20: Two bands at 140 ±15, the fish resting at depth 100 and rising to 50

The last of design.md section 8's fight geometry, and the task that retires the
mirrored triggers 1.9 and 1.10 stood in for attack selection with.

**Bands are cut out of line length, which is euclidean and includes depth.** Not
out of horizontal distance. This follows the 2026-08-19 entry above: depth has to
be a leg of the number the fight hangs off, or the fish's vertical axis is
cosmetic. Cutting bands out of it means the fish's own depth moves it between
bands, so diving is a real retreat and rising is a real commitment rather than a
change of costume. Rejected: horizontal-only bands, which are simpler and have no
geometric trap in them, but which reduce depth to a damage-and-telegraph modifier
and leave the fish with no way to answer position with position.

**Edge 140, hysteresis 15. Resting depth 100 in the far band, 50 in the close
one.** In units that can be felt: a boat gets within about 75 horizontal of a
resting fish to pull it into the close band, and has to get about 147 away to
push it back out. The asymmetry is not a mistake. The fish rising shortens the
line by itself, so committing to being close is harder to undo than it was to
provoke, which is what makes closing a decision rather than a toggle. The
hysteresis on top is design.md section 3's second fairness rule: standing on a
boundary must not make the fish flicker between movesets.

The four numbers only make sense as a set, and two inequalities between them are
pinned by tests rather than the values being pinned:

- The far resting depth must stay at or under `edge - hysteresis`. A boat
  directly overhead is exactly `depth` away, so a fish resting deeper than that
  could dive out of the close band permanently and never be lunged at once. That
  is design.md section 3's no-safe-camping-spot rule broken from the fish's side
  of it, and it is the trap the euclidean bands bring with them.
- The close band has to be horizontally wider than the hitbox at its centre, 75
  against 42, or the band edge is decoration and the approach below has no ground
  to cover.

**The close punisher's commit test did not change.** `closePunisherHits` still
answers both "does this connect" and "is it worth starting". The band picks
_which_ attack; the hitbox still picks _whether_. A fish in the close band with
the boat out of the box commits to nothing, and its cooldown is held at zero
rather than reloaded, so patience costs it nothing and it swings on the very tick
its approach arrives. `farPunisherFires` is deleted: the far band selects the
volley, and the volley needs no range of its own because it is aimed at wherever
the boat is and reaches.

**The fish closes on the boat in the close band and holds station in the far
one.** 36 units a second, 40% of the boat's walking speed, pinned as an
inequality the same way the volley's tracking cap is: walking always breaks
contact, so an approaching fish is pressure rather than a trap. The approach
exists because the close band is much wider than the box at its centre, and
without it the fish would sit in the gap between the two doing nothing, which is
the dead spot 1.10 removed from the lane. Holding station in the far band is not
laziness: the volley already reaches the whole lane, and a fish that chased there
would walk every fight into a wall. Rejected: drifting towards the boat in both
bands, which erodes far camping but ends most fights close and retires the
volley, and no horizontal movement at all, which reopens that dead spot.

**Depth moves 30 a second**, so the fish crosses between its two stations in
about 1.7 seconds, a little under one attack cycle. It arrives at the depth its
band wants at roughly the moment it is ready to attack from there.

**It repositions only while idle**, which in practice means during its cooldown.
design.md section 3's commitment rule is about not cancelling a wind-up rather
than about not moving during one, so this is a choice on top of it, made for two
reasons. The close punisher's telegraph is drawn on the column of water above the
fish, so a fish that drifted during its own tell would drag the hitbox after the
player and turn a read into a chase. And the far punisher's flight time is
derived from the depth it fired from, so a fish that rose mid-wind-up would be
shortening a warning it had already started giving. design.md section 3's "rises
while winding up something slow" is a real thing to build and belongs to an
attack designed around it. Rejected: moving through every phase.

Three consequences worth keeping. `FISH_START_DEPTH` is now
`FISH_FAR_BAND_DEPTH` rather than its own 100, because they are the same fact:
the fish opens the fight at the resting station of the band it opens in, so
nothing drifts on tick one. The opening band is **seeded** rather than computed,
because the opening line of 141 units sits inside the hysteresis margin where
`bandFor` has no answer of its own to give. And `band` is the only thing about
the fight's geometry that is stored on the state rather than derived on demand,
which is exactly what hysteresis means: the answer depends on the previous
answer.

Nothing about either attack was retuned, deliberately. The far punisher already
feels different because its flight time comes from the depth it fired from: a
volley from the resting station is the 84-tick flight of 1.10, and one from a
risen fish is 42 and much sharper. Judge that before touching its numbers.

---

## 2026-08-20: A fight ends in one of four stages, and ending it freezes it

Task 1.12. `FightState.stage` is `fighting`, `reelIn`, `landed` or `escaped`,
with `stageTicksRemaining` counting out the only one of them that has a duration.

**`landed` and `escaped` rather than `won` and `lost`**, because those are the
words design.md section 2 already uses: you land a fish, and a fish you lost to
goes into the record book as an escape with a silhouette and an estimated weight
rather than a real entry. Phase 4's record book is keyed on exactly that
distinction, so the vocabulary should not need translating when it arrives.
Rejected: `won`/`lost`, which would have had to be mapped onto these two anyway.

**Resistance reaching zero cuts to a 120-tick reel-in, and only then lands the
fish.** design.md section 2 is explicit that the win must not end the fight
instantly. Two seconds is the short end of its "a few seconds", chosen because
the beat is currently a stub with nothing inside it and dead air is all a stub
has to offer, and because task 1.13 plays the fight twenty times. It gets longer
once the timed input or mash that belongs in it exists. Hull reaching zero has no
equivalent beat and goes straight to `escaped`: the reel-in is the payoff for
winning and a loss has nothing to pay off.

**Ending a fight freezes it completely.** No input is read, the boat does not
move, the fish does not attack, and shots already in the air neither travel nor
resolve. design.md section 2 says the win **cuts** to a reel-in rather than
running one alongside the fight, and the loss has to work the same way: a
punisher landing on a boat that has already won, or a killing blow landing after
the hull is gone, would make the outcome a lie about what happened. `stepFight`
does this with a guard clause at the top, and `stepEnding` spreads the state
rather than naming every field, which is the exact opposite of what the main body
must do and is right for the same reason it is wrong there: nothing simulates, so
the ended state is a frozen snapshot and a second field-by-field rebuild would
only be a second place for a new field to be dropped. `tick` keeps counting in
every stage, so a frozen fight cannot be mistaken for a hung one.

**Both bars emptying on the same tick is a win.** Not generosity: it is the order
`stepFight` already resolves in. The player's attack is charged against
resistance well before the fish's damage reaches the hull, so the killing blow
genuinely landed first and the ending should say what happened. Pinned by a test.
Rejected: the harsher reading where the loss wins, which would have contradicted
the tick order the rest of the function is careful about.

**The renderer, not the simulation, stops drawing what can no longer act.** The
telegraph and the shots are hidden once the stage is not `fighting`, rather than
the simulation blanking the fish's attack fields on the way out. A telegraph is a
promise that something is about to hurt you and an ended fight cannot keep it,
but the state stays an honest record of what the fish was in the middle of, which
is what phase 4's record book will want. Two lines in `FightScene` against a
mutation in `sim/` that would have thrown information away.

**The endings are drawn as one flat colour wash, and there is no text.** The
2026-08-19 entry above puts debug chrome in the DOM and in-game UI in the canvas,
and an ending is in-game UI; canvas text at a 4x nearest-neighbour zoom is what
that entry rejected in the first place. The alpha leaves the frozen fight
readable underneath deliberately, because the position the boat died in is the
information the player wants. The reel-in gets no wash: it draws the tether
thicker and in its own colour instead, which is design.md pillar 4 and is also
the only thing moving during those two seconds, without which a frozen fight
would read as a hang.

## 2026-08-20: Restart is `R`, and it lives in the scene rather than in the sim

Approved during task 1.12, because task 1.13 is twenty playthroughs and reloading
the page for each of them is not a reasonable way to spend them.

`R`, well clear of A, D, shift and space so a hand still on the controls at the
moment a fight ends cannot fat-finger it, and **ignored entirely while a fight is
running** so there is no accidental rage-restart.

It is on `FightControls` but deliberately **not** on `FightInputs`. Restarting is
not something a boat does inside a fight, it is the meta layer's job: design.md
section 5 has a loss consume the bait, damage the rod and write a record book
entry, none of which the simulation knows about. Keeping it out of `FightInputs`
keeps the phase 7 wire contract to things the fight actually acts on. `FightScene`
reads the key directly and rebuilds its `FixedStepDriver`, rather than resetting
one, so `previous` is seeded with the fresh state too and no frame interpolates
the boat from where the last fight ended to where the next one begins.

One consequence for the 2026-08-19 entry above: the readout's `ticks` dropping to
zero used to mean only "the page reloaded", and now also means "R was pressed".
The new `stage` line is what tells the two apart.

## 2026-08-20: The 1.13 tuning pass, round 1 — the close-camping cheese

The first playtest of the assembled fight. The mechanics were confirmed good
("very fluid"), and the fight was reported as "kinda easy". The easiness turned
out not to be a difficulty-scaling question at all.

**The close band held exactly one attack.** Its 45-tick wind-up ran against a
28-tick walk-out, so there were 17 ticks of free slack: the close punisher was
dodgeable on foot, every time, without spending anything. Recovery plus cooldown
then handed back **105 ticks of guaranteed safety, in the highest-damage position
in the fight**. Camping close was therefore simultaneously the safest and the
strongest option, which inverts design.md section 2's central tradeoff — the
pillar the whole game rests on. Not a common fish being appropriately gentle: the
baseline fight was solvable.

Numbers moved, against Badr's words: close wind-up 45→34 (slack 17 ticks→6),
close cooldown 60→40 (safety 105→85), swim 36→42 ("fish could be faster"), shot
climb 72→96 and tracking 36→48 ("projectiles could be faster"). Hull damage
deliberately **not** raised despite being asked for, so that hit frequency and
hit severity did not move in the same round and make each other unreadable.

Two discoveries here are worth more than the numbers, and both cost a wrong
attempt first.

**The close band's width is cut from `EDGE − HYSTERESIS`, not `EDGE`.** Depth
100→125 was tried, on the reasoning that the pinned `depth ≤ edge − hysteresis`
test allowed exactly 125. It does — but only degenerately. Entering the close
band needs a line shorter than 125, and a boat directly above a fish at depth 125
is exactly 125 away, so the close band became **zero units wide** and the fish
could never be pulled into close range again. The binding constraint is the other
test, the one comparing band width against `CLOSE_PUNISHER_REACH`, which caps
depth at **117** at the current edge. Deepening also *shrinks* the close band
horizontally (75 units at depth 100, 49 at depth 115), so it makes the fight
easier, not harder. **The fish cannot go deeper unless `FISH_BAND_EDGE` goes with
it**; depth 125 pairs with edge 160 and preserves today's geometry exactly.
Reverted to 100 for now.

**Swim speed is capped near 47 by the lane, not by the pinned inequality.**
`FISH_SWIM < BOAT_SPEED` guarantees the boat breaks contact only in an
*unbounded* lane. Ours is 480 units and the boat is clamped to it. At 54 a boat
fleeing from directly above the fish reaches the wall with a 143-unit gap when
146.7 is needed for the band to flip back to far — so the fish closes the
remainder and parks on the cornered boat permanently, which is exactly the trap
the 2026-08-20 bands entry rules out. Settled at **42**, about 20 ticks of
margin. The lesson generalises: a ratio between two speeds is not a safety
property when one of them runs out of room.

## 2026-08-20: GAME_PACE, one knob for the whole fight's clock

Approved at 1.13 round 2, on "I want everything to just be faster... more
stimulating". Set to **1.25**.

Speeds scale up through `atPace`, durations scale down through `ticksAtPace`, and
**every distance, cost, damage and pool is left exactly alone**. That combination
is time dilation rather than a rebalance: the boat covers the same ground during
a wind-up, the hitbox is still cleared in the same number of units, and every
guardrail in the fight is a ratio between two quantities that scale together, so
all nine survive by construction. All 198 tests passed with no edits at all,
because they derive from the constants rather than hard-coding tick counts.

Authored values stay written as themselves. `ticksAtPace(34)` still records that
this telegraph was designed as 34 ticks, so pace is an axis independent of
tuning, and one number changes the whole game's tempo instead of eighteen.
**Reading convention for `config.ts`:** prose quotes the authored numbers; divide
any quoted wall-clock time by `GAME_PACE`. Ratios between paced values are
unchanged, and distances are never paced, so every "clears the hitbox in N units"
claim is exact as written.

**It is not difficulty-neutral, and that is the catch.** Reaction time does not
scale with the simulation: a 34-tick tell that was 567 ms is 450 ms at 1.25, and
the slack for walking clear of the close punisher falls from 100 ms to 77 ms. The
geometry is untouched and the clock is not.

Rejected: **raising `TICK_HZ`**, which would compress tick-authored durations but
leave per-second rates alone, so it is not uniform, and it is an architecture
change rather than a number. And **scaling speeds without durations**, which is
more frantic but moves every geometric relationship and would have undone round
1's tuning the day it landed.

Fight length was allowed to fall from roughly 60–90 seconds to roughly 48–72
rather than raising `FISH_RESISTANCE_MAX` to compensate, on the grounds that a
longer fast fight reads as padded.

## 2026-08-20: Phase 1 closed without its twenty-fight exit test

Badr's call, made knowingly after the alternative was put to him.

Neither the roadmap's phase 1 exit test ("play twenty losses in a row and watch
your own reaction") nor task 1.13's own "Badr plays it twenty times" actually
ran. The fight was sampled across a handful of sessions instead, and two rounds
of retuning were accepted on that basis — the second of which stacked a pace
change on top of a difficulty change that had never been played on its own.

Recorded here so a later session reads this as a decision rather than an
oversight, and so the consequence is written down rather than rediscovered:
design.md section 6 warns that hit stop, screen shake and hit flash **hide bad
timing**, and phase 2 adds all three. If the fight later reads as unfair or as
mushy, the phase 1 tuning is the first suspect and not the effects layer, and
`GAME_PACE` is a single number to back off before anything else is touched.

## 2026-08-20: Hit stop built, played and cut

Task 2.1 was implemented and rejected at the playtest gate. At grey box fidelity
the freeze read as a stutter rather than as impact: there is nothing on screen
whose motion stopping means anything, so the pause registers as the game
hitching. Badr's call, made after playing it.

Deferred rather than abandoned — revisit once there are animations to freeze,
which is the phase 8 art pass or the small pass that may be pulled forward after
phase 3. **Do not re-implement it before then without asking.**

This sits against design.md section 6, which calls hit stop "the single biggest
game feel lever that exists" and puts all three feel effects before art
deliberately. That ordering is now contradicted by a playtest for one of the
three. design.md is Locked and was not edited; recorded here so the tension is
visible rather than resolved by silence.

Two implementation findings kept so a reintroduction is not from scratch. The
freeze itself is one line: skip `driver.advance(delta)` in `FightScene.update`,
which stops the boat, fish, telegraph, shots and interpolation alpha at once
because all of them read off the driver. And the trigger needs **no sim field** —
`boat.hull` and `fish.resistance` are the only damage sinks and nothing heals, so
watching those two for a drop gives you the fact, the magnitude and which side
was struck. That watcher survives as `game/feel/impacts.ts`, built for 2.2.

## 2026-08-20: Phase 2 continues as written, hit stop was the odd one out

The cut above put the whole phase in question, since all three effects rest on
the same "feel before art" bet. Badr's call is that it does not generalise.

Freezing motion is the one effect that depends on there being motion worth
freezing. Screen shake moves the whole camera and works exactly as well on flat
rectangles, and hit flash on a solid-colour rectangle is if anything cleaner than
on detailed art. Shake also costs no wall-clock time, so the pace objection that
killed hit stop does not apply to it at all.

2.2, 2.3 and 2.4 therefore proceed in order. Each still has to pass the same
playtest gate on its own, and the precedent set here is that failing it means
deferring the effect rather than reordering the phase.

## 2026-08-20: Screen shake values, and whose hits shake

Chosen for task 2.2 after the amplitudes were put to Badr as whole-unit offset
sequences rather than as numbers.

**Punchy: 1 to 3 units over 12 frames at the heaviest.** One unit is one
internal-resolution pixel and four physical pixels at 1080p, so a close punisher
throws the frame about twelve physical pixels and decays over a fifth of a
second. Subtle (1–2 over 8) risked being an effect you have to be told is there;
heavy (2–5 over 16) is a large fraction of a 480x270 frame and read as the game
convulsing.

The offset is always a **whole number of units**. Fractional camera scroll at a
4x nearest-neighbour zoom puts everything between physical pixels and shimmers,
which is the same failure `game/config.ts` chose `Phaser.Scale.NONE` to avoid.
The amplitude itself decays fractionally; only what reaches the camera is
rounded.

**Duration is derived from amplitude, not tuned separately.** The shake decays at
a fixed rate, so a 3-unit shake fades over 12 frames and a 1-unit one over 4. A
second scaled number could disagree with the first.

**Both sides' hits shake**, scaled by damage, which is design.md section 6's
literal "scaled to damage dealt". The scaling is what answers the worry that the
screen would be moving constantly at attack cadence: a typical far-band hit deals
6–10 and shakes one unit, near-imperceptible, while an earned close-range hit
shakes meaningfully. That makes it the damage-by-distance curve made felt, the
same argument that shaped the hit stop threshold before it was cut, and it is the
first on-screen feedback the player's attack has ever had.

**Exempt from `GAME_PACE`**, for the reason hit stop was going to be: shake is
wall-clock feel rather than fight geometry. Nothing in the simulation is timed
against it, no inequality involves it, and design.md states it in frames.

`Math.random` enters the codebase here and is confined to `game/feel/`. `sim/`
stays deterministic, and a shake never crosses the wire and never affects the
fight.

## 2026-08-20: Screen shake toned down to subtle after playtest

Supersedes the amplitude in the entry above. Badr played 2.2, said it felt good
and flowed well, and asked for it to be a little more subtle. Moved to the
"Subtle" package that was on the table when the values were first chosen: **1 to
2 units over 8 frames**, halving the peak throw from twelve physical pixels to
eight.

Amplitude and duration moved **together**, so the decay rate stayed at a quarter
unit a frame. Dropping the amplitude alone would have left a heavy hit trailing
eight frames of one-unit jitter, which reads as buzzing rather than as a decaying
jolt — the shape of the decay is as much of the feel as its size.

A hit at the damage floor is unchanged by this: it was already on
`SHAKE_MIN_AMPLITUDE` for four frames and still is. That matters because the same
playtest round had just fixed those hits shaking only about a third of the time,
and this retune had to not undo it.

## 2026-08-20: Whole-pixel effects need the floor inside the rounding

Found in play at 2.2, and worth recording because it is invisible to a test that
only asserts bounds.

The shake's per-frame offset was a random number scaled by the amplitude and then
rounded to whole units. At the one-unit amplitude every hit at the damage floor
gets, `Math.round` collapses roughly two frames in three to zero, so hits from
across the lane shook only sometimes while close-range ones looked solid. The
floor existed precisely to make every hit register and the rounding was throwing
it away.

Replaced with a magnitude of `max(1, round(amplitude))`, with the randomness
choosing direction only, and the offset now emitted **before** the frame's decay
rather than after so the first frame is thrown at the amplitude the hit earned.

The general form, for the hit flash and anything else drawn on the pixel grid:
when a floor exists to guarantee something is visible, it has to be applied
**after** the rounding, not before it.

## 2026-08-20: Hit flash taken literally, and not scaled by damage

Task 2.3. design.md section 6 is exact — "render the struck sprite pure white for
2 frames" — and it was implemented as written, including the "pure". A flash that
is a tint of the thing it is flashing reads as the object changing colour; a
flash that is white reads as being hit.

**Unscaled by damage, unlike the shake beside it.** The two effects split the
reading: the shake says *how hard*, the flash says *that*, and *which of the two
it happened to*. Stacking a second magnitude onto the flash would only make the
lightest hits read as near misses, and the magnitude is already carried.

Known and accepted: `COLOUR_BOAT` is a warm off-white, so the hull's flash has
much less contrast than the dark fish's. Played and judged fine at 2.3. If it
ever reads weakly the fix is the hull's colour at the phase 8 art pass, not a
second flash colour here.

## 2026-08-20: Open finding 1 closed without the sim field it asked for

The finding held that showing the player's landed attack required a new field on
`FightState`, because nothing recorded that an attack fired. `ImpactWatcher`,
built for 2.2, made that unnecessary: the basic attack always deals damage when
it fires, so "an attack landed" and "resistance dropped" are the same event, and
the fish flashing white is the representation. `sim/` was not touched.

Recorded because the finding was written confidently and was wrong, and the
reason it was wrong is reusable — **before adding state to record that something
happened, check whether an existing observable already implies it.** The
constraint that makes this sound here is that hull and resistance have exactly
one direction of travel and one cause; it would not hold for a pool that both
drains and refills.

What actually remains is narrower and is now written into the finding: no visual
for the attack travelling the line, which is phase 8.2's, and a refused attack
being silent, which was never actually decided and belongs at 2.5.

## 2026-08-20: Core sounds synthesised as placeholders, behind a swap seam

Task 2.4, and the first task in the project needing assets. Three options were
put to Badr — synthesise in code, wait for him to supply files, or synthesise now
and replace later — and he chose the third, intending to outsource real audio.

Four sounds are generated from oscillators plus a noise buffer at run time. No
files, no new dependencies, and every sound is a row of numbers in `config.ts`
rather than an asset to re-export. The same bet as the coloured rectangles: it
can be judged before anything is made.

**`FightAudioPlayer` is the seam and `Cue` is the contract.** Four strings —
`attack`, `hurt`, `telegraph`, `loss` — are the whole of what the fight knows
about audio. Real files arrive as a different implementation of a one-method
interface plus a Phaser `preload`, and the `SOUND_*` table gets deleted rather
than converted. Nothing else in the game changes.

Phaser's own audio context is used rather than a fresh one, because browsers keep
audio suspended until the page is interacted with and Phaser already handles that
unlocking. A second context would sit silent with nothing watching for the
gesture. Where Phaser hands back a non-Web-Audio manager the player falls back to
silence rather than throwing: sound is the one layer of this game whose absence
should cost nothing but sound.

Three calls inside that are design rather than plumbing:

- **design.md's "hit" is read as the boat being hit**, not as the player's attack
  connecting. For the player, firing and connecting are the same event, so
  `attack` already covers it, and the one on the receiving end is the more useful
  to hear.
- **One telegraph cue for both fish attacks**, not one each. The same call
  `COLOUR_TELEGRAPH` already makes for the eye: one signal means danger whatever
  shape it is in, so the player learns the signal rather than a vocabulary of
  them. Which attack it is stays the telegraph's shape to say. It also fires once,
  on entering the wind-up, and is ordered ahead of the damage cues in a frame that
  has both, being the only one about something that has not happened yet.
- **Winning is silent.** design.md section 2 makes the reel-in the payoff beat and
  phase 8 hard swaps the music there. A sting now would be squatting on it.

The frequencies, durations and gains were **picked rather than asked for**, which
is a deliberate exception to the rule about not inventing tunables: a frequency
cannot be judged without hearing it. They are a first cut for 2.5 to argue with,
and `SOUND_MASTER_GAIN` exists so the whole bank moves with one number.

## 2026-08-20: `npm run test` passing is not evidence the build is sound

Caught at 2.4. A wrong type name (`FightAttackPhase` for `FishAttackPhase`) was
imported, and the full suite passed over it: vitest strips types without checking
them, so only `tsc` in `npm run build` found it.

Recorded because the natural habit is to treat a green suite as the gate.
**`npm run build` has to stay in the loop alongside `npm run test`**, and a task
is not verified until both have run.

## 2026-08-20: The 2.5 tuning pass moved nothing

Task 2.5, and it closes phase 2. Every lever was played and every one was left
where it was: `SOUND_MASTER_GAIN`, the four `SOUND_*` rows, the three `SHAKE_*`
values and `HIT_FLASH_FRAMES`. Badr's verdict was "literally no complaints".

Recorded because a pass that changes nothing is indistinguishable from a pass
that never ran, and the difference matters here. The four sound rows were
**picked rather than asked for** at 2.4, flagged there as a deliberate exception
to the rule against inventing tunables. This is the pass that converts them from
invented to approved, and `config.ts` now says so.

The audio was auditioned cue by cue through a DOM panel added for this pass
(`game/audio/audition.ts`), which plays through the same `FightAudioPlayer` the
fight does. It stays: it is debug chrome like the readout, and it outlives the
placeholder bank, since real audio will want auditioning too.

**One caveat worth having in writing.** The plan ran audio first and the visuals
second, on the reasoning that the shake was cut from 3-over-12 to 2-over-8 in a
completely silent game and a thud now carries part of the weight it carried
alone. In the event both were judged in one sitting rather than two. The shake
and flash values are therefore confirmed, but not confirmed *against that
specific question*. If the shake ever reads as redundant next to the audio, this
is why, and the answer is to lower it rather than to suspect anything else.

## 2026-08-20: A refused attack stays silent

Badr's call at 2.5, and it closes the remainder of open finding 1.

Pressing attack on cooldown or without the stamina to pay does nothing and says
nothing. That now matches the dash, where `sim/fight.ts` already makes every
refusal silent by design, so the two actions sharing a pool also share how they
answer being asked for more than there is.

Considered and rejected: a fifth cue, which would have widened the audio contract
that 2.4 deliberately fixed at four strings, and a stamina bar flash, which is a
renderer change rather than a tuning one and would have been its own task.

What remains of open finding 1 is now only phase 8.2's: no visual for the attack
travelling the line.

## 2026-08-21: The fish definition format, and where the fish/engine line falls

Task 3.1. The shape below was proposed and all three open choices were answered
by Badr before any code was written.

**Behaviour is code, everything else is data.** A pattern carries a `behaviour`
naming which of the engine's two attack shapes it runs — `meleeColumn` opens a
hitbox on the water above the fish, `volley` throws shots that outlive the attack
— and every number that shape uses is authored beside it. This is the load
bearing part: a fish with two melee patterns at different reaches, damages and
telegraphs is two entries in a data file and no engine change, which is what open
finding 2 needs and what task 3.3 is the test of. A fish needing a genuinely new
*shape* of attack is a new behaviour and a branch in `sim/ai/patterns.ts`, and
architecture.md section 4 says to flag that rather than work around it.

**Bands are an ordered array, nearest first.** `BandId` widened to
`'close' | 'mid' | 'far'` and `bandFor` walks the list. Chosen over keeping two
hard-typed bands, because architecture.md section 4 already sketches the array
and because design.md section 3's "rare" rarity is three bands: hard-typing two
would have made the first rare fish an engine edit. Each band states only where
it *ends*, `Infinity` on the outermost. Rejected `minDistance` **and**
`maxDistance` per the sketch: a boundary is one fact, and the previous band's end
already is the next one's start.

**Bands hold `attacks: [{ patternId, weight }]`, and nothing reads the weight
yet.** design.md section 3 gives each band "a small weighted list" so the format
carries one, but the roll needs a source of randomness inside a `sim/` that is
deliberately deterministic, which is its own task (open finding 3).
`attackForBand` therefore **throws** on a list longer than one entry rather than
returning the first. Deliberate and the point of the decision: a second attack
added to a band would otherwise look like it worked, play like it did nothing,
and cost a playtest to notice. A test pins the throw.

**`SHAKE_MAX_DAMAGE` is now a game constant authored at 25**, not the current
fish's biggest hit. It used to be `FISH_CLOSE_HULL_DAMAGE`, which pinned the
biggest shake to the biggest hit in a game that had one fish; once damage is
per-fish that stops being a definition and becomes a choice. The choice is that
the shake means the same thing across every fish — a minnow's chip hit reads as
lighter than a boss's, which it cannot if each fish rescales the ceiling to its
own worst attack. Rejected: a per-fish ceiling. `shake.ts` already clamps above
it, so a future 40-damage hit simply maxes out. `tests/feel.test.ts` now *checks*
that the grey box fish's lunge still lands exactly on the ceiling, where before
that was true by construction.

**The definition rides on `FishState`.** `fish.definition` is read-only and the
one field that is the same object on every tick rather than a fresh one, which is
safe because nothing in `sim/` mutates. Chosen over threading it as a second
parameter through `stepFishAttack`, `stepReposition` and `bandFor`: everything
that already takes a `Pick<FishState, ...>` just names one more field, and the
"take a Pick of what you read, return a patch" pattern survives untouched. A
projectile carries `patternId` for the same reason in miniature — a shot outlives
the attack that fired it, so its climb rate, tracking cap, damage and width have
to be findable again, and one string on the wire beats four numbers per shot.
Phase 7 will broadcast the fish's id and look the definition up client-side
rather than putting sixty numbers in every snapshot.

**Where the line fell.** To the fish: resistance, body size, swim and dive rates,
band edges, resting depths, whether a band approaches, and both patterns entire.
To the engine: `FISH_BAND_HYSTERESIS`, because the fairness rule in design.md
section 3 is a promise about every fish rather than a knob one fish turns;
`FISH_START_X`, which is arena placement and becomes phase 4.1's; and the two
presentation constants, renamed `TELEGRAPH_OUTLINE_PADDING` and
`PROJECTILE_DRAW_HEIGHT` now that they belong to no particular fish. A shot's
*width* went to the pattern rather than staying presentation, because the boat is
hit-tested against it. `FISH_START_DEPTH` disappeared: it is the outermost band's
resting depth and was the same fact twice.

**No number changed.** Every value moved and none of them moved. The whole suite
passes on its original assertions, which is the check that the extraction is a
move rather than a retune.

Also settled, smaller: the definition reaches the renderer, not only `sim/`.
`telegraph.ts` and `projectiles.ts` read the fish's own size and the pattern's
own widths, because a telegraph drawn at another fish's size is a promise the
game cannot keep. `FightScene` sizes the fish rectangle from the definition at
construction, which is correct while a restart reuses the same fish and gets
revisited at phase 4.1.

## 2026-08-21: Fish validation, and what a validation test is for

Task 3.2. No design question was open here, so these are implementation calls
made in the batch and worth not re-litigating.

**The coverage rule is measured over reachable patterns, not over the `patterns`
list.** architecture.md section 4 asks for "at least one pattern with
`punishes: 'close'` and one with `punishes: 'far'`", and taken literally a fish
could satisfy that with a pattern no band ever names — a safe camping spot with a
passing test in front of it. `tests/fish.test.ts` therefore walks the bands'
attack lists to find the patterns, and separately asserts no pattern is
unreachable. design.md section 3's rule is about what the fish **does**.

**`data/fish/index.ts` is the registry, and the test reads the directory to make
sure it is complete.** Everything in the validation file loops over `ALL_FISH`,
so a fish added as a file but not to the list would be validated by nothing while
still being playable the moment an encounter table names it. Reading the
directory turns "forgot to register it" into a failing test rather than a silent
gap. The registry is deliberately **not** how `createFightState` finds its
default fish, which still imports `greyBox.ts` directly: the default is a
particular fish, not whichever one is first in a list.

**`import.meta.glob` rather than `node:fs`.** Reading the directory with Node
would have meant adding `@types/node` to the project for one test, and CLAUDE.md
says not to add dependencies without asking. `vite/client` is already in the
tsconfig `types`, and the glob lives in the test rather than in `src/`, so
nothing that moves to the Colyseus server in phase 7 picks up a bundler
dependency. Rejected: adding the types package, and dropping the check.

**Six format rules ride along with the one the task asked for.** Unique fish ids,
unique pattern ids within a fish, every band attack resolving to a real pattern,
every band having at least one attack, bands ordered nearest first with an
`Infinity` outermost edge, and every band being reachable by a boat overhead.
Each is a fault task 3.3 could introduce in data alone, and each would otherwise
surface either as a throw mid-fight or — worse — as a fish that plays wrong
without failing anything. The last of those is the roadmap's invariant 1
generalised: a station deeper than the next band in has room for means that band
never fires, which is the no-safe-camping-spot rule broken from the fish's side.

It overlaps one grey-box-specific test in `tests/bands.test.ts`, deliberately and
without merging them. That file tests the tuned shape of *this* fight, alongside
reasoning that is only about these numbers; this one tests that any fish is
legal. The overlap is one assertion and the two ask different questions.

**Every rule was proved to fail before the batch closed**, by putting a
deliberately broken fish in `data/fish/`, watching each rule fire, and deleting
it. Against a single well-formed fish most of these pass vacuously, which is the
state the suite will be in most of the time, so a rule added here later should be
checked the same way.

## 2026-08-21: Three fish by data alone, and where the template stops

Task 3.3. The task was the test of architecture.md section 4's claim that adding
a fish is never an engine change.

**The claim held.** Three fish went in as three files and one registry line. No
new field on `FishDefinition`, no third `behaviour`, no line of `sim/` touched.
The two attack shapes and the numbers authored beside them covered everything
three deliberately different fish wanted to be. Behaviour-is-code,
everything-else-is-data survives its first real use.

**All three are `common`, and that is the finding.** `attackForBand` throws on a
band holding more than one attack, because the weighted roll is not built. So
design.md section 3's ladder above common is unreachable in data: uncommon *is* a
second attack in a band, rare *is* two or three attacks per band, and boss needs
a `phases` field that was never built. Open finding 3 stopped being a gap in the
attack-selection code and became the thing gating content. It also blocks open
finding 2. Worth doing before any fish above common is attempted.

**What separates three fish that share one moveset shape.** Not damage numbers,
which was the expected answer and is the weakest one. It is band geometry
crossed with resting depth, because line length is euclidean and depth is a leg
of it. The Managerial Carp's band edge of 150 sits close to the grey box fish's
140, but its far station of 130 spends almost the whole budget on depth, so its
close band starts about 36 units horizontally where the grey box fish's starts at
75. The Deadeye Gar's leaves about 31. The Duelling Perch's leaves about 98. One
number moved and the fight changed shape. **Depth is the fish-design lever**, and
it was not obvious before three fish existed to compare.

**The invariant is now load bearing in both directions.** roadmap invariant 1 —
a station deeper than `maxDistance - FISH_BAND_HYSTERESIS` can never be pulled
into the band inside it — was a trap with one fish and is a design constraint
with four. Both the carp and the gar sit exactly 5 units inside it, deliberately,
because that is where the interesting geometry is. Deepening either means moving
its band edge with it.

**Two claims in the data files' own prose were wrong before they were right.**
The first draft carried the grey box fish's horizontal figures across to fish
with different depths instead of recomputing them. Caught by hand, not by a test,
and not catchable by one: it was prose. Comments in `data/fish/` are read by
future sessions as fact, so arithmetic in them gets checked like code.

**Rejected: three fish differing mainly in resistance and damage.** That is the
version of this task that proves nothing, because it never asks the format a
question it might fail.

## 2026-08-21: The fish picker reloads rather than swapping live

Also task 3.3, and a consequence of it rather than a plan.

`createFightState` has taken a fish definition since 3.1, but `FightScene` called
it with no argument, so the grey box fish was the only one anything could play.
Three fish added as data would have passed every test and been unplayable, and
CLAUDE.md's definition of done is tests **and** a playtest. So the batch included
`game/scenes/fishPicker.ts`: DOM buttons beside the audition panel, same reasoning
that put the debug readout and the cue buttons outside the canvas.

**Selecting a fish reloads the page with `?fish=<id>` instead of swapping the
fish in the running scene.** Two things size themselves off the definition
exactly once, at construction: the fish rectangle in `FightScene.create`, and the
shot pool in `render/projectiles.ts`, sized to the fattest volley the fish has. A
live swap means resizing one and rebuilding the other — renderer surgery inside
the one task whose whole claim is that adding a fish touches nothing. A reload
gets a correctly built scene for free, and costs a page flash a handful of times
a session against a fight that restarts anyway.

Worth knowing: **that construction-time assumption is still there**, and phase
4.1's encounter roll is where it comes due. A roll that hands `startFight` a
different fish mid-session hits exactly the two places this decision routed
around. The picker is a debug override of that roll once it exists, not a
replacement for it.

Rejected: a key binding, since `game/input/keyboard.ts` treats a new binding as a
design proposal rather than a convenience, and this is tooling.

## 2026-08-21: The heavy attack commits

Task 3.4, approved in conversation before implementation. design.md section 2
only says "ship with exactly one basic and one heavy attack" and the roadmap only
said "higher cost and damage", so the shape was an open design question and these
are Badr's answers to it.

**It is a committed wind-up, not a bigger basic.** Pressing it roots the boat for
a wind-up, and then the hit lands. Rejected: an instant heavy that is simply the
basic with larger numbers, because whenever the pool could afford it that is
strictly better and the decision collapses into a resource check rather than a
read. Also rejected: a heavy dealing flat damage regardless of line length, which
would have cut against design.md section 2's inverse-distance coupling — the
thing that section calls the whole fight.

What the commitment buys is **design.md section 3's rule pointed back at the
player.** The fish cannot cancel a wind-up and now neither can you. Being rooted
when a telegraph starts is a misread you cannot walk out of, which is design.md
pillar 3 applied symmetrically.

**Cost is charged at the press; damage resolves at the end of the wind-up**,
priced at the line length at that moment. Two consequences, both wanted. The
stamina is gone whether or not it goes well, and the regen delay starts
immediately. And a fish that dives away mid-wind-up costs you damage without
doing anything about the attack, which is the distance coupling working on the
fish's side of the line for the first time.

**Shared cooldown**, loaded into the existing `attackCooldownRemaining` rather
than a counter of its own. Rejected: independent cooldowns, which make the
damage-optimal play an alternating rotation nobody has to think about — an MMO
cadence rather than the Souls flavour of design.md section 1.

**Dash and heavy refuse each other in both directions.** Both are commitments and
neither is an escape from the other. Note this differs from the basic attack,
which deliberately does not consult the dash at all.

Values, all authored at pace 1.0:

- `HEAVY_LINE_COST` **20**. Four heavies from a full 80 pool against ten basics.
- `HEAVY_WINDUP_TICKS` **24**. Deliberately shorter than the shortest fish tell
  in the game, the duelling perch's 28. **The number most likely to move at
  playtest.** Against the carp's 55-tick slam you can start a heavy and still
  clear it; against the perch's jab you cannot. That asymmetry is the read.
- `HEAVY_COOLDOWN_TICKS` **28**. Kept under `LINE_REGEN_DELAY_TICKS` of 30, so it
  obeys the same unwritten invariant the basic's cooldown does (roadmap invariant
  3): attacking at full cadence must stop the refill entirely.
- `HEAVY_DAMAGE_MULTIPLIER` **3**. The same curve and the same clamps, scaled: 60
  at full range against the basic's 20, floor 18 against 6. That is 3.0 damage
  per stamina against the basic's 2.5, so landing one is genuinely better — the
  counterweight is that the pool holds only four and you had to judge the window.

**Bound to `F`**, per the note in `game/input/keyboard.ts` that an extra binding
is a design proposal rather than a convenience. Under the index finger with the
hand on A and D, leaving shift for the dash and space for the basic.

Two smaller calls made in the same conversation. **The wind-up is drawn on the
line**, in a `COLOUR_HEAVY_LINE` deliberately distinct from `COLOUR_TELEGRAPH`,
which `config.ts` reserves for "the fish is about to hurt you": a boat rooted for
24 ticks with no feedback reads as a hang, which is the problem the reel-in
already solved this way, and design.md pillar 4 wants effects on the line anyway.
And **no fifth sound cue.** The heavy landing already fires the `attack` cue for
free, since `ImpactWatcher` sees the resistance drop; only the wind-up is silent,
which matches the 2.5 decision that a refused attack stays silent.
