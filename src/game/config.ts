// 世界与机器尺寸常量（米）
export const CAB = {
  width: 1.6, // x 内部宽
  depth: 1.1, // z 内部深
  floorY: 0, // 舱底
  ceilY: 1.35, // 顶棚高度
  glassY: 1.0,
};

// 爪子可移动包围盒
export const CLAW = {
  minX: -0.62,
  maxX: 0.62,
  minZ: -0.34,
  maxZ: 0.34,
  restY: 0.92,
  minY: 0.0,
  speed: 0.55, // m/s 水平
  dropSpeed: 0.9, // m/s 下降
  riseSpeed: 0.85, // m/s 上升
  prongLen: 0.24,
};

/** 精灵球 */
export const BALL = {
  radius: 0.1,
  /** 夹爪闭合时能罩住的水平半径 —— 手感的核心参数 */
  grabRadius: 0.21,
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

/** 抓取判定：爪心是否罩住这个球（只看水平面，爪子够深就能夹到） */
export function withinGrabReach(
  claw: { x: number; z: number },
  ball: { x: number; z: number },
): boolean {
  return Math.hypot(claw.x - ball.x, claw.z - ball.z) < BALL.grabRadius;
}
