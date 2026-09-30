// Поиск без сервера: населённые пункты, улицы, дома и организации Таджикистана.
//
//   import { loadSearch } from './map/src/search.js';
//   const search = await loadSearch('https://cdn.example.com/map/tajikistan-search.json');
//   search.search('рудаки 10', { center: map.getCenter().toArray(), lang: 'ru' });
//   search.reverse(68.78, 38.57);            // ближайший адрес
//   search.inside(building.geometry);        // организации в здании
//
// Индекс (tajikistan-search.json) собирает scripts/extras.py из той же выгрузки OSM,
// что и тайлы. Запрос понимает русский и таджикский (ҳ, қ, ӯ… можно набирать как
// х, к, у), латиницу («Dushanbe», «Khujand», «rudaki») и забытую раскладку («leifyt»).
// Модуль не зависит от MapLibre и DOM.

import { CATEGORY_BY_ID, AIRPORT, SUBCLASS_RU } from './categories.js';

// ——— Нормализация ———

// ё, й, ӣ, ӯ и ударения снимаются разложением на букву и знак; остальные буквы — по таблице.
const LETTERS = { ҳ: 'х', қ: 'к', ғ: 'г', ҷ: 'ч', ъ: '', ь: '' };

/** Строка для сравнения: нижний регистр, без ударений, таджикские буквы — как русские. */
export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ҳқғҷъь]/g, (c) => LETTERS[c]);
}

function tokenize(s) {
  return normalize(s).match(/[\p{L}\p{N}]+(?:\/[\p{L}\p{N}]+)*/gu) || [];
}

// Слова, которые не отличают один объект от другого: «улица», «кӯчаи», «проспект»…
const STOP = new Set([
  'улица', 'ул', 'проспект', 'пр', 'просп', 'переулок', 'пер', 'проезд', 'тупик', 'бульвар', 'шоссе',
  'площадь', 'пл', 'микрорайон', 'мкр', 'кӯчаи', 'хиёбони', 'гузаргоҳи', 'шоҳроҳи', 'майдони', 'бунбасти',
  'танкӯчаи', 'маъбари', 'street', 'st', 'avenue', 'ave', 'road', 'rd', 'lane',
  'город', 'г', 'шаҳри', 'шаҳр', 'село', 'деҳа', 'кишлак', 'посёлок', 'пгт', 'дом', 'д', 'хонаи',
].map(normalize));

const DISTRICT = new Set(['мкр', 'мкрн', 'микрорайон'].map(normalize));

// Рубрики: «аптеки», «дорухона», «pharmacy» находят аптеки, даже если слова нет в названии.
const RUBRICS = {
  food: 'еда кафе ресторан столовая чайхана ошхона қаҳвахона тарабхона restaurant cafe food',
  shop: 'магазин мағоза маркет shop store',
  pharmacy: 'аптека дорухона pharmacy',
  hotel: 'гостиница отель хостел меҳмонхона hotel hostel',
  mall: 'тц торговый центр рынок базар бозор mall market',
  health: 'больница клиника поликлиника врач стоматология беморхона дармонгоҳ hospital clinic doctor',
  bank: 'банк банкомат обмен бонк bank atm',
  fuel: 'азс заправка бензин fuel gas petrol',
  edu: 'школа детский сад университет колледж библиотека мактаб донишгоҳ боғча school university',
  culture: 'музей театр кино кинотеатр памятник стадион осорхона museum theatre cinema',
  gov: 'министерство хукумат полиция почта суд посольство вазорат police post embassy',
  worship: 'мечеть храм церковь масҷид mosque church',
  transport: 'вокзал автовокзал станция остановка истгоҳ автобус маршрутка троллейбус трамвай station bus stop',
  airport: 'аэропорт фурудгоҳ airport',
};

