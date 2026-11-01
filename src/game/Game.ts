import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { BALL, CAB, CLAW, withinGrabReach } from './config';
import { Claw } from './Claw';
import { BallView } from './Balls';
import { buildBackdrop, buildLights, buildMachine } from './Machine';
import { Hud } from './Hud';
import { showCard } from './Card';
import { isRare } from './Card';
import { clampAxis, type Ball, type PokeDef } from './types';

type Phase = 'move' | 'drop' | 'closing' | 'rising' | 'reveal';

const BALL_COUNT = 12;

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private world!: RAPIER.World;
  private claw: Claw;
  private ballView!: BallView;
  private hud = new Hud();

  private phase: Phase = 'move';
  private grabbed: Ball | null = null;
  private round = 1;
  private collected = 0;
  private keys = new Set<string>();
  private grabOffset = new THREE.Vector3();
  private lastTime = 0;
  private lastPool: PokeDef[] | null = null;

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
    this.ballView = new BallView(this.scene, this.world);

    const manifest = await (await fetch('./assets/pokemon-manifest.json')).json();
    const all: PokeDef[] = manifest.pokemon.map((p: any) => ({ id: p.id, name: p.name, file: p.file, type: p.type }));
    this.lastPool = all;
    this.spawnRound(all);

    this.refreshHud();
    document.body.classList.add('ready');
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  /** 摆一批球：球里装着的宝可梦由 manifesto 随机抽，抓之前看不见 */
  private spawnRound(all: PokeDef[]) {
    const pool = [...all].sort(() => Math.random() - 0.5).slice(0, BALL_COUNT);
    const spots = BallView.layout(pool.length);
    pool.forEach((def, i) => this.ballView.spawn(def, spots[i]));
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
    add(W, 0.02, D, 0, -0.16, 0); // 舱底
    add(0.02, H, D, -W, H / 2, 0);
    add(0.02, H, D, W, H / 2, 0);
    add(W, H, 0.02, 0, H / 2, -D);
    add(W, 0.2, 0.02, 0, -0.06, D);
    add(W, 0.02, D, 0, CAB.ceilY + 0.1, 0);
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
    const map: Record<Phase, string> = {
      move: '停止钩爪',
      drop: '抓取中…',
      closing: '抓取中…',
      rising: '上升中…',
      reveal: '收下…',
    };
    btn.textContent = map[this.phase];
    btn.toggleAttribute('disabled', this.phase === 'reveal');
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

  /** 找出爪心罩得住、且离爪心最近的球 */
  private tryGrab(): Ball | null {
    const c = this.claw.position;
    let best: Ball | null = null;
    let bestD = Infinity;
    for (const b of this.ballView.balls) {
      const t = b.body.translation();
      if (!withinGrabReach({ x: c.x, z: c.z }, t)) continue;
      const d = Math.hypot(c.x - t.x, c.z - t.z);
      if (d < bestD) {
        bestD = d;
        best = b;
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
      p.y = Math.max(-0.05, p.y - 0.2 * dt);
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

    if (this.phase === 'rising') {
      p.y = Math.min(CLAW.restY, p.y + CLAW.riseSpeed * dt);
      this.claw.setPosition(p.x, p.y, p.z);
      if (this.grabbed) {
        const t = this.grabbed.body.translation();
        const tx = p.x + this.grabOffset.x;
        const ty = p.y + Math.min(this.grabOffset.y, -0.08);
        const tz = p.z + this.grabOffset.z;
        this.grabbed.body.setTranslation(
          { x: t.x + (tx - t.x) * 0.4, y: t.y + (ty - t.y) * 0.5, z: t.z + (tz - t.z) * 0.4 },
          true,
        );
      }
      if (p.y >= CLAW.restY) this.finishDrop();
    }
  }

  /** 抓起来=得手：球消失，弹出卡片 */
  private finishDrop() {
    const got = this.grabbed;
    this.grabbed = null;
    this.phase = 'move';
    this.claw.setOpen(1);

    if (!got) {
      this.updateActionLabel();
      this.hud.toast('爪子空了…再试试');
      return;
    }

    // 球飞向取物口后消失
    const t = got.body.translation();
    got.body.setTranslation({ x: t.x, y: -0.5, z: t.z }, true);
    this.removeBall(got);

    this.phase = 'reveal';
    this.updateActionLabel();
    this.hud.toast(`抓到一颗球！`, 900);
    setTimeout(() => {
      this.phase = 'reveal';
      showCard(got.def, {
        collect: () => {
          this.collected += 1;
          this.refreshHud();
        },
        next: () => this.afterReveal(),
      });
    }, 420);
  }

  private removeBall(target: Ball) {
    const idx = this.ballView.balls.indexOf(target);
    if (idx >= 0) this.ballView.balls.splice(idx, 1);
    this.scene.remove(target.mesh);
    this.world.removeRigidBody(target.body);
  }

  private afterReveal() {
    this.round += 1;
    this.phase = 'move';
    this.updateActionLabel();
    if (this.ballView.balls.length < 4) {
      this.spawnRound(this.lastPool ?? []);
      this.hud.toast('补充新一批精灵球', 1200);
    }
    this.refreshHud();
  }

  private refreshHud() {
    const total = this.ballView ? this.ballView.balls.length : 0;
    this.hud.render({
      round: this.round,
      catchRate: Math.min(0.95, 0.25 + total * 0.05),
      rare: this.ballView ? this.ballView.balls.some((b) => isRare(b.def.id)) : false,
      collected: this.collected,
    });
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
    this.ballView.sync();

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  };

  static start() {
    new Game(document.getElementById('stage')!);
  }
}
