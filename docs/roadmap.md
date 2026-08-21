# Roadmap

**Tier: Fluid.** Update freely. Updating the handoff block is the last step of
every batch.

Each task lists the docs to read for it. Read those and nothing else unless you
genuinely need more mid-task.

---

## Handoff

Update this block at the end of every batch. Keep it to a few lines.

- **Current phase:** 3, prove the content template.
- **Last completed task:** 3.3, three fish by data alone. **The template passed
  its test**: `duellingPerch.ts`, `managerialCarp.ts` and `deadeyeGar.ts` plus one
  line in the registry, with no engine change of any kind. It also added
  `game/scenes/fishPicker.ts`, because nothing could fight a fish that was not the
  grey box. 3.1 and 3.2 before it built the format and its validation test. Phase
  1 is complete apart from 1.2c, still open and still not gameplay-blocking.
- **Next task:** 3.4, the heavy attack. _Context: design.md section 2,
  architecture.md section 4._ **Two things must come from Badr before it can be
  built:** its stamina cost and damage are named in design.md section 8's open
  questions, so they are asked for rather than invented, and its key binding is a
  design proposal rather than a convenience — see the header of
  `game/input/keyboard.ts`. Note it is a *player* attack: it touches
  `data/config.ts`, `sim/`, and the input layer, and none of the fish work.
- **Read open finding 3 before planning any more content.** 3.3's finding is that
  the rarity ladder stops at common until the weighted roll exists. It is now
  gating content rather than being a gap in attack selection, and it also blocks
  finding 2. Worth scheduling before any fish above common is attempted.
- **Phase 1 exited without its twenty-fight exit test**, and phase 2 then added
  two of the three effects design.md section 6 warns **hide bad timing**. Badr's
  deliberate call, recorded in decisions.md 2026-08-20. If the fight ever starts
  reading as unfair or mushy, suspect the phase 1 tuning before the effects
  layer, and see `GAME_PACE` below.
- **In a half state:** nothing. **Awaiting a yes:** two proposed edits to
  architecture.md section 4, listed under open finding 9.

### The fish format

`src/data/fish/types.ts` holds the format. Read it first; it is written to be the
explanation. There are **four fish**: `greyBox.ts`, the one phase 1 was tuned
against and still the default, plus 3.3's `duellingPerch.ts`, `managerialCarp.ts`
and `deadeyeGar.ts`. All four are `common`, for the reason in open finding 3.

**3.3 proved the claim this format was built to make.** Three fish, three files,
one registry line, no engine change. If a future fish needs one, that is news and
belongs in decisions.md.

**What actually differentiates fish is band geometry crossed with resting depth**,
not damage numbers. Line length is euclidean and depth is a leg of it, so a deep
station spends most of the band's budget before any horizontal distance counts:
the carp's close band starts about 36 units horizontally, the gar's about 31, the
perch's about 98, the grey box fish's 75 — on band edges that only span 115 to
170. That lever was not visible with one fish. Full working in decisions.md
2026-08-21, and in each fish file's `BAND_EDGE` comment.

The rule the format is built along is **behaviour is code, everything else is
data**. A pattern names a `behaviour` — `meleeColumn` or `volley` — which selects
one of the two attack shapes `sim/ai/patterns.ts` implements, and every number
that shape uses is authored beside it. So a fish with two melee patterns at
different reaches is two data entries. A fish needing a new *shape* of attack is
a third behaviour and a branch in that file, which architecture.md section 4 says
to flag rather than work around. That is the line 3.3 is testing.

Four things worth knowing before touching it:

1. **Bands are an ordered array, nearest first, and each states only where it
   ends** (`Infinity` on the outermost). `BandId` is `'close' | 'mid' | 'far'`,
   so a three-band rare fish is data. `bandFor` walks the array; its boundary
   semantics are exactly what they were with one edge, and `tests/distance.test.ts`
   pins both the two-band and a synthetic three-band walk.
2. **`attackForBand` throws on a band holding more than one attack.** The format
   carries `weight`, design.md section 3 asks for the weighted list, and the roll
   is not built — see open finding 3. The throw is deliberate, so a second attack
   cannot be added and appear to work. Do not "fix" it by returning the first.
