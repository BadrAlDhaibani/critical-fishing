# Roadmap

**Tier: Fluid.** Update freely. Updating the handoff block is the last step of
every batch.

Each task lists the docs to read for it. Read those and nothing else unless you
genuinely need more mid-task.

---

## Handoff

Update this block at the end of every batch. Keep it to a few lines.

- **Current phase:** 1, grey box fight
- **Last completed task:** 1.9, the fish's close punisher. Tests pass, lint and
  build are clean, and Badr signed it off on 2026-08-19. Not retuned. If it
  turns out to read wrong later, the 45-tick wind-up is the number to revisit
  first: everything else in 1.9 was sized around it, and the close punisher has
  only ever been judged on its own, without the far punisher pulling the player
  in the opposite direction.
- **In a half state:** nothing.
- **Next task:** 1.10, the far punisher, a slow tracking volley.
  1.2c is still open and still not gameplay-blocking.
- **What 1.10 has to ask for and must not invent.** Its own wind-up, active and
  recovery durations, its own hull damage, its own hitbox or projectile speed,
  and its own cooldown. None of the 1.9 numbers transfer: design.md section 3
  wants it "trivially sidestepped up close, hard to read from across the
  screen", which is a different shape from the close punisher entirely.
- **The selection problem 1.10 walks into.** With two attacks and no bands until
  1.11, something has to choose between them. Do not build band selection early
  to solve it. The cheap shape that does not: give the far punisher its own
  trigger predicate that fires when the boat is **outside** close range, exactly
  mirroring `closePunisherHits`. The two are then mutually exclusive by
  construction and no chooser exists yet to be thrown away at 1.11. Raise this
  with Badr rather than assuming it.
- **Where the fish's code lives.** `sim/ai/patterns.ts`, per architecture.md
  section 2. Still hard-coded patterns for one grey box fish: task 3.1 extracts
  fish into data files, and writing that definition format now is building ahead
  of the roadmap. The field names in there already match the architecture.md
  section 4 sketch so the extraction is a move rather than a rewrite. Nothing has
  an `id`, a `weight` or a `punishes` yet, deliberately.
- **Numbers settled so far.** All of these answer parts of design.md section 8
  and must not be re-invented or quietly retuned outside task 1.13:
  - Default boat hull 100, default line stamina pool 80, grey box fish
    resistance 400. Hull and pool are properties of the **boat and line the
    player has unlocked**, not game constants, which is why the maxima live on
    `FightState` and `data/config.ts` holds only the default loadout.
  - Dash: 55 units over 14 ticks, costing 16. Five dashes from a full pool.
  - Basic attack: costs 8, 20-tick cooldown, 20 damage at 100 units falling to a
    floor of 6, on a true inverse curve. Ten attacks from a full pool.
  - Stamina refill: 6 a second, paused for 30 ticks by any spend. Empty to full
    is 13.3 seconds of not spending.
  - Close punisher: 45 wind-up, 8 active, 45 recovery, 60 cooldown. 25 hull
    damage, so four of them end the fight. 60-unit hitbox centred on the fish.
    Full cycle 158 ticks, 2.6 seconds.
  - **The dash grants no invulnerability frames.** Decided at 1.9 and pinned by
    a test. It buys 55 units of distance and nothing else.
- **Carried out of 1.9, needed before 1.10:**
  - **The fish only commits when the boat is already in range, and the range is
    the hitbox itself.** One predicate, `closePunisherHits`, answers both "does
    this connect" and "is it worth starting". That is deliberate and is what
    stops the trigger drifting into a second tuned number. It is also why the
    telegraph appearing is always the player's own doing.
  - `CLOSE_PUNISHER_REACH` is **derived**, half the hitbox plus half the hull,
    because the box catches an overlapping boat rather than only a boat whose
    centre is inside it. Do not turn it into a third tunable.
  - The wind-up branch of `stepClosePunisher` **does not read the boat at all**,
    and must not start. That is design.md section 3's commitment rule expressed
    as code rather than as a comment, and two tests assert it.
  - The hitbox is re-tested on **every** active tick, with `attackHasHit`
    keeping it to one hit per swing. A boat that dashes into a box drawn solid
    on screen has to be hit by it, or the drawing is a lie.
  - `stepClosePunisher` takes a `Pick<>` of what it reads and returns a patch
    that spreads into the fish, so `stepFight` can hand it the x it has already
    resolved this tick. Same convention as `lineLength`. **Two uses now**; a
    third promotes it to patterns.md.
  - **Tests that walk the boat rightwards now walk it into the hitbox.** The
    boat starts at 240 and the fish sits at 340, so anything holding `RIGHT`
    for more than about 39 ticks is inside the box and taking hull damage. Two
    purity tests moved to `LEFT` for this reason, one of which had been passing
    only by coincidence. If a test needs the boat far from the fish for a long
    run, send it left.
  - The old "leaves the hull alone entirely, since nothing damages it yet" test
    is gone, replaced by one that holds the boat away from the fish. The hull is
    no longer untouchable, only untouched by anything the boat does itself.
  - The telegraph is `game/render/telegraph.ts`, a Phaser rectangle told a phase
    and a position. Outline while winding up, solid while active, hidden
    otherwise. **Recovery deliberately draws nothing**: reading the recovery and
    choosing to close is the punish, and marking it would do that for the
    player. The debug readout names the phase instead, which is a tuning tool
    and goes away with the rest of the readout.
  - The readout's `fish` line shows the cooldown while idle and the phase's own
    counter otherwise, because the phase counter is zero while idle and would
    say nothing.
