import Phaser from 'phaser';
import { GAME_WIDTH } from '../constants.js';
import { TIERS } from '../config/tiers.js';
import { sprinkleStars } from './MenuScene.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data) {
    sprinkleStars(this);

    this.add
      .text(GAME_WIDTH / 2, 130, 'JAR OVERFLOWED!', {
        fontFamily: 'Arial Black, sans-serif', fontSize: '36px', color: '#ef5350',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 220, `${data.score}`, {
        fontFamily: 'Arial Black, sans-serif', fontSize: '64px', color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2, 280,
        data.isNewBest ? '★ NEW BEST! ★' : `Best: ${data.best}`,
        {
          fontFamily: 'Arial, sans-serif', fontSize: '22px',
          color: data.isNewBest ? '#ffd54f' : '#9aa7c7',
        }
      )
      .setOrigin(0.5);

    // near-miss messaging: always show how close they came to the top tier
    const tiersFromSun = TIERS.length - 1 - data.highestTier;
    const nearMiss =
      tiersFromSun === 0
        ? 'You made a SUN! Legendary.'
        : `Only ${tiersFromSun} merge${tiersFromSun > 1 ? 's' : ''} from a Sun!`;
    this.add
      .text(GAME_WIDTH / 2, 340, nearMiss, {
        fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#80deea',
      })
      .setOrigin(0.5);

    const biggest = TIERS[data.highestTier];
    this.add.image(GAME_WIDTH / 2, 430, biggest.key).setScale(0.8);
    this.add
      .text(GAME_WIDTH / 2, 510, `Biggest: ${biggest.name}`, {
        fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#cfd8ff',
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2, 560,
        `✦ +${data.stardust} stardust  (total ${data.stardustTotal})`,
        { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#ffd54f' }
      )
      .setOrigin(0.5);

    const retry = this.add
      .text(GAME_WIDTH / 2, 650, 'TAP TO TRY AGAIN', {
        fontFamily: 'Arial Black, sans-serif', fontSize: '28px', color: '#80deea',
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: retry, alpha: 0.3, duration: 500, yoyo: true, repeat: -1,
    });

    // sub-2-second restart: a single tap goes straight back into a run
    this.input.once('pointerdown', () => this.scene.start('Game'));
  }
}
