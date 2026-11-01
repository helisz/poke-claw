import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CAB, CLAW, withinGrabReach } from './config';
import { Claw } from './Claw';
import { DollView } from './Dolls';
import { buildBackdrop, buildLights, buildMachine } from './Machine';
import { Hud, type HudState } from './Hud';
import { clampAxis, type Doll, type DollDef } from './types';

type Phase = 'move' | 'drop' | 'closing' | 'rising';

const HUD_RARE_IDS = new Set([144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 384, 483, 484]);

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private world!: RAPIER.World;
  private claw: Claw;
  private dollView!: DollView;
  private hud = new Hud();

  private phase: Phase = 'move';
  private grabbed: Doll | null = null;
  private round = 1;
  private collected = 0;
  private rare = false;
  private keys = new Set<string>();
  private grabOffset = new THREE.Vector3();
  private lastTime = 0;

  constructor(private mount: HTMLElement) {
    const w = mount.clientWidth || 520;
    const h = mount.clientHeight || 700;
    const aspect = w / h;
    const halfH = 1.15;
    this.camera = new THREE.OrthographicCamera(-halfH * aspect, halfH * aspect, halfH, -halfH, 0.1, 60);
    this.camera.position.set(0, 2.5, 3.0);
    this.camera.lookAt(0, 0.5, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0xcfe7f7);
    buildBackdrop(this.scene);
    buildLights(this.scene);
    buildMachine(this.scene);
    this.claw = new Claw(this.scene);

    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    void this.boot();
  }

  private async boot() {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -9.82, z: 0 });
    this.buildWalls();
    this.dollView = new DollView(this.scene, this.world);

    const manifest = await (await fetch('./assets/pokemon-manifest.json')).json();
    const all: DollDef[] = manifest.pokemon.map((p: any) => ({ id: p.id, name: p.name, file: p.file }));
    const rarePool = all.filter((p) => HUD_RARE_IDS.has(p.id));
    const commonPool = all.filter((p) => !HUD_RARE_IDS.has(p.id));
    const pick = <T,>(arr: T[], n: number) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
    const lineup: DollDef[] = [...pick(commonPool, 12), ...pick(rarePool.length ? rarePool : all, 2)];
    lineup.sort(() => Math.random() - 0.5);

    await this.dollView.preload(lineup.map((d) => d.file));

    const spots = DollView.chunk(lineup);
    lineup.forEach((def, i) => this.dollView.spawn(def, spots[i]));

    this.rare = lineup.some((d) => HUD_RARE_IDS.has(d.id));
    this.refreshHud('移动爪子上方，按 空格 或「停止钩爪」下爪');
    document.body.classList.add('ready');
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  private buildWalls() {
    const W = CAB.width / 2;
    const D = CAB.depth / 2;
    const H = CAB.ceilY;
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const add = (hx: number, hy: number, hz: number, x: number, y: number, z: number) => {
      const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setFriction(0.85)
        .setRestitution(0.02)
        .setTranslation(x, y, z);
      this.world.createCollider(desc, body);
    };
    add(W, 0.02, D, 0, -0.16, 0); // 舱底（低于取物口，掉出去即判入袋）
    add(0.02, H, D, -W, H / 2, 0);
    add(0.02, H, D, W, H / 2, 0);
    add(W, H, 0.02, 0, H / 2, -D);
    add(W, 0.2, 0.02, 0, -0.06, D); // 前挡板
    add(W, 0.02, D, 0, CAB.ceilY + 0.1, 0); // 天花板
  }

  private bindInput() {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.onAction();
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e: KeyboardEvent) => this.keys.delete(e.code));

    document.getElementById('action-btn')!.addEventListener('click', () => this.onAction());
    document.getElementById('reset-btn')?.addEventListener('click', () => location.reload());

    document.querySelectorAll<HTMLButtonElement>('.d').forEach((btn) => {
      const code = btn.dataset.key!;
      const down = (ev: Event) => {
        ev.preventDefault();
        this.keys.add(code);
      };
      const up = (ev: Event) => {
        ev.preventDefault();
        this.keys.delete(code);
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointerleave', up);
      btn.addEventListener('pointercancel', up);
    });

    const dom = this.renderer.domElement;
    let dragging = false;
    const toPlane = (cx: number, cy: number) => {
      const r = dom.getBoundingClientRect();
      const nx = ((cx - r.left) / r.width) * 2 - 1;
      const ny = -(((cy - r.top) / r.height) * 2 - 1);
      const v = new THREE.Vector3(nx, ny, 0).unproject(this.camera);
      const dir = v.sub(this.camera.position).normalize();
      const t = (0.05 - this.camera.position.y) / dir.y;
      return new THREE.Vector3(this.camera.position.x + dir.x * t, 0, this.camera.position.z + dir.z * t);
    };
    dom.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.phase !== 'move') return;
      dragging = true;
      const w = toPlane(e.clientX, e.clientY);
      this.claw.setPosition(clampAxis(w.x, 'x'), CLAW.restY, clampAxis(w.z, 'z'));
    });
    dom.addEventListener('pointermove', (e: PointerEvent) => {
      if (!dragging || this.phase !== 'move') return;
      const w = toPlane(e.clientX, e.clientY);
      this.claw.setPosition(clampAxis(w.x, 'x'), CLAW.restY, clampAxis(w.z, 'z'));
    });
    window.addEventListener('pointerup', () => (dragging = false));
  }

  private onAction() {
    if (this.phase !== 'move') return;
    this.phase = 'drop';
    this.claw.setOpen(1);
    this.updateActionLabel();
  }

  private updateActionLabel() {
    const btn = document.getElementById('action-btn')!;
    btn.textContent = this.phase === 'move' ? '停止钩爪' : this.phase === 'rising' ? '上升中…' : '抓取中…';
  }

  private keyMove(dt: number) {
    const p = this.claw.position;
    let dx = 0;
    let dz = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dz += 1;
    if (!dx && !dz) return;
    const len = Math.hypot(dx, dz) || 1;
    this.claw.setPosition(
      clampAxis(p.x + (dx / len) * CLAW.speed * dt, 'x'),
      p.y,
      clampAxis(p.z + (dz / len) * CLAW.speed * dt, 'z'),
    );
  }

  private tryGrab(): Doll | null {
    const c = this.claw.position;
    let best: Doll | null = null;
    let bestScore = Infinity;
    for (const d of this.dollView.dolls) {
      const t = d.body.translation();
      if (!withinGrabReach({ x: c.x, y: c.y, z: c.z }, t)) continue;
      const planar = Math.hypot(c.x - t.x, c.z - t.z);
      const score = planar + Math.abs(t.y - (c.y - 0.1)) * 0.4;
      if (score < bestScore) {
        bestScore = score;
        best = d;
      }
    }
    return best;
  }

  private stepClaw(dt: number) {
    const p = this.claw.position;

    if (this.phase === 'move') {
      this.keyMove(dt);
      return;
    }

    if (this.phase === 'drop') {
      p.y = Math.max(CLAW.minY, p.y - CLAW.dropSpeed * dt);
      this.claw.setPosition(p.x, p.y, p.z);
      if (p.y <= CLAW.minY) {
        this.phase = 'closing';
        this.claw.setOpen(0);
      }
      return;
    }

    if (this.phase === 'closing') {
      p.y = Math.max(-0.04, p.y - 0.22 * dt); // 闭合时下压，卡住娃娃
      this.claw.setPosition(p.x, p.y, p.z);
      if (this.claw.open < 0.08) {
        this.grabbed = this.tryGrab();
        if (this.grabbed) {
          const t = this.grabbed.body.translation();
          this.grabOffset.set(t.x - p.x, t.y - p.y, t.z - p.z);
          this.grabbed.body.setGravityScale(0, true);
          this.grabbed.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          this.grabbed.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
        this.phase = 'rising';
        this.updateActionLabel();
      }
      return;
    }

    // rising
    p.y = Math.min(CLAW.restY, p.y + CLAW.riseSpeed * dt);
    this.claw.setPosition(p.x, p.y, p.z);
    if (this.grabbed) {
      const t = this.grabbed.body.translation();
      const tx = p.x + this.grabOffset.x;
      const ty = p.y + Math.min(this.grabOffset.y, -0.07);
      const tz = p.z + this.grabOffset.z;
      this.grabbed.body.setTranslation(
        { x: t.x + (tx - t.x) * 0.35, y: t.y + (ty - t.y) * 0.5, z: t.z + (tz - t.z) * 0.35 },
        true,
      );
    }
    if (p.y >= CLAW.restY) this.finishDrop();
  }

  private finishDrop() {
    const got = this.grabbed;
    this.grabbed = null;
    if (got) {
      got.body.setGravityScale(1, true);
      got.body.applyImpulse({ x: 0, y: -0.03, z: 0.05 }, true);
    }
    this.phase = 'move';
    this.claw.setOpen(1);
    this.round += 1;
    this.refreshHud(got ? `抓到了 ${got.name}！` : '爪子空了…再试试');
    this.updateActionLabel();
  }

  private refreshHud(msg: string) {
    const total = this.dollView ? this.dollView.dolls.length : 0;
    const state: HudState = {
      round: this.round,
      catchRate: Math.min(0.95, 0.3 + total * 0.045),
      rare: this.rare,
      collected: this.collected,
      lastCatch: null,
      message: msg,
    };
    this.hud.render(state);
    this.hud.toast(msg);
  }

  private resize() {
    const w = this.mount.clientWidth;
    const h = this.mount.clientHeight;
    const aspect = w / h;
    const halfH = 1.15;
    this.camera.left = -halfH * aspect;
    this.camera.right = halfH * aspect;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.claw.update(dt);
    this.stepClaw(dt);
    this.world.timestep = dt;
    this.world.step();
    this.dollView.sync(null, null);

    const fallen = this.dollView.collectFallen();
    if (fallen.length) {
      this.collected += fallen.length;
      this.refreshHud(`入袋：${fallen.map((d) => d.name).join('、')}`);
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  };

  static start() {
    new Game(document.getElementById('stage')!);
  }
}
