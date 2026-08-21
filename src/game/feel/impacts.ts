/**
 * Noticing that something got hurt. Pure TypeScript, no Phaser.
 *
 * The feel effects all need the same fact and `sim/` does not currently record
 * it: something took damage, this much, and it was the boat or the fish. Rather
 * than add a field to FightState for it, this watches the two pools that lose
 * value and reports the drops.
 *
 * That works because hull and resistance are the only two damage sinks in the
 * fight and nothing heals either of them, so a drop is an impact and its size is
 * the damage. It is also exactly the information the effects want: the shake is
 * scaled by damage, and task 2.3's flash needs to know which rectangle was
 * struck.
 *
 * What it deliberately does **not** do is close roadmap open finding 1. That is
 * about drawing the player's attack, which needs to know where and when a swing
 * happened rather than only that resistance fell, and it genuinely does need a
 * sim field. This is the smaller question and the smaller answer.
 */

import type { FightState } from '../../sim/state.ts';

/** Which rectangle took it. Task 2.3 is what flashes them. */
export type ImpactTarget = 'boat' | 'fish';

export interface Impact {
  target: ImpactTarget;
  /** How much was taken off, in the same units as the pool it came out of. */
  damage: number;
}

/**
 * Remembers the two pools and reports what has come off them since last asked.
 *
 * It holds its own copy rather than reading `FixedStepDriver.previous`, and that
 * is the whole reason it is a class. `previous` is the state one tick back, but
 * a slow frame runs several ticks at once, so a hit landed on the first of them
 * would already be in both `previous` and `current` by the time the frame is
 * drawn and would vanish. Comparing against the last value this actually saw
 * cannot miss one however many ticks went past.
 *
 * The cost is that several ticks' damage inside one frame arrives merged, as a
 * single larger impact. That is the right shape for every effect here: they are
 * durations and intensities, not a count of hits.
 */
export class ImpactWatcher {
  private hull: number;
  private resistance: number;

  constructor(state: FightState) {
    this.hull = state.boat.hull;
    this.resistance = state.fish.resistance;
  }

  /**
   * What has been taken off either pool since the last call.
   *
   * Both can be in the list at once, and regularly are: `stepFight` charges the
   * player's attack against resistance and the fish's attack against the hull in
   * the same tick, so trading blows produces two impacts.
   *
   * Only drops count. Nothing in the fight heals, so an increase can only be a
   * fight that has been swapped underneath the watcher, and reporting a refilled
   * hull as an impact would open the next fight with a jolt. A restart builds a
   * new watcher rather than relying on that, the same way it builds a new driver.
   */
  sample(state: FightState): Impact[] {
    const impacts: Impact[] = [];

    const hullLost = this.hull - state.boat.hull;
    if (hullLost > 0) {
      impacts.push({ target: 'boat', damage: hullLost });
    }

    const resistanceLost = this.resistance - state.fish.resistance;
    if (resistanceLost > 0) {
      impacts.push({ target: 'fish', damage: resistanceLost });
    }

    this.hull = state.boat.hull;
    this.resistance = state.fish.resistance;

    return impacts;
  }
}
