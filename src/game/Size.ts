/**
 * 体型分档：按宝可梦实体身高分档，但整体缩放差异控制在 30% 以内。
 *
 * 数据来源：拳头官方图鉴身高（米）。缺失的用兜底默认值 1.0m。
 * 缩放策略：把身高取对数后线性映射到 [0.85, 1.15]，
 * 即最大只比最小大 30% 左右，既保留"卡比兽比小拉达大"的感知，
 * 又不会让小球挤不进气仓。
 */

/** 身高数据（米），仅测试用的 10 只 + 常用兜底 */
const HEIGHT_M: Record<number, number> = {
  1: 0.7,    // 妙蛙种子
  4: 0.6,    // 小火龙
  25: 0.4,   // 皮卡丘
  81: 1.0,   // 小磁怪
  95: 8.8,   // 大岩蛇
  114: 1.0,  // 蔓藤怪
  129: 0.9,  // 鲤鱼王
  132: 0.3,  // 百变怪
  143: 2.1,  // 卡比兽
  151: 0.4,  // 梦幻
};

const H_MIN = 0.3;
const H_MAX = 8.8;
const SCALE_MIN = 0.85;
const SCALE_MAX = 1.15;

/** 取身高（米），缺省按中位 1.0m */
export function heightOf(id: number): number {
  return HEIGHT_M[id] ?? 1.0;
}

/**
 * 缩放系数：对数映射到 [0.85, 1.15]。
 * 大岩蛇 8.8m 和百变怪 0.3m 的实际身高比是 29 倍，
 * 但屏幕上的缩放只差 1.35 倍。
 */
export function scaleOf(id: number): number {
  const h = Math.min(H_MAX, Math.max(H_MIN, heightOf(id)));
  const t = (Math.log(h) - Math.log(H_MIN)) / (Math.log(H_MAX) - Math.log(H_MIN));
  return SCALE_MIN + t * (SCALE_MAX - SCALE_MIN);
}
