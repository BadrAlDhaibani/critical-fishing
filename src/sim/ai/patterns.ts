/**
 * Fish attack patterns: wind-up, active, recovery. Pure TypeScript, no Phaser.
 *
 * architecture.md section 2 puts attack execution here, and architecture.md
 * section 4 makes a fish data, so the split this file is written along is
 * **behaviour is code, numbers are data**. Nothing below names a duration, a
 * damage or a width; each one comes off the pattern the fish committed to.
 *
 * There are two behaviours, and adding a fish never adds a third. A `meleeColumn`
 * opens a hitbox on the water above the fish for a few ticks. A `volley` throws
 * shots that become entities of their own and outlive the attack. A fish with two
 * melee patterns at different reaches, damages and telegraphs is two entries in
 * its `patterns` list and no change in here. A fish that needs a genuinely new
 * *shape* of attack is the case architecture.md section 4 says to flag rather
 * than work around, and it is a new behaviour plus a branch in this file.
 *
 * Durations count in ticks, like everything else in sim/. One call to
 * `stepFishAttack` is exactly one tick.
 */

import { BOAT_WIDTH } from '../../data/config.ts';
import {
  activeTicksOf,
  patternById,
  volleyPatternById,
} from '../../data/fish/types.ts';
import type {
  FishDefinition,
  MeleeColumnPattern,
  VolleyPattern,
} from '../../data/fish/types.ts';
import type { FishState, ProjectileState } from '../state.ts';
import { attackForBand } from './bands.ts';

/**
 * How far the boat's centre can be from the fish's and still be caught by a
 * melee column, in internal-resolution units.
 *
 * Half the hitbox plus half the hull, because the box catches the boat if they
 * overlap at all rather than only if the boat's centre is inside it. Derived
 * rather than authored on the pattern: it follows from the two widths, and a
 * third number in the data file could disagree with them. Against the grey box
 * fish's 60-wide box it is 42 units.
 */
export function meleeReach(pattern: MeleeColumnPattern): number {
  return pattern.hitboxWidth / 2 + BOAT_WIDTH / 2;
}

/**
 * The same thing for one shot from a volley, derived the same way and for the
 * same reason. 17 units against the grey box fish's 10-wide shot, which is 11
 * ticks of walking.
 */
export function shotReach(pattern: VolleyPattern): number {
  return pattern.shotWidth / 2 + BOAT_WIDTH / 2;
}

/**
 * Whether a melee column would catch a boat at `boatX` right now.
 *
 * Strict, so a boat sitting exactly `meleeReach` away is flush with the edge of
 * the box and clear of it. The box is drawn at exactly the pattern's width, so a
 * hit at the boundary would land a quarter of the hull on a boat the player can
 * see is outside the telegraph.
 *
 * The same predicate decides both whether the attack connects and whether the
 * fish commits to one at all. That is deliberate: it means "in range" and "hit"
 * cannot drift apart into two numbers, and the telegraph appearing is always the
 * consequence of standing somewhere the attack reaches.
 *
 * The distance bands did not replace this. The band picks *which* attack the
 * fish would use; this still picks *whether* a melee one is worth starting. A
 * fish whose band chose a column it cannot reach with commits to nothing and
 * closes the distance instead, which is what `stepReposition` is for.
 */
export function meleeColumnHits(
  pattern: MeleeColumnPattern,
  fishX: number,
  boatX: number,
): boolean {
  return Math.abs(boatX - fishX) < meleeReach(pattern);
}

/**
 * How many ticks a shot fired from `depth` spends climbing to the surface.
 *
 * The flight time is a consequence of the depth rather than a number of its own,
 * so a fish that dives telegraphs further ahead and one that surfaces gives
 * barely any notice, for free.
 */
export function shotFlightTicks(pattern: VolleyPattern, depth: number): number {
  return Math.max(1, Math.ceil(depth / pattern.risePerTick));
}

/**
 * One shot, thrown from the fish at where the boat is standing right now.
 *
 * The lob is the distance to cover divided by the time it has to cover it in, so
 * a shot left alone lands exactly where the boat was when it was fired, whether
 * that is ten units away or the whole lane. What the player does during the
 * flight is what decides whether it connects.
 */
function lob(
  pattern: VolleyPattern,
  fishX: number,
  depth: number,
  boatX: number,
): ProjectileState {
  return {
    x: fishX,
    depth,
    vx: (boatX - fishX) / shotFlightTicks(pattern, depth),
    patternId: pattern.id,
  };
}

/** The attack fields `stepFishAttack` reads and returns. */
type AttackFields = Pick<
  FishState,
  | 'attackPhase'
  | 'attackPatternId'
  | 'attackPhaseTicksRemaining'
  | 'attackCooldownRemaining'
  | 'attackHasHit'
>;

/**
 * The new attack fields, plus what the attack owes the hull this tick and any
 * shots it just fired.
 *
 * `hullDamage` is 0 on every tick but the one a melee column connects on.
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
 * `definition` is one of those fields: it is where every number below comes from.
 */
