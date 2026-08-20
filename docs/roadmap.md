# Roadmap

**Tier: Fluid.** Update freely. Updating the handoff block is the last step of
every batch.

Each task lists the docs to read for it. Read those and nothing else unless you
genuinely need more mid-task.

---

## Handoff

Update this block at the end of every batch. Keep it to a few lines.

- **Current phase:** 1, grey box fight
- **Last completed task:** 1.12, win and lose states. Tests, lint, format and
  build are clean at 198 tests. **Not yet playtested**, so it is not closed: the
  second gate in CLAUDE.md's definition of done is still open.
- **In a half state:** nothing in the code. **Two playtests are outstanding**,
  1.11's and 1.12's, and neither task closes until Badr has played it. 1.12 did
  not touch a single number or line belonging to 1.11, so the 1.11 list below is
  still exactly what it was.
- **Next task:** 1.13, tuning pass. Badr plays it twenty times and **only numbers
  change**. Nothing in that task is fixed with code: if something can only be
  fixed with code, that is a finding to raise rather than a change to make.
  _Context: design.md section 8 and the settled numbers below._ 1.2c is still
  open and still not gameplay-blocking.
- **What the 1.12 playtest is looking for:**
  - Losing: four close punishers and everything stops dead, washed dark. The
    frozen fight should still be readable under the tint. Judge whether stopping
    dead reads as an ending or as a crash.
  - Winning: the tether goes thick and pale for two seconds with nothing else
    moving at all, then the pale wash. **`REEL_IN_TICKS` is the number most
    likely to be wrong**, because the beat is a stub with nothing inside it yet.
    Two seconds of a strained line either reads as a final run or as a hang, and
    only playing it answers that.
  - `R` restarts, but only once a fight is over. Press it mid-fight and confirm
    nothing happens.
  - The readout's new `stage` line, which is also what says whether `ticks` going
    back to zero was `R` or a page reload.
- **What the 1.11 playtest is looking for**, before anything is retuned:
  - The `tether` line in the readout now names the band. It should flip to close
    at roughly 75 horizontal from a resting fish and not flip back until roughly
    147, and it must not chatter when walking slowly across either edge.
  - Closing in should read as the fish rising to meet you and then gliding
    underneath. Walking away must visibly outpace it.
  - **Judge the volley again before touching one of its numbers.** Flight time is
    derived from depth, so a volley from the resting station is 1.10's 84-tick
    flight and one from a risen fish is 42 and much sharper. Nothing about either
    attack was retuned at 1.11, deliberately.
  - The close punisher's column must stay put for the whole wind-up.
- **Where the fish's code lives.** `sim/ai/patterns.ts` runs the attacks and
  `sim/ai/bands.ts` chooses and repositions, per architecture.md section 2.
  `sim/distance.ts` owns `bandFor` and its hysteresis. Still hard-coded for one
  grey box fish: task 3.1 extracts fish into data files, and writing that
  definition format now is building ahead of the roadmap. The field names already
  match the architecture.md section 4 sketch so the extraction is a move rather
  than a rewrite. Nothing has an `id`, a `weight` or a `punishes` yet,
  deliberately. Two concessions: a local `TIMINGS` record keyed by attack kind,
  so the phase machine is written once rather than once per attack, and
  `attackForBand`, which is a one-to-one mapping today and becomes the thing that
  reads a fish definition's weighted list at 3.1.
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
  - Far punisher: 40 wind-up, 3 shots one every 15 ticks, 30 recovery, 90
    cooldown. 8 hull damage a shot, 24 for a whole volley. Shots climb at 72 u/s
    and correct at 36 u/s, 10 units wide. Full cycle 191 ticks, 3.2 seconds.
    Flight time is **not** a constant: it is the depth the shot was fired from
    divided by the climb, so it is 84 ticks from the resting station and 42 from
    a risen fish.
    Each shot is **lobbed** at where the boat stood when it fired, with the
    correction on top: tracking alone closes only about 50 units in a flight and
    could never reach a boat across the lane. The correction staying under the
    boat's 90 u/s walk is what makes the volley free to dodge on foot, and a test
    pins that inequality rather than the values.
  - **The dash grants no invulnerability frames.** Decided at 1.9 and pinned by
    a test. It buys 55 units of distance and nothing else.
  - Bands: edge 140 on line length, hysteresis 15, resting depth 100 in the far
    band and 50 in the close one, swimming 36 u/s and rising 30 u/s. Two
    inequalities between those are pinned by tests rather than the values: the
    far resting depth stays at or under `edge - hysteresis`, and the close band
    is horizontally wider than the hitbox at its centre. See decisions.md for
    what breaks if either goes.
  - Reel-in 120 ticks, two seconds. The one number here that is openly a
    placeholder: it is the length of a beat with nothing inside it yet, and it
    gets longer once design.md section 2's timed input or mash exists.
