/**
 * What the fight sounds like, decided as data. Pure TypeScript, no Phaser and no
 * Web Audio: this module works out *which* sounds should fire and never makes
 * one.
 *
 * The split matters more here than anywhere else in `game/`. Deciding a cue is
 * ordinary logic that can be unit tested; producing a noise needs an audio
 * context, a browser and an ear, and architecture.md section 9 says feel is
 * validated by playtest. Keeping them apart means the half that can be wrong
 * silently is the half that is covered.
 *
 * The cue vocabulary below is also the seam real audio arrives through. Anything
 * implementing `FightAudioPlayer` can be dropped in behind it — the synthesised
 * placeholder in synth.ts today, four loaded sound files later — and nothing
 * else in the game changes, because the contract between the fight and its audio
 * is these four strings.
 */

import type { Impact } from '../feel/impacts.ts';
import type {
  FishAttackPhase,
  FightStage,
  FightState,
} from '../../sim/state.ts';

/**
 * Everything the fight can ask to be heard. design.md section 6 asks for "three
 * or four: attack, hit, fish attack, loss", and these are those four.
 *
 * `attack` is the player's hit landing and `hurt` is the boat taking one. For
 * the player, firing and connecting are the same event — the basic attack always
 * deals damage when it fires — so there is no third cue hiding between them, and
 * design.md's "hit" is read as the one the player is on the receiving end of,
 * which is the more useful of the two to hear.
 */
export type Cue = 'attack' | 'hurt' | 'telegraph' | 'loss';

/** Plays a cue. The seam between the fight and however audio is produced. */
export interface FightAudioPlayer {
  play(cue: Cue): void;
}

/**
 * Watches for the things that make a noise but are not damage.
 *
 * Damage arrives already detected: `ImpactWatcher` in game/feel/ reports it for
 * the shake and the flash, and the scene passes the same list through here
 * rather than working it out twice.
 *
 * What is left is two discrete transitions, and both need the same trick the
 * impact watcher needs: hold the last value seen rather than reading
 * `driver.previous`, because a slow frame runs several ticks at once and a
 * wind-up that started on the first of them would already be in both.
 */
export class CueWatcher {
  private phase: FishAttackPhase;
  private stage: FightStage;

  constructor(state: FightState) {
    this.phase = state.fish.attackPhase;
    this.stage = state.stage;
  }

  /**
   * Which cues fired since the last call, in the order they should be heard.
   *
   * The telegraph comes first deliberately. It is the only cue that is a warning
   * rather than a report, and design.md section 3 makes reading the wind-up the
   * core of the fight, so if a frame produces several it should be the one that
   * lands on the ear first.
   */
  sample(state: FightState, impacts: readonly Impact[]): Cue[] {
    const cues: Cue[] = [];

    // Entering the wind-up, not being in it. The phase runs for dozens of ticks
    // and the sound belongs to the moment it opens.
    //
    // One cue for both the close punisher and the volley, not one each. That is
    // the same call `COLOUR_TELEGRAPH` already makes for the eye: one signal
    // means danger whatever shape it is in, so the player learns to read the
    // signal rather than a vocabulary of them. Which attack it is stays the
    // telegraph's shape to say.
    if (state.fish.attackPhase === 'windUp' && this.phase !== 'windUp') {
      cues.push('telegraph');
    }

    for (const impact of impacts) {
      cues.push(impact.target === 'boat' ? 'hurt' : 'attack');
    }

    // Only the loss. Landing a fish cuts to the reel-in, which design.md section
    // 2 calls the payoff beat and where phase 8's music hard swaps; putting a
    // sting on it now would be squatting on that.
    if (state.stage === 'escaped' && this.stage !== 'escaped') {
      cues.push('loss');
    }

    this.phase = state.fish.attackPhase;
    this.stage = state.stage;

    return cues;
  }
}
