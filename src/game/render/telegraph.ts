/**
 * The fish's attack telegraphs, drawn as game objects inside the pixel grid.
 *
 * Same case as bars.ts: it is in-game UI rather than debug chrome, so it belongs
 * in the canvas at the internal resolution and not in the DOM.
 *
 * design.md pillar 3 makes every loss the player's fault, which only holds if
 * what the fish is about to do is visible before it happens. This is that
 * visibility, and in the grey box phase it is the entire art budget for it.
 *
 * Owns no logic. It is told a phase, which attack that phase belongs to, and
 * where the fish is, and draws.
 */

import Phaser from 'phaser';
import {
  COLOUR_TELEGRAPH,
  FISH_CLOSE_HITBOX_WIDTH,
  FISH_FAR_TELL_PADDING,
  FISH_HEIGHT,
  FISH_WIDTH,
  WATER_LINE_Y,
} from '../../data/config.ts';
import type { FishAttackKind, FishAttackPhase } from '../../sim/state.ts';

export class Telegraph {
  /** The close punisher: the column of water above the fish that it owns. */
  private readonly column: Phaser.GameObjects.Rectangle;
  /** The far punisher: an outline on the fish itself. */
  private readonly outline: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    // Origin at the top centre, so it hangs from the waterline and follows the
    // fish's x directly. Height is set per frame, since the fish's depth is what
    // decides how far down the box reaches.
    this.column = scene.add
      .rectangle(0, WATER_LINE_Y, FISH_CLOSE_HITBOX_WIDTH, 0, COLOUR_TELEGRAPH)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, COLOUR_TELEGRAPH)
      .setVisible(false);

    // On the fish rather than on the water, because the far punisher owns no
    // column: what it is about to put in the water is the shots, and they draw
    // themselves. Deliberately a plainly different shape from the column above
    // and not a variation on it, since the two tells ask for opposite movements
    // and must never be read for one another at a glance.
    this.outline = scene.add
      .rectangle(
        0,
        0,
        FISH_WIDTH + FISH_FAR_TELL_PADDING * 2,
        FISH_HEIGHT + FISH_FAR_TELL_PADDING * 2,
        COLOUR_TELEGRAPH,
        0,
      )
      .setStrokeStyle(1, COLOUR_TELEGRAPH)
      .setVisible(false);
  }

  /**
   * @param fishX Interpolated fish x, so the box cannot sit a frame behind the
   *   fish it belongs to once the AI starts moving it at task 1.11.
   * @param fishY Interpolated fish y, in screen units.
   */
  show(
    phase: FishAttackPhase,
    kind: FishAttackKind | null,
    fishX: number,
    fishY: number,
  ): void {
    // Nothing is drawn during recovery. The fish being harmless is not
    // information the player is owed on screen: reading the recovery and
    // choosing to close is the punish, and marking it would do that for them.
    // The debug readout still names the phase during the tuning pass.
    const telegraphing = phase === 'windUp' || phase === 'active';

    this.column.setVisible(telegraphing && kind === 'close');
    // Up through the active frames as well as the wind-up, because the volley is
    // still being fired during them: the outline going out is what says the last
    // shot has left.
    this.outline.setVisible(telegraphing && kind === 'far');

    if (!telegraphing) {
      return;
    }

    if (kind === 'close') {
      // From the surface down to the top of the fish, so the box reads as the
      // column of water the attack owns. Purely cosmetic: the hit test is
      // horizontal, against a boat that is always on the surface.
      const height = Math.max(0, fishY - FISH_HEIGHT / 2 - WATER_LINE_Y);

      this.column.x = fishX;
      this.column.setSize(FISH_CLOSE_HITBOX_WIDTH, height);

      // Outlined while winding up, solid while the hitbox is live. Two clearly
      // different states rather than one that brightens, because the difference
      // between "about to hurt" and "hurting now" is the only read the close
      // punisher offers and it cannot be a matter of degree.
      this.column.setFillStyle(COLOUR_TELEGRAPH, phase === 'active' ? 1 : 0);
      return;
    }

    this.outline.x = fishX;
    this.outline.y = fishY;
  }
}
