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
 * direction, and one basic and one heavy attack — **all of which now exist**, so
 * the control scheme is complete as that section specifies it. It is deliberately
 * this small, so any further binding is a design proposal rather than a
 * convenience to add in passing.
 */
export interface FightControls {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  dash: Phaser.Input.Keyboard.Key;
  attack: Phaser.Input.Keyboard.Key;
  /**
   * The heavy attack. Approved 2026-08-21 at task 3.4, see decisions.md, since
   * this file treats a new binding as a design decision rather than a detail.
   */
  heavy: Phaser.Input.Keyboard.Key;
  /**
   * Cast a line, which rolls an encounter and starts the fight it hooks.
   *
   * **The same physical key as the restart approved 2026-08-20**, widened rather
   * than added to at task 4.1: `R` used to mean "fight that fish again" and now
   * means "cast again", which is the same press in the same place at the same
   * moment. A second key for casting would be a new binding, and this file treats
   * one of those as a design proposal rather than a convenience.
   *
   * Deliberately absent from `FightInputs` below, and the split is the point.
   * Casting is not something a boat does inside a fight, it is the meta layer's
   * job: design.md section 5 has a cast roll an encounter and a loss consume the
   * bait, damage the rod and write a record book entry, none of which the
   * simulation knows about. Keeping it out of `FightInputs` keeps the phase 7
   * wire contract to things the fight actually acts on, and keeps sim/ ignorant
   * of a concept it has no business holding. `FightScene` reads this key
   * directly.
   */
  cast: Phaser.Input.Keyboard.Key;
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
    // F, under the index finger while the hand is on A and D, leaving shift for
    // the dash and space for the basic. Close enough to be reached mid-fight,
    // which matters because the heavy roots the boat and a fumbled reach for it
    // is a commitment made by accident.
    heavy: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
    // Well away from A, D, shift and space, so a hand still on the controls at
    // the moment a fight ends cannot fat-finger it. The scene ignores it while a
    // fight is running for the same reason.
    cast: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
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
    heavy: controls.heavy.isDown,
  };
}