3. **The definition rides on `FishState` as `fish.definition`**, read-only and
   shared by reference. It is the one field on either object that is the same
   instance every tick. A projectile carries `patternId` for the same reason.
4. **The renderer reads it too**, which is the half that would have been missed.
   `telegraph.ts` draws the column at the pattern's own `hitboxWidth` and the
   outline at the fish's own size; `projectiles.ts` sizes its pool and its
   rectangles off the definition. A telegraph at another fish's size is a promise
   the game cannot keep. **Two of those readings happen once, at construction**:
   the fish rectangle in `FightScene.create` and the shot pool in
   `projectiles.ts`. That is why 3.3's fish picker reloads the page rather than
   swapping the fish live, and it is a real debt that **comes due at phase 4.1**,
   when the encounter roll wants to hand `startFight` a different fish
   mid-session. See decisions.md 2026-08-21.

**Playing a fish that is not the grey box:** `game/scenes/fishPicker.ts`, DOM
buttons at the bottom right above the cue audition row, or `?fish=<id>` in the
URL directly. Debug tooling, and a stand-in for phase 4.1's encounter roll.

What stayed in `data/config.ts` is stated in that file's header, with the test to
apply before adding a constant: **could two fish disagree about it?** If they
could, it is fish data. `SHAKE_MAX_DAMAGE` is now a game constant authored at 25
rather than the current fish's biggest hit, so the shake means the same thing
across every fish; decisions.md has the reasoning.

`data/fish/index.ts` is the registry, and a fish is only in the game once it is in
that list. `tests/fish.test.ts` reads the directory with `import.meta.glob` and
fails on a file that is not registered, so half-adding a fish is loud. It then
checks seven rules over every fish: the design.md section 3 close-and-far
coverage, which is measured over patterns a band can actually **reach** rather
than over the `patterns` list, plus six format rules a data-only fish could break
without failing anything else. All seven were proved to fail against a
deliberately broken fish before 3.2 closed. Whether a fish is any *good* stays a
playtest question and is not in there.

Open findings 2, 3 and 4 below are the rest of phase 3's `attackForBand` work.

### The feel and audio layers

Phase 2, complete and unlikely to need reopening, but it constrains what 3.1 may
assume.

`game/feel/` holds three modules and no Phaser imports. `impacts.ts` is the
shared trigger: it watches `boat.hull` and `fish.resistance` for drops and
reports `{ target, damage }`. That works because those are the fight's only two
damage sinks and nothing heals either, so a drop **is** an impact and its size
**is** the damage. It keeps its own last-seen values rather than reading
`driver.previous`, because a slow frame runs several catch-up ticks and a hit on
the first of them would already be in both. **The shake, the flash and the audio
all read from this one list**, so the ear and the eye cannot disagree about what
happened. Anything phase 3 adds that hurts either side gets shake, flash and
sound for free; anything that damages something *else* gets none of it.

`shake.ts` and `flash.ts` are the effects. Both count in real milliseconds rather
than ticks, neither is paced, and both clamp their delta with `MAX_FRAME_MS`:
feel is wall-clock, nothing in the simulation is timed against it, and design.md
states these in frames. `Math.random` lives in `shake.ts` and `synth.ts` and
nowhere else — `sim/` stays deterministic, which is the constraint open finding 3's
weighted attack selection has to be built inside.

`game/audio/` is split the same way `sim/` and `game/` are, and for the same
reason. `cues.ts` is pure TypeScript that decides *which* of four cues fired and
is unit tested; `synth.ts` makes the noise through Phaser's own audio context and
is not, per architecture.md section 9. **`FightAudioPlayer` is the seam real audio
arrives through**: four cue names are the whole contract, so replacing the
synthesised placeholder means a new implementation of a one-method interface and
deleting the `SOUND_*` table, nothing else. `audition.ts` is a DOM panel that
fires any cue on demand, added at 2.5 and kept — real audio will want auditioning
too. One telegraph cue covers **both** fish attacks deliberately, so a third
attack needs no fifth cue.

