/**
 * The far punisher's shots, drawn as game objects inside the pixel grid.
 *
 * Same case as bars.ts and telegraph.ts: these are things in the water rather
 * than debug chrome, so they belong in the canvas at the internal resolution.
 *
 * Owns no logic. It is handed the shots the simulation says exist and puts
 * rectangles where they are.
 */

import Phaser from 'phaser';
import {
  COLOUR_TELEGRAPH,
  FISH_FAR_SHOT_COUNT,
  FISH_FAR_SHOT_HEIGHT,
  FISH_FAR_SHOT_WIDTH,
  WATER_LINE_Y,
} from '../../data/config.ts';
import type { ProjectileState } from '../../sim/state.ts';

/**
 * Two volleys' worth of rectangles.
 *
 * More than can currently be in the air at once: the fish's recovery, cooldown
 * and wind-up come to 160 ticks and a shot from depth 100 flies for 83, so a
 * volley has always landed before the next is fired. The spare set is there so
 * that a retune during task 1.13, or a deeper fish once the AI owns depth at
 * 1.11, cannot silently drop a shot the simulation says is there.
 */
const POOL_SIZE = FISH_FAR_SHOT_COUNT * 2;

export class Projectiles {
  private readonly shots: Phaser.GameObjects.Rectangle[];

  constructor(scene: Phaser.Scene) {
    this.shots = Array.from({ length: POOL_SIZE }, () =>
      scene.add
        .rectangle(
          0,
          0,
          FISH_FAR_SHOT_WIDTH,
          FISH_FAR_SHOT_HEIGHT,
          COLOUR_TELEGRAPH,
        )
        .setVisible(false),
    );
  }

  /**
   * @param projectiles Straight off the current simulation state, not
   *   interpolated. The list changes length as shots resolve, so blending index
   *   by index between two ticks would smear a shot that has just landed into
   *   one that has just been fired. At 1.2 units a tick the stepping is small
   *   enough not to read as stutter.
   */
  show(projectiles: readonly ProjectileState[]): void {
    this.shots.forEach((rectangle, i) => {
      const shot = projectiles[i];

      if (shot === undefined) {
        rectangle.setVisible(false);
        return;
      }

      rectangle.setVisible(true);
      rectangle.x = shot.x;
      // Depth is units below the surface, the same conversion the fish gets in
      // FightScene. The shot climbs towards the waterline and resolves there.
      rectangle.y = WATER_LINE_Y + shot.depth;
    });
  }
}
