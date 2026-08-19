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
 * The keys a fight listens to. design.md section 2 lists A, D, shift plus a
 * direction, and one basic and one heavy attack, so only the heavy at task 3.4
 * is still to come. The control scheme is deliberately this small, so extra
 * bindings are a design proposal rather than a convenience to add in passing.
 */
export interface FightControls {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  dash: Phaser.Input.Keyboard.Key;
  attack: Phaser.Input.Keyboard.Key;
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
    // Either shift, since which hand is on it depends on how the player holds
    // A and D. Phaser reports both under the one SHIFT key code.
    dash: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
    // Space, so the thumb has it while the fingers hold A and D and the little
    // finger holds shift. Phaser captures the key by default, which also stops
    // the browser scrolling the page underneath the canvas.
    attack: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
  };
}

/**
 * Snapshot the keys as a plain object the simulation can consume.
 *
 * Held state only, including the dash. Nothing here tries to spot the frame a
 * key went down: the simulation works that out from the previous tick, so the
 * edge is decided at 60 Hz rather than at whatever rate the monitor happens to
 * run, and a phase 7 server can do the same without trusting the client.
 */
export function readFightInputs(controls: FightControls): FightInputs {
  return {
    moveLeft: controls.left.isDown,
    moveRight: controls.right.isDown,
    dash: controls.dash.isDown,
    attack: controls.attack.isDown,
  };
}
