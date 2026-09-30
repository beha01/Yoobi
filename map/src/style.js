// Стиль карты Таджикистана на векторных тайлах OpenStreetMap (схема OpenMapTiles).
//
// Вблизи — «живой» город как на иллюстрации: серый асфальт с белыми бордюрами,
// светлые тротуары, ряды деревьев вдоль улиц, сочные парки с кронами, светлые
// объёмные дома, яркая вода. Места — цветные значки в белых «таблетках»,
// знаковые здания — значок над домом и подпись в плашке. Издалека — рельеф гор,
// ледники, реки, города и границы всей страны.
//
// Стиль использует только возможности, которые поддерживают и MapLibre GL JS,
// и MapLibre Native (Android/iOS), поэтому один и тот же JSON работает везде.

import { OUTSIDE_MASK, NEIGHBORS } from './borders.js';
import {
  AIRPORT, HIDDEN_CLASSES, LANDMARK_CATEGORIES, MINOR_SUBCLASSES, categoryExpression, imageExpression,
} from './categories.js';

export const LANGUAGES = ['ru', 'tg', 'en'];

export const DEFAULTS = {
  lang: 'ru',
  // TileJSON-адрес, `pmtiles://…` или массив шаблонов `https://…/{z}/{x}/{y}.pbf`.
  tiles: 'https://tiles.openfreemap.org/planet',
  // Дополнительные тайлы с подъездами и деревьями (scripts/build-tiles.sh); null — без них.
  extraTiles: null,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  // Абсолютный адрес спрайта без расширения, например https://example.com/map/sprites/yoobi
  sprite: null,
  // Рельеф (AWS Terrain Tiles, формат terrarium). null — без рельефа.
  dem: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  hillshade: true,
  terrain: false, // число — объёмный рельеф с этим преувеличением, например 1.3
  buildings3d: true,
  trees: true, // объёмные деревья (из extraTiles) и текстура лесов
  // «Заморозка» соседних стран: true — встроенный контур, строка — адрес GeoJSON
  // (точный контур из scripts/build-tiles.sh), false — выключить.
  locked: true,
  poi: true,
  category: null, // id категории из CATEGORIES, чтобы показывать только её
};

// Геометрия картинок спрайта, от которой зависит раскладка подписей (см. scripts/sprite.mjs).
export const PILL = { width: 68, height: 34, circleX: 17, contentLeft: 37, contentHeight: 18 };
export const MARK = { width: 64, height: 64, circleY: 16, contentTop: 40, contentHeight: 16 };

export const COLORS = {
  land: '#EEE9E0',
  residential: '#ECE6DC',
  commercial: '#EFE7DE',
  industrial: '#E7E3DC',
  park: '#A6D57E',
  parkFar: '#C3E3A6',
  grass: '#B5DC90',
  wood: '#86C463',
  farmland: '#E9ECCB',
  sand: '#F2E9CF',
  rock: '#E4E0D8',
  ice: '#FFFFFF',
  wetland: '#CFE7C4',
  pitch: '#B7E09A',
  cemetery: '#D5E6C5',
  hospital: '#F6E6E3',
  school: '#F2EBDD',
  water: '#54B8F0',
  waterFar: '#8CCFF3',
  building: '#E2DBCF',
  buildingOutline: '#D3CABB',
  building3d: '#F5EFE6',
  building3dTall: '#E9E2D7',
  sidewalk: '#F2E5C0',
  curb: '#FFFFFF',
  asphaltMajor: '#A9AEB4',
  asphalt: '#C4C7CB',
  asphaltService: '#D3D5D8',
  road: '#FFFFFF',
  roadCasing: '#DCD5C9',
  primary: '#FFF3C4',
  primaryCasing: '#EFCB6A',
  motorway: '#FFD970',
  motorwayCasing: '#E3B24A',
  paving: '#F5F3EE',
  pavingEdge: '#DCD6CB',
  rail: '#B9B4AC',
  aeroway: '#DCD8D1',
  boundary: '#8E7BAE',
  label: '#1E1E1E',
  roadLabel: '#1C1C1C',
  labelMuted: '#6A6258',
  country: '#5F5078',
  region: '#8A7E9E',
  halo: '#FFFFFF',
  waterLabel: '#1F6FA5',
  peak: '#7A5C3E',
  poiLabel: '#1E1E1E',
};

const FONT = {
  regular: ['Noto Sans Regular'],
  bold: ['Noto Sans Bold'],
  italic: ['Noto Sans Italic'],
};

const SOURCE = 'openmaptiles';
// Область текста в картинке подъезда начинается правее значка двери.
const ENTRANCE_TEXT_OFFSET = 12;

function landcoverColor(park) {
  const C = COLORS;
  return ['match', ['get', 'class'],
    'wood', C.wood,
    'grass', ['match', ['get', 'subclass'], ['park', 'garden', 'village_green', 'recreation_ground'], park, C.grass],
    'farmland', C.farmland,
    'sand', C.sand,
    'rock', C.rock,
    'ice', C.ice,
    'wetland', C.wetland,
    C.grass];
}
const EXTRA = 'extra';

