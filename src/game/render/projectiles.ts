/**
 * A volley's shots, drawn as game objects inside the pixel grid.
 *
 * Same case as bars.ts and telegraph.ts: these are things in the water rather
 * than debug chrome, so they belong in the canvas at the internal resolution.
 *
 * Owns no logic. It is handed the shots the simulation says exist and puts
 * rectangles where they are.
 *
 * Like the telegraph, it reads the fish definition, and for the same reason: a
 * shot is drawn at exactly the width it is hit-tested at, so a renderer holding a
 * constant would draw one fish's shots at another's size and the drawing would
 * stop being a promise.
 */

import Phaser from 'phaser';
import {
  COLOUR_TELEGRAPH,
  PROJECTILE_DRAW_HEIGHT,
  WATER_LINE_Y,
} from '../../data/config.ts';
import { volleyPatternById } from '../../data/fish/types.ts';
import type { FishDefinition } from '../../data/fish/types.ts';
import type { ProjectileState } from '../../sim/state.ts';

/**
 * Two volleys' worth of rectangles, sized to the fattest volley this fish has.
 *
 * More than can currently be in the air at once: against the grey box fish the
 * recovery, cooldown and wind-up come to 160 ticks while a shot from depth 100
 * flies for 83, so a volley has always landed before the next is fired. The spare
 * set is there so that a retune, or a fish that dives deeper than the one this
 * was measured on, cannot silently drop a shot the simulation says is there.
 */
function poolSize(fish: FishDefinition): number {
  const largest = fish.patterns.reduce(
    (most, pattern) =>
      pattern.behaviour === 'volley' ? Math.max(most, pattern.shotCount) : most,
    0,
  );

  return largest * 2;
}

export class Projectiles {
  private readonly shots: Phaser.GameObjects.Rectangle[];
  private readonly fish: FishDefinition;

  constructor(scene: Phaser.Scene, fish: FishDefinition) {
    this.fish = fish;
    this.shots = Array.from({ length: poolSize(fish) }, () =>
      scene.add
        // Width is per shot, so it is set in `show` rather than here. Height is
        // presentation and the same for every shot in the game.
        .rectangle(0, 0, 0, PROJECTILE_DRAW_HEIGHT, COLOUR_TELEGRAPH)
        .setVisible(false),
    );
  }

  /**
   * @param projectiles Straight off the current simulation state, not
   *   interpolated. The list changes length as shots resolve, so blending index
   *   by index between two ticks would smear a shot that has just landed into
   *   one that has just been fired. At 2 units a tick the stepping is small
   *   enough not to read as stutter.
   */
  show(projectiles: readonly ProjectileState[]): void {
    this.shots.forEach((rectangle, i) => {
      const shot = projectiles[i];

      if (shot === undefined) {
        rectangle.setVisible(false);
        return;
      }

      const pattern = volleyPatternById(this.fish, shot.patternId);

      rectangle.setVisible(true);
      rectangle.x = shot.x;
      // Depth is units below the surface, the same conversion the fish gets in
      // FightScene. The shot climbs towards the waterline and resolves there.
      rectangle.y = WATER_LINE_Y + shot.depth;
      // The width the simulation hit-tests this shot at, so what the player is
      // dodging is the shape they can see.
      rectangle.setSize(pattern.shotWidth, PROJECTILE_DRAW_HEIGHT);
    });
  }
}
