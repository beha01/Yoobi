// Проверка: стили проходят официальный валидатор MapLibre, все картинки,
// на которые ссылается стиль, есть в спрайте, спрайт 1x и 2x согласованы.

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';

import { buildStyle, LANGUAGES } from '../src/style.js';
import { AIRPORT, CATEGORIES } from '../src/categories.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const fail = (msg) => { failed++; console.error(`✗ ${msg}`); };
const ok = (msg) => console.log(`✓ ${msg}`);

const sprite1 = JSON.parse(await readFile(join(root, 'sprites/yoobi.json'), 'utf8'));
const sprite2 = JSON.parse(await readFile(join(root, 'sprites/yoobi@2x.json'), 'utf8'));

// Все строковые литералы, похожие на id картинок, внутри выражения icon-image.
function imageIds(expr, out = new Set()) {
  if (typeof expr === 'string') out.add(expr);
  else if (Array.isArray(expr)) {
    if (expr[0] === 'get' || expr[0] === 'literal') return out;
    // В match/case условия стоят на нечётных местах — их не считаем картинками.
    if (expr[0] === 'match') {
      for (let i = 3; i < expr.length; i += 2) imageIds(expr[i], out);
      imageIds(expr[expr.length - 1], out);
    } else if (expr[0] === 'case') {
      for (let i = 2; i < expr.length; i += 2) imageIds(expr[i], out);
      imageIds(expr[expr.length - 1], out);
    } else expr.slice(1).forEach((e) => imageIds(e, out));
  }
  return out;
}

function checkStyle(style, label) {
  const errors = validateStyleMin(style);
  if (errors.length) errors.forEach((e) => fail(`${label}: ${e.message}`));
  else ok(`${label}: валиден (${style.layers.length} слоёв)`);

  const ids = new Set(style.layers.map((l) => l.id));
  if (ids.size !== style.layers.length) fail(`${label}: повторяются id слоёв`);

  for (const layer of style.layers) {
    const icon = layer.layout?.['icon-image'];
    if (!icon) continue;
    for (const id of imageIds(icon)) {
      if (!sprite1[id]) fail(`${label}: слой ${layer.id} ссылается на картинку «${id}», её нет в спрайте`);
    }
  }
}

const sprite = 'https://example.com/sprites/yoobi';
const variants = [
  {},
  { hillshade: false, buildings3d: false, poi: false },
  { terrain: 1.3, category: 'food' },
  { tiles: ['https://example.com/{z}/{x}/{y}.pbf'], dem: null },
];
for (const lang of LANGUAGES) {
  for (const v of variants) checkStyle(buildStyle({ sprite, lang, ...v }), `${lang} ${JSON.stringify(v)}`);
}
for (const c of [...CATEGORIES, AIRPORT]) checkStyle(buildStyle({ sprite, category: c.id }), `категория ${c.id}`);

// Собранные файлы в styles/.
for (const file of (await readdir(join(root, 'styles'))).filter((f) => f.endsWith('.json'))) {
  checkStyle(JSON.parse(await readFile(join(root, 'styles', file), 'utf8')), `styles/${file}`);
}

// Спрайт 2x должен быть ровно вдвое больше 1x.
for (const [id, a] of Object.entries(sprite1)) {
  const b = sprite2[id];
  if (!b || b.width !== a.width * 2 || b.height !== a.height * 2 || b.pixelRatio !== 2) {
    fail(`спрайт: картинка «${id}» в 2x не соответствует 1x`);
  }
}
ok(`спрайт: ${Object.keys(sprite1).length} картинок в 1x и 2x`);

if (failed) {
  console.error(`\nОшибок: ${failed}`);
  process.exit(1);
}
console.log('\nВсё в порядке');
