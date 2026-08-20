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

Used in: `sim/distance.ts` (`lineLength`), `sim/ai/patterns.ts`
(`stepFishAttack`, `stepProjectiles`)

---

## Anti-patterns

Approaches tried in this codebase and abandoned. Record what actually broke,
not the general principle.

Nothing yet.

<!-- Format:

### What was tried

What went wrong specifically. What replaced it.
-->
