import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { TIERS, MAX_DROP_TIER, DROP_WEIGHTS } from '../config/tiers.js';
import { Storage, todayStr } from '../storage.js';
import { skinById } from '../config/skins.js';
import { Sfx } from '../sfx.js';
import { sprinkleStars } from './MenuScene.js';

// deterministic RNG so every player gets the same daily-challenge drop order
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const JAR = {
  left: 48,
  right: GAME_WIDTH - 48,
  floor: GAME_HEIGHT - 46,
  top: 200, // wall tops / overflow line
  wall: 14,
};
const DROP_Y = 120;
const DANGER_SECONDS = 2.5; // settled above the line this long = game over
const CHAIN_WINDOW_MS = 1200;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.isDaily = !!data?.daily;
    if (this.isDaily) {
      const day = todayStr();
      let seed = 0;
      for (const ch of day) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
      this.rand = mulberry32(seed);
    } else {
      this.rand = Math.random;
    }
  }

  create() {
    this.palette = skinById(Storage.getEquippedSkin()).palette;
    this.score = 0;
    this.merges = 0;
    this.highestTier = 0;
    this.chainCount = 0;
    this.lastMergeAt = 0;
    this.dangerTimer = 0;
    this.gameOver = false;
    this.canDrop = true;
    this.tiltPhase = 0;
    this.pieces = this.add.group();

    sprinkleStars(this);
    this.drawJar();

    // physics walls
    const opts = { isStatic: true, friction: 0.4 };
    const wallH = JAR.floor - JAR.top;
    this.matter.add.rectangle(
      JAR.left - JAR.wall / 2, JAR.top + wallH / 2, JAR.wall, wallH, opts
    );
    this.matter.add.rectangle(
      JAR.right + JAR.wall / 2, JAR.top + wallH / 2, JAR.wall, wallH, opts
    );
    this.matter.add.rectangle(
      GAME_WIDTH / 2, JAR.floor + JAR.wall / 2, GAME_WIDTH, JAR.wall, opts
    );

    // HUD
    this.scoreText = this.add.text(16, 14, 'Score: 0', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '24px', color: '#ffffff',
    });
    this.add.text(16, 46, `Best: ${Storage.getBest()}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#9aa7c7',
    });
    this.add.text(GAME_WIDTH - 16, 14, 'NEXT', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#9aa7c7',
    }).setOrigin(1, 0);
    if (this.isDaily) {
      this.add
        .text(GAME_WIDTH / 2, 24, `DAILY · ${todayStr()}`, {
          fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#ffd54f',
        })
        .setOrigin(0.5);
    }
    this.chainText = this.add
      .text(GAME_WIDTH / 2, 300, '', {
        fontFamily: 'Arial Black, sans-serif', fontSize: '34px', color: '#ffd54f',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // gravity/tilt indicator
    this.tiltArrow = this.add
      .text(GAME_WIDTH / 2, 60, '⬇', { fontSize: '28px', color: '#80deea' })
      .setOrigin(0.5);

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
  }

  drawJar() {
    const g = this.add.graphics();
    g.lineStyle(4, 0x4a5580, 1);
    g.strokeRect(
      JAR.left - JAR.wall, JAR.top, JAR.right - JAR.left + JAR.wall * 2,
      JAR.floor - JAR.top + JAR.wall
    );
    // dashed red line reads as "threat" even at rest (week-1 finding: solid
    // 0.25-alpha line was invisible behind the jar stroke)
    this.dangerLine = this.add.graphics();
    this.dangerLine.lineStyle(3, 0xef5350, 1);
    for (let dx = JAR.left; dx < JAR.right; dx += 24) {
      this.dangerLine.lineBetween(dx, JAR.top, Math.min(dx + 14, JAR.right), JAR.top);
    }
    this.dangerLine.setAlpha(0.55);
  }

  rollTier() {
    const total = DROP_WEIGHTS.reduce((a, b) => a + b, 0);
    let roll = Math.floor(this.rand() * total) + 1;
    for (let i = 0; i <= MAX_DROP_TIER; i++) {
      roll -= DROP_WEIGHTS[i];
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
      .image(GAME_WIDTH - 40, 64, TIERS[this.nextTier].key)
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
    const tier = this.currentTier;
    this.addPiece(this.held.x, DROP_Y, tier);
    this.held.destroy();
    this.held = null;
    this.canDrop = false;
    Sfx.drop();
    // short cooldown keeps "one more drop" rhythm without spam-stacking at the line
    this.time.delayedCall(450, () => {
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
      // decorative ring follows the Ringed Giant
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

    // chain bonus: consecutive merges within the window multiply the payout
    const now = this.time.now;
    this.chainCount = now - this.lastMergeAt < CHAIN_WINDOW_MS ? this.chainCount + 1 : 1;
    this.lastMergeAt = now;
    this.merges++;
    this.highestTier = Math.max(this.highestTier, next);

    const points = Math.round(TIERS[next].score * (1 + 0.5 * (this.chainCount - 1)));
    this.score += points;
    this.scoreText.setText(`Score: ${this.score}`);

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
    // escalating screen shake = the shareable chain-reaction drama
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

  update(_, deltaMs) {
    if (this.gameOver) return;
    const dt = deltaMs / 1000;

    // THE TWIST: gravity slowly oscillates, tilting the pile. Amplitude grows
    // with merges so late game gets dramatic while the first minutes stay calm.
    this.tiltPhase += dt;
    const maxTiltDeg = Math.min(6 + this.merges * 0.2, 16);
    const angle = Math.sin(this.tiltPhase * 0.45) * Phaser.Math.DegToRad(maxTiltDeg);
    this.matter.world.setGravity(Math.sin(angle), Math.cos(angle));
    this.tiltArrow.setRotation(angle);

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
      if (this.dangerTimer >= DANGER_SECONDS) this.endGame();
    } else {
      this.dangerTimer = 0;
      this.dangerLine.setAlpha(0.55);
    }
  }

  endGame() {
    this.gameOver = true;
    this.matter.world.setGravity(0, 1);
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
      })
    );
  }
}
