import Phaser from 'phaser';
import { generateTextures } from '../textures.js';
import { skinById } from '../config/skins.js';
import { Storage } from '../storage.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    generateTextures(this, skinById(Storage.getEquippedSkin()).palette);
    this.scene.start('Menu');
  }
}
