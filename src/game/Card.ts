import type { PokeDef } from './types';

const RARE_IDS = new Set([144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 384, 483, 484]);

export function isRare(id: number): boolean {
  return RARE_IDS.has(id);
}

/** 抓到后的卡片：宝可梦图 + 名字 + 编号 + 稀有标记 */
export function showCard(def: PokeDef, opts: { collect: (d: PokeDef) => void; next: () => void }) {
  const host = document.getElementById('card-overlay')!;
  const rare = isRare(def.id);
  host.innerHTML = `
    <div class="card-wrap ${rare ? 'rare' : ''}">
      <div class="card-shine"></div>
      <div class="card-head">
        <span class="card-no">No.${String(def.id).padStart(3, '0')}</span>
        ${rare ? '<span class="card-rare">稀有传说</span>' : ''}
      </div>
      <div class="card-art"><img src="${def.file}" alt="${def.name}" /></div>
      <div class="card-name">${def.name}</div>
      <div class="card-type">${def.type ? `<i>${def.type}</i>` : ''}</div>
      <button class="card-btn" id="card-next">收下 · 继续</button>
    </div>`;
  host.classList.add('show');
  const close = () => {
    host.classList.remove('show');
    host.innerHTML = '';
  };
  host.querySelector<HTMLButtonElement>('#card-next')!.addEventListener('click', () => {
    opts.collect(def);
    close();
    opts.next();
  });
}
