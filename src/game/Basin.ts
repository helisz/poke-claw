import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CAB } from './config';

const SEG = 28; // 圆周分段
const RING = 14; // 同心环数
const CENTER_Y = -0.15; // 盆心深度
const RIM_Y = -0.01; // 盆沿高度
const R_X = CAB.width / 2;
const R_Z = CAB.depth / 2;

/** 椭圆盆面高度：归一化半径 r(0..1) → y */
export function basinY(r: number): number {
  // 二次倒锥，圆润不突兀：中间低、边缘贴舱壁
  const t = Math.min(1, Math.max(0, r));
  return CENTER_Y + (RIM_Y - CENTER_Y) * (t * t);
}

/** 归一化半径：把椭圆截面压成单位圆 */
export function normRadius(x: number, z: number): number {
  return Math.hypot(x / R_X, z / R_Z);
}

export class Basin {
  group = new THREE.Group();

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.buildVisual(scene);
    this.buildPhysics(world);
  }

  /** 视觉：同心环拼出的浅锥盆面 */
  private buildVisual(scene: THREE.Scene) {
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [];
    const uvs: number[] = [];

    for (let i = 0; i < RING; i++) {
      const r0 = i / RING;
      const r1 = (i + 1) / RING;
      for (let s = 0; s < SEG; s++) {
        const a0 = (s / SEG) * Math.PI * 2;
        const a1 = ((s + 1) / SEG) * Math.PI * 2;
        const p = (r: number, a: number) => {
          const x = Math.cos(a) * r * R_X;
          const z = Math.sin(a) * r * R_Z + CAB.depth * 0.02;
          return [x, basinY(r), z] as const;
        };
        const v00 = p(r0, a0);
        const v01 = p(r0, a1);
        const v10 = p(r1, a0);
        const v11 = p(r1, a1);
        // 两个三角形
        for (const v of [v00, v10, v11, v00, v11, v01]) {
          verts.push(v[0], v[1], v[2]);
          uvs.push((v[0] + R_X) / (2 * R_X), (v[2] + R_Z) / (2 * R_Z));
        }
      }
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0xdfe9f7,
      roughness: 0.92,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    scene.add(this.group);
  }

  /** 物理：同样用三角形拼出盆面（静态三角网碰撞体） */
  private buildPhysics(world: RAPIER.World) {
    const verts = new Float32Array((RING * SEG * 2 * 3) * 3);
    const idx = new Uint32Array(RING * SEG * 2 * 3);
    let vi = 0;
    let ii = 0;

    const push = (x: number, y: number, z: number) => {
      verts[vi++] = x;
      verts[vi++] = y;
      verts[vi++] = z;
      return (vi / 3 - 1) | 0;
    };

    for (let i = 0; i < RING; i++) {
      const r0 = i / RING;
      const r1 = (i + 1) / RING;
      for (let s = 0; s < SEG; s++) {
        const a0 = (s / SEG) * Math.PI * 2;
        const a1 = ((s + 1) / SEG) * Math.PI * 2;
        const mk = (r: number, a: number) =>
          push(Math.cos(a) * r * R_X, basinY(r), Math.sin(a) * r * R_Z + CAB.depth * 0.02);
        const a00 = mk(r0, a0);
        const a01 = mk(r0, a1);
        const a10 = mk(r1, a0);
        const a11 = mk(r1, a1);
        idx[ii++] = a00; idx[ii++] = a10; idx[ii++] = a11;
        idx[ii++] = a00; idx[ii++] = a11; idx[ii++] = a01;
      }
    }

    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.trimesh(verts, idx).setFriction(0.6).setRestitution(0.05),
      body,
    );
  }
}
