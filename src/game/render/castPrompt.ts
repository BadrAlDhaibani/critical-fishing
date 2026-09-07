/**
 * The words the loop says to the player: cast this, you hooked that.
 *
 * **DOM rather than canvas, and the first in-game text in the project**, which
 * makes it the case the 2026-08-19 decision does not cover. That entry put debug
 * and tuning text in the DOM because canvas text and pixel-art upscaling cannot
 * both be right — the browser antialiases a font and nearest-neighbour scaling
 * then turns every soft edge into a solid block — and kept in-game UI inside the
 * canvas, which was easy while the only UI was rectangles. This is in-game UI
 * that is text, so both halves apply at once.
 *
 * It goes in the DOM, as a **placeholder**. The same entry names the right answer
 * and why it is not available: a bitmap font, which needs a font asset and belongs
 * with the phase 8 art pass. Until 8.1 exists, mushy text inside the canvas would
 * be worse than sharp text over it, and the cast beat cannot be playtested without
 * words at all. See decisions.md 2026-09-07.
 *
 * Nothing in sim/ knows this exists, and neither does anything in meta/: it is
 * handed a state and a name and puts them on screen.
 */

import { CAST_BANNER_MS } from '../../data/config.ts';
import { MAX_FRAME_MS } from '../../sim/loop.ts';

/**
 * Where the loop is, from the prompt's point of view.
 *
 * Three states rather than the fight's four stages, because that is all the
 * difference this element draws. The reel-in is part of a fight being fought and
 * gets nothing; both endings read the same here, since design.md section 5 makes
 * the next cast the answer to either one.
 */
export type CastPromptState = 'waitingToCast' | 'fighting' | 'ended';

const WAITING_TEXT = 'PRESS R TO CAST';
const ENDED_TEXT = 'PRESS R TO CAST AGAIN';

export class CastPrompt {
  private readonly element: HTMLElement;

  /** The fish just hooked, and how long it stays named on screen. */
  private hookedName = '';
  private hookedMsRemaining = 0;

  constructor(elementId = 'cast-prompt') {
    const element = document.getElementById(elementId);
    if (element === null) {
      throw new Error(`Cast prompt element #${elementId} not found`);
    }
    this.element = element;
  }

  /**
   * Name the fish a cast just hooked, for a couple of seconds.
   *
   * Restarts rather than extends, the same way `Flash.trigger` does: casting
   * again should read as a new fish being named, not as the last banner running
   * long.
   */
  hooked(name: string): void {
    this.hookedName = name;
    this.hookedMsRemaining = CAST_BANNER_MS;
  }

  /**
   * Spend one frame of real time and put the right words on screen.
   *
   * Counted in wall-clock milliseconds rather than ticks, and the delta is
   * clamped with `MAX_FRAME_MS`, for the reasons `shake.ts` and `flash.ts` give:
   * this is something the player is reading rather than a duration the fight is
   * timed against, and a backgrounded tab hands out a multi-second delta that
   * should end the banner rather than mean anything. It is the third use of that
   * shape in the codebase.
   */
  update(deltaMs: number, state: CastPromptState): void {
    if (this.hookedMsRemaining > 0) {
      const safeDeltaMs =
        Number.isFinite(deltaMs) && deltaMs > 0
          ? Math.min(deltaMs, MAX_FRAME_MS)
          : 0;

      this.hookedMsRemaining = Math.max(
        0,
        this.hookedMsRemaining - safeDeltaMs,
      );
    }

    this.element.textContent = this.text(state);
  }

  /**
   * The banner outranks the fight and is outranked by both other states.
   *
   * A cast that hooked something and a fight already over cannot overlap in
   * practice — the shortest fight is far longer than the banner — but the
   * ordering is stated rather than assumed, because the one that would be wrong
   * is the prompt to cast again sitting underneath the name of the fish that just
   * escaped.
   */
  private text(state: CastPromptState): string {
    if (state === 'waitingToCast') return WAITING_TEXT;
    if (state === 'ended') return ENDED_TEXT;

    return this.hookedMsRemaining > 0 ? `Hooked: ${this.hookedName}` : '';
  }
}
