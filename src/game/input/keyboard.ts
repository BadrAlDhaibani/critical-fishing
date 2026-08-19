/**
 * Keyboard to FightInputs. The only place in the codebase that knows which
 * physical keys the game uses.
 *
 * Everything downstream of here sees intent ("move left") rather than hardware
 * ("A is down"), which is what lets the same simulation be driven by a network
 * message on the server in phase 7.
 */

import Phaser from 'phaser';
import type { FightInputs } from '../../sim/state.ts';

/**
 * The keys a fight listens to. design.md section 2 lists exactly two: A and D.
 * The control scheme is deliberately this small, so extra bindings are a design
 * proposal rather than a convenience to add in passing.
 */
export interface FightControls {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
}

export function createFightControls(scene: Phaser.Scene): FightControls {
  const keyboard = scene.input.keyboard;

  // Phaser types this nullable because a game can be configured without the
  // keyboard plugin. This one cannot be played without it, so fail loudly here
  // rather than have movement silently do nothing.
  if (keyboard === null) {
    throw new Error('Keyboard input is unavailable; the fight needs it');
  }

  return {
    left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
    right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
  };
}

/** Snapshot the keys as a plain object the simulation can consume. */
export function readFightInputs(controls: FightControls): FightInputs {
  return {
    moveLeft: controls.left.isDown,
    moveRight: controls.right.isDown,
  };
}
