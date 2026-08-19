/**
 * How wide a bar's fill is drawn. Pure arithmetic, no Phaser, so it can be
 * tested without booting a renderer.
 *
 * Separate from bars.ts for that reason alone. The rule about a nearly empty
 * bar below is a readability decision rather than a drawing detail, and it
 * deserves a test that names it.
 */

/**
 * Fill width in internal-resolution units for `value` out of `max`.
 *
 * Whole units only. The bars are game objects inside the 480x270 grid, and a
 * fractional width would land on a half pixel that the nearest-neighbour
 * upscale turns into a visibly soft edge against rectangles that have none.
 *
 * Any value above zero draws at least one unit. A hull on 1 of 100 rounds to
 * nothing, and an empty bar on a boat that is still alive reads as death, which
 * is the worst possible thing for this particular bar to lie about. Only an
 * exact zero is empty.
 *
 * The fraction is clamped, so a value over max or a hull driven negative by an
 * overkill hit cannot draw outside the bar.
 */
export function barFillWidth(
  value: number,
  max: number,
  width: number,
): number {
  if (max <= 0 || value <= 0) {
    return 0;
  }

  const fraction = Math.min(value / max, 1);
  return Math.max(Math.round(fraction * width), 1);
}