// ——— Выражения ———

// Название объекта на выбранном языке с запасными вариантами.
export function nameExpression(lang = 'ru') {
  if (lang === 'tg') return ['coalesce', ['get', 'name:tg'], ['get', 'name'], ['get', 'name:ru']];
  if (lang === 'en') {
    return ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']];
  }
  return ['coalesce', ['get', 'name:ru'], ['get', 'name']];
}

// Названия улиц: «улица Айни» → «ул. Айни», «проспект Рудаки» → «просп. Рудаки».
const ABBREVIATIONS = {
  ru: [['улица ', 'ул. '], ['проспект ', 'просп. '], ['переулок ', 'пер. '],
    ['бульвар ', 'бул. '], ['проезд ', 'пр. '], ['шоссе ', 'ш. '], ['набережная ', 'наб. ']],
};
export function streetNameExpression(lang = 'ru') {
  const rules = ABBREVIATIONS[lang];
  if (!rules) return nameExpression(lang);
  const cases = ['case'];
  for (const [from, to] of rules) {
    cases.push(['==', ['index-of', from, ['var', 'n']], 0],
      ['concat', to, ['slice', ['var', 'n'], from.length]]);
  }
  cases.push(['var', 'n']);
  return ['let', 'n', ['to-string', nameExpression(lang)], cases];
}

// Реки по-русски подписываются «р. Душанбинка».
export function riverNameExpression(lang = 'ru') {
  if (lang !== 'ru') return nameExpression(lang);
  return ['let', 'n', ['to-string', nameExpression(lang)],
    ['case',
      ['any',
        ['==', ['index-of', 'р. ', ['downcase', ['var', 'n']]], 0],
        ['==', ['index-of', 'река', ['downcase', ['var', 'n']]], 0]],
      ['var', 'n'],
      ['concat', 'р. ', ['var', 'n']]]];
}

function peakLabelExpression(lang) {
  return ['format',
    nameExpression(lang), {},
    ['case', ['has', 'ele'], ['concat', '\n', ['to-string', ['get', 'ele']], ' м'], ''], { 'font-scale': 0.85 }];
}

const TEXT_BUILDERS = {
  name: nameExpression, street: streetNameExpression, river: riverNameExpression, peak: peakLabelExpression,
  neighbor: (lang) => ['get', `name_${lang}`],
};

// text-field для слоя с пометкой metadata['yoobi:text'] на нужном языке.
export function textFieldFor(kind, lang) {
  return TEXT_BUILDERS[kind](lang);
}

const hasName = ['all', ['has', 'name'], ['!=', ['get', 'name'], '']];
const isLine = ['==', ['geometry-type'], 'LineString'];
const isPolygon = ['==', ['geometry-type'], 'Polygon'];

// Фильтр слоёв мест:
//   'main'     — места со значком в «таблетке» (кафе, магазины, аптеки…);
//   'landmark' — знаковые места (госучреждения, вузы, культура, мечети);
//   'icon'     — значки без подписей на средних масштабах (main + landmark);
//   'minor'    — прочее и мелочь вроде остановок (только вблизи);
//   'airport'  — аэропорты.
// category — показать только одну категорию.
export function poiFilter(kind, category = null) {
  if (kind === 'airport') {
    return category && category !== AIRPORT.id ? ['all', hasName, false] : hasName;
  }
  const cat = categoryExpression();
  const minor = ['any',
    ['==', cat, 'other'],
    ['in', ['get', 'subclass'], ['literal', MINOR_SUBCLASSES]],
  ];
  const landmark = ['in', cat, ['literal', LANDMARK_CATEGORIES]];
  const kinds = {
    main: ['all', ['!', minor], ['!', landmark]],
    landmark: ['all', ['!', minor], landmark],
    icon: ['!', minor],
    minor,
  };
  const filter = ['all', hasName,
    ['!', ['in', ['get', 'class'], ['literal', HIDDEN_CLASSES]]],
    kinds[kind],
  ];
  if (category) filter.push(['==', cat, category]);
  return filter;
}

const zoomLinear = (...stops) => ['interpolate', ['linear'], ['zoom'], ...stops];
const zoomExp = (...stops) => ['interpolate', ['exponential', 1.5], ['zoom'], ...stops];
// Таблица {зум: значение} → интерполяция по зуму.
const table = (t, fn = (v) => v) => zoomExp(...Object.entries(t).flatMap(([z, v]) => [Number(z), fn(v, Number(z))]));

// ——— Дороги ———

