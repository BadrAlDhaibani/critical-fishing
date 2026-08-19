# CLAUDE.md

Critical Fishing (working title) is a browser game where fishing is a boss fight.
You cast, hook something, and then fight it: a side-on view of a boat on the
surface tethered by a line to a fish underwater. Difficulty is deliberately
Dark Souls flavoured. Solo play is the grind; co-op boss fish are the payoff.

## Start every session here

1. Read `docs/roadmap.md`. The handoff block at the top tells you the current
   phase, the last completed task, and anything left half done.
2. Work the **next single unchecked task** in the current phase.
3. Read only the docs that task lists under "Context". Do not read the whole
   documentation set for a small feature. If you find you genuinely need more
   context mid-task, read it then.

## Stack

- Client: TypeScript + Phaser 3, bundled with Vite
- Fight simulation: plain TypeScript, no Phaser imports (see architecture.md)
- Server (boss fights only, phase 7): Node + Colyseus
- Persistence (phase 5): Postgres via a REST API
- Auth and social (phase 6): Discord OAuth + a discord.js bot
- Tests: Vitest

## Commands

```
npm run dev      # vite dev server
npm run build    # production build
npm run test     # vitest
npm run lint     # eslint
```

## Working agreement

This is the most important section in this file.

- **One task per batch.** Implement exactly one numbered roadmap task. Then
  stop. Do not chain tasks together because they look related or small.
- **Stop and wait.** After a task builds and its tests pass, report what you
  did and wait for Badr to playtest and confirm before starting anything else.
- **Definition of done** is both gates: automated tests pass, AND Badr has
  played it and said it feels right. Tests alone do not close a task.
- Prefer the smallest change that satisfies the task. Refactoring adjacent
  code is a separate task, so propose it rather than doing it.
- If a task turns out to be bigger than it looked, stop and say so rather than
  expanding scope silently.

## Batches and conversations

A **batch** is one roadmap task, ending in a playtest. A **conversation** can
hold several batches. Do not confuse the two: stopping to wait for a playtest
does not mean the session has to end.

**As the last line of every batch report, say whether to keep going here or
start a new conversation, and why.** Do not wait to be asked. Badr cannot see
how much context is left or which docs you have read, so this call is yours to
make and his to overrule.

Say **start a new one** when any of these is true:

- The next task is in a different phase. Always, no judgement needed.
- The next task's *Context* line points at docs this conversation has not read.
- Three or four batches have already been done here.
- This conversation has been summarised or compacted. Restart from the docs,
  which are curated deliberately, rather than from a summary, which is not.

Say **stay here** when the next task shares a *Context* line with the one just
finished and is a small variation on the same code. 1.5 after 1.4 is the shape
of it: same design.md section, same "draw sim state" problem, nothing to
re-read.

When a new conversation is the call, reread the handoff block before ending and
make sure it is genuinely enough to restart from. It is the only thing that
survives. Anything you know only because you did the work is about to be lost,
so it belongs in `roadmap.md` or `decisions.md` now, not in the report.

## Code conventions

- TypeScript strict mode. No `any`.
- Fight logic lives in `src/sim/` and imports nothing from Phaser. This is a
  hard boundary, because that code moves to the server in phase 7.
- Fight logic runs on a fixed 60 Hz timestep, decoupled from render frame rate.
  Never derive gameplay timing from a render delta.
- Fish are data, not code. A new fish is a new definition file, never an edit
  to the engine. If adding a fish requires an engine change, that is a bug in
  the template, so flag it.
- Tunable numbers (damage, stamina costs, wind-up durations, band edges) live
  in named config, not inline literals.
- See `docs/patterns.md` for conventions the codebase has actually settled on.

## Documentation tiers

Respect these. They exist so a hundred reasonable small suggestions cannot
quietly turn this into a different game.

| Tier | Files | Your edit rights |
|---|---|---|
| Locked | `docs/design.md` | Propose only. Never edit without an explicit yes from Badr. |
| Firm | `docs/architecture.md` | Propose with reasoning. Wait for a yes. |
| Fluid | `docs/roadmap.md`, `docs/patterns.md` | Edit freely as work progresses. |
| Append only | `docs/decisions.md` | Append new entries. Never rewrite or delete existing ones. |

You start each session with no memory of previous ones. The design decisions in
`design.md` were reached through long discussion whose reasoning you cannot see.
Treat them as deliberate even when an alternative looks obviously better, and
check `docs/decisions.md` before proposing a change: it has probably been
considered already.

## When to write to the docs

- A pattern used **three times** gets promoted into `patterns.md`. Once is a
  choice, three is a convention.
- Anything Badr explicitly approves or rejects in conversation gets appended to
  `decisions.md` the same session.
- If Badr corrects you on the same thing **twice**, that is a documentation
  gap. Fix `patterns.md`, not just the code.
- Update the handoff block in `roadmap.md` as the last step of every batch.

Propose doc edits at the end of a batch and show them before writing, so the
docs never diverge from what was actually agreed.

## Hard rules

- Do not implement anything listed under "Cut and rejected" in `design.md`.
- Do not invent values for anything listed under "Open questions" in
  `design.md`. Ask. Invented numbers become the design by accident.
- Do not add dependencies without asking.
- Do not build ahead of the roadmap, even if a later phase would be easy now.
