import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './constants.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import AlbumScene from './scenes/AlbumScene.js';

async function boot() {
  // make sure the bundled font is usable before any text renders
  try {
    await document.fonts.load('800 32px "Baloo 2"');
    await document.fonts.load('600 18px "Baloo 2"');
  } catch {
    // fall back silently to the system stack
  }

  const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0b0b1e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1 },
      enableSleeping: true,
    },
  },
    scene: [BootScene, MenuScene, GameScene, GameOverScene, AlbumScene],
  });

  // test/debug handle (also used by automated verification)
  window.__JOS = game;
}

boot();
