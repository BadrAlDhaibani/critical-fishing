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
  COLOUR_ENDING_ESCAPED,
  COLOUR_ENDING_LANDED,
  COLOUR_REEL_IN_LINE,
  ENDING_TINT_ALPHA,
  REEL_IN_LINE_WIDTH,
  BAR_WIDTH,
  BAR_HEIGHT,
  BAR_MARGIN,
  BAR_GAP,
  SHAKE_MAX_AMPLITUDE,
  COLOUR_HIT_FLASH,
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
import { Shake } from '../feel/shake.ts';
import { Flash } from '../feel/flash.ts';
import { ImpactWatcher } from '../feel/impacts.ts';
import { CueWatcher, type FightAudioPlayer } from '../audio/cues.ts';
import { createFightAudio } from '../audio/synth.ts';
import { CueAudition } from '../audio/audition.ts';

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

  private endingTint!: Phaser.GameObjects.Rectangle;

  /**
   * The shake, and the thing that notices there was something to shake about.
   *
   * Fields on the scene rather than render objects, because neither draws
   * anything: one reports that a pool dropped and the other says where to put
   * the camera. The scene is what owns the camera and the simulation state, so
   * it is the only place the two can be joined up.
   */
  private readonly shake = new Shake();
  private impacts!: ImpactWatcher;

  /**
   * One flash each, because the two are independent and regularly overlap: the
   * player's attack and the fish's land in the same tick often enough that a
   * shared counter would let one cut the other short.
   */
  private readonly boatFlash = new Flash();
  private readonly fishFlash = new Flash();

  /**
   * The audio layer, split the same way the effects are: `cues` decides what
   * should be heard and `audio` makes the noise. The player is built once in
   * `create`, because it owns a gain node on Phaser's audio graph and a fresh one
   * per fight would leak one per restart.
   */
  private audio!: FightAudioPlayer;
  private cues!: CueWatcher;

  private overlay!: DebugOverlay;
  private elapsedMs = 0;

  constructor() {
    super('FightScene');
  }

  create(): void {
    const waterHeight = INTERNAL_HEIGHT - WATER_LINE_Y;

    // Overdrawn by one shake's worth on the left, right and bottom, so the
    // camera offset can never pull an edge of the water into view and flash the
    // canvas background through it. The sky above the waterline needs no such
    // margin: it *is* the background, and scrolling reveals more of the same.
    //
    // A margin rather than a taller rectangle everywhere, because this is the
    // one number that has to agree with how far the camera is allowed to move.
    const bleed = SHAKE_MAX_AMPLITUDE;

    this.add
      .rectangle(
        -bleed,
        WATER_LINE_Y,
        INTERNAL_WIDTH + bleed * 2,
        waterHeight + bleed,
        COLOUR_WATER,
      )
      .setOrigin(0, 0);

    this.add
      .rectangle(
        -bleed,
        WATER_LINE_Y,
        INTERNAL_WIDTH + bleed * 2,
        1,
        COLOUR_SURFACE,
      )
      .setOrigin(0, 0);

    this.controls = createFightControls(this);

    // Before `startFight`, which seeds the cue watcher off the first state.
    this.audio = createFightAudio(this);

    this.startFight();
    const initialState = this.driver.current;

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

    // Added last, so it washes over the bars as well as the fight. The alpha
    // leaves both readable underneath: the empty bar and the position the boat
    // died in are the information the player actually wants out of an ending.
    this.endingTint = this.add
      .rectangle(
        0,
        0,
        INTERNAL_WIDTH,
        INTERNAL_HEIGHT,
        COLOUR_ENDING_ESCAPED,
        ENDING_TINT_ALPHA,
      )
      .setOrigin(0, 0)
      // Pinned to the camera rather than to the world, so a shake still running
      // from the killing blow cannot drag a gap in at the edges. It should not
      // shake with the fight anyway: the wash is the game addressing the player
      // directly, and it is the one thing on screen that is not in the water.
      .setScrollFactor(0)
      .setVisible(false);

    this.overlay = new DebugOverlay();

    // Wired once and never spoken to again: the panel owns its own buttons and
    // drives the audio player directly, so there is nothing for `update` to do.
    // Tuning tooling for task 2.5, and it plays through the same seam the fight
    // does so the two can never be levelled differently.
    new CueAudition(this.audio);
  }

  /**
   * Point the driver at a brand new fight.
   *
   * Rebuilt rather than reset, so `previous` is seeded with the fresh state too
   * and no frame interpolates the boat from where the last fight ended to where
   * the next one begins.
   *
   * The step closure reads `this.inputs` at call time rather than capturing a
   * snapshot, so it survives being made once here and used for every fight.
   */
  private startFight(): void {
    this.driver = new FixedStepDriver<FightState>(createFightState(), (state) =>
      stepFight(state, this.inputs),
    );

    // Rebuilt alongside the driver for the same reason it is: the watcher holds
    // the last hull and resistance it saw, and a new fight refills both. Left
    // alone it would read the first real hit of the new fight against the old
    // fight's numbers.
    this.impacts = new ImpactWatcher(this.driver.current);

    // Rebuilt for the same reason, and it matters more here: the watcher holds
    // the last stage it saw. Left alone across a restart it would be holding
    // `escaped` while the new fight is `fighting`, and the next loss would be
    // silent because the stage never appeared to change.
    this.cues = new CueWatcher(this.driver.current);

    // A shake or a flash still running from the killing blow of the last fight
    // must not open the next one moving or lit. Restarting is an instant cut,
    // the same as the ending wash it is dismissing.
    this.shake.reset();
    this.boatFlash.reset();
    this.fishFlash.reset();

    // Reset alongside `totalTicks`, which the driver has just taken back to
    // zero. Left alone, the tick rate would be a fresh fight's ticks divided by
    // every second since the page loaded, and would read as permanent drift.
    this.elapsedMs = 0;
  }

  update(_time: number, delta: number): void {
    // Sampled once per frame, deliberately. A frame that runs several catch-up
    // ticks applies this same snapshot to all of them, which is correct: keys
    // cannot change part way through a frame, so there is nothing finer to
    // read even if the ticks would accept it.
    this.inputs = readFightInputs(this.controls);

    // Only once a fight is over, so a hand still on the controls cannot rage
    // restart one that is going badly. Read straight off the key rather than
    // through FightInputs: restarting is the scene's business, not the
    // simulation's, so `JustDown` at frame rate is the right resolution for it.
    if (
      this.driver.current.stage !== 'fighting' &&
      Phaser.Input.Keyboard.JustDown(this.controls.restart)
    ) {
      this.startFight();
    }

    this.driver.advance(delta);

    // Sampled after the step, so a hit landed this frame shakes from this frame
    // rather than the next one. Every impact triggers, and `trigger` takes the
    // larger rather than adding, so trading blows is one shake.
    //
    // The same list drives the flash, which is what `target` on an impact has
    // been carried for since 2.2. The shake says how hard and the flash says
    // which of the two it happened to, so one screen-wide effect and one local
    // one split the reading between them rather than both saying the same thing.
    const impacts = this.impacts.sample(this.driver.current);

    for (const impact of impacts) {
      this.shake.trigger(impact.damage);

      if (impact.target === 'boat') {
        this.boatFlash.trigger();
      } else {
        this.fishFlash.trigger();
      }
    }

    // The same impacts again rather than a second reading of the state, so the
    // ear and the eye can never disagree about what just happened. The watcher
    // adds only what damage cannot show: the fish committing to an attack, and
    // the fight being lost.
    for (const cue of this.cues.sample(this.driver.current, impacts)) {
      this.audio.play(cue);
    }

    // Moving the camera rather than the objects, so everything drawn moves
    // together and nothing has to know the effect exists. Whole units only: at a
    // 4x nearest-neighbour zoom a fractional scroll puts every edge between
    // physical pixels and shimmers, and `Shake` is what guarantees that.
    const offset = this.shake.update(delta);
    this.cameras.main.setScroll(offset.x, offset.y);

    const { previous, current, alpha } = this.driver;
    const { stage } = current;
    const fighting = stage === 'fighting';

    const boatX = lerp(previous.boat.x, current.boat.x, alpha);
    const fishX = lerp(previous.fish.x, current.fish.x, alpha);
    const fishY =
      WATER_LINE_Y + lerp(previous.fish.depth, current.fish.depth, alpha);

    this.boat.x = boatX;
    this.fish.x = fishX;
    this.fish.y = fishY;

    // Pure white for two frames on being struck, design.md section 6 taken
    // literally. Set every frame rather than only on the transition: the fill is
    // this scene's to own, nothing else writes to it, and a flash that had to be
    // switched off by a matching call would eventually be left on by a path that
    // forgot to make one.
    this.boat.setFillStyle(
      this.boatFlash.update(delta) ? COLOUR_HIT_FLASH : COLOUR_BOAT,
    );
    this.fish.setFillStyle(
      this.fishFlash.update(delta) ? COLOUR_HIT_FLASH : COLOUR_FISH,
    );

    // Redrawn every frame from the same interpolated values the two rectangles
    // use, so the line can never sit a frame behind the things it connects.
    // The boat end is the waterline rather than the hull centre, because the
    // line goes into the water, not through the boat.
    //
    // Thicker and in its own colour through the reel-in. design.md pillar 4
    // makes the line the identity and the reel-in is the beat that is entirely
    // about it, so the stub is drawn there. It is also the only thing moving
    // during those two seconds, and without it a frozen fight would read as a
    // hang rather than as a final run.
    this.line.clear();
    this.line.lineStyle(
      stage === 'reelIn' ? REEL_IN_LINE_WIDTH : 1,
      stage === 'reelIn' ? COLOUR_REEL_IN_LINE : COLOUR_LINE,
    );
    this.line.lineBetween(boatX, WATER_LINE_Y, fishX, fishY);

    // Phase off the current simulation state, position off the interpolated
    // values: which phase the fish is in is a discrete fact that must not be
    // smeared across a frame, but where the box sits has to agree with the fish
    // drawn at the same instant.
    //
    // Nothing dangerous is drawn once the fight is over. The simulation keeps an
    // honest frozen snapshot of what the fish was in the middle of, which is what
    // phase 4's record book will want, but a telegraph is a promise that
    // something is about to hurt you and a fight that has ended cannot keep it.
    // Hiding it here rather than blanking the fish in sim/ is the cheaper half of
    // that, and the half that does not lie about what happened.
    this.telegraph.show(
      fighting ? current.fish.attackPhase : 'idle',
      fighting ? current.fish.attackKind : null,
      fishX,
      fishY,
    );

    // Not interpolated, unlike the boat and the fish: shots appear and vanish,
    // so there is no stable pairing between one tick's list and the next's.
    // Cleared once the fight is over for the same reason the telegraph is: they
    // are frozen mid-flight and can no longer resolve against anything.
    this.projectiles.show(fighting ? current.projectiles : []);

    // Only the two endings wash the screen. The reel-in is still the fight being
    // looked at, and the line above is what marks it.
    const ended = stage === 'landed' || stage === 'escaped';
    this.endingTint.setVisible(ended);
    if (ended) {
      // Alpha passed every time, because Phaser's setFillStyle resets it to
      // fully opaque when it is left out, which would black the fight out
      // completely rather than washing over it.
      this.endingTint.setFillStyle(
        stage === 'landed' ? COLOUR_ENDING_LANDED : COLOUR_ENDING_ESCAPED,
        ENDING_TINT_ALPHA,
      );
    }

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

    const { boat, fish, stage, stageTicksRemaining } = this.driver.current;
    const tether = lineLength(boat, fish);

    this.overlay.update({
      resolution: `${INTERNAL_WIDTH}x${INTERNAL_HEIGHT}`,
      zoom: this.scale.zoom,
      fps: this.game.loop.actualFps,
      tickRate,
      targetTickRate: TICK_HZ,
      totalTicks: this.driver.totalTicks,
      stage,
      stageTicks: stageTicksRemaining,
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
      shakeAmplitude: this.shake.current,
    });
  }
}
