// Сборка: спрайты (PNG 1x/2x + JSON) и готовые style.json на всех языках.
//
//   npm run build                                   # для локальной демо-страницы
//   npm run build -- --base-url=https://cdn.example.com/map/
//   npm run build -- --base-url=https://cdn.example.com/map/ \
//                    --tiles=pmtiles://https://cdn.example.com/map/tajikistan.pmtiles \
//                    --glyphs=https://cdn.example.com/map/fonts/{fontstack}/{range}.pbf
//
//   npm run build -- --base-url=… --extra-tiles=pmtiles://https://cdn.example.com/map/tajikistan-extra.pmtiles
//
// Флаги: --no-hillshade, --no-3d, --no-poi, --no-trees, --no-dem, --terrain=1.3

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

import { buildStyle, LANGUAGES, DEFAULTS } from '../src/style.js';
import { spriteImages, layoutSprite, sheetSvg, spriteIndex } from './sprite.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {};
  for (const a of argv) {
    const m = a.match(/^--(no-)?([\w-]+)(?:=(.*))?$/);
    if (!m) throw new Error(`Непонятный аргумент: ${a}`);
    args[m[2]] = m[1] ? false : m[3] ?? true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
let baseUrl = args['base-url'] || 'http://localhost:8080/';
if (!baseUrl.endsWith('/')) baseUrl += '/';
new URL(baseUrl); // проверка, что адрес абсолютный

// ——— Спрайты ———
const layout = layoutSprite(spriteImages());
const svg = sheetSvg(layout);
await mkdir(join(root, 'sprites'), { recursive: true });
for (const pr of [1, 2]) {
  const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: pr }, font: { loadSystemFonts: false } })
    .render()
    .asPng();
  const suffix = pr === 1 ? '' : `@${pr}x`;
  await writeFile(join(root, 'sprites', `yoobi${suffix}.png`), png);
  await writeFile(join(root, 'sprites', `yoobi${suffix}.json`), `${JSON.stringify(spriteIndex(layout, pr), null, 1)}\n`);
}
console.log(`Спрайт: ${Object.keys(layout.placed).length} картинок, ${layout.width}×${layout.height}`);

// ——— Стили ———
const options = {
  sprite: `${baseUrl}sprites/yoobi`,
  tiles: args.tiles || DEFAULTS.tiles,
  extraTiles: args['extra-tiles'] || null,
  glyphs: args.glyphs || DEFAULTS.glyphs,
  dem: args.dem === false ? null : args.dem || DEFAULTS.dem,
  hillshade: args.hillshade !== false,
  buildings3d: args['3d'] !== false,
  poi: args.poi !== false,
  trees: args.trees !== false,
  terrain: args.terrain ? Number(args.terrain) : false,
};
await mkdir(join(root, 'styles'), { recursive: true });
for (const lang of LANGUAGES) {
  const style = buildStyle({ ...options, lang });
  const json = `${JSON.stringify(style)}\n`;
  await writeFile(join(root, 'styles', `yoobi-${lang}.json`), json);
  if (lang === 'ru') await writeFile(join(root, 'styles', 'yoobi.json'), json);
  console.log(`styles/yoobi-${lang}.json: ${style.layers.length} слоёв, ${(json.length / 1024).toFixed(1)} КБ`);
}
console.log(`Базовый адрес: ${baseUrl}`);