// Латиница → кириллица: «Khujand» → «хучанд» (как таджикское «Хуҷанд»).
const TRANSLIT = [
  ['shch', 'щ'], ['sh', 'ш'], ['ch', 'ч'], ['zh', 'ж'], ['kh', 'х'], ['ts', 'ц'], ['yo', 'е'], ['yu', 'ю'],
  ['ya', 'я'], ['ye', 'е'], ['gh', 'г'], ['dzh', 'ч'], ['dj', 'ч'], ['j', 'ч'], ['a', 'а'], ['b', 'б'],
  ['v', 'в'], ['w', 'в'], ['g', 'г'], ['d', 'д'], ['e', 'е'], ['z', 'з'], ['i', 'и'], ['y', 'и'], ['k', 'к'],
  ['q', 'к'], ['c', 'к'], ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'], ['r', 'р'], ['s', 'с'],
  ['t', 'т'], ['u', 'у'], ['f', 'ф'], ['h', 'х'], ['x', 'х'],
];
function translit(s) {
  let out = '';
  for (let i = 0; i < s.length;) {
    const hit = TRANSLIT.find(([lat]) => s.startsWith(lat, i));
    if (hit) { out += hit[1]; i += hit[0].length; } else { out += s[i]; i++; }
  }
  return out;
}

// Набрали по-русски в английской раскладке: «leifyt» → «душанбе».
const QWERTY = 'qwertyuiop[]asdfghjkl;\'zxcvbnm,.`';
const JCUKEN = 'йцукенгшщзхъфывапролджэячсмитьбюё';
function relayout(s) {
  return [...s].map((c) => { const i = QWERTY.indexOf(c); return i < 0 ? c : JCUKEN[i]; }).join('');
}

// ——— Подписи ———

const PLACE_LABEL = {
  ru: { city: 'Город', town: 'Город', village: 'Село', hamlet: 'Кишлак', suburb: 'Район', quarter: 'Квартал', neighbourhood: 'Микрорайон' },
  tg: { city: 'Шаҳр', town: 'Шаҳрак', village: 'Деҳа', hamlet: 'Деҳа', suburb: 'Ноҳия', quarter: 'Маҳалла', neighbourhood: 'Маҳалла' },
  en: { city: 'City', town: 'Town', village: 'Village', hamlet: 'Hamlet', suburb: 'District', quarter: 'Quarter', neighbourhood: 'Neighbourhood' },
};
const KIND_LABEL = {
  ru: { street: 'Улица', address: 'Здание' },
  tg: { street: 'Кӯча', address: 'Бино' },
  en: { street: 'Street', address: 'Building' },
};

// Тип здания (building=* в OSM) — для карточки дома, как «Жилой дом · 9 этажей» в 2ГИС.
export const BUILDING_RU = {
  apartments: 'Жилой дом', residential: 'Жилой дом', dormitory: 'Общежитие', house: 'Частный дом',
  detached: 'Частный дом', semidetached_house: 'Частный дом', terrace: 'Жилой дом', bungalow: 'Частный дом',
  commercial: 'Коммерческое здание', retail: 'Торговое здание', office: 'Офисное здание', kiosk: 'Киоск',
  supermarket: 'Супермаркет', industrial: 'Производственное здание', warehouse: 'Склад', garage: 'Гараж',
  garages: 'Гаражи', service: 'Техническое здание', school: 'Школа', kindergarten: 'Детский сад',
  university: 'Университет', college: 'Колледж', hospital: 'Больница', clinic: 'Поликлиника',
  mosque: 'Мечеть', church: 'Церковь', cathedral: 'Собор', synagogue: 'Синагога', religious: 'Религиозное здание',
  hotel: 'Гостиница', government: 'Госучреждение', public: 'Общественное здание', civic: 'Общественное здание',
  train_station: 'Вокзал', transportation: 'Транспортное здание', stadium: 'Стадион', sports_hall: 'Спортзал',
  sports_centre: 'Спортивный центр', construction: 'Строящееся здание', ruins: 'Руины', farm: 'Сельский дом',
  barn: 'Хозпостройка', shed: 'Хозпостройка', roof: 'Навес', yes: 'Здание',
};
const BUILDING_OTHER = {
  tg: { apartments: 'Бинои истиқоматӣ', house: 'Хонаи шахсӣ', yes: 'Бино' },
  en: { apartments: 'Apartment building', house: 'House', yes: 'Building' },
};

const human = (s) => (s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, ' ') : '');

