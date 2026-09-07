import { describe, it, expect } from 'vitest';
import { basicAttackDamage, heavyAttackDamage } from '../src/sim/damage.ts';
import {
  ATTACK_DAMAGE_MAX,
  ATTACK_DAMAGE_MIN,
  ATTACK_FULL_DAMAGE_RANGE,
  HEAVY_DAMAGE_MULTIPLIER,
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

describe('heavyAttackDamage: the same curve, scaled', () => {
  it('scales both anchors, not just the ceiling', () => {
    // "A heavy is three basics" has to be true at the floor as well as at full
    // range, or the two attacks converge as the boat backs off and the heavy
    // silently stops being worth its cost at exactly the distance it is most
    // tempting to use it from.
    expect(heavyAttackDamage(ATTACK_FULL_DAMAGE_RANGE)).toBe(
      ATTACK_DAMAGE_MAX * HEAVY_DAMAGE_MULTIPLIER,
    );
    expect(heavyAttackDamage(10_000)).toBe(
      ATTACK_DAMAGE_MIN * HEAVY_DAMAGE_MULTIPLIER,
    );
  });

  it('caps inside the full-damage range rather than spiking', () => {
    expect(heavyAttackDamage(1)).toBe(
      ATTACK_DAMAGE_MAX * HEAVY_DAMAGE_MULTIPLIER,
    );
  });

  it('beats the basic at every distance the lane can produce', () => {
    // The reason to accept the wind-up. If there is any range at which the basic
    // is as good, the heavy is a trap at that range rather than a choice.
    for (let length = 1; length <= INTERNAL_WIDTH * 2; length++) {
      expect(heavyAttackDamage(length)).toBeGreaterThan(
        basicAttackDamage(length),
      );
    }
  });

  it('keeps the inverse shape it inherited', () => {
    const near = heavyAttackDamage(ATTACK_FULL_DAMAGE_RANGE);
    const far = heavyAttackDamage(ATTACK_FULL_DAMAGE_RANGE * 2);

    expect(far).toBe(near / 2);
  });

  it('deals whole numbers', () => {
    for (let length = 1; length <= INTERNAL_WIDTH * 2; length++) {
      expect(Number.isInteger(heavyAttackDamage(length))).toBe(true);
    }
  });
});
