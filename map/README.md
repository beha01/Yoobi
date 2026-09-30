# Yoobi Map — стиль карты Таджикистана

Светлый «городской» стиль карты для [MapLibre](https://maplibre.org) на открытых данных
OpenStreetMap. Светлые кварталы, зелёные парки, голубая вода, белые улицы, объёмные
здания, рельеф гор, номера домов, железные дороги и места с цветными значками
в белых «таблетках». Подписи на русском, таджикском и английском.

Это только стиль карты, без интерфейса приложения. Его можно перенести в любой
проект: сайт на чистом JS, React/Vue/Svelte/Angular, Android, iOS, Flutter,
React Native.

- **Бесплатно.** Тайлы [OpenFreeMap](https://openfreemap.org) (без ключей и лимитов) или собственный файл.
- **Быстро.** Векторные тайлы, один спрайт на все значки, ограничение `pixelRatio` на экранах 3x.
- **Надёжно.** Всю карту Таджикистана можно держать на своём хостинге одним файлом PMTiles — без чужих серверов.
- **Совместимо.** Стиль использует только возможности, которые поддерживают и MapLibre GL JS, и MapLibre Native.
- **Проверено.** `npm test` прогоняет все варианты стиля через официальный валидатор MapLibre.

## Быстрый старт

```bash
cd map
npm run demo          # http://localhost:8080/demo/
```

Демо — это полноэкранная карта без лишнего интерфейса. Параметры задаются в адресе:
`?lang=tg`, `?category=food`, `?3d=0`, `?poi=0`, `?relief=0`, `?terrain=1.3`,
`?tiles=pmtiles://…`.

## Подключение в веб-проект

### Без сборщика (ES-модули)

Скопируйте папку `map/` (достаточно `src/` и `sprites/`) в проект:

```html
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.css">
<div id="map" style="height: 100vh"></div>
<script type="module">
  import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
  import { createStyle, mapOptions } from './map/src/index.js';

  const map = new maplibregl.Map({
    container: 'map',
    style: createStyle({ lang: 'ru' }),
    ...mapOptions(),            // границы Таджикистана, вид на Душанбе, настройки скорости
  });
</script>
```

Адрес спрайта вычисляется автоматически, относительно `src/index.js`.

### Со сборщиком (Vite, webpack, Next.js и т.п.)

Сборщик не копирует спрайты сам, поэтому положите `map/sprites/` в публичную папку
(например, `public/map/sprites/`) и передайте адрес явно:

```jsx
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createStyle, mapOptions } from './map/src/index.js';

export function TajikMap() {
  const ref = useRef(null);
  useEffect(() => {
    const map = new maplibregl.Map({
      container: ref.current,
      style: createStyle({ sprite: `${location.origin}/map/sprites/yoobi` }),
      ...mapOptions(),
    });
    return () => map.remove();
  }, []);
  return <div ref={ref} style={{ width: '100%', height: '100vh' }} />;
}
```

### Опции `createStyle`

| Опция | По умолчанию | Что делает |
|---|---|---|
| `lang` | `'ru'` | Язык подписей: `'ru'`, `'tg'`, `'en'` (если перевода нет, берётся местное название) |
| `tiles` | OpenFreeMap | TileJSON-адрес, `pmtiles://…` или массив шаблонов `…/{z}/{x}/{y}.pbf` |
| `glyphs` | шрифты OpenFreeMap | Адрес шрифтов `…/{fontstack}/{range}.pbf` |
| `sprite` | рядом с пакетом | Абсолютный адрес спрайта без расширения |
| `dem` | AWS Terrain Tiles | Источник высот для рельефа; `null` — без рельефа |
| `hillshade` | `true` | Отмывка рельефа (горы на мелких масштабах) |
| `terrain` | `false` | Объёмные горы; число — коэффициент высоты, например `1.3` |
| `buildings3d` | `true` | Объёмные здания с 14,5 зума |
| `poi` | `true` | Места со значками |
| `category` | `null` | Показывать места только одной категории |

### Управление картой

```js
import {
  setLanguage, setPoiCategory, setGroupVisible, describeFeature, POI_LAYERS,
  CATEGORIES, CITIES, COUNTRY_VIEW,
} from './map/src/index.js';

setLanguage(map, 'tg');                 // подписи на таджикском
setPoiCategory(map, 'pharmacy');        // только аптеки; null — все места
setGroupVisible(map, '3d', false);      // группы: '3d', 'poi', 'hillshade'

map.on('click', POI_LAYERS, (e) => {
  const place = describeFeature(e.features[0], 'ru');
  // { name, category: { id, label, color, icon }, class, subclass, coordinates }
});

map.flyTo(CITIES.find((c) => c.name === 'Худжанд'));   // быстрый переход к городу
map.jumpTo(COUNTRY_VIEW);                                // вся страна
```

Эти функции меняют только слои стиля. Собственные слои и маркеры проекта (маршруты,
курьеры, зоны доставки) они не затрагивают.

Категории мест (`CATEGORIES`): рестораны и кафе, магазины, аптеки, гостиницы,
торговые центры, больницы, банки и банкоматы, АЗС, образование, культура,
госучреждения, мечети, транспорт (вокзалы, автостанции, остановки), аэропорты.
Русские названия типов мест лежат в `SUBCLASS_RU`.

## Мобильные приложения и другие платформы

MapLibre Native (Android, iOS), Flutter (`maplibre_gl`) и React Native
(`@maplibre/maplibre-react-native`) принимают стиль по адресу. Соберите готовые
`style.json` под свой домен:

```bash
cd map
npm install
npm run build -- --base-url=https://cdn.example.com/map/
```

В папке `styles/` появятся `yoobi-ru.json`, `yoobi-tg.json`, `yoobi-en.json`
(и `yoobi.json` — русский). Выложите `styles/` и `sprites/` по этому адресу:

```kotlin
// Android
mapView.getMapAsync { map -> map.setStyle("https://cdn.example.com/map/styles/yoobi-ru.json") }
```
```swift
// iOS
let mapView = MLNMapView(frame: view.bounds, styleURL: URL(string: "https://cdn.example.com/map/styles/yoobi-ru.json"))
```
```dart
// Flutter
MapLibreMap(styleString: 'https://cdn.example.com/map/styles/yoobi-ru.json', initialCameraPosition: ...)
```

Файлы в `styles/` из репозитория собраны для локального демо (`http://localhost:8080/`).
Перед публикацией пересоберите их со своим `--base-url`.

## Надёжность и скорость: всё на своём сервере

По умолчанию тайлы и шрифты берутся с бесплатного OpenFreeMap. Для рабочего
проекта надёжнее раздавать всё самим: карта не зависит от чужих серверов и не
упирается в их лимиты.

1. **Тайлы Таджикистана одним файлом** (нужен Docker):
   ```bash
   ./scripts/build-tiles.sh        # → data/tajikistan.pmtiles
   ```
   Скрипт скачивает свежую выгрузку OSM с Geofabrik и собирает тайлы через
   [Planetiler](https://github.com/onthegomap/planetiler) в схеме OpenMapTiles.
   В тайлы попадают только названия на русском, таджикском и английском, поэтому
   файл меньше. Пересобирайте раз в неделю или месяц, чтобы данные были свежими.
2. **Шрифты:**
   ```bash
   ./scripts/download-fonts.sh     # → fonts/
   ```
3. **Выложите** `data/tajikistan.pmtiles`, `fonts/`, `sprites/` (и `styles/` для мобильных)
   на любой статический хостинг или CDN с поддержкой HTTP Range: nginx, S3,
   Cloudflare R2. Отдельный тайловый сервер не нужен: браузер сам читает нужные
   куски файла.
4. **Подключите:**
   ```js
   import { Protocol } from 'pmtiles';
   maplibregl.addProtocol('pmtiles', new Protocol({ metadata: true }).tile);

   createStyle({
     tiles: 'pmtiles://https://cdn.example.com/map/tajikistan.pmtiles',
     glyphs: 'https://cdn.example.com/map/fonts/{fontstack}/{range}.pbf',
     sprite: 'https://cdn.example.com/map/sprites/yoobi',
   });
   ```
   Для мобильных те же адреса передаются в сборку:
   `npm run build -- --base-url=… --tiles=pmtiles://… --glyphs=…`.
   Свежие версии MapLibre Native (Android, iOS) читают `pmtiles://` напрямую.
   Если ваша версия не умеет, раздавайте тот же файл как `{z}/{x}/{y}.pbf`
   через `pmtiles serve` ([go-pmtiles](https://github.com/protomaps/go-pmtiles))
   и передайте в `--tiles` адрес его TileJSON.

Пример настройки nginx:

```nginx
location /map/ {
    add_header Access-Control-Allow-Origin *;
    add_header Cache-Control "public, max-age=86400";
    gzip on;
    gzip_types application/json application/x-protobuf;
}
location = /map/tajikistan.pmtiles {
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Headers Range;
    add_header Access-Control-Expose-Headers "Content-Length, Content-Range, ETag";
    add_header Cache-Control "public, max-age=86400";
}
```

Что ещё снижает нагрузку:

- `mapOptions()` ограничивает `pixelRatio` двумя: на экранах 3x картинка почти та
  же, а пикселей в 2,25 раза меньше.
- Для самых слабых устройств отключите тяжёлое: `createStyle({ buildings3d: false, hillshade: false })`.
- Места (POI) показываются с 14 зума, объёмные здания — с 14,5. На мелких
  масштабах карта остаётся лёгкой.

## Данные и лицензии

- Картографические данные: © участники [OpenStreetMap](https://www.openstreetmap.org/copyright),
  лицензия ODbL. Подпись «© OpenStreetMap» обязательна; `mapOptions()` оставляет
  её в углу карты в компактном виде.
- Тайлы: [OpenFreeMap](https://openfreemap.org), схема [OpenMapTiles](https://openmaptiles.org).
- Рельеф: [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (AWS Open Data).
- Шрифт Noto Sans — лицензия OFL. Значки нарисованы по мотивам Material Icons (Apache 2.0).
- Сам стиль — MIT.

**Почему не 2GIS.** Данные 2GIS закрытые: копировать их запрещают условия
использования, а смешивать с данными OSM нельзя из-за лицензии ODbL. Если нужны
именно их адреса и справочник, используйте официальный платный API 2GIS по ключу
отдельно от этой карты. Номера домов, улицы, вокзалы и железные дороги в стиле уже
есть из OSM. Если чего-то не хватает, добавьте это на
[openstreetmap.org](https://www.openstreetmap.org): после обновления тайлов
изменения появятся на карте.

## Настройка внешнего вида

- Цвета — объект `COLORS` в `src/style.js`.
- Категории, цвета значков и соответствие классам OSM — `src/categories.js`.
- Рисунки значков (SVG) — `ICONS` в `src/categories.js` и `scripts/sprite.mjs`.

После изменений выполните `npm run build`, затем `npm test`.

## Структура

```
map/
  src/index.js        публичный API: createStyle, mapOptions, setLanguage, …
  src/style.js        слои и цвета стиля
  src/categories.js   категории мест и значки
  src/tajikistan.js   границы страны, города, стартовые виды
  sprites/            спрайт значков (1x и 2x), собирается из src
  styles/             готовые style.json для мобильных, собираются из src
  scripts/            сборка, проверка, демо-сервер, тайлы, шрифты
  demo/index.html     полноэкранная демо-карта
```
