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
import { CITIES, REGIONS } from './tajikistan.js';

export const LANGUAGES = ['ru', 'tg', 'en'];

export const DEFAULTS = {
  lang: 'ru',
  theme: 'light', // 'light' — дневная тема, 'dark' — ночная
  // TileJSON-адрес, `pmtiles://…` или массив шаблонов `https://…/{z}/{x}/{y}.pbf`.
  tiles: 'https://tiles.openfreemap.org/planet',
  // Дополнительные тайлы с подъездами и деревьями (scripts/build-tiles.sh); null — без них.
  extraTiles: null,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  // Абсолютный адрес спрайта без расширения, например https://example.com/map/sprites/yoobi
  sprite: null,
  // Рельеф (AWS Terrain Tiles, формат terrarium). null — без рельефа.
  dem: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  demMaxzoom: 12, // до какого зума есть тайлы высот (дальше растягиваются)
  hillshade: true,
  terrain: false, // число — объёмный рельеф с этим преувеличением, например 1.3
  buildings3d: true,
  trees: true, // объёмные деревья (из extraTiles) и текстура лесов
  // «Заморозка» соседних стран: true — встроенный контур, строка — адрес GeoJSON
  // (точный контур из scripts/build-tiles.sh), false — выключить.
  locked: true,
  // Тайлы из scripts/build-tiles.sh: подписей соседних стран в них нет, поэтому подписи
  // Таджикистана рисуются поверх «заморозки» и не обрезаются у границы. null — да,
  // если заданы extraTiles (их даёт тот же скрипт).
  clipped: null,
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
  landmarkLabel: '#2A2A2A',
  parkLabel: '#FFFFFF',
  orchard: '#C6E0A0',
  vineyard: '#D7E5AE',
  hillShadow: '#9C8F7A',
  hillHighlight: '#FFFFFF',
  hillAccent: '#C3B9A6',
  railDash: '#FFFFFF',
  buildingShadow: '#5A4E3E',
  trunk: '#7A5A3C',
  // Ярусы кроны снизу вверх для трёх оттенков деревьев.
  crowns: [['#3F8A34', '#4E9E3C', '#5DAE45', '#72BE52', '#8ACD63'],
    ['#478F38', '#58A641', '#69B64B', '#7EC559', '#98D46C'],
    ['#43873A', '#53A13F', '#63B249', '#78C156', '#91D068']],
  houseNumber: '#7B7064',
  houseNumberHalo: '#F7F3EC',
  buildingName: '#6E6357',
  entranceText: '#3E362D',
  crossing: '#FFFFFF',
  marking: '#FFFFFF',
  wall: '#DCD3C6',
  fence: '#B3AA9E',
  hedge: '#7DB65A',
  parking: '#E3E2EA',
  parkingOutline: '#C9C6D3',
  bridgeCasing: '#B8B1A6',
  bridgeShadow: '#5A4E3E',
  haloSoft: 'rgba(255,255,255,0.85)',
  haloStrong: 'rgba(255,255,255,0.95)',
  frost: '#F4F1EC',
  frostOpacity: [0.72, 0.82],
  glow: '#FFFFFF',
  maskBorder: '#8E7BAE',
  lockLabel: '#8A8378',
  light: '#FFFFFF',
  lightIntensity: 0.35,
};