Neither of the two shapes above is in patterns.md yet, and both are close.
"Wall-clock milliseconds, unpaced, `MAX_FRAME_MS`-clamped" has two uses, not the
three that promotes a pattern — hit stop would have been the third and was cut.
"Hold your own last-seen value rather than reading `driver.previous`" also has
two, `ImpactWatcher` and `CueWatcher`. **Whichever gets a third use next should be
written up then.**

The division of labour between the two effects is deliberate and worth keeping:
**the shake says how hard, the flash says which.** That is why the flash is not
scaled by damage — a flash proportional to a 6-damage chip hit would read as a
near miss, and the magnitude is already carried.

Two traps that cost a wrong attempt each and should not be rediscovered:

1. **Apply a visibility floor after the rounding, not before.** The shake's
   offset is `max(1, round(amplitude))` and not `round(random * amplitude)`. The
   second collapsed roughly two frames in three to zero at low amplitudes, so the
   lightest hits shook only sometimes. Anything drawn on the pixel grid has the
   same trap. In patterns.md as an anti-pattern, and in decisions.md 2026-08-20.
2. **The camera scrolls, so anything full-screen needs `setScrollFactor(0)` or a
   margin.** The water rectangle is overdrawn by `SHAKE_MAX_AMPLITUDE` on three
   sides and the ending tint is pinned to the camera, or a shake pulls the canvas
   background into view at the edges.

### Read this before touching any number

**`GAME_PACE` in `data/config.ts` is 1.25, and every number in the fight now has
an authored form and an effective one.** Speeds are wrapped in `atPace` and scale
up; tick durations are wrapped in `ticksAtPace` and scale down; distances, costs,
damage and pools are never paced. One knob sets the whole game's tempo.

Consequences you need before reading anything else in that file:

- **Prose in `config.ts` quotes the authored numbers**, the ones written inside
  the call. Divide any wall-clock time it quotes by `GAME_PACE`. Ratios between
  two paced values are unchanged; distances are exact as written.
- `ticksAtPace(34)` still records that the telegraph was *designed* as 34 ticks.
  Do not collapse the two by replacing it with 27 — that loses the reasoning and
  the pace axis at once.
- Changing `GAME_PACE` is a real gameplay change even though it touches no
  geometry: reaction time does not scale. 1.25 turns a 567 ms tell into 450 ms.

### Numbers settled so far

All **authored** values; effective values are these through `GAME_PACE` 1.25.
These answer parts of design.md section 8 and must not be quietly re-invented.

Since 3.1 every fish number below lives in `src/data/fish/greyBox.ts` rather than
in `config.ts`, and belongs to that fish rather than to the game. The two lists
are kept here together because what they are is one tuned fight.

**These are the grey box fish's numbers only.** 3.3's three fish carry their own
and are not listed here — read the files, where each number is written next to
the reasoning for it. Nothing below was retuned when they landed, and none of
them has been through a tuning pass of its own.

- Default boat hull 100, default line pool 80, grey box fish resistance 400.
  Hull and pool belong to the **boat and line the player has unlocked**, not to
  the game, which is why the maxima live on `FightState` and `data/config.ts`
  holds only the default loadout.
- Boat walks 90 u/s. Dash 55 units over 14 ticks, costing 16. Five dashes from a
  full pool.
- Basic attack: costs 8, 20-tick cooldown, 20 damage at 100 units falling to a
  floor of 6 on a true inverse curve. Ten attacks from a full pool.
- Stamina refill 6 a second, paused 30 ticks by any spend.
- Close punisher: 34 wind-up, 8 active, 45 recovery, 40 cooldown, 25 hull damage,
  60-unit hitbox centred on the fish. Four of them end a fight.
- Far punisher: 40 wind-up, 3 shots one every 15 ticks, 30 recovery, 90 cooldown,
  8 hull damage a shot. Shots climb 96 u/s, correct at 48 u/s, 10 units wide.
  Flight time is **derived from the depth fired from**, not a constant.
- Bands: edge 140 on **line length**, hysteresis 15, resting depth 100 far and 50
  close, swimming 42 u/s, rising 30 u/s.
