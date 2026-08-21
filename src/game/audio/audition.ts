/**
 * Fire any cue on demand, as DOM buttons beside the debug readout.
 *
 * Tuning tooling, not a game feature, and it exists because the bank cannot be
 * judged any other way. The frequencies, durations and gains in `SOUND_*` were
 * picked rather than asked for — a frequency cannot be argued about without
 * hearing it — and in ordinary play `loss` needs four close punishers to land
 * before it can be heard once. A pass that has to lose a fight to re-check one
 * number is not a pass anyone finishes.
 *
 * DOM rather than key bindings, for both of the reasons that put the debug
 * readout there: the 2026-08-19 decision keeps debug chrome outside the canvas,
 * and `game/input/keyboard.ts` treats a new binding as a design proposal rather
 * than a convenience. Four buttons cost neither.
 *
 * Plays through the same `FightAudioPlayer` the fight does, so what is
 * auditioned is exactly what is heard in play rather than a second opinion about
 * it. Not unit tested, per architecture.md section 9: it needs a browser, an
 * audio context and an ear, which is the same line that leaves synth.ts
 * uncovered while cues.ts is tested.
 */

import type { Cue, FightAudioPlayer } from './cues.ts';

/**
 * Every cue, in the order they are laid out. Listed rather than derived, because
 * `Cue` is a union of string literals and has no runtime form to iterate — and
 * the exhaustiveness is what matters here: a fifth cue added without a button
 * would be the one nobody tunes.
 */
const CUES: readonly Cue[] = ['attack', 'hurt', 'telegraph', 'loss'];

export class CueAudition {
  constructor(player: FightAudioPlayer, elementId = 'audition') {
    const element = document.getElementById(elementId);
    if (element === null) {
      throw new Error(`Audition panel element #${elementId} not found`);
    }

    for (const cue of CUES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = cue;

      // Focus is never allowed to land on the button. A focused button takes
      // space and enter as a press of itself, so one click here would silently
      // rebind the attack key to replaying a cue for the rest of the session —
      // during a playtest, which is the one thing this panel exists to serve.
      //
      // Refused at mousedown rather than blurred at click, because blurring
      // afterwards means the focus did land and anything watching for it already
      // fired.
      button.addEventListener('mousedown', (event) => event.preventDefault());

      // The click is also the gesture that unlocks the audio context, and
      // Phaser's unlock may not have resolved by the time this handler runs, so
      // the very first press of the session can come out silent. Pressing again
      // works. Not worth plumbing around for a debug panel.
      button.addEventListener('click', () => player.play(cue));

      element.appendChild(button);
    }
  }
}
