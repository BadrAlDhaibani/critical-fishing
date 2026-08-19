# Architecture

**Tier: Firm.** Propose changes with reasoning and wait for a yes.

---

## 1. The one rule that matters

**The fight simulation is pure TypeScript with zero Phaser imports.**

Everything else in this document follows from that. In phase 7 the same
simulation code runs on the Colyseus server for co-op boss fights. If it has
picked up a rendering dependency by then, it cannot move, and you end up
maintaining two implementations of the same fight that disagree with each other
in ways that are miserable to debug.

The simulation takes inputs and previous state, and returns new state. It draws
nothing, plays nothing, and reads no globals.

```
                 inputs + state
                       |
                       v
              [ sim ] pure functions
                       |
                       v
                   new state
                  /         \
          [ render ]      [ network ]
           Phaser          Colyseus
```

---

## 2. Layout

```
src/
  sim/                  no Phaser imports, ever
    fight.ts            step(state, inputs, dt) -> state
    state.ts            FightState types
    distance.ts         line length, bands, hysteresis
    damage.ts           damage-by-distance curve
    stamina.ts          line pool, costs, regeneration
    ai/
      bands.ts          band selection and repositioning
      patterns.ts       attack execution, wind-up/active/recovery
  data/
    fish/               one file per fish, data only
    gear/               rods, lines, reels, hulls
    config.ts           tunable constants
  game/                 Phaser lives here and only here
    scenes/
    render/             draws sim state, owns no game logic
    input/              maps keys to sim inputs
    feel/               hit stop, screen shake, hit flash
    audio/
  meta/                 record book, inventory, casting, shop
  net/                  phase 7 only, empty until then
docs/
tests/                  vitest, mostly against sim/
```

Import direction is strictly one way: `game/` may import `sim/`, `sim/` may
never import `game/`. Worth enforcing with an eslint rule once it exists.

---

## 3. Fixed timestep

The simulation advances at a fixed **60 Hz**, accumulated and decoupled from
the render loop.

Never derive gameplay timing from a render delta. If logic is tied to frame
rate, a friend on a 144 Hz monitor plays a different game than one on a 60 Hz
laptop, and every timing tuned during phase 1 is invalidated. Durations are
expressed in ticks, not seconds or frames rendered.

Render interpolates between the last two simulation states.

---

## 4. Fish definitions

A fish is data. Adding a fish must never require an engine change. If it does,
the template is wrong and that is worth flagging immediately rather than
working around.

Shape, to be firmed up in phase 3:

```ts
{
  id, name, rarity, flavourText,
  resistance,
  bands: [
    {
      id,                     // "close" | "mid" | "far"
      minDistance, maxDistance,
      attacks: [{ patternId, weight }],
      repositionBias          // how strongly it seeks this band
    }
  ],
  patterns: [
    {
      id,
      windUpTicks,            // telegraph, cannot be cancelled
      activeTicks,
      recoveryTicks,
      hullDamage,
      hitbox,
      punishes                // "close" | "far", used to validate coverage
    }
  ],
  phases: [ { atResistancePct, bandsOverride } ],   // bosses only
  depthScript                 // intent-driven, never randomised
}
```

A validation test should assert that every fish has at least one pattern with
`punishes: "close"` and one with `punishes: "far"`, per the no-safe-spot rule
in design.md.

---

## 5. Client authority and the server

**Solo fights run entirely in the browser.** No server involved. The client
simulates the fight and POSTs the result. This means the whole single player
game ships before any networking exists, which is most of the game.

**Boss fights run on Colyseus.** One room per fight.

- The server is authoritative for the fish: position, attack selection,
  wind-ups, resistance.
- The client predicts only its own boat position, which is one axis and
  trivially predictable, and reconciles against the server.
- Other players' boats are interpolated, not predicted.
- Server tick 20 to 30 Hz for broadcast; simulation still steps at 60 Hz.

This is co-op PvE, so latency tolerance is high. Rollback is not needed and
should not be built.

Result validation is deliberately light for now, since the player base is a
private friend group. Do not build anti-cheat.

---

## 6. Persistence

Postgres behind a REST API. Broad shape:

- `players` keyed on Discord ID
- `catches` (the record book, including escapes)
- `inventory` and equipped gear
- `progression` (currency, materials, unlocked boss tier)

Phases 1 through 4 use browser storage only. No backend exists until phase 5,
and the meta layer should be written against a storage interface so swapping
localStorage for the API is a single implementation change.

---

## 7. Discord

- **OAuth2** for login, so the project never handles passwords and identity
  maps directly onto the existing friend group.
- **discord.js bot** posts catches and leaderboards into the channel. This is
  disproportionately valuable for morale and should not be deferred past
  phase 6.
- A Discord Activity via the Embedded App SDK is a possible later addition.
  Not planned, not designed for.

---

## 8. Deployment

- Client: static host (Cloudflare Pages or Netlify)
- Game server: Fly.io or Railway. Needs persistent websocket connections, so
  serverless functions are not an option.
- Postgres: Neon, Supabase or Railway

---

## 9. Testing

Because `sim/` is pure functions, the fight is genuinely unit testable, which
is unusual for a game. Vitest coverage should include:

- damage as a function of distance
- stamina costs and regeneration
- band selection, including hysteresis at boundaries
- wind-up commitment (an attack, once started, always resolves)
- state transitions, including the win path into the reel-in sequence
- fish definition validation (close-punisher and far-punisher both present)

Rendering and feel are not unit tested. Those are validated by playtest.
