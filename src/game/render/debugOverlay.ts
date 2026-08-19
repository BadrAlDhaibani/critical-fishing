/**
 * Debug readout, drawn as DOM rather than into the canvas.
 *
 * Canvas text is rasterised by the browser with antialiasing and then scaled up
 * by a whole number with nearest-neighbour filtering, which turns every soft
 * edge pixel into a solid block of grey. It looks broken next to the crisp
 * rectangles. Debug chrome is also not part of the game, so it has no business
 * spending any of the 480x270 budget.
 *
 * Sitting outside the canvas, it renders at the monitor's native resolution and
 * is sharp at any zoom. Nothing in sim/ knows this exists.
 */

export interface DebugFields {
  /** Internal resolution, as "480x270". */
  resolution: string;
  /** Integer scale factor the canvas is drawn at. */
  zoom: number;
  /** Rendered frames per second, whatever the monitor is doing. */
  fps: number;
  /** Long-run average simulation ticks per second. Should sit on 60.0. */
  tickRate: number;
  /** Target rate, for comparison against the measured one. */
  targetTickRate: number;
  /**
   * Ticks since boot. Worth knowing while playtesting: if this drops back to
   * zero the page reloaded and the fight restarted, which looks exactly like
   * the bars refilling themselves.
   */
  totalTicks: number;
  /** Hull HP, current and full. */
  hull: number;
  hullMax: number;
  /**
   * The stamina pool, current and full. As a number rather than only as a bar,
   * because the attack and the dash are priced against it and the refill rate
   * is tuned into it, and none of that is judgeable from a proportion.
   *
   * Fractional since the refill landed, and floored rather than rounded when
   * drawn: 7.6 shown as 8 would claim an 8-cost attack is affordable when the
   * simulation is about to refuse it.
   */
  stamina: number;
  staminaMax: number;
  /**
   * Current boat-to-fish distance in internal units. On screen during the
   * tuning pass because damage scales off it and the distance bands are cut
   * out of it, so it needs to be readable while moving.
   */
  lineLength: number;
  /** The fish's resistance, current and full. */
  resistance: number;
  resistanceMax: number;
  /**
   * What a basic attack would deal from where the boat is standing right now.
   *
   * The curve is the one thing in the fight that cannot be judged from a bar:
   * a hit is worth between 6 and 20 and the difference is the whole point of
   * moving. Shown as the number the attack would actually take off, so it can
   * be checked against the resistance dropping.
   */
  attackDamage: number;
}

export class DebugOverlay {
  private readonly element: HTMLElement;

  constructor(elementId = 'debug') {
    const element = document.getElementById(elementId);
    if (element === null) {
      throw new Error(`Debug overlay element #${elementId} not found`);
    }
    this.element = element;
  }

  update(fields: DebugFields): void {
    // "tether" rather than "line" for the distance, now that the stamina pool
    // is also on screen. design.md calls both of them the line, which is
    // exactly why two numbers here cannot share the word.
    this.element.textContent = [
      `${fields.resolution} @ ${fields.zoom}x`,
      `render ${Math.round(fields.fps)} fps`,
      `sim    ${fields.tickRate.toFixed(1)}/${fields.targetTickRate} ticks/s`,
      `ticks  ${fields.totalTicks}`,
      `hull   ${fields.hull}/${fields.hullMax}`,
      `stam   ${Math.floor(fields.stamina)}/${fields.staminaMax}`,
      `tether ${fields.lineLength.toFixed(1)} u`,
      `resist ${fields.resistance}/${fields.resistanceMax}`,
      `dmg    ${fields.attackDamage}`,
    ].join('\n');
  }
}
