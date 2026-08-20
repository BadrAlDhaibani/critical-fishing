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
  COLOUR_BAR_HULL,
  COLOUR_BAR_LINE,
  COLOUR_BAR_RESISTANCE,
  BAR_WIDTH,
  BAR_HEIGHT,
  BAR_MARGIN,
  BAR_GAP,
} from '../../data/config.ts';
import { FixedStepDriver, TICK_HZ, lerp } from '../../sim/loop.ts';
import { stepFight } from '../../sim/fight.ts';
import { lineLength } from '../../sim/distance.ts';
import { basicAttackDamage } from '../../sim/damage.ts';
import { createFightState, noInputs } from '../../sim/state.ts';
import type { FightInputs, FightState } from '../../sim/state.ts';
import {
  createFightControls,
  readFightInputs,
  type FightControls,
} from '../input/keyboard.ts';
import { DebugOverlay } from '../render/debugOverlay.ts';
import { Bar } from '../render/bars.ts';
import { Telegraph } from '../render/telegraph.ts';
import { Projectiles } from '../render/projectiles.ts';

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
  private telegraph!: Telegraph;
  private projectiles!: Projectiles;

  private hullBar!: Bar;
  private lineBar!: Bar;
  private resistanceBar!: Bar;

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

    // Underneath them for the same reason. A solid hitbox drawn over the boat
    // would hide the thing the player is trying to move out of it.
    this.telegraph = new Telegraph(this);

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

    // Over the fish and the water but under nothing else, so a shot climbing
    // past the fish that fired it stays readable. It is the one thing on screen
    // the player has to track continuously.
    this.projectiles = new Projectiles(this);

    // Both sides' bars live in the sky above the waterline: the player's
    // stacked at the left, the fish's at the right, so the fight reads as one
    // against the other and neither ever moves.
    this.hullBar = new Bar(this, BAR_MARGIN, BAR_MARGIN, COLOUR_BAR_HULL);
    this.lineBar = new Bar(
      this,
      BAR_MARGIN,
      BAR_MARGIN + BAR_HEIGHT + BAR_GAP,
      COLOUR_BAR_LINE,
    );
    this.resistanceBar = new Bar(
      this,
      INTERNAL_WIDTH - BAR_MARGIN - BAR_WIDTH,
      BAR_MARGIN,
      COLOUR_BAR_RESISTANCE,
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

    // Phase off the current simulation state, position off the interpolated
    // values: which phase the fish is in is a discrete fact that must not be
    // smeared across a frame, but where the box sits has to agree with the fish
    // drawn at the same instant.
    this.telegraph.show(
      this.driver.current.fish.attackPhase,
      this.driver.current.fish.attackKind,
      fishX,
      fishY,
    );

    // Not interpolated, unlike the boat and the fish: shots appear and vanish,
    // so there is no stable pairing between one tick's list and the next's.
    this.projectiles.show(this.driver.current.projectiles);

    this.updateBars();
    this.updateReadout(delta);
  }

  /**
   * Read straight off the current simulation state, not interpolated like the
   * positions above. A resource that drops in one tick should snap: smearing it
   * across a frame blunts exactly the impact that phase 2's hit stop and hit
   * flash exist to sharpen. Nothing moves any of these three yet.
   */
  private updateBars(): void {
    const { boat, fish } = this.driver.current;

    this.hullBar.set(boat.hull, boat.hullMax);
    this.lineBar.set(boat.line, boat.lineMax);
    this.resistanceBar.set(fish.resistance, fish.resistanceMax);
  }

  private updateReadout(delta: number): void {
    this.elapsedMs += delta;

    // Long-run average rather than a count bucketed into one-second windows. A
    // bucket boundary never lands on a tick boundary, so the count flickers
    // between 60 and 61 and looks like a fault that is not there. An average
    // settles on 60.0, and real drift shows up as it sliding off that.
    const seconds = this.elapsedMs / 1000;
    const tickRate = seconds > 0 ? this.driver.totalTicks / seconds : 0;

    const { boat, fish } = this.driver.current;
    const tether = lineLength(boat, fish);

    this.overlay.update({
      resolution: `${INTERNAL_WIDTH}x${INTERNAL_HEIGHT}`,
      zoom: this.scale.zoom,
      fps: this.game.loop.actualFps,
      tickRate,
      targetTickRate: TICK_HZ,
      totalTicks: this.driver.totalTicks,
      hull: boat.hull,
      hullMax: boat.hullMax,
      stamina: boat.line,
      staminaMax: boat.lineMax,
      // From the simulation state, not from the interpolated render positions.
      // The readout is there to show what the fight is actually working with.
      lineLength: tether,
      // Off the state rather than recomputed from the tether above it. The band
      // has hysteresis, so it depends on the band before it and there is no
      // second opinion to be had: asking again here could only disagree.
      band: fish.band,
      resistance: fish.resistance,
      resistanceMax: fish.resistanceMax,
      // The same function the simulation charges the fish with, so the number
      // on screen is a prediction of the next hit rather than a second opinion
      // about it.
      attackDamage: basicAttackDamage(tether),
      fishPhase: fish.attackPhase,
      // Whichever counter is actually running. While idle the phase has no
      // duration and the cooldown is the thing ticking down towards the next
      // attack, so showing the phase's own zero would say nothing.
      fishPhaseTicks:
        fish.attackPhase === 'idle'
          ? fish.attackCooldownRemaining
          : fish.attackPhaseTicksRemaining,
      fishAttackKind: fish.attackKind,
      projectiles: this.driver.current.projectiles.length,
    });
  }
}