// Ночная тема: тёмная холодная земля, приглушённые дороги и светлые подписи.
// Важное светлее фона (в дневной теме — темнее), вода и парки узнаются по оттенку.
export const NIGHT_COLORS = {
  ...COLORS,
  land: '#1C2129',
  residential: '#20262F',
  commercial: '#232830',
  industrial: '#22262D',
  park: '#23452F',
  parkFar: '#213B2B',
  grass: '#24412E',
  wood: '#1E3D2A',
  farmland: '#262F25',
  sand: '#363427',
  rock: '#2B2E34',
  ice: '#3A4554',
  wetland: '#20382E',
  pitch: '#244430',
  cemetery: '#223227',
  hospital: '#30272B',
  school: '#2B2925',
  water: '#1B4B70',
  waterFar: '#1A3C5A',
  building: '#2B313A',
  buildingOutline: '#39404B',
  building3d: '#3A424F',
  building3dTall: '#343C48',
  sidewalk: '#303640',
  curb: '#566070',
  asphaltMajor: '#4A5362',
  asphalt: '#3D4452',
  asphaltService: '#373E4A',
  road: '#3A414E',
  roadCasing: '#262B33',
  primary: '#665631',
  primaryCasing: '#86703C',
  motorway: '#86662B',
  motorwayCasing: '#A57F37',
  paving: '#2D333D',
  pavingEdge: '#3A414C',
  rail: '#58606C',
  aeroway: '#363C47',
  boundary: '#9C8BC0',
  label: '#E6E9ED',
  roadLabel: '#C8CDD5',
  labelMuted: '#98A1AC',
  country: '#C9C0DC',
  region: '#A89EC0',
  halo: '#1C2129',
  waterLabel: '#86BDE8',
  peak: '#C7A57D',
  poiLabel: '#E6E9ED',
  landmarkLabel: '#E6E9ED',
  orchard: '#29372A',
  vineyard: '#2E3629',
  hillShadow: '#000000',
  hillHighlight: '#5C6675',
  hillAccent: '#11151B',
  railDash: '#1C2129',
  buildingShadow: '#000000',
  trunk: '#4A3A2B',
  crowns: [['#1F4A26', '#25572C', '#2B6432', '#347239', '#3D7F41'],
    ['#22502A', '#285D30', '#2E6A36', '#37783D', '#418645'],
    ['#214C28', '#27592E', '#2D6634', '#36743B', '#3F8243']],
  houseNumber: '#9AA3AE',
  houseNumberHalo: '#20262F',
  buildingName: '#A6AFBA',
  entranceText: '#E6E9ED',
  crossing: '#C9CED6',
  marking: '#AEB5BF',
  wall: '#4A515D',
  fence: '#5B6370',
  hedge: '#2F5F3B',
  parking: '#2A303A',
  parkingOutline: '#3B4250',
  bridgeCasing: '#11151B',
  bridgeShadow: '#000000',
  haloSoft: 'rgba(28,33,41,0.85)',
  haloStrong: 'rgba(28,33,41,0.95)',
  frost: '#12161C',
  frostOpacity: [0.62, 0.72],
  glow: '#3B4452',
  maskBorder: '#9C8BC0',
  lockLabel: '#A8AFB9',
  light: '#C8D2E0',
  lightIntensity: 0.25,
};

export const THEMES = ['light', 'dark'];
const PALETTES = { light: COLORS, dark: NIGHT_COLORS };

const FONT = {
  regular: ['Noto Sans Regular'],
  bold: ['Noto Sans Bold'],
  italic: ['Noto Sans Italic'],
};

const SOURCE = 'openmaptiles';
// Область текста в картинке подъезда начинается правее значка двери.
const ENTRANCE_TEXT_OFFSET = 12;

// Цвет яруса кроны (1–5) из списка оттенков снизу вверх.
const crownColors = (tiers) => ['match', ['get', 'tier'], 1, tiers[0], 2, tiers[1], 3, tiers[2], 4, tiers[3], tiers[4]];

function landcoverColor(C, park) {
  return ['match', ['get', 'class'],
    'wood', C.wood,
    'grass', ['match', ['get', 'subclass'], ['park', 'garden', 'village_green', 'recreation_ground'], park, C.grass],
    'farmland', ['match', ['get', 'subclass'], 'orchard', C.orchard, 'vineyard', C.vineyard, C.farmland],
    'sand', C.sand,
    'rock', C.rock,
    'ice', C.ice,
    'wetland', C.wetland,
    C.grass];
}
const EXTRA = 'extra';

