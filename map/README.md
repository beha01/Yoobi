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
- городские мелочи вблизи: стрелки одностороннего движения, разметка, «зебры»,
  светофоры, мосты с тенью над дорогой, объёмные заборы и стены дворов, парковки со
  значком «P», ворота и шлагбаумы, лавочки, фонтаны, туалеты, питьевая вода,
  названия зданий;
- ночная тема — та же карта в тёмных тонах, переключается без перезагрузки тайлов;
- поиск без сервера: города, улицы, дома с номерами, организации и рубрики
  («аптеки», «дорухона», «pharmacy»), латиница и забытая раскладка; карточка места
  или дома по нажатию — адрес как в 2ГИС и Яндексе («улица Бободжана Гафурова, 46/2»),
  тип дома и этажность, «Открыто до 22:00», телефоны, сайт, организации в здании;
- организации из OSM и открытой базы Overture Maps: совпадающие места дополняются
  телефонами и сайтами, новые (~1000 по стране) видны на карте и в поиске;
- соседние страны под матовой «заморозкой» с замком; по нажатию — анимированное
  сообщение «страна пока недоступна»;
- издалека — рельеф гор, ледники, реки, города с точками, вершины с высотами, границы.

Подписи на русском, таджикском и английском.

Это стиль карты, поиск и небольшая готовая панель поиска с карточками — без
остального интерфейса приложения. Стиль и поиск переносятся в любой проект: сайт на
чистом JS, React/Vue/Svelte/Angular, Android, iOS, Flutter, React Native.

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

Демо — это полноэкранная карта с кнопкой «день/ночь» (`npm run serve` — то же самое);
на своих тайлах — ещё строка поиска и карточки мест.
Параметры задаются в адресе: `?lang=tg`, `?theme=dark`, `?category=food`, `?3d=0`, `?poi=0`,
`?trees=0`, `?relief=0`, `?terrain=1.3`, `?tiles=pmtiles://…`, `?extra=pmtiles://…` (подъезды,
деревья и городские детали, см. ниже), `?mask=…` (точный контур страны), `?search=…` (индекс
поиска; для своих тайлов берётся рядом с ними сам).

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
| `theme` | `'light'` | Тема: `'light'` (день) или `'dark'` (ночь); у ночной свой спрайт `…/yoobi-dark` |
| `tiles` | OpenFreeMap | TileJSON-адрес, `pmtiles://…` или массив шаблонов `…/{z}/{x}/{y}.pbf` |
| `extraTiles` | `null` | Дополнительные тайлы из OSM (`scripts/build-tiles.sh`): подъезды, деревья, «зебры», заборы, парковки, светофоры, названия зданий |
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
  setLanguage, setTheme, setPoiCategory, setGroupVisible, describeFeature, POI_LAYERS, enableLockedCountries,
  CATEGORIES, CITIES, COUNTRY_VIEW,
} from './map/src/index.js';

setLanguage(map, 'tg');                 // подписи на таджикском
setTheme(map, 'dark', styleOptions);    // ночь; styleOptions — те же опции, что у createStyle
setPoiCategory(map, 'pharmacy');        // только аптеки; null — все места
setGroupVisible(map, '3d', false);      // группы: '3d', 'poi', 'hillshade', 'trees', 'entrances',
                                        // 'details' (зебры, заборы, парковки, светофоры), 'locked'
enableLockedCountries(map, { lang: 'ru' });   // сообщение при нажатии на соседнюю страну

map.on('click', POI_LAYERS, (e) => {
  const place = describeFeature(e.features[0], 'ru');
  // { name, category: { id, label, color, icon }, class, subclass, coordinates }
});

map.flyTo(CITIES.find((c) => c.name === 'Худжанд'));   // быстрый переход к городу
map.jumpTo(COUNTRY_VIEW);                                // вся страна
```

Эти функции меняют только слои стиля. Собственные слои и маркеры проекта (маршруты,
курьеры, зоны доставки) они не затрагивают — `setTheme` тоже сохраняет их при смене темы.

Категории мест (`CATEGORIES`): рестораны и кафе, магазины, аптеки, гостиницы,
торговые центры, больницы, банки и банкоматы, АЗС, образование, культура,
госучреждения, мечети, транспорт (вокзалы, автостанции, остановки), аэропорты.
Русские названия типов мест лежат в `SUBCLASS_RU`.

## Поиск и карточки мест

`scripts/build-tiles.sh` кроме тайлов собирает `data/tajikistan-search.json` (~3 МБ,
~0,6 МБ в gzip): населённые пункты, улицы, ~19 тыс. домов с номерами и ~10 тыс.
организаций с типом, часами работы, телефоном и сайтом. Поиск идёт прямо в браузере
или приложении, без сервера и ключей, за миллисекунды:

```js
import { loadSearch, enableSearchPanel } from './map/src/index.js';

