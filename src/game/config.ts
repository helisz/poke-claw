// 世界与机器尺寸常量（米）
export const CAB = {
  width: 1.6, // x 内部宽
  depth: 1.1, // z 内部深
  floorY: 0, // 舱底
  ceilY: 1.35, // 顶棚高度（爪子初始悬挂点）
  glassY: 1.0, // 玻璃仓视觉高度
};

// 爪子可移动包围盒
export const CLAW = {
  minX: -0.62,
  maxX: 0.62,
  minZ: -0.34,
  maxZ: 0.34,
  restY: 1.1,
  minY: 0.06,
  speed: 0.55, // m/s 水平
  dropSpeed: 0.9, // m/s 下降
  riseSpeed: 0.85, // m/s 上升
  openAngle: 0.62, // rad
  prongLen: 0.19,
};

export const BALL = {
  radius: 0.1,
  grabRadius: 0.21,
};

// 舱底呈浅锥形盆底：四壁向中心下倾，球受重力自然往中间聚集
export const BASIN = {
  rimY: -0.01, // 盆沿高度（贴四壁处）
  centerY: -0.15, // 盆心最低点
  rings: 14, // 同心环数（越大越平滑）
  segs: 28, // 圆周分段
  // 抓起来之后的脱手概率（0-1）
  slipChance: 0.45,
};

export const PALETTE = {
  red: 0xe84b4b,
  redDark: 0xc93b3b,
  bg: 0xcfe7f7,
  panel: 0xeaf7ff,
  ink: 0x2f4f8f,
  yellow: 0xffd84d,
  green: 0x69c94a,
  greenLight: 0xb7eb72,
  greenDark: 0x3e8e2e,
  metal: 0x8e90bc,
  metalLight: 0xc9d3f0,
  metalDark: 0x5c5c86,
  cyan: 0x7ee3e8,
};

/** 爪心是否能罩住球（只看水平距离，容错宽松） */
export function withinGrabReach(claw: { x: number; z: number }, ball: { x: number; z: number }): boolean {
  return Math.hypot(claw.x - ball.x, claw.z - ball.z) < BALL.grabRadius;
}
