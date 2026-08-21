/**
 * Choose which fish to fight, as DOM buttons beside the cue audition panel.
 *
 * Tuning tooling, not a game feature, and it exists because task 3.3 could not
 * otherwise be judged. `createFightState` has taken a fish definition since 3.1,
 * but `FightScene` called it with no argument, so the grey box fish was the only
 * one anything could actually play. Three fish added as data would have passed
 * their tests and been unplayable, and CLAUDE.md's definition of done is tests
 * **and** a playtest.
 *
 * Phase 4.1's encounter roll is what will really choose the fish, at which point
 * this becomes a debug override of that roll rather than the only way in.
 *
 * DOM rather than key bindings, for the two reasons that put the debug readout
 * and the audition panel there: the 2026-08-19 decision keeps debug chrome
 * outside the canvas, and `game/input/keyboard.ts` treats a new binding as a
 * design proposal rather than a convenience.
 *
 * **Selecting reloads the page**, which is the part worth explaining. Two things
 * size themselves off the fish definition exactly once, at construction: the
 * fish rectangle in `FightScene.create`, and the shot pool in
 * `render/projectiles.ts`, which is sized to the fattest volley the fish has.
 * Swapping the fish live means resizing one and rebuilding the other, which is
 * renderer surgery inside a task whose whole claim is that adding a fish touches
 * nothing. A reload gets a correctly built scene for free. What it costs is a
 * page flash a handful of times a session, against a fight that restarts anyway.
 *
 * Not unit tested, per architecture.md section 9, for the same reason
 * `audition.ts` is not: it needs a browser and a `location`.
 */

import { ALL_FISH } from '../../data/fish/index.ts';
import { GREY_BOX } from '../../data/fish/greyBox.ts';
import type { FishDefinition } from '../../data/fish/types.ts';

/** The query parameter the choice survives the reload in. */
const PARAM = 'fish';

/**
 * Which fish the address bar is asking for, or the grey box fish.
 *
 * Falls back rather than throwing on an unknown id, unlike everything in
 * `data/fish/types.ts` that resolves an id. Those are reading data the project
 * wrote and a bad id there is a typo worth surfacing loudly; this is reading a
 * URL a human typed, and a mistyped one should open the game rather than break
 * it.
 *
 * The grey box fish specifically, not `ALL_FISH[0]`, for the reason
 * `createFightState` names: the default is a particular fish rather than
 * whichever one happens to be first in the registry.
 */
export function selectedFish(): FishDefinition {
  const id = new URL(window.location.href).searchParams.get(PARAM);

  return ALL_FISH.find((fish) => fish.id === id) ?? GREY_BOX;
}

export class FishPicker {
  constructor(elementId = 'fish-picker') {
    const element = document.getElementById(elementId);
    if (element === null) {
      throw new Error(`Fish picker element #${elementId} not found`);
    }

    const current = selectedFish();

    for (const fish of ALL_FISH) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = fish.name;

      // Marked rather than disabled. A disabled button reads as unavailable
      // where this one means "already fighting it", and clicking it is still
      // worth allowing: it is the shortest way to restart a fight from scratch.
      if (fish.id === current.id) button.classList.add('current');

      // The same guard the audition panel uses, and it matters less here since
      // the page is about to be replaced anyway. Kept because a panel that
      // behaves differently from the one next to it, for no reason visible from
      // either, is its own small trap.
      button.addEventListener('mousedown', (event) => event.preventDefault());

      button.addEventListener('click', () => {
        const url = new URL(window.location.href);
        url.searchParams.set(PARAM, fish.id);
        window.location.assign(url);
      });

      element.appendChild(button);
    }
  }
}
