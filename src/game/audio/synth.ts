/**
 * The placeholder sound bank, synthesised from oscillators at run time.
 *
 * Grey box audio, and the same bet the coloured rectangles are: nothing has to
 * be made before the fight can be heard, and every sound is a row of numbers in
 * `data/config.ts` rather than a file to re-export. It is meant to be thrown
 * away. When real audio arrives it arrives as a different `FightAudioPlayer`,
 * and the four cue names are the only thing the rest of the game knows about.
 *
 * Not unit tested, per architecture.md section 9: it needs a browser, an audio
 * context and an ear. The half of the audio layer that *can* be tested is the
 * half that decides which cue fires, and that lives in cues.ts with no
 * dependency on any of this.
 */

import Phaser from 'phaser';
import {
  SOUND_ATTACK,
  SOUND_HURT,
  SOUND_LOSS,
  SOUND_MASTER_GAIN,
  SOUND_TELEGRAPH,
  type SoundDefinition,
} from '../../data/config.ts';
import type { Cue, FightAudioPlayer } from './cues.ts';

const DEFINITIONS: Record<Cue, SoundDefinition> = {
  attack: SOUND_ATTACK,
  hurt: SOUND_HURT,
  telegraph: SOUND_TELEGRAPH,
  loss: SOUND_LOSS,
};

/** Does nothing, audibly. Used when the browser gives us no Web Audio at all. */
class SilentPlayer implements FightAudioPlayer {
  play(): void {}
}

/**
 * One white-noise burst, built as a buffer because Web Audio has no noise
 * oscillator.
 *
 * Rebuilt per sound rather than cached. A buffer source is single use, the
 * buffers are a fraction of a second, and a fight makes a few hundred of them
 * over a minute, which is nothing next to what the renderer is already doing.
 */
function playNoise(
  context: AudioContext,
  destination: AudioNode,
  definition: SoundDefinition,
  startedAt: number,
): void {
  const frames = Math.max(
    1,
    Math.floor((definition.ms / 1000) * context.sampleRate),
  );
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const samples = buffer.getChannelData(0);

  for (let i = 0; i < frames; i++) {
    samples[i] = Math.random() * 2 - 1;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;

  const gain = context.createGain();
  gain.gain.setValueAtTime(definition.gain * definition.noise, startedAt);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    startedAt + definition.ms / 1000,
  );

  source.connect(gain).connect(destination);
  source.start(startedAt);
  source.stop(startedAt + definition.ms / 1000);
}

/**
 * Plays the cue bank through the Web Audio graph Phaser already owns.
 *
 * Phaser's context rather than one of our own, deliberately. Browsers refuse to
 * start audio until the page has been interacted with, and Phaser's sound
 * manager already handles that unlocking; a second context would sit suspended
 * and silent with nothing watching for the gesture that would resume it.
 */
class SynthPlayer implements FightAudioPlayer {
  private readonly context: AudioContext;
  private readonly master: GainNode;

  constructor(context: AudioContext) {
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = SOUND_MASTER_GAIN;
    this.master.connect(context.destination);
  }

  play(cue: Cue): void {
    // A cue arriving before the player has touched anything is dropped rather
    // than queued. The only one that can is the telegraph, on a fight that opens
    // with a volley, and a warning about something that has already happened by
    // the time it is audible would be worse than silence.
    if (this.context.state !== 'running') {
      return;
    }

    const definition = DEFINITIONS[cue];
    const startedAt = this.context.currentTime;
    const endsAt = startedAt + definition.ms / 1000;

    const oscillator = this.context.createOscillator();
    oscillator.type = definition.wave;
    oscillator.frequency.setValueAtTime(definition.fromHz, startedAt);
    // Exponential rather than linear, because pitch is heard logarithmically: a
    // linear slide from 320 Hz to 60 spends most of its length in the top half
    // and reads as a stall followed by a drop.
    oscillator.frequency.exponentialRampToValueAtTime(definition.toHz, endsAt);

    const gain = this.context.createGain();
    // Ramped down to near silence rather than to zero, because an exponential
    // ramp cannot reach it, and cut with a stop rather than left to fade, so a
    // sound never outlives its own duration.
    gain.gain.setValueAtTime(definition.gain, startedAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);

    oscillator.connect(gain).connect(this.master);
    oscillator.start(startedAt);
    oscillator.stop(endsAt);

    if (definition.noise > 0) {
      playNoise(this.context, this.master, definition, startedAt);
    }
  }
}

/**
 * Build a player from whatever audio the browser gave Phaser.
 *
 * Falls back to silence rather than throwing. A browser with audio disabled, or
 * one that handed Phaser the HTML5 or no-audio manager instead of the Web Audio
 * one, is a browser the fight should still be playable in: sound is the one
 * layer of this game whose absence costs nothing but sound.
 */
export function createFightAudio(scene: Phaser.Scene): FightAudioPlayer {
  const manager = scene.sound;

  if (!(manager instanceof Phaser.Sound.WebAudioSoundManager)) {
    return new SilentPlayer();
  }

  return new SynthPlayer(manager.context);
}
