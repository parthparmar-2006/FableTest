import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT } from '../constants.js';
import { TIERS } from '../config/tiers.js';
import { Storage, todayStr } from '../storage.js';
import { Sfx, Music } from '../sfx.js';
import {
  levelProgress,
  missionState,
  claimMission,
  affordableSkinExists,
} from '../progression.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    sprinkleStars(this);

    this.add
      .text(GAME_WIDTH / 2, 70, 'JAR OF STARS', {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '46px', color: '#ffd54f',
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 116, 'Drop. Merge. Survive the storms.', {
        fontFamily: FONT, fontSize: '18px', color: '#cfd8ff',
      })
      .setOrigin(0.5);

    // decorative merge chain preview
    let x = GAME_WIDTH / 2 - 130;
    TIERS.slice(0, 5).forEach((t) => {
      this.add.image(x, 180, t.key).setScale(0.55);
      x += 65;
    });

    // level + XP bar
    const prog = levelProgress(Storage.getXp());
    this.add
      .text(GAME_WIDTH / 2 - 170, 235, `LVL ${prog.level}`, {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '18px', color: '#ce93d8',
      })
      .setOrigin(0, 0.5);
    const barX = GAME_WIDTH / 2 - 95;
    this.add.rectangle(barX, 235, 250, 12, 0x1a1a3e).setOrigin(0, 0.5)
      .setStrokeStyle(1, 0x4a5580);
    this.add
      .rectangle(barX + 1, 235, Math.max(4, 248 * prog.pct), 10, 0xce93d8)
      .setOrigin(0, 0.5);
    this.add
      .text(barX + 255, 235, `${prog.into}/${prog.need}`, {
        fontFamily: FONT, fontSize: '12px', color: '#9aa7c7',
      })
      .setOrigin(0, 0.5);

    const streak = Storage.getStreak();
    this.add
      .text(
        GAME_WIDTH / 2, 272,
        `Best ${Storage.getBest()}   ✦ ${Storage.getStardust()}   🔥 ${streak.count}`,
        { fontFamily: FONT, fontSize: '19px', color: '#ffffff' }
      )
      .setOrigin(0.5);

    makeButton(this, GAME_WIDTH / 2, 340, 'PLAY', '#80deea', '30px', () =>
      this.scene.start('Game', { daily: false })
    );

    const day = todayStr();
    const dailyBest = Storage.getDailyBest(day);
    makeButton(
      this, GAME_WIDTH / 2, 410,
      dailyBest > 0 ? `DAILY CHALLENGE (best ${dailyBest})` : 'DAILY CHALLENGE',
      '#ffd54f', '20px',
      () => this.scene.start('Game', { daily: true })
    );

    const collBtn = makeButton(
      this, GAME_WIDTH / 2, 472, 'COLLECTION', '#ce93d8', '20px',
      () => this.scene.start('Album')
    );
    if (affordableSkinExists()) {
      const badge = this.add
        .text(GAME_WIDTH / 2 + 95, 455, 'NEW!', {
          fontFamily: FONT, fontStyle: 'bold', fontSize: '14px', color: '#ef5350',
        })
        .setOrigin(0.5)
        .setAngle(15);
      this.tweens.add({
        targets: badge, scale: 1.25, duration: 400, yoyo: true, repeat: -1,
      });
    }

    this.drawMissions();

    // sound + music toggles
    const mute = this.add
      .text(GAME_WIDTH - 22, GAME_HEIGHT - 28, Sfx.isMuted() ? '🔇' : '🔊', {
        fontSize: '24px',
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    mute.on('pointerup', () => mute.setText(Sfx.toggleMute() ? '🔇' : '🔊'));
    const music = this.add
      .text(GAME_WIDTH - 64, GAME_HEIGHT - 28, Music.isOff() ? '🎵̶' : '🎵', {
        fontSize: '24px',
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    music.on('pointerup', () => {
      const off = Music.toggle();
      music.setText(off ? '🎵̶' : '🎵');
      music.setAlpha(off ? 0.4 : 1);
    });
    music.setAlpha(Music.isOff() ? 0.4 : 1);

    this.add
      .text(22, GAME_HEIGHT - 28, 'Beware the gravity storms ⚠', {
        fontFamily: FONT, fontSize: '14px', color: '#9aa7c7',
      })
      .setOrigin(0, 0.5);

    // browsers require a gesture before audio starts
    this.input.once('pointerup', () => Music.start());

    this.claimDailyReward();
  }

  drawMissions() {
    const top = 530;
    this.add
      .text(GAME_WIDTH / 2, top, '— DAILY MISSIONS —', {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '16px', color: '#9aa7c7',
      })
      .setOrigin(0.5);

    missionState().forEach((m, i) => {
      const y = top + 36 + i * 44;
      this.add.rectangle(GAME_WIDTH / 2, y, 420, 38, 0x1a1a3e, 0.85)
        .setStrokeStyle(1, m.claimed ? 0x4a5580 : m.done ? 0xffd54f : 0x4a5580);
      this.add
        .text(40, y, m.text, {
          fontFamily: FONT, fontSize: '15px',
          color: m.claimed ? '#5a6280' : '#ffffff',
        })
        .setOrigin(0, 0.5);

      if (m.claimed) {
        this.add
          .text(GAME_WIDTH - 40, y, '✓', {
            fontFamily: FONT, fontSize: '18px', color: '#66bb6a',
          })
          .setOrigin(1, 0.5);
      } else if (m.done) {
        const claim = this.add
          .text(GAME_WIDTH - 40, y, `CLAIM ✦${m.reward}`, {
            fontFamily: FONT, fontStyle: 'bold', fontSize: '15px', color: '#ffd54f',
          })
          .setOrigin(1, 0.5)
          .setInteractive({ useHandCursor: true });
        claim.once('pointerup', () => {
          claimMission(m.id);
          Sfx.reward();
          this.scene.restart();
        });
      } else {
        this.add
          .text(GAME_WIDTH - 40, y, `${m.value}/${m.target}`, {
            fontFamily: FONT, fontSize: '15px', color: '#9aa7c7',
          })
          .setOrigin(1, 0.5);
      }
    });
  }

  // Streak rules: consecutive day -> +1; one missed day burns a freeze instead
  // of resetting; otherwise back to 1. Reward escalates, capped at day 7.
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

    const bg = this.add
      .rectangle(GAME_WIDTH / 2, 300, 380, 86, 0x1a1a3e, 0.97)
      .setStrokeStyle(2, 0xffd54f);
    const txt = this.add
      .text(
        GAME_WIDTH / 2, 300,
        `Daily reward: +${reward} ✦\nStreak: ${s.count} 🔥${frozeMsg ? '\n' + frozeMsg : ''}`,
        {
          fontFamily: FONT, fontSize: '17px', color: '#ffd54f', align: 'center',
        }
      )
      .setOrigin(0.5);
    this.tweens.add({ targets: [bg, txt], alpha: 0, delay: 3000, duration: 600 });
  }
}

/** Pill-style button: rounded background, hover/press feedback, .setText support. */
export function makeButton(scene, x, y, label, color, size, onUp) {
  const colorInt = Phaser.Display.Color.HexStringToColor(color).color;
  const txt = scene.add
    .text(0, 0, label, {
      fontFamily: FONT, fontStyle: 'bold', fontSize: size, color,
    })
    .setOrigin(0.5);
  const g = scene.add.graphics();
  const draw = () => {
    const w = txt.width + 44;
    const h = txt.height + 14;
    g.clear();
    g.fillStyle(0x1a1a3e, 0.92);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.lineStyle(2, colorInt, 0.9);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    return { w, h };
  };
  let { w, h } = draw();

  const btn = scene.add.container(x, y, [g, txt]);
  btn.setSize(w, h).setInteractive({ useHandCursor: true });
  btn.on('pointerover', () => btn.setAlpha(0.85));
  btn.on('pointerout', () => {
    btn.setAlpha(1);
    btn.setScale(1);
  });
  btn.on('pointerdown', () => btn.setScale(0.94));
  btn.on('pointerup', () => {
    btn.setScale(1);
    Sfx.ui();
    onUp();
  });
  btn.setText = (s) => {
    txt.setText(s);
    ({ w, h } = draw());
    btn.setSize(w, h);
    return btn;
  };
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
