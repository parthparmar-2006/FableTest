import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT } from '../constants.js';
import { TIERS, MAX_DROP_TIER, DROP_STAGES, ESCALATION_DROPS } from '../config/tiers.js';
import { SPECIALS, rollSpecial } from '../config/specials.js';
import { Storage, todayStr } from '../storage.js';
import { skinById } from '../config/skins.js';
import { Sfx, Music, vibrate } from '../sfx.js';
import { Ads, track } from '../ads.js';
import { mulberry32, daySeed, recordRun, addXp, boxEarnedThisRun } from '../progression.js';
import { sprinkleStars } from './MenuScene.js';

const JAR = {
  left: 78,
  right: GAME_WIDTH - 78,
  floor: GAME_HEIGHT - 96,
  top: 200,
  wall: 14,
};
const DROP_Y = 120;
const DANGER_SECONDS = 2.0;
const CHAIN_WINDOW_MS = 1200;
const DROP_COOLDOWN_MS = 300;

const STORM = { first: 40, gapMin: 35, gapMax: 50, warn: 3, length: 6 };
const FEVER = { perMerge: 8, perChain: 5, drainPerSec: 4, lengthSec: 8 };
const POWER = { popMerges: 10, rerollMerges: 6 };

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.isDaily = !!data?.daily;
    this.isRush = !!data?.rush;
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
    this.pendingDrop = false;
    this.pieces = this.add.group();

    // fever
    this.fever = 0;
    this.feverActive = false;
    this.feverT = 0;

    // power-ups
    this.popCharge = 0;
    this.rerollCharge = 0;
    this.popMode = false;

    // micro-goals
    this.goalIdx = 0;
    this.goalsDone = 0;

    // storms
    this.stormPhase = 'calm';
    this.stormClock = STORM.first;
    this.stormsSurvived = 0;

    sprinkleStars(this);
    this.drawJar();

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

    this.buildHud();
    this.nextTier = this.rollTier();
    this.nextSpecial = rollSpecial(this.rand);
    this.spawnHeldPiece();
    this.setGoal();

    const inPowerZone = (p) => p.x < 60 && p.y > 220 && p.y < 380;
    this.input.on('pointerdown', (p) => {
      if (inPowerZone(p)) return; // power buttons handle their own taps
      if (this.popMode) return this.popAt(p.x, p.y);
      this.aimAt(p.x);
    });
    this.input.on('pointermove', (p) => this.aimAt(p.x));
    this.input.on('pointerup', (p) => {
      if (inPowerZone(p) || this.popMode) return;
      this.drop();
    });

    this.matter.world.on('collisionstart', (event) => {
      for (const pair of event.pairs) {
        this.onCollision(pair.bodyA.gameObject, pair.bodyB.gameObject);
      }
    });

    Music.start();
    Music.setIntensity(1);
    Ads.preloadRewarded();

    // per-run discovery celebrations
    this.discovered = new Set();

    // first-run onboarding hint
    if (!Storage.getSeenHint()) {
      this.hint = this.add
        .text(GAME_WIDTH / 2, 168, '← drag to aim · release to drop →', {
          fontFamily: FONT, fontSize: '17px', color: '#cfd8ff',
        })
        .setOrigin(0.5);
      this.tweens.add({
        targets: this.hint, alpha: 0.4, duration: 600, yoyo: true, repeat: -1,
      });
    }
  }

  togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.matter.world.pause();
      this.tweens.pauseAll();
      this.time.paused = true;
      Sfx.ui();
      this.pauseUi = [
        this.add.rectangle(GAME_WIDTH / 2, 400, GAME_WIDTH, GAME_HEIGHT, 0x0b0b1e, 0.8),
        this.add.text(GAME_WIDTH / 2, 300, 'PAUSED', {
          fontFamily: FONT, fontStyle: 'bold', fontSize: '40px', color: '#80deea',
        }).setOrigin(0.5),
      ];
      const mk = (y, label, color, fn) => {
        const t = this.add
          .text(GAME_WIDTH / 2, y, label, {
            fontFamily: FONT, fontStyle: 'bold', fontSize: '24px', color,
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        t.on('pointerup', fn);
        this.pauseUi.push(t);
      };
      mk(390, '▶ RESUME', '#ffffff', () => this.togglePause());
      mk(455, '↻ RESTART', '#ffd54f', () => {
        this.time.paused = false;
        this.scene.restart({ daily: this.isDaily, rush: this.isRush });
      });
      mk(520, 'MENU', '#9aa7c7', () => {
        this.time.paused = false;
        this.scene.start('Menu');
      });
      mk(585, Sfx.isMuted() ? '🔇 sound off' : '🔊 sound on', '#9aa7c7', () => {
        Sfx.toggleMute();
        this.togglePause();
        this.togglePause(); // rebuild overlay with fresh labels
      });
    } else {
      this.matter.world.resume();
      this.tweens.resumeAll();
      this.time.paused = false;
      this.pauseUi?.forEach((o) => o.destroy());
      this.pauseUi = null;
    }
  }

  /** dashed guide from the held piece down to its predicted landing spot */
  updateGuide() {
    this.guide.clear();
    if (!this.held || this.gameOver) return;
    const hx = this.held.x;
    const hr = TIERS[this.currentSpecial === 'bomb' ? 2 : this.currentTier].radius;
    let landY = JAR.floor - hr;
    for (const p of this.pieces.getChildren()) {
      if (!p.active) continue;
      const pr = TIERS[p.getData('tier') ?? 0].radius;
      if (Math.abs(p.x - hx) < (hr + pr) * 0.9) {
        landY = Math.min(landY, p.y - pr - hr);
      }
    }
    this.guide.lineStyle(2, 0xffffff, 0.18);
    for (let y = DROP_Y + hr + 8; y < landY - 6; y += 18) {
      this.guide.lineBetween(hx, y, hx, Math.min(y + 9, landY - 6));
    }
    this.guide.lineStyle(2, 0xffffff, 0.22);
    this.guide.strokeCircle(hx, landY, hr);
  }

  buildHud() {
    this.scoreText = this.add.text(16, 10, 'Score: 0', {
      fontFamily: FONT, fontStyle: 'bold', fontSize: '26px', color: '#ffffff',
    });
    this.add.text(16, 42, `Best: ${Storage.getBest()}`, {
      fontFamily: FONT, fontSize: '15px', color: '#9aa7c7',
    });
    this.goalText = this.add.text(16, 66, '', {
      fontFamily: FONT, fontStyle: 'bold', fontSize: '15px', color: '#80deea',
    });
    this.pips = [];
    for (let i = 0; i < DROP_STAGES.length - 1; i++) {
      this.pips.push(this.add.circle(24 + i * 16, 96, 4, 0x4a5580).setAlpha(0.6));
    }
    this.add.text(GAME_WIDTH - 16, 10, 'NEXT', {
      fontFamily: FONT, fontSize: '13px', color: '#9aa7c7',
    }).setOrigin(1, 0);
    if (this.isDaily) {
      this.add
        .text(GAME_WIDTH / 2, 16, `DAILY · ${todayStr()}`, {
          fontFamily: FONT, fontSize: '14px', color: '#ffd54f',
        })
        .setOrigin(0.5);
    }
    if (this.isRush) {
      this.rushT = 90;
      this.rushText = this.add
        .text(GAME_WIDTH / 2, 16, '⚡ 90', {
          fontFamily: FONT, fontStyle: 'bold', fontSize: '22px', color: '#ffd54f',
        })
        .setOrigin(0.5);
    }

    // pause
    this.paused = false;
    const pauseBtn = this.add
      .text(GAME_WIDTH - 40, 108, '⏸', { fontSize: '26px' })
      .setOrigin(0.5)
      .setAlpha(0.6)
      .setInteractive({ useHandCursor: true });
    pauseBtn.on('pointerdown', (p, x, y, e) => {
      e?.stopPropagation?.();
      this.togglePause();
    });

    // rising-pile threat glow along the top of the jar
    this.threatGlow = this.add
      .rectangle(GAME_WIDTH / 2, JAR.top + 30, JAR.right - JAR.left, 60, 0xef5350, 0)
      .setOrigin(0.5, 0.5);
    this.chainText = this.add
      .text(GAME_WIDTH / 2, 300, '', {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '36px', color: '#ffd54f',
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.stormText = this.add
      .text(GAME_WIDTH / 2, 54, '', {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '22px', color: '#ef5350',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // fever meter, right of the jar
    this.feverBarBg = this.add
      .rectangle(GAME_WIDTH - 24, 460, 12, 420, 0x1a1a3e)
      .setStrokeStyle(1, 0x4a5580);
    this.feverBar = this.add
      .rectangle(GAME_WIDTH - 24, 670, 10, 0, 0xce93d8)
      .setOrigin(0.5, 1);
    this.add
      .text(GAME_WIDTH - 24, 686, '🔥', { fontSize: '16px' })
      .setOrigin(0.5, 0);
    this.feverText = this.add
      .text(GAME_WIDTH / 2, 240, '', {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '34px', color: '#ffd54f',
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.feverOverlay = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xce93d8, 0)
      .setDepth(-1);

    // power-up buttons, left of the jar
    this.popBtn = this.add
      .text(28, 250, '🔨', { fontSize: '30px' })
      .setOrigin(0.5)
      .setAlpha(0.25)
      .setInteractive({ useHandCursor: true });
    this.popLbl = this.add
      .text(28, 278, `0/${POWER.popMerges}`, {
        fontFamily: FONT, fontSize: '11px', color: '#9aa7c7',
      })
      .setOrigin(0.5);
    this.popBtn.on('pointerdown', (p, x, y, e) => {
      e?.stopPropagation?.();
      this.togglePopMode();
    });
    this.rerollBtn = this.add
      .text(28, 330, '🌀', { fontSize: '30px' })
      .setOrigin(0.5)
      .setAlpha(0.25)
      .setInteractive({ useHandCursor: true });
    this.rerollLbl = this.add
      .text(28, 358, `0/${POWER.rerollMerges}`, {
        fontFamily: FONT, fontSize: '11px', color: '#9aa7c7',
      })
      .setOrigin(0.5);
    this.rerollBtn.on('pointerdown', (p, x, y, e) => {
      e?.stopPropagation?.();
      this.useReroll();
    });

    // danger vignette
    this.vignette = [
      this.add.rectangle(GAME_WIDTH / 2, 6, GAME_WIDTH, 12, 0xef5350, 0),
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 6, GAME_WIDTH, 12, 0xef5350, 0),
      this.add.rectangle(6, GAME_HEIGHT / 2, 12, GAME_HEIGHT, 0xef5350, 0),
      this.add.rectangle(GAME_WIDTH - 6, GAME_HEIGHT / 2, 12, GAME_HEIGHT, 0xef5350, 0),
    ];
  }

  drawJar() {
    const g = this.add.graphics();
    g.lineStyle(4, 0x4a5580, 1);
    g.strokeRect(
      JAR.left - JAR.wall, JAR.top, JAR.right - JAR.left + JAR.wall * 2,
      JAR.floor - JAR.top + JAR.wall
    );
    // glass shine streaks
    g.lineStyle(5, 0xffffff, 0.07);
    g.lineBetween(JAR.left + 14, JAR.top + 30, JAR.left + 14, JAR.floor - 30);
    g.lineStyle(2, 0xffffff, 0.05);
    g.lineBetween(JAR.right - 18, JAR.top + 60, JAR.right - 18, JAR.floor - 60);
    // aim guide redrawn every frame while a piece is held
    this.guide = this.add.graphics();
    this.dangerLine = this.add.graphics();
    this.dangerLine.lineStyle(3, 0xef5350, 1);
    for (let dx = JAR.left; dx < JAR.right; dx += 24) {
      this.dangerLine.lineBetween(dx, JAR.top, Math.min(dx + 14, JAR.right), JAR.top);
    }
    this.dangerLine.setAlpha(0.55);
  }

  /* ----------------------------- drops ----------------------------- */

  escalationStage() {
    const per = this.isRush ? 8 : ESCALATION_DROPS;
    const stage = Math.min(
      DROP_STAGES.length - 1,
      Math.floor(this.dropCount / per)
    );
    // fever gives smaller pieces: relief inside the rush
    return this.feverActive ? Math.max(0, stage - 1) : stage;
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
    this.currentSpecial = this.nextSpecial;
    this.nextTier = this.rollTier();
    this.nextSpecial = rollSpecial(this.rand);

    const tier = this.currentSpecial === 'bomb' ? 2
      : this.currentSpecial === 'prism' ? 0
        : this.currentTier;
    this.held = this.add.image(GAME_WIDTH / 2, DROP_Y, TIERS[tier].key).setAlpha(0.9);
    this.decorateSpecial(this.held, this.currentSpecial, true);

    this.nextPreview?.destroy();
    this.nextBadge?.destroy();
    const pTier = this.nextSpecial === 'bomb' ? 2
      : this.nextSpecial === 'prism' ? 0
        : this.nextTier;
    this.nextPreview = this.add
      .image(GAME_WIDTH - 40, 58, TIERS[pTier].key)
      .setScale(0.45);
    if (this.nextSpecial) {
      this.nextBadge = this.add
        .text(GAME_WIDTH - 40, 58, SPECIALS[this.nextSpecial].badge, { fontSize: '20px' })
        .setOrigin(0.5);
      this.tweens.add({
        targets: [this.nextPreview, this.nextBadge],
        scale: { from: 0.45, to: 0.55 },
        duration: 300, yoyo: true, repeat: -1,
      });
    }
    this.aimAt(this.held.x);
  }

  decorateSpecial(img, special, isHeld = false) {
    if (!special) return;
    if (special === 'bomb') img.setTint(0x444455);
    if (special === 'gold') img.setTint(0xffe066);
    if (special === 'prism') img.setData?.('prismTint', true);
    const badge = this.add
      .text(img.x, img.y, SPECIALS[special].badge, { fontSize: isHeld ? '24px' : '20px' })
      .setOrigin(0.5);
    if (isHeld) this.heldBadge = badge;
    else img.setData('badge', badge);
  }

  aimAt(x) {
    if (!this.held || this.gameOver) return;
    const r = TIERS[this.currentSpecial === 'bomb' ? 2 : this.currentTier].radius;
    this.held.x = Phaser.Math.Clamp(x, JAR.left + r, JAR.right - r);
    this.heldBadge?.setX(this.held.x);
  }

  drop() {
    if (!this.held || this.gameOver) return;
    if (!this.canDrop) {
      this.pendingDrop = true; // tap buffering: fire as soon as cooldown ends
      return;
    }
    const piece = this.addPiece(this.held.x, DROP_Y, this.currentTier, this.currentSpecial);
    piece.setData('inAir', true);
    piece.setData('trail', this.add.particles(0, 0, 'dot', {
      follow: piece,
      scale: { start: 0.35, end: 0 },
      alpha: 0.5,
      lifespan: 250,
      frequency: 30,
      tint: this.currentSpecial === 'gold' ? 0xffe066 : 0xffffff,
    }));
    this.held.destroy();
    this.heldBadge?.destroy();
    this.heldBadge = null;
    this.held = null;
    this.canDrop = false;
    this.dropCount++;
    if (this.hint) {
      Storage.setSeenHint();
      const h = this.hint;
      this.hint = null;
      this.tweens.killTweensOf(h); // the pulse tween would fight the fade
      this.tweens.add({
        targets: h, alpha: 0, duration: 400, onComplete: () => h.destroy(),
      });
    }
    const stage = Math.min(
      DROP_STAGES.length - 1, Math.floor(this.dropCount / ESCALATION_DROPS)
    );
    this.pips.forEach((p, i) => p.setFillStyle(i < stage ? 0xef5350 : 0x4a5580));
    Sfx.drop();
    this.time.delayedCall(DROP_COOLDOWN_MS, () => {
      if (this.gameOver) return;
      this.canDrop = true;
      this.spawnHeldPiece();
      if (this.pendingDrop) {
        this.pendingDrop = false;
        this.drop();
      }
    });
  }

  addPiece(x, y, tier, special = null) {
    const bodyTier = special === 'bomb' ? 2 : special === 'prism' ? 0 : tier;
    const t = TIERS[bodyTier];
    const piece = this.matter.add.image(x, y, t.key);
    piece.setCircle(t.radius);
    piece.setBounce(0.1);
    piece.setFriction(0.5);
    piece.setData('tier', special === 'prism' ? 0 : tier);
    piece.setData('special', special);
    piece.setData('bornAt', this.time.now);
    piece.setData('texKey', t.key);
    if (special) this.decorateSpecial(piece, special);
    if (bodyTier === 6 && !special) {
      const ring = this.add.image(x, y, 'ring');
      piece.setData('ring', ring);
    }
    this.pieces.add(piece);
    return piece;
  }

  /* --------------------------- collisions --------------------------- */

  onCollision(a, b) {
    if (this.gameOver) return;
    // landing squash + thud + trail cleanup for fresh drops
    for (const p of [a, b]) {
      if (p?.getData?.('inAir')) {
        p.setData('inAir', false);
        p.getData('trail')?.destroy();
        p.setData('trail', null);
        const v = Math.min(p.body?.speed ?? 2, 12);
        Sfx.thud(0.04 + v * 0.012);
        vibrate(8);
        // landing puff (never tween a Matter body's scale: it rescales the
        // physics circle every frame and crashes if the piece dies mid-tween)
        const r = TIERS[p.getData('tier') ?? 0].radius;
        const puff = this.add.particles(p.x, p.y + r * 0.7, 'dot', {
          speedX: { min: -80, max: 80 },
          speedY: { min: -20, max: 10 },
          scale: { start: 0.4, end: 0 },
          alpha: 0.6,
          lifespan: 280,
          quantity: 5,
          emitting: false,
        });
        puff.explode();
        this.time.delayedCall(350, () => puff.destroy());
        // bombs arm on first contact
        if (p.getData('special') === 'bomb' && !p.getData('fused')) {
          p.setData('fused', true);
          const badge = p.getData('badge');
          if (badge) {
            this.tweens.add({
              targets: badge, alpha: 0.2, duration: 120, yoyo: true, repeat: 6,
            });
          }
          this.time.delayedCall(SPECIALS.bomb.fuseMs, () => this.explodeBomb(p));
        }
      }
    }
    this.tryMerge(a, b);
  }

  explodeBomb(bomb) {
    if (!bomb?.active || this.gameOver) return;
    const { x, y } = bomb;
    const { radius, pointsPer } = SPECIALS.bomb;
    bomb.getData('badge')?.destroy();
    bomb.destroy();

    let destroyed = 0;
    for (const p of [...this.pieces.getChildren()]) {
      if (!p.active || p === bomb) continue;
      const d = Phaser.Math.Distance.Between(x, y, p.x, p.y);
      if (d < radius) {
        this.juice(p.x, p.y, p.getData('tier') ?? 0);
        p.getData('ring')?.destroy();
        p.getData('badge')?.destroy();
        p.getData('trail')?.destroy();
        p.destroy();
        destroyed++;
      } else if (d < radius * 2 && p.body) {
        // knockback shove for the survivors
        const ang = Phaser.Math.Angle.Between(x, y, p.x, p.y);
        p.setVelocity(Math.cos(ang) * 6, Math.sin(ang) * 6 - 2);
      }
    }
    const pts = destroyed * pointsPer;
    if (pts > 0) this.addScore(pts, x, y);
    Sfx.bomb();
    vibrate(50);
    this.cameras.main.shake(250, 0.012);
    this.cameras.main.flash(150, 255, 200, 120);
    const boom = this.add.particles(x, y, 'dot', {
      speed: { min: 150, max: 400 },
      scale: { start: 1.2, end: 0 },
      lifespan: 600,
      quantity: 40,
      tint: [0xffd54f, 0xff7043, 0xffffff],
      emitting: false,
    });
    boom.explode();
    this.time.delayedCall(700, () => boom.destroy());
  }

  tryMerge(a, b) {
    if (this.gameOver || !a?.getData || !b?.getData) return;
    if (a.getData('merging') || b.getData('merging')) return;
    const sa = a.getData('special');
    const sb = b.getData('special');
    if (sa === 'bomb' || sb === 'bomb') return;

    const ta = a.getData('tier');
    const tb = b.getData('tier');
    if (ta === undefined || tb === undefined) return;

    let next = null;
    if (sa === 'prism' || sb === 'prism') {
      // prism merges with anything, upgrading the partner
      const partnerTier = sa === 'prism' ? tb : ta;
      next = Math.min(partnerTier + 1, TIERS.length - 1);
    } else if (ta === tb && ta < TIERS.length - 1) {
      next = ta + 1;
    }
    if (next === null) return;

    a.setData('merging', true);
    b.setData('merging', true);
    const goldMult = sa === 'gold' || sb === 'gold' ? SPECIALS.gold.scoreMult : 1;
    // defer past the physics step: destroying bodies inside collisionstart
    // intermittently crashes Matter's resolver ("reading 'position'")
    this.time.delayedCall(0, () => this.performMerge(a, b, next, goldMult));
  }

  performMerge(a, b, next, goldMult) {
    if (this.gameOver || !a.active || !b.active) return;
    const nx = (a.x + b.x) / 2;
    const ny = (a.y + b.y) / 2;

    // suction: ghosts pull together with squash before the pop
    const ghosts = [a, b].map((p) => {
      const ghost = this.add
        .image(p.x, p.y, p.texture.key)
        .setTint(p.tintTopLeft)
        .setRotation(p.rotation);
      p.getData('ring')?.destroy();
      p.getData('badge')?.destroy();
      p.getData('trail')?.destroy();
      p.destroy();
      return ghost;
    });
    this.tweens.add({
      targets: ghosts,
      x: nx, y: ny,
      scaleX: 1.15, scaleY: 0.8,
      duration: 90,
      onComplete: () => {
        ghosts.forEach((g) => g.destroy());
        if (this.gameOver) return;
        const merged = this.addPiece(nx, ny, next);
        merged.setVelocityY(-2);
        this.afterMerge(next, nx, ny, goldMult);
      },
    });
  }

  afterMerge(next, nx, ny, goldMult) {
    const now = this.time.now;
    this.chainCount = now - this.lastMergeAt < CHAIN_WINDOW_MS ? this.chainCount + 1 : 1;
    this.maxChain = Math.max(this.maxChain, this.chainCount);
    this.lastMergeAt = now;
    this.merges++;
    this.highestTier = Math.max(this.highestTier, next);

    // power-up charging
    if (this.popCharge < POWER.popMerges) this.popCharge++;
    if (this.rerollCharge < POWER.rerollMerges) this.rerollCharge++;
    this.refreshPowerUi();

    // fever build
    this.fever = Math.min(
      100, this.fever + FEVER.perMerge + (this.chainCount - 1) * FEVER.perChain
    );
    if (!this.feverActive && this.fever >= 100) this.startFever();

    const base = Math.round(TIERS[next].score * (1 + 0.5 * (this.chainCount - 1)));
    const mult = goldMult * (this.feverActive ? 2 : 1);
    this.addScore(base * mult, nx, ny, goldMult > 1);

    Sfx.merge(next + (this.feverActive ? 2 : 0), this.chainCount);
    vibrate(next >= 6 ? 30 : 10);
    this.juice(nx, ny, next);
    if (this.chainCount >= 2) this.showChain(this.chainCount);

    // discovery moment: first time this run reaching a notable tier
    if (next >= 4 && !this.discovered.has(next)) {
      this.discovered.add(next);
      const banner = this.add
        .text(GAME_WIDTH / 2, 200, `✨ ${TIERS[next].name.toUpperCase()}! ✨`, {
          fontFamily: FONT, fontStyle: 'bold', fontSize: '30px',
          color: '#' + this.palette[next].toString(16).padStart(6, '0'),
          stroke: '#0b0b1e', strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setScale(0.3);
      this.tweens.add({
        targets: banner, scale: 1, duration: 350, ease: 'Back.easeOut',
      });
      this.tweens.add({
        targets: banner, alpha: 0, delay: 1400, duration: 400,
        onComplete: () => banner.destroy(),
      });
      if (next >= 6) Sfx.fanfare();
    }

    // big-merge time stop: the "OHHH" moment
    if (next >= 6) {
      this.matter.world.engine.timing.timeScale = 0.15;
      this.tweens.add({
        targets: this.matter.world.engine.timing,
        timeScale: 1,
        duration: 320,
        ease: 'Quad.easeIn',
      });
      this.cameras.main.zoomTo(1.06, 100, 'Quad.easeOut', true, (cam, t) => {
        if (t === 1) cam.zoomTo(1, 180);
      });
      this.cameras.main.flash(120, 255, 255, 255);
    }

    this.checkGoal();
  }

  addScore(points, x, y, isGold = false) {
    this.score += points;
    this.scoreText.setText(`Score: ${this.score}`);
    this.tweens.add({ targets: this.scoreText, scale: 1.15, duration: 90, yoyo: true });
    const color = isGold ? '#ffd700'
      : this.chainCount >= 3 ? '#ff7043'
        : this.chainCount === 2 ? '#ffd54f' : '#ffffff';
    const float = this.add
      .text(x, y, `+${points}`, {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '22px', color,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: float, y: y - 60, alpha: 0, duration: 700, ease: 'Quad.easeOut',
      onComplete: () => float.destroy(),
    });
  }

  /* ----------------------------- fever ----------------------------- */

  startFever() {
    this.feverActive = true;
    this.feverT = FEVER.lengthSec;
    Sfx.fever();
    Music.setIntensity(2);
    vibrate([30, 50, 30, 50, 60]);
    this.feverText.setText('🔥 FEVER x2 🔥').setAlpha(1).setScale(0.4);
    this.tweens.add({
      targets: this.feverText, scale: 1, duration: 350, ease: 'Back.easeOut',
    });
    this.feverRain = this.add.particles(0, 0, 'star', {
      x: { min: 0, max: GAME_WIDTH },
      y: -10,
      speedY: { min: 150, max: 300 },
      scale: { start: 1.6, end: 0.4 },
      lifespan: 2200,
      frequency: 40,
      tint: [0xffd54f, 0xce93d8, 0x80deea],
    });
  }

  endFever() {
    this.feverActive = false;
    this.fever = 0;
    Music.setIntensity(1);
    this.tweens.add({ targets: this.feverText, alpha: 0, duration: 400 });
    this.feverRain?.destroy();
    this.feverRain = null;
    this.feverOverlay.setFillStyle(0xce93d8, 0);
  }

  /* --------------------------- power-ups --------------------------- */

  refreshPowerUi() {
    const popReady = this.popCharge >= POWER.popMerges;
    this.popBtn.setAlpha(popReady ? 1 : 0.25);
    this.popLbl.setText(popReady ? 'TAP!' : `${this.popCharge}/${POWER.popMerges}`);
    const rrReady = this.rerollCharge >= POWER.rerollMerges;
    this.rerollBtn.setAlpha(rrReady ? 1 : 0.25);
    this.rerollLbl.setText(rrReady ? 'TAP!' : `${this.rerollCharge}/${POWER.rerollMerges}`);
    if (popReady && !this.popPulse) {
      this.popPulse = this.tweens.add({
        targets: this.popBtn, scale: 1.2, duration: 350, yoyo: true, repeat: -1,
      });
    }
    if (rrReady && !this.rerollPulse) {
      this.rerollPulse = this.tweens.add({
        targets: this.rerollBtn, scale: 1.2, duration: 350, yoyo: true, repeat: -1,
      });
    }
  }

  togglePopMode() {
    if (this.popCharge < POWER.popMerges || this.gameOver) return;
    this.popMode = !this.popMode;
    this.popLbl.setText(this.popMode ? 'PICK…' : 'TAP!');
    Sfx.ui();
  }

  popAt(x, y) {
    // ignore taps on the buttons themselves
    if (x < 60 && y > 220 && y < 380) return;
    for (const p of this.pieces.getChildren()) {
      if (!p.active) continue;
      const r = TIERS[p.getData('tier') ?? 0].radius;
      if (Phaser.Math.Distance.Between(x, y, p.x, p.y) <= r + 6) {
        // capture coords BEFORE destroy: Matter objects read x/y off the body
        const px = p.x;
        const py = p.y;
        this.juice(px, py, p.getData('tier') ?? 0);
        p.getData('ring')?.destroy();
        p.getData('badge')?.destroy();
        p.getData('trail')?.destroy();
        p.destroy();
        this.addScore(10, px, py);
        Sfx.thud(0.15);
        vibrate(25);
        this.popCharge = 0;
        this.popMode = false;
        this.popPulse?.stop();
        this.popPulse = null;
        this.popBtn.setScale(1);
        this.refreshPowerUi();
        return;
      }
    }
  }

  useReroll() {
    if (this.rerollCharge < POWER.rerollMerges || !this.held || this.gameOver) return;
    this.rerollCharge = 0;
    this.rerollPulse?.stop();
    this.rerollPulse = null;
    this.rerollBtn.setScale(1);
    const x = this.held.x;
    this.held.destroy();
    this.heldBadge?.destroy();
    this.heldBadge = null;
    this.currentTier = this.rollTier();
    this.currentSpecial = rollSpecial(this.rand);
    const tier = this.currentSpecial === 'bomb' ? 2
      : this.currentSpecial === 'prism' ? 0
        : this.currentTier;
    this.held = this.add.image(x, DROP_Y, TIERS[tier].key).setAlpha(0.9);
    this.decorateSpecial(this.held, this.currentSpecial, true);
    this.aimAt(x);
    Sfx.ui();
    vibrate(15);
    this.refreshPowerUi();
  }

  /* --------------------------- micro-goals --------------------------- */

  setGoal() {
    const kinds = ['tier', 'score', 'chain', 'storm'];
    const kind = kinds[this.goalIdx % kinds.length];
    this.goalIdx++;
    if (kind === 'tier') {
      const target = Math.min(this.highestTier + 1, TIERS.length - 1);
      this.goal = {
        kind, target, reward: 30 + target * 10,
        text: `Make a ${TIERS[target].name}`,
      };
    } else if (kind === 'score') {
      const target = this.score + 300;
      this.goal = { kind, target, reward: 40, text: `Reach ${target} pts` };
    } else if (kind === 'chain') {
      const target = Math.max(2, Math.min(this.maxChain + 1, 5));
      this.goal = { kind, target, reward: 30 + target * 15, text: `Hit a x${target} chain` };
    } else {
      this.goal = {
        kind, target: this.stormsSurvived + 1, reward: 80, text: 'Survive the storm',
      };
    }
    this.goalText.setText(`🎯 ${this.goal.text}  (+${this.goal.reward}✦)`);
  }

  checkGoal() {
    if (!this.goal) return;
    const g = this.goal;
    const done =
      (g.kind === 'tier' && this.highestTier >= g.target) ||
      (g.kind === 'score' && this.score >= g.target) ||
      (g.kind === 'chain' && this.maxChain >= g.target) ||
      (g.kind === 'storm' && this.stormsSurvived >= g.target);
    if (!done) return;
    Storage.addStardust(g.reward);
    this.goalsDone++;
    Sfx.reward();
    vibrate(20);
    this.goalText.setText(`✓ ${g.text}  +${g.reward}✦`).setColor('#66bb6a');
    const burst = this.add.particles(90, 74, 'dot', {
      speed: { min: 60, max: 160 },
      scale: { start: 0.6, end: 0 },
      lifespan: 500,
      quantity: 14,
      tint: 0x66bb6a,
      emitting: false,
    });
    burst.explode();
    this.goal = null;
    this.time.delayedCall(900, () => {
      burst.destroy();
      if (this.gameOver) return;
      this.goalText.setColor('#80deea');
      this.setGoal();
    });
  }

  /* ----------------------------- juice ----------------------------- */

  juice(x, y, tier) {
    const emitter = this.add.particles(x, y, 'dot', {
      speed: { min: 60, max: 220 },
      scale: { start: 0.9, end: 0 },
      lifespan: 450,
      quantity: 8 + tier * 3,
      tint: this.palette[Math.min(tier, this.palette.length - 1)],
      emitting: false,
    });
    emitter.explode();
    this.time.delayedCall(600, () => emitter.destroy());
    this.cameras.main.shake(120 + tier * 30, 0.002 + tier * 0.0012);
  }

  showChain(n) {
    this.chainText.setText(`CHAIN x${n}!`).setAlpha(1).setScale(0.5);
    this.tweens.add({
      targets: this.chainText, scale: 1, alpha: 0, duration: 800, ease: 'Cubic.easeOut',
    });
  }

  /* ----------------------------- storms ----------------------------- */

  updateStorm(dt) {
    if (this.stormPhase === 'calm') {
      this.stormClock -= dt;
      if (this.stormClock <= 0) {
        this.stormPhase = 'warning';
        this.stormClock = STORM.warn;
        this.stormText.setAlpha(1);
        Sfx.siren();
        vibrate([20, 80, 20]);
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
    this.stormElapsed += dt;
    this.stormClock -= dt;
    const maxTilt = Math.min(14 + this.merges * 0.1, 22);
    const angle = Math.sin(this.stormElapsed * 3.2) * Phaser.Math.DegToRad(maxTilt);
    this.matter.world.setGravity(Math.sin(angle), Math.cos(angle));
    this.cameras.main.setRotation(angle * 0.18);
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
      this.checkGoal();
    }
  }

  /* ----------------------------- update ----------------------------- */

  update(_, deltaMs) {
    if (this.gameOver || this.paused) return;
    const dt = deltaMs / 1000;

    // rush mode countdown
    if (this.isRush) {
      this.rushT -= dt;
      const s = Math.max(0, Math.ceil(this.rushT));
      this.rushText.setText(`⚡ ${s}`);
      if (this.rushT <= 10 && this.rushText.style.color !== '#ef5350') {
        this.rushText.setColor('#ef5350');
      }
      if (this.rushT <= 10 && s !== this.lastTick) {
        this.lastTick = s;
        Sfx.ui();
      }
      if (this.rushT <= 0) {
        this.timeUp = true;
        this.finishRun();
        return;
      }
    }

    this.updateStorm(dt);

    // fever meter
    if (this.feverActive) {
      this.feverT -= dt;
      this.fever = Math.max(0, 100 * (this.feverT / FEVER.lengthSec));
      const hue = (this.time.now / 8) % 360;
      this.feverOverlay.setFillStyle(
        Phaser.Display.Color.HSLToColor(hue / 360, 0.7, 0.6).color, 0.07
      );
      if (this.feverT <= 0) this.endFever();
    } else if (this.fever > 0) {
      this.fever = Math.max(0, this.fever - FEVER.drainPerSec * dt);
    }
    const barH = 418 * (this.fever / 100);
    this.feverBar.setSize(10, barH);
    this.feverBar.setFillStyle(this.fever >= 100 || this.feverActive ? 0xffd54f : 0xce93d8);

    // prism rainbow tint cycle + idle blinking + follower sync
    for (const p of this.pieces.getChildren()) {
      if (!p.active) continue;
      if (p.getData?.('special') === 'prism') {
        const hue = (this.time.now / 4) % 360;
        p.setTint(Phaser.Display.Color.HSLToColor(hue / 360, 0.8, 0.75).color);
      }
      const blinkUntil = p.getData('blinkUntil');
      if (blinkUntil && this.time.now > blinkUntil) {
        p.setTexture(p.getData('texKey'));
        p.setData('blinkUntil', null);
      } else if (!blinkUntil && Math.random() < dt * 0.25) {
        p.setTexture(p.getData('texKey') + 'b');
        p.setData('blinkUntil', this.time.now + 140);
      }
      const badge = p.getData?.('badge');
      if (badge) badge.setPosition(p.x, p.y);
      const ring = p.getData?.('ring');
      if (ring) ring.setPosition(p.x, p.y).setRotation(p.rotation);
    }
    this.updateGuide();
    if (this.held?.getData?.('prismTint') || this.currentSpecial === 'prism') {
      const hue = (this.time.now / 4) % 360;
      this.held?.setTint(Phaser.Display.Color.HSLToColor(hue / 360, 0.8, 0.75).color);
    }
    this.heldBadge?.setPosition(this.held?.x ?? 0, DROP_Y);

    // danger check + vignette + threat glow
    let inDanger = false;
    let pileTop = JAR.floor;
    for (const piece of this.pieces.getChildren()) {
      if (!piece.active || !piece.body) continue;
      const r = TIERS[piece.getData('tier') ?? 0].radius;
      const settled = this.time.now - piece.getData('bornAt') > 1000;
      if (settled && piece.body.speed < 1.2) pileTop = Math.min(pileTop, piece.y - r);
      if (settled && piece.y - r < JAR.top && piece.body.speed < 1.2) inDanger = true;
    }
    // glow ramps up over the last 35% of jar height
    const frac = 1 - (pileTop - JAR.top) / (JAR.floor - JAR.top);
    this.threatGlow.setFillStyle(0xef5350, Math.max(0, (frac - 0.65) / 0.35) * 0.16);
    if (inDanger) {
      this.dangerTimer += dt;
      const pulse = 0.25 + 0.3 * Math.abs(Math.sin(this.time.now / 120));
      this.dangerLine.setAlpha(0.4 + 0.6 * Math.abs(Math.sin(this.time.now / 120)));
      this.vignette.forEach((v) => v.setFillStyle(0xef5350, pulse));
      if (this.time.now - this.lastHeartbeat > 600) {
        this.lastHeartbeat = this.time.now;
        Sfx.heartbeat();
        vibrate(12);
      }
      if (this.dangerTimer >= DANGER_SECONDS) this.endGame();
    } else {
      this.dangerTimer = 0;
      this.dangerLine.setAlpha(0.55);
      this.vignette.forEach((v) => v.setFillStyle(0xef5350, 0));
    }
  }

  /* --------------------------- end of run --------------------------- */

  endGame() {
    this.gameOver = true;
    this.matter.world.setGravity(0, 1);
    this.matter.world.engine.timing.timeScale = 1;
    this.cameras.main.setRotation(0);
    this.wind?.destroy();
    this.wind = null;
    if (this.feverActive) this.endFever();

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
      this.juice(p.x, p.y, p.getData('tier') ?? 0);
      p.getData('ring')?.destroy();
      p.getData('badge')?.destroy();
      p.getData('trail')?.destroy();
      p.destroy();
    });
    Sfx.reward();
    vibrate([30, 40, 30]);
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
    vibrate(80);

    const best = Storage.getBest();
    const isNewBest = this.score > best;
    if (isNewBest) Storage.setBest(this.score);
    Storage.recordScore(this.score);
    const stardust = Math.floor(this.score / 10);
    const stardustTotal = Storage.addStardust(stardust);

    const day = todayStr();
    if (this.isDaily && this.score > Storage.getDailyBest(day)) {
      Storage.setDailyBest(day, this.score);
    }
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
        isRush: this.isRush,
        timeUp: !!this.timeUp,
        day,
        leveled,
        boxEarned,
        maxChain: this.maxChain,
        storms: this.stormsSurvived,
        goals: this.goalsDone,
      })
    );
  }
}