const search = await loadSearch('https://cdn.example.com/map/tajikistan-search.json');
search.search('рудаки 10', { center: [68.78, 38.57], lang: 'ru' });
// [{ title: 'Хиёбони Рӯдакӣ, 10', subtitle: 'Здание · Душанбе', kind: 'address', lon, lat, … }]
search.search('аптеки');       // рубрика: все аптеки, ближние первыми
search.search('Khujand');      // латиница → «Худжанд»; «leify,t» (забытая раскладка) → «Душанбе»
search.reverse(68.8017, 38.5625);                  // ближайший адрес
search.inside(buildingFeature.geometry);           // адрес и организации в здании
search.nearby(68.78, 38.57, { radius: 200 });      // что рядом

// Готовая панель: строка поиска с подсказками, карточка места или дома по нажатию,
// выделение дома, следует теме карты. На телефоне карточка — снизу экрана.
const panel = enableSearchPanel(map, search, { lang: 'ru' });
```

Запрос понимает русские и таджикские буквы вперемешку (ҳ, қ, ӯ можно набирать как
х, к, у), номера домов («айни 45», «18/1»), рубрики на трёх языках и названия с цифрами
(«школа 12»). Модуль `src/search.js` не зависит от MapLibre и DOM — его можно
использовать в своём интерфейсе или на сервере.

**Адреса — как в 2ГИС и Яндекс Картах.** В OSM Таджикистана улица в адресе обычно
записана по-таджикски («кӯчаи Бобоҷон Ғафуров»), а номер — как придётся («32\1»,
«46 / 2»). `scripts/places.py` сверяет улицу адреса с ближайшей улицей OSM того же
названия и берёт её русское имя, поэтому в карточке — «улица Бободжана Гафурова, 46/2»,
а ниже мелко — таджикское написание. Если русского имени у улицы нет, тип переводится
(кӯчаи → улица, хиёбони → проспект, гузаргоҳи → проезд), сокращения раскрываются
(«ул», «12 мкр» → «улица», «12-й микрорайон»). Номера приводятся к виду «46/2», «5а» —
и в поиске, и на домах на карте. У дома в карточке — тип («Жилой дом»), этажность,
индекс и квартиры, если они есть в OSM; если адреса у дома нет — ближайший адрес.

**Организации.** Кроме OSM используются места [Overture Maps](https://overturemaps.org)
(`scripts/overture.py` читает из открытого бакета только куски, покрывающие страну,
~50 МБ из 11 ГБ). Записи с низкой уверенностью и природные объекты отбрасываются; то же
название рядом с местом OSM — это то же место, и OSM дополняется телефонами, сайтом и
соцсетями; записи, которые Overture поставил в центр города, переносятся на свой дом по
адресу, а если дом не найден — остаются только в поиске с пометкой «расположение
приблизительное». Сборка без Overture: `OVERTURE=0 ./scripts/build-tiles.sh`.

**Часы работы.** Карточка считает по `opening_hours` и времени Таджикистана, открыто ли
место сейчас: «Открыто до 22:00», «Закрыто, откроется завтра в 09:00» (`openingStatus`
в `src/ui.js`).

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
(и `yoobi.json` — русский) и ночные `yoobi-dark-ru.json`, `yoobi-dark-tg.json`,
`yoobi-dark-en.json`. Выложите `styles/` и `sprites/` по этому адресу:

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
   ./scripts/build-tiles.sh        # → data/tajikistan.pmtiles, …-extra.pmtiles, …-search.json
   ```
   Скрипт скачивает свежую выгрузку OSM с Geofabrik (при каждом запуске — только если
   она обновилась; если HTTPS до Geofabrik закрыт, та же выгрузка берётся по HTTP с
   проверкой MD5; свой источник — `OSM_URL=…`) и собирает тайлы через
   [Planetiler](https://github.com/onthegomap/planetiler) 0.10.2 (версия закреплена).
   Получаются основные тайлы в схеме OpenMapTiles, дополнительные — объёмные
   деревья, подъезды и городские детали (`scripts/extras.py` + `tiles/extra.yml`),
   индекс поиска `data/tajikistan-search.json` и точный контур
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
3. **Выложите** `data/*.pmtiles`, `data/tajikistan-search.json`, `fonts/`, `sprites/` (и `styles/` для мобильных)
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

## Подъезды, номера домов, деревья, городские детали

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
- **Дороги вблизи**: стрелки одностороннего движения (с 16,5 зума), белая прерывистая
  разметка на крупных улицах (с 17), мосты над дорогами — с тенью, «зебры» переходов
  поперёк проезжей части (с 17): из линий `footway=crossing` и из точек
  `highway=crossing` — их ширину и направление считает `scripts/extras.py` по дороге.
- **Дворы и улицы** (с 15–17,5 зума): площадки парковок и значок «P», объёмные заборы,
  стены и живые изгороди, светофоры, ворота и шлагбаумы, лавочки, фонтаны, туалеты,
  питьевая вода, названия зданий без организаций (одно на комплекс).

Сколько подъездов и деревьев будет на карте, зависит от того, насколько подробно
район нанесён в OpenStreetMap.

## Данные и лицензии

- Картографические данные: © участники [OpenStreetMap](https://www.openstreetmap.org/copyright),
  лицензия ODbL. Подпись «© OpenStreetMap» обязательна; `mapOptions()` оставляет
  её в углу карты в компактном виде.
- Тайлы: [OpenFreeMap](https://openfreemap.org), схема [OpenMapTiles](https://openmaptiles.org).
- Организации Overture Maps: © Overture Maps Foundation, источники — Meta и Microsoft
  (CDLA-Permissive-2.0), Foursquare (Apache-2.0), AllThePlaces (CC0). Подпись есть в
  атрибуции дополнительных тайлов и в карточке места («Данные: Overture Maps»).
- Встроенный контур страны для «заморозки» (`src/borders.js`, `scripts/make-borders.mjs`) —
  из OpenStreetMap (© участники OpenStreetMap, ODbL), упрощён до ~300 м.
- Рельеф: [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (AWS Open Data).
- Шрифт Noto Sans — лицензия OFL. Значки нарисованы по мотивам Material Icons (Apache 2.0).
- Сам стиль — MIT.

**Актуальность.** Geofabrik обновляет выгрузку OSM каждый день, Overture — раз в месяц.
`build-tiles.sh` качает выгрузку, только если она изменилась; вся сборка — около
10 минут. Workflow `map-data` пересобирает карту каждую ночь и кладёт файлы в ветку
`map-data` (расписание работает из основной ветки репозитория). Исправления,
внесённые на openstreetmap.org, появляются на карте на следующий день.

**Почему не 2GIS и не Яндекс.** Базы 2GIS и Яндекса — их собственность: условия
использования запрещают копировать из них данные (адреса, дома, подъезды, организации),
а смешивать их с данными OSM не позволяет лицензия ODbL. Разрешение владельца проекта это не меняет — права на
данные у 2GIS. Если нужен именно их справочник, подключайте официальный API 2GIS
по ключу и показывайте его данные по их правилам, отдельно от этой карты. Номера
домов, подъезды, улицы, вокзалы и железные дороги здесь берутся из OSM; чего не
хватает — можно добавить на [openstreetmap.org](https://www.openstreetmap.org), и
после пересборки тайлов это появится на карте.

## Настройка внешнего вида

- Цвета — объекты `COLORS` (день) и `NIGHT_COLORS` (ночь) в `src/style.js`;
  `npm test` проверяет, что в обеих палитрах одни и те же цвета.
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
  src/search.js       поиск по индексу tajikistan-search.json (без сервера)
  src/ui.js           панель поиска и карточки мест для MapLibre GL JS, часы работы
  src/borders.js      контур страны и точки соседей (scripts/make-borders.mjs)
  scripts/extras.py   объёмные деревья, подъезды со стороной входа, городские детали,
                      индекс поиска, маска страны, выгрузка без подписей соседних стран
  scripts/places.py   адреса по-русски как в справочниках, слияние организаций с OSM
  scripts/overture.py организации Таджикистана из открытой базы Overture Maps
  tiles/extra.yml     схема дополнительных тайлов для Planetiler
  demo/index.html     полноэкранная демо-карта
```
