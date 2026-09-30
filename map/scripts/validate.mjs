// Проверка: стили проходят официальный валидатор MapLibre, все картинки,
// на которые ссылается стиль, есть в спрайте своей темы, спрайты 1x и 2x согласованы.

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';

import { buildStyle, LANGUAGES, THEMES, COLORS, NIGHT_COLORS } from '../src/style.js';
import { AIRPORT, CATEGORIES } from '../src/categories.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const fail = (msg) => { failed++; console.error(`✗ ${msg}`); };
const ok = (msg) => console.log(`✓ ${msg}`);

const readSprite = async (name) => JSON.parse(await readFile(join(root, 'sprites', `${name}.json`), 'utf8'));
const SPRITES = {};
for (const theme of THEMES) {
  const name = theme === 'light' ? 'yoobi' : `yoobi-${theme}`;
  SPRITES[theme] = { name, x1: await readSprite(name), x2: await readSprite(`${name}@2x`) };
}
// Тема стиля — по адресу спрайта (…/yoobi-dark у ночной).
const themeOf = (style) => THEMES.find((t) => t !== 'light' && style.sprite?.endsWith(`-${t}`)) || 'light';

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

  const { name, x1 } = SPRITES[themeOf(style)];
  for (const layer of style.layers) {
    for (const key of ['icon-image', 'fill-pattern']) {
      const icon = layer.layout?.[key] ?? layer.paint?.[key];
      if (!icon) continue;
      for (const id of imageIds(icon)) {
        if (!x1[id]) fail(`${label}: слой ${layer.id} ссылается на картинку «${id}», её нет в спрайте ${name}`);
      }
    }
  }
}

const sprite = 'https://example.com/sprites/yoobi';
const variants = [
  {},
  { hillshade: false, buildings3d: false, poi: false, trees: false },
  { terrain: 1.3, category: 'food' },
  { tiles: ['https://example.com/{z}/{x}/{y}.pbf'], dem: null },
  { extraTiles: 'pmtiles://https://example.com/extra.pmtiles' },
  { extraTiles: 'https://example.com/extra.json', trees: false, category: 'gov' },
  { extraTiles: 'pmtiles://https://example.com/extra.pmtiles', clipped: false, locked: 'https://example.com/mask.geojson' },
  { clipped: true },
  { locked: false },
];
for (const lang of LANGUAGES) {
  for (const v of variants) checkStyle(buildStyle({ sprite, lang, ...v }), `${lang} ${JSON.stringify(v)}`);
}
for (const v of variants) checkStyle(buildStyle({ sprite, theme: 'dark', ...v }), `ночь ${JSON.stringify(v)}`);

// Ночная палитра задаёт все цвета дневной и ничего лишнего.
const missing = Object.keys(COLORS).filter((k) => !(k in NIGHT_COLORS));
const extra = Object.keys(NIGHT_COLORS).filter((k) => !(k in COLORS));
if (missing.length || extra.length) fail(`ночная палитра: нет ${missing.join(', ') || '—'}, лишние ${extra.join(', ') || '—'}`);
else ok(`ночная палитра: ${Object.keys(NIGHT_COLORS).length} цветов, как в дневной`);
const dark = buildStyle({ sprite, theme: 'dark', extraTiles: 'pmtiles://x' });
const light = buildStyle({ sprite, extraTiles: 'pmtiles://x' });
if (JSON.stringify(dark.layers.map((l) => l.id)) !== JSON.stringify(light.layers.map((l) => l.id))) {
  fail('ночная тема: другой набор или порядок слоёв, чем у дневной');
} else ok(`ночная тема: те же ${dark.layers.length} слоёв, спрайт ${dark.sprite.split('/').pop()}`);
for (const c of [...CATEGORIES, AIRPORT]) checkStyle(buildStyle({ sprite, category: c.id }), `категория ${c.id}`);

// «Заморозка» соседей: с тайлами из build-tiles.sh (без подписей соседних стран) — под
// подписями, чтобы они не обрезались у границы; с чужими тайлами — поверх подписей.
for (const [opts, onTop] of [[{}, true], [{ extraTiles: 'pmtiles://x' }, false], [{ clipped: true }, false],
  [{ extraTiles: 'pmtiles://x', clipped: false }, true]]) {
  const ids = buildStyle({ sprite, ...opts }).layers.map((l) => l.id);
  const top = ids.indexOf('outside-frost') > ids.indexOf('place-city');
  if (top !== onTop) fail(`«заморозка» ${onTop ? 'должна закрывать' : 'не должна закрывать'} подписи: ${JSON.stringify(opts)}`);
  else ok(`«заморозка» ${onTop ? 'поверх подписей' : 'под подписями'}: ${JSON.stringify(opts)}`);
}

// Собранные файлы в styles/.
for (const file of (await readdir(join(root, 'styles'))).filter((f) => f.endsWith('.json'))) {
  checkStyle(JSON.parse(await readFile(join(root, 'styles', file), 'utf8')), `styles/${file}`);
}

// Спрайт 2x должен быть ровно вдвое больше 1x; у тем одинаковый набор картинок.
for (const { name, x1, x2 } of Object.values(SPRITES)) {
  for (const [id, a] of Object.entries(x1)) {
    const b = x2[id];
    if (!b || b.width !== a.width * 2 || b.height !== a.height * 2 || b.pixelRatio !== 2) {
      fail(`спрайт ${name}: картинка «${id}» в 2x не соответствует 1x`);
    }
  }
  const same = JSON.stringify(Object.keys(x1).sort()) === JSON.stringify(Object.keys(SPRITES.light.x1).sort());
  if (!same) fail(`спрайт ${name}: набор картинок отличается от дневного`);
  else ok(`спрайт ${name}: ${Object.keys(x1).length} картинок в 1x и 2x`);
}

if (failed) {
  console.error(`\nОшибок: ${failed}`);
  process.exit(1);
}
console.log('\nВсё в порядке');
