// Светлый стиль карты Таджикистана на векторных тайлах OpenStreetMap
// (схема OpenMapTiles). Светлые кварталы, сочная зелень парков, голубая вода,
// белые улицы, объёмные здания и места с цветными значками.
//
// Стиль использует только возможности, которые поддерживают и MapLibre GL JS,
// и MapLibre Native (Android/iOS), поэтому один и тот же JSON работает везде.

import {
  AIRPORT, HIDDEN_CLASSES, MINOR_SUBCLASSES, categoryExpression, imageExpression,
} from './categories.js';

export const LANGUAGES = ['ru', 'tg', 'en'];

export const DEFAULTS = {
  lang: 'ru',
  // TileJSON-адрес, `pmtiles://…` или массив шаблонов `https://…/{z}/{x}/{y}.pbf`.
  tiles: 'https://tiles.openfreemap.org/planet',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  // Абсолютный адрес спрайта без расширения, например https://example.com/map/sprites/yoobi
  sprite: null,
  // Рельеф (AWS Terrain Tiles, формат terrarium). null — без рельефа.
  dem: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  hillshade: true,
  terrain: false, // число — объёмный рельеф с этим преувеличением, например 1.3
  buildings3d: true,
  poi: true,
  category: null, // id категории из CATEGORIES, чтобы показывать только её
};

export const COLORS = {
  land: '#F3F0EA',
  residential: '#EEEAE2',
  commercial: '#F1EAE3',
  industrial: '#EAE6E0',
  park: '#C6E6A3',
  grass: '#D3ECB8',
  wood: '#BFDFA0',
  farmland: '#EEF0D8',
  sand: '#F4ECD4',
  rock: '#E6E2DA',
  ice: '#FFFFFF',
  wetland: '#D9EDCF',
  pitch: '#BFE3A2',
  cemetery: '#DCE9CC',
  hospital: '#F9E7E6',
  school: '#F4EEDC',
  water: '#7CC8F2',
  building: '#E4DDD1',
  buildingOutline: '#D6CDBE',
  building3d: '#F7F3EC',
  roadCasing: '#E0D9CD',
  road: '#FFFFFF',
  primary: '#FFF7DC',
  primaryCasing: '#F2D27A',
  motorway: '#FFD970',
  motorwayCasing: '#E3B24A',
  path: '#FFFFFF',
  rail: '#C9C3B9',
  aeroway: '#E1DCD3',
  boundary: '#9C88B8',
  label: '#2E2E2E',
  roadLabel: '#3B3835',
  labelMuted: '#6F665C',
  country: '#6B5C85',
  halo: '#FFFFFF',
  waterLabel: '#2F7FB8',
  parkLabel: '#3B8A26',
  peak: '#7A5C3E',
  poiLabel: '#1E1E1E',
};

const FONT = {
  regular: ['Noto Sans Regular'],
  bold: ['Noto Sans Bold'],
  italic: ['Noto Sans Italic'],
};

const SOURCE = 'openmaptiles';

// Высота области под текст в картинке «таблетки» (см. scripts/sprite.mjs).
const PILL_CONTENT_HEIGHT = 18;

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
    ['бульвар ', 'бул. '], ['проезд ', 'пр. '], ['шоссе ', 'ш. ']],
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

function peakLabelExpression(lang) {
  return ['format',
    nameExpression(lang), {},
    ['case', ['has', 'ele'], ['concat', '\n', ['to-string', ['get', 'ele']], ' м'], ''], { 'font-scale': 0.85 }];
}

const TEXT_BUILDERS = { name: nameExpression, street: streetNameExpression, peak: peakLabelExpression };

// text-field для слоя с пометкой metadata['yoobi:text'] на нужном языке.
export function textFieldFor(kind, lang) {
  return TEXT_BUILDERS[kind](lang);
}

const hasName = ['all', ['has', 'name'], ['!=', ['get', 'name'], '']];

// Фильтр слоёв мест: kind 'main' — основные категории, 'minor' — прочее и
// мелочь вроде остановок (видны только вблизи), 'airport' — аэропорты.
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
  const filter = ['all', hasName,
    ['!', ['in', ['get', 'class'], ['literal', HIDDEN_CLASSES]]],
    kind === 'minor' ? minor : ['!', minor],
  ];
  if (category) filter.push(['==', cat, category]);
  return filter;
}

const zoomLinear = (...stops) => ['interpolate', ['linear'], ['zoom'], ...stops];
const zoomExp = (...stops) => ['interpolate', ['exponential', 1.5], ['zoom'], ...stops];

// ——— Дороги ———

