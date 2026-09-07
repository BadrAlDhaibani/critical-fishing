/**
 * The fight simulation. Pure TypeScript, no Phaser, no globals.
 *
 * architecture.md section 1: this is the code that moves to the Colyseus server
 * in phase 7, so it takes inputs and previous state and returns new state, and
 * does nothing else.
 *
 * That includes its randomness. Since 3.5 the fish rolls its attack out of the
 * band's weighted list, and the seed it rolls with arrives on `FightState` and
 * leaves on the returned one. Nothing in here calls `Math.random`, so a fight is
 * still a pure function of its opening state and its inputs; see `sim/rng.ts`.
 *
 * There is no `dt` parameter. architecture.md section 3 fixes the timestep at
 * 60 Hz, so one call to stepFight is exactly one tick, and every duration in
 * here counts in ticks. A dt argument would only be an invitation to derive
 * gameplay timing from a render delta, which is the one thing that must not
 * happen.
 */

import {
  ATTACK_COOLDOWN_TICKS,
  ATTACK_LINE_COST,
  BOAT_SPEED_PER_TICK,
  BOAT_WIDTH,
  DASH_DURATION_TICKS,
  DASH_LINE_COST,
  DASH_SPEED_PER_TICK,
  HEAVY_COOLDOWN_TICKS,
  HEAVY_LINE_COST,
  HEAVY_WINDUP_TICKS,
  INTERNAL_WIDTH,
  LINE_REGEN_DELAY_TICKS,
  LINE_REGEN_PER_TICK,
  REEL_IN_TICKS,
} from '../data/config.ts';
import { stepReposition } from './ai/bands.ts';
import { stepFishAttack, stepProjectiles } from './ai/patterns.ts';
import { basicAttackDamage, heavyAttackDamage } from './damage.ts';
import { bandFor, lineLength } from './distance.ts';
import type { FightInputs, FightStage, FightState } from './state.ts';

/**
 * Leftmost and rightmost the boat's centre may sit, so the hull never leaves
 * the lane. Derived rather than tuned: they follow from the hull width.
 */
export const BOAT_MIN_X = BOAT_WIDTH / 2;
export const BOAT_MAX_X = INTERNAL_WIDTH - BOAT_WIDTH / 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Advance a fight that is already over by exactly one tick.
 *
 * Everything about the fight is frozen here: the boat does not move, no input is
 * read, the fish does not attack, and shots already in the air neither travel nor
 * resolve. design.md section 2 says the win **cuts** to a reel-in rather than
 * running one alongside the fight, and the same has to be true of the loss: a
 * punisher landing on a boat that has already won, or a killing blow landing on a
 * fish after the hull is gone, would make the outcome a lie about what happened.
 *
 * Spreading the state rather than naming every field is the opposite of what the
 * main body below has to do, and it is right here for the same reason it is wrong
 * there. Nothing simulates in this function, so the ended state is a frozen
 * snapshot of the moment the fight finished, and enumerating `boat` and `fish`
 * again would only create a second place a newly added field could be dropped.
 * Sharing the objects by reference is safe because nothing in sim/ mutates.
 *
 * `tick` keeps counting in every stage. A frozen fight whose clock had also
 * stopped would be indistinguishable from a hung simulation, and the reel-in
 * still has a duration to count out.
 */
function stepEnding(state: FightState): FightState {
  if (state.stage !== 'reelIn') {
    return { ...state, tick: state.tick + 1 };
  }

  const remaining = state.stageTicksRemaining - 1;

  return {
    ...state,
    tick: state.tick + 1,
    stage: remaining > 0 ? 'reelIn' : 'landed',
    stageTicksRemaining: Math.max(0, remaining),
  };
}

/**
 * Advance the fight by exactly one tick.
 *
 * Returns a new state object and never mutates the one passed in. This is not
 * stylistic. FixedStepDriver keeps the previous state by reference so the
 * renderer can interpolate towards the current one; mutating in place would
 * make both names point at the same object, and interpolation would quietly
 * stop working while still looking almost right.
 */
