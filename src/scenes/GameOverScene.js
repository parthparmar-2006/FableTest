import Phaser from 'phaser';
import { GAME_WIDTH } from '../constants.js';
import { TIERS } from '../config/tiers.js';
import { sprinkleStars, makeButton } from './MenuScene.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data) {
    sprinkleStars(this);

    this.add
      .text(GAME_WIDTH / 2, 110, 'JAR OVERFLOWED!', {
        fontFamily: 'Arial Black, sans-serif', fontSize: '36px', color: '#ef5350',
      })
      .setOrigin(0.5);

    if (data.isDaily) {
      this.add
        .text(GAME_WIDTH / 2, 152, `DAILY CHALLENGE · ${data.day}`, {
          fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#ffd54f',
        })
        .setOrigin(0.5);
    }

    this.add
      .text(GAME_WIDTH / 2, 215, `${data.score}`, {
        fontFamily: 'Arial Black, sans-serif', fontSize: '64px', color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2, 272,
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
      .text(GAME_WIDTH / 2, 330, nearMiss, {
        fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#80deea',
      })
      .setOrigin(0.5);

    const biggest = TIERS[data.highestTier];
    this.add.image(GAME_WIDTH / 2, 420, biggest.key).setScale(0.8);
    this.add
      .text(GAME_WIDTH / 2, 500, `Biggest: ${biggest.name}`, {
        fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#cfd8ff',
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2, 535,
        `✦ +${data.stardust} stardust  (total ${data.stardustTotal})`,
        { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#ffd54f' }
      )
      .setOrigin(0.5);

    // Wordle-style shareable artifact: emoji ladder of how far they climbed
    const shareBtn = makeButton(
      this, GAME_WIDTH / 2, 595, '📋 COPY SCORE', '#ce93d8', '20px',
      async () => {
        const ladder =
          '🌟'.repeat(data.highestTier + 1) + '⬛'.repeat(tiersFromSun);
        const tag = data.isDaily ? ` Daily ${data.day}` : '';
        const text = `Jar of Stars${tag} — ${data.score} pts\n${ladder}\n${nearMiss}`;
        try {
          await navigator.clipboard.writeText(text);
          shareBtn.setText('✓ COPIED!');
        } catch {
          shareBtn.setText('(copy blocked)');
        }
      }
    );

    const retry = makeButton(
      this, GAME_WIDTH / 2, 670,
      data.isDaily ? 'RETRY DAILY' : 'TAP TO TRY AGAIN', '#80deea', '28px',
      () => this.scene.start('Game', { daily: data.isDaily })
    );
    this.tweens.add({
      targets: retry, alpha: 0.3, duration: 500, yoyo: true, repeat: -1,
    });

    makeButton(this, GAME_WIDTH / 2, 730, 'MENU', '#9aa7c7', '18px', () =>
      this.scene.start('Menu')
    );
  }
}