// Ширина заливки по зумам: [зум, px, …]. Обводка шире на 1–2 px.
const WIDTH = {
  motorway: [5, 0.6, 9, 1.6, 12, 3, 14, 7, 16, 14, 18, 30],
  primary: [7, 0.5, 10, 1.2, 12, 2.4, 14, 6, 16, 12, 18, 26],
  secondary: [9, 0.4, 12, 1.4, 14, 4.5, 16, 9, 18, 20],
  minor: [12, 0.3, 14, 2.2, 16, 5.5, 18, 13],
  service: [14, 0.6, 16, 2.5, 18, 7],
  path: [14, 0.6, 16, 1.3, 18, 3],
};
const withCasing = (stops) => stops.map((v, i) => (i % 2 ? v + (stops[i - 1] >= 12 ? 2 : 1) : v));

function roadLayers(id, classes, width, color, casingColor, minzoom, tunnel) {
  const filter = ['all',
    ['in', ['get', 'class'], ['literal', classes]],
    tunnel ? ['==', ['get', 'brunnel'], 'tunnel'] : ['!=', ['get', 'brunnel'], 'tunnel'],
  ];
  const suffix = tunnel ? '-tunnel' : '';
  const opacity = tunnel ? 0.55 : 1;
  const base = { type: 'line', source: SOURCE, 'source-layer': 'transportation', minzoom, filter };
  return [
    {
      ...base,
      id: `${id}-casing${suffix}`,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': casingColor,
        'line-width': zoomExp(...withCasing(width)),
        'line-opacity': opacity,
        ...(tunnel && { 'line-dasharray': [1, 0.6] }),
      },
    },
    {
      ...base,
      id: `${id}${suffix}`,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color, 'line-width': zoomExp(...width), 'line-opacity': opacity },
    },
  ];
}

