/**
 * 从精灵图 alpha 通道提取凸包碰撞轮廓。
 * 输出：out/hulls.json  { [id]: { hull: [[x,y]...], w, h, bbox } }
 * 坐标归一化到精灵图宽高的 0..1 区间（相对图片左上角）。
 *
 * 用法：node scripts/build-hulls.mjs [--only 1,4,7,25,52,94,143,151]
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'public/assets/pokemon');
const OUT = path.join(ROOT, 'out');

// 测试用的 10 只：体型差异最大化
const DEFAULT_IDS = [
  1,   // 妙蛙种子 - 圆胖
  4,   // 小火龙 - 中等带尾巴
  25,  // 皮卡丘 - 中等带耳朵尾巴
  95,  // 大岩蛇 - 细长条
  129, // 鲤鱼王 - 扁长鱼
  143, // 卡比兽 - 超大胖子
  132, // 百变怪 - 液体状
  81,  // 小磁怪 - 三个球分离
  114, // 蔓藤怪 - 触手状
  151, // 梦幻 - 细长带长尾
];

const args = process.argv.slice(2);
const onlyArg = args.indexOf('--only');
const ids = onlyArg >= 0 ? args[onlyArg + 1].split(',').map(Number) : DEFAULT_IDS;

/** alpha 阈值：忽略半透明抗锯齿边缘 */
const ALPHA_MIN = 100;

/** 读取 PNG → 二值掩码 */
function loadMask(file) {
  const buf = fs.readFileSync(file);
  const png = PNG.sync.read(buf);
  const { width: w, height: h, data } = png;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    mask[i] = data[i * 4 + 3] >= ALPHA_MIN ? 1 : 0;
  }
  return { w, h, mask };
}

/** 收集所有不透明像素点 */
function collectPoints({ w, h, mask }, step = 1) {
  const pts = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (mask[y * w + x]) pts.push([x, y]);
    }
  }
  return pts;
}

/** Andrew monotone chain 凸包，返回逆时针顶点 */
function convexHull(points) {
  if (points.length < 3) return points;
  const pts = [...points].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Ramer–Douglas–Peucker 简化 */
function rdp(points, eps) {
  if (points.length < 3) return points;

  const perpDist = (p, a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
  };

  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], points[0], points[points.length - 1]);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > eps) {
    const left = rdp(points.slice(0, idx + 1), eps);
    const right = rdp(points.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

/** 简化到最多 maxVerts 个顶点，自动收紧阈值 */
function simplifyTo(hull, maxVerts = 10) {
  if (hull.length <= maxVerts) return hull;
  // 闭合多边形：首尾相接后做 rdp
  const closed = [...hull, hull[0]];
  let eps = 0.5;
  let out = hull;
  for (let i = 0; i < 40; i++) {
    out = rdp(closed, eps).slice(0, -1);
    if (out.length <= maxVerts) break;
    eps *= 1.25;
  }
  return out;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'public/assets/pokemon-manifest.json'), 'utf8'),
  );
  const byId = new Map(manifest.pokemon.map((p) => [p.id, p]));

  const result = {};
  for (const id of ids) {
    const def = byId.get(id);
    if (!def) {
      console.warn(`skip ${id}: not in manifest`);
      continue;
    }
    const file = path.join(ROOT, 'public', def.file);
    if (!fs.existsSync(file)) {
      console.warn(`skip ${id}: missing ${file}`);
      continue;
    }

    const img = loadMask(file);
    const pts = collectPoints(img, 1);
    if (pts.length < 10) {
      console.warn(`skip ${id}: almost empty`);
      continue;
    }

    const hullRaw = convexHull(pts);
    const hull = simplifyTo(hullRaw, 10);

    // 包围盒（不透明像素范围）
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const areaRatio = pts.length / (img.w * img.h);

    result[id] = {
      name: def.name,
      file: def.file,
      w: img.w,
      h: img.h,
      bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
      areaRatio: Number(areaRatio.toFixed(3)),
      hullVerts: hull.length,
      // 归一化到 0..1（相对图片宽高）
      hull: hull.map(([x, y]) => [
        Number((x / img.w).toFixed(4)),
        Number((y / img.h).toFixed(4)),
      ]),
    };
    console.log(
      `${id} ${def.name}: hull ${hull.length} 顶点, 占图比 ${(areaRatio * 100).toFixed(1)}%`,
    );
  }

  const outFile = path.join(OUT, 'hulls.json');
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`\n写出 ${outFile}（${Object.keys(result).length} 只）`);
}

main();
