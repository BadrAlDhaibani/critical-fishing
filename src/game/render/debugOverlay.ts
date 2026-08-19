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
  /** Ticks since boot. */
  totalTicks: number;
  /**
   * Current boat-to-fish distance in internal units. On screen during the
   * tuning pass because damage scales off it and the distance bands are cut
   * out of it, so it needs to be readable while moving.
   */
  lineLength: number;
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
    this.element.textContent = [
      `${fields.resolution} @ ${fields.zoom}x`,
      `render ${Math.round(fields.fps)} fps`,
      `sim    ${fields.tickRate.toFixed(1)}/${fields.targetTickRate} ticks/s`,
      `ticks  ${fields.totalTicks}`,
      `line   ${fields.lineLength.toFixed(1)} u`,
    ].join('\n');
  }
}
