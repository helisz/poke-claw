#!/usr/bin/env node
// 重新生成宝可梦资产清单（manifest JSON + TS）。
// 素材来源：<SRC>/assets/pokemon（默认同级 poke-survivor 仓库）。
// 用法：node scripts/build-manifest.mjs [--src /path/to/pokemon-dir]
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argSrc = process.argv.indexOf('--src');
const srcDir =
  argSrc > -1
    ? resolve(process.argv[argSrc + 1])
    : resolve(root, '../poke-survivor/assets/pokemon');

if (!existsSync(srcDir)) {
  console.error(`找不到素材目录: ${srcDir}`);
  process.exit(1);
}

const pngSize = (file) => {
  const b = readFileSync(file).subarray(0, 33);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

// 名字表沿用手写文件；没有则留空
const nameFile = join(root, 'src/data/pokedex-names.json');
const names = existsSync(nameFile) ? JSON.parse(readFileSync(nameFile, 'utf8')) : {};

const files = readdirSync(srcDir).filter((f) => /^\d{3}\.png$/.test(f)).sort();
const entries = files.map((f) => {
  const id = parseInt(f, 10);
  const [w, h] = pngSize(join(srcDir, f));
  return { id, file: `assets/pokemon/${f}`, name: names[id] ?? '', type: names[`t${id}`] ?? '', w, h };
});

writeFileSync(
  join(root, 'public/assets/pokemon-manifest.json'),
  JSON.stringify({ meta: { count: entries.length }, pokemon: entries }, null, 1),
);

const ts = `// 自动生成，勿手改：node scripts/build-manifest.mjs
export type PokemonEntry = { id: number; file: string; name: string; type: string; w: number; h: number };

export const POKEMON_MANIFEST = ${JSON.stringify(entries, null, 2)} as const satisfies readonly PokemonEntry[];

export const POKEMON_BY_ID: Record<number, PokemonEntry> = Object.fromEntries(
  POKEMON_MANIFEST.map((p) => [p.id, p]),
);

export const ALL_IDS: number[] = POKEMON_MANIFEST.map((p) => p.id);

export function spritePath(id: number): string {
  return POKEMON_BY_ID[id]?.file ?? \`assets/pokemon/\${String(id).padStart(3, '0')}.png\`;
}
`;
writeFileSync(join(root, 'src/data/pokemon.ts'), ts);
console.log(`✓ ${entries.length} 只宝可梦 → src/data/pokemon.ts`);