// Обзор страны (до OVERVIEW_TO зума) подписывается крупными городами из CITIES: в OSM
// ранги неровные — Бохтар появляется в тайлах только с 7 зума, а некоторые
// райцентры (у них в OSM население всего района) — раньше областных городов.
const OVERVIEW_TO = 7;
const OVERVIEW_CITIES = {
  type: 'FeatureCollection',
  features: CITIES.map((c, rank) => ({
    type: 'Feature',
    properties: { name_ru: c.name, name_tg: c.name_tg, name_en: c.name_en, capital: Boolean(c.capital), rank },
    geometry: { type: 'Point', coordinates: c.center },
  })),
};

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
  label: (lang) => ['get', `name_${lang}`],
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
    // Значки без подписей: в центре города мест сотни, поэтому показываются только
    // самые важные в каждой клетке сетки тайла (rank из схемы OpenMapTiles).
    icon: category ? ['!', minor] : ['all', ['!', minor], ['<=', ['coalesce', ['get', 'rank'], 99], 2]],
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
// Вблизи дороги меняют вид: белая дорога с бежевой кромкой → серый асфальт с белым
// бордюром и тротуаром. Переход короткий, чтобы на промежуточных зумах дороги не
// выглядели блёклыми.
const NEAR_FROM = 15.2;
const NEAR_TO = 15.9;
const widthAt = (road, z) => {
  const zs = Object.keys(road.width).map(Number);
  if (road.width[z] !== undefined) return road.width[z];
  return road.width[zs.find((k) => k > z) ?? zs.at(-1)];
};
// brunnel: 'tunnel' — тоннели, 'bridge' — мосты, иначе — дороги на земле.
const roadFilter = (classes, brunnel) => ['all', isLine,
  ['in', ['get', 'class'], ['literal', classes]],
  brunnel ? ['==', ['get', 'brunnel'], brunnel] : ['!', ['in', ['get', 'brunnel'], ['literal', ['tunnel', 'bridge']]]],
];

function tunnelLayers(C) {
  return ROADS.map((r) => ({
    id: `tunnel-${r.id}`,
    type: 'line',
    source: SOURCE,
    'source-layer': 'transportation',
    minzoom: Math.max(r.minzoom, 12),
    filter: roadFilter(r.classes, 'tunnel'),
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': C[r.casing],
      'line-width': table(r.width),
      'line-opacity': 0.5,
      'line-dasharray': [2, 1.5],
    },
  }));
}

// Тротуары: самая широкая «подложка» дороги, только вблизи.
function sidewalkLayers(C) {
  return ROADS.filter((r) => r.id !== 'service').map((r) => ({
    id: `sidewalk-${r.id}`,
    type: 'line',
    source: SOURCE,
    'source-layer': 'transportation',
    minzoom: NEAR_FROM,
    filter: roadFilter(r.classes),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': C.sidewalk,
      'line-width': zoomExp(...NEAR.flatMap((z) => [z, widthAt(r, z) + 2 + SIDEWALK[z] * 2])),
      'line-opacity': zoomLinear(NEAR_FROM, 0, NEAR_TO, 1),
    },
  }));
}

// Дороги на земле или мосты (bridge = true). Мосты рисуются поверх дорог и рек:
// с мягкой тенью под пролётом и тёмным парапетом по краям.
function roadLayers(C, bridge = false) {
  const kind = bridge ? 'bridge' : 'road';
  const brunnel = bridge ? 'bridge' : undefined;
  const shadows = bridge ? ROADS.filter((r) => r.id !== 'service').map((r) => ({
    id: `bridge-${r.id}-shadow`,
    type: 'line',
    source: SOURCE,
    'source-layer': 'transportation',
    minzoom: 14,
    filter: roadFilter(r.classes, brunnel),
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': C.bridgeShadow,
      'line-opacity': zoomLinear(14, 0, 15, 0.25),
      'line-width': table(r.width, (w) => w + 6),
      'line-blur': zoomExp(14, 2, 18, 10),
      'line-translate': [2, 3],
    },
  })) : [];
  const casings = ROADS.map((r) => ({
    id: `${kind}-${r.id}-casing`,
    type: 'line',
    source: SOURCE,
    'source-layer': 'transportation',
    minzoom: r.minzoom,
    filter: roadFilter(r.classes, brunnel),
    layout: { 'line-cap': bridge ? 'butt' : 'round', 'line-join': 'round' },
    paint: {
      'line-color': bridge ? C.bridgeCasing : zoomLinear(NEAR_FROM, C[r.casing], NEAR_TO, C.curb),
      'line-width': table(r.width, (w, z) => w + (bridge ? 4 : z >= 12 ? 2 : 1)),
    },
  }));
  const fills = ROADS.map((r) => ({
    id: `${kind}-${r.id}`,
    type: 'line',
    source: SOURCE,
    'source-layer': 'transportation',
    minzoom: r.minzoom,
    filter: roadFilter(r.classes, brunnel),
    layout: { 'line-cap': bridge ? 'butt' : 'round', 'line-join': 'round' },
    paint: {
      'line-color': zoomLinear(NEAR_FROM, C[r.low], NEAR_TO, C[r.near]),
      'line-width': table(r.width),
    },
  }));
  return [...shadows, ...casings, ...fills];
}

