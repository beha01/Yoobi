# Yoobi Map — стиль карты Таджикистана

Стиль карты всего Таджикистана для [MapLibre](https://maplibre.org) на открытых
данных OpenStreetMap — в духе «живого» 3D-города:

- вблизи: серый асфальт с белыми бордюрами и светлыми тротуарами, объёмные деревья
  вдоль улиц и в парках, светлые объёмные дома с тенями у основания и цветом фасадов
  из OSM, яркая вода;
- места — цветной значок в белой «таблетке» (кафе, магазины, аптеки, гостиницы…),
  знаковые здания — значок над домом и подпись в плашке, парки — зелёная плашка;
- номера домов; подъезды — значок двери, номер, квартиры и стрелка, показывающая,
  с какой стороны дома вход; вокзалы, остановки, аэропорты;
- соседние страны под матовой «заморозкой» с замком; по нажатию — анимированное
  сообщение «страна пока недоступна»;
- издалека — рельеф гор, ледники, реки, города с точками, вершины с высотами, границы.

Подписи на русском, таджикском и английском.

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

Демо — это полноэкранная карта без лишнего интерфейса (`npm run serve` — то же самое).
Параметры задаются в адресе: `?lang=tg`, `?category=food`, `?3d=0`, `?poi=0`, `?trees=0`,
`?relief=0`, `?terrain=1.3`, `?tiles=pmtiles://…`, `?extra=pmtiles://…` (подъезды и деревья,
см. ниже), `?mask=…` (точный контур страны).

Карта на своих тайлах всей страны (после `./scripts/build-tiles.sh`):

```
http://localhost:8080/demo/?tiles=pmtiles://http://localhost:8080/data/tajikistan.pmtiles&extra=pmtiles://http://localhost:8080/data/tajikistan-extra.pmtiles&mask=http://localhost:8080/data/tajikistan-mask.geojson
```

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
| `extraTiles` | `null` | Дополнительные тайлы с подъездами и деревьями из OSM (`scripts/build-tiles.sh`) |
| `glyphs` | шрифты OpenFreeMap | Адрес шрифтов `…/{fontstack}/{range}.pbf` |
| `sprite` | рядом с пакетом | Абсолютный адрес спрайта без расширения |
| `dem` | AWS Terrain Tiles | Источник высот для рельефа; `null` — без рельефа |
| `hillshade` | `true` | Отмывка рельефа (горы на мелких масштабах) |
| `terrain` | `false` | Объёмные горы; число — коэффициент высоты, например `1.3` |
| `buildings3d` | `true` | Объёмные здания с 14,5 зума |
| `trees` | `true` | Объёмные деревья (с 15 зума, нужны `extraTiles`) и текстура лесов |
| `locked` | `true` | «Заморозка» соседних стран; строка — адрес точного контура GeoJSON |
| `clipped` | `null` | Тайлы из `scripts/build-tiles.sh`: подписей соседних стран в них нет, поэтому подписи Таджикистана рисуются поверх «заморозки» и не обрезаются у границы; `null` — да, если заданы `extraTiles` |
| `poi` | `true` | Места со значками |
| `category` | `null` | Показывать места только одной категории |

### Управление картой

```js
import {
  setLanguage, setPoiCategory, setGroupVisible, describeFeature, POI_LAYERS, enableLockedCountries,
  CATEGORIES, CITIES, COUNTRY_VIEW,
} from './map/src/index.js';

setLanguage(map, 'tg');                 // подписи на таджикском
setPoiCategory(map, 'pharmacy');        // только аптеки; null — все места
setGroupVisible(map, '3d', false);      // группы: '3d', 'poi', 'hillshade', 'trees', 'entrances', 'locked'
enableLockedCountries(map, { lang: 'ru' });   // сообщение при нажатии на соседнюю страну

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

1. **Тайлы Таджикистана** (нужна Java 21+ или Docker и Python 3 — pyosmium
   ставится сам в `data/.venv`):
   ```bash
   ./scripts/build-tiles.sh        # → data/tajikistan.pmtiles, data/tajikistan-extra.pmtiles
   ```
   Скрипт скачивает свежую выгрузку OSM с Geofabrik (при каждом запуске — только если
   она обновилась; если HTTPS до Geofabrik закрыт, та же выгрузка берётся по HTTP с
   проверкой MD5; свой источник — `OSM_URL=…`) и собирает тайлы через
   [Planetiler](https://github.com/onthegomap/planetiler) 0.10.2 (версия закреплена).
   Получаются основные тайлы в схеме OpenMapTiles, дополнительные — объёмные
   деревья и подъезды (`scripts/extras.py` + `tiles/extra.yml`) и точный контур
   страны `data/tajikistan-mask.geojson` для «заморозки» соседей
   (`createStyle({ locked: 'https://…/tajikistan-mask.geojson' })`). Основные тайлы
   собираются из копии выгрузки без подписей соседних стран: названия, адреса и
   места за границей убраны, а дороги, дома и реки остались под «заморозкой». Поэтому
   подписи у границы (Исфара, Хорог, Истаравшан) не обрезаются. В подписи попадают только
   русский, таджикский и английский, а мировые полигоны океана (~850 МБ) не скачиваются —
   у Таджикистана нет моря. Вся страна: основные тайлы ~80 МБ, дополнительные ~50 МБ,
   сборка ~7 минут. Пересобирайте раз в неделю или месяц, чтобы данные были свежими.
2. **Шрифты:**
   ```bash
   ./scripts/download-fonts.sh     # → fonts/
   ```
3. **Выложите** `data/*.pmtiles`, `fonts/`, `sprites/` (и `styles/` для мобильных)
   на любой статический хостинг или CDN с поддержкой HTTP Range: nginx, S3,
   Cloudflare R2. Отдельный тайловый сервер не нужен: браузер сам читает нужные
   куски файла.
4. **Подключите:**
   ```js
   import { Protocol } from 'pmtiles';
   maplibregl.addProtocol('pmtiles', new Protocol({ metadata: true }).tile);

   createStyle({
     tiles: 'pmtiles://https://cdn.example.com/map/tajikistan.pmtiles',
     extraTiles: 'pmtiles://https://cdn.example.com/map/tajikistan-extra.pmtiles',
     glyphs: 'https://cdn.example.com/map/fonts/{fontstack}/{range}.pbf',
     sprite: 'https://cdn.example.com/map/sprites/yoobi',
   });
   ```
   Для мобильных те же адреса передаются в сборку:
   `npm run build -- --base-url=… --tiles=pmtiles://… --extra-tiles=pmtiles://… --glyphs=… --mask=…`.
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
location ~ ^/map/.*\.pmtiles$ {
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Headers Range;
    add_header Access-Control-Expose-Headers "Content-Length, Content-Range, ETag";
    add_header Cache-Control "public, max-age=86400";
}
```

Что ещё снижает нагрузку:

- `mapOptions()` ограничивает `pixelRatio` двумя: на экранах 3x картинка почти та
  же, а пикселей в 2,25 раза меньше.
- Для самых слабых устройств отключите тяжёлое: `createStyle({ buildings3d: false, hillshade: false, trees: false })`.
- Места (POI) показываются с 14 зума, объёмные здания — с 14,5, деревья и тротуары —
  с 15. На мелких масштабах карта остаётся лёгкой.
- Деревья — лёгкие объёмные фигуры в отдельных тайлах, которые грузятся только
  вблизи (с 15 зума) и только для видимого участка.
- Тайлы соседних масштабов держатся в памяти, поэтому приближение и отдаление
  проходят мгновенно, без повторной загрузки.

## Подъезды, номера домов, деревья

- **Номера домов** есть в основных тайлах и видны с 16,5 зума.
- **Подъезды** (`entrance=*` в OSM) видны с 17 зума: значок двери и номер (`ref`),
  с 18 — ещё номера квартир (`addr:flats`). Перед дверью — стрелка, повёрнутая к
  стене дома: сразу видно, с какой стороны вход и где первый подъезд. Угол стены
  считает `scripts/extras.py` по контуру здания.
- **Деревья** — объёмные: ствол и круглая крона из нескольких ярусов, дома правильно
  их заслоняют. Только там, где деревья есть в OSM: отдельные деревья и аллеи
  (`natural=tree`, `natural=tree_row`) — все, леса и рощи (`landuse=forest`, `natural=wood`)
  и сады (`landuse=orchard`, ровными рядами) — у городов, посёлков и сёл, не в домах,
  не на дорогах и не в воде. Чтобы тайлы оставались лёгкими, на тайл 15-го зума
  (~1 км²) приходится не больше 1000 деревьев: большие леса и сады засаживаются реже,
  но равномерно; дальние горные леса — только текстурой. Трава, сады и виноградники —
  своими цветами по разметке OSM. Декоративные посадки вдоль улиц и в парках можно
  включить флагом `--decor` у `scripts/extras.py` (в тайлах они помечены `decor=yes`).
- **Здания** — это реальные контуры и этажность из OSM, поэтому у каждого дома своя
  форма. Если в OSM указан цвет фасада (`building:colour`), он используется.

Сколько подъездов и деревьев будет на карте, зависит от того, насколько подробно
район нанесён в OpenStreetMap.

## Данные и лицензии

- Картографические данные: © участники [OpenStreetMap](https://www.openstreetmap.org/copyright),
  лицензия ODbL. Подпись «© OpenStreetMap» обязательна; `mapOptions()` оставляет
  её в углу карты в компактном виде.
- Тайлы: [OpenFreeMap](https://openfreemap.org), схема [OpenMapTiles](https://openmaptiles.org).
- Встроенный контур страны для «заморозки» (`src/borders.js`, `scripts/make-borders.mjs`) —
  из OpenStreetMap (© участники OpenStreetMap, ODbL), упрощён до ~300 м.
- Рельеф: [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (AWS Open Data).
- Шрифт Noto Sans — лицензия OFL. Значки нарисованы по мотивам Material Icons (Apache 2.0).
- Сам стиль — MIT.

**Почему не 2GIS.** База 2GIS — их собственность: условия использования запрещают
копировать из неё данные (адреса, дома, подъезды), а смешивать её с данными OSM
не позволяет лицензия ODbL. Разрешение владельца проекта это не меняет — права на
данные у 2GIS. Если нужен именно их справочник, подключайте официальный API 2GIS
по ключу и показывайте его данные по их правилам, отдельно от этой карты. Номера
домов, подъезды, улицы, вокзалы и железные дороги здесь берутся из OSM; чего не
хватает — можно добавить на [openstreetmap.org](https://www.openstreetmap.org), и
после пересборки тайлов это появится на карте.

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
  src/locked.js       сообщение при нажатии на соседнюю страну
  src/borders.js      контур страны и точки соседей (scripts/make-borders.mjs)
  scripts/extras.py   объёмные деревья, подъезды со стороной входа, маска страны,
                      выгрузка без подписей соседних стран
  tiles/extra.yml     схема дополнительных тайлов для Planetiler
  demo/index.html     полноэкранная демо-карта
```
