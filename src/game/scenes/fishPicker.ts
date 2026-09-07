/**
 * Pin every cast to one fish, as DOM buttons beside the cue audition panel.
 *
 * Tuning tooling, not a game feature, and it exists because task 3.3 could not
 * otherwise be judged. `createFightState` has taken a fish definition since 3.1,
 * but `FightScene` called it with no argument, so the grey box fish was the only
 * one anything could actually play. Three fish added as data would have passed
 * their tests and been unplayable, and CLAUDE.md's definition of done is tests
 * **and** a playtest.
 *
 * Since task 4.1 this is exactly what it was always going to become: **a debug
 * override of the encounter roll** rather than the only way in. With no parameter
 * set, every cast rolls against `data/encounters.ts`; with one, every cast in the
 * session hooks the fish it names, which is what a tuning pass on one fish needs.
 *

 * DOM rather than key bindings, for the two reasons that put the debug readout
 * and the audition panel there: the 2026-08-19 decision keeps debug chrome
 * outside the canvas, and `game/input/keyboard.ts` treats a new binding as a
 * design proposal rather than a convenience.
 *
 * **Selecting still reloads the page**, but no longer for the reason it used to.
 * Task 3.3 reloaded because the fish rectangle and the shot pool sized themselves
 * off the definition once, at construction, and a live swap was renderer surgery;
 * task 4.1 had to pay that off, since the roll hands a different fish to a
 * running scene on every cast. What the reload is for now is the parameter
 * itself: the override lives in the URL, so setting it means navigating, and the
 * reload is that navigation rather than a way around the renderer.
 *
 * Not unit tested, per architecture.md section 9, for the same reason
 * `audition.ts` is not: it needs a browser and a `location`.
 */

import { ALL_FISH } from '../../data/fish/index.ts';
import type { FishDefinition } from '../../data/fish/types.ts';

/** The query parameter the choice survives the reload in. */
const PARAM = 'fish';

/**
 * Which fish the address bar is pinning every cast to, or null to roll.
 *
 * **Null rather than the grey box fish**, which is the task 4.1 change. Before
 * the encounter roll existed this had to answer with some fish, because it was
 * the only thing choosing one; now the absence of an override is a real answer
 * and the caller rolls instead. Defaulting here would make the grey box fish the
 * result of a cast that was supposed to be rolled, and it would be indisting-
 * uishable from an honest 40% roll of it.
 *
 * Returns null rather than throwing on an unknown id, unlike everything in
 * `data/fish/types.ts` that resolves an id. Those are reading data the project
 * wrote and a bad id there is a typo worth surfacing loudly; this is reading a
 * URL a human typed, and a mistyped one should leave the game rolling normally
 * rather than break it.
 */
export function overrideFish(): FishDefinition | null {
  const id = new URL(window.location.href).searchParams.get(PARAM);

  return ALL_FISH.find((fish) => fish.id === id) ?? null;
}

export class FishPicker {
  constructor(elementId = 'fish-picker') {
    const element = document.getElementById(elementId);
    if (element === null) {
      throw new Error(`Fish picker element #${elementId} not found`);
    }

    const pinned = overrideFish();

    for (const fish of ALL_FISH) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = fish.name;

      // Marked rather than disabled. A disabled button reads as unavailable
      // where this one means "every cast is pinned to it", and clicking it is
      // still worth allowing: it is the shortest way back to a fresh session.
      //
      // Nothing is marked when no override is set, which is the honest reading:
      // the casts are rolling and no fish is the one being played.
      if (pinned !== null && fish.id === pinned.id) {
        button.classList.add('current');
      }

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
