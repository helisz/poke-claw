export interface HudState {
  round: number;
  catchRate: number; // 0..1
  rare: boolean;
  collected: number;
  lastCatch: string | null;
  message: string;
}

export class Hud {
  private roundEl = document.getElementById('hud-round')!;
  private rateEl = document.getElementById('hud-rate')!;
  private rareEl = document.getElementById('hud-rare')!;
  private gotEl = document.getElementById('hud-got')!;
  private toastEl = document.getElementById('toast')!;
  private pips = document.querySelectorAll<HTMLElement>('.pip');
  private toastTimer = 0;

  render(s: HudState) {
    this.roundEl.textContent = String(s.round);
    this.rateEl.textContent = `${Math.round(s.catchRate * 100)}%`;
    this.rareEl.textContent = s.rare ? '稀有传说' : '普通';
    this.rareEl.classList.toggle('rare', s.rare);
    this.gotEl.textContent = String(s.collected);
    const lit = Math.round(s.catchRate * this.pips.length);
    this.pips.forEach((p, i) => p.classList.toggle('on', i < lit));
  }

  toast(text: string, ms = 1600) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }
}
