// Yoobi Map — стиль карты Таджикистана для MapLibre.
//
//   import * as maplibregl from 'maplibre-gl';
//   import { createStyle, mapOptions } from './map/src/index.js';
//   const map = new maplibregl.Map({ container: 'map', style: createStyle(), ...mapOptions() });
//
// Стиль и поиск не зависят от MapLibre и не трогают DOM: их можно подключить в любой
// проект (чистый JS, React, Vue, Svelte, Angular) или собрать из стиля style.json
// для мобильных приложений (scripts/build.mjs). DOM нужен только готовым элементам
// интерфейса: enableSearchPanel (ui.js), enableLockedCountries (locked.js) и
// enableReports (reports.js) — сообщения курьеров и жителей об изменениях на месте.

import { buildStyle, poiFilter, businessFilter, textFieldFor, LANGUAGES, THEMES } from './style.js';
import { CATEGORY_BY_ID, OTHER, categoryFor } from './categories.js';
import { TAJIKISTAN_BOUNDS, DUSHANBE_VIEW } from './tajikistan.js';
import { OBJECTS_3D_LAYER } from './objects3d.js';

export {
  buildStyle, DEFAULTS, COLORS, NIGHT_COLORS, THEMES, LANGUAGES, nameExpression, streetNameExpression,
  riverNameExpression, poiFilter,
} from './style.js';
export {
  CATEGORIES, CATEGORY_BY_ID, OTHER, AIRPORT, SUBCLASS_RU, LANDMARK_CATEGORIES, categoryFor, iconFor,
} from './categories.js';
export { TAJIKISTAN_BOUNDS, DUSHANBE_VIEW, COUNTRY_VIEW, CITIES, REGIONS } from './tajikistan.js';
export { enableLockedCountries } from './locked.js';
export { createSearch, loadSearch, normalize } from './search.js';
export { enableSearchPanel, prettyHours } from './ui.js';
export { OUTSIDE_MASK, NEIGHBORS } from './borders.js';
export { enableObjects3D, supportsObjects3D, OBJECTS_3D_LAYER } from './objects3d.js';
export { enableRoofLabels, ROOF_LABELS_LAYER } from './roof-labels.js';
export { enableReports, memoryReports, reportsToGeoJSON } from './reports.js';

// Адрес спрайта рядом с пакетом: <папка пакета>/sprites/yoobi.
export function defaultSpriteUrl() {
  return new URL('../sprites/yoobi', import.meta.url).href;
}

/**
 * Готовый объект стиля для `new maplibregl.Map({ style })`.
 * Опции — см. DEFAULTS в style.js: lang, theme ('light' | 'dark'), tiles, extraTiles, glyphs,
 * sprite, dem, hillshade, terrain, buildings3d, trees, trees3d, locked, clipped, poi, category.
 * trees3d: true — кроны и купола рисует объёмный слой: включите его enableObjects3D(map).
 */
export function createStyle(options = {}) {
  return buildStyle({ sprite: defaultSpriteUrl(), ...options });
}

/**
 * Рекомендуемые настройки карты: границы Таджикистана, стартовый вид и
 * ограничения, которые снижают нагрузку на слабых устройствах.
 */
export function mapOptions(overrides = {}) {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return {
    ...DUSHANBE_VIEW,
    maxBounds: TAJIKISTAN_BOUNDS,
    minZoom: 4, // на телефоне вся страна помещается примерно на 4,3 зуме
    maxZoom: 19,
    maxPitch: 70,
    // На экранах 3x рисуем в 2x: картинка почти та же, а пикселей вдвое меньше.
    pixelRatio: Math.min(dpr, 2),
    fadeDuration: 150,
    // Тайлы соседних масштабов держатся в памяти: приближение и отдаление — мгновенно.
    maxTileCacheZoomLevels: 6,
    refreshExpiredTiles: false,
    cancelPendingTileRequestsWhileZooming: true,
    attributionControl: { compact: true },
    ...overrides,
  };
}

function layersWithMeta(map, key) {
  return (map.getStyle()?.layers || []).filter((l) => l.metadata?.[key] !== undefined);
}

