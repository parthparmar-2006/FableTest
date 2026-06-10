import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { TIERS } from '../config/tiers.js';
import { Storage } from '../storage.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    sprinkleStars(this);

    this.add
      .text(GAME_WIDTH / 2, 150, 'JAR OF STARS', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '44px',
        color: '#ffd54f',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 210, 'Drop. Merge. Don’t overflow the jar.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#cfd8ff',
      })
      .setOrigin(0.5);

    // decorative merge chain preview
    const previewTiers = TIERS.slice(0, 5);
    let x = GAME_WIDTH / 2 - 130;
    previewTiers.forEach((t) => {
      this.add.image(x, 320, t.key).setScale(0.6);
      x += 65;
    });

    this.add
      .text(
        GAME_WIDTH / 2,
        420,
        `Best: ${Storage.getBest()}   ✦ Stardust: ${Storage.getStardust()}`,
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '20px',
          color: '#ffffff',
        }
      )
      .setOrigin(0.5);

    const tap = this.add
      .text(GAME_WIDTH / 2, 560, 'TAP TO PLAY', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '30px',
        color: '#80deea',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: tap,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 40, 'The jar tilts. Plan ahead.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#9aa7c7',
      })
      .setOrigin(0.5);

    this.input.once('pointerdown', () => this.scene.start('Game'));
  }
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
