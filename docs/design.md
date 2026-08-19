# Design

**Tier: Locked.** Propose changes, never make them unilaterally.

This document is the "why". It exists so that the fight does not drift.

---

## 1. Concept

A fishing game where every catch is a fight.

You cast into water, hook something, and the game cuts to an encounter. The
view is side-on: your boat sits on the surface, the fish is below, and a line
connects the two. You dodge what the fish throws at you while pulling attacks
down the line into it. When its resistance is gone, you land it.

The tone is not simulation fishing. It is closer to Undertale, Terraria and
Binding of Isaac: pixel art, over the top effects, and fish with personality.
A perch that pulls a tiny sword. A carp in a business suit. The record book
entries should be funny.

The difficulty is deliberately Souls flavoured. Fights are lost to greed and
misreads, not to bad luck, and winning one should feel earned.

### Pillars

These four are the game. Anything that weakens one of them is wrong even if it
is fun in isolation.

1. **Every fish is a fight.** No timing bars, no minigame, no waiting.
2. **Position is the whole decision.** One axis of movement that simultaneously
   controls dodging, damage output, and which attacks the fish uses.
3. **Losing is your fault.** Everything the fish does is telegraphed and
   committed. No random damage, no unavoidable hits, no hidden information.
4. **The line is the identity.** It is the visual and mechanical signature.
   Effects travel along it. No other game looks like this.

---

## 2. The fight

### Player state

- **Hull HP.** Your health. Reaches zero, you lose the fight.
- **Line.** A single contested resource, functionally a stamina bar. It is
  spent by both dashing and attacking, and regenerates over time.
- **Line length.** Derived, not controlled directly. It is the distance between
  your boat and the fish. Being directly above the fish is the shortest line.

### Fish state

- **Resistance.** The fish's health. Reaches zero and you land it.
- **Position.** Horizontal and depth, both driven by its AI, never random.

### Controls

- `A` / `D` move the boat left and right along the surface. This is the only
  movement axis.
- `Shift` + direction is a dash. Costs line. This is the panic button and the
  reason you cannot dodge everything.
- Attack inputs cost line. Ship with exactly one basic and one heavy attack.

That is the entire control scheme. It stays this small on purpose.

### The central tradeoff

Attack damage scales inversely with line length. The shorter the line, the more
damage you deal, so the best damage is directly above the fish.

Directly above the fish is also where its melee moveset reaches.

So moving is never a neutral act. Sidestepping a projectile also lengthens your
line and weakens your next hit. Closing for damage also invites a different and
more dangerous set of attacks. This single coupling is where the Souls feeling
comes from and it must not be diluted.

### Ending a fight

When resistance hits zero, do **not** end instantly. Cut to a short reel-in
sequence: a few seconds of a final run with one timed input or a mash. This is
the payoff beat and the moment the music hard swaps.

### Losing

Losing costs something real:

- The bait is consumed.
- The rod takes durability damage.
- The fish is written into the record book as an escape, with a silhouette and
  an estimated weight rather than a real entry.

"The one that got away, ~40kg, unidentified" is a permanent page in your own
book. That sting is intended.

---

## 3. Fish AI

The fish chooses attacks by **distance band**. Each band holds a small weighted
list of attacks. When the fish finishes an attack it reads the current distance,
picks from that band's list, and repositions if it wants a different band.

Three rules make this feel fair rather than cheap:

1. **Commitment.** Once a wind-up starts, the fish cannot cancel. A player who
   reads the tell is always rewarded. This is non-negotiable.
2. **Hysteresis on band edges.** Otherwise the fish jitters when the player
   stands exactly on a boundary.
3. **No randomised positioning.** Depth and horizontal movement are always
   driven by intent: the fish surfaces after a big attack, rises while winding
   up something slow, drifts shallow when low on resistance. "The fish is
   shallow right now" must read as an earned window, never as luck.

### No safe camping spot

Every fish needs at minimum:

- one attack that punishes being close (a breach or thrash covering the space
  directly above it), and
