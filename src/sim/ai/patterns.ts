/**
 * Fish attack patterns: wind-up, active, recovery. Pure TypeScript, no Phaser.
 *
 * architecture.md section 2 puts attack execution here. Everything in this file
 * is currently hard-coded patterns for one grey box fish, deliberately. Task 3.1
 * is what turns fish into data files, and writing that definition format now
 * would be building ahead of the roadmap. The field names below are chosen to
 * match the sketch in architecture.md section 4 so that extraction is a move
 * rather than a rewrite.
 *
 * Durations count in ticks, like everything else in sim/. One call to
 * `stepFishAttack` is exactly one tick.
 */

import {
  BOAT_WIDTH,
  FISH_CLOSE_ACTIVE_TICKS,
  FISH_CLOSE_COOLDOWN_TICKS,
  FISH_CLOSE_HITBOX_WIDTH,
  FISH_CLOSE_HULL_DAMAGE,
  FISH_CLOSE_RECOVERY_TICKS,
  FISH_CLOSE_WINDUP_TICKS,
  FISH_FAR_ACTIVE_TICKS,
  FISH_FAR_COOLDOWN_TICKS,
  FISH_FAR_HULL_DAMAGE,
  FISH_FAR_RECOVERY_TICKS,
  FISH_FAR_RISE_PER_TICK,
  FISH_FAR_SHOT_INTERVAL_TICKS,
  FISH_FAR_SHOT_WIDTH,
  FISH_FAR_TRACK_PER_TICK,
  FISH_FAR_WINDUP_TICKS,
} from '../../data/config.ts';
import type { FishAttackKind, FishState, ProjectileState } from '../state.ts';

/**
 * How far the boat's centre can be from the fish's and still be caught, in
 * internal-resolution units.
 *
 * Half the hitbox plus half the hull, because the box catches the boat if they
 * overlap at all rather than only if the boat's centre is inside it. Derived
 * rather than tuned: it follows from the two widths, and a third number here
 * could disagree with them.
 */
export const CLOSE_PUNISHER_REACH =
  FISH_CLOSE_HITBOX_WIDTH / 2 + BOAT_WIDTH / 2;

/**
 * The same thing for one shot from the far punisher's volley, derived the same
 * way and for the same reason. 17 units, which is 11 ticks of walking.
 */
export const FAR_SHOT_REACH = FISH_FAR_SHOT_WIDTH / 2 + BOAT_WIDTH / 2;

/**
 * Whether the close punisher would catch a boat at `boatX` right now.
 *
 * Strict, so a boat sitting exactly `CLOSE_PUNISHER_REACH` away is flush with
 * the edge of the box and clear of it. The box is drawn at exactly this width,
 * so a hit at the boundary would land a quarter of the hull on a boat the player
 * can see is outside the telegraph.
 *
 * The same predicate decides both whether the attack connects and whether the
 * fish commits to one at all. That is deliberate: it means "in range" and
 * "hit" cannot drift apart into two numbers, and the telegraph appearing is
 * always the consequence of standing somewhere the attack reaches.
 */
export function closePunisherHits(fishX: number, boatX: number): boolean {
  return Math.abs(boatX - fishX) < CLOSE_PUNISHER_REACH;
}

/**
 * Whether the fish answers a boat at `boatX` with the far punisher instead.
 *
 * The exact negation of `closePunisherHits`, written out rather than left
 * implied by an `else`, because the mirror is the whole reason there is no
 * attack selection code yet. The two triggers cover the lane between them and
 * overlap nowhere, so the fish always has exactly one answer to where the player
 * is standing and nothing has to choose. Task 1.11 replaces both with distance
 * bands; until then this invents no second range number to be tuned.
 */
export function farPunisherFires(fishX: number, boatX: number): boolean {
  return !closePunisherHits(fishX, boatX);
}

/** How long each phase of one attack lasts, and the gap it leaves behind it. */
interface AttackTimings {
  windUp: number;
  active: number;
  recovery: number;
  cooldown: number;
}

/**
 * The two attacks' timings, so the phase machine below can be written once
 * rather than once per attack.
 *
 * A local constant, not a fish definition. There are no ids, no weights and no
 * `punishes` here: fish become data at task 3.1 and inventing the format now
 * would be building ahead of the roadmap. It lines up with the architecture.md
 * section 4 sketch because that is what the sketch is for.
 */
const TIMINGS: Record<FishAttackKind, AttackTimings> = {
  close: {
    windUp: FISH_CLOSE_WINDUP_TICKS,
    active: FISH_CLOSE_ACTIVE_TICKS,
    recovery: FISH_CLOSE_RECOVERY_TICKS,
    cooldown: FISH_CLOSE_COOLDOWN_TICKS,
  },
  far: {
    windUp: FISH_FAR_WINDUP_TICKS,
    active: FISH_FAR_ACTIVE_TICKS,
    recovery: FISH_FAR_RECOVERY_TICKS,
    cooldown: FISH_FAR_COOLDOWN_TICKS,
  },
};

