# Roadmap

**Tier: Fluid.** Update freely. Updating the handoff block is the last step of
every batch.

Each task lists the docs to read for it. Read those and nothing else unless you
genuinely need more mid-task.

---

## Handoff

Update this block at the end of every batch. Keep it to a few lines.

- **Current phase:** 1, grey box fight
- **Last completed task:** 1.4, fish and line. Both gates closed.
- **In a half state:** 1.5, bars. Tests, lint and build are green. **The
  playtest gate has not closed**, so the task is not done.
- **Next task:** 1.6, dash, once 1.5 is confirmed. 1.2c is still open and still
  not gameplay-blocking.
- **Values settled this session.** These answer part of design.md section 8 and
  must not be re-invented. The decisions.md entry recording them is written up
  in the batch report and is **still to be appended**:
  - Default boat hull: 100. Default line stamina pool: 80. Grey box fish
    resistance: 400.
  - Hull HP and stamina pool are properties of the **boat and line the player
    has unlocked**, Dark Souls style, not game constants. Later boats run 140,
    200, 1000; a bigger pool is what makes later expensive attacks affordable,
    so a newbie line cannot fire a heavy attack without draining the bar. This
    is why the maxima live on `FightState` and `data/config.ts` holds only the
    default loadout, read in exactly one place, `createFightState`.
  - Stamina sits below hull deliberately. Badr asked for the two not to be
    "matchy matchy" and left the figure to me. A test asserts the inequality.
  - Bar layout, picked from a mockup: hull and line stacked top left, fish
    resistance top right.
- **Carried out of 1.5, needed before 1.6:**
  - Nothing spends or refills anything yet. 1.6 charges the dash against
    `boat.line`, 1.7 the attack, 1.8 refills it, 1.9 damages `boat.hull`. All
    of those costs are still open questions in design.md section 8: **ask.**
  - `stepFight` rebuilds `boat` from scratch every tick, so every new field has
    to be named there or it vanishes after one tick. Guarded by a test now.
  - `fish` is still carried forward by reference. Stops being safe at 1.11.
  - Bars are game objects inside the pixel grid, not DOM. `game/render/bars.ts`
    draws them; the pure fill maths is in `game/render/barGeometry.ts` so it can
    be tested without Phaser. Any value above zero draws at least 1 unit, so a
    living boat never shows an empty bar.
  - The DOM debug readout moved from the top left to the bottom left of the
    window, because at 4x it sat directly on top of the new bars.
  - `tests/distance.test.ts` builds its boats and fish by spreading a real
    `createFightState()`, so growing the state does not break it again.
  - Line length is euclidean and includes depth, and lives in `sim/distance.ts`
    as `lineLength(boat, fish)`. Derived on demand, never stored on
    `FightState`. See decisions.md, which also records why horizontal-only was
    rejected: do not "simplify" it back to `Math.abs`. Note that `boat.line`,
    the stamina pool, is a different thing entirely from the tether whose length
    this measures. design.md calls both "line".
  - Fish depth is units below the waterline, not a screen y. `sim/` never sees
    `WATER_LINE_Y`; `FightScene` owns the one conversion. The boat is depth 0.
- **Noticed but not acted on:**
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
- [ ] **1.5 Bars.** Hull HP, line/stamina, fish resistance. Drawn plainly.
      _Context: design.md section 2._
- [ ] **1.6 Dash.** `Shift` + direction, costs line.
      _Context: design.md section 2. Ask for the values._
- [ ] **1.7 Basic attack.** Costs line, damages resistance, damage scales
      inversely with line length.
      _Context: design.md section 2, architecture.md section 4._
- [ ] **1.8 Stamina regeneration.** Line pool refills over time.
      _Context: design.md section 2._
- [ ] **1.9 Fish attack: close punisher.** Wind-up, active, recovery. Commits
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