- one that punishes being far (a slow tracking volley, trivially sidestepped up
  close, hard to read from across the screen).

Without both, the optimal strategy collapses to one position and the movement
axis stops mattering.

### Rarity scaling

Same system throughout, different data:

- **Common:** two bands, one attack each.
- **Uncommon:** two bands, a second attack in one of them, faster tells.
- **Rare:** three bands, two or three attacks each, some overlap so the read is
  less certain.
- **Boss:** the above plus a phase transition that swaps the entire attack
  table at 50% resistance, forcing a relearn mid-fight.

Difficulty comes from more to read, not from bigger numbers.

---

## 4. Co-op boss fights

Every player is tethered to the same fish at once. This is both the funniest
and the most functional version.

- **Aggro is earned, not random.** The fish targets whoever has dealt the most
  damage recently. This produces a tank role with no class system, and lets a
  player deliberately bait aggro so a weaker friend can attack safely.
- **Boat collision pushes, it does not block.** Blocking lets one person wall a
  friend into a projectile. Pushing keeps the shoving funny without enabling
  hard griefing.
- **Scale resistance with player count. Do not scale the attack patterns.**
  More lines on the fish should feel like an advantage. The added difficulty
  comes naturally from four boats sharing one lane.
- **Roles come from equipment, never from classes.** A heavy hull with more HP
  and a slower dash. A light hull with less HP and a cheaper dash. A lure that
  applies stun instead of damage. Nobody picks a class at the start; the role
  emerges from the loadout. This also means progression and roles are the same
  system.
- **Support impact must be visible.** When a stun lands, the other players'
  damage numbers should visibly spike. Support roles die when their
  contribution is invisible.

Boss fish are gated by equipment tier, so gearing up is what unlocks the next
boss.

---

## 5. The loop around the fight

Cast, encounter, fight, reward, record, upgrade.

**Casting must not be a slot machine.** If a cast is "wait, then receive a
random fight", the grind rots by hour three. Pre-cast decisions shift the
encounter table in ways the player can read and learn: bait type, depth, spot,
weather, time of day. A bad fight should be a bad read, not bad luck. That is
the difference between grinding and playing.

Catches are documented in a record book (species, size, date, and for escapes,
a silhouette). Fish are sold for currency or broken down into materials that
upgrade equipment.

Equipment progression modifies fight variables rather than adding systems:

- Stronger line means a bigger stamina pool.
- A better reel means faster regeneration.
- A heavier rod means more damage at a given distance.
- Hull choice trades HP against dash cost and movement speed.

---

## 6. Feel

Feel is a mechanical requirement here, not polish, and it comes **before art**.

Three effects do most of the work and are close to free:

- **Hit stop.** Freeze everything for 3 to 6 frames on a heavy impact. Single
  biggest game feel lever that exists.
- **Screen shake.** Short, sharp, decaying. Scaled to damage dealt.
- **Hit flash.** Render the struck sprite pure white for 2 frames.

Build and tune the fight with coloured rectangles before any art exists.
Effects hide bad timing, and a fight tuned underneath a layer of visual noise
only feels good while the screen is full of noise.

### Art direction

Pixel art, in the neighbourhood of Terraria and Binding of Isaac. Not realism,
not vector, not hand-painted. Chunky, readable, with a lot of visual noise
during effects.

**This has a phase 1 consequence.** The game renders at a fixed low internal
resolution and is scaled up with nearest-neighbour filtering. That internal
resolution is the coordinate space the entire simulation lives in: boat speed,
dash distance, hitbox sizes, distance band edges and every other tuned number
is expressed in those units.

So the internal resolution must be chosen and locked **before** any movement is
implemented, not during the art pass. Changing it later invalidates every value
produced by the phase 1 tuning pass.

Requirements that follow from this:

- One fixed internal resolution, 16:9, chosen so that common displays land on
  or near an integer scale factor.