/**
 * How many ticks a shot fired from `depth` spends climbing to the surface.
 *
 * The flight time is a consequence of the depth rather than a number of its own,
 * so once the AI owns depth at task 1.11 a fish that dives telegraphs further
 * ahead and one that surfaces gives barely any notice, for free.
 */
export function shotFlightTicks(depth: number): number {
  return Math.max(1, Math.ceil(depth / FISH_FAR_RISE_PER_TICK));
}

/**
 * One shot, thrown from the fish at where the boat is standing right now.
 *
 * The lob is the distance to cover divided by the time it has to cover it in, so
 * a shot left alone lands exactly where the boat was when it was fired, whether
 * that is ten units away or the whole lane. What the player does during the
 * flight is what decides whether it connects.
 */
function lob(fishX: number, depth: number, boatX: number): ProjectileState {
  return {
    x: fishX,
    depth,
    vx: (boatX - fishX) / shotFlightTicks(depth),
  };
}

/** The attack fields `stepFishAttack` reads and returns. */
type AttackFields = Pick<
  FishState,
  | 'attackPhase'
  | 'attackKind'
  | 'attackPhaseTicksRemaining'
  | 'attackCooldownRemaining'
  | 'attackHasHit'
>;

/**
 * The new attack fields, plus what the attack owes the hull this tick and any
 * shots it just fired.
 *
 * `hullDamage` is 0 on every tick but the one a close punisher connects on.
 * Applying it is `stepFight`'s job: this module knows what the fish did, not
 * what the boat is made of, and a pattern that reached into the hull directly
 * could not be reused by a fish that hits two boats at once in phase 7.
 *
 * `spawned` is empty except on the ticks a volley actually fires, and the shots
 * in it belong to the fight rather than to the fish, so `stepFight` is what puts
 * them somewhere.
 */
export interface FishAttackResult extends AttackFields {
  hullDamage: number;
  spawned: ProjectileState[];
}

/**
 * Advance whichever attack the fish is running by exactly one tick.
 *
 * Takes only the fields it reads rather than a whole `FishState`, the same way
 * `sim/distance.ts` does, so `stepFight` can hand it the boat x it has already
 * resolved for this tick. Returns a patch that spreads straight into the fish.
 */