- **Carried out of 1.12, still true:**
  - **A fight has four stages** on `FightState.stage`: `fighting`, `reelIn`,
    `landed`, `escaped`, with `stageTicksRemaining` counting out the only one
    that has a duration. `landed`/`escaped` rather than `won`/`lost` because
    those are design.md section 2's own words and phase 4's record book is keyed
    on that distinction.
  - **Ending a fight freezes it completely.** `stepFight` guards at the top and
    `stepEnding` takes over: no input read, nothing moves, the fish does not
    attack, shots in the air neither travel nor resolve. `stepEnding` **spreads
    the state instead of naming every field**, which is the opposite of the
    rebuild rule below and is correct there because nothing simulates. `tick`
    keeps counting in every stage, so a frozen fight cannot be mistaken for a
    hung one.
  - **Both bars emptying on one tick is a win**, because the player's attack is
    charged against resistance well before the fish's damage reaches the hull. A
    test pins it. Do not "fix" it into a loss.
  - **The renderer hides the telegraph and the shots once the fight is over**,
    rather than the simulation blanking them. The state stays an honest snapshot
    of what the fish was mid-way through, which is what phase 4 will want.
  - **Restart is `R`, on `FightControls` but deliberately not on `FightInputs`.**
    It is the meta layer's job, not the fight's, and `sim/` stays ignorant of it.
    `FightScene.startFight` rebuilds the driver rather than resetting one, and
    resets `elapsedMs` alongside it, or the tick-rate average reads as permanent
    drift.
  - **One existing test needed the ending, not the other way round.** "spends the
    pool even when the dash is eaten by a wall" walked RIGHT for 1000 ticks,
    which since 1.9 walks into the hitbox, so the boat now loses before the dash
    under test can fire. It uses `quietFish()` now. It is the one test that
    genuinely needs the _right_ wall, so it cannot take the "send test boats
    left" advice below.
- **Carried out of 1.11, still true:**
  - **Bands are cut out of line length, which includes depth**, not out of
    horizontal distance. The fish's own depth therefore moves it between bands.
    Do not "simplify" it to `Math.abs`; decisions.md records what that costs.
  - **`band` is the only part of the fight's geometry stored on the state.**
    Everything else is derived on demand. It is stored because hysteresis means
    the answer depends on the previous answer, and `createFightState` **seeds**
    it rather than computing it, because the opening line of 141 sits inside the
    margin where `bandFor` has nothing of its own to say.
  - **The band picks which attack, the hitbox still picks whether.**
    `closePunisherHits` doubles as the close punisher's commit test exactly as it
    did at 1.9. In the close band with the boat out of the box the fish commits
    to nothing and swims instead, and its cooldown is **held at zero rather than
    reloaded** so patience costs it nothing and it swings the tick it arrives.
    `farPunisherFires` is gone.
  - **The fish repositions only while idle.** Frozen through wind-up, active and
    recovery. Not the commitment rule, a choice on top of it, and decisions.md
    gives the two reasons. design.md section 3's "rises while winding up
    something slow" is deliberately deferred to an attack designed around it.
  - **It closes on the boat in the close band and holds station in the far one.**
    Holding station is deliberate: the volley already reaches the whole lane.
  - **`FISH_START_DEPTH` is `FISH_FAR_BAND_DEPTH`**, so the fish opens the fight
    at the resting station of the band it opens in and nothing drifts on tick
    one. Several tests depend on that, including `quietFish()` below.
  - Nothing clamps the fish to the lane and nothing needs to: it only ever moves
    towards the boat's x and never past it, and the boat is already clamped.
