# Patterns

**Tier: Fluid.** Edit freely.

Conventions this codebase has actually settled into. Not aspirations, not
general best practice, only things proven here.

## Rules for this file

- A pattern is promoted here after it has been used **three times**. Once is a
  choice, three is a convention. Do not add a pattern on first sight.
- If Badr corrects the same thing **twice**, that is a documentation gap by
  definition. Fix it here, not just in the code.
- **Hard cap: 150 lines.** At the cap, consolidate and delete rather than
  append. Files that only ever grow stop being read carefully, including by
  Badr.
- Propose additions at the end of a batch and show them before writing.

---

## Established patterns

### Take a `Pick<>` of what you read, return a patch

A function inside `sim/` that works on part of the state takes a `Pick<>` of
exactly the fields it reads, never the whole object, and returns a patch that
spreads into it. Callers can then pass values they have already resolved this
tick instead of building a state around them, and the signature says what the
function actually depends on.

```ts
export function stepProjectiles(
  projectiles: readonly ProjectileState[],
  boatX: number,
): ProjectileStepResult;

const shots = stepProjectiles(state.projectiles, x); // x, not state.boat.x
```

The boat x above is the one this tick has already produced, which is the point:
`stepFight` resolves movement first, so a dash that carried the boat out of a
hitbox this tick has carried it out. A function taking `FightState` could only
see where the boat started.

### Author the number in the unit you reason in, derive the rest

A tuned quantity is written **once**, in the unit it is actually argued about
while tuning, and every other form is computed from it. Never store the same fact
twice, because the two copies will disagree eventually and nothing will catch it.

```ts
export const BOAT_SPEED_PER_SECOND = atPace(90); // argued about per second
export const BOAT_SPEED_PER_TICK = BOAT_SPEED_PER_SECOND / TICK_HZ;

export const DASH_DISTANCE = 55; // a dash is judged as distance and duration
export const DASH_DURATION_TICKS = ticksAtPace(14);
export const DASH_SPEED_PER_TICK = DASH_DISTANCE / DASH_DURATION_TICKS;
```

Which unit is the authored one is a real choice, not a default. Speeds are per
second because that is how they get reasoned about; telegraph durations are in
ticks because the question is "how many frames does the player have to read
this", and routing that through a rate would only obscure it.

Used by `BOAT_SPEED_PER_TICK`, `LINE_REGEN_PER_TICK`, `DASH_SPEED_PER_TICK`,
`FISH_FAR_ACTIVE_TICKS`, the four fish per-tick rates, `CLOSE_PUNISHER_REACH` in
`sim/ai/patterns.ts`, `CURVE_CONSTANT` in `sim/damage.ts`, and `GAME_PACE`'s
`atPace` / `ticksAtPace`.

The corollary is that a derived value is **never** promoted to a tunable to make
it easier to adjust. `CLOSE_PUNISHER_REACH` is half the hitbox plus half the
hull; turning it into a third number would let it drift away from the box the
renderer draws, and the drawing would become a lie.

Used in: `sim/distance.ts` (`lineLength`), `sim/ai/patterns.ts`
(`stepFishAttack`, `stepProjectiles`), `sim/ai/bands.ts` (`stepReposition`)

---

## Anti-patterns

Approaches tried in this codebase and abandoned. Record what actually broke,
not the general principle.

### Scaling a random number by an amplitude, then rounding to whole pixels

Used for the screen shake's per-frame camera offset: `round(random * amplitude)`.
At amplitudes below one unit `Math.round` collapses most frames to zero, so the
lightest hits shook only about a third of the time while heavy ones looked fine.
`SHAKE_MIN_AMPLITUDE` existed to guarantee every hit registers and the rounding
was silently discarding it.

Invisible to the tests, which asserted the offset stayed *within* the amplitude
and were all passing. Found in play, at max distance from the fish.

Replaced with `max(1, round(amplitude))`, the randomness choosing direction only,
and the offset emitted before the frame's decay rather than after.

Generalises to anything drawn on the pixel grid, which is everything: **when a
floor exists to guarantee something is visible, apply it after the rounding, not
before.**

<!-- Format:

### What was tried

What went wrong specifically. What replaced it.
-->