- Reel-in 120 ticks. Openly a placeholder: it is a beat with nothing in it, and
  it gets longer once design.md section 2's timed input or mash exists.
- **The dash grants no invulnerability frames.** Pinned by a test.

### Invariants a retune can break silently

Most are pinned by tests and will fail the suite. These three are the traps.

1. **The close band's width comes from `EDGE − HYSTERESIS`, not `EDGE`.** The
   fish cannot be made deeper unless the close band's `maxDistance` moves with it
   — at the current edge, depth is capped at 117, and deepening *shrinks* the
   close band. Depth 125 pairs with edge 160. See decisions.md 2026-08-20. Now a
   per-fish trap rather than a global one: every fish's bands have to satisfy it
   separately, and the test that pins it reads off `GREY_BOX`.
2. **Swim speed is capped near 47 by the lane width**, not by the pinned
   `swimPerTick < BOAT_SPEED_PER_TICK` inequality, which only holds in an
   unbounded lane. Above that the fish corners a fleeing boat against a wall
   permanently. Also per-fish now: the cap applies to every fish that approaches.
3. **Two load-bearing inequalities have no tests at all:**
   `ATTACK_COOLDOWN_TICKS < LINE_REGEN_DELAY_TICKS` (attacking at full cadence
   must stop the refill entirely — the exchange the fight is built on) and
   `DASH_DURATION_TICKS < LINE_REGEN_DELAY_TICKS`.

### Where the fight lives

`sim/fight.ts` steps everything; `sim/ai/patterns.ts` runs the attacks and
`sim/ai/bands.ts` chooses and repositions; `sim/distance.ts` owns `lineLength`
and `bandFor` with its hysteresis. Per architecture.md section 2, and `sim/`
imports nothing from Phaser.

Since 3.1 none of those four files holds a fish number. They read
`fish.definition`, and what is left in them is the rules: commitment, hysteresis,
one hit per swing, the order a tick resolves in.

The order inside `stepFight` is load bearing and not obvious: the band is read
against the fish's position at the **top** of the tick, because repositioning
needs a band first; the player's damage is then priced against the position the
fish has **just** moved to. Several tests are exact about it.

`stepFight` rebuilds **both** `boat` and `fish` from scratch every tick, so every
new field has to be named there or it vanishes after one tick. Both are guarded
by a test. Ending a fight freezes it completely: `stepFight` guards at the top and
`stepEnding` spreads the state instead of naming fields, which is correct there
precisely because nothing simulates.

### Open findings, none of them started

1. **Nearly closed. One thing left, and it belongs to phase 8.2.** **No visual
   for the attack travelling the line.** The asymmetry until then: both fish
   attacks are telegraphed and its shots are drawn, the player's swing is not —
   only its arrival is. The rest of this finding closed at 2.3 and 2.5. The sim
   field it originally asked for was never needed: the basic attack always deals
   damage when it fires, so "an attack landed" and "resistance dropped" are the
   same event. A refused attack **stays silent**, decided at 2.5, matching the
   dash. Both in decisions.md.
2. **A second attack in the close band**, the structural fix for close camping
   that round 1 could only narrow with numbers. Makes the grey box fish an
   "uncommon" under design.md section 3's rarity ladder, so it needs a design yes.
   **Now pure data**, apart from needing finding 3 first: a second `meleeColumn`
   pattern and a second entry in the close band's list, no engine change.
3. **Weighted attack selection: the list exists, the roll does not.** **Promoted
   by 3.3 to the thing gating content.** design.md section 3 gives each band "a
   small weighted list", so varied attack choice is on-design. Since 3.1 the
   format carries `attacks: [{ patternId, weight }]` and `attackForBand`
   **throws** on more than one entry, so this is a self-announcing gap rather
   than a silent one. What it needs is a source of randomness inside a `sim/`
   that is deterministic on purpose — a seed on `FightState`, advanced per roll,
   so the same seed and inputs replay the same fight. That is the whole task.
   **Until it lands, every fish in the game must be `common`**: design.md
   section 3's uncommon *is* a second attack in a band and its rare *is* two or
   three attacks per band, so both are unbuildable in data, and boss additionally
   needs a `phases` field that architecture.md section 4 sketches and nothing
   implements. It also unblocks finding 2. The boundary that matters and has not
   moved: design.md forbids random **positioning** and permits weighted random
   **attack choice**.
