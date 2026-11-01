import type RAPIER from '@dimforge/rapier3d-compat';
import { CAB, CLAW } from './config';

export type DollDef = { id: number; name: string; file: string };

export interface Doll {
  id: number;
  name: string;
  mesh: any; // THREE.Sprite
  body: RAPIER.RigidBody;
  lastPos: { x: number; y: number; z: number };
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