// Разметка и стрелки вблизи: белая прерывистая осевая на крупных дорогах, стрелки
// одностороннего движения по направлению проезда (oneway из схемы OpenMapTiles).
function markingLayers(C) {
  return [
    {
      id: 'road-marking',
      type: 'line',
      source: SOURCE,
      'source-layer': 'transportation',
      minzoom: 17,
      filter: ['all', roadFilter(['motorway', 'trunk', 'primary', 'secondary']), ['!=', ['get', 'ramp'], 1]],
      metadata: { 'yoobi:group': 'details' },
      paint: {
        'line-color': C.marking,
        'line-width': zoomExp(17, 0.9, 19, 2.4),
        'line-dasharray': [5, 6],
        'line-opacity': zoomLinear(17, 0, 17.5, 0.8),
      },
    },
  ];
}
function onewayLayer() {
  return {
    id: 'road-oneway',
    type: 'symbol',
    source: SOURCE,
    'source-layer': 'transportation',
    minzoom: 16.5,
    filter: ['all', isLine, ['in', ['get', 'oneway'], ['literal', [1, -1]]],
      ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']]]],
    metadata: { 'yoobi:group': 'details' },
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 110,
      'icon-image': 'oneway',
      'icon-rotate': ['match', ['get', 'oneway'], -1, 180, 0],
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'icon-size': zoomLinear(16.5, 0.75, 19, 1.3),
      'icon-padding': 2,
    },
    paint: { 'icon-opacity': zoomLinear(16.5, 0, 17, 0.9) },
  };
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
  if (!THEMES.includes(o.theme)) throw new Error(`Неизвестная тема: ${o.theme}`);
  const C = PALETTES[o.theme];
  const name = nameExpression(o.lang);
  const text = (kind) => ({ 'yoobi:text': kind });
  const extra = Boolean(o.extraTiles);
  const clipped = o.clipped ?? extra;

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
    maxzoom: o.demMaxzoom,
    attribution: '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank">Рельеф: Terrain Tiles</a>',
  });
  if (o.locked) {
    sources.outside = { type: 'geojson', data: typeof o.locked === 'string' ? o.locked : OUTSIDE_MASK, tolerance: 0.6 };
    sources.neighbors = { type: 'geojson', data: NEIGHBORS };
  }
  sources.regions = { type: 'geojson', data: REGIONS };
  sources.cities = { type: 'geojson', data: OVERVIEW_CITIES };
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
        'fill-color': zoomLinear(11, landcoverColor(C, C.parkFar), 15, landcoverColor(C, C.park)),
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
      // В городе отмывка только мешает: к 15 зуму её уже нет.
      maxzoom: 15,
      metadata: { 'yoobi:group': 'hillshade' },
      paint: {
        'hillshade-exaggeration': zoomLinear(5, 0.5, 9, 0.38, 12, 0.2, 15, 0),
        'hillshade-shadow-color': C.hillShadow,
        'hillshade-highlight-color': C.hillHighlight,
        'hillshade-accent-color': C.hillAccent,
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

    ...(extra ? [{
      id: 'parking-area',
      type: 'fill',
      source: EXTRA,
      'source-layer': 'parking',
      minzoom: 15,
      metadata: { 'yoobi:group': 'details' },
      paint: {
        'fill-color': C.parking,
        'fill-outline-color': C.parkingOutline,
        'fill-opacity': zoomLinear(15, 0, 15.5, 1),
      },
    }] : []),

    // ——— Дороги: тоннели, тротуары, бордюры, асфальт, мосты ———
    ...tunnelLayers(C),
    ...sidewalkLayers(C),
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
      paint: { 'line-color': C.railDash, 'line-width': zoomExp(13, 0.6, 18, 2), 'line-dasharray': [3, 3] },
    },
    ...roadLayers(C),
    ...markingLayers(C),
    ...(extra ? [{
      // «Зебры»: широкая линия поперёк дороги с частым пунктиром даёт полосы вдоль неё.
      id: 'crossing',
      type: 'line',
      source: EXTRA,
      'source-layer': 'crossing',
      minzoom: 17,
      metadata: { 'yoobi:group': 'details' },
      layout: { 'line-cap': 'butt' },
      paint: {
        'line-color': C.crossing,
        'line-width': zoomExp(17, 5, 18, 10, 19, 20),
        'line-dasharray': [0.14, 0.14],
        'line-opacity': zoomLinear(17, 0, 17.4, 0.95),
      },
    }] : []),
    ...roadLayers(C, true),
    onewayLayer(),

    // ——— Заборы, здания и деревья ———
    ...(extra ? [{
      id: 'barrier-line',
      type: 'line',
      source: EXTRA,
      'source-layer': 'barrier',
      minzoom: 16,
      filter: isLine,
      metadata: { 'yoobi:group': 'details' },
      paint: {
        'line-color': ['match', ['get', 'kind'], 'fence', C.fence, 'hedge', C.hedge, C.wall],
        'line-width': zoomExp(16, 0.8, 18, 2.2),
        'line-opacity': zoomLinear(16, 0, 16.5, 1),
      },
    }] : []),
    // Мягкая тень у основания домов: дома «стоят» на земле, а не парят.
    {
      id: 'building-shadow',
      type: 'line',
      source: SOURCE,
      'source-layer': 'building',
      minzoom: 15,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': C.buildingShadow,
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
        // Цвет фасада из OSM (building:colour), сильно смягчённый к палитре карты: серые и
        // тёмные фасады иначе выглядят сверху как провалы среди светлых крыш.
        'fill-extrusion-color': ['case',
          ['has', 'colour'], ['interpolate-lab', ['linear'], 0.72, 0, ['to-color', ['get', 'colour']], 1, C.building3d],
          ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6], 0, C.building3d, 60, C.building3dTall]],
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': true,
      },
    }] : []),
    ...(extra && o.buildings3d ? [{
      id: 'barrier-3d',
      type: 'fill-extrusion',
      source: EXTRA,
      'source-layer': 'barrier',
      minzoom: 16.5,
      filter: isPolygon,
      metadata: { 'yoobi:group': '3d' },
      paint: {
        'fill-extrusion-color': ['match', ['get', 'kind'], 'fence', C.fence, 'hedge', C.hedge, C.wall],
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 2],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': zoomLinear(16.5, 0, 17, 1),
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
          0, C.trunk,
          ['match', ['coalesce', ['get', 'shade'], 0],
            ...[1, 2].flatMap((shade) => [shade, crownColors(C.crowns[shade - 1])]),
            crownColors(C.crowns[2])]],
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
    // С «заморозкой» границу страны рисует кромка маски (outside-border).
    ...(o.locked ? [] : [{
      id: 'boundary-country',
      type: 'line',
      source: SOURCE,
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1], ['!=', ['get', 'disputed'], 1]],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': C.boundary, 'line-width': zoomLinear(3, 1, 10, 2.6) },
    }]),

    // ——— Подписи ———
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
      paint: { 'text-color': C.houseNumber, 'text-halo-color': C.houseNumberHalo, 'text-halo-width': 1.4 },
    },
    ...(extra ? [
      // Названия зданий без мест внутри: «Бизнес-центр …», «Дом печати».
      {
        id: 'building-label',
        type: 'symbol',
        source: EXTRA,
        'source-layer': 'label',
        minzoom: 16.5,
        metadata: { 'yoobi:group': 'details', 'yoobi:text': 'name' },
        layout: {
          'text-field': name,
          'text-font': FONT.regular,
          'text-size': zoomLinear(16.5, 11, 18, 13),
          'text-max-width': 8,
          'text-padding': 4,
        },
        paint: { 'text-color': C.buildingName, 'text-halo-color': C.haloSoft, 'text-halo-width': 1.4 },
      },
      // Светофоры, ворота, шлагбаумы, лавочки, фонтаны, туалеты, вода, парковки.
      ...urbanPointLayers(C),
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
        paint: { 'text-color': C.entranceText },
      },
    ] : []),
    // Подписи ниже — поверх «заморозки», если в тайлах нет подписей соседних стран:
    // тогда подписи у границы не обрезаются. Иначе «заморозка» закрывает и их.
    ...(o.locked && clipped ? frostLayers(C) : []),
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
      paint: { 'text-color': C.waterLabel, 'text-halo-color': C.haloSoft, 'text-halo-width': 1.4 },
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
      paint: { 'text-color': C.waterLabel, 'text-halo-color': C.haloSoft, 'text-halo-width': 1.4 },
    },
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
      paint: { 'text-color': C.peak, 'text-halo-color': C.haloSoft, 'text-halo-width': 1.2 },
    },
    // Места ниже подписей населённых пунктов: при нехватке места города важнее.
    ...(o.poi ? poiLayers(o, C) : []),
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
      paint: { 'text-color': C.labelMuted, 'text-halo-color': C.haloSoft, 'text-halo-width': 1.4 },
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
      paint: { 'text-color': C.label, 'text-halo-color': C.haloSoft, 'text-halo-width': 1.4 },
    },
    // Области — свои точки (в OSM у Согдийской области две), ниже городов по важности.
    {
      id: 'place-region',
      type: 'symbol',
      source: 'regions',
      minzoom: 5,
      maxzoom: 8.5,
      metadata: text('label'),
      layout: {
        'text-field': ['get', `name_${o.lang}`],
        'text-font': FONT.regular,
        'text-size': zoomLinear(5, 10.5, 8, 13),
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.12,
        'text-max-width': 7,
      },
      paint: { 'text-color': C.region, 'text-halo-color': C.haloSoft, 'text-halo-width': 1.4 },
    },
    ...placeLayers('town', OVERVIEW_TO, 15, 'dot-town', zoomLinear(6, 10, 10, 13, 12, 15), o, C),
    ...placeLayers('city', OVERVIEW_TO, 14, ['case', ['==', ['get', 'capital'], 2], 'dot-capital', 'dot-city'],
      zoomLinear(4, ['case', ['==', ['get', 'capital'], 2], 13, 11], 10, ['case', ['==', ['get', 'capital'], 2], 22, 17]), o, C),
    ...(o.locked && !clipped ? frostLayers(C) : []),
    // Крупные города на обзоре и название страны — только таджикские, поэтому всегда
    // поверх «заморозки»: подписи у границы (Истаравшан, Исфара) не обрезаются.
    {
      id: 'place-overview',
      type: 'symbol',
      source: 'cities',
      minzoom: 4,
      maxzoom: OVERVIEW_TO,
      metadata: text('label'),
      layout: {
        'icon-image': ['case', ['get', 'capital'], 'dot-capital', 'dot-city'],
        'text-field': ['get', `name_${o.lang}`],
        'text-font': FONT.bold,
        'text-size': zoomLinear(4, ['case', ['get', 'capital'], 13, 11], 10, ['case', ['get', 'capital'], 22, 17]),
        'text-max-width': 8,
        'symbol-sort-key': ['get', 'rank'],
        'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
        'text-radial-offset': 0.55,
        'text-justify': 'auto',
      },
      paint: { 'text-color': C.label, 'text-halo-color': C.haloStrong, 'text-halo-width': 1.8 },
    },
    {
      id: 'place-country',
      type: 'symbol',
      source: SOURCE,
      'source-layer': 'place',
      maxzoom: 8,
      // С «заморозкой» подписывается только Таджикистан: соседей подписывают замки.
      filter: ['all', ['==', ['get', 'class'], 'country'], ...(o.locked ? [['==', ['get', 'iso_a2'], 'TJ']] : [])],
      metadata: text('name'),
      layout: {
        'text-field': name,
        'text-font': FONT.bold,
        'text-size': zoomLinear(3, 12, 7, 18),
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.15,
        'text-max-width': 6,
      },
      paint: { 'text-color': C.country, 'text-halo-color': C.haloStrong, 'text-halo-width': 1.6 },
    },
    ...(o.locked ? [neighborLockLayer(o, C)] : []),
  ];

  return {
    version: 8,
    name: 'Yoobi Light',
    sources,
    sprite: o.theme === 'dark' ? `${o.sprite}-dark` : o.sprite,
    glyphs: o.glyphs,
    light: { anchor: 'viewport', color: C.light, intensity: C.lightIntensity, position: [1.3, 210, 38] },
    ...(o.dem && o.terrain && { terrain: { source: 'terrain', exaggeration: Number(o.terrain) || 1 } }),
    layers,
  };
}

