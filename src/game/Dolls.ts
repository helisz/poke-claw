import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CAB, DOLL } from './config';
import type { Doll, DollDef } from './types';

/** 娃娃贴图（billboard）姿态：始终朝向相机 */
export class DollView {
  scene: THREE.Scene;
  world: RAPIER.World;
  dolls: Doll[] = [];
  private matCache = new Map<string, THREE.SpriteMaterial>();
  private scaleSeed = 12345;

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.scene = scene;
    this.world = world;
  }

  private spriteMaterial(file: string): THREE.SpriteMaterial {
    const hit = this.matCache.get(file);
    if (hit) return hit;
    const tex = new THREE.TextureLoader().load(file);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.05, depthWrite: false });
    this.matCache.set(file, mat);
    return mat;
  }

  /** 预加载全部贴图，避免进场闪白 */
  async preload(files: string[]): Promise<void> {
    const loader = new THREE.TextureLoader();
    await Promise.all(
      files.map(
        (f) =>
          new Promise<void>((res) => {
            loader.load(f, (t: THREE.Texture) => {
              t.magFilter = THREE.NearestFilter;
              t.minFilter = THREE.NearestFilter;
              t.colorSpace = THREE.SRGBColorSpace;
              res();
            }, undefined, () => res());
          }),
      ),
    );
  }

  /** 生成一个娃娃：物理用胶囊体，视觉用 sprite */
  spawn(def: DollDef, pos: { x: number; y: number; z: number }): Doll {
    const rbDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setLinearDamping(0.35)
      .setAngularDamping(0.9)
      .setCcdEnabled(true);
    const body = this.world.createRigidBody(rbDesc);
    const col = RAPIER.ColliderDesc.capsule(DOLL.halfHeight, DOLL.radius)
      .setDensity(0.55)
      .setFriction(0.85)
      .setRestitution(0.08);
    this.world.createCollider(col, body);

    const sprite = new THREE.Sprite(this.spriteMaterial(def.file));
    // 大小在 ±12% 内浮动，堆里才不会像等大的贴纸
    this.scaleSeed = (this.scaleSeed * 16807) % 2147483647;
    const vary = 0.88 + (this.scaleSeed % 1000) / 1000 * 0.24;
    const s = DOLL.radius * 2.6 * vary;
    sprite.scale.set(s, s, 1);
    sprite.center.set(0.5, 0.5);
    this.scene.add(sprite);

    const doll: Doll = {
      id: def.id,
      name: def.name,
      mesh: sprite,
      body,
      lastPos: { ...pos },
    };
    this.dolls.push(doll);
    return doll;
  }

  /** 每帧把物理位姿同步到 sprite；被抓住的娃娃改由爪子驱动 */
  sync(grabbed: Doll | null, grabPoint: THREE.Vector3 | null) {
    for (const d of this.dolls) {
      if (grabbed && d === grabbed && grabPoint) {
        const p = d.body.translation();
        // 平滑跟随爪心，制造摆动的观感
        const nx = p.x + (grabPoint.x - p.x) * 0.55;
        const ny = p.y + (grabPoint.y - DOLL.radius * 0.55 - p.y) * 0.55;
        const nz = p.z + (grabPoint.z - p.z) * 0.55;
        d.body.setTranslation({ x: nx, y: ny, z: nz }, true);
        d.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        d.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      const t = d.body.translation();
      d.mesh.position.set(t.x, t.y, t.z);
      d.lastPos = { x: t.x, y: t.y, z: t.z };
    }
  }

  /** 落进取物口（z < -depth/2 外）判定为收获 */
  collectFallen(): Doll[] {
    const fallen: Doll[] = [];
    const keep: Doll[] = [];
    for (const d of this.dolls) {
      const t = d.body.translation();
      if (t.y < -0.05) { // 掉出舱底 = 收进取物口
        this.scene.remove(d.mesh);
        this.world.removeRigidBody(d.body);
        fallen.push(d);
      } else keep.push(d);
    }
    this.dolls = keep;
    return fallen;
  }

  static chunk(defs: DollDef[]): { x: number; y: number; z: number }[] {
    // 金字塔式堆叠，前排低后排高，模拟参考图
    const out: { x: number; y: number; z: number }[] = [];
    const rows = 4;
    const perRow = Math.ceil(defs.length / rows);
    const spanX = CAB.width - DOLL.radius * 2.8;
    const spanZ = CAB.depth - DOLL.radius * 2.8;
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < perRow && i < defs.length; c++, i++) {
        const tx = perRow > 1 ? (c / (perRow - 1)) - 0.5 : 0;
        const tz = rows > 1 ? (r / (rows - 1)) - 0.5 : 0;
        const jitter = () => (Math.random() - 0.5) * 0.02;
        const x = tx * spanX + jitter();
        const z = tz * spanZ + jitter();
        const baseY = -0.16 + DOLL.radius + DOLL.halfHeight; // 落进取物口平面
        // r=0 是前排（z 最大，离相机最近），后排堆更高更像参考图
        const pile = (r / Math.max(1, rows - 1)) * 0.14;
        out.push({ x, y: baseY + pile + jitter() * 2, z });
      }
    }
    return out;
  }
}
