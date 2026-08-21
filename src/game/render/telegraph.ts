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
 * Owns no logic. It is told a phase, which of the fish's patterns that phase
 * belongs to, and where the fish is, and draws.
 *
 * **It reads the fish definition, and that is the point.** A telegraph promises
 * exactly where an attack will land, so it has to be drawn at the attacking
 * fish's own hitbox width and the attacking fish's own body size. A renderer
 * holding constants instead would draw every fish's tell at the first fish's
 * size, and every promise after the first would be a lie.
 */

import Phaser from 'phaser';
import {
  COLOUR_TELEGRAPH,
  TELEGRAPH_OUTLINE_PADDING,
  WATER_LINE_Y,
} from '../../data/config.ts';
import { patternById } from '../../data/fish/types.ts';
import type { FishDefinition } from '../../data/fish/types.ts';
import type { FishAttackPhase } from '../../sim/state.ts';

export class Telegraph {
  /** A melee column: the stretch of water above the fish that it owns. */
  private readonly column: Phaser.GameObjects.Rectangle;
  /** A volley: an outline on the fish itself. */
  private readonly outline: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    // Origin at the top centre, so it hangs from the waterline and follows the
    // fish's x directly. Both dimensions are set per frame: the height from the
    // fish's depth, and the width from the pattern being telegraphed, which is
    // not known until there is one.
    this.column = scene.add
      .rectangle(0, WATER_LINE_Y, 0, 0, COLOUR_TELEGRAPH)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, COLOUR_TELEGRAPH)
      .setVisible(false);

    // On the fish rather than on the water, because a volley owns no column:
    // what it is about to put in the water is the shots, and they draw
    // themselves. Deliberately a plainly different shape from the column above
    // and not a variation on it, since the two tells ask for opposite movements
    // and must never be read for one another at a glance.
    this.outline = scene.add
      .rectangle(0, 0, 0, 0, COLOUR_TELEGRAPH, 0)
      .setStrokeStyle(1, COLOUR_TELEGRAPH)
      .setVisible(false);
  }

  /**
   * @param patternId Which of `fish`'s patterns is running, or null while idle.
   * @param fish The fish being fought, so the tell is drawn at its size and its
   *   pattern's reach rather than at some other fish's.
   * @param fishX Interpolated fish x, so the box cannot sit a frame behind the
   *   fish it belongs to.
   * @param fishY Interpolated fish y, in screen units.
   */
  show(
    phase: FishAttackPhase,
    patternId: string | null,
    fish: FishDefinition,
    fishX: number,
    fishY: number,
  ): void {
    // Nothing is drawn during recovery. The fish being harmless is not
    // information the player is owed on screen: reading the recovery and
    // choosing to close is the punish, and marking it would do that for them.
    // The debug readout still names the phase during a tuning pass.
    const telegraphing =
      (phase === 'windUp' || phase === 'active') && patternId !== null;

    const pattern = telegraphing ? patternById(fish, patternId) : null;
    const column = pattern?.behaviour === 'meleeColumn' ? pattern : null;

    this.column.setVisible(column !== null);
    // Up through the active frames as well as the wind-up, because a volley is
    // still being fired during them: the outline going out is what says the last
    // shot has left.
    this.outline.setVisible(pattern !== null && column === null);

    if (pattern === null) {
      return;
    }

    if (column !== null) {
      // From the surface down to the top of the fish, so the box reads as the
      // stretch of water the attack owns. Purely cosmetic: the hit test is
      // horizontal, against a boat that is always on the surface.
      const height = Math.max(0, fishY - fish.height / 2 - WATER_LINE_Y);

      this.column.x = fishX;
      // Drawn at exactly the pattern's own hitbox width, which is what makes the
      // telegraph honest: `meleeColumnHits` measures against the same number, so
      // what the player can see is what hits.
      this.column.setSize(column.hitboxWidth, height);

      // Outlined while winding up, solid while the hitbox is live. Two clearly
      // different states rather than one that brightens, because the difference
      // between "about to hurt" and "hurting now" is the only read a column
      // offers and it cannot be a matter of degree.
      this.column.setFillStyle(COLOUR_TELEGRAPH, phase === 'active' ? 1 : 0);
      return;
    }

    this.outline.x = fishX;
    this.outline.y = fishY;
    // Measured outwards from this fish's own body, so the padding constant fits
    // every fish without any of them restating it.
    this.outline.setSize(
      fish.width + TELEGRAPH_OUTLINE_PADDING * 2,
      fish.height + TELEGRAPH_OUTLINE_PADDING * 2,
    );
  }
}