function roads(tunnel) {
  const C = COLORS;
  return [
    ...roadLayers('road-service', ['service', 'track'], WIDTH.service, C.road, C.roadCasing, 14, tunnel),
    ...roadLayers('road-minor', ['minor'], WIDTH.minor, C.road, C.roadCasing, 12, tunnel),
    ...roadLayers('road-secondary', ['secondary', 'tertiary'], WIDTH.secondary, C.road, C.roadCasing, 9, tunnel),
    ...roadLayers('road-primary', ['primary'], WIDTH.primary, C.primary, C.primaryCasing, 7, tunnel),
    ...roadLayers('road-motorway', ['motorway', 'trunk'], WIDTH.motorway, C.motorway, C.motorwayCasing, 5, tunnel),
  ];
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

  const sources = {
    [SOURCE]: Array.isArray(o.tiles)
      ? { type: 'vector', tiles: o.tiles, maxzoom: 14,
        attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a>' }
      : { type: 'vector', url: o.tiles },
  };
  const demSource = (maxzoom) => ({
    type: 'raster-dem',
    tiles: [o.dem],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom,
    attribution: '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank">Рельеф: Terrain Tiles</a>',
  });
  const hillshade = o.dem && o.hillshade;
  if (hillshade) sources.hillshade = demSource(12);
  if (o.dem && o.terrain) sources.terrain = demSource(12);

  const layers = [
    { id: 'background', type: 'background', paint: { 'background-color': C.land } },

    // ——— Земля: застройка, затем растительность, пески и ледники поверх неё ———
    {
      id: 'landuse',
      type: 'fill',
      source: SOURCE,
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', [
        'residential', 'suburb', 'neighbourhood', 'commercial', 'retail', 'industrial',
        'railway', 'cemetery', 'hospital', 'school', 'university', 'college', 'kindergarten',
        'stadium', 'pitch', 'playground', 'garages', 'military']]],
      paint: {
        'fill-color': ['match', ['get', 'class'],
          ['residential', 'suburb', 'neighbourhood'], C.residential,
          ['commercial', 'retail'], C.commercial,
          ['industrial', 'railway', 'garages', 'military'], C.industrial,
          'cemetery', C.cemetery,
          'hospital', C.hospital,
          ['school', 'university', 'college', 'kindergarten'], C.school,
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
        'fill-color': ['match', ['get', 'class'],
          'wood', C.wood,
          'grass', ['match', ['get', 'subclass'],
            ['park', 'garden', 'village_green', 'recreation_ground'], C.park, C.grass],
          'farmland', C.farmland,
          'sand', C.sand,
          'rock', C.rock,
          'ice', C.ice,
          'wetland', C.wetland,
          C.grass],
        'fill-opacity': ['match', ['get', 'class'], 'farmland', 0.7, 'rock', 0.8, 1],
        'fill-antialias': false,
      },
    },
    {
      id: 'park',
      type: 'fill',
      source: SOURCE,
      'source-layer': 'park',
      paint: { 'fill-color': C.park, 'fill-opacity': zoomLinear(6, 0.25, 12, 0.45) },
    },
    ...(hillshade ? [{
      id: 'hillshade',
      type: 'hillshade',
      source: 'hillshade',
      maxzoom: 16,
      metadata: { 'yoobi:group': 'hillshade' },
      paint: {
        'hillshade-exaggeration': zoomLinear(5, 0.45, 10, 0.3, 14, 0.12, 16, 0),
        'hillshade-shadow-color': '#A89C88',
        'hillshade-highlight-color': '#FFFFFF',
        'hillshade-accent-color': '#C9BFAE',
      },
    }] : []),

    // ——— Вода ———
    {
      id: 'water',
      type: 'fill',
      source: SOURCE,
      'source-layer': 'water',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      paint: { 'fill-color': C.water },
    },
    {
      id: 'waterway',
      type: 'line',
      source: SOURCE,
      'source-layer': 'waterway',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': C.water,
        'line-width': zoomExp(
          8, ['match', ['get', 'class'], 'river', 0.8, 0.2],
          12, ['match', ['get', 'class'], 'river', 2, 0.5],
          14, ['match', ['get', 'class'], 'river', 5, 1.5],
          18, ['match', ['get', 'class'], 'river', 16, 5]),
      },
    },

    // ——— Аэропорты ———
    {
      id: 'aeroway',
      type: 'line',
      source: SOURCE,
      'source-layer': 'aeroway',
      minzoom: 11,
      filter: ['in', ['get', 'class'], ['literal', ['runway', 'taxiway']]],
      paint: {
        'line-color': C.aeroway,
        'line-width': zoomExp(
          11, ['match', ['get', 'class'], 'runway', 3, 0.5],
          16, ['match', ['get', 'class'], 'runway', 50, 12]),
      },
    },

    // ——— Дороги ———
    ...roads(true),
    {
      id: 'path',
      type: 'line',
      source: SOURCE,
      'source-layer': 'transportation',
      minzoom: 14,
      filter: ['all', ['==', ['get', 'class'], 'path'], ['!=', ['get', 'brunnel'], 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.path, 'line-width': zoomExp(...WIDTH.path), 'line-opacity': 0.95 },
    },
    {
      id: 'railway',
      type: 'line',
      source: SOURCE,
      'source-layer': 'transportation',
      minzoom: 9,
      filter: ['all', ['in', ['get', 'class'], ['literal', ['rail', 'transit']]], ['!=', ['get', 'brunnel'], 'tunnel']],
      paint: { 'line-color': C.rail, 'line-width': zoomExp(9, 0.6, 14, 1.8, 18, 3.5) },
    },
    {
      id: 'railway-dash',
      type: 'line',
      source: SOURCE,
      'source-layer': 'transportation',
      minzoom: 13,
      filter: ['all', ['in', ['get', 'class'], ['literal', ['rail', 'transit']]], ['!=', ['get', 'brunnel'], 'tunnel']],
      paint: { 'line-color': '#FFFFFF', 'line-width': zoomExp(13, 0.6, 18, 2), 'line-dasharray': [3, 3] },
    },
    ...roads(false),

    // ——— Здания ———
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
        'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6],
          0, C.building3d, 40, '#F1ECE3', 120, '#E6E0D6'],
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.95,
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
      minzoom: 12,
      filter: ['all', hasName, ['==', ['get', 'class'], 'river']],
      metadata: text('name'),
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 400,
        'text-field': name,
        'text-font': FONT.italic,
        'text-size': zoomLinear(12, 11, 16, 13),
        'text-letter-spacing': 0.1,
      },
      paint: { 'text-color': C.waterLabel, 'text-halo-color': 'rgba(255,255,255,0.8)', 'text-halo-width': 1.2 },
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
      paint: { 'text-color': C.waterLabel, 'text-halo-color': 'rgba(255,255,255,0.8)', 'text-halo-width': 1.2 },
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
        'symbol-spacing': 320,
        'text-field': streetNameExpression(o.lang),
        'text-font': FONT.regular,
        'text-size': zoomLinear(
          13, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 11, 10],
          17, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], 14.5, 13]),
        'text-max-angle': 30,
        'text-padding': 4,
      },
      paint: { 'text-color': C.roadLabel, 'text-halo-color': C.halo, 'text-halo-width': 1.6 },
    },
    {
      id: 'housenumber',
      type: 'symbol',
      source: SOURCE,
      'source-layer': 'housenumber',
      minzoom: 17,
      layout: {
        'text-field': ['to-string', ['get', 'housenumber']],
        'text-font': FONT.regular,
        'text-size': 10,
        'text-padding': 3,
      },
      paint: { 'text-color': '#9B9083', 'text-halo-color': C.land, 'text-halo-width': 1 },
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
      paint: { 'text-color': C.peak, 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.2 },
    },
    {
      id: 'park-label',
      type: 'symbol',
      source: SOURCE,
      'source-layer': 'poi',
      minzoom: 14,
      filter: ['all', hasName, ['==', ['get', 'class'], 'park']],
      metadata: text('name'),
      layout: {
        'text-field': name,
        'text-font': FONT.bold,
        'text-size': zoomLinear(14, 12, 18, 15),
        'text-max-width': 8,
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
      },
      paint: { 'text-color': C.parkLabel, 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.6 },
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
    {
      id: 'place-town',
      type: 'symbol',
      source: SOURCE,
      'source-layer': 'place',
      minzoom: 6,
      maxzoom: 15,
      filter: ['==', ['get', 'class'], 'town'],
      metadata: text('name'),
      layout: {
        'text-field': name,
        'text-font': FONT.bold,
        'text-size': zoomLinear(6, 10, 12, 15),
        'text-max-width': 8,
      },
      paint: { 'text-color': C.label, 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.5 },
    },
    {
      id: 'place-city',
      type: 'symbol',
      source: SOURCE,
      'source-layer': 'place',
      minzoom: 4,
      maxzoom: 14,
      filter: ['==', ['get', 'class'], 'city'],
      metadata: text('name'),
      layout: {
        'text-field': name,
        'text-font': FONT.bold,
        'text-size': zoomLinear(
          4, ['case', ['==', ['get', 'capital'], 2], 13, 11],
          10, ['case', ['==', ['get', 'capital'], 2], 22, 17]),
        'text-max-width': 8,
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
      },
      paint: { 'text-color': '#1F1F1F', 'text-halo-color': 'rgba(255,255,255,0.95)', 'text-halo-width': 1.8 },
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
  ];

  return {
    version: 8,
    name: 'Yoobi Light',
    sources,
    sprite: o.sprite,
    glyphs: o.glyphs,
    light: { anchor: 'viewport', color: '#ffffff', intensity: 0.32, position: [1.2, 200, 35] },
    ...(o.dem && o.terrain && { terrain: { source: 'terrain', exaggeration: Number(o.terrain) || 1 } }),
    layers,
  };
}