/** Сменить язык подписей: 'ru' | 'tg' | 'en'. */
export function setLanguage(map, lang) {
  if (!LANGUAGES.includes(lang)) throw new Error(`Неизвестный язык: ${lang}`);
  for (const layer of layersWithMeta(map, 'yoobi:text')) {
    map.setLayoutProperty(layer.id, 'text-field', textFieldFor(layer.metadata['yoobi:text'], lang));
  }
}

/** Показать места только одной категории (id из CATEGORIES) или все — null. */
export function setPoiCategory(map, category = null) {
  if (category && !CATEGORY_BY_ID[category]) throw new Error(`Неизвестная категория: ${category}`);
  for (const layer of layersWithMeta(map, 'yoobi:poi')) {
    map.setFilter(layer.id, poiFilter(layer.metadata['yoobi:poi'], category));
  }
  for (const layer of layersWithMeta(map, 'yoobi:business')) {
    map.setFilter(layer.id, businessFilter(layer.metadata['yoobi:business'], category));
  }
}

/**
 * Сменить тему: 'light' (день) или 'dark' (ночь). Стиль пересобирается с теми же
 * опциями, что были у createStyle; MapLibre применяет только разницу, тайлы не перекачиваются.
 * Слои и источники, добавленные приложением поверх стиля (маршруты, выделение), сохраняются.
 * Контейнер карты получает data-yoobi-theme — по нему панели и сообщения берут свои цвета.
 */
export function setTheme(map, theme, options = {}) {
  if (!THEMES.includes(theme)) throw new Error(`Неизвестная тема: ${theme}`);
  map.getContainer().dataset.yoobiTheme = theme;
  map.setStyle(createStyle({ ...options, theme }), {
    diff: true,
    transformStyle: (previous, next) => {
      if (!previous) return next;
      const ids = new Set(next.layers.map((l) => l.id));
      const sources = { ...next.sources };
      for (const [id, source] of Object.entries(previous.sources)) if (!(id in sources)) sources[id] = source;
      return { ...next, sources, layers: [...next.layers, ...previous.layers.filter((l) => !ids.has(l.id))] };
    },
  });
}

/**
 * Включить/выключить группу слоёв: '3d' (здания), 'poi' (места), 'hillshade' (рельеф),
 * 'trees' (деревья), 'entrances' (подъезды), 'details' (переходы, заборы, парковки,
 * светофоры, лавочки), 'locked' (заморозка соседних стран).
 */
export function setGroupVisible(map, group, visible) {
  // Объёмный слой (enableObjects3D): деревья — группа 'trees', купола и минареты — '3d'.
  const objects = map.getLayer(OBJECTS_3D_LAYER)?.implementation;
  if (objects && group === 'trees') objects.setTrees(visible);
  if (objects && group === '3d') objects.setObjects(visible);
  for (const layer of layersWithMeta(map, 'yoobi:group')) {
    if (layer.metadata['yoobi:group'] === group) {
      map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
    }
  }
}

/** Id слоёв с местами — для обработчиков `map.on('click', POI_LAYERS, …)`. */
export const POI_LAYERS = ['poi-icon', 'poi-label', 'poi-landmark', 'poi-minor', 'park-label', 'airport-label',
  'business-main', 'business-minor'];

/**
 * Описание места из объекта карты (например, из события click по POI_LAYERS):
 * название на нужном языке, категория, тип и координаты.
 */
export function describeFeature(feature, lang = 'ru') {
  const p = feature.properties || {};
  const name = lang === 'en'
    ? p['name:en'] || p.name_en || p['name:latin'] || p.name
    : lang === 'tg' ? p['name:tg'] || p.name || p['name:ru'] : p['name:ru'] || p.name;
  const category = feature.sourceLayer === 'aerodrome_label'
    ? CATEGORY_BY_ID.airport
    : categoryFor(p.class, p.subclass) || OTHER;
  return {
    name,
    category,
    class: p.class,
    subclass: p.subclass,
    coordinates: feature.geometry?.type === 'Point' ? feature.geometry.coordinates : null,
  };
}
