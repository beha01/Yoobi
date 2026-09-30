// Генерирует src/borders.js: маску «всё, кроме Таджикистана» и точки замков соседей.
// Контур — Natural Earth 1:50m (общественное достояние). Для точной маски по данным OSM
// scripts/build-tiles.sh собирает data/tajikistan-mask.geojson из выгрузки.
//
//   node scripts/make-borders.mjs

import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const topo = require('world-atlas/countries-50m.json');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const tj = feature(topo, topo.objects.countries).features.find((f) => f.id === '762');
const round = (ring) => ring.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);
const polygons = tj.geometry.type === 'Polygon' ? [tj.geometry.coordinates] : tj.geometry.coordinates;

// Внешний прямоугольник с «дырами» на месте Таджикистана.
const world = [[40, 20], [110, 20], [110, 60], [40, 60], [40, 20]];
// Дыры должны быть закручены против внешнего кольца (по знаку площади).
const area = (ring) => ring.reduce((s, [x1, y1], i) => {
  const [x2, y2] = ring[(i + 1) % ring.length];
  return s + (x1 * y2 - x2 * y1);
}, 0);
const hole = (ring) => (Math.sign(area(ring)) === Math.sign(area(world)) ? [...ring].reverse() : ring);
const mask = {
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [world, ...polygons.map((p) => hole(round(p[0])))] },
};

const out = `// Сгенерировано scripts/make-borders.mjs из Natural Earth 1:50m — не редактировать вручную.

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
console.log('src/borders.js', (out.length / 1024).toFixed(1), 'КБ');
