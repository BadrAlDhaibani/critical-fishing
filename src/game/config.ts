import Phaser from 'phaser';
import { INTERNAL_WIDTH, INTERNAL_HEIGHT, COLOUR_SKY } from '../data/config.ts';
import { FightScene } from './scenes/FightScene.ts';

/**
 * Phaser configuration. design.md section 6 requires nearest-neighbour
 * filtering with no smoothing and an integer zoom, so that one simulation unit
 * is always a whole number of screen pixels and the pixel grid stays square.
 *
 * MAX_ZOOM picks the largest whole-number scale factor that fits the window.
 * Scale mode NONE keeps Phaser from also stretching the canvas: FIT would scale
 * fractionally, which puts sprite edges between physical pixels and shimmers as
 * things move. Anything left over is letterboxed against the black page.
 */
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: INTERNAL_WIDTH,
  height: INTERNAL_HEIGHT,
  backgroundColor: COLOUR_SKY,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.NONE,
    zoom: Phaser.Scale.MAX_ZOOM,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [FightScene],
};