4. **Depth variety beyond two resting stations.** design.md section 3 already
   names "drifts shallow when low on resistance". Phase 3.
5. **`stepFight` reads as six stacked concerns** and names eighteen fields plus a
   list. Splitting the boat and fish halves into two composed functions is the
   obvious move and has been kept out of 1.10 through 1.13 deliberately. Propose
   it as its own task rather than slipping it in.
6. **Shots are drawn without interpolation**, from `driver.current`, because the
   list changes length as they resolve. Judged fine at 1.10 and again at 1.13
   round 2, but they have gone from 1.2 to 2.0 units a tick since that judgement
   was made. Look again if they speed up further.
7. Task **1.2c**: fullscreen zoom reads `3x` where `4x` is expected. **The
   console readings still have not been taken** and the diagnosis cannot start
   without them: `devicePixelRatio`, `innerWidth`, `innerHeight` while in F11.
   Cheapest to grab during any future playtest.
8. `FixedStepDriver` is not generic over an input type; `FightScene` threads
   inputs in through a closure. The phase 7 server will likely want
   `advance(frameMs, inputs)`. Deferred rather than churn eight call sites.
9. **Four architecture.md edits proposed, all waiting on a yes.** Firm tier, do
   not write them unprompted. The first two are from phase 1; the last two are
   3.1 reporting where the built format differs from the section 4 sketch, which
   that section says is "to be firmed up in phase 3".
   - Section 2 does not list `sim/loop.ts`, which exists.
   - Its `step(state, inputs, dt)` sketch should drop the `dt`, since one call is
     exactly one tick.
   - Section 4's bands carry `minDistance, maxDistance`; the built format carries
     `maxDistance` only, because the previous band's end already is the next
     one's start and two copies of one boundary can disagree.
   - Section 4's patterns have no `behaviour` field, and it is the field the
     whole "adding a fish is never an engine change" claim rests on. The sketch's
     `hitbox` is also not general enough to cover a volley, which has a shot
     width, a count, an interval and two rates instead.
10. `npm run format` reformats `docs/design.md` and `CLAUDE.md`, repadding their
    markdown tables. Whitespace only, but design.md is Locked tier, so the
    reformat gets reverted by hand each time. A `.prettierignore` covering both
    would settle it. Not done, since it changes tooling config.
11. Phaser pinned at `^3.90.0`; npm `latest` is 4.2.1. Stack decision not made.

### Testing notes worth keeping

- `tests/fight.test.ts` has a `quietFish()` helper that seeds a cooldown the fish
  will not finish. Use it for anything measuring the boat's own resources. It
  silences **attacking** only: a quiet fish still repositions.
- **Tests that walk the boat rightwards walk it into the hitbox.** The boat
  starts at 240 and the fish at 340. If a test needs the boat far from the fish
  for a long run, **send it left**.
- Tests build boats and fish by spreading a real `createFightState()`, and input
  literals by spreading `noInputs()`, so growing either type does not break them.
- The pool is fractional, so tests on it need `toBeCloseTo`, and how much was
  spent cannot be read off the final pool. Use the `lowestLine` helper.
- The suite derives from named data rather than hard-coding ticks, which is why
  all 198 tests survived `GAME_PACE` with no edits and why 3.1 changed imports
  rather than assertions. Since 3.1 the fish half of that data is read off
  `GREY_BOX` and its patterns rather than off `config.ts`. Keep it that way.
- **`tests/fight.test.ts` has a `DUMMY` fish**, a synthetic definition whose every
  number is unlike the grey box fish's. It is the fixture that catches a value
  which quietly stayed hard-coded: such a value shows up as the grey box fish's
  number appearing in a fight it is not in. It is not one of 3.3's three fish and
  did not become redundant when they landed: they are all legal, and the point of
  this one is that it is not. It is **not** in `ALL_FISH` and must not be: `tests/fish.test.ts` validates the
  registry, and a fixture chosen to be strange is not a fish that has to be legal.
