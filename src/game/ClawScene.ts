import Phaser from 'phaser';
import { CAB, CLAW, GAME, H, RARE_IDS, W } from '../config';
import { PokePit, type Poke, type PokeDef, type HullData } from './PokePit';
import { scaleOf } from './Size';
import { drawBackdrop, drawMachine } from './Machine';

type Phase = 'idle' | 'dropping' | 'closing' | 'rising';

const TEST_IDS = [1, 4, 25, 81, 95, 114, 129, 132, 143, 151];

export class ClawScene extends Phaser.Scene {
  private pit!: PokePit;
  private machine!: Phaser.GameObjects.Graphics;

  private railX = (CLAW.minX + CLAW.maxX) / 2;
  private railVX = 0;
  private theta = 0;
  private omega = 0;
  private drop = 0;
  private dropDir = 0;
  private open = 1;
  private targetOpen = 1;

  private phase: Phase = 'idle';
  private tries = GAME.tries;
  private caught = 0;

  private held: Poke | null = null;
  private heldOffset = 0;
  private willSlip = false;
  private slipAt = 0;
  private slipped = false;

  private grabLayer!: Phaser.GameObjects.Container;
  private clawLayer!: Phaser.GameObjects.Container;
  private leftKey = false;
  private rightKey = false;

  constructor() {
    super('claw');
  }

  preload() {
    this.load.json('hulls', './out/hulls.json');
    // 直接用硬编码路径加载，不依赖 manifest（manifest 在 create 里才拿到）
    for (const id of TEST_IDS) {
      this.load.image(`poke-${id}`, `./assets/pokemon/${String(id).padStart(3, '0')}.png`);
    }
  }

  private pokeDefs: PokeDef[] = [];

  create() {
    // 先画不依赖网络的东西，保证首帧就有画面
    const bg = this.add.graphics();
    drawBackdrop(bg);
    bg.setDepth(-10);

    this.machine = this.add.graphics();
    drawMachine(this.machine);
    this.machine.setDepth(0);

    this.grabLayer = this.add.container(0, 0).setDepth(10);
    this.clawLayer = this.add.container(0, 0).setDepth(20);

    this.pit = new PokePit(this);
    this.bindInput();
    this.refreshHud();

    // 网络数据异步加载，到了再补宝可梦
    void this.bootPokes();
  }

  private async bootPokes() {
    const manifest = await (await fetch('./assets/pokemon-manifest.json')).json();
    this.pokeDefs = manifest.pokemon;

    const hulls = this.cache.json.get('hulls') as Record<string, HullData>;
    const { innerX, innerY, innerW } = CAB;
    TEST_IDS.forEach((id, i) => {
      const def = this.pokeDefs.find((d) => d.id === id);
      const hull = hulls[id];
      if (!def || !hull) return;
      const x = innerX + ((i + 0.5) / TEST_IDS.length) * innerW + (Math.random() - 0.5) * 16;
      const y = innerY + 90 + Math.random() * 60;
      const p = this.pit.spawnOne(def, hull, x, y);
      this.grabLayer.add(p.sprite);
    });
  }

