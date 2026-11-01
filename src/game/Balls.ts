import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CAB, BALL } from './config';
import type { Ball, PokeDef } from './types';

const BALL_TEX = 'assets/items/pokeball@2x.png';

/** 舱内的精灵球堆：每个球是一个刚体 + 一张贴图 sprite */
export class BallView {
  balls: Ball[] = [];
  private mat!: THREE.SpriteMaterial;

  constructor(private scene: THREE.Scene, private world: RAPIER.World) {
    const tex = new THREE.TextureLoader().load(BALL_TEX);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.05, depthWrite: false });
  }

  spawn(def: PokeDef, pos: { x: number; y: number; z: number }): Ball {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setLinearDamping(0.3)
        .setAngularDamping(0.85)
        .setCcdEnabled(true),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(BALL.radius).setDensity(0.7).setFriction(0.8).setRestitution(0.15),
      body,
    );

    const sprite = new THREE.Sprite(this.mat);
    const s = BALL.radius * 2.9;
    sprite.scale.set(s, s, 1);
    sprite.center.set(0.5, 0.5);
    this.scene.add(sprite);

    // 球顶红标：让"球里装着哪只"在抓取前不可见（盲抓）
    const ball: Ball = { def, mesh: sprite, body };
    this.balls.push(ball);
    return ball;
  }

  sync() {
    for (const b of this.balls) {
      const t = b.body.translation();
      b.mesh.position.set(t.x, t.y, t.z);
    }
  }

  /** 掉出舱底 = 收下 */
  collectFallen(): Ball[] {
    const out: Ball[] = [];
    const keep: Ball[] = [];
    for (const b of this.balls) {
      if (b.body.translation().y < -0.05) {
        this.scene.remove(b.mesh);
        this.world.removeRigidBody(b.body);
        out.push(b);
      } else keep.push(b);
    }
    this.balls = keep;
    return out;
  }

  /** 金字塔堆法：前排低、后排高，模仿参考图的堆叠 */
  static layout(count: number): { x: number; y: number; z: number }[] {
    const out: { x: number; y: number; z: number }[] = [];
    const r = BALL.radius;
    const rows = 4;
    const perRow = Math.ceil(count / rows);
    const spanX = CAB.width - r * 3.2;
    const spanZ = CAB.depth - r * 3.2;
    let i = 0;
    for (let row = 0; row < rows && i < count; row++) {
      for (let c = 0; c < perRow && i < count; c++, i++) {
        const tx = perRow > 1 ? c / (perRow - 1) - 0.5 : 0;
        const tz = rows > 1 ? row / (rows - 1) - 0.5 : 0;
        const jx = (Math.random() - 0.5) * 0.04;
        const jz = (Math.random() - 0.5) * 0.04;
        const stack = row / Math.max(1, rows - 1);
        out.push({
          x: tx * spanX + jx,
          y: -0.16 + r + stack * 0.16,
          z: tz * spanZ + jz,
        });
      }
    }
    return out;
  }
}
