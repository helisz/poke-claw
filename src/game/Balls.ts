import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CAB, BALL } from './config';
import type { Ball, PokeDef } from './types';

const BALL_TEX = 'assets/items/pokeball_tex@2x.png';

/**
 * 舱内的精灵球堆。
 *
 * 视觉：用 Points + 自定义 shader 画公告板精灵（sprite），一个 drawcall 搞定。
 *   为什么要自己写：THREE.Sprite 每帧每球一次 drawcall，且透明排序按物体中心，
 *   球一半埋进球堆时会被前面更大的物体整个盖掉 —— 表现就是"球显示不全"。
 *   手写的 Points 用 gl_PointSize 出公告板，alphaTest 丢弃透明像素，
 *   写深度但可排序，遮挡关系才是对的。
 */
export class BallView {
  balls: Ball[] = [];
  points!: THREE.Points;
  private geometry = new THREE.BufferGeometry();
  private material!: THREE.ShaderMaterial;
  private tex: THREE.Texture;

  constructor(private scene: THREE.Scene, private world: RAPIER.World) {
    this.tex = new THREE.TextureLoader().load(BALL_TEX);
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.generateMipmaps = true;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.tex },
        uScale: { value: 400 },
        uEyeZ: { value: 3.0 },
      },
      vertexShader: /* glsl */ `
        uniform float uScale;   // 视口高 / 世界高（像素每米，近处基准）
        uniform float uEyeZ;    // 相机到世界原点的距离
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // 透视式近大远小：越靠近相机（-mv.z 小）越大
          float persp = uEyeZ / max(0.15, -mv.z);
          gl_PointSize = uScale * ${BALL.radius.toFixed(4)} * 2.0 / 0.68 * persp;
          gl_Position = projectionMatrix * mv;
          vAlpha = 1.0;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying float vAlpha;
        void main() {
          vec4 c = texture2D(uMap, gl_PointCoord);
          if (c.a < 0.35) discard;   // 硬边，保住像素风
          gl_FragColor = vec4(c.rgb, c.a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: true,
      depthTest: true,
    });

    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 1;
    this.scene.add(this.points);
  }

  setViewportScale(pxPerMeter: number, eyeZ = 3.0) {
    this.material.uniforms.uScale.value = pxPerMeter;
    this.material.uniforms.uEyeZ.value = eyeZ;
  }

  /** 从上方投放：模拟"倒进球仓"，靠重力自己滚进去 */
  spawn(def: PokeDef, dropFrom: { x: number; z: number }, stagger = 0): Ball {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(
          dropFrom.x + (Math.random() - 0.5) * 0.06,
          CAB.ceilY - 0.14 + stagger * 0.055,
          dropFrom.z + (Math.random() - 0.5) * 0.06,
        )
        .setLinearDamping(0.12)
        .setAngularDamping(0.35)
        .setCcdEnabled(true),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(BALL.radius)
        .setDensity(0.8)
        .setFriction(0.45)
        .setRestitution(0.42),
      body,
    );
    // 轻微初速，让落下来的球散开而不是垂直叠罗汉
    body.setLinvel({ x: (Math.random() - 0.5) * 0.5, y: -0.4, z: (Math.random() - 0.5) * 0.35 }, true);

    const ball: Ball = { def, mesh: this.points, body };
    this.balls.push(ball);
    return ball;
  }

  sync() {
    const attr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const n = this.balls.length;
    if (attr.count !== n) {
      this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    }
    const arr = (this.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    this.balls.forEach((b, i) => {
      const t = b.body.translation();
      arr[i * 3] = t.x;
      arr[i * 3 + 1] = t.y;
      arr[i * 3 + 2] = t.z;
    });
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  remove(target: Ball) {
    const i = this.balls.indexOf(target);
    if (i >= 0) this.balls.splice(i, 1);
    this.world.removeRigidBody(target.body);
  }

  /** 全部静止后切成固定刚体：不再抖、省 CPU，且不影响抓取判定 */
  freezeSettled() {
    for (const bl of this.balls) {
      const v = bl.body.linvel();
      if (Math.hypot(v.x, v.y, v.z) < 0.08) bl.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
    }
  }

  /** 是否已经全部静止（判断"倒球动画"结束） */
  settled(): boolean {
    return this.balls.every((b) => {
      const v = b.body.linvel();
      return Math.hypot(v.x, v.y, v.z) < 0.06;
    });
  }
}
