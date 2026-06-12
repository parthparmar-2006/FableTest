import Phaser from 'phaser';
import { GAME_WIDTH, FONT } from '../constants.js';
import { TIERS } from '../config/tiers.js';
import { SKINS } from '../config/skins.js';
import { Storage } from '../storage.js';
import { Ads } from '../ads.js';
import { Sfx } from '../sfx.js';
import { openBox } from '../progression.js';
import { shareScoreCard } from '../sharecard.js';
import { skinById } from '../config/skins.js';
import { sprinkleStars, makeButton } from './MenuScene.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data) {
    sprinkleStars(this);

    this.add
      .text(GAME_WIDTH / 2, 80, data.timeUp ? "⚡ TIME'S UP!" : 'JAR OVERFLOWED!', {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '36px',
        color: data.timeUp ? '#ffd54f' : '#ef5350',
      })
      .setOrigin(0.5);
    if (data.isDaily || data.isRush) {
      this.add
        .text(
          GAME_WIDTH / 2, 120,
          data.isRush ? 'RUSH · 90 seconds' : `DAILY CHALLENGE · ${data.day}`,
          { fontFamily: FONT, fontSize: '16px', color: '#ffd54f' }
        )
        .setOrigin(0.5);
    }

    this.add
      .text(GAME_WIDTH / 2, 180, `${data.score}`, {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '60px', color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH / 2, 232,
        data.isNewBest ? '★ NEW BEST! ★' : `Best: ${data.best}`,
        {
          fontFamily: FONT, fontSize: '21px',
          color: data.isNewBest ? '#ffd54f' : '#9aa7c7',
        }
      )
      .setOrigin(0.5);

    const tiersFromSun = TIERS.length - 1 - data.highestTier;
    const nearMiss =
      tiersFromSun === 0
        ? 'You made a SUN! Legendary.'
        : `Only ${tiersFromSun} merge${tiersFromSun > 1 ? 's' : ''} from a Sun!`;
    this.add
      .text(GAME_WIDTH / 2, 272, nearMiss, {
        fontFamily: FONT, fontSize: '19px', color: '#80deea',
      })
      .setOrigin(0.5);

    const biggest = TIERS[data.highestTier];
    this.add.image(GAME_WIDTH / 2, 340, biggest.key).setScale(0.55);
    const statBits = [`Biggest: ${biggest.name}`];
    if (data.maxChain >= 2) statBits.push(`chain x${data.maxChain}`);
    if (data.storms > 0) statBits.push(`${data.storms}⛈`);
    if (data.goals > 0) statBits.push(`${data.goals}🎯`);
    this.add
      .text(GAME_WIDTH / 2, 398, statBits.join(' · '), {
        fontFamily: FONT, fontSize: '16px', color: '#cfd8ff',
      })
      .setOrigin(0.5);

    // "one more run" hook: how close the next skin is
    const dust = Storage.getStardust();
    const nextSkin = SKINS.filter(
      (s) => !Storage.getOwnedSkins().includes(s.id)
    ).sort((a, b) => a.cost - b.cost)[0];
    if (nextSkin) {
      const pct = Math.min(1, dust / nextSkin.cost);
      const missing = Math.max(0, nextSkin.cost - dust);
      const y = 470;
      this.add
        .text(GAME_WIDTH / 2, y - 14,
          missing === 0
            ? `🎨 ${nextSkin.name} is UNLOCKABLE in the Collection!`
            : `🎨 ${nextSkin.name}: ${missing} ✦ to go`,
          { fontFamily: FONT, fontSize: '14px', color: missing === 0 ? '#ffd54f' : '#9aa7c7' })
        .setOrigin(0.5);
      this.add.rectangle(GAME_WIDTH / 2, y + 4, 220, 8, 0x1a1a3e)
        .setStrokeStyle(1, 0x4a5580);
      this.add
        .rectangle(GAME_WIDTH / 2 - 110 + 1, y + 4, Math.max(3, 218 * pct), 6, 0xffd54f)
        .setOrigin(0, 0.5);
    }

    const dustText = this.add
      .text(
        GAME_WIDTH / 2 - 20, 436,
        `✦ +${data.stardust}  (total ${data.stardustTotal})`,
        { fontFamily: FONT, fontSize: '18px', color: '#ffd54f' }
      )
      .setOrigin(0.5);
    if (data.stardust > 0) {
      const dbl = makeButton(
        this, GAME_WIDTH / 2 + 165, 436, '📺 2x', '#80deea', '15px',
        async () => {
          dbl.setText('…').disableInteractive();
          if (await Ads.showRewarded('double_stardust')) {
            const total = Storage.addStardust(data.stardust);
            dustText.setText(`✦ +${data.stardust * 2}  (total ${total})`);
            dbl.setText('✓');
          } else {
            dbl.setText('📺 2x').setInteractive({ useHandCursor: true });
          }
        }
      );
    }

    // level-up celebration (bonus was credited in finishRun)
    if (data.leveled?.leveledUp) {
      Sfx.fanfare();
      const lvl = this.add
        .text(
          GAME_WIDTH / 2, 505,
          `🎉 LEVEL ${data.leveled.level}!  +${data.leveled.bonus} ✦`,
          { fontFamily: FONT, fontStyle: 'bold', fontSize: '20px', color: '#ce93d8' }
        )
        .setOrigin(0.5)
        .setScale(0.3);
      this.tweens.add({
        targets: lvl, scale: 1, duration: 500, ease: 'Back.easeOut',
      });
      const confetti = this.add.particles(GAME_WIDTH / 2, 505, 'dot', {
        speed: { min: 100, max: 300 },
        scale: { start: 0.8, end: 0 },
        lifespan: 900,
        quantity: 40,
        tint: [0xce93d8, 0xffd54f, 0x80deea, 0x66bb6a],
        emitting: false,
      });
      confetti.explode();
    }

    if (data.boxEarned) this.drawBox();

    const shareBtn = makeButton(
      this, GAME_WIDTH / 2, 590, '📤 SHARE', '#ce93d8', '16px',
      async () => {
        const tierHex =
          '#' + skinById(Storage.getEquippedSkin())
            .palette[data.highestTier].toString(16).padStart(6, '0');
        try {
          // native share sheet with a rendered score-card image (Android);
          // falls back to clipboard text on desktop/web
          const shared = await shareScoreCard({
            score: data.score,
            best: data.best,
            tierName: biggest.name,
            tierColor: tierHex,
            nearMiss,
            mode: data.isRush ? 'RUSH MODE' : data.isDaily ? `DAILY ${data.day}` : '',
          });
          if (shared) {
            shareBtn.setText('✓ SHARED!');
            return;
          }
        } catch {
          // user cancelled the share sheet or share unsupported — fall through
        }
        const ladder =
          '🌟'.repeat(data.highestTier + 1) + '⬛'.repeat(tiersFromSun);
        const tag = data.isRush ? ' Rush' : data.isDaily ? ` Daily ${data.day}` : '';
        const text =
          `Jar of Stars${tag} — ${data.score} pts\n${ladder}\n${nearMiss}\n` +
          'play: parthparmar06.itch.io/jar-of-stars';
        try {
          await navigator.clipboard.writeText(text);
          shareBtn.setText('✓ COPIED!');
        } catch {
          shareBtn.setText('(share blocked)');
        }
      }
    );

    const retry = makeButton(
      this, GAME_WIDTH / 2, 660,
      data.isRush ? 'RETRY RUSH' : data.isDaily ? 'RETRY DAILY' : 'ONE MORE TRY',
      '#80deea', '26px',
      async () => {
        await Ads.maybeShowInterstitial();
        this.scene.start('Game', { daily: data.isDaily, rush: data.isRush });
      }
    );
    this.tweens.add({
      targets: retry, alpha: 0.55, duration: 600, yoyo: true, repeat: -1,
    });

    makeButton(this, GAME_WIDTH / 2, 726, 'MENU', '#9aa7c7', '16px', async () => {
      await Ads.maybeShowInterstitial();
      this.scene.start('Menu');
    });
  }

  drawBox() {
    const y = 548;
    const box = makeButton(
      this, GAME_WIDTH / 2, y, '📦 OPEN MYSTERY BOX', '#ffd54f', '19px',
      () => {
        Sfx.boxOpen();
        const reward = openBox();
        box.destroy();
        const msg =
          reward.type === 'skin'
            ? `🎨 NEW SKIN: ${reward.skin.name}!`
            : `📦 +${reward.dust} ✦ stardust!`;
        const txt = this.add
          .text(GAME_WIDTH / 2 - 55, y, msg, {
            fontFamily: FONT, fontStyle: 'bold', fontSize: '19px', color: '#ffd54f',
          })
          .setOrigin(0.5)
          .setScale(0.3);
        this.tweens.add({ targets: txt, scale: 1, duration: 400, ease: 'Back.easeOut' });
        const burst = this.add.particles(GAME_WIDTH / 2, y, 'dot', {
          speed: { min: 80, max: 250 },
          scale: { start: 0.7, end: 0 },
          lifespan: 700,
          quantity: 25,
          tint: 0xffd54f,
          emitting: false,
        });
        burst.explode();

        // rewarded ad: one optional second box
        const again = makeButton(
          this, GAME_WIDTH / 2 + 150, y, '📺 +1', '#80deea', '14px',
          async () => {
            again.setText('…').disableInteractive();
            if (await Ads.showRewarded('second_box')) {
              Sfx.boxOpen();
              const r2 = openBox();
              txt.setText(
                r2.type === 'skin'
                  ? `🎨 NEW SKIN: ${r2.skin.name}!`
                  : `${msg}  +${r2.dust} ✦`
              );
              again.destroy();
            } else {
              again.setText('📺 +1').setInteractive({ useHandCursor: true });
            }
          }
        );
      }
    );
    this.tweens.add({
      targets: box, angle: 3, duration: 120, yoyo: true, repeat: -1, repeatDelay: 900,
    });
  }
}