- **Carried out of 1.10, still true:**
  - **There is nowhere on the lane the fish ignores you.** 1.10 made the two
    triggers exact opposites; 1.11 replaced them with bands that still cover the
    lane between them. The one position that commits no attack is the close band
    outside the hitbox, and the fish spends it swimming at you, so it is not
    quiet either. `tests/fight.test.ts` has a `quietFish()` helper that seeds a
    cooldown the fish will not finish; use it for anything measuring the boat's
    own resources. Since 1.11 it silences the **attacking** only: a quiet fish
    still repositions, so it holds still only while the boat stays in the far
    band. Send test boats left.
  - **One phase machine, one cooldown, plus `fish.attackKind`.** Both attacks run
    through the same `stepFishAttack`, and the cooldown loaded when a recovery
    ends belongs to the attack that just ran. A non-idle phase with a null kind
    throws rather than defaulting, because a silent fallback would be the fish
    quietly running the wrong attack for a second and a half.
  - **Shots are entities, not part of the attack.** `FightState.projectiles`,
    stepped by `stepProjectiles` before the fish moves, so the boat x they
    resolve against is the one this tick already produced. The fish goes idle
    with its volley still climbing, deliberately: at greater depth that means a
    close punisher can start underneath its own shots, which the test seeds by
    hand because it is not reachable from the opening position (recovery plus
    cooldown is 120 ticks against an 84-tick flight).
  - **Flight time is derived from depth**, `shotFlightTicks`, which is why 1.11
    changed the attack's whole feel without retuning it. A deep fish telegraphs
    further ahead and lobs shots that travel longer, which is also the case where
    shots outlive the cooldown.
  - The far punisher's tell is an outline **on the fish**, not a column, because
    it owns no column of water. Deliberately a different shape from the close
    punisher's box rather than a variation on it: the two ask for opposite
    movements and must not be read for one another. It stays up through the
    active phase, since the volley is still being fired during it.
  - Shots are drawn **without interpolation**, from `driver.current`, because the
    list changes length as they resolve and index-matching two ticks would smear
    a shot that just landed into one just fired. Judged fine at the 1.10
    playtest: at 1.2 units a tick it does not read as stutter. If a later change
    speeds the shots up, look at this again.
  - The readout shows `far:windUp 12` style labels, a `shots` count and, since
    1.11, the band next to the tether.
- **Carried out of 1.9, still true:**
  - `CLOSE_PUNISHER_REACH` is **derived**, half the hitbox plus half the hull,
    because the box catches an overlapping boat rather than only a boat whose
    centre is inside it. Do not turn it into a third tunable.
  - The wind-up branch **does not read the boat at all**, for either attack, and
    must not start. That is design.md section 3's commitment rule expressed as
    code rather than as a comment, and four tests assert it now.
  - The hitbox is re-tested on **every** active tick, with `attackHasHit`
    keeping it to one hit per swing. A boat that dashes into a box drawn solid
    on screen has to be hit by it, or the drawing is a lie.
  - The `Pick<>`-in, patch-out convention that `stepClosePunisher` introduced is
    now **promoted to patterns.md**, on its third and fourth uses at 1.10.
    `stepClosePunisher` itself is gone: 1.10 replaced it with `stepFishAttack`,
    which serves both attacks.
  - **Tests that walk the boat rightwards now walk it into the hitbox.** The
    boat starts at 240 and the fish sits at 340, so anything holding `RIGHT`
    for more than about 39 ticks is inside the box and taking hull damage. Two
    purity tests moved to `LEFT` for this reason, one of which had been passing
    only by coincidence. If a test needs the boat far from the fish for a long
    run, send it left. Since 1.11 that is truer still: about 17 ticks of `RIGHT`
    is enough to pull the fish into the close band, after which it rises and
    starts closing, and a test that wanted a fish standing still no longer has
    one.
  - The old "leaves the hull alone entirely, since nothing damages it yet" test
    is gone. Its 1.9 replacement held the boat away from the fish, and 1.10
    retired that too: see `quietFish()` above.
  - The telegraph is `game/render/telegraph.ts`, told a phase, an attack kind and
    a position. The close punisher's column is an outline while winding up, solid
    while active, hidden otherwise. **Recovery deliberately draws nothing**: reading the recovery and
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
  - `stepFight` now names eighteen fields plus a list, and reads as six stacked
    concerns: movement, the band and the fish's repositioning, the player's
    attack, the pool, the shots, and the fish's attack. Splitting the boat and
    fish halves into two functions that `stepFight` composes is the obvious move
    and is a task of its own. It was deliberately not slipped into 1.10, 1.11 or
    1.12 and is getting harder to keep out; propose it rather than doing it. 1.12
    added a guard clause at the top rather than a seventh concern, so the shape of
    the split has not changed.
  - The order inside `stepFight` is load bearing and is not obvious from reading
    it. The band is read against the fish's position at the **top** of the tick,
    because repositioning needs a band before it can move; the player's damage is
    then priced against the position the fish has **just** moved to, so both
    sides of the line are this tick's. The difference is under a unit either way,
    but several tests are exact about it.
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
- [x] **1.10 Fish attack: far punisher.** Slow tracking volley.
      _Context: design.md section 3._
- [x] **1.11 Distance bands.** Two bands with hysteresis, fish selects attacks
      by band and repositions with intent.
      _Context: design.md section 3, architecture.md section 4._
- [x] **1.12 Win and lose states.** Hull to zero loses. Resistance to zero wins
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
