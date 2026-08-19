import Phaser from 'phaser';
import {
  INTERNAL_WIDTH,
  INTERNAL_HEIGHT,
  WATER_LINE_Y,
  BOAT_WIDTH,
  BOAT_HEIGHT,
  COLOUR_WATER,
  COLOUR_SURFACE,
  COLOUR_BOAT,
} from '../../data/config.ts';
import { FixedStepDriver, TICK_HZ, lerp } from '../../sim/loop.ts';
import { stepFight } from '../../sim/fight.ts';
import { createFightState, noInputs } from '../../sim/state.ts';
import type { FightInputs, FightState } from '../../sim/state.ts';
import {
  createFightControls,
  readFightInputs,
  type FightControls,
} from '../input/keyboard.ts';
import { DebugOverlay } from '../render/debugOverlay.ts';

/**
 * Draws a fight and forwards input to it. Owns no game logic whatsoever: every
 * number that matters comes out of sim/, and this class only decides where on
 * the screen to put it.
 */
export class FightScene extends Phaser.Scene {
  private driver!: FixedStepDriver<FightState>;
  private controls!: FightControls;
  private inputs: FightInputs = noInputs();

  private boat!: Phaser.GameObjects.Rectangle;

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

    this.controls = createFightControls(this);

    const initialState = createFightState();
    this.driver = new FixedStepDriver<FightState>(initialState, (state) =>
      stepFight(state, this.inputs),
    );

    // Sits on the surface rather than in it, so the waterline reads as the
    // thing the boat is floating on. Only x is simulated; y is a render
    // constant, because the boat has one axis.
    this.boat = this.add.rectangle(
      initialState.boat.x,
      WATER_LINE_Y - BOAT_HEIGHT / 2,
      BOAT_WIDTH,
      BOAT_HEIGHT,
      COLOUR_BOAT,
    );

    this.overlay = new DebugOverlay();
  }

  update(_time: number, delta: number): void {
    // Sampled once per frame, deliberately. A frame that runs several catch-up
    // ticks applies this same snapshot to all of them, which is correct: keys
    // cannot change part way through a frame, so there is nothing finer to
    // read even if the ticks would accept it.
    this.inputs = readFightInputs(this.controls);

    this.driver.advance(delta);

    const { previous, current, alpha } = this.driver;
    this.boat.x = lerp(previous.boat.x, current.boat.x, alpha);

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
