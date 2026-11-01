import * as THREE from 'three';
import { CLAW, PALETTE } from './config';

const metal = () => new THREE.MeshStandardMaterial({ color: PALETTE.metal, metalness: 0.75, roughness: 0.32 });
const metalDark = () => new THREE.MeshStandardMaterial({ color: PALETTE.metalDark, metalness: 0.8, roughness: 0.3 });
const metalLight = () => new THREE.MeshStandardMaterial({ color: PALETTE.metalLight, metalness: 0.6, roughness: 0.35 });

/**
 * 三指爪：中心盒 + 三根爪子（沿圆周 120° 分布）。
 * 爪子绕自身根部铰链开合，网格挂在 hinge 上，直接插值 hinge.rotation。
 */
export class Claw {
  group = new THREE.Group();
  private hinges: THREE.Group[] = [];
  private cable: THREE.Mesh;
  private openAmount = 1; // 1 = 全开, 0 = 全合
  private targetOpen = 1;

  constructor(scene: THREE.Scene) {
    this.group.position.set(0, CLAW.restY, 0);

    // 吊索
    const cableGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 8);
    this.cable = new THREE.Mesh(cableGeo, metalDark());
    this.cable.position.set(0, 0.5, 0);
    scene.add(this.cable);

    // 中心盒（放大，保证镜头里看得清）
    const hub = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.2), metal());
    this.group.add(hub);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12), metalLight());
    collar.position.y = 0.08;
    this.group.add(collar);

    // 三根爪
    const prongGeo = new THREE.BoxGeometry(0.035, CLAW.prongLen, 0.035);
    for (let i = 0; i < 3; i++) {
      const hinge = new THREE.Group();
      const ang = (i / 3) * Math.PI * 2;
      hinge.position.set(Math.cos(ang) * 0.085, -0.05, Math.sin(ang) * 0.085);
      hinge.rotation.y = -ang;

      const prong = new THREE.Mesh(prongGeo, metal());
      prong.position.set(CLAW.prongLen * 0.34, -CLAW.prongLen / 2, 0);
      prong.rotation.z = 0.34; // 基础外张，看得出"三个爪指"
      hinge.add(prong);

      // 爪尖向内弯的小节
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.075, 0.036), metalLight());
      tip.position.set(CLAW.prongLen * 0.5 + 0.014, -CLAW.prongLen * 0.93, 0);
      tip.rotation.z = 0.9;
      hinge.add(tip);

      this.hinges.push(hinge);
      this.group.add(hinge);
    }

    const clawLight = new THREE.PointLight(0xffffff, 6, 1.2, 2);
    clawLight.position.set(0, 0.05, 0.1);
    this.group.add(clawLight);

    scene.add(this.group);
    this.applyOpen();
  }

  private applyOpen() {
    // 张开 = 爪指向外倾；闭合 = 竖直内收
    const tilt = 0.55 * this.openAmount;
    for (const h of this.hinges) h.rotation.x = tilt;
  }

  get position() {
    return this.group.position;
  }

  setPosition(x: number, y: number, z: number) {
    this.group.position.set(x, y, z);
    // 吊索跟随：从顶棚挂下来
    const top = 1.55;
    const len = Math.max(0.02, top - y);
    this.cable.scale.y = len;
    this.cable.position.set(x, y + len / 2, z);
  }

  setOpen(target: number, instant = false) {
    this.targetOpen = THREE.MathUtils.clamp(target, 0, 1);
    if (instant) {
      this.openAmount = this.targetOpen;
      this.applyOpen();
    }
  }

  get open() {
    return this.openAmount;
  }

  update(dt: number) {
    const speed = 4.5;
    if (Math.abs(this.openAmount - this.targetOpen) > 0.001) {
      this.openAmount += Math.sign(this.targetOpen - this.openAmount) * Math.min(Math.abs(this.targetOpen - this.openAmount), speed * dt);
      this.applyOpen();
    }
  }
}