// Маршруты на остановке: «Автобус 1, 4 · Троллейбус 2».
const ROUTE_LABEL = {
  ru: { bus: 'Автобус', trolleybus: 'Троллейбус', minibus: 'Маршрутка', tram: 'Трамвай' },
  tg: { bus: 'Автобус', trolleybus: 'Троллейбус', minibus: 'Маршрутка', tram: 'Трамвай' },
  en: { bus: 'Bus', trolleybus: 'Trolleybus', minibus: 'Minibus', tram: 'Tram' },
};
const ENTRANCE_LABEL = { ru: 'Подъезд', tg: 'Даромадгоҳ', en: 'Entrance' };

/** Номера маршрутов остановки одной строкой на нужном языке. */
export function formatRoutes(routes, lang = 'ru') {
  const labels = ROUTE_LABEL[lang] || ROUTE_LABEL.ru;
  return Object.entries(routes || {}).map(([kind, refs]) => `${labels[kind] || kind} ${refs.join(', ')}`).join(' · ');
}

// Тип места, когда точного (SUBCLASS_RU) нет: в единственном числе, а не как название рубрики.
const CATEGORY_ONE = {
  food: 'Кафе, ресторан', shop: 'Магазин', pharmacy: 'Аптека', hotel: 'Гостиница', mall: 'Торговый центр',
  health: 'Медицина', bank: 'Банк', fuel: 'АЗС', edu: 'Образование', culture: 'Культура и досуг',
  gov: 'Госучреждение', worship: 'Место поклонения', transport: 'Транспорт', airport: 'Аэропорт',
};

// Базовый вес: крупное находится раньше мелкого при равном совпадении.
const KIND_WEIGHT = { street: 30, poi: 28, address: 26 };
const PLACE_WEIGHT = { city: 60, town: 50, village: 36, hamlet: 26, suburb: 34, quarter: 30, neighbourhood: 30 };