- **Carried out of 1.8, still true:**
  - **The attack cooldown is 20 ticks and the refill pause is 30, so attacking
    at full cadence means the pool never refills at all.** That is the whole
    point of the pause, and 1.9 is what now exploits it: the close punisher's
    recovery and cooldown give 105 ticks of safety, about five attacks and 40
    stamina, during which the refill never runs. The player has to disengage to
    recover. If any of those numbers move, check the inequality still holds
    before anything else.
  - The pool is **fractional** now, since the rate is per tick. Nothing rounds
    it, because costs are checked against the real number; the readout floors
    it so it can never claim an attack is affordable a tick before the
    simulation refuses it. Tests on the pool need `toBeCloseTo`.
  - How much was spent **cannot be read off the final pool** any more. Four
    tests moved to a `lowestLine` helper in `tests/fight.test.ts` that returns
    the floor the pool reached over a run of ticks. Use it rather than
    reintroducing exact end-state arithmetic.
  - The damage curve's `k` is **derived from the anchors** in `sim/damage.ts`,
    so retuning the damage cannot leave the curve behind. Do not split it out
    into a third tunable. Damage is rounded to a whole number inside the curve,
    which is why the readout and the resistance always agree.
  - `stepFight` rebuilds **both** `boat` and `fish` from scratch every tick, so
    every new field has to be named there or it vanishes after one tick. Both
    are guarded by a test. The fish stopped being carried by reference at 1.7,
    earlier than this block used to predict, because the attack writes to it.
  - The dash is **committed**: direction locks at the press, steering and
    reversal are ignored for all 14 ticks, and no second dash can start until
    it ends. This mirrors the fish's non-cancellable wind-up in design.md
    section 3, and a test asserts it. Do not "improve" it into steerable.
  - Both the dash and the attack are **edge-triggered inside `sim/`**, not in
    the input layer. `FightInputs` carries raw held state and `boat.dashHeld` /
    `boat.attackHeld` carry the previous tick. Done this way because a phase 7
    server cannot trust a client's "pressed this frame".
  - An action that cannot be paid for **in full** does not fire at all, for both
    the dash and the attack, and a dash eaten by a wall is still charged. All
    deliberate, all tested.
  - Attacking during a dash is allowed. The shared pool is the only limiter.
  - The debug readout shows `hull`, `stam` and `resist` as `current/max`, `dmg`
    as what the next attack would deal from where the boat is standing, and
    `tether` for the line's length, which is a different thing from `stam`. If
    a bar refills during a playtest, check `ticks`: a reset means the page
    reloaded, not that the simulation did it. This cost a diagnosis once.
  - Two conventions are at **two uses** each and get promoted to patterns.md on
    the third: edge-triggering a press inside `sim/` from a held flag, and
    refusing an action outright rather than part-charging it.
  - Bars are game objects inside the pixel grid, not DOM. `game/render/bars.ts`
    draws them; the pure fill maths is in `game/render/barGeometry.ts` so it can
    be tested without Phaser. Any value above zero draws at least 1 unit, so a
    living boat never shows an empty bar. The DOM debug readout sits bottom left
    because at 4x the top left is now the hull and line bars.
  - `tests/distance.test.ts` builds its boats and fish by spreading a real
    `createFightState()`, and `tests/fight.test.ts` builds its input literals by
    spreading `noInputs()`, so growing either type does not break them again.
  - Line length is euclidean and includes depth, and lives in `sim/distance.ts`
    as `lineLength(boat, fish)`, which takes only the fields it reads so callers
    can measure from a position they have not built a state around yet. Derived
    on demand, never stored on `FightState`. See decisions.md, which also
    records why horizontal-only was rejected: do not "simplify" it back to
    `Math.abs`. Note that `boat.line`, the stamina pool, is a different thing
    entirely from the tether whose length this measures. design.md calls both
    "line".
  - Fish depth is units below the waterline, not a screen y. `sim/` never sees
    `WATER_LINE_Y`; `FightScene` owns the one conversion. The boat is depth 0.
