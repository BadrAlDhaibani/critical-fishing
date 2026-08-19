import Phaser from 'phaser';
import {
  INTERNAL_WIDTH,
  INTERNAL_HEIGHT,
  WATER_LINE_Y,
  BOAT_WIDTH,
  BOAT_HEIGHT,
  FISH_WIDTH,
  FISH_HEIGHT,
  COLOUR_WATER,
  COLOUR_SURFACE,
  COLOUR_BOAT,
  COLOUR_FISH,
  COLOUR_LINE,
} from '../../data/config.ts';
import { FixedStepDriver, TICK_HZ, lerp } from '../../sim/loop.ts';
import { stepFight } from '../../sim/fight.ts';
import { lineLength } from '../../sim/distance.ts';
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
  private fish!: Phaser.GameObjects.Rectangle;
  private line!: Phaser.GameObjects.Graphics;

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

    // Added before the boat and fish so it draws underneath both, and the
    // endpoints disappear into the hull and the body rather than crossing them.
    this.line = this.add.graphics();

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

    // Depth is measured down from the surface, so the waterline is the origin
    // the simulation's vertical axis is expressed against. This is the only
    // place that conversion happens.
    this.fish = this.add.rectangle(
      initialState.fish.x,
      WATER_LINE_Y + initialState.fish.depth,
      FISH_WIDTH,
      FISH_HEIGHT,
      COLOUR_FISH,
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

    const boatX = lerp(previous.boat.x, current.boat.x, alpha);
    const fishX = lerp(previous.fish.x, current.fish.x, alpha);
    const fishY =
      WATER_LINE_Y + lerp(previous.fish.depth, current.fish.depth, alpha);

    this.boat.x = boatX;
    this.fish.x = fishX;
    this.fish.y = fishY;

    // Redrawn every frame from the same interpolated values the two rectangles
    // use, so the line can never sit a frame behind the things it connects.
    // The boat end is the waterline rather than the hull centre, because the
    // line goes into the water, not through the boat.
    this.line.clear();
    this.line.lineStyle(1, COLOUR_LINE);
    this.line.lineBetween(boatX, WATER_LINE_Y, fishX, fishY);

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
      // From the simulation state, not from the interpolated render positions.
      // The readout is there to show what the fight is actually working with.
      lineLength: lineLength(
        this.driver.current.boat,
        this.driver.current.fish,
      ),
    });
  }
}
