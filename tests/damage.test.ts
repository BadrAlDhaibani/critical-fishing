import { describe, it, expect } from 'vitest';
import { basicAttackDamage } from '../src/sim/damage.ts';
import {
  ATTACK_DAMAGE_MAX,
  ATTACK_DAMAGE_MIN,
  ATTACK_FULL_DAMAGE_RANGE,
  INTERNAL_WIDTH,
} from '../src/data/config.ts';

describe('basicAttackDamage: the anchors', () => {
  it('deals full damage at the full-damage range', () => {
    expect(basicAttackDamage(ATTACK_FULL_DAMAGE_RANGE)).toBe(ATTACK_DAMAGE_MAX);
  });

  // The fish can come shallower than the full-damage range once the AI owns
  // depth at 1.11, and an uncapped k/length would spike towards infinity there.
  it('caps inside the full-damage range rather than spiking', () => {
    expect(basicAttackDamage(ATTACK_FULL_DAMAGE_RANGE / 2)).toBe(
      ATTACK_DAMAGE_MAX,
    );
    expect(basicAttackDamage(1)).toBe(ATTACK_DAMAGE_MAX);
  });

  it('floors rather than fading to nothing at absurd distances', () => {
    expect(basicAttackDamage(10_000)).toBe(ATTACK_DAMAGE_MIN);
  });
});

describe('basicAttackDamage: the curve', () => {
  // design.md section 2: damage scales inversely with line length. Doubling the
  // distance halves the hit, which is what makes a sidestep cost something.
  it('halves when the distance doubles, where it is unclamped', () => {
    const near = basicAttackDamage(ATTACK_FULL_DAMAGE_RANGE);
    const far = basicAttackDamage(ATTACK_FULL_DAMAGE_RANGE * 2);

    expect(far).toBe(near / 2);
  });

  it('never rewards being further away', () => {
    // A unit at a time across every distance the lane can produce, and well
    // past it, so the clamps at both ends are swept too.
    let previous = basicAttackDamage(1);

    for (let length = 2; length <= INTERNAL_WIDTH * 2; length++) {
      const damage = basicAttackDamage(length);

      expect(damage).toBeLessThanOrEqual(previous);
      previous = damage;
    }
  });

  it('stays inside the floor and the ceiling at every distance', () => {
    for (let length = 1; length <= INTERNAL_WIDTH * 2; length++) {
      const damage = basicAttackDamage(length);

      expect(damage).toBeGreaterThanOrEqual(ATTACK_DAMAGE_MIN);
      expect(damage).toBeLessThanOrEqual(ATTACK_DAMAGE_MAX);
    }
  });

  // Rounded in the curve rather than at the call site, so the readout, the
  // resistance dealt and the tuning pass are all reasoning about one number.
  it('deals whole numbers', () => {
    for (let length = 1; length <= INTERNAL_WIDTH * 2; length++) {
      expect(Number.isInteger(basicAttackDamage(length))).toBe(true);
    }
  });
});
