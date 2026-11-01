// 世界尺寸（逻辑像素）
export const W = 420;
export const H = 560;

export const CAB = {
  x: 46,
  y: 96,
  w: 328,
  h: 372,
  get innerX() { return this.x + 12; },
  get innerY() { return this.y + 10; },
  get innerW() { return this.w - 24; },
  get innerH() { return this.h - 20; },
};

export const CLAW = {
  minX: CAB.innerX + 40,
  maxX: CAB.innerX + CAB.innerW - 40,
  restY: CAB.innerY + 34,
  dropY: CAB.innerY + CAB.innerH - 120,
  moveSpeed: 150,
  dropSpeed: 220,
  riseSpeed: 180,
  // —— 摆锤 ——
  gravity: 1500,
  damp: 0.62,
  couple: 1.0,
  maxTheta: 0.42,
};

export const GAME = {
  tries: 8,
  count: 10, // MVP 测试：只放 10 只
  baseSize: 56, // 精灵图基准边长（乘体型系数）
  slipChance: 0.18,
};

export const RARE_IDS = new Set([
  144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 384, 483, 484,
]);