// Ширина асфальта по зумам. Вблизи у дороги появляются бордюр и тротуар.
const ROADS = [
  { id: 'service', classes: ['service', 'track'], minzoom: 14, casing: 'roadCasing', low: 'road', near: 'asphaltService',
    width: { 14: 0.8, 15: 2, 16: 4, 17: 7, 18: 12 } },
  { id: 'minor', classes: ['minor'], minzoom: 12, casing: 'roadCasing', low: 'road', near: 'asphalt',
    width: { 12: 0.5, 13: 1.2, 14: 3, 15: 5, 16: 8, 17: 13, 18: 22 } },
  { id: 'secondary', classes: ['secondary', 'tertiary'], minzoom: 9, casing: 'roadCasing', low: 'road', near: 'asphaltMajor',
    width: { 9: 0.5, 10: 0.8, 12: 1.8, 13: 3, 14: 5.5, 15: 8, 16: 12, 17: 20, 18: 32 } },
  { id: 'primary', classes: ['primary'], minzoom: 7, casing: 'primaryCasing', low: 'primary', near: 'asphaltMajor',
    width: { 7: 0.6, 9: 1.1, 10: 1.6, 12: 3, 13: 4.5, 14: 7, 15: 11, 16: 16, 17: 26, 18: 42 } },
  { id: 'motorway', classes: ['motorway', 'trunk'], minzoom: 5, casing: 'motorwayCasing', low: 'motorway', near: 'asphaltMajor',
    width: { 5: 0.8, 7: 1.2, 9: 2, 10: 2.5, 12: 4, 13: 5.5, 14: 8, 15: 12, 16: 18, 17: 28, 18: 44 } },
];
const SIDEWALK = { 15: 1.5, 16: 3, 17: 5, 18: 8 }; // ширина тротуара с каждой стороны
const NEAR = [15, 16, 17, 18];
const widthAt = (road, z) => {
  const zs = Object.keys(road.width).map(Number);
  if (road.width[z] !== undefined) return road.width[z];
  return road.width[zs.find((k) => k > z) ?? zs.at(-1)];
};
const roadFilter = (classes, brunnel) => ['all', isLine,
  ['in', ['get', 'class'], ['literal', classes]],
  brunnel === 'tunnel' ? ['==', ['get', 'brunnel'], 'tunnel'] : ['!=', ['get', 'brunnel'], 'tunnel'],
];

function tunnelLayers() {
  return ROADS.map((r) => ({
    id: `tunnel-${r.id}`,
    type: 'line',
    source: SOURCE,
    'source-layer': 'transportation',
    minzoom: Math.max(r.minzoom, 12),
    filter: roadFilter(r.classes, 'tunnel'),
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': COLORS[r.casing],
      'line-width': table(r.width),
      'line-opacity': 0.5,
      'line-dasharray': [2, 1.5],
    },
  }));
}

// Тротуары: самая широкая «подложка» дороги, только вблизи.
function sidewalkLayers() {
  return ROADS.filter((r) => r.id !== 'service').map((r) => ({
    id: `sidewalk-${r.id}`,
    type: 'line',
    source: SOURCE,
    'source-layer': 'transportation',
    minzoom: 14.5,
    filter: roadFilter(r.classes),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': COLORS.sidewalk,
      'line-width': zoomExp(...NEAR.flatMap((z) => [z, widthAt(r, z) + 2 + SIDEWALK[z] * 2])),
      'line-opacity': zoomLinear(14.5, 0, 15.5, 1),
    },
  }));
}

function roadLayers() {
  const casings = ROADS.map((r) => ({
    id: `road-${r.id}-casing`,
    type: 'line',
    source: SOURCE,
    'source-layer': 'transportation',
    minzoom: r.minzoom,
    filter: roadFilter(r.classes),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': zoomLinear(14.5, COLORS[r.casing], 15.8, COLORS.curb),
      'line-width': table(r.width, (w, z) => w + (z >= 12 ? 2 : 1)),
    },
  }));
  const fills = ROADS.map((r) => ({
    id: `road-${r.id}`,
    type: 'line',
    source: SOURCE,
    'source-layer': 'transportation',
    minzoom: r.minzoom,
    filter: roadFilter(r.classes),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': zoomLinear(14.5, COLORS[r.low], 15.8, COLORS[r.near]),
      'line-width': table(r.width),
    },
  }));
  return [...casings, ...fills];
}

// ——— Стиль целиком ———