const R = 6371008.8;
function distance(lon1, lat1, lon2, lat2) {
  const k = Math.PI / 180;
  const x = (lon2 - lon1) * k * Math.cos(((lat1 + lat2) / 2) * k);
  const y = (lat2 - lat1) * k;
  return Math.hypot(x, y) * R;
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(x, y, polygon) {
  return pointInRing(x, y, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(x, y, hole));
}

const CELL = 0.005; // ~500 м: сетка для «что рядом»

/**
 * Индекс поиска из данных tajikistan-search.json (версии 1 и 2).
 */
export function createSearch(data) {
  const f = Object.fromEntries(data.fields.map((name, i) => [name, i]));
  const places = data.places || [];
  const items = data.items.map((row, id) => ({
    id,
    name: row[f.name],
    name_tg: row[f.name_tg] || '',
    name_en: row[f.name_en] || '',
    kind: row[f.kind],
    category: row[f.category] || '',
    type: f.type === undefined ? '' : row[f.type] || '',
    lon: row[f.lon],
    lat: row[f.lat],
    place: row[f.place] >= 0 ? places[row[f.place]] || '' : '',
    info: (f.info !== undefined && row[f.info]) || null,
  }));
  // Места Overture без точного адреса стоят в центре города: ищутся, но не «рядом» и не «в здании».
  const approx = (it) => it.info?.approx === 1;

  // Токены → объекты; отсортированные словари для поиска по началу слова:
  // слова названий и слова рубрик (тип места), у рубрик вес ниже.
  const names = new Map();
  const rubrics = new Map();
  const add = (map, word, id) => {
    let list = map.get(word);
    if (!list) map.set(word, (list = []));
    if (list[list.length - 1] !== id) list.push(id);
  };
  const houses = new Array(items.length);
  const rubricWords = {};
  for (const [cat, words] of Object.entries(RUBRICS)) {
    const label = (cat === 'airport' ? AIRPORT : CATEGORY_BY_ID[cat])?.label || '';
    rubricWords[cat] = [...new Set(tokenize(`${words} ${label}`).filter((w) => w.length > 2))];
  }
  for (const it of items) {
    const words = new Set();
    for (const s of [it.name, it.name_tg, it.name_en]) for (const t of tokenize(s)) words.add(t);
    if (it.kind === 'address') {
      const m = it.name.match(/,\s*([^,]+)$/);
      houses[it.id] = m ? normalize(m[1]).replace(/\s+/g, '') : '';
    }
    it.norm = normalize(it.name);
    if (it.kind === 'entrance') continue; // подъезды — только для карточки дома, не для поиска по словам
    for (const w of words) if (!STOP.has(w)) add(names, w, it.id);
    if (it.kind === 'poi') {
      const typed = tokenize(SUBCLASS_RU[it.type] || '').filter((w) => w.length > 2);
      for (const w of [...typed, ...(rubricWords[it.category] || [])]) if (!words.has(w)) add(rubrics, w, it.id);
    }
    // Номера маршрутов остановки: «автобус 4» находит остановки, где он ходит.
    if (it.info?.routes) {
      it.refs = Object.values(it.info.routes).flat().map(normalize);
      for (const kind of Object.keys(it.info.routes)) {
        for (const w of tokenize(`${ROUTE_LABEL.ru[kind] || ''} ${ROUTE_LABEL.en[kind] || ''}`)) add(rubrics, w, it.id);
      }
    }
  }
  const nameDict = [...names.keys()].sort();
  const rubricDict = [...rubrics.keys()].sort();

  const grid = new Map();
  for (const it of items) {
    if (approx(it)) continue;
    const key = `${Math.floor(it.lon / CELL)}:${Math.floor(it.lat / CELL)}`;
    let cell = grid.get(key);
    if (!cell) grid.set(key, (cell = []));
    cell.push(it);
  }

  function lowerBound(dict, prefix) {
    let lo = 0;
    let hi = dict.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (dict[mid] < prefix) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  function scan(dict, map, prefix, weight, out) {
    for (let i = lowerBound(dict, prefix); i < dict.length && dict[i].startsWith(prefix); i++) {
      const quality = weight * (dict[i].length === prefix.length ? 1 : prefix.length / dict[i].length);
      for (const id of map.get(dict[i])) if (!(out.get(id) >= quality)) out.set(id, quality);
    }
  }

  // Все объекты со словом, начинающимся с prefix, и точность совпадения (0…1) для каждого.
  // Рубрики сравниваются без окончания: «аптеки» → «аптек…», «рестораны» → «ресторан…».
  function matches(prefix) {
    const out = new Map();
    scan(nameDict, names, prefix, 1, out);
    const stem = prefix.length > 4 ? prefix.replace(/[аяыиеоу]+$/, '') : prefix;
    scan(rubricDict, rubrics, stem, 0.55, out);
    return out;
  }

  function run(text, center, penalty, withNumbers = true) {
    const all = tokenize(text);
    let tokens = all.filter((t) => !STOP.has(t));
    if (!tokens.length) tokens = all;
    if (!tokens.length) return [];
    // «12 мкр», «мкр 8»: число — название микрорайона, а не номер дома.
    const district = all.some((t) => DISTRICT.has(t));
    const numbers = withNumbers && !district ? tokens.filter((t) => /^\d/.test(t)) : [];
    const words = district ? tokens : tokens.filter((t) => !/^\d/.test(t));
    const whole = normalize(text).trim();

    // Слова ищем в словаре; номер дома — отдельно: в адресах он хранится целиком («18/1», «5а»).
    const sets = words.map(matches).sort((a, b) => a.size - b.size);
    let ids;
    if (sets.length) {
      ids = [...sets[0].keys()].filter((id) => sets.every((s) => s.has(id)));
    } else {
      ids = matches(numbers[0]);
      ids = [...ids.keys()];
    }
    if (!ids.length && !words.length) return [];
    const results = [];
    for (const id of ids) {
      const it = items[id];
      let score = it.kind === 'place' ? PLACE_WEIGHT[it.category] || 28 : KIND_WEIGHT[it.kind] || 20;
      for (const s of sets) score += 6 + 8 * s.get(id);
      if (numbers.length) {
        if (it.kind !== 'address') {
          // Цифры могут быть частью названия («Школа № 12») или номером маршрута на остановке.
          const own = it.refs ? tokenize(it.name).concat(it.refs) : tokenize(it.name);
          if (!numbers.every((n) => own.some((t) => t === n || t.startsWith(n)))) continue;
          if (it.refs && numbers.every((n) => it.refs.includes(n))) score += 20; // номер — это маршрут
        } else {
          const house = houses[id];
          const n = numbers.join('/');
          if (house === n) score += 30;
          else if (house.startsWith(n)) score += 14;
          else continue;
        }
      } else if (it.kind === 'address') score -= 12; // без номера дома улица важнее отдельных домов
      if (approx(it)) score -= 8;
      if (it.norm === whole) score += 25;
      else if (it.norm.startsWith(whole)) score += 12;
      if (center) {
        const km = distance(center[0], center[1], it.lon, it.lat) / 1000;
        const big = it.kind === 'place' && (it.category === 'city' || it.category === 'town');
        score -= Math.min(30, (big ? 3 : 9) * Math.log10(1 + km));
      }
      results.push({ it, score: score - penalty });
    }
    // Такого дома нет — покажем хотя бы улицу или населённый пункт без номера.
    if (!results.length && numbers.length && words.length) {
      return run(text, center, penalty + 10, false).filter((r) => r.it.kind === 'street' || r.it.kind === 'place');
    }
    return results;
  }

  function title(it, lang) {
    if (it.kind === 'entrance') return [ENTRANCE_LABEL[lang] || ENTRANCE_LABEL.ru, it.name].filter(Boolean).join(' ');
    if (lang === 'tg') return it.name_tg || it.name;
    if (lang === 'en') return it.name_en || it.name;
    return it.name;
  }

  function typeLabel(it, lang) {
    if (it.kind === 'place') return PLACE_LABEL[lang][it.category] || PLACE_LABEL[lang].village;
    if (it.kind === 'entrance') return it.info?.fl ? `кв. ${it.info.fl}` : '';
    if (it.kind === 'address' && it.type) {
      const other = BUILDING_OTHER[lang];
      return (other ? other[it.type] || other.yes : BUILDING_RU[it.type]) || KIND_LABEL[lang].address;
    }
    if (it.kind !== 'poi') return KIND_LABEL[lang][it.kind];
    if (lang === 'en') return human(it.type) || human(it.category);
    return SUBCLASS_RU[it.type] || CATEGORY_ONE[it.category] || 'Организация';
  }

  function present(it, lang, center) {
    // Адрес места — если в нём есть номер дома; «Согдийская область» вместо адреса — это не адрес.
    // У остановки вместо адреса — номера маршрутов.
    const where = it.info?.routes ? formatRoutes(it.info.routes, lang)
      : it.kind === 'poi' && /\d/.test(it.info?.addr || '') ? it.info.addr : it.place;
    const self = it.kind === 'place' && where === it.name;
    return {
      id: it.id,
      // Адрес — как в 2ГИС и Яндексе: «улица Бободжана Гафурова, 46/2» (тип улицы с маленькой буквы).
      title: title(it, lang),
      // Второе написание: таджикское для русского интерфейса и наоборот («кӯчаи Бобоҷон Ғафуров, 46/2»).
      alt: lang === 'tg' ? (it.name_tg ? it.name : '') : it.name_tg,
      type: typeLabel(it, lang),
      subtitle: [typeLabel(it, lang), self ? '' : where].filter(Boolean).join(' · '),
      kind: it.kind,
      category: it.category,
      osmType: it.type,
      place: it.place,
      lon: it.lon,
      lat: it.lat,
      info: it.info,
      approx: approx(it),
      source: it.info?.src === 'overture' ? 'Overture Maps' : 'OpenStreetMap',
      distance: center ? distance(center[0], center[1], it.lon, it.lat) : null,
    };
  }

  function near(lon, lat, radius, test) {
    const out = [];
    const dx = Math.ceil(radius / (CELL * 111320 * Math.cos((lat * Math.PI) / 180))) + 0;
    const dy = Math.ceil(radius / (CELL * 110574));
    const cx = Math.floor(lon / CELL);
    const cy = Math.floor(lat / CELL);
    for (let i = cx - dx; i <= cx + dx; i++) {
      for (let j = cy - dy; j <= cy + dy; j++) {
        for (const it of grid.get(`${i}:${j}`) || []) {
          const d = distance(lon, lat, it.lon, it.lat);
          if (d <= radius && (!test || test(it))) out.push([d, it]);
        }
      }
    }
    return out.sort((a, b) => a[0] - b[0]);
  }

  return {
    size: items.length,

    /**
     * Найти по строке. center — [lon, lat] для ранжирования по близости,
     * kinds — ограничить видами ('place', 'street', 'address', 'poi').
     */
    search(query, { center = null, limit = 10, lang = 'ru', kinds = null } = {}) {
      const text = String(query || '').trim();
      if (!text) return [];
      const variants = [[text, 0]];
      const low = text.toLowerCase();
      if (/[a-z]/.test(low)) {
        variants.push([translit(low), 4]);
        if (/^[a-z\s\d[\];',.`]+$/.test(low)) variants.push([relayout(low), 6]);
      }
      const best = new Map();
      for (const [variant, penalty] of variants) {
        for (const r of run(variant, center, penalty)) {
          if (kinds && !kinds.includes(r.it.kind)) continue;
          const prev = best.get(r.it.id);
          if (!prev || prev.score < r.score) best.set(r.it.id, r);
        }
      }
      // Одинаковые названия в одном месте (сеть аптек на одной улице) — по одной строке.
      const seen = new Set();
      const out = [];
      for (const { it } of [...best.values()].sort((a, b) => b.score - a.score)) {
        const key = `${it.kind}|${it.name}|${Math.round(it.lon * 200)}|${Math.round(it.lat * 200)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(present(it, lang, center));
        if (out.length >= limit) break;
      }
      return out;
    },

    /** Запись по id (из результата поиска) — например, чтобы показать её на другом языке. */
    get(id, { lang = 'ru' } = {}) {
      return items[id] ? present(items[id], lang) : null;
    },

    /** Ближайший адрес к точке (по умолчанию не дальше 60 м) или null. */
    reverse(lon, lat, { radius = 60, lang = 'ru' } = {}) {
      const hit = near(lon, lat, radius, (it) => it.kind === 'address')[0];
      return hit ? present(hit[1], lang) : null;
    },

    /** Что рядом с точкой: организации и адреса в радиусе, ближние — первыми. */
    nearby(lon, lat, { radius = 150, lang = 'ru', kinds = ['poi'], limit = 20 } = {}) {
      return near(lon, lat, radius, (it) => kinds.includes(it.kind)).slice(0, limit)
        .map(([, it]) => present(it, lang, [lon, lat]));
    },

    /**
     * Адрес и организации внутри здания. geometry — GeoJSON Polygon или MultiPolygon
     * (например, feature.geometry слоя building); точки у самой стены (до margin м) тоже считаются.
     */
    inside(geometry, { lang = 'ru', margin = 6 } = {}) {
      const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
      const ring = polygons.flatMap((p) => p[0]);
      const lons = ring.map((p) => p[0]);
      const lats = ring.map((p) => p[1]);
      const lon = (Math.min(...lons) + Math.max(...lons)) / 2;
      const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const radius = distance(Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)) / 2 + margin;
      const edge = (it) => polygons.some((p) => p[0].some(([x, y], i, r) => {
        const [x2, y2] = r[(i + 1) % r.length];
        return segmentDistance(it.lon, it.lat, x, y, x2, y2) <= margin;
      }));
      const hits = near(lon, lat, radius, (it) => (it.kind === 'poi' || it.kind === 'address' || it.kind === 'entrance')
        && (polygons.some((p) => inPolygon(it.lon, it.lat, p)) || edge(it)));
      const address = hits.find(([, it]) => it.kind === 'address');
      const number = (it) => parseInt(it.name, 10) || 999;
      return {
        address: address ? present(address[1], lang) : null,
        places: hits.filter(([, it]) => it.kind === 'poi').map(([, it]) => present(it, lang)),
        // Подъезды по порядку номеров, как в 2ГИС: «Подъезд 1 · кв. 1–36».
        entrances: hits.filter(([, it]) => it.kind === 'entrance').map(([, it]) => it)
          .sort((a, b) => number(a) - number(b)).map((it) => present(it, lang)),
      };
    },
  };
}

// Расстояние в метрах от точки до отрезка (плоское приближение — для зданий хватает).
function segmentDistance(px, py, ax, ay, bx, by) {
  const k = Math.cos((py * Math.PI) / 180) * 111320;
  const m = 110574;
  const [x, y, x1, y1, x2, y2] = [px * k, py * m, ax * k, ay * m, bx * k, by * m];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = dx || dy ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

/** Загрузить индекс по адресу (tajikistan-search.json) и построить поиск. */
export async function loadSearch(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Поиск: ${url} — ${response.status}`);
  return createSearch(await response.json());
}