- **A validation test that cannot fail is worth nothing.** Every rule in
  `tests/fish.test.ts` was checked by dropping a deliberately broken fish into
  `data/fish/`, watching it fail, and deleting it. Do the same for any rule added
  there — several of these rules pass vacuously against a single well-formed fish,
  which is exactly the state the suite is in most of the time.

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
- [x] **1.13 Tuning pass.** Two rounds: difficulty, then a global pace control.
      Closed 2026-08-20 **without** the twenty-fight exit test below, which is
      Badr's deliberate call and is recorded in decisions.md.

**Phase 1 exit test:** play twenty losses in a row and watch your own reaction.
Annoyed at yourself means the fight works. Annoyed at the game means telegraphs
are too short or too vague. Bored means the numbers are wrong. Fix with numbers
before touching anything else.

---

## Phase 2: game feel, still rectangles

Roughly doubles how good it feels. Doing it before art is deliberate: it shows
honestly how much of the feel comes from mechanics.

- [—] **2.1 Hit stop. Built, played and cut 2026-08-20.** At grey box fidelity
      the freeze read as a stutter: nothing on screen has motion worth stopping.
      Deferred to after there are animations to freeze, which is phase 8 or the
      small art pass that may be pulled forward after phase 3. **Do not
      re-implement without asking.** See decisions.md, which also keeps the two
      findings worth reusing.
- [x] **2.2 Screen shake.** Short, sharp, decaying, scaled to damage. Closed
      2026-08-20 at 1 to 2 units over 8 frames, both sides' hits shaking. Values
      and the two playtest rounds behind them are in decisions.md.
- [x] **2.3 Hit flash.** Struck sprite pure white for 2 frames. Closed
      2026-08-20, taken literally from design.md and unscaled by damage. Needed
      no sim change: see open finding 1 below.
- [x] **2.4 Core sounds.** Three or four: attack, hit, fish attack, loss. Closed
      2026-08-20 as four synthesised placeholders behind a swap seam, no assets
      and no new dependencies. Badr intends to outsource real audio later.
- [x] **2.5 Feel tuning pass.** Closed 2026-08-20 having **changed no numbers**:
      every `SHAKE_*`, `HIT_FLASH_FRAMES`, the four `SOUND_*` rows and
      `SOUND_MASTER_GAIN` were played and kept. Added the cue audition panel and
      settled that a refused attack stays silent. See decisions.md, which also
      records the one caveat: audio and visuals were judged in one sitting rather
      than the two rounds planned.

**Phase 2 is closed.** Two of the three effects design.md section 6 asks for
shipped; hit stop was cut at its playtest gate and is deferred to phase 8.

2.1's cut put the whole phase in question, since all three effects rest on the
same feel-before-art bet. Badr's call is that it does not generalise: freezing
motion is the one effect that needs motion, and shake and flash both work on flat
rectangles. Recorded in decisions.md. The precedent is that failing the playtest
gate defers **that effect**, not the phase.

_Context for all of phase 2: design.md section 6._

---

## Phase 3: prove the content template

- [x] **3.1 Extract the fish to a data file.** Bars, attacks, timings, damage,
      bands. Engine reads the definition. Closed 2026-08-21 having changed no
      numbers. Format and its three decisions in decisions.md; the summary is in
      "The fish format" at the top of this file.
- [x] **3.2 Fish validation test.** Assert every fish has both a close punisher
      and a far punisher. Closed 2026-08-21. Added `data/fish/index.ts` as the
      registry and `tests/fish.test.ts`, which checks the coverage rule over
      **reachable** patterns plus six other rules a data-only fish could break.
      Every one of them was proved to fail against a deliberately broken fish
      before the batch closed.
- [x] **3.3 Add fish two, three and four by data only.** Closed 2026-08-21. It
      did **not** need an engine edit: three files and one registry line, no new
      field, no third `behaviour`, no `sim/` change. Added the fish picker so the
      three could be played at all. The finding is that the rarity ladder stops
      at common until open finding 3 lands — see below and decisions.md.
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
