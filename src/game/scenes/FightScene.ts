import Phaser from 'phaser';
import {
  INTERNAL_WIDTH,
  INTERNAL_HEIGHT,
  WATER_LINE_Y,
  COLOUR_WATER,
  COLOUR_SURFACE,
} from '../../data/config.ts';
import { FixedStepDriver, TICK_HZ, lerp } from '../../sim/loop.ts';
import { DebugOverlay } from '../render/debugOverlay.ts';

/**
 * TEMPORARY, task 1.2 only.
 *
 * There is no fight state yet. This stands in for one so the fixed timestep can
 * be confirmed by eye as well as by test. Task 1.3 replaces all of it with the
 * real boat, and everything marked TEMPORARY below goes with it.
 */
interface DebugState {
  tick: number;
  x: number;
}

const DEBUG_SWEEP_TICKS = 180;
const DEBUG_MARKER_SIZE = 10;

function debugStep(state: DebugState): DebugState {
  const tick = state.tick + 1;
  const phase = (tick / DEBUG_SWEEP_TICKS) * Math.PI * 2;
  return {
    tick,
    x: INTERNAL_WIDTH / 2 + Math.sin(phase) * (INTERNAL_WIDTH / 2 - 40),
  };
}

export class FightScene extends Phaser.Scene {
  private driver!: FixedStepDriver<DebugState>;

  // TEMPORARY: the interpolated marker is what the game will actually do. The
  // snapped one ignores alpha and jumps a whole tick at a time, so the two side
  // by side show whether interpolation is really running.
  private smoothMarker!: Phaser.GameObjects.Rectangle;
  private snappedMarker!: Phaser.GameObjects.Rectangle;

  private overlay!: DebugOverlay;
  private elapsedMs = 0;

  constructor() {
    super('FightScene');
  }

  create(): void {
    const waterHeight = INTERNAL_HEIGHT - WATER_LINE_Y;

    this.add
      .rectangle(0, WATER_LINE_Y, INTERNAL_WIDTH, waterHeight, COLOUR_WATER)
      .setOrigin(0, 0);

    this.add
      .rectangle(0, WATER_LINE_Y, INTERNAL_WIDTH, 1, COLOUR_SURFACE)
      .setOrigin(0, 0);

    this.driver = new FixedStepDriver<DebugState>(
      { tick: 0, x: INTERNAL_WIDTH / 2 },
      debugStep,
    );

    this.smoothMarker = this.add.rectangle(
      INTERNAL_WIDTH / 2,
      WATER_LINE_Y - 16,
      DEBUG_MARKER_SIZE,
      DEBUG_MARKER_SIZE,
      0xffcc44,
    );
    this.snappedMarker = this.add.rectangle(
      INTERNAL_WIDTH / 2,
      WATER_LINE_Y - 32,
      DEBUG_MARKER_SIZE,
      DEBUG_MARKER_SIZE,
      0x995533,
    );

    this.overlay = new DebugOverlay();
  }

  update(_time: number, delta: number): void {
    this.driver.advance(delta);

    const { previous, current, alpha } = this.driver;
    this.smoothMarker.x = lerp(previous.x, current.x, alpha);
    this.snappedMarker.x = current.x;

    this.updateReadout(delta);
  }

  private updateReadout(delta: number): void {
    this.elapsedMs += delta;

    // Long-run average rather than a count bucketed into one-second windows. A
    // bucket boundary never lands on a tick boundary, so the count flickers
    // between 60 and 61 and looks like a fault that is not there. An average
    // settles on 60.0, and real drift shows up as it sliding off that.
    const seconds = this.elapsedMs / 1000;
    const tickRate = seconds > 0 ? this.driver.totalTicks / seconds : 0;

    this.overlay.update({
      resolution: `${INTERNAL_WIDTH}x${INTERNAL_HEIGHT}`,
      zoom: this.scale.zoom,
      fps: this.game.loop.actualFps,
      tickRate,
      targetTickRate: TICK_HZ,
      totalTicks: this.driver.totalTicks,
    });
  }
}