- Nearest-neighbour filtering, no smoothing. In Phaser this is `pixelArt: true`
  in the game config plus an integer-zoom scale mode.
- The simulation works in internal-resolution units only. Rendering scales; the
  simulation never does.
- Sprites are authored at 1:1 with the internal resolution, never downscaled
  from larger art.

Effects are allowed to break the pixel grid where it genuinely looks better,
particularly the line effects and lighting. That is a per-effect judgement call,
not a blanket rule in either direction, and it should stay rare enough that the
game still reads as pixel art.

### The signature visual

The line is already a path in code, so spawning particles along it is nearly
free. Every effect should travel it:

- Fire crawling from the rod up the line toward the fish.
- Lightning arcing in jagged segments along its length, flickering across the
  water.
- A heavy pull sending a visible shockwave ripple down it.

### Environments

Weather is cheap variety and combinatorial: a colour tint over the scene, a
particle layer, a water surface animation, and an ambient loop. Mixing those
gives dozens of visually distinct sessions from four small pieces. Common
encounters roll weather randomly.

Boss arenas are handmade and fixed. The arena is how the player knows this
fight is different before anything happens. **At most one** boss arena gets
active mechanics (a storm striking a telegraphed spot, for example) as a
showpiece. Giving every boss arena mechanics triples build time.

### Music

Boss themes are written as three or four **layered stems**: same length, same
tempo, all playing at once, with layers faded in as phases change. Drums and
strings in phase one, brass in phase two, choir for the finish. Same song, and
it swells with the fight. Mechanically it is just volume automation.

Use silence as a weapon. Cut the music entirely for a beat when the fish
breaches, hold, then slam the full mix back. Costs nothing.

Music must be original or clearly licensed for commercial use.

---

## 7. Cut and rejected

These were considered and deliberately cut. Do not reintroduce them as helpful
suggestions. If you believe one should return, raise it and wait for a yes.

| Cut | Why |
|---|---|
| Obstacles as a fight mechanic (rocks, kelp, snags affecting the line) | Added randomness to a fight that should be about reading the fish, plus significant implementation cost. They remain as background decoration only. |
| `W`/`S` to control line slack directly | Added a second axis of complexity for the player. Folding line length into horizontal position gets the same tradeoff with one input. |
| Line tension bands and line snapping as a fail state | Superseded. The line became a stamina resource; hull HP is the fail state. |
| Submarines and a depth axis for the player | Turns a one-axis arena into a two-axis one, which complicates attack patterns, collision and netcode all at once. Good v2 feature, explicitly not v1. |
| Elemental effects (fire, electric, poison) in v1 | Three different systems (damage over time, status, burst). Ship one basic and one heavy attack, and let equipment change only the numbers, until the base loop is proven fun. |
| Classes for co-op roles | Roles emerge from equipment instead. Same code path, different numbers. |
| Pure Discord bot game | Cannot do real-time input. Button latency and rate limits make the core mechanic impossible. |
| Pygame standalone client | Distribution friction (downloads per friend) and no Discord integration. |
| Python for the client | No realistic path to a smooth browser action game. |

---

## 8. Open questions

**Do not invent values for these.** Ask Badr. Numbers that get invented end up
in the code and quietly become the design.

- Internal render resolution (needed before task 1.3, see section 6). Likely
  candidates are 480x270, which scales 4x to 1080p, or 320x180, which scales
  6x. Lower means chunkier art and less room for the fight to spread out.
- Exact bar values: hull HP, line pool size, regeneration rate, fish resistance
- Attack wind-up durations, active frames, recovery, cooldowns
- Stamina costs for basic attack, heavy attack, dash
- Dash distance, duration, and whether it grants invulnerability frames
- Distance band edges and hysteresis margin
- The damage-by-distance curve (linear? falls off sharply near max range?)
- Encounter table weights and how bait, depth, spot, weather and time modify them
- Economy: currency, sale values, upgrade costs, material drop rates
- Rod durability: how much a loss costs and how repair works
- Number of players supported in a boss room
- The actual name of the game
