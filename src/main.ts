import Phaser from 'phaser';
import { gameConfig } from './game/config.ts';

const game = new Phaser.Game(gameConfig);

/**
 * Phaser resolves MAX_ZOOM once, at boot, from the parent element's size. It
 * does not recompute on resize, and setZoom takes a real factor rather than the
 * MAX_ZOOM sentinel, so the integer zoom has to be recalculated by hand here.
 * Without this, dragging the window to another monitor leaves the game at the
 * old scale.
 */
window.addEventListener('resize', () => {
  game.scale.getParentBounds();
  game.scale.setZoom(game.scale.getMaxZoom());
});
