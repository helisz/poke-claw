import Phaser from 'phaser';
import { CAB, CLAW, GAME } from '../config';
import { scaleOf } from './Size';

export interface PokeDef {
  id: number;
  name: string;
  file: string;
  type?: string;
}

export interface HullData {
  hull: [number, number][]; // 归一化 0..1，相对图片宽高
  bbox: { x: number; y: number; w: number; h: number };
  areaRatio: number;
}

export interface Poke {
  def: PokeDef;
  sprite: Phaser.Physics.Matter.Image;
  radius: number; // 用于抓取判定的半径
  scale: number;
}

/**
 * 宝可梦池：Matter 刚体，碰撞体用从精灵图 alpha 提取的凸包。
 * 舱底是浅 V 型（两段斜板），宝可梦靠重力自然往中间聚。
 */
export class PokePit {
  bodies: Poke[] = [];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.buildBasin();
  }

  private buildBasin() {
    const { innerX, innerY, innerW, innerH } = CAB;
    // 盆地最低点贴近舱底
    const bottomY = innerY + innerH - 4;
    const midX = innerX + innerW / 2;
    const dipY = bottomY + 6;
    const opts = { isStatic: true, friction: 0.6, restitution: 0.04 };

    // 两段斜板组成浅 V（从两侧壁斜向中心最低点）
    for (const [x1, y1, x2, y2] of [
      [innerX - 10, bottomY - 70, midX, dipY],
      [midX, dipY, innerX + innerW + 10, bottomY - 70],
    ] as const) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const len = Math.hypot(x2 - x1, y2 - y1);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      this.scene.matter.add.rectangle(mx, my, len, 14, { ...opts, angle: ang });
    }

    // 左右壁 + 顶盖
    this.scene.matter.add.rectangle(innerX - 8, innerY + innerH / 2 - 30, 14, innerH + 60, opts);
    this.scene.matter.add.rectangle(innerX + innerW + 8, innerY + innerH / 2 - 30, 14, innerH + 60, opts);
    this.scene.matter.add.rectangle(innerX + innerW / 2, innerY - 16, innerW + 60, 14, opts);
  }

  /** 用凸包生成一个宝可梦刚体 */
  spawnOne(def: PokeDef, hull: HullData, x: number, y: number): Poke {
    const scale = scaleOf(def.id);
    // 精灵图统一画成 baseSize 见方
    const baseSize = GAME.baseSize;
    const drawW = baseSize * scale;
    const drawH = baseSize * scale;

    // 凸包顶点 → 相对中心的像素坐标
    const verts = hull.hull.map(([nx, ny]) => ({
      x: (nx - 0.5) * drawW,
      y: (ny - 0.5) * drawH,
    }));

    const key = `poke-${def.id}`;
    if (!this.scene.textures.exists(key)) {
      // 纹理在 preload 里已加载，这里只是取 key
    }

    const img = this.scene.matter.add.image(x, y, key, undefined, {
      shape: { type: 'fromVerts', verts, flagInternal: true },
      friction: 0.5,
      frictionStatic: 0.7,
      restitution: 0.12,
      density: 0.0016,
      frictionAir: 0.02,
    } as any);

    img.setDisplaySize(drawW, drawH);
    img.setVelocity((Math.random() - 0.5) * 1.5, Math.random() * 1.5);
    img.setAngularVelocity((Math.random() - 0.5) * 0.05);

    // 抓取判定用的等效半径（按包围盒对角线的一半）
    const radius = (Math.hypot(hull.bbox.w * scale, hull.bbox.h * scale) / 2) * 0.86;

    const p: Poke = { def, sprite: img, radius, scale };
    this.bodies.push(p);
    return p;
  }

  /** 找出爪心附近、最靠上的一只 */
  pickAt(x: number, y: number): Poke | null {
    let best: Poke | null = null;
    let bestScore = Infinity;
    for (const p of this.bodies) {
      const dx = Math.abs(p.sprite.x - x);
      const dy = p.sprite.y - y;
      // 水平必须在覆盖范围
      if (dx > p.radius * 1.05) continue;
      // 爪尖应该在宝可梦的上方或身体范围内，垂直容差按体型放宽
      if (Math.abs(dy) > p.radius * 3.0) continue;
      const score = dx * 1.6 + Math.abs(dy) * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  }

  remove(p: Poke) {
    const i = this.bodies.indexOf(p);
    if (i >= 0) this.bodies.splice(i, 1);
    p.sprite.destroy();
  }

  settled(): boolean {
    return this.bodies.every((p) => {
      const v = p.sprite.body?.velocity;
      return !v || Math.hypot(v.x, v.y) < 0.15;
    });
  }
}
