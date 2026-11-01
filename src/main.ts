import Phaser from 'phaser';
import { W, H } from './config';
import { ClawScene } from './game/ClawScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#e8e0cd',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1 },
      debug: false,
    },
  },
  scene: [ClawScene],
};

const game = new Phaser.Game(config);
// 调试用句柄
(window as any).__GAME__ = game;