export function buildStyle(options = {}) {
  // Опции со значением undefined не затирают значения по умолчанию.
  const o = { ...DEFAULTS };
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) o[key] = value;
  }
  if (!LANGUAGES.includes(o.lang)) throw new Error(`Неизвестный язык: ${o.lang}`);
  if (!o.sprite) throw new Error('Не задан адрес спрайта (options.sprite)');
  const C = COLORS;
  const name = nameExpression(o.lang);
  const text = (kind) => ({ 'yoobi:text': kind });
  const extra = Boolean(o.extraTiles);

  const vector = (tiles) => (Array.isArray(tiles)
    ? { type: 'vector', tiles, maxzoom: 14,
      attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a>' }
    : { type: 'vector', url: tiles });
  const sources = { [SOURCE]: vector(o.tiles) };
  if (extra) sources[EXTRA] = vector(o.extraTiles);
  const demSource = () => ({
    type: 'raster-dem',
    tiles: [o.dem],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 12,
    attribution: '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank">Рельеф: Terrain Tiles</a>',
  });
  if (o.locked) {
    sources.outside = { type: 'geojson', data: typeof o.locked === 'string' ? o.locked : OUTSIDE_MASK, tolerance: 0.6 };
    sources.neighbors = { type: 'geojson', data: NEIGHBORS };
  }
  const hillshade = o.dem && o.hillshade;
  if (hillshade) sources.hillshade = demSource();
  if (o.dem && o.terrain) sources.terrain = demSource();

  const layers = [
    { id: 'background', type: 'background', paint: { 'background-color': C.land } },

    // ——— Земля: застройка, затем зелень, пески и ледники поверх неё ———
    {
      id: 'landuse',
      type: 'fill',
      source: SOURCE,
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', [
        'residential', 'suburb', 'neighbourhood', 'commercial', 'retail', 'industrial',
        'railway', 'cemetery', 'hospital', 'school', 'university', 'college', 'kindergarten',
        'library', 'stadium', 'pitch', 'playground', 'garages', 'military']]],
      paint: {
        'fill-color': ['match', ['get', 'class'],
          ['residential', 'suburb', 'neighbourhood'], C.residential,
          ['commercial', 'retail'], C.commercial,
          ['industrial', 'railway', 'garages', 'military'], C.industrial,
          'cemetery', C.cemetery,
          'hospital', C.hospital,
          ['school', 'university', 'college', 'kindergarten', 'library'], C.school,
          ['stadium', 'pitch', 'playground'], C.pitch,
          C.residential],
        'fill-opacity': zoomLinear(8, 0.5, 12, 1),
      },
    },
    {
      id: 'landcover',
      type: 'fill',
      source: SOURCE,
      'source-layer': 'landcover',
      paint: {
        'fill-color': zoomLinear(11, landcoverColor(C.parkFar), 15, landcoverColor(C.park)),
        'fill-opacity': ['match', ['get', 'class'], 'farmland', 0.75, 'rock', 0.8, 1],
        'fill-antialias': false,
      },
    },
    ...(o.trees ? [{
      id: 'landcover-trees',
      type: 'fill',
      source: SOURCE,
      'source-layer': 'landcover',
      minzoom: 12,
      filter: ['==', ['get', 'class'], 'wood'],
      metadata: { 'yoobi:group': 'trees' },
      paint: {
        'fill-pattern': 'pattern-wood',
        'fill-opacity': zoomLinear(12, 0, 13, 0.9),
        'fill-antialias': false,
      },
    }] : []),
    {
      id: 'park',
      type: 'fill',
      source: SOURCE,
      'source-layer': 'park',
      paint: { 'fill-color': C.parkFar, 'fill-opacity': zoomLinear(6, 0.25, 12, 0.4) },
    },
    ...(hillshade ? [{
      id: 'hillshade',
      type: 'hillshade',
      source: 'hillshade',
      maxzoom: 16,
      metadata: { 'yoobi:group': 'hillshade' },
      paint: {
        'hillshade-exaggeration': zoomLinear(5, 0.5, 9, 0.38, 13, 0.16, 16, 0),
        'hillshade-shadow-color': '#9C8F7A',
        'hillshade-highlight-color': '#FFFFFF',
        'hillshade-accent-color': '#C3B9A6',
      },
    }] : []),

    // ——— Вода ———
    {
      id: 'water',
      type: 'fill',
      source: SOURCE,
      'source-layer': 'water',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      paint: { 'fill-color': zoomLinear(8, C.waterFar, 14, C.water) },
    },
    {
      id: 'waterway',
      type: 'line',
      source: SOURCE,
      'source-layer': 'waterway',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': zoomLinear(8, C.waterFar, 14, C.water),
        'line-width': zoomExp(
          6, ['match', ['get', 'class'], 'river', 0.6, 0],
          9, ['match', ['get', 'class'], 'river', 1.2, 0.3],
          12, ['match', ['get', 'class'], 'river', 2.4, 0.6],
          14, ['match', ['get', 'class'], 'river', 5, 1.5],
          18, ['match', ['get', 'class'], 'river', 18, 5]),
      },
    },

    // ——— Аэропорты ———
    {
      id: 'aeroway',
      type: 'line',
      source: SOURCE,
      'source-layer': 'aeroway',
      minzoom: 11,
      filter: ['all', isLine, ['in', ['get', 'class'], ['literal', ['runway', 'taxiway']]]],
      paint: {
        'line-color': C.aeroway,
        'line-width': zoomExp(
          11, ['match', ['get', 'class'], 'runway', 3, 0.5],
          16, ['match', ['get', 'class'], 'runway', 50, 12]),
      },
    },

    // ——— Площади и пешеходные зоны ———
    {
      id: 'pedestrian-area',
      type: 'fill',
      source: SOURCE,
      'source-layer': 'transportation',
      minzoom: 13,
      filter: ['all', isPolygon, ['in', ['get', 'class'], ['literal', ['path', 'pedestrian', 'minor', 'service']]]],
      paint: { 'fill-color': C.paving, 'fill-outline-color': C.pavingEdge },
    },

    // ——— Дороги: тоннели, тротуары, бордюры, асфальт ———
    ...tunnelLayers(),
    ...sidewalkLayers(),
    {
      id: 'path-casing',
      type: 'line',
      source: SOURCE,
      'source-layer': 'transportation',
      minzoom: 15,
      filter: ['all', isLine, ['==', ['get', 'class'], 'path'], ['!=', ['get', 'brunnel'], 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.pavingEdge, 'line-width': zoomExp(15, 2.2, 16, 3.4, 17, 5, 18, 8) },
    },
    {
      id: 'path',
      type: 'line',
      source: SOURCE,
      'source-layer': 'transportation',
      minzoom: 14,
      filter: ['all', isLine, ['==', ['get', 'class'], 'path'], ['!=', ['get', 'brunnel'], 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.paving, 'line-width': zoomExp(14, 0.8, 15, 1.4, 16, 2.4, 17, 3.8, 18, 6.5) },
    },
    {
      id: 'railway',
      type: 'line',
      source: SOURCE,
      'source-layer': 'transportation',
      minzoom: 9,
      filter: ['all', isLine, ['in', ['get', 'class'], ['literal', ['rail', 'transit']]], ['!=', ['get', 'brunnel'], 'tunnel']],
      paint: { 'line-color': C.rail, 'line-width': zoomExp(9, 0.6, 14, 1.8, 18, 3.5) },
    },
    {
      id: 'railway-dash',
      type: 'line',
      source: SOURCE,
      'source-layer': 'transportation',
      minzoom: 13,
      filter: ['all', isLine, ['in', ['get', 'class'], ['literal', ['rail', 'transit']]], ['!=', ['get', 'brunnel'], 'tunnel']],
      paint: { 'line-color': '#FFFFFF', 'line-width': zoomExp(13, 0.6, 18, 2), 'line-dasharray': [3, 3] },
    },
    ...roadLayers(),

    // ——— Здания и деревья ———
    // Мягкая тень у основания домов: дома «стоят» на земле, а не парят.
    {
      id: 'building-shadow',
      type: 'line',
      source: SOURCE,
      'source-layer': 'building',
      minzoom: 15,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': '#5A4E3E',
        'line-opacity': zoomLinear(15, 0, 16, 0.22),
        'line-width': zoomExp(15, 2, 17, 6, 18, 10),
        'line-blur': zoomExp(15, 2, 17, 6, 18, 10),
      },
    },
    {
      id: 'building',
      type: 'fill',
      source: SOURCE,
      'source-layer': 'building',
      minzoom: 13,
      paint: {
        'fill-color': C.building,
        'fill-outline-color': C.buildingOutline,
        'fill-opacity': zoomLinear(13, 0, 13.5, 1),
      },
    },
    ...(o.buildings3d ? [{
      id: 'building-3d',
      type: 'fill-extrusion',
      source: SOURCE,
      'source-layer': 'building',
      minzoom: 14.5,
      filter: ['!=', ['get', 'hide_3d'], true],
      metadata: { 'yoobi:group': '3d' },
      paint: {
        // Цвет фасада из OSM (building:colour), смягчённый к светлой палитре карты.
        'fill-extrusion-color': ['case',
          ['has', 'colour'], ['interpolate-lab', ['linear'], 0.55, 0, ['to-color', ['get', 'colour']], 1, C.building3d],
          ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6], 0, C.building3d, 60, C.building3dTall]],
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': true,
      },
    }] : []),
    ...(extra && o.trees ? [{
      id: 'trees-3d',
      type: 'fill-extrusion',
      source: EXTRA,
      'source-layer': 'tree',
      minzoom: 15,
      metadata: { 'yoobi:group': 'trees' },
      paint: {
        // Ярус 0 — ствол, выше — крона: снизу темнее, к макушке светлее, как на иллюстрации.
        'fill-extrusion-color': ['match', ['coalesce', ['get', 'tier'], 0],
          0, '#7A5A3C',
          ['match', ['coalesce', ['get', 'shade'], 0],
            1, ['match', ['get', 'tier'], 1, '#3F8A34', 2, '#4E9E3C', 3, '#5DAE45', 4, '#72BE52', '#8ACD63'],
            2, ['match', ['get', 'tier'], 1, '#478F38', 2, '#58A641', 3, '#69B64B', 4, '#7EC559', '#98D46C'],
            ['match', ['get', 'tier'], 1, '#43873A', 2, '#53A13F', 3, '#63B249', 4, '#78C156', '#91D068']]],
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
        'fill-extrusion-opacity': zoomLinear(15, 0, 15.6, 1),
        'fill-extrusion-vertical-gradient': true,
      },
    }] : []),

    // ——— Границы ———
    {
      id: 'boundary-region',
      type: 'line',
      source: SOURCE,
      'source-layer': 'boundary',
      minzoom: 5,
      filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      paint: {
        'line-color': C.boundary,
        'line-opacity': 0.5,
        'line-width': zoomLinear(5, 0.6, 12, 1.4),
        'line-dasharray': [3, 2],
      },
    },
    {
      id: 'boundary-country-disputed',
      type: 'line',
      source: SOURCE,
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1], ['==', ['get', 'disputed'], 1]],
      paint: { 'line-color': C.boundary, 'line-width': zoomLinear(3, 1, 10, 2.4), 'line-dasharray': [2, 2] },
    },
    {
      id: 'boundary-country',
      type: 'line',
      source: SOURCE,
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1], ['!=', ['get', 'disputed'], 1]],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': C.boundary, 'line-width': zoomLinear(3, 1, 10, 2.6) },
    },

    // ——— Подписи ———
    {
      id: 'waterway-label',
      type: 'symbol',
      source: SOURCE,
      'source-layer': 'waterway',
      minzoom: 11,
      filter: ['all', hasName, ['==', ['get', 'class'], 'river']],
      metadata: text('river'),
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 420,
        'text-field': riverNameExpression(o.lang),
        'text-font': FONT.italic,
        'text-size': zoomLinear(11, 11, 14, 13, 17, 15),
        'text-letter-spacing': 0.06,
      },
      paint: { 'text-color': C.waterLabel, 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.4 },
    },
    {
      id: 'water-label',
      type: 'symbol',
      source: SOURCE,
      'source-layer': 'water_name',
      filter: hasName,
      metadata: text('name'),
      layout: {
        'text-field': name,
        'text-font': FONT.italic,
        'text-size': zoomLinear(8, 11, 14, 14),
        'text-max-width': 8,
      },
      paint: { 'text-color': C.waterLabel, 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.4 },
    },
    {
      id: 'road-label',
      type: 'symbol',
      source: SOURCE,
      'source-layer': 'transportation_name',
      minzoom: 13,
      filter: ['all', hasName,
        ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']]]],
      metadata: text('street'),
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 340,
        'text-field': streetNameExpression(o.lang),
        'text-font': FONT.regular,
        'text-size': zoomLinear(
          13, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 11, 10],
          16, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], 14, 13],
          18, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], 17, 15.5]),
        'text-letter-spacing': 0.02,
        'text-max-angle': 30,
        'text-padding': 4,
      },
      paint: { 'text-color': C.roadLabel, 'text-halo-color': C.halo, 'text-halo-width': 2, 'text-halo-blur': 0.3 },
    },
    {
      id: 'housenumber',
      type: 'symbol',
      source: SOURCE,
      'source-layer': 'housenumber',
      minzoom: 16.5,
      layout: {
        'text-field': ['to-string', ['get', 'housenumber']],
        'text-font': FONT.regular,
        'text-size': zoomLinear(16.5, 10.5, 18, 12.5),
        'text-padding': 3,
      },
      paint: { 'text-color': '#7B7064', 'text-halo-color': '#F7F3EC', 'text-halo-width': 1.4 },
    },
    ...(extra ? [
      // Стрелка перед дверью показывает, с какой стороны дома вход.
      {
        id: 'entrance-arrow',
        type: 'symbol',
        source: EXTRA,
        'source-layer': 'entrance',
        minzoom: 17,
        filter: ['has', 'angle'],
        metadata: { 'yoobi:group': 'entrances' },
        layout: {
          'icon-image': 'entrance-arrow',
          'icon-rotate': ['coalesce', ['get', 'angle'], 0],
          'icon-rotation-alignment': 'map',
          'icon-pitch-alignment': 'map',
          'icon-size': zoomLinear(17, 1.1, 19, 1.8),
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      },
      // Значок двери и номер подъезда; с 18 зума — ещё и квартиры.
      {
        id: 'entrance',
        type: 'symbol',
        source: EXTRA,
        'source-layer': 'entrance',
        minzoom: 17,
        filter: ['has', 'ref'],
        metadata: { 'yoobi:group': 'entrances' },
        layout: {
          'icon-image': 'label-entrance',
          'icon-text-fit': 'both',
          'icon-text-fit-padding': [0, 2, 0, 1],
          'text-field': ['step', ['zoom'],
            ['to-string', ['get', 'ref']],
            18, ['format',
              ['to-string', ['get', 'ref']], {},
              ['case', ['has', 'flats'], ['concat', '  кв. ', ['to-string', ['get', 'flats']]], ''],
              { 'font-scale': 0.85 }]],
          'text-font': FONT.bold,
          'text-size': 11,
          'text-anchor': 'left',
          'text-offset': [ENTRANCE_TEXT_OFFSET / 11, -1.6],
          'text-padding': 1,
          'symbol-sort-key': ['to-number', ['get', 'ref'], 99],
        },
        paint: { 'text-color': '#3E362D' },
      },
    ] : []),
    {
      id: 'mountain-peak',
      type: 'symbol',
      source: SOURCE,
      'source-layer': 'mountain_peak',
      minzoom: 7,
      filter: hasName,
      metadata: text('peak'),
      layout: {
        'icon-image': 'peak',
        'text-field': peakLabelExpression(o.lang),
        'text-font': FONT.italic,
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 0.6],
        'text-max-width': 8,
        'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'ele'], 0]],
      },
      paint: { 'text-color': C.peak, 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.2 },
    },
    // Места ниже подписей населённых пунктов: при нехватке места города важнее.
    ...(o.poi ? poiLayers(o) : []),
    {
      id: 'place-minor',
      type: 'symbol',
      source: SOURCE,
      'source-layer': 'place',
      minzoom: 11,
      filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood', 'hamlet', 'isolated_dwelling']]],
      metadata: text('name'),
      layout: {
        'text-field': name,
        'text-font': FONT.regular,
        'text-size': zoomLinear(11, 11, 15, 13),
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.08,
        'text-max-width': 8,
      },
      paint: { 'text-color': C.labelMuted, 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.4 },
    },
    {
      id: 'place-village',
      type: 'symbol',
      source: SOURCE,
      'source-layer': 'place',
      minzoom: 9,
      maxzoom: 15,
      filter: ['==', ['get', 'class'], 'village'],
      metadata: text('name'),
      layout: {
        'text-field': name,
        'text-font': FONT.regular,
        'text-size': zoomLinear(9, 10, 14, 13),
        'text-max-width': 8,
      },
      paint: { 'text-color': C.label, 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.4 },
    },
    ...placeLayers('town', 6, 15, 'dot-town', zoomLinear(6, 10, 10, 13, 12, 15), o),
    ...placeLayers('city', 4, 14, ['case', ['==', ['get', 'capital'], 2], 'dot-capital', 'dot-city'],
      zoomLinear(4, ['case', ['==', ['get', 'capital'], 2], 13, 11], 10, ['case', ['==', ['get', 'capital'], 2], 22, 17]), o),
    {
      id: 'place-state',
      type: 'symbol',
      source: SOURCE,
      'source-layer': 'place',
      minzoom: 5,
      maxzoom: 8.5,
      filter: ['in', ['get', 'class'], ['literal', ['state', 'province']]],
      metadata: text('name'),
      layout: {
        'text-field': name,
        'text-font': FONT.regular,
        'text-size': zoomLinear(5, 10.5, 8, 13),
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.12,
        'text-max-width': 7,
      },
      paint: { 'text-color': C.region, 'text-halo-color': 'rgba(255,255,255,0.8)', 'text-halo-width': 1.4 },
    },
    {
      id: 'place-country',
      type: 'symbol',
      source: SOURCE,
      'source-layer': 'place',
      maxzoom: 8,
      filter: ['==', ['get', 'class'], 'country'],
      metadata: text('name'),
      layout: {
        'text-field': name,
        'text-font': FONT.bold,
        'text-size': zoomLinear(3, 12, 7, 18),
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.15,
        'text-max-width': 6,
      },
      paint: { 'text-color': C.country, 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.6 },
    },
    ...(o.locked ? lockedLayers(o) : []),
  ];

  return {
    version: 8,
    name: 'Yoobi Light',
    sources,
    sprite: o.sprite,
    glyphs: o.glyphs,
    light: { anchor: 'viewport', color: '#ffffff', intensity: 0.35, position: [1.3, 210, 38] },
    ...(o.dem && o.terrain && { terrain: { source: 'terrain', exaggeration: Number(o.terrain) || 1 } }),
    layers,
  };
}

