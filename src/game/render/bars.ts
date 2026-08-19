/**
 * Resource bars, drawn as game objects inside the pixel grid.
 *
 * The opposite case to debugOverlay.ts, and the same 2026-08-19 decisions.md
 * entry covers both: debug and tuning text goes in the DOM because canvas text
 * cannot survive a nearest-neighbour upscale, while in-game UI belongs in the
 * canvas at the internal resolution. These are rectangles, so none of the text
 * problem applies to them.
 *
 * Knows nothing about what it is showing. It takes a value and a maximum, which
 * is all a bar needs and keeps hull, stamina and resistance on one code path.
 */

import Phaser from 'phaser';
import {
  BAR_HEIGHT,
  BAR_WIDTH,
  COLOUR_BAR_BACKDROP,
} from '../../data/config.ts';
import { barFillWidth } from './barGeometry.ts';

export class Bar {
  private readonly fill: Phaser.GameObjects.Rectangle;

  /**
   * @param x Left edge, in internal-resolution units.
   * @param y Top edge, same units.
   * @param colour Fill colour. The backdrop is the same for every bar, so an
   *   empty one still reads as a bar rather than as a gap in the UI.
   */
  constructor(scene: Phaser.Scene, x: number, y: number, colour: number) {
    scene.add
      .rectangle(x, y, BAR_WIDTH, BAR_HEIGHT, COLOUR_BAR_BACKDROP)
      .setOrigin(0, 0);

    // Origin on the left edge, so resizing drains it rightwards to leftwards
    // without having to move it. Every bar fills the same direction for now,
    // including the fish's; mirroring the pair is a playtest judgement.
    this.fill = scene.add
      .rectangle(x, y, BAR_WIDTH, BAR_HEIGHT, colour)
      .setOrigin(0, 0);
  }

  set(value: number, max: number): void {
    // setSize rather than the width property: Phaser keeps a separate display
    // size, and setting width alone leaves the two disagreeing.
    this.fill.setSize(barFillWidth(value, max, BAR_WIDTH), BAR_HEIGHT);
  }
}
