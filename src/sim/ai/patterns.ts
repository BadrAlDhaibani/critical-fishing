/**
 * Fish attack patterns: wind-up, active, recovery. Pure TypeScript, no Phaser.
 *
 * architecture.md section 2 puts attack execution here. Everything in this file
 * is currently one hard-coded pattern for one grey box fish, deliberately. Task
 * 3.1 is what turns fish into data files, and writing that definition format now
 * would be building ahead of the roadmap. The field names below are chosen to
 * match the sketch in architecture.md section 4 so that extraction is a move
 * rather than a rewrite.
 *
 * Durations count in ticks, like everything else in sim/. One call to
 * `stepClosePunisher` is exactly one tick.
 */

import {
  BOAT_WIDTH,
  FISH_CLOSE_ACTIVE_TICKS,
  FISH_CLOSE_COOLDOWN_TICKS,
  FISH_CLOSE_HITBOX_WIDTH,
  FISH_CLOSE_HULL_DAMAGE,
  FISH_CLOSE_RECOVERY_TICKS,
  FISH_CLOSE_WINDUP_TICKS,
} from '../../data/config.ts';
import type { FishState } from '../state.ts';

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

/** The attack fields `stepClosePunisher` reads and returns. */
type ClosePunisherFields = Pick<
  FishState,
  | 'attackPhase'
  | 'attackPhaseTicksRemaining'
  | 'attackCooldownRemaining'
  | 'attackHasHit'
>;

/**
 * The new attack fields, plus what the swing owes the hull this tick.
 *
 * `hullDamage` is 0 on every tick but the one that connects. Applying it is
 * `stepFight`'s job: this module knows what the fish did, not what the boat is
 * made of, and a pattern that reached into the hull directly could not be
 * reused by a fish that hits two boats at once in phase 7.
 */
export interface ClosePunisherResult extends ClosePunisherFields {
  hullDamage: number;
}

/**
 * Advance the fish's close punisher by exactly one tick.
 *
 * Takes only the fields it reads rather than a whole `FishState`, the same way
 * `sim/distance.ts` does, so `stepFight` can hand it the boat x it has already
 * resolved for this tick. Returns a patch that spreads straight into the fish.
 */
export function stepClosePunisher(
  fish: Pick<FishState, 'x'> & ClosePunisherFields,
  boatX: number,
): ClosePunisherResult {
  switch (fish.attackPhase) {
    case 'idle': {
      // Counted down before the range check, so a cooldown expiring this tick
      // does not cost the player a free tick of standing in the danger zone.
      // Same ordering as the boat's own attack cooldown in sim/fight.ts.
      const attackCooldownRemaining = Math.max(
        0,
        fish.attackCooldownRemaining - 1,
      );

      if (attackCooldownRemaining === 0 && closePunisherHits(fish.x, boatX)) {
        return {
          attackPhase: 'windUp',
          attackPhaseTicksRemaining: FISH_CLOSE_WINDUP_TICKS,
          attackCooldownRemaining: 0,
          attackHasHit: false,
          hullDamage: 0,
        };
      }

      return {
        attackPhase: 'idle',
        attackPhaseTicksRemaining: 0,
        attackCooldownRemaining,
        attackHasHit: false,
        hullDamage: 0,
      };
    }

    case 'windUp': {
      // Nothing in this branch looks at the boat, and nothing in it may. Once
      // the telegraph starts the attack happens, wherever the player goes.
      // design.md section 3 calls this non-negotiable, and it is the same
      // commitment the dash was built to mirror.
      const ticks = fish.attackPhaseTicksRemaining - 1;

      if (ticks > 0) {
        return {
          attackPhase: 'windUp',
          attackPhaseTicksRemaining: ticks,
          attackCooldownRemaining: 0,
          attackHasHit: false,
          hullDamage: 0,
        };
      }

      return {
        attackPhase: 'active',
        attackPhaseTicksRemaining: FISH_CLOSE_ACTIVE_TICKS,
        attackCooldownRemaining: 0,
        // Cleared here rather than when the swing ends, so the flag is set by
        // the thing that opens a new hitbox.
        attackHasHit: false,
        hullDamage: 0,
      };
    }

    case 'active': {
      // Tested every tick the box is open rather than once as it opens, so a
      // boat that dashes into a hitbox it can see is solid on screen is hit by
      // it. `attackHasHit` is what keeps that to one hit per swing.
      const connects = !fish.attackHasHit && closePunisherHits(fish.x, boatX);
      const ticks = fish.attackPhaseTicksRemaining - 1;

      return {
        attackPhase: ticks > 0 ? 'active' : 'recovery',
        attackPhaseTicksRemaining:
          ticks > 0 ? ticks : FISH_CLOSE_RECOVERY_TICKS,
        attackCooldownRemaining: 0,
        attackHasHit: fish.attackHasHit || connects,
        hullDamage: connects ? FISH_CLOSE_HULL_DAMAGE : 0,
      };
    }

    case 'recovery': {
      const ticks = fish.attackPhaseTicksRemaining - 1;

      if (ticks > 0) {
        return {
          attackPhase: 'recovery',
          attackPhaseTicksRemaining: ticks,
          attackCooldownRemaining: 0,
          attackHasHit: fish.attackHasHit,
          hullDamage: 0,
        };
      }

      return {
        attackPhase: 'idle',
        attackPhaseTicksRemaining: 0,
        attackCooldownRemaining: FISH_CLOSE_COOLDOWN_TICKS,
        attackHasHit: false,
        hullDamage: 0,
      };
    }
  }
}
