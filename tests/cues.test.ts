import { describe, it, expect } from 'vitest';
import { CueWatcher } from '../src/game/audio/cues.ts';
import type { Impact } from '../src/game/feel/impacts.ts';
import { createFightState } from '../src/sim/state.ts';
import type { FightState } from '../src/sim/state.ts';
import { ATTACK_DAMAGE_MAX } from '../src/data/config.ts';
import { GREY_BOX } from '../src/data/fish/greyBox.ts';
import { patternById } from '../src/data/fish/types.ts';

/** A representative heavy hit to feed the watcher, off the fish's own numbers. */
const LUNGE = patternById(GREY_BOX, 'lunge');

/**
 * The half of the audio layer that can be tested. Whether the bank sounds good
 * is a playtest question and architecture.md section 9 leaves it there; whether
 * the right cue fires on the right event is ordinary logic, and it is the half
 * that can be wrong without anyone noticing, because a missing sound is
 * indistinguishable from a sound you did not hear.
 */

const HIT_BOAT: Impact = { target: 'boat', damage: LUNGE.hullDamage };
const HIT_FISH: Impact = { target: 'fish', damage: ATTACK_DAMAGE_MAX };

/** A state mid-wind-up, whichever attack it belongs to. */
function windingUp(state: FightState): FightState {
  return { ...state, fish: { ...state.fish, attackPhase: 'windUp' } };
}

describe('CueWatcher', () => {
  it('says nothing on a quiet tick', () => {
    const state = createFightState();

    expect(new CueWatcher(state).sample(state, [])).toEqual([]);
  });

  it('calls the players landed hit an attack', () => {
    const state = createFightState();

    expect(new CueWatcher(state).sample(state, [HIT_FISH])).toEqual(['attack']);
  });

  it('calls the boat taking damage a hurt', () => {
    const state = createFightState();

    expect(new CueWatcher(state).sample(state, [HIT_BOAT])).toEqual(['hurt']);
  });

  it('fires the telegraph when the fish commits', () => {
    const state = createFightState();
    const watcher = new CueWatcher(state);

    expect(watcher.sample(windingUp(state), [])).toEqual(['telegraph']);
  });

  it('fires the telegraph once, not for every tick of the wind-up', () => {
    // The phase runs for dozens of ticks. The sound belongs to the moment it
    // opens, and repeating it would be a siren rather than a tell.
    const state = createFightState();
    const watcher = new CueWatcher(state);
    const wound = windingUp(state);

    watcher.sample(wound, []);

    expect(watcher.sample(wound, [])).toEqual([]);
  });

  it('fires the telegraph again for the next attack', () => {
    const state = createFightState();
    const watcher = new CueWatcher(state);
    const wound = windingUp(state);

    watcher.sample(wound, []);
    watcher.sample(state, []);

    expect(watcher.sample(wound, [])).toEqual(['telegraph']);
  });

  it('gives one cue to both fish attacks, not one each', () => {
    // The same call COLOUR_TELEGRAPH makes for the eye: one signal means danger
    // whatever shape it is in. Which attack it is stays the telegraph's job.
    const state = createFightState();

    const close = new CueWatcher(state).sample(
      {
        ...windingUp(state),
        fish: { ...windingUp(state).fish, attackPatternId: 'lunge' },
      },
      [],
    );
    const far = new CueWatcher(state).sample(
      {
        ...windingUp(state),
        fish: { ...windingUp(state).fish, attackPatternId: 'volley' },
      },
      [],
    );

    expect(close).toEqual(far);
  });

  it('fires the loss when the hull runs out', () => {
    const state = createFightState();
    const watcher = new CueWatcher(state);

    const lost: FightState = { ...state, stage: 'escaped' };

    expect(watcher.sample(lost, [])).toEqual(['loss']);
  });

  it('fires the loss once and not every frame after it', () => {
    const state = createFightState();
    const watcher = new CueWatcher(state);
    const lost: FightState = { ...state, stage: 'escaped' };

    watcher.sample(lost, []);

    expect(watcher.sample(lost, [])).toEqual([]);
  });

  it('stays silent on the win, which the reel-in beat owns', () => {
    // design.md section 2 makes the reel-in the payoff and phase 8 hard swaps the
    // music there. A sting now would be squatting on it.
    const state = createFightState();
    const watcher = new CueWatcher(state);

    const won: FightState = { ...state, stage: 'reelIn' };

    expect(watcher.sample(won, [])).toEqual([]);
    expect(watcher.sample({ ...state, stage: 'landed' }, [])).toEqual([]);
  });

  it('puts the warning ahead of the reports when a frame has both', () => {
    // The telegraph is the only cue that is about something that has not
    // happened yet, and design.md section 3 makes reading it the core of the
    // fight, so it should reach the ear first.
    const state = createFightState();
    const watcher = new CueWatcher(state);

    expect(watcher.sample(windingUp(state), [HIT_BOAT, HIT_FISH])).toEqual([
      'telegraph',
      'hurt',
      'attack',
    ]);
  });

  it('reports both sides when blows are traded', () => {
    const state = createFightState();
    const watcher = new CueWatcher(state);

    expect(watcher.sample(state, [HIT_BOAT, HIT_FISH])).toEqual([
      'hurt',
      'attack',
    ]);
  });
});