export function stepFishAttack(
  fish: Pick<FishState, 'x' | 'depth'> & AttackFields,
  boatX: number,
): FishAttackResult {
  if (fish.attackPhase === 'idle') {
    // Counted down before the range check, so a cooldown expiring this tick
    // does not cost the player a free tick of standing in the danger zone.
    // Same ordering as the boat's own attack cooldown in sim/fight.ts.
    const attackCooldownRemaining = Math.max(
      0,
      fish.attackCooldownRemaining - 1,
    );

    if (attackCooldownRemaining === 0) {
      // Where the boat is standing is the whole of the decision. The two
      // triggers are exact opposites, so the fish is never left with nothing to
      // answer with and no tie ever has to be broken.
      const kind: FishAttackKind = farPunisherFires(fish.x, boatX)
        ? 'far'
        : 'close';

      return {
        attackPhase: 'windUp',
        attackKind: kind,
        attackPhaseTicksRemaining: TIMINGS[kind].windUp,
        attackCooldownRemaining: 0,
        attackHasHit: false,
        hullDamage: 0,
        spawned: [],
      };
    }

    return {
      attackPhase: 'idle',
      attackKind: null,
      attackPhaseTicksRemaining: 0,
      attackCooldownRemaining,
      attackHasHit: false,
      hullDamage: 0,
      spawned: [],
    };
  }

  // Every phase but idle belongs to an attack, and the two fields are only ever
  // written together. Asserted rather than defaulted: falling back to one
  // attack's timings would be a fish quietly doing the wrong thing for a second
  // and a half, which is far harder to notice than a thrown error.
  const kind = fish.attackKind;
  if (kind === null) {
    throw new Error(`fish is in ${fish.attackPhase} with no attack kind`);
  }
  const timings = TIMINGS[kind];

  switch (fish.attackPhase) {
    case 'windUp': {
      // Nothing in this branch looks at the boat, and nothing in it may. Once
      // the telegraph starts the attack happens, wherever the player goes.
      // design.md section 3 calls this non-negotiable, and it is the same
      // commitment the dash was built to mirror.
      const ticks = fish.attackPhaseTicksRemaining - 1;

      if (ticks > 0) {
        return {
          attackPhase: 'windUp',
          attackKind: kind,
          attackPhaseTicksRemaining: ticks,
          attackCooldownRemaining: 0,
          attackHasHit: false,
          hullDamage: 0,
          spawned: [],
        };
      }

      return {
        attackPhase: 'active',
        attackKind: kind,
        attackPhaseTicksRemaining: timings.active,
        attackCooldownRemaining: 0,
        // Cleared here rather than when the swing ends, so the flag is set by
        // the thing that opens a new hitbox.
        attackHasHit: false,
        hullDamage: 0,
        spawned: [],
      };
    }

    case 'active': {
      const ticks = fish.attackPhaseTicksRemaining - 1;
      const phase: AttackFields = {
        attackPhase: ticks > 0 ? 'active' : 'recovery',
        attackKind: kind,
        attackPhaseTicksRemaining: ticks > 0 ? ticks : timings.recovery,
        attackCooldownRemaining: 0,
        attackHasHit: fish.attackHasHit,
      };

      if (kind === 'close') {
        // Tested every tick the box is open rather than once as it opens, so a
        // boat that dashes into a hitbox it can see is solid on screen is hit by
        // it. `attackHasHit` is what keeps that to one hit per swing.
        const connects = !fish.attackHasHit && closePunisherHits(fish.x, boatX);

        return {
          ...phase,
          attackHasHit: fish.attackHasHit || connects,
          hullDamage: connects ? FISH_CLOSE_HULL_DAMAGE : 0,
          spawned: [],
        };
      }

      // One shot on the first active tick and one every interval after it. The
      // cadence is read off the counter the phase already keeps rather than from
      // a shots-remaining field, so the volley cannot end up out of step with
      // the duration it was sized to fit inside.
      const elapsed = timings.active - fish.attackPhaseTicksRemaining;
      const firing = elapsed % FISH_FAR_SHOT_INTERVAL_TICKS === 0;

      return {
        ...phase,
        hullDamage: 0,
        // Fired from the fish itself, and thrown at wherever the boat is
        // standing on the tick it leaves. This is the only moment the far
        // punisher reads the boat, the same way the close punisher only reads it
        // while its hitbox is open: the tell that came before it was committed
        // to blind.
        spawned: firing ? [lob(fish.x, fish.depth, boatX)] : [],
      };
    }

    case 'recovery': {
      const ticks = fish.attackPhaseTicksRemaining - 1;

      if (ticks > 0) {
        return {
          attackPhase: 'recovery',
          attackKind: kind,
          attackPhaseTicksRemaining: ticks,
          attackCooldownRemaining: 0,
          attackHasHit: fish.attackHasHit,
          hullDamage: 0,
          spawned: [],
        };
      }

      return {
        attackPhase: 'idle',
        attackKind: null,
        attackPhaseTicksRemaining: 0,
        // The gap belongs to the attack that just ran, not to the fish, so a
        // volley buys the player longer than a lunge does.
        attackCooldownRemaining: timings.cooldown,
        attackHasHit: false,
        hullDamage: 0,
        spawned: [],
      };
    }
  }
}

/** The shots still in the air, and what the ones that landed owe the hull. */
export interface ProjectileStepResult {
  projectiles: ProjectileState[];
  hullDamage: number;
}

/**
 * Advance every shot in the air by exactly one tick.
 *
 * Same convention as `stepFishAttack` above: it is handed the boat x this tick
 * has already resolved and returns a patch, and it never touches the hull
 * itself.
 *
 * A shot climbs at a constant rate, carries the lob it was thrown with, and
 * corrects towards the boat on top of it by no more than the tracking cap. It
 * resolves at the surface, hit or miss, and is gone either way. Nothing clamps
 * it to the lane, because it is aimed at a boat that is already clamped.
 */
export function stepProjectiles(
  projectiles: readonly ProjectileState[],
  boatX: number,
): ProjectileStepResult {
  const next: ProjectileState[] = [];
  let hullDamage = 0;

  for (const shot of projectiles) {
    const depth = shot.depth - FISH_FAR_RISE_PER_TICK;

    // The correction, and only the correction, is capped. It is well under
    // walking pace, which is what makes the volley something a player answers by
    // reading it and stepping aside rather than by spending a dash on it.
    const towards = boatX - (shot.x + shot.vx);
    const correction = Math.max(
      -FISH_FAR_TRACK_PER_TICK,
      Math.min(FISH_FAR_TRACK_PER_TICK, towards),
    );
    const x = shot.x + shot.vx + correction;

    if (depth > 0) {
      next.push({ x, depth, vx: shot.vx });
      continue;
    }

    // At the surface. It corrected right up to the moment it arrived, so where
    // the boat is standing now is what decides it.
    if (Math.abs(x - boatX) < FAR_SHOT_REACH) {
      hullDamage += FISH_FAR_HULL_DAMAGE;
    }
  }

  return { projectiles: next, hullDamage };
}