// Соседние страны: матовая «заморозка» поверх всего, светящаяся кромка вдоль
// границы и замок с названием страны. Нажатие обрабатывает enableLockedCountries().
function lockedLayers(o) {
  return [
    {
      id: 'outside-frost',
      type: 'fill',
      source: 'outside',
      metadata: { 'yoobi:group': 'locked' },
      paint: { 'fill-color': '#F4F1EC', 'fill-opacity': zoomLinear(4, 0.72, 10, 0.82) },
    },
    {
      id: 'outside-glow',
      type: 'line',
      source: 'outside',
      metadata: { 'yoobi:group': 'locked' },
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': zoomExp(4, 6, 8, 14, 14, 28),
        'line-blur': zoomExp(4, 6, 8, 14, 14, 28),
        'line-opacity': 0.9,
      },
    },
    {
      id: 'outside-border',
      type: 'line',
      source: 'outside',
      metadata: { 'yoobi:group': 'locked' },
      layout: { 'line-join': 'round' },
      paint: { 'line-color': '#8E7BAE', 'line-width': zoomLinear(4, 1.4, 10, 2.6), 'line-opacity': 0.85 },
    },
    {
      id: 'neighbor-lock',
      type: 'symbol',
      source: 'neighbors',
      maxzoom: 11,
      metadata: { 'yoobi:group': 'locked', 'yoobi:text': 'neighbor' },
      layout: {
        'icon-image': 'lock',
        'icon-size': zoomLinear(4, 0.8, 8, 1.1),
        'text-field': ['get', `name_${o.lang}`],
        'text-font': FONT.bold,
        'text-size': zoomLinear(4, 11, 8, 14),
        'text-anchor': 'top',
        'text-offset': [0, 1.5],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.1,
        'icon-allow-overlap': true,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#8A8378', 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.5 },
    },
  ];
}

