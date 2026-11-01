import Phaser from 'phaser';
import { CAB, CLAW, H, W } from '../config';

const INK = 0x2b2b2b;
const PAPER = 0xfdf8ee;
const PAPER2 = 0xf3ead4;
const GRID = 0xe4d9bd;
const ACCENT = 0xf0a04b;
const RED = 0xe2584d;

/** 画机器外壳（底层，不会动，画一次就行） */
export function drawMachine(g: Phaser.GameObjects.Graphics) {
  const { x, y, w, h } = CAB;

  // 底座
  g.fillStyle(PAPER2, 1);
  g.fillRoundedRect(x - 16, y + h - 4, w + 32, 34, 10);
  g.lineStyle(3, INK, 1);
  g.strokeRoundedRect(x - 16, y + h - 4, w + 32, 34, 10);

  // 机身
  g.fillStyle(0xfffdf6, 1);
  g.fillRoundedRect(x - 12, y - 34, w + 24, h + 34, 16);
  g.lineStyle(3, INK, 1);
  g.strokeRoundedRect(x - 12, y - 34, w + 24, h + 34, 16);

  // 顶部招牌
  g.fillStyle(ACCENT, 1);
  g.fillRoundedRect(x + 8, y - 30, w - 16, 30, 8);
  g.lineStyle(3, INK, 1);
  g.strokeRoundedRect(x + 8, y - 30, w - 16, 30, 8);

  // 玻璃仓背景
  g.fillStyle(PAPER, 1);
  g.fillRect(x, y, w, h);

  // 网格
  g.lineStyle(1.5, GRID, 1);
  const gs = 26;
  for (let gx = x; gx <= x + w; gx += gs) {
    g.beginPath();
    g.moveTo(gx, y);
    g.lineTo(gx, y + h);
    g.strokePath();
  }
  for (let gy = y; gy <= y + h; gy += gs) {
    g.beginPath();
    g.moveTo(x, gy);
    g.lineTo(x + w, gy);
    g.strokePath();
  }

  // 底部地面
  const floorTop = CAB.innerY + CAB.innerH - 78;
  g.fillStyle(0xefe4cc, 1);
  g.fillRect(x, floorTop, w, y + h - floorTop);

  // 玻璃框
  g.lineStyle(3, INK, 1);
  g.strokeRoundedRect(x, y, w, h, 12);

  // 顶部导轨
  g.lineStyle(4, INK, 1);
  g.beginPath();
  g.moveTo(CAB.innerX + 6, CLAW.restY - 40);
  g.lineTo(CAB.innerX + CAB.innerW - 6, CLAW.restY - 40);
  g.strokePath();

  // 出奖口
  g.fillStyle(0xd8cbb0, 1);
  g.fillRoundedRect(x + 26, y + h - 26, 88, 22, 6);
  g.lineStyle(2.5, INK, 1);
  g.strokeRoundedRect(x + 26, y + h - 26, 88, 22, 6);

  // START 按钮
  g.fillStyle(RED, 1);
  g.fillRoundedRect(x + w - 92, y + h - 26, 66, 22, 6);
  g.lineStyle(2.5, INK, 1);
  g.strokeRoundedRect(x + w - 92, y + h - 26, 66, 22, 6);
}

/** 背景 */
export function drawBackdrop(g: Phaser.GameObjects.Graphics) {
  g.fillStyle(0xe8e0cd, 1);
  g.fillRect(0, 0, W, H);
  g.lineStyle(2, 0xffffff, 0.5);
  const gs = 34;
  for (let gx = 0; gx <= W; gx += gs) {
    g.beginPath();
    g.moveTo(gx, 0);
    g.lineTo(gx, H);
    g.strokePath();
  }
  for (let gy = 0; gy <= H; gy += gs) {
    g.beginPath();
    g.moveTo(0, gy);
    g.lineTo(W, gy);
    g.strokePath();
  }
}