// ——— Места: цветной значок + название в белой «таблетке» ———
function poiLayers(o) {
  const name = nameExpression(o.lang);
  const base = { type: 'symbol', source: SOURCE, 'source-layer': 'poi' };
  // Строка текста занимает 1.2 × size по высоте; отступы добирают её до высоты
  // области content в спрайте (PILL_CONTENT_HEIGHT), чтобы картинка не тянулась.
  // Круг значка стоит на 19 px левее текста — сдвигаем текст, чтобы круг был в точке.
  const pill = (size) => {
    const v = Math.round(((PILL_CONTENT_HEIGHT - 1.2 * size) / 2) * 100) / 100;
    return {
      'icon-image': imageExpression('pill'),
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [v, 3, v, 3],
      'text-field': name,
      'text-font': FONT.regular,
      'text-size': size,
      'text-line-height': 1.2,
      'text-anchor': 'left',
      'text-offset': [19 / size, 0],
      'text-max-width': 40,
      'text-padding': 2,
      'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
    };
  };
  const paint = { 'text-color': COLORS.poiLabel };
  return [
    {
      ...base,
      id: 'poi-icon',
      minzoom: 14,
      maxzoom: 15.5,
      filter: poiFilter('main', o.category),
      metadata: { 'yoobi:poi': 'main', 'yoobi:group': 'poi' },
      layout: {
        'icon-image': imageExpression('poi'),
        'icon-padding': 1,
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
      },
    },
    {
      ...base,
      id: 'poi-minor',
      minzoom: 17,
      filter: poiFilter('minor', o.category),
      metadata: { 'yoobi:poi': 'minor', 'yoobi:group': 'poi', 'yoobi:text': 'name' },
      layout: pill(11.5),
      paint,
    },
    {
      ...base,
      id: 'poi-label',
      minzoom: 15.5,
      filter: poiFilter('main', o.category),
      metadata: { 'yoobi:poi': 'main', 'yoobi:group': 'poi', 'yoobi:text': 'name' },
      layout: pill(12.5),
      paint,
    },
    {
      id: 'airport-label',
      type: 'symbol',
      source: SOURCE,
      'source-layer': 'aerodrome_label',
      minzoom: 10,
      filter: poiFilter('airport', o.category),
      metadata: { 'yoobi:poi': 'airport', 'yoobi:group': 'poi', 'yoobi:text': 'name' },
      layout: {
        ...pill(12.5),
        'icon-image': `pill-${AIRPORT.id}-${AIRPORT.icon}`,
        'symbol-sort-key': ['match', ['get', 'class'], 'international', 0, 1],
      },
      paint,
    },
  ];
}
