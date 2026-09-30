// Yoobi Map — стиль карты Таджикистана для MapLibre.
//
//   import * as maplibregl from 'maplibre-gl';
//   import { createStyle, mapOptions } from './map/src/index.js';
//   const map = new maplibregl.Map({ container: 'map', style: createStyle(), ...mapOptions() });
//
// Модуль не зависит от MapLibre и не трогает DOM: его можно подключить в любой
// проект (чистый JS, React, Vue, Svelte, Angular) или собрать из него style.json
// для мобильных приложений (scripts/build.mjs).

import { buildStyle, poiFilter, textFieldFor, LANGUAGES } from './style.js';
import { CATEGORY_BY_ID, OTHER, categoryFor } from './categories.js';
import { TAJIKISTAN_BOUNDS, DUSHANBE_VIEW } from './tajikistan.js';

export {
  buildStyle, DEFAULTS, COLORS, LANGUAGES, nameExpression, streetNameExpression, riverNameExpression, poiFilter,
} from './style.js';
export {
  CATEGORIES, CATEGORY_BY_ID, OTHER, AIRPORT, SUBCLASS_RU, LANDMARK_CATEGORIES, categoryFor, iconFor,
} from './categories.js';
export { TAJIKISTAN_BOUNDS, DUSHANBE_VIEW, COUNTRY_VIEW, CITIES, REGIONS } from './tajikistan.js';
export { enableLockedCountries } from './locked.js';
export { OUTSIDE_MASK, NEIGHBORS } from './borders.js';

// Адрес спрайта рядом с пакетом: <папка пакета>/sprites/yoobi.
export function defaultSpriteUrl() {
  return new URL('../sprites/yoobi', import.meta.url).href;
}

/**
 * Готовый объект стиля для `new maplibregl.Map({ style })`.
 * Опции — см. DEFAULTS в style.js: lang, tiles, extraTiles, glyphs, sprite, dem,
 * hillshade, terrain, buildings3d, trees, locked, clipped, poi, category.
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
}

/**
 * Включить/выключить группу слоёв: '3d' (здания), 'poi' (места), 'hillshade' (рельеф),
 * 'trees' (деревья), 'entrances' (подъезды), 'locked' (заморозка соседних стран).
 */
export function setGroupVisible(map, group, visible) {
  for (const layer of layersWithMeta(map, 'yoobi:group')) {
    if (layer.metadata['yoobi:group'] === group) {
      map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
    }
  }
}

/** Id слоёв с местами — для обработчиков `map.on('click', POI_LAYERS, …)`. */
export const POI_LAYERS = ['poi-icon', 'poi-label', 'poi-landmark', 'poi-minor', 'park-label', 'airport-label'];

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
