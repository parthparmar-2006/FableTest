import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { TIERS } from '../config/tiers.js';
import { Storage, todayStr } from '../storage.js';
import { Sfx } from '../sfx.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    sprinkleStars(this);

    this.add
      .text(GAME_WIDTH / 2, 110, 'JAR OF STARS', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '44px',
        color: '#ffd54f',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 165, 'Drop. Merge. Don’t overflow the jar.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#cfd8ff',
      })
      .setOrigin(0.5);

    // decorative merge chain preview
    let x = GAME_WIDTH / 2 - 130;
    TIERS.slice(0, 5).forEach((t) => {
      this.add.image(x, 250, t.key).setScale(0.6);
      x += 65;
    });

    const streak = Storage.getStreak();
    this.add
      .text(
        GAME_WIDTH / 2,
        330,
        `Best: ${Storage.getBest()}   ✦ ${Storage.getStardust()}   🔥 ${streak.count}`,
        { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#ffffff' }
      )
      .setOrigin(0.5);

    // data must be explicit: Phaser reuses the previous scene data when
    // start() is called without any, which would leak daily mode into PLAY
    makeButton(this, GAME_WIDTH / 2, 430, 'PLAY', '#80deea', '30px', () =>
      this.scene.start('Game', { daily: false })
    );

    const day = todayStr();
    const dailyBest = Storage.getDailyBest(day);
    makeButton(
      this,
      GAME_WIDTH / 2,
      510,
      dailyBest > 0 ? `DAILY CHALLENGE  (best ${dailyBest})` : 'DAILY CHALLENGE',
      '#ffd54f',
      '22px',
      () => this.scene.start('Game', { daily: true })
    );

    makeButton(this, GAME_WIDTH / 2, 580, 'COLLECTION', '#ce93d8', '22px', () =>
      this.scene.start('Album')
    );

    // mute toggle
    const mute = this.add
      .text(GAME_WIDTH - 24, GAME_HEIGHT - 30, Sfx.isMuted() ? '🔇' : '🔊', {
        fontSize: '26px',
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    mute.on('pointerup', () => {
      mute.setText(Sfx.toggleMute() ? '🔇' : '🔊');
    });

    this.add
      .text(24, GAME_HEIGHT - 30, 'The jar tilts. Plan ahead.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#9aa7c7',
      })
      .setOrigin(0, 0.5);

    this.claimDailyReward();
  }

  // Streak rules (research: forgiving streaks retain better than harsh ones):
  // consecutive day -> +1; one missed day burns a freeze instead of resetting;
  // otherwise back to 1. Reward escalates and caps at day 7. +1 freeze each 7 days.
  claimDailyReward() {
    const today = todayStr();
    if (Storage.getLastClaim() === today) return;

    const s = Storage.getStreak();
    let frozeMsg = '';
    if (s.last === todayStr(-1)) {
      s.count += 1;
    } else if (s.last === todayStr(-2) && s.freezes > 0) {
      s.freezes -= 1;
      s.count += 1;
      frozeMsg = '❄ Streak freeze used — streak saved!';
    } else {
      s.count = 1;
    }
    if (s.count > 0 && s.count % 7 === 0) {
      s.freezes += 1;
      frozeMsg = '+1 streak freeze earned!';
    }
    s.last = today;
    Storage.setStreak(s);
    Storage.setLastClaim(today);

    const reward = 50 + 25 * Math.min(s.count, 7);
    Storage.addStardust(reward);
    Sfx.reward();

    // reward popup
    const bg = this.add
      .rectangle(GAME_WIDTH / 2, 680, 380, 86, 0x1a1a3e, 0.95)
      .setStrokeStyle(2, 0xffd54f);
    const txt = this.add
      .text(
        GAME_WIDTH / 2,
        680,
        `Daily reward: +${reward} ✦\nStreak: ${s.count} 🔥${frozeMsg ? '\n' + frozeMsg : ''}`,
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '17px',
          color: '#ffd54f',
          align: 'center',
        }
      )
      .setOrigin(0.5);
    this.tweens.add({
      targets: [bg, txt],
      alpha: 0,
      delay: 3500,
      duration: 600,
    });
  }
}

export function makeButton(scene, x, y, label, color, size, onUp) {
  const btn = scene.add
    .text(x, y, label, {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: size,
      color,
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  btn.on('pointerover', () => btn.setAlpha(0.7));
  btn.on('pointerout', () => btn.setAlpha(1));
  btn.on('pointerup', () => {
    Sfx.ui();
    onUp();
  });
  return btn;
}

export function sprinkleStars(scene) {
  for (let i = 0; i < 60; i++) {
    scene.add
      .image(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        'star'
      )
      .setAlpha(Phaser.Math.FloatBetween(0.15, 0.7));
  }
}