- **Noticed but not acted on:**
  - `stepFight` now names fifteen fields in its return literal and reads as four
    stacked concerns: movement, the player's attack, the pool, and the fish. It
    is still followable, but 1.10 adds a fifth and 1.11 adds a sixth. Splitting
    the boat and fish halves into two functions that `stepFight` composes is the
    obvious move and is a task of its own, not something to slip into 1.10.
  - Fullscreen zoom reads `3x` where `4x` is expected. Task 1.2c. **The console
    readings still have not been taken**, so the diagnosis has not started.
    Cheapest to grab during any future playtest: `devicePixelRatio`,
    `innerWidth`, `innerHeight` while in F11.
  - `FixedStepDriver` is not generic over an input type; `FightScene` threads
    inputs in through a closure and samples them once per frame. Fine now, but
    the server in phase 7 will likely want `advance(frameMs, inputs)`. Deferred
    deliberately rather than churn eight call sites in `loop.test.ts`.
  - architecture.md section 2 does not list `sim/loop.ts`, which now exists, and
    its `step(state, inputs, dt)` sketch should drop the `dt`, since section 3
    fixes the timestep and one call is exactly one tick. Two one-line edits
    proposed, both waiting on a yes. Firm tier, do not write them unprompted.
  - `npm run format` reformats `docs/design.md` and `CLAUDE.md`, repadding their
    markdown tables. Whitespace only, but design.md is Locked tier, so the
    reformat gets reverted by hand each time. A `.prettierignore` covering both
    would settle it. Not done, since it changes tooling config.
  - Phaser pinned at `^3.90.0`; npm `latest` is 4.2.1. Stack decision not made.

---

## Phase 1: grey box fight

The only question this phase answers is "is one fight fun?". Everything else in
the game is downstream of that answer.

No sprites, no menus, no save data, no server, no Discord, no title screen.
Coloured rectangles only.

- [x] **1.1 Project init.** Vite + TypeScript + Phaser 3, Vitest, eslint,
      strict mode. Empty scene rendering a blue rectangle for water.
      _Context: CLAUDE.md, architecture.md sections 2 and 3._
- [x] **1.2 Fixed timestep loop.** 60 Hz accumulator, decoupled from render,
      render interpolating between the last two states. Test it.
      _Context: architecture.md section 3._
- [x] **1.2b Render configuration.** Lock the internal resolution. `pixelArt:
true`, nearest-neighbour filtering, integer-zoom scale mode, letterboxed
      to fit the window. All simulation units are internal-resolution pixels
      from this point on. Ask Badr for the resolution, do not pick one.
      _Context: design.md section 6 (Art direction) and section 8._
- [ ] **1.2c Confirm integer zoom at fullscreen.** The readout showed `@ 3x` in
      F11 fullscreen on a display Badr reports as 100% scaled, where 1920x1080
      should give `4x`. Diagnose before fixing: run `devicePixelRatio`,
      `innerWidth` and `innerHeight` in the console while fullscreen. If
      `innerHeight` is 1080 and it still reads 3x, the recompute in
      `src/main.ts` is at fault, and the likely cause is the `resize` event
      firing mid-transition with nothing recomputing once the window settles. If
      `innerHeight` is under 1080 the behaviour is already correct and this task
      just closes. Not gameplay-blocking, 1.3 can go first.
      _Context: design.md section 6 (Art direction)._
- [x] **1.3 Boat movement.** `A`/`D` move a rectangle along the surface. Sim
      module owns the movement, Phaser only draws it.
      _Context: architecture.md sections 1 and 2, design.md section 2._
- [x] **1.4 Fish and line.** A static fish rectangle. A line drawn between boat
      and fish. Line length computed in `sim/distance.ts`.
      _Context: design.md section 2._
- [x] **1.5 Bars.** Hull HP, line/stamina, fish resistance. Drawn plainly.
      _Context: design.md section 2._
- [x] **1.6 Dash.** `Shift` + direction, costs line.
      _Context: design.md section 2. Ask for the values._
- [x] **1.7 Basic attack.** Costs line, damages resistance, damage scales
      inversely with line length.
      _Context: design.md section 2, architecture.md section 4._
- [x] **1.8 Stamina regeneration.** Line pool refills over time.
      _Context: design.md section 2._
- [x] **1.9 Fish attack: close punisher.** Wind-up, active, recovery. Commits
      once started. Damages hull.
      _Context: design.md section 3._
- [ ] **1.10 Fish attack: far punisher.** Slow tracking volley.
      _Context: design.md section 3._
