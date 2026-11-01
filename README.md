# poke-claw

宝可梦题材新游戏项目。**当前阶段：仅准备资产**，玩法待设计。

## 资产

| 项 | 说明 |
| --- | --- |
| 图片 | `public/assets/pokemon/` — 166 张 PNG，64×64，透明背景 |
| 覆盖 | 初代 151 全数 + 初代外 15 只（248 班基拉斯 / 448 路卡利欧 / 466 电击魔兽 / 475 艾路雷朵 等） |
| 尺寸 | 合计约 264 KB，可全部一次性预载 |
| 来源 | 复用自 [poke-survivor](https://github.com/helisz/poke-survivor) `public/assets/pokemon` |
| 预览 | `npm run dev` → http://localhost:5173/catalog.html |

## 数据接口

- `src/data/pokemon.ts` — 类型化清单（自动生成，勿手改）
  ```ts
  import { POKEMON_MANIFEST, POKEMON_BY_ID, ALL_IDS, spritePath } from './data/pokemon';
  spritePath(25); // 'assets/pokemon/025.png'
  ```
- `public/assets/pokemon-manifest.json` — 同内容 JSON，任意运行时/语言可用
- `src/data/pokedex-names.json` — id → 中文名；`t<id>` → 属性

重新生成（素材更新后）：
```bash
node scripts/build-manifest.mjs --src ../poke-survivor/assets/pokemon
```

## 命名约定

文件名即图鉴编号：`001.png` … `151.png`，另有 `248 282 445 448 466 475` 等初代外编号。
**换素材时不要改文件名**，下游全部按编号索引。

## 开发

```bash
npm install
npm run dev      # vite
npm run build
```

技术栈预置 Vite + TypeScript，未加游戏框架 —— 等玩法定下来再选（Phaser / 手写 canvas / PixiJS 都可）。