export function stepFight(state: FightState, inputs: FightInputs): FightState {
  // A fight that has ended runs no fight logic at all, so everything below this
  // line can assume there is still a fight to simulate.
  if (state.stage !== 'fighting') {
    return stepEnding(state);
  }

  // Holding both directions cancels to a standstill rather than favouring one
  // of them. Nothing is gained by picking a winner, and a tie that resolves to
  // movement reads as the game ignoring an input.
  const direction = (inputs.moveRight ? 1 : 0) - (inputs.moveLeft ? 1 : 0);

  let { line, dashDirection, dashTicksRemaining } = state.boat;

  // Both counters are decremented before any press is looked at, so a cooldown or
  // a wind-up of exactly one tick is over by the time the next input arrives
  // rather than swallowing it.
  //
  // The attack cooldown is read up here rather than beside the basic attack
  // below, because the heavy shares it and the heavy has to be resolved before
  // the boat moves: whether it is rooted this tick decides what movement even
  // means. The basic still spends it further down, where the damage is priced.
  let attackCooldownRemaining = Math.max(
    0,
    state.boat.attackCooldownRemaining - 1,
  );
  let heavyWindUpRemaining = Math.max(0, state.boat.heavyWindUpRemaining - 1);

  // Whether a heavy was already under way when this tick opened, which is the
  // question the movement below asks. Held separately from the counter because
  // the counter is about to reach zero on the tick the attack lands, and a boat
  // is still rooted on that tick.
  const heavyWasWindingUp = state.boat.heavyWindUpRemaining > 0;

  // A fresh press, the same edge every other action is started on.
  const heavyPressed = inputs.heavy && !state.boat.heavyHeld;

  // Every condition is a silent refusal, like the dash's. Note what is being
  // refused and why: a heavy cannot interrupt another heavy or a dash, because
  // all three are commitments and none of them is an escape from the others, and
  // it cannot be started on a cooldown it shares with the basic attack.
  //
  // `dashTicksRemaining` is still the value the tick opened with here, which is
  // what makes the second check mean "a dash is running". A dash finishing on
  // this tick has already been paid for and will read as zero next tick, so the
  // heavy can follow it immediately.
  const heavyStarted =
    heavyPressed &&
    !heavyWasWindingUp &&
    dashTicksRemaining === 0 &&
    attackCooldownRemaining === 0 &&
    line >= HEAVY_LINE_COST;

  if (heavyStarted) {
    // Charged at the press, not at the landing. The stamina is gone whether or
    // not the attack goes well, and the refill delay starts now rather than in a
    // wind-up's time, so committing is felt immediately.
    line -= HEAVY_LINE_COST;
    attackCooldownRemaining = HEAVY_COOLDOWN_TICKS;
    heavyWindUpRemaining = HEAVY_WINDUP_TICKS;
  }

  // Rooted from the tick of the press rather than the one after it, so the input
  // and the boat stopping are the same frame.
  const rooted = heavyWasWindingUp || heavyStarted;

  // A fresh press, not the key being held. Holding shift would otherwise empty
  // the pool into five back-to-back dashes without another decision being made.
  const dashPressed = inputs.dash && !state.boat.dashHeld;

  // Every condition here is a refusal to start, and all of them are silent. A
  // dash that fired at half price or in no particular direction would be worse
  // than one that does not fire: the pool is the only thing limiting the panic
  // button, so it cannot be part-charged.
  if (
    dashTicksRemaining === 0 &&
    dashPressed &&
    direction !== 0 &&
    // The other half of the mutual refusal above. A dash out of a heavy's
    // wind-up would make the commitment free, and the commitment is the only
    // thing the heavy's damage is priced against.
    !rooted &&
    line >= DASH_LINE_COST
  ) {
    line -= DASH_LINE_COST;
    dashDirection = direction;
    dashTicksRemaining = DASH_DURATION_TICKS;
  }

  let x: number;

  if (dashTicksRemaining > 0) {
    // Steering input is ignored for the whole dash, including a reversal. This
    // is the commitment: the cost is paid up front and the distance is not
    // negotiable afterwards. Walls still clamp, and a dash into one is spent
    // rather than refunded, because the input was made.
    x = clamp(
      state.boat.x + dashDirection * DASH_SPEED_PER_TICK,
      BOAT_MIN_X,
      BOAT_MAX_X,
    );

    dashTicksRemaining -= 1;
    if (dashTicksRemaining === 0) {
      dashDirection = 0;
    }
  } else if (rooted) {
    // The whole of the heavy attack's risk, in one line. Steering is not ignored
    // the way it is during a dash — it is that the boat does not move at all, so
    // a telegraph that starts now has to be eaten. Walls are irrelevant here
    // since nothing moves towards one.
    x = state.boat.x;
  } else {
    x = clamp(
      state.boat.x + direction * BOAT_SPEED_PER_TICK,
      BOAT_MIN_X,
      BOAT_MAX_X,
    );
  }

  // Read against the fish's position at the top of the tick, because the
  // repositioning on the next line is what moves it and it needs the band first.
  // The fish covers well under a unit a tick, so the band and the length the
  // player's damage is priced against can differ by a fraction at most.
  const band = bandFor(
    lineLength({ x }, state.fish),
    state.fish.band,
    state.fish.definition.bands,
  );
  const { x: fishX, depth } = stepReposition({ ...state.fish, band }, x);

  let resistance = state.fish.resistance;

  const attackPressed = inputs.attack && !state.boat.attackHeld;

  // All or nothing, the same as the dash above. A pool that cannot pay the
  // whole cost fires nothing rather than a weaker hit, so the last few points
  // in the bar are a decision about which action to spend them on rather than
  // a fraction of both.
  //
  // Nothing here consults the dash. design.md section 2 makes the shared pool
  // the thing that limits both, and attacking out of a dash is a real choice
  // rather than a free one: it is the stamina that would have bought the next
  // dodge.
  if (
    attackPressed &&
    attackCooldownRemaining === 0 &&
    line >= ATTACK_LINE_COST
  ) {
    line -= ATTACK_LINE_COST;
    attackCooldownRemaining = ATTACK_COOLDOWN_TICKS;

    // Measured from the positions this tick just resolved, on both sides, not
    // the ones the tick opened on, so a hit landed while moving is priced at
    // where the boat actually ends up and the debug readout agrees with what was
    // dealt. The fish having just risen or dived counts for the same reason.
    const damage = basicAttackDamage(lineLength({ x }, { x: fishX, depth }));
    resistance = Math.max(0, resistance - damage);
  }

  // The heavy landing. Nothing is checked here beyond the wind-up having run out,
  // which is what commitment means: the cost was paid at the press, and no
  // condition since then can stop this. There is no affordability test because
  // the pool was already charged, and no cooldown test because the cooldown was
  // loaded at the same moment.
  //
  // Priced at the length this tick resolved, exactly like the basic above, and
  // that is the whole reason to resolve it here rather than at the press. The
  // boat has not moved — it was rooted — but the **fish** has, so a fish that
  // dived away during the wind-up has cost the attack real damage without having
  // had to answer it. design.md section 2's coupling, working on the fish's side
  // of the line for the first time.
  if (heavyWasWindingUp && heavyWindUpRemaining === 0) {
    const damage = heavyAttackDamage(lineLength({ x }, { x: fishX, depth }));
    resistance = Math.max(0, resistance - damage);
  }

  // Any spend at all restarts the delay, read off the pool itself rather than
  // from a flag each action has to remember to set. Both a dash and an attack
  // in the same tick is still one delay, which is correct: it is the pool
  // recovering, not the actions.
  const spent = line < state.boat.line;
  const regenDelayRemaining = spent
    ? LINE_REGEN_DELAY_TICKS
    : Math.max(0, state.boat.regenDelayRemaining - 1);

  if (regenDelayRemaining === 0) {
    line = Math.min(state.boat.lineMax, line + LINE_REGEN_PER_TICK);
  }

  // Stepped against the x this tick just resolved rather than the one it opened
  // on, for the same reason the player's damage is measured from it: a dash that
  // carries the boat out of the hitbox this tick has carried it out.
  //
  // Nothing here consults dashTicksRemaining. The dash grants no invulnerability
  // frames, deliberately: it is 55 units of distance, and escaping the box is
  // done by leaving it rather than by phasing through it. design.md pillar 3
  // stays literal that way, since every hit is then a question of where the boat
  // was standing. A test pins this so it cannot drift back.
  // Shots already in the air first, then the fish, then whatever the fish just
  // fired. A shot spawned this tick appears at the fish and neither moves nor
  // resolves until the next one, so no shot can be fired and land in the same
  // tick however shallow the fish gets once the AI owns depth at task 1.11.
  //
  // The fish is handed the band and the position it has just repositioned to, so
  // an attack committed this tick winds up from where the fish now is rather
  // than from where it was before it moved.
  const shots = stepProjectiles(state.projectiles, x, state.fish.definition);
  const attack = stepFishAttack(
    { ...state.fish, band, x: fishX, depth },
    x,
    state.rngSeed,
  );
  const projectiles = [...shots.projectiles, ...attack.spawned];

  // Both can land in the same tick. That is the volley outliving the attack that
  // fired it, which is the point of it: closing in to punish the recovery means
  // answering the shots still overhead at the same time.
  const hull = Math.max(
    0,
    state.boat.hull - attack.hullDamage - shots.hullDamage,
  );

  // Resistance is asked first, so a tick that empties both bars is a win. That
  // is not generosity, it is the order this function already resolves in: the
  // player's attack was charged against resistance well above, and the fish's
  // damage was applied to the hull two lines ago, so the killing blow genuinely
  // landed first and the ending should say what happened.
  //
  // Both were clamped at zero where they were computed, so `<= 0` and `=== 0`
  // are the same test here. The inequality is the one that stays correct if a
  // future source of damage forgets to clamp.
  const stage: FightStage =
    resistance <= 0 ? 'reelIn' : hull <= 0 ? 'escaped' : 'fighting';

  // Both objects are rebuilt from scratch every tick, so every field has to be
  // named here or it silently disappears one tick into the fight.
  //
  // The fish used to be carried forward by reference, which was only ever safe
  // while nothing wrote to it. The basic attack writes to it.
  return {
    tick: state.tick + 1,
    // Carried back out of the only thing that rolls. Named here like everything
    // else because this object is rebuilt from scratch: a dropped seed would
    // reset the random stream every tick and go unnoticed until two fish rolled
    // the same attack forever.
    rngSeed: attack.seed,
    stage,
    // Only the reel-in has a duration to count, so every other stage seeds zero
    // and `stepEnding` never looks at it again.
    stageTicksRemaining: stage === 'reelIn' ? REEL_IN_TICKS : 0,
    boat: {
      x,
      hull,
      hullMax: state.boat.hullMax,
      line,
      lineMax: state.boat.lineMax,
      dashTicksRemaining,
      dashDirection,
      dashHeld: inputs.dash,
      attackCooldownRemaining,
      attackHeld: inputs.attack,
      heavyWindUpRemaining,
      heavyHeld: inputs.heavy,
      regenDelayRemaining,
    },
    fish: {
      // Carried forward rather than rebuilt, and the one field on either object
      // that is the same instance every tick. It is read-only data about which
      // fish this is, so sharing it is safe for the same reason `stepEnding`
      // spreading the whole state is.
      definition: state.fish.definition,
      x: fishX,
      depth,
      band,
      resistance,
      resistanceMax: state.fish.resistanceMax,
      attackPhase: attack.attackPhase,
      attackPatternId: attack.attackPatternId,
      attackPhaseTicksRemaining: attack.attackPhaseTicksRemaining,
      attackCooldownRemaining: attack.attackCooldownRemaining,
      attackHasHit: attack.attackHasHit,
    },
    projectiles,
  };
}