- [ ] **1.11 Distance bands.** Two bands with hysteresis, fish selects attacks
      by band and repositions with intent.
      _Context: design.md section 3, architecture.md section 4._
- [ ] **1.12 Win and lose states.** Hull to zero loses. Resistance to zero wins
      and enters a stub reel-in sequence.
      _Context: design.md section 2._
- [ ] **1.13 Tuning pass.** Badr plays it twenty times. Adjust numbers only.

**Phase 1 exit test:** play twenty losses in a row and watch your own reaction.
Annoyed at yourself means the fight works. Annoyed at the game means telegraphs
are too short or too vague. Bored means the numbers are wrong. Fix with numbers
before touching anything else.

---

## Phase 2: game feel, still rectangles

Roughly doubles how good it feels. Doing it before art is deliberate: it shows
honestly how much of the feel comes from mechanics.

- [ ] **2.1 Hit stop.** 3 to 6 frames on heavy impact.
- [ ] **2.2 Screen shake.** Short, sharp, decaying, scaled to damage.
- [ ] **2.3 Hit flash.** Struck sprite pure white for 2 frames.
- [ ] **2.4 Core sounds.** Three or four: attack, hit, fish attack, loss.
- [ ] **2.5 Feel tuning pass.**

_Context for all of phase 2: design.md section 6._

---

## Phase 3: prove the content template

- [ ] **3.1 Extract the fish to a data file.** Bars, attacks, timings, damage,
      bands. Engine reads the definition.
- [ ] **3.2 Fish validation test.** Assert every fish has both a close punisher
      and a far punisher.
- [ ] **3.3 Add fish two, three and four by data only.** If this needs engine
      edits, stop: the template is wrong and it is cheapest to fix now.
- [ ] **3.4 Heavy attack.** Second player attack, higher cost and damage.

_Context: architecture.md section 4, design.md sections 2 and 3._

---

## Phase 4: the loop around the fight

At the end of this phase there is a complete game playable in one browser tab,
shareable as a static link. **Get it in front of friends here.** Early feedback
on the fight is worth more than anything in phases 5 to 7.

- [ ] **4.1 Cast and encounter roll.** Weighted table, no pre-cast modifiers yet.
- [ ] **4.2 Reward on win.** Currency and materials.
- [ ] **4.3 Record book.** Catches and escapes, escapes as silhouettes.
- [ ] **4.4 Loss cost.** Bait consumed, rod durability damaged.
- [ ] **4.5 One gear upgrade** that changes a fight number.
- [ ] **4.6 Storage interface** backed by localStorage, written so a REST
      implementation swaps in cleanly later.
- [ ] **4.7 Pre-cast modifiers.** Bait and spot shift the encounter table.
- [ ] **4.8 Deploy to a static host, send the link to friends.**

_Context: design.md section 5, architecture.md section 6._

---

## Phase 5: persistence

- [ ] **5.1 Postgres schema.**
- [ ] **5.2 REST API.**
- [ ] **5.3 Swap the storage interface to the API.**

_Context: architecture.md section 6._

---

## Phase 6: Discord

- [ ] **6.1 Discord OAuth login.**
- [ ] **6.2 Bot posting catches to the channel.**
- [ ] **6.3 Leaderboard command.**

_Context: architecture.md section 7._

---

## Phase 7: co-op boss fights

The largest phase and the one with the most work that is not design.

- [ ] **7.1 Move `sim/` onto a Colyseus server.**
- [ ] **7.2 Room creation and joining.**
- [ ] **7.3 State broadcast and client interpolation.**
- [ ] **7.4 Client-side prediction of own boat only.**
- [ ] **7.5 Aggro by recent damage.**
- [ ] **7.6 Boat collision as push, not block.**
- [ ] **7.7 Resistance scaling by player count.**
- [ ] **7.8 First boss fish, with a phase transition at 50%.**
- [ ] **7.9 Stun lure gear, with visible payoff for the team.**

_Context: design.md section 4, architecture.md section 5._

---

## Phase 8: art and music

A small art pass may be pulled forward to just after phase 3 for morale.
Never before phase 2.

- [ ] **8.1 Pixel art pass:** boat, fish, water, UI.
- [ ] **8.2 Line effects.** The signature visual.
- [ ] **8.3 Weather system.** Tint, particle layer, water animation, ambient loop.
- [ ] **8.4 One handmade boss arena.**
- [ ] **8.5 Layered stem boss music.**
- [ ] **8.6 The silence beat on breach.**

_Context: design.md section 6._

---

## Not scheduled

Depth axis and submarines. Elemental effects. Discord Activity embedding.
Anything else in the "Cut and rejected" table in design.md.
