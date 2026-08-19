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