export function stepFishAttack(
  fish: Pick<FishState, 'x' | 'depth' | 'band' | 'definition'> & AttackFields,
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

    const patternId = attackForBand(fish.definition, fish.band);
    const pattern = patternById(fish.definition, patternId);

    // The band chose the attack; a melee column still gets a say in whether it is
    // worth starting. Its hitbox is usually a good deal narrower than the band
    // around it, so a fish that has just been drawn into a close band often
    // cannot reach yet, and it swims rather than swinging at nothing. A volley
    // has no such test: it is aimed at wherever the boat is and reaches.
    const canCommit =
      pattern.behaviour !== 'meleeColumn' ||
      meleeColumnHits(pattern, fish.x, boatX);

    if (attackCooldownRemaining === 0 && canCommit) {
      return {
        attackPhase: 'windUp',
        attackPatternId: patternId,
        attackPhaseTicksRemaining: pattern.windUpTicks,
        attackCooldownRemaining: 0,
        attackHasHit: false,
        hullDamage: 0,
        spawned: [],
      };
    }

    return {
      attackPhase: 'idle',
      attackPatternId: null,
      attackPhaseTicksRemaining: 0,
      // Held at zero once it has run out rather than reloaded, so a fish waiting
      // for its approach to bring the boat into the box commits on the very tick
      // it arrives instead of paying a second cooldown for having been patient.
      attackCooldownRemaining,
      attackHasHit: false,
      hullDamage: 0,
      spawned: [],
    };
  }

  // Every phase but idle belongs to an attack, and the two fields are only ever
  // written together. Asserted rather than defaulted: falling back to some other
  // pattern's timings would be a fish quietly doing the wrong thing for a second
  // and a half, which is far harder to notice than a thrown error.
  const patternId = fish.attackPatternId;
  if (patternId === null) {
    throw new Error(`fish is in ${fish.attackPhase} with no attack pattern`);
  }
  const pattern = patternById(fish.definition, patternId);

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
          attackPatternId: patternId,
          attackPhaseTicksRemaining: ticks,
          attackCooldownRemaining: 0,
          attackHasHit: false,
          hullDamage: 0,
          spawned: [],
        };
      }

      return {
        attackPhase: 'active',
        attackPatternId: patternId,
        attackPhaseTicksRemaining: activeTicksOf(pattern),
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
        attackPatternId: patternId,
        attackPhaseTicksRemaining: ticks > 0 ? ticks : pattern.recoveryTicks,
        attackCooldownRemaining: 0,
        attackHasHit: fish.attackHasHit,
      };

      if (pattern.behaviour === 'meleeColumn') {
        // Tested every tick the box is open rather than once as it opens, so a
        // boat that dashes into a hitbox it can see is solid on screen is hit by
        // it. `attackHasHit` is what keeps that to one hit per swing.
        const connects =
          !fish.attackHasHit && meleeColumnHits(pattern, fish.x, boatX);

        return {
          ...phase,
          attackHasHit: fish.attackHasHit || connects,
          hullDamage: connects ? pattern.hullDamage : 0,
          spawned: [],
        };
      }

      // One shot on the first active tick and one every interval after it. The
      // cadence is read off the counter the phase already keeps rather than from
      // a shots-remaining field, so the volley cannot end up out of step with
      // the duration it was sized to fit inside.
      const elapsed = activeTicksOf(pattern) - fish.attackPhaseTicksRemaining;
      const firing = elapsed % pattern.shotIntervalTicks === 0;

      return {
        ...phase,
        hullDamage: 0,
        // Fired from the fish itself, and thrown at wherever the boat is
        // standing on the tick it leaves. This is the only moment a volley reads
        // the boat, the same way a melee column only reads it while its hitbox is
        // open: the tell that came before it was committed to blind.
        spawned: firing ? [lob(pattern, fish.x, fish.depth, boatX)] : [],
      };
    }

    case 'recovery': {
      const ticks = fish.attackPhaseTicksRemaining - 1;

      if (ticks > 0) {
        return {
          attackPhase: 'recovery',
          attackPatternId: patternId,
          attackPhaseTicksRemaining: ticks,
          attackCooldownRemaining: 0,
          attackHasHit: fish.attackHasHit,
          hullDamage: 0,
          spawned: [],
        };
      }

      return {
        attackPhase: 'idle',
        attackPatternId: null,
        attackPhaseTicksRemaining: 0,
        // The gap belongs to the attack that just ran, not to the fish, so a
        // volley buys the player longer than a lunge does.
        attackCooldownRemaining: pattern.cooldownTicks,
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
 * itself. It also takes the fish definition, because a shot carries the id of the
 * pattern that fired it rather than a copy of that pattern's numbers, and this is
 * where they are looked back up.
 *
 * A shot climbs at a constant rate, carries the lob it was thrown with, and
 * corrects towards the boat on top of it by no more than its pattern's tracking
 * cap. It resolves at the surface, hit or miss, and is gone either way. Nothing
 * clamps it to the lane, because it is aimed at a boat that is already clamped.
 */
export function stepProjectiles(
  projectiles: readonly ProjectileState[],
  boatX: number,
  fish: FishDefinition,
): ProjectileStepResult {
  const next: ProjectileState[] = [];
  let hullDamage = 0;

  for (const shot of projectiles) {
    // A shot can only have come from a volley, and `volleyPatternById` throws if
    // this one claims otherwise. That is a data fault rather than a game state,
    // so it should surface rather than fly.
    const pattern = volleyPatternById(fish, shot.patternId);
    const depth = shot.depth - pattern.risePerTick;

    // The correction, and only the correction, is capped. It is well under
    // walking pace, which is what makes the volley something a player answers by
    // reading it and stepping aside rather than by spending a dash on it.
    const towards = boatX - (shot.x + shot.vx);
    const correction = Math.max(
      -pattern.trackPerTick,
      Math.min(pattern.trackPerTick, towards),
    );
    const x = shot.x + shot.vx + correction;

    if (depth > 0) {
      next.push({ x, depth, vx: shot.vx, patternId: shot.patternId });
      continue;
    }

    // At the surface. It corrected right up to the moment it arrived, so where
    // the boat is standing now is what decides it.
    if (Math.abs(x - boatX) < shotReach(pattern)) {
      hullDamage += pattern.hullDamage;
    }
  }

  return { projectiles: next, hullDamage };
}
