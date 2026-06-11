import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT } from '../constants.js';
import { TIERS, MAX_DROP_TIER, DROP_STAGES, ESCALATION_DROPS } from '../config/tiers.js';
import { Storage, todayStr } from '../storage.js';
import { skinById } from '../config/skins.js';
import { Sfx, Music } from '../sfx.js';
import { Ads, track } from '../ads.js';
import { mulberry32, daySeed, recordRun, addXp, boxEarnedThisRun } from '../progression.js';
import { sprinkleStars } from './MenuScene.js';

const JAR = {
  left: 66,
  right: GAME_WIDTH - 66,
  floor: GAME_HEIGHT - 76,
  top: 200, // overflow line
  wall: 14,
};
const DROP_Y = 120;
const DANGER_SECONDS = 2.0; // settled above the line this long = game over
const CHAIN_WINDOW_MS = 1200;
const DROP_COOLDOWN_MS = 400;

// gravity storm pacing (seconds)
const STORM = { first: 40, gapMin: 35, gapMax: 50, warn: 3, length: 6 };

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.isDaily = !!data?.daily;
    this.rand = this.isDaily ? mulberry32(daySeed(todayStr())) : Math.random;
  }

  create() {
    track('run_start', this.isDaily ? 'daily' : 'classic');
    this.usedSave = false;
    this.palette = skinById(Storage.getEquippedSkin()).palette;
    this.score = 0;
    this.merges = 0;
    this.dropCount = 0;
    this.highestTier = 0;
    this.chainCount = 0;
    this.maxChain = 0;
    this.lastMergeAt = 0;
    this.dangerTimer = 0;
    this.lastHeartbeat = 0;
    this.gameOver = false;
    this.canDrop = true;
    this.pieces = this.add.group();

    // storms: calm -> warning(3s) -> storm(6s) -> calm
    this.stormPhase = 'calm';
    this.stormClock = STORM.first;
    this.stormsSurvived = 0;

    sprinkleStars(this);
    this.drawJar();

    // physics walls run from the very top of the screen so pieces can never
    // enter or leave the jar from the sides (on-device bug: edge drops + drift
    // could put pieces outside the playfield)
    const opts = { isStatic: true, friction: 0.4 };
    this.matter.add.rectangle(
      JAR.left - JAR.wall / 2, JAR.floor / 2, JAR.wall, JAR.floor, opts
    );
    this.matter.add.rectangle(
      JAR.right + JAR.wall / 2, JAR.floor / 2, JAR.wall, JAR.floor, opts
    );
    this.matter.add.rectangle(
      GAME_WIDTH / 2, JAR.floor + JAR.wall / 2, GAME_WIDTH, JAR.wall, opts
    );
    this.matter.world.setGravity(0, 1);

    // HUD
    this.scoreText = this.add.text(16, 12, 'Score: 0', {
      fontFamily: FONT, fontStyle: 'bold', fontSize: '26px', color: '#ffffff',
    });
    this.add.text(16, 44, `Best: ${Storage.getBest()}`, {
      fontFamily: FONT, fontSize: '16px', color: '#9aa7c7',
    });
    // escalation "pressure" pips
    this.pips = [];
    for (let i = 0; i < DROP_STAGES.length - 1; i++) {
      this.pips.push(
        this.add.circle(22 + i * 18, 78, 5, 0x4a5580).setAlpha(0.6)
      );
    }
    this.add.text(GAME_WIDTH - 16, 12, 'NEXT', {
      fontFamily: FONT, fontSize: '14px', color: '#9aa7c7',
    }).setOrigin(1, 0);
    if (this.isDaily) {
      this.add
        .text(GAME_WIDTH / 2, 22, `DAILY · ${todayStr()}`, {
          fontFamily: FONT, fontSize: '15px', color: '#ffd54f',
        })
        .setOrigin(0.5);
    }
    this.chainText = this.add
      .text(GAME_WIDTH / 2, 300, '', {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '36px', color: '#ffd54f',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // storm banner (hidden while calm)
    this.stormText = this.add
      .text(GAME_WIDTH / 2, 60, '', {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '24px', color: '#ef5350',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.nextTier = this.rollTier();
    this.spawnHeldPiece();

    // input: move to aim, release to drop
    this.input.on('pointermove', (p) => this.aimAt(p.x));
    this.input.on('pointerdown', (p) => this.aimAt(p.x));
    this.input.on('pointerup', () => this.drop());

    this.matter.world.on('collisionstart', (event) => {
      for (const pair of event.pairs) {
        this.tryMerge(pair.bodyA.gameObject, pair.bodyB.gameObject);
      }
    });

    Music.start();
    Ads.preloadRewarded();
  }

  drawJar() {
    const g = this.add.graphics();
    g.lineStyle(4, 0x4a5580, 1);
    g.strokeRect(
      JAR.left - JAR.wall, JAR.top, JAR.right - JAR.left + JAR.wall * 2,
      JAR.floor - JAR.top + JAR.wall
    );
    // dashed red overflow line
    this.dangerLine = this.add.graphics();
    this.dangerLine.lineStyle(3, 0xef5350, 1);
    for (let dx = JAR.left; dx < JAR.right; dx += 24) {
      this.dangerLine.lineBetween(dx, JAR.top, Math.min(dx + 14, JAR.right), JAR.top);
    }
    this.dangerLine.setAlpha(0.55);
  }

  escalationStage() {
    return Math.min(
      DROP_STAGES.length - 1,
      Math.floor(this.dropCount / ESCALATION_DROPS)
    );
  }

  rollTier() {
    const weights = DROP_STAGES[this.escalationStage()];
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.floor(this.rand() * total) + 1;
    for (let i = 0; i <= MAX_DROP_TIER; i++) {
      roll -= weights[i];
      if (roll <= 0) return i;
    }
    return 0;
  }

  spawnHeldPiece() {
    this.currentTier = this.nextTier;
    this.nextTier = this.rollTier();
    this.held = this.add
      .image(GAME_WIDTH / 2, DROP_Y, TIERS[this.currentTier].key)
      .setAlpha(0.9);
    this.nextPreview?.destroy();
    this.nextPreview = this.add
      .image(GAME_WIDTH - 40, 62, TIERS[this.nextTier].key)
      .setScale(0.45);
    this.aimAt(this.held.x);
  }

  aimAt(x) {
    if (!this.held || this.gameOver) return;
    const r = TIERS[this.currentTier].radius;
    this.held.x = Phaser.Math.Clamp(x, JAR.left + r, JAR.right - r);
  }

  drop() {
    if (!this.held || !this.canDrop || this.gameOver) return;
    this.addPiece(this.held.x, DROP_Y, this.currentTier);
    this.held.destroy();
    this.held = null;
    this.canDrop = false;
    this.dropCount++;
    const stage = this.escalationStage();
    this.pips.forEach((p, i) =>
      p.setFillStyle(i < stage ? 0xef5350 : 0x4a5580)
    );
    Sfx.drop();
    this.time.delayedCall(DROP_COOLDOWN_MS, () => {
      if (this.gameOver) return;
      this.canDrop = true;
      this.spawnHeldPiece();
    });
  }

  addPiece(x, y, tier) {
    const t = TIERS[tier];
    const piece = this.matter.add.image(x, y, t.key);
    piece.setCircle(t.radius);
    piece.setBounce(0.15);
    piece.setFriction(0.5);
    piece.setData('tier', tier);
    piece.setData('bornAt', this.time.now);
    if (tier === 6) {
      const ring = this.add.image(x, y, 'ring');
      piece.setData('ring', ring);
    }
    this.pieces.add(piece);
    return piece;
  }

  tryMerge(a, b) {
    if (this.gameOver || !a || !b) return;
    const ta = a.getData?.('tier');
    const tb = b.getData?.('tier');
    if (ta === undefined || ta !== tb || ta >= TIERS.length - 1) return;
    if (a.getData('merging') || b.getData('merging')) return;
    a.setData('merging', true);
    b.setData('merging', true);

    const nx = (a.x + b.x) / 2;
    const ny = (a.y + b.y) / 2;
    const next = ta + 1;
    a.getData('ring')?.destroy();
    b.getData('ring')?.destroy();
    a.destroy();
    b.destroy();

    const merged = this.addPiece(nx, ny, next);
    merged.setVelocityY(-2);

    const now = this.time.now;
    this.chainCount = now - this.lastMergeAt < CHAIN_WINDOW_MS ? this.chainCount + 1 : 1;
    this.maxChain = Math.max(this.maxChain, this.chainCount);
    this.lastMergeAt = now;
    this.merges++;
    this.highestTier = Math.max(this.highestTier, next);

    const points = Math.round(TIERS[next].score * (1 + 0.5 * (this.chainCount - 1)));
    this.score += points;
    this.scoreText.setText(`Score: ${this.score}`);
    this.tweens.add({
      targets: this.scoreText, scale: 1.15, duration: 90, yoyo: true,
    });

    Sfx.merge(next, this.chainCount);
    this.juice(nx, ny, next);
    if (this.chainCount >= 2) this.showChain(this.chainCount);
  }

  juice(x, y, tier) {
    const emitter = this.add.particles(x, y, 'dot', {
      speed: { min: 60, max: 220 },
      scale: { start: 0.9, end: 0 },
      lifespan: 450,
      quantity: 8 + tier * 3,
      tint: this.palette[tier],
      emitting: false,
    });
    emitter.explode();
    this.time.delayedCall(600, () => emitter.destroy());
    this.cameras.main.shake(120 + tier * 30, 0.002 + tier * 0.0012);
  }

  showChain(n) {
    this.chainText.setText(`CHAIN x${n}!`).setAlpha(1).setScale(0.5);
    this.tweens.add({
      targets: this.chainText,
      scale: 1,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.easeOut',
    });
  }

  /* ------------------------- gravity storms ------------------------- */

  updateStorm(dt) {
    if (this.stormPhase === 'calm') {
      this.stormClock -= dt;
      if (this.stormClock <= 0) {
        this.stormPhase = 'warning';
        this.stormClock = STORM.warn;
        this.stormText.setAlpha(1);
        Sfx.siren();
      }
      return;
    }

    if (this.stormPhase === 'warning') {
      this.stormClock -= dt;
      this.stormText.setText(`⚠ GRAVITY STORM IN ${Math.ceil(this.stormClock)}`);
      this.stormText.setAlpha(0.5 + 0.5 * Math.abs(Math.sin(this.time.now / 150)));
      if (this.stormClock <= 0) {
        this.stormPhase = 'storm';
        this.stormClock = STORM.length;
        this.stormElapsed = 0;
        this.stormText.setText('⚠ GRAVITY STORM ⚠');
        this.wind = this.add.particles(0, 0, 'dot', {
          x: { min: 0, max: GAME_WIDTH },
          y: { min: JAR.top, max: JAR.floor },
          speedX: { min: 150, max: 320 },
          speedY: 0,
          scale: { start: 0.5, end: 0 },
          lifespan: 500,
          frequency: 35,
          alpha: 0.5,
        });
      }
      return;
    }

    // storm phase: strong oscillating tilt, slightly harder late in the run
    this.stormElapsed += dt;
    this.stormClock -= dt;
    const maxTilt = Math.min(14 + this.merges * 0.1, 22);
    const angle = Math.sin(this.stormElapsed * 3.2) * Phaser.Math.DegToRad(maxTilt);
    this.matter.world.setGravity(Math.sin(angle), Math.cos(angle));
    this.cameras.main.setRotation(angle * 0.18);
    if (this.wind) {
      this.wind.speedX = angle > 0 ? 250 : -250;
    }
    if (this.stormClock <= 0) {
      this.stormPhase = 'calm';
      this.stormClock = STORM.gapMin + Math.random() * (STORM.gapMax - STORM.gapMin);
      this.stormsSurvived++;
      this.matter.world.setGravity(0, 1);
      this.cameras.main.setRotation(0);
      this.wind?.destroy();
      this.wind = null;
      this.stormText.setText('storm passed ✓').setColor('#80deea');
      this.tweens.add({
        targets: this.stormText, alpha: 0, delay: 1200, duration: 500,
        onComplete: () => this.stormText.setColor('#ef5350'),
      });
    }
  }

  /* ------------------------------------------------------------------ */

  update(_, deltaMs) {
    if (this.gameOver) return;
    const dt = deltaMs / 1000;

    this.updateStorm(dt);

    // overflow check: any settled piece above the line starts the countdown
    let inDanger = false;
    for (const piece of this.pieces.getChildren()) {
      const ring = piece.getData('ring');
      if (ring) ring.setPosition(piece.x, piece.y).setRotation(piece.rotation);
      const r = TIERS[piece.getData('tier')].radius;
      const settled = this.time.now - piece.getData('bornAt') > 1000;
      if (settled && piece.y - r < JAR.top && piece.body.speed < 1.2) {
        inDanger = true;
      }
    }

    if (inDanger) {
      this.dangerTimer += dt;
      this.dangerLine.setAlpha(0.4 + 0.6 * Math.abs(Math.sin(this.time.now / 120)));
      if (this.time.now - this.lastHeartbeat > 600) {
        this.lastHeartbeat = this.time.now;
        Sfx.heartbeat();
      }
      if (this.dangerTimer >= DANGER_SECONDS) this.endGame();
    } else {
      this.dangerTimer = 0;
      this.dangerLine.setAlpha(0.55);
    }
  }

  endGame() {
    this.gameOver = true;
    this.matter.world.setGravity(0, 1);
    this.cameras.main.setRotation(0);
    this.wind?.destroy();
    this.wind = null;

    // one rewarded continue per run: the highest-value ad placement
    if (!this.usedSave && Ads.rewardedAvailable()) {
      this.offerSave();
      return;
    }
    this.finishRun();
  }

  offerSave() {
    const cx = GAME_WIDTH / 2;
    const overlay = [
      this.add.rectangle(cx, 400, GAME_WIDTH, GAME_HEIGHT, 0x0b0b1e, 0.75),
      this.add.rectangle(cx, 400, 380, 220, 0x1a1a3e, 0.98)
        .setStrokeStyle(3, 0xffd54f),
      this.add.text(cx, 330, 'JAR FULL!', {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '32px', color: '#ef5350',
      }).setOrigin(0.5),
    ];

    const saveBtn = this.add
      .text(cx, 395, '📺  SAVE ME  (clear 30%)', {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '22px', color: '#80deea',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const giveUp = this.add
      .text(cx, 460, 'give up', {
        fontFamily: FONT, fontSize: '18px', color: '#9aa7c7',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    overlay.push(saveBtn, giveUp);

    let settled = false;
    const close = (rescue) => {
      if (settled) return;
      settled = true;
      overlay.forEach((o) => o.destroy());
      if (rescue) this.rescue();
      else this.finishRun();
    };

    saveBtn.once('pointerup', async () => {
      saveBtn.setText('loading ad…').disableInteractive();
      giveUp.disableInteractive();
      // scene-side failsafe on top of the Ads-module timeout: the overlay can
      // never strand the player (the on-device hang this replaces)
      this.time.delayedCall(10000, () => close(false));
      const earned = await Ads.showRewarded('save');
      close(earned);
    });
    giveUp.once('pointerup', () => close(false));
  }

  rescue() {
    this.usedSave = true;
    const pieces = [...this.pieces.getChildren()].sort((a, b) => a.y - b.y);
    const toRemove = pieces.slice(0, Math.max(1, Math.ceil(pieces.length * 0.3)));
    toRemove.forEach((p) => {
      this.juice(p.x, p.y, p.getData('tier'));
      p.getData('ring')?.destroy();
      p.destroy();
    });
    Sfx.reward();
    this.dangerTimer = 0;
    this.gameOver = false;
    if (!this.held && this.canDrop === false) {
      this.canDrop = true;
      this.spawnHeldPiece();
    }
  }

  finishRun() {
    this.gameOver = true;
    track('run_end', this.isDaily ? 'daily' : 'classic');
    this.cameras.main.flash(400, 239, 83, 80);
    Sfx.over();

    const best = Storage.getBest();
    const isNewBest = this.score > best;
    if (isNewBest) Storage.setBest(this.score);
    const stardust = Math.floor(this.score / 10);
    const stardustTotal = Storage.addStardust(stardust);

    const day = todayStr();
    if (this.isDaily && this.score > Storage.getDailyBest(day)) {
      Storage.setDailyBest(day, this.score);
    }

    // meta progression: missions, XP/level, mystery box
    recordRun({
      score: this.score,
      highestTier: this.highestTier,
      maxChain: this.maxChain,
      storms: this.stormsSurvived,
    });
    const leveled = addXp(this.score);
    const boxEarned = boxEarnedThisRun();

    this.time.delayedCall(500, () =>
      this.scene.start('GameOver', {
        score: this.score,
        best: isNewBest ? this.score : best,
        isNewBest,
        highestTier: this.highestTier,
        stardust,
        stardustTotal,
        isDaily: this.isDaily,
        day,
        leveled,
        boxEarned,
      })
    );
  }
}