// Города и посёлки: издалека — точка и подпись сбоку, вблизи — подпись по центру.
function placeLayers(cls, minzoom, maxzoom, dot, size, o) {
  const base = {
    type: 'symbol',
    source: SOURCE,
    'source-layer': 'place',
    filter: ['==', ['get', 'class'], cls],
    metadata: { 'yoobi:text': 'name' },
    paint: { 'text-color': COLORS.label, 'text-halo-color': 'rgba(255,255,255,0.95)', 'text-halo-width': 1.8 },
  };
  const text = {
    'text-field': nameExpression(o.lang),
    'text-font': FONT.bold,
    'text-size': size,
    'text-max-width': 8,
    'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
  };
  return [
    {
      ...base,
      id: `place-${cls}-dot`,
      minzoom,
      maxzoom: 10,
      layout: {
        ...text,
        'icon-image': dot,
        'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
        'text-radial-offset': 0.55,
        'text-justify': 'auto',
      },
    },
    { ...base, id: `place-${cls}`, minzoom: 10, maxzoom, layout: text },
  ];
}

// ——— Места ———
function poiLayers(o) {
  const name = nameExpression(o.lang);
  const base = { type: 'symbol', source: SOURCE, 'source-layer': 'poi' };
  const sort = ['coalesce', ['get', 'rank'], 99];
  // Строка текста занимает 1.2 × size по высоте; отступы добирают её до высоты
  // области content в картинке, чтобы круг значка не растягивался.
  const pill = (size) => {
    const v = Math.round(((PILL.contentHeight - 1.2 * size) / 2) * 100) / 100;
    return {
      'icon-image': imageExpression('pill'),
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [v, 3, v, 3],
      'text-field': name,
      'text-font': FONT.regular,
      'text-size': size,
      'text-line-height': 1.2,
      'text-anchor': 'left',
      // Круг значка — левее текста: сдвигаем текст так, чтобы круг был в точке места.
      'text-offset': [(PILL.contentLeft - PILL.circleX + 3) / size, 0],
      'text-max-width': 40,
      'text-padding': 2,
      'symbol-sort-key': sort,
    };
  };
  const mark = (size) => {
    const v = Math.round(((MARK.contentHeight - 1.2 * size) / 2) * 100) / 100;
    return {
      'icon-image': imageExpression('mark', LANDMARK_CATEGORIES),
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [v, 3, v, 3],
      'text-field': name,
      'text-font': FONT.regular,
      'text-size': size,
      'text-line-height': 1.2,
      'text-anchor': 'top',
      'text-justify': 'center',
      // Круг значка — над плашкой: сдвигаем текст вниз, чтобы круг был в точке места.
      'text-offset': [0, (MARK.contentTop - MARK.circleY + v) / size],
      'text-max-width': 9,
      'text-padding': 2,
      'symbol-sort-key': sort,
    };
  };
  const paint = { 'text-color': COLORS.poiLabel };
  const meta = (kind, textKind = 'name') => ({ 'yoobi:poi': kind, 'yoobi:group': 'poi', ...(textKind && { 'yoobi:text': textKind }) });
  return [
    {
      ...base,
      id: 'poi-icon',
      minzoom: 14,
      maxzoom: 15,
      filter: poiFilter('icon', o.category),
      metadata: meta('icon', null),
      layout: { 'icon-image': imageExpression('poi'), 'icon-padding': 1, 'symbol-sort-key': sort },
    },
    { ...base, id: 'poi-minor', minzoom: 17, filter: poiFilter('minor', o.category), metadata: meta('minor'), layout: pill(12), paint },
    { ...base, id: 'poi-label', minzoom: 15, filter: poiFilter('main', o.category), metadata: meta('main'), layout: pill(13), paint },
    { ...base, id: 'poi-landmark', minzoom: 15, filter: poiFilter('landmark', o.category), metadata: meta('landmark'), layout: mark(13), paint: { 'text-color': '#2A2A2A' } },
    {
      ...base,
      id: 'park-label',
      minzoom: 14.5,
      filter: ['all', hasName, ['in', ['get', 'class'], ['literal', ['park', 'garden']]]],
      metadata: { 'yoobi:text': 'name' },
      layout: {
        'icon-image': 'label-park',
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [0, 4, 0, 4],
        'text-field': name,
        'text-font': FONT.bold,
        'text-size': 13.5,
        'text-line-height': 1.2,
        'text-max-width': 9,
        'text-padding': 4,
        'symbol-sort-key': sort,
      },
      paint: { 'text-color': '#FFFFFF' },
    },
    {
      id: 'airport-label',
      type: 'symbol',
      source: SOURCE,
      'source-layer': 'aerodrome_label',
      minzoom: 10,
      filter: poiFilter('airport', o.category),
      metadata: meta('airport'),
      layout: {
        ...pill(13),
        'icon-image': `pill-${AIRPORT.id}-${AIRPORT.icon}`,
        'symbol-sort-key': ['match', ['get', 'class'], 'international', 0, 1],
      },
      paint,
    },
  ];
}
