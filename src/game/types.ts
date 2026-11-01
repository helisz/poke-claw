import type RAPIER from '@dimforge/rapier3d-compat';
import { CAB, CLAW } from './config';

/** 一只宝可梦（图鉴数据） */
export type PokeDef = { id: number; name: string; file: string; type?: string };

/** 一颗精灵球：def 是里面装着的宝可梦，抓之前不显示 */
export interface Ball {
  def: PokeDef;
  mesh: any; // THREE.Points（共用）
  body: RAPIER.RigidBody;
}

export const BOUNDS = {
  x: [CLAW.minX, CLAW.maxX] as const,
  z: [CLAW.minZ, CLAW.maxZ] as const,
  y: [CLAW.minY, CLAW.restY] as const,
  floor: CAB.floorY,
};

export function clampAxis(pos: number, axis: 'x' | 'z' | 'y'): number {
  const [a, b] = BOUNDS[axis];
  return Math.min(b, Math.max(a, pos));
}