  private bindInput() {
    this.scene.scene.input.keyboard?.on('keydown-LEFT', () => (this.leftKey = true));
    this.scene.scene.input.keyboard?.on('keyup-LEFT', () => (this.leftKey = false));
    this.scene.scene.input.keyboard?.on('keydown-A', () => (this.leftKey = true));
    this.scene.scene.input.keyboard?.on('keyup-A', () => (this.leftKey = false));
    this.scene.scene.input.keyboard?.on('keydown-RIGHT', () => (this.rightKey = true));
    this.scene.scene.input.keyboard?.on('keyup-RIGHT', () => (this.rightKey = false));
    this.scene.scene.input.keyboard?.on('keydown-D', () => (this.rightKey = true));
    this.scene.scene.input.keyboard?.on('keyup-D', () => (this.rightKey = false));
    this.scene.scene.input.keyboard?.on('keydown-SPACE', () => this.onAction());
    this.scene.scene.input.keyboard?.on('keydown-DOWN', () => this.onAction());

    document.getElementById('action-btn')!.addEventListener('click', () => this.onAction());

    document.querySelectorAll<HTMLButtonElement>('.d').forEach((btn) => {
      const isLeft = btn.dataset.dir === 'left';
      const down = (e: Event) => {
        e.preventDefault();
        if (isLeft) this.leftKey = true;
        else this.rightKey = true;
      };
      const up = (e: Event) => {
        e.preventDefault();
        if (isLeft) this.leftKey = false;
        else this.rightKey = false;
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointerleave', up);
      btn.addEventListener('pointercancel', up);
    });
  }

  private get armLength() {
    return 46 + (CLAW.dropY - CLAW.restY) * this.drop;
  }
  private get tipX() {
    return this.railX + Math.sin(this.theta) * this.armLength;
  }
  private get tipY() {
    return CLAW.restY + Math.cos(this.theta) * this.armLength;
  }

  private onAction() {
    if (this.phase !== 'idle' || this.tries <= 0) return;
    this.tries -= 1;
    this.refreshHud();
    this.phase = 'dropping';
    this.targetOpen = 1;
    this.dropDir = 1;
    this.updateBtn();
  }

  private updateBtn() {
    const btn = document.getElementById('action-btn')!;
    const map: Record<Phase, string> = {
      idle: '下 爪',
      dropping: '下 爪…',
      closing: '收 爪',
      rising: '上升中…',
    };
    btn.textContent = map[this.phase];
    btn.toggleAttribute('disabled', this.phase !== 'idle' || this.tries <= 0);
  }

  private refreshHud() {
    document.getElementById('hud-tries')!.textContent = String(this.tries);
    document.getElementById('hud-caught')!.textContent = String(this.caught);
  }

  private toast(msg: string, ms = 1100) {
    const el = document.getElementById('toast')!;
    el.textContent = msg;
    el.classList.add('show');
    window.setTimeout(() => el.classList.remove('show'), ms);
  }

  update(_time: number, delta: number) {
    const dt = Math.min(0.033, delta / 1000);

    // ===== 摆锤爪子 =====
    const dir = this.phase === 'idle' ? (this.rightKey ? 1 : 0) - (this.leftKey ? 1 : 0) : 0;
    if (dir !== 0) {
      const target = dir * CLAW.moveSpeed;
      const accel = (target - this.railVX) / Math.max(dt, 0.001);
      this.railVX = target;
      this.railX = Phaser.Math.Clamp(this.railX + this.railVX * dt, CLAW.minX, CLAW.maxX);
      this.omega += (accel / (this.armLength * 18)) * CLAW.couple * dt;
    } else {
      const accel = -this.railVX / Math.max(dt, 0.001);
      this.railVX *= Math.max(0, 1 - dt * 12);
      this.omega += (accel / (this.armLength * 26)) * dt;
    }

    // 单摆积分
    this.omega += (-(CLAW.gravity / this.armLength) * Math.sin(this.theta)) * dt;
    this.omega *= Math.max(0, 1 - CLAW.damp * dt * 1.9);
    this.theta += this.omega * dt;
    if (this.theta > CLAW.maxTheta) {
      this.theta = CLAW.maxTheta;
      this.omega *= -0.35;
    } else if (this.theta < -CLAW.maxTheta) {
      this.theta = -CLAW.maxTheta;
      this.omega *= -0.35;
    }

    // 爪子开合
    if (Math.abs(this.targetOpen - this.open) > 0.002) {
      const s = Math.sign(this.targetOpen - this.open);
      this.open += s * Math.min(Math.abs(this.targetOpen - this.open), 4.2 * dt);
    }

    // ===== 垂直阶段机 =====
    if (this.phase === 'dropping') {
      this.drop = Math.min(1, this.drop + (CLAW.dropSpeed / 400) * dt * 1.6);
      if (this.drop >= 1) {
        this.phase = 'closing';
        this.targetOpen = 0;
        this.updateBtn();
      }
    } else if (this.phase === 'closing') {
      if (this.open <= 0.06) {
        this.tryGrab();
        this.phase = 'rising';
        this.dropDir = -1;
        this.updateBtn();
      }
    } else if (this.phase === 'rising') {
      this.drop = Math.max(0, this.drop - (CLAW.riseSpeed / 400) * dt * 1.6);
      if (this.held && this.willSlip && this.drop < this.slipAt) this.dropHeld();
      if (this.drop <= 0) this.finishRoll();
    }

    // 抓着的跟着爪尖
    if (this.held) {
      this.held.sprite.setPosition(this.tipX, this.tipY + this.heldOffset);
      this.held.sprite.setVelocity(0, 0);
      this.held.sprite.setAngularVelocity(0);
    }

    this.drawClaw();
  }

  private tryGrab() {
    const p = this.pit.pickAt(this.tipX, this.tipY + 14);
    if (!p) {
      this.held = null;
      this.willSlip = false;
      return;
    }
    this.held = p;
    this.slipped = false;
    this.heldOffset = 26 + p.radius * 0.5;
    // 越靠外越容易滑
    const mid = CAB.innerX + CAB.innerW / 2;
    const edge = Math.abs(p.sprite.x - mid) / (CAB.innerW / 2);
    this.willSlip = Math.random() < GAME.slipChance * (0.6 + edge * 0.9);
    this.slipAt = 0.25 + Math.random() * 0.5;
  }

  private dropHeld() {
    const p = this.held;
    if (!p) return;
    this.held = null;
    this.slipped = true;
    this.willSlip = false;
    this.targetOpen = 1;
    this.toast('滑了！掉回去了');
  }

  private finishRoll() {
    const got = this.held;
    this.held = null;
    this.targetOpen = 1;

    if (!got) {
      if (!this.slipped) this.toast('爪子空了…再试试');
      this.slipped = false;
      this.phase = 'idle';
      this.updateBtn();
      return;
    }

    this.pit.remove(got);
    this.caught += 1;
    this.refreshHud();
    this.toast('抓到一只！', 700);
    this.phase = 'idle';
    this.updateBtn();
    window.setTimeout(() => this.showCard(got.def), 320);
  }

  private showCard(def: PokeDef) {
    const rare = RARE_IDS.has(def.id);
    const overlay = document.getElementById('card-overlay')!;
    overlay.innerHTML = `
      <div class="card-wrap${rare ? ' rare' : ''}">
        <div class="card-no">No.${String(def.id).padStart(3, '0')}${rare ? ' · 稀有' : ''}</div>
        <div class="card-art"><img src="./${def.file}" alt="${def.name}" /></div>
        <div class="card-name">${def.name}</div>
        <div class="card-type">${def.type ?? ''}</div>
        <button class="card-btn">收下 · 继续</button>
      </div>`;
    overlay.classList.add('show');
    overlay.querySelector('.card-btn')!.addEventListener('click', () => {
      overlay.classList.remove('show');
      overlay.innerHTML = '';
    });
  }

  /** 画爪子：吊索 + 中心块 + 三指，跟着摆角转 */
  private drawClaw() {
    const g = this.clawLayer as unknown as Phaser.GameObjects.Graphics;
    let gra = this.clawGraphics;
    if (!gra) {
      gra = this.add.graphics();
      this.clawLayer.add(gra);
      this.clawGraphics = gra;
    }
    gra.clear();

    const hubX = this.tipX;
    const hubY = this.tipY;

    // 吊索
    gra.lineStyle(3, 0x4c4f55, 1);
    gra.beginPath();
    gra.moveTo(this.railX, CLAW.restY - 40);
    gra.lineTo(hubX, hubY);
    gra.strokePath();

    // 导轨滑块
    gra.fillStyle(0x6f7278, 1);
    gra.lineStyle(2.5, 0x2b2b2b, 1);
    gra.fillRoundedRect(this.railX - 13, CLAW.restY - 48, 26, 16, 5);
    gra.strokeRoundedRect(this.railX - 13, CLAW.restY - 48, 26, 16, 5);

    // 中心块（跟着摆角微转）
    gra.save();
    gra.translateCanvas(hubX, hubY);
    gra.rotateCanvas(this.theta * 0.55);
    gra.fillStyle(0x7d8087, 1);
    gra.fillRoundedRect(-15, -10, 30, 22, 6);
    gra.lineStyle(2.5, 0x2b2b2b, 1);
    gra.strokeRoundedRect(-15, -10, 30, 22, 6);

    // 三指
    const spread = 0.44 + this.open * 0.5;
    for (const side of [-1, 0, 1]) {
      const ang = side * spread;
      gra.save();
      gra.translateCanvas(0, 8);
      gra.rotateCanvas(ang);
      gra.fillStyle(0x5f636a, 1);
      gra.fillRoundedRect(-5, 0, 10, 30, 4);
      gra.lineStyle(2.5, 0x2b2b2b, 1);
      gra.strokeRoundedRect(-5, 0, 10, 30, 4);
      // 爪尖
      gra.save();
      gra.translateCanvas(0, 30);
      gra.rotateCanvas(-ang * 1.9);
      gra.fillStyle(0x4c4f55, 1);
      gra.fillRoundedRect(-4.5, 0, 9, 13, 3.5);
      gra.strokeRoundedRect(-4.5, 0, 9, 13, 3.5);
      gra.restore();
      gra.restore();
    }
    gra.restore();
  }

  private clawGraphics?: Phaser.GameObjects.Graphics;
}
