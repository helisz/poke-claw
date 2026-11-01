import * as THREE from 'three';
import { CAB, PALETTE } from './config';

const mat = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...extra });

/** 红白机身 + 玻璃仓 + 轨道 + 取物口 */
export function buildMachine(scene: THREE.Scene): THREE.Group {
  const root = new THREE.Group();
  const W = CAB.width;
  const D = CAB.depth;
  const H = CAB.ceilY;

  // 底座
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.16, D + 0.5), mat(PALETTE.red));
  base.position.y = -0.08;
  root.add(base);

  // 舱底
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, D), mat(0xdfe9f7, { roughness: 0.9 }));
  floor.position.y = -0.06;
  root.add(floor);

  // 四根红柱
  const pillarGeo = new THREE.BoxGeometry(0.09, H, 0.09);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(pillarGeo, mat(PALETTE.red));
      p.position.set((sx * (W + 0.09)) / 2, H / 2, (sz * (D + 0.09)) / 2);
      root.add(p);
    }
  }

  // 背板 / 侧板（挡视线以外）
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.05), mat(0xdfeaf8, { roughness: 0.95 }));
  back.position.set(0, H / 2, -D / 2 - 0.02);
  root.add(back);

  // 顶棚：只留后侧一条横梁，前侧完全敞开，爪子根部不被遮挡
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(W + 0.24, 0.1, 0.18), mat(PALETTE.red));
  topBeam.position.set(0, H + 0.05, -D / 2 + 0.06);
  root.add(topBeam);

  // 顶棚右侧延伸板（造型，不压爪子上方）
  const topDeck = new THREE.Mesh(new THREE.BoxGeometry(W + 0.24, 0.06, D * 0.34), mat(PALETTE.red));
  topDeck.position.set(0, H + 0.03, -D / 2 + 0.28);
  root.add(topDeck);

  // 顶棚黄色铆钉
  const studGeo = new THREE.SphereGeometry(0.035, 12, 10);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const s = new THREE.Mesh(studGeo, mat(PALETTE.yellow, { roughness: 0.4 }));
      s.position.set((sx * (W + 0.2)) / 2, H + 0.11, -D / 2 + 0.06);
      root.add(s);
    }
  }

  // 玻璃：基本清透，只有轻微蓝调 + 一道斜向反光
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdff2ff,
    transparent: true,
    opacity: 0.07,
    roughness: 0.02,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(W, H), glassMat);
  frontGlass.position.set(0, H / 2, D / 2 + 0.03);
  root.add(frontGlass);

  // 玻璃反光：细长斜条（避免大块色斑）
  for (const [ox, w, o] of [[-W * 0.22, W * 0.1, 0.13], [-W * 0.06, W * 0.045, 0.09]]) {
    const shine = new THREE.Mesh(
      new THREE.PlaneGeometry(w, H * 1.9),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: o, depthWrite: false }),
    );
    shine.position.set(ox, H / 2, D / 2 + 0.035);
    shine.rotation.z = 0.42;
    root.add(shine);
  }

  // 顶部横轨（视觉）
  const railGeo = new THREE.BoxGeometry(W, 0.05, 0.06);
  for (const z of [-0.28, 0.28]) {
    const rail = new THREE.Mesh(railGeo, mat(PALETTE.metal, { metalness: 0.8, roughness: 0.3 }));
    rail.position.set(0, H - 0.06, z);
    root.add(rail);
  }

  // 取物口
  for (const sx of [-1, 1]) {
    const hole = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.06), mat(0x22283c, { roughness: 0.9 }));
    hole.position.set(sx * 0.5, -0.16, D / 2 + 0.2);
    root.add(hole);
  }

  scene.add(root);
  return root;
}

/** 环境光 + 主光 + 补光 */
export function buildLights(scene: THREE.Scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(1.6, 3, 2.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x7ecbff, 0.55);
  fill.position.set(-2, 1.2, 1.4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffd84d, 0.35);
  rim.position.set(0, 1.2, -2.5);
  scene.add(rim);
}

/** 背景：淡蓝图纸网格 */
export function buildBackdrop(scene: THREE.Scene) {
  const geo = new THREE.PlaneGeometry(24, 24);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#cfe7f7';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  const plane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }));
  plane.position.set(0, 1, -6);
  scene.add(plane);
}
