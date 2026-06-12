import Phaser from 'phaser';
import { GAME_WIDTH, FONT } from '../constants.js';
import { SKINS, skinById } from '../config/skins.js';
import { Storage } from '../storage.js';
import { Sfx } from '../sfx.js';
import { generateTextures } from '../textures.js';
import { sprinkleStars, makeButton } from './MenuScene.js';

const CARD_W = 200;
const CARD_H = 88;

export default class AlbumScene extends Phaser.Scene {
  constructor() {
    super('Album');
  }

  create() {
    sprinkleStars(this);

    this.add
      .text(GAME_WIDTH / 2, 50, 'COLLECTION', {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '34px', color: '#ce93d8',
      })
      .setOrigin(0.5);

    this.dustText = this.add
      .text(GAME_WIDTH / 2, 92, `✦ ${Storage.getStardust()}`, {
        fontFamily: FONT, fontSize: '20px', color: '#ffd54f',
      })
      .setOrigin(0.5);

    this.toast = this.add
      .text(GAME_WIDTH / 2, 122, '', {
        fontFamily: FONT, fontSize: '16px', color: '#ef9a9a',
      })
      .setOrigin(0.5);

    SKINS.forEach((skin, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      this.drawCard(
        130 + col * 220,
        178 + row * 100,
        skin
      );
    });

    makeButton(this, GAME_WIDTH / 2, 760, '◀ BACK', '#80deea', '22px', () =>
      this.scene.start('Menu')
    );
  }

  drawCard(x, y, skin) {
    const owned = Storage.getOwnedSkins().includes(skin.id);
    const equipped = Storage.getEquippedSkin() === skin.id;

    const card = this.add
      .rectangle(x, y, CARD_W, CARD_H, 0x1a1a3e, 0.9)
      .setStrokeStyle(2, equipped ? 0xffd54f : owned ? 0x80deea : 0x4a5580)
      .setInteractive({ useHandCursor: true });

    // mini palette preview: first/middle/top tiers
    [0, 4, 9].forEach((tierIdx, j) => {
      this.add.circle(x - 60 + j * 30, y - 18, 11, skin.palette[tierIdx]);
    });

    this.add
      .text(x, y + 8, skin.name, {
        fontFamily: FONT, fontSize: '15px', color: '#ffffff',
      })
      .setOrigin(0.5);

    const status = equipped
      ? 'EQUIPPED'
      : owned
        ? 'tap to equip'
        : `✦ ${skin.cost}`;
    this.add
      .text(x, y + 30, status, {
        fontFamily: FONT,
        fontSize: '14px',
        color: equipped ? '#ffd54f' : owned ? '#80deea' : '#9aa7c7',
      })
      .setOrigin(0.5);

    card.on('pointerup', () => this.onCardTap(skin));
  }

  onCardTap(skin) {
    const owned = Storage.getOwnedSkins().includes(skin.id);
    if (owned) {
      Storage.setEquippedSkin(skin.id);
      generateTextures(this, skinById(skin.id).palette);
      Sfx.ui();
    } else if (Storage.spendStardust(skin.cost)) {
      Storage.ownSkin(skin.id);
      Storage.setEquippedSkin(skin.id);
      generateTextures(this, skinById(skin.id).palette);
      Sfx.reward();
    } else {
      this.toast.setText(`Not enough stardust — need ✦ ${skin.cost}`);
      this.toast.setAlpha(1);
      this.tweens.add({ targets: this.toast, alpha: 0, delay: 1500, duration: 400 });
      return;
    }
    this.scene.restart();
  }
}