// Соседние страны: матовая «заморозка», светящаяся кромка вдоль границы и замок с
// названием страны. Нажатие обрабатывает enableLockedCountries().
function frostLayers(C) {
  return [
    {
      id: 'outside-frost',
      type: 'fill',
      source: 'outside',
      metadata: { 'yoobi:group': 'locked' },
      paint: { 'fill-color': C.frost, 'fill-opacity': zoomLinear(4, C.frostOpacity[0], 10, C.frostOpacity[1]) },
    },
    {
      id: 'outside-glow',
      type: 'line',
      source: 'outside',
      metadata: { 'yoobi:group': 'locked' },
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': C.glow,
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
      paint: { 'line-color': C.maskBorder, 'line-width': zoomLinear(4, 1.4, 10, 2.6), 'line-opacity': 0.85 },
    },
  ];
}

function neighborLockLayer(o, C) {
  return {
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
    paint: { 'text-color': C.lockLabel, 'text-halo-color': C.haloStrong, 'text-halo-width': 1.5 },
  };
}

// Города и посёлки: издалека — точка и подпись сбоку, вблизи — подпись по центру.
function placeLayers(cls, minzoom, maxzoom, dot, size, o, C) {
  const base = {
    type: 'symbol',
    source: SOURCE,
    'source-layer': 'place',
    filter: ['==', ['get', 'class'], cls],
    metadata: { 'yoobi:text': 'name' },
    paint: { 'text-color': C.label, 'text-halo-color': C.haloStrong, 'text-halo-width': 1.8 },
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

// Городские мелочи вблизи (слой point дополнительных тайлов): значок по виду.
function urbanPointLayers(C) {
  const base = { type: 'symbol', source: EXTRA, 'source-layer': 'point', metadata: { 'yoobi:group': 'details' } };
  return [
    {
      ...base,
      id: 'parking-icon',
      minzoom: 16,
      filter: ['==', ['get', 'kind'], 'parking'],
      layout: {
        'icon-image': 'parking',
        'icon-size': zoomLinear(16, 0.8, 18, 1),
        'icon-padding': 2,
        'text-field': ['step', ['zoom'], '', 17.5, ['coalesce', ['get', 'name'], '']],
        'text-font': FONT.regular,
        'text-size': 11,
        'text-anchor': 'left',
        'text-offset': [1.1, 0],
        'text-optional': true,
        'text-max-width': 8,
      },
      paint: { 'text-color': C.labelMuted, 'text-halo-color': C.haloSoft, 'text-halo-width': 1.2 },
    },
    {
      ...base,
      id: 'traffic-signals',
      minzoom: 16.5,
      filter: ['==', ['get', 'kind'], 'signals'],
      layout: { 'icon-image': 'signals', 'icon-size': zoomLinear(16.5, 0.75, 18, 1), 'icon-padding': 1 },
    },
    {
      ...base,
      id: 'urban-details',
      minzoom: 17.5,
      filter: ['in', ['get', 'kind'], ['literal', ['gate', 'lift_gate', 'bench', 'fountain', 'toilets', 'water']]],
      layout: {
        'icon-image': ['match', ['get', 'kind'], 'lift_gate', 'lift-gate', ['get', 'kind']],
        'icon-size': zoomLinear(17.5, 0.8, 19, 1),
        'icon-padding': 1,
        'symbol-sort-key': ['match', ['get', 'kind'], 'lift_gate', 0, 'gate', 1, 'toilets', 2, 'water', 3, 'fountain', 4, 5],
      },
    },
  ];
}

// ——— Места ———
function poiLayers(o, C) {
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
  const paint = { 'text-color': C.poiLabel };
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
    { ...base, id: 'poi-landmark', minzoom: 15, filter: poiFilter('landmark', o.category), metadata: meta('landmark'), layout: mark(13), paint: { 'text-color': C.landmarkLabel } },
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
      paint: { 'text-color': C.parkLabel },
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
