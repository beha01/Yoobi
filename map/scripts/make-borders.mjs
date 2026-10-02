// Генерирует src/borders.js: маску «всё, кроме Таджикистана» и точки замков соседей.
//
// Контур — из OpenStreetMap: data/tajikistan-mask.geojson, который собирает
// scripts/build-tiles.sh, упрощается до ~300 м (с эксклавами вроде Воруха). Без него —
// Natural Earth 1:50m: он грубее на 2–10 км и без эксклавов. Точную маску без
// упрощения можно подключить адресом: createStyle({ locked: 'https://…/tajikistan-mask.geojson' }).
//
//   node scripts/make-borders.mjs [data/tajikistan-mask.geojson]

import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const maskPath = process.argv[2] || join(root, 'data/tajikistan-mask.geojson');
const TOLERANCE = 0.003; // градусы, ~300 м

const round = (ring) => ring.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);
const area = (ring) => ring.reduce((s, [x1, y1], i) => {
  const [x2, y2] = ring[(i + 1) % ring.length];
  return s + (x1 * y2 - x2 * y1);
}, 0);
// Дыры закручены против внешнего кольца, острова — по нему (по знаку площади).
const world = [[40, 20], [110, 20], [110, 60], [40, 60], [40, 20]];
const orient = (ring, likeWorld) => ((Math.sign(area(ring)) === Math.sign(area(world))) === likeWorld
  ? ring : [...ring].reverse());

// Дуглас — Пекер.
function simplify(points, tol) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points.at(-1);
  let idx = 0;
  let dmax = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d > dmax) {
      idx = i;
      dmax = d;
    }
  }
  if (dmax <= tol) return [points[0], points.at(-1)];
  return [...simplify(points.slice(0, idx + 1), tol).slice(0, -1), ...simplify(points.slice(idx), tol)];
}

let source;
let holes;
let islands = [];
if (existsSync(maskPath)) {
  const { geometry } = JSON.parse(readFileSync(maskPath, 'utf8'));
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const clean = (ring) => round(simplify(ring, TOLERANCE));
  holes = polygons[0].slice(1).map(clean).filter((r) => r.length >= 4);
  islands = polygons.slice(1).map((p) => clean(p[0])).filter((r) => r.length >= 4);
  source = 'OpenStreetMap (© участники OpenStreetMap, ODbL): контур страны упрощён до ~300 м';
} else {
  const topo = require('world-atlas/countries-50m.json');
  const tj = feature(topo, topo.objects.countries).features.find((f) => f.id === '762');
  const polygons = tj.geometry.type === 'Polygon' ? [tj.geometry.coordinates] : tj.geometry.coordinates;
  holes = polygons.map((p) => round(p[0]));
  source = 'Natural Earth 1:50m';
}
const outer = [world, ...holes.map((r) => orient(r, false))];
const geometry = islands.length
  ? { type: 'MultiPolygon', coordinates: [outer, ...islands.map((r) => [orient(r, true)])] }
  : { type: 'Polygon', coordinates: outer };
const mask = { type: 'Feature', properties: {}, geometry };

const out = `// Сгенерировано scripts/make-borders.mjs по данным ${source} — не редактировать вручную.

// Всё, кроме Таджикистана: поверх этой области рисуется матовая «заморозка».
export const OUTSIDE_MASK = ${JSON.stringify(mask)};

// Соседи: точка для замка и подписи (внутри страны, в пределах границ карты).
export const NEIGHBORS = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { id: 'UZ', name_ru: 'Узбекистан', name_tg: 'Ӯзбекистон', name_en: 'Uzbekistan' }, geometry: { type: 'Point', coordinates: [66.9, 40.25] } },
    { type: 'Feature', properties: { id: 'KG', name_ru: 'Кыргызстан', name_tg: 'Қирғизистон', name_en: 'Kyrgyzstan' }, geometry: { type: 'Point', coordinates: [73.4, 41.15] } },
    { type: 'Feature', properties: { id: 'AF', name_ru: 'Афганистан', name_tg: 'Афғонистон', name_en: 'Afghanistan' }, geometry: { type: 'Point', coordinates: [69.4, 36.45] } },
    { type: 'Feature', properties: { id: 'CN', name_ru: 'Китай', name_tg: 'Чин', name_en: 'China' }, geometry: { type: 'Point', coordinates: [75.9, 38.3] } },
  ],
};
`;
await writeFile(join(root, 'src/borders.js'), out);
const vertices = holes.reduce((n, r) => n + r.length, 0) + islands.reduce((n, r) => n + r.length, 0);
console.log(`src/borders.js: ${(out.length / 1024).toFixed(1)} КБ, ${holes.length} дыр, ${islands.length} островов, ${vertices} точек (${source})`);
