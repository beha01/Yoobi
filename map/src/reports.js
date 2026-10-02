// Сообщения об изменениях на карте — как «Сообщить об ошибке» в городских справочниках.
// Курьер или житель отмечает то, что видит сам, а в открытых данных этого ещё нет: новое
// место или здание, номер дома, подъезд, новый мост или дорогу, стройку, закрывшееся
// заведение. Сообщение сразу видно всем на карте (оранжевая метка «не проверено»), а
// сборка (scripts/reports.py) вносит проверенные сообщения в данные.
//
//   import { enableReports, memoryReports } from './map/src/index.js';
//   const reports = enableReports(map, { store: memoryReports(), lang: 'ru', search });
//   enableSearchPanel(map, search, { lang, onReport: (ctx) => reports.report(ctx) });
//
// Добавить: долгое нажатие на карту (на компьютере — правая кнопка) или кнопка «+» справа.
// store — где хранятся сообщения, любое хранилище проекта (REST, Firebase, база артефакта):
//   { subscribe(onChange, onError) → отписка, add(report) → Promise, remove(id) → Promise,
//     writable?() → Promise<boolean|null> }
// onChange получает массив сообщений; у своих — mine: true (их можно удалить).

const TEXT = {
  ru: {
    add: 'Добавить на карту', title: 'Что здесь изменилось?', close: 'Закрыть', send: 'Отправить', cancel: 'Отмена',
    done: 'Готово', back: 'Назад', remove: 'Удалить сообщение', removed: 'Сообщение удалено',
    kinds: {
      place: 'Новое место или организация', building: 'Новое здание', house: 'Номер дома', entrance: 'Подъезд',
      road: 'Мост или дорога', construction: 'Стройка', closed: 'Закрылось, больше не работает',
      rename: 'Другое название', moved: 'Находится в другом месте', demolished: 'Здание снесено', other: 'Другое',
    },
    name: 'Название', category: 'Что это', comment: 'Комментарий', commentHint: 'Что видно на месте',
    number: 'Номер дома', numberHint: 'Например, 12/1', street: 'Улица', levels: 'Этажей', entranceNo: 'Номер подъезда',
    flats: 'Квартиры', flatsHint: 'Например, 1–36', newName: 'Новое название', roadKind: 'Что это',
    roads: { bridge: 'Автомобильный мост', footbridge: 'Пешеходный мост', road: 'Дорога', footway: 'Пешеходная дорожка' },
    draw: 'Нажимайте на карту вдоль моста или дороги — от начала до конца',
    pick: 'Нажмите на карте, где это место теперь', tapToMove: 'Нажмите на карту, чтобы поправить точку',
    thanks: 'Спасибо! Сообщение видно всем на карте и попадёт в данные после проверки',
    saveFailed: 'Не получилось сохранить: нужен доступ к карте с правом вносить данные',
    required: 'Заполните отмеченные поля', unverified: 'не проверено', yours: 'ваше', at: 'Отмечено',
    noAccess: 'Сообщать об изменениях могут те, кому владелец карты дал право вносить данные',
    about: 'Про', points: (n) => `точек: ${n}`,
    cats: [
      ['amenity=restaurant', 'Ресторан, кафе'], ['amenity=fast_food', 'Фастфуд, еда навынос'],
      ['shop=supermarket', 'Продукты, супермаркет'], ['shop=yes', 'Другой магазин'], ['amenity=pharmacy', 'Аптека'],
      ['amenity=clinic', 'Клиника, больница'], ['amenity=bank', 'Банк, банкомат'], ['office=government', 'Госучреждение'],
      ['office=company', 'Офис компании'], ['amenity=school', 'Школа'], ['amenity=kindergarten', 'Детский сад'],
      ['amenity=university', 'Вуз, колледж'], ['tourism=hotel', 'Гостиница'], ['amenity=fuel', 'АЗС'],
      ['amenity=place_of_worship', 'Мечеть'], ['leisure=sports_centre', 'Спорт'], ['craft=yes', 'Мастерская, услуги'],
      ['', 'Другое'],
    ],
  },
  tg: {
    add: 'Ба харита илова кардан', title: 'Дар ин ҷо чӣ тағйир ёфт?', close: 'Пӯшидан', send: 'Фиристодан',
    cancel: 'Бекор кардан', done: 'Тайёр', back: 'Бозгашт', remove: 'Нест кардани хабар', removed: 'Хабар нест карда шуд',
    kinds: {
      place: 'Макон ё ташкилоти нав', building: 'Бинои нав', house: 'Рақами хона', entrance: 'Даромадгоҳ',
      road: 'Пул ё роҳ', construction: 'Сохтмон', closed: 'Баста шуд, дигар кор намекунад', rename: 'Номи дигар',
      moved: 'Дар ҷои дигар аст', demolished: 'Бино вайрон карда шуд', other: 'Дигар',
    },
    name: 'Ном', category: 'Ин чист', comment: 'Шарҳ', commentHint: 'Дар ҷой чӣ дида мешавад', number: 'Рақами хона',
    numberHint: 'Масалан, 12/1', street: 'Кӯча', levels: 'Ошёнаҳо', entranceNo: 'Рақами даромадгоҳ', flats: 'Хонаҳо',
    flatsHint: 'Масалан, 1–36', newName: 'Номи нав', roadKind: 'Ин чист',
    roads: { bridge: 'Пули мошингард', footbridge: 'Пули пиёдагард', road: 'Роҳ', footway: 'Роҳи пиёдагард' },
    draw: 'Дар харита аз аввал то охири пул ё роҳ пахш кунед', pick: 'Дар харита ҷои нави онро пахш кунед',
    tapToMove: 'Барои ислоҳи нуқта харитаро пахш кунед',
    thanks: 'Ташаккур! Хабар ба ҳама дар харита намоён аст ва пас аз санҷиш ба маълумот медарояд',
    saveFailed: 'Сабт нашуд: ҳуқуқи ворид кардани маълумот лозим аст', required: 'Майдонҳои ишорашударо пур кунед',
    noAccess: 'Хабар додан танҳо барои онҳое, ки соҳиби харита ба онҳо ҳуқуқи ворид кардани маълумот додааст',
    unverified: 'санҷида нашудааст', yours: 'аз шумо', at: 'Қайд шуд', about: 'Дар бораи', points: (n) => `нуқтаҳо: ${n}`,
    cats: null,
  },
  en: {
    add: 'Add to the map', title: 'What changed here?', close: 'Close', send: 'Send', cancel: 'Cancel', done: 'Done',
    back: 'Back', remove: 'Delete report', removed: 'Report deleted',
    kinds: {
      place: 'New place or business', building: 'New building', house: 'House number', entrance: 'Entrance',
      road: 'Bridge or road', construction: 'Construction site', closed: 'Closed, no longer operating',
      rename: 'Different name', moved: 'Moved elsewhere', demolished: 'Building demolished', other: 'Something else',
    },
    name: 'Name', category: 'What is it', comment: 'Comment', commentHint: 'What you see on the ground',
    number: 'House number', numberHint: 'For example, 12/1', street: 'Street', levels: 'Floors', entranceNo: 'Entrance number',
    flats: 'Flats', flatsHint: 'For example, 1–36', newName: 'New name', roadKind: 'What is it',
    roads: { bridge: 'Road bridge', footbridge: 'Footbridge', road: 'Road', footway: 'Footpath' },
    draw: 'Tap the map along the bridge or road, from start to end', pick: 'Tap the map where the place is now',
    tapToMove: 'Tap the map to adjust the point',
    thanks: 'Thank you! Everyone sees the report on the map; it goes into the data once checked',
    saveFailed: 'Could not save: you need access to add data to this map', required: 'Fill in the marked fields',
    noAccess: 'Only people the map owner allowed to add data can report changes',
    unverified: 'not verified', yours: 'yours', at: 'Reported', about: 'About', points: (n) => `points: ${n}`,
    cats: [
      ['amenity=restaurant', 'Restaurant, cafe'], ['amenity=fast_food', 'Fast food, takeaway'],
      ['shop=supermarket', 'Groceries, supermarket'], ['shop=yes', 'Other shop'], ['amenity=pharmacy', 'Pharmacy'],
      ['amenity=clinic', 'Clinic, hospital'], ['amenity=bank', 'Bank, ATM'], ['office=government', 'Government office'],
      ['office=company', 'Company office'], ['amenity=school', 'School'], ['amenity=kindergarten', 'Kindergarten'],
      ['amenity=university', 'University, college'], ['tourism=hotel', 'Hotel'], ['amenity=fuel', 'Fuel station'],
      ['amenity=place_of_worship', 'Mosque'], ['leisure=sports_centre', 'Sports'], ['craft=yes', 'Workshop, services'],
      ['', 'Other'],
    ],
  },
};
TEXT.tg.cats = TEXT.ru.cats; // виды мест — те же, подписи по-русски понятнее всем

// Что предлагать: на пустом месте карты, у заведения и у дома.
const MENU = {
  map: ['place', 'building', 'house', 'entrance', 'road', 'construction', 'other'],
  place: ['closed', 'rename', 'moved', 'other'],
  house: ['house', 'entrance', 'building', 'demolished', 'other'],
};

const COLOR = '#E8770E';
const SRC = 'yoobi-reports';
const DRAFT = 'yoobi-reports-draft';
const LAYERS = ['yoobi-reports-line', 'yoobi-reports-dot', 'yoobi-reports-mark', 'yoobi-reports-label'];

const CSS = `
.yoobi-sheet{--y-bg:#fff;--y-fg:#1f2329;--y-muted:#6b7280;--y-line:#e7e3dc;--y-hover:#f4f1ec;--y-accent:#2f6fe4;
  --y-shadow:0 10px 32px rgba(28,32,40,.2),0 1px 3px rgba(28,32,40,.12);
  position:absolute;z-index:4;left:50%;bottom:calc(12px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);
  width:min(420px,calc(100% - 20px));max-height:min(72%,560px);overflow:auto;box-sizing:border-box;padding:12px 14px 14px;
  border-radius:16px;background:var(--y-bg);color:var(--y-fg);box-shadow:var(--y-shadow);
  font:14px/1.35 system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans',sans-serif}
[data-yoobi-theme="dark"] .yoobi-sheet{--y-bg:#232830;--y-fg:#e8ebef;--y-muted:#9aa3ae;--y-line:#343b46;--y-hover:#2c323c;
  --y-accent:#6fa3f0;--y-shadow:0 10px 32px rgba(0,0,0,.5)}
.yoobi-sheet[hidden]{display:none}
.yoobi-sheet h2{margin:0 36px 10px 0;font-size:16px;font-weight:650;line-height:1.25;text-wrap:balance}
.yoobi-sheet-x{position:absolute;top:8px;right:8px;display:grid;place-items:center;width:32px;height:32px;border:0;border-radius:9px;
  background:transparent;color:var(--y-muted);cursor:pointer}
.yoobi-sheet-x:hover{background:var(--y-hover);color:var(--y-fg)}
.yoobi-sheet-menu{display:grid;gap:2px;margin:0 -6px}
.yoobi-sheet-menu button{display:flex;align-items:center;gap:10px;padding:9px 8px;border:0;border-radius:10px;background:none;
  color:inherit;font:inherit;text-align:left;cursor:pointer}
.yoobi-sheet-menu button:hover,.yoobi-sheet-menu button:focus-visible{background:var(--y-hover);outline:0}
.yoobi-sheet-menu i{flex:none;width:8px;height:8px;border-radius:50%;background:${COLOR}}
.yoobi-sheet label{display:grid;gap:4px;margin-bottom:10px;font-size:12.5px;font-weight:600;color:var(--y-muted)}
.yoobi-sheet label.yoobi-req>span::after{content:' *';color:${COLOR}}
.yoobi-sheet input,.yoobi-sheet select,.yoobi-sheet textarea{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--y-line);
  border-radius:10px;background:transparent;color:var(--y-fg);font:400 14px/1.3 inherit;font-family:inherit}
.yoobi-sheet select option{color:#1f2329}
.yoobi-sheet textarea{min-height:64px;resize:vertical}
.yoobi-sheet input:focus,.yoobi-sheet select:focus,.yoobi-sheet textarea:focus{outline:2px solid var(--y-accent);outline-offset:-1px}
.yoobi-sheet-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.yoobi-sheet-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:4px;flex-wrap:wrap}
.yoobi-sheet-actions button{padding:9px 14px;border-radius:10px;border:1px solid var(--y-line);background:transparent;color:var(--y-fg);
  font:600 13.5px/1 inherit;font-family:inherit;cursor:pointer}
.yoobi-sheet-actions button.yoobi-primary{border-color:${COLOR};background:${COLOR};color:#fff}
.yoobi-sheet-actions button:disabled{opacity:.45;cursor:default}
.yoobi-sheet-hint{margin:0 0 10px;color:var(--y-muted);font-size:12.5px}
.yoobi-sheet-meta{margin:0 0 8px;color:var(--y-muted);font-size:12.5px}
.yoobi-sheet-text{margin:0 0 10px;white-space:pre-wrap;word-break:break-word}
.yoobi-sheet-error{margin:0 0 8px;color:#d64541;font-size:12.5px}
.yoobi-report-toast{position:absolute;z-index:5;left:50%;top:calc(64px + env(safe-area-inset-top,0px));transform:translateX(-50%);
  max-width:min(420px,calc(100% - 24px));padding:9px 14px;border-radius:12px;background:#26221e;color:#fff;font:13px/1.35 system-ui,sans-serif;
  box-shadow:0 6px 20px rgba(0,0,0,.25);pointer-events:none}
.yoobi-report-pin{position:absolute;left:0;top:0;width:26px;height:36px;margin:-34px 0 0 -13px;z-index:3;pointer-events:none;
  filter:drop-shadow(0 3px 4px rgba(0,0,0,.3));will-change:transform}
.yoobi-report-pin[hidden]{display:none}
.yoobi-report-add{display:grid;place-items:center}
.yoobi-report-add svg{fill:${COLOR}}
`;

const PLUS = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>';
const X = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
const PIN = `<svg width="26" height="36" viewBox="0 0 26 36" aria-hidden="true"><path d="M13 0C5.8 0 0 5.7 0 12.8 0 22.4 13 36 13 36s13-13.6 13-23.2C26 5.7 20.2 0 13 0z" fill="${COLOR}"/><circle cx="13" cy="12.8" r="5" fill="#fff"/></svg>`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round = (v) => Math.round(v * 1e6) / 1e6;
const newId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const clip = (s, n) => String(s ?? '').trim().slice(0, n);

/** Хранилище в памяти страницы: для проверки и для проектов без своего сервера. */
export function memoryReports(initial = []) {
  let items = initial.map((r) => ({ ...r, mine: true }));
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(items.slice()));
  return {
    subscribe(fn) { listeners.add(fn); fn(items.slice()); return () => listeners.delete(fn); },
    async add(report) { items = [...items.filter((r) => r.id !== report.id), { ...report, mine: true }]; emit(); },
    async remove(id) { items = items.filter((r) => r.id !== id); emit(); },
    writable: async () => true,
  };
}

/** GeoJSON сообщений для слоя карты: точки, а у мостов и дорог — линия и точка посередине. */
export function reportsToGeoJSON(reports, lang = 'ru') {
  const t = TEXT[lang] || TEXT.ru;
  const features = [];
  for (const r of reports) {
    const label = r.name || r.house || (r.kind === 'entrance' && r.ref ? `${t.kinds.entrance} ${r.ref}` : t.kinds[r.kind] || '');
    const props = { id: r.id, kind: r.kind, label: clip(label, 40), mine: Boolean(r.mine) };
    if (Array.isArray(r.line) && r.line.length > 1) {
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: r.line }, properties: props });
    }
    if (Number.isFinite(r.lon) && Number.isFinite(r.lat)) {
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lon, r.lat] }, properties: props });
    }
  }
  return { type: 'FeatureCollection', features };
}

export function enableReports(map, { store = memoryReports(), lang = 'ru', search = null, button = true,
  font = ['Noto Sans Bold'] } = {}) {
  let t = TEXT[lang] || TEXT.ru;
  let reports = [];
  let writable = null; // null — хранилище ничего не сказало: пробуем и смотрим на ответ
  Promise.resolve(store.writable?.()).then((w) => { writable = w ?? null; }, () => {});
  const container = map.getContainer();
  if (!document.getElementById('yoobi-reports-css')) {
    const style = document.createElement('style');
    style.id = 'yoobi-reports-css';
    style.textContent = CSS;
    document.head.append(style);
  }
  const sheet = document.createElement('div');
  sheet.className = 'yoobi-sheet';
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  const pin = document.createElement('div');
  pin.className = 'yoobi-report-pin';
  pin.hidden = true;
  pin.innerHTML = PIN;
  container.append(sheet, pin);
  let toastEl = null;
  let toastTimer = 0;
  function toast(text) {
    toastEl?.remove();
    toastEl = document.createElement('div');
    toastEl.className = 'yoobi-report-toast';
    toastEl.setAttribute('role', 'status');
    toastEl.textContent = text;
    container.append(toastEl);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl?.remove(); toastEl = null; }, 4200);
  }

  // ——— Слой сообщений ———
  function ensureLayers() {
    if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: reportsToGeoJSON(reports, lang) });
    if (!map.getSource(DRAFT)) map.addSource(DRAFT, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const line = ['==', ['geometry-type'], 'LineString'];
    const point = ['==', ['geometry-type'], 'Point'];
    const add = (layer) => { if (!map.getLayer(layer.id)) map.addLayer(layer); };
    add({ id: 'yoobi-reports-line', type: 'line', source: SRC, filter: line,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COLOR, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 3, 18, 9], 'line-opacity': 0.9,
        'line-dasharray': [1.4, 1] } });
    add({ id: 'yoobi-reports-dot', type: 'circle', source: SRC, filter: point,
      paint: { 'circle-color': COLOR, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 8],
        'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
    add({ id: 'yoobi-reports-mark', type: 'symbol', source: SRC, filter: point, minzoom: 13,
      layout: { 'text-field': '!', 'text-font': font, 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-color': '#fff' } });
    add({ id: 'yoobi-reports-label', type: 'symbol', source: SRC, filter: point, minzoom: 15,
      layout: { 'text-field': ['get', 'label'], 'text-font': font, 'text-size': 11.5, 'text-anchor': 'top',
        'text-offset': [0, 0.9], 'text-max-width': 9, 'text-optional': true },
      paint: { 'text-color': '#9A4A00', 'text-halo-color': '#fff', 'text-halo-width': 1.4 } });
    add({ id: 'yoobi-reports-draft-line', type: 'line', source: DRAFT, filter: line,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COLOR, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 3, 18, 9], 'line-opacity': 0.75 } });
    add({ id: 'yoobi-reports-draft-dot', type: 'circle', source: DRAFT, filter: point,
      paint: { 'circle-color': '#fff', 'circle-radius': 5, 'circle-stroke-color': COLOR, 'circle-stroke-width': 2.5 } });
  }
  function refresh() {
    if (!map.isStyleLoaded() && !map.getSource(SRC)) return;
    ensureLayers();
    map.getSource(SRC).setData(reportsToGeoJSON(reports, lang));
  }
  const onStyle = () => { try { refresh(); } catch { /* стиль ещё собирается */ } };
  map.on('styledata', onStyle);
  if (map.isStyleLoaded()) onStyle();
  const unsubscribe = store.subscribe((list) => {
    reports = (list || []).filter((r) => r && r.kind);
    onStyle();
  }, (err) => console.warn('Сообщения недоступны:', err));

  // ——— Точка на карте ———
  let pinAt = null;
  function placePin() {
    if (!pinAt) { pin.hidden = true; return; }
    const p = map.project(pinAt);
    pin.style.transform = `translate(${p.x}px, ${p.y}px)`;
    pin.hidden = false;
  }
  map.on('move', placePin);

  // Режимы: «point» — нажатие переносит точку формы, «draw» — добавляет точку линии,
  // «pick» — выбирает новое место заведения. Пока режим включён, карточки не открываются.
  let mode = null;
  let draft = [];
  let onPick = null;
  function setMode(next) {
    mode = next;
    if (next) container.dataset.yoobiMode = next;
    else delete container.dataset.yoobiMode;
    map.getCanvas().style.cursor = next === 'draw' || next === 'pick' ? 'crosshair' : '';
  }
  function drawDraft() {
    const features = draft.map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: {} }));
    if (draft.length > 1) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: draft }, properties: {} });
    map.getSource(DRAFT)?.setData({ type: 'FeatureCollection', features });
  }

  // ——— Лист с меню и формами ———
  function close() {
    sheet.hidden = true;
    sheet.innerHTML = '';
    pinAt = null;
    placePin();
    draft = [];
    drawDraft();
    onPick = null;
    setMode(null);
  }
  function frame(title, body) {
    sheet.innerHTML = `<button type="button" class="yoobi-sheet-x" aria-label="${esc(t.close)}" title="${esc(t.close)}">${X}</button>
      <h2>${esc(title)}</h2>${body}`;
    sheet.setAttribute('aria-label', title);
    sheet.hidden = false;
    sheet.querySelector('.yoobi-sheet-x').addEventListener('click', close);
  }

  // origin — где нажали: с него начинается линия моста; у кнопки «+» точки нет.
  function menu(at, ctx = null, origin = at) {
    if (writable === false) {
      frame(t.title, `<p class="yoobi-sheet-hint">${esc(t.noAccess)}</p>`);
      return;
    }
    const kinds = MENU[ctx ? (ctx.house ? 'house' : 'place') : 'map'];
    const about = ctx?.title ? `<p class="yoobi-sheet-hint">${esc(t.about)}: ${esc(ctx.title)}</p>` : '';
    frame(t.title, `${about}<p class="yoobi-sheet-hint">${esc(t.tapToMove)}</p><div class="yoobi-sheet-menu">${kinds.map((k) => `<button type="button" data-kind="${k}"><i></i>${esc(t.kinds[k])}</button>`).join('')}</div>`);
    pinAt = at;
    placePin();
    setMode('point');
    onPick = (lngLat) => { at = lngLat; origin = lngLat; pinAt = lngLat; placePin(); };
    sheet.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => start(b.dataset.kind, at, ctx, origin)));
    sheet.querySelector('[data-kind]')?.focus();
  }

  function start(kind, at, ctx, origin) {
    if (kind === 'road') { beginDraw(origin, ctx); return; }
    if (kind === 'moved') {
      setMode('pick');
      frame(t.kinds.moved, `<p class="yoobi-sheet-hint">${esc(t.pick)}</p><div class="yoobi-sheet-actions"><button type="button" data-act="cancel">${esc(t.cancel)}</button></div>`);
      sheet.querySelector('[data-act="cancel"]').addEventListener('click', close);
      onPick = (lngLat) => { form('moved', lngLat, ctx); };
      return;
    }
    form(kind, at, ctx);
  }

  function beginDraw(at, ctx) {
    draft = at ? [at] : [];
    drawDraft();
    pinAt = null;
    placePin();
    setMode('draw');
    const paint = () => {
      frame(t.kinds.road, `<p class="yoobi-sheet-hint">${esc(t.draw)} · ${esc(t.points(draft.length))}</p>
        <div class="yoobi-sheet-actions"><button type="button" data-act="undo" ${draft.length ? '' : 'disabled'}>${esc(t.back)}</button>
        <button type="button" data-act="cancel">${esc(t.cancel)}</button>
        <button type="button" class="yoobi-primary" data-act="done" ${draft.length > 1 ? '' : 'disabled'}>${esc(t.done)}</button></div>`);
      sheet.querySelector('[data-act="undo"]').addEventListener('click', () => { draft.pop(); drawDraft(); paint(); });
      sheet.querySelector('[data-act="cancel"]').addEventListener('click', close);
      sheet.querySelector('[data-act="done"]').addEventListener('click', () => form('road', draft[Math.floor(draft.length / 2)], ctx, draft.slice()));
    };
    onPick = (lngLat) => { if (draft.length < 60) { draft.push(lngLat); drawDraft(); paint(); } };
    paint();
  }

  function field(name, label, { required = false, hint = '', value = '', type = 'text', max = 120 } = {}) {
    return `<label class="${required ? 'yoobi-req' : ''}"><span>${esc(label)}</span><input name="${name}" type="${type}"
      maxlength="${max}" value="${esc(value)}" placeholder="${esc(hint)}" ${required ? 'required' : ''} autocomplete="off"></label>`;
  }
  function textarea(required = false) {
    return `<label class="${required ? 'yoobi-req' : ''}"><span>${esc(t.comment)}</span><textarea name="text" maxlength="500"
      placeholder="${esc(t.commentHint)}" ${required ? 'required' : ''}></textarea></label>`;
  }

  function form(kind, at, ctx, line = null) {
    const street = kind === 'house' && search?.reverse
      ? (search.reverse(at[0], at[1], { radius: 120, lang })?.title || '').replace(/,?\s*[\d][^,]*$/, '') : '';
    const fields = {
      place: () => field('name', t.name, { required: true }) + select('cat', t.category, t.cats) + textarea(),
      building: () => field('name', t.name) + select('cat', t.category, t.cats)
        + `<div class="yoobi-sheet-row">${field('house', t.number, { hint: t.numberHint, max: 20 })}${field('levels', t.levels, { type: 'number', max: 3 })}</div>` + textarea(),
      house: () => `<div class="yoobi-sheet-row">${field('house', t.number, { required: true, hint: t.numberHint, max: 20 })}${field('levels', t.levels, { type: 'number', max: 3 })}</div>`
        + field('street', t.street, { value: street }) + textarea(),
      entrance: () => `<div class="yoobi-sheet-row">${field('ref', t.entranceNo, { required: true, max: 10 })}${field('flats', t.flats, { hint: t.flatsHint, max: 40 })}</div>` + textarea(),
      road: () => select('road', t.roadKind, Object.entries(t.roads)) + field('name', t.name) + textarea(),
      construction: () => textarea(true),
      closed: () => textarea(),
      demolished: () => textarea(),
      rename: () => field('name', t.newName, { required: true, value: ctx?.title || '' }) + textarea(),
      moved: () => textarea(),
      other: () => textarea(true),
    }[kind];
    const about = ctx?.title ? `<p class="yoobi-sheet-hint">${esc(t.about)}: ${esc(ctx.title)}</p>` : '';
    const movable = !line && kind !== 'moved';
    frame(t.kinds[kind], `${about}${movable ? `<p class="yoobi-sheet-hint">${esc(t.tapToMove)}</p>` : ''}<form novalidate>${fields()}
      <p class="yoobi-sheet-error" hidden></p>
      <div class="yoobi-sheet-actions"><button type="button" data-act="cancel">${esc(t.cancel)}</button>
      <button type="submit" class="yoobi-primary">${esc(t.send)}</button></div></form>`);
    if (!line) { pinAt = at; placePin(); }
    setMode(movable ? 'point' : 'busy');
    onPick = movable ? (lngLat) => { at = lngLat; pinAt = lngLat; placePin(); } : null;
    const f = sheet.querySelector('form');
    f.querySelector('input,select,textarea')?.focus();
    sheet.querySelector('[data-act="cancel"]').addEventListener('click', close);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(f).entries());
      const missing = [...f.querySelectorAll('[required]')].some((i) => !String(i.value).trim());
      const error = f.querySelector('.yoobi-sheet-error');
      if (missing) { error.textContent = t.required; error.hidden = false; return; }
      const report = {
        id: newId(), v: 1, kind, lon: round(at[0]), lat: round(at[1]), at: new Date().toISOString(),
        ...(line ? { line: line.map(([x, y]) => [round(x), round(y)]) } : {}),
        ...(data.name ? { name: clip(data.name, 120) } : {}),
        ...(data.cat ? { cat: clip(data.cat, 60) } : {}),
        ...(data.road ? { road: clip(data.road, 20) } : {}),
        ...(data.house ? { house: clip(data.house, 20) } : {}),
        ...(data.street ? { street: clip(data.street, 120) } : {}),
        ...(Number(data.levels) > 0 && Number(data.levels) < 200 ? { levels: Math.round(Number(data.levels)) } : {}),
        ...(data.ref ? { ref: clip(data.ref, 10) } : {}),
        ...(data.flats ? { flats: clip(data.flats, 40) } : {}),
        ...(data.text ? { text: clip(data.text, 500) } : {}),
        ...(ctx ? { target: { title: clip(ctx.title, 160), type: clip(ctx.type, 120), lon: round(ctx.at[0]), lat: round(ctx.at[1]) } } : {}),
      };
      const submit = f.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        await store.add(report);
        close();
        toast(t.thanks);
      } catch (err) {
        console.warn('Сообщение не сохранено:', err);
        submit.disabled = false;
        error.textContent = t.saveFailed;
        error.hidden = false;
      }
    });
  }
  function select(name, label, options) {
    return `<label><span>${esc(label)}</span><select name="${name}">${options.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></label>`;
  }

  function view(report) {
    const when = report.at ? new Date(report.at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU') : '';
    const rows = [
      report.name && `<b>${esc(report.name)}</b>`,
      report.house && `${esc(t.number)}: ${esc(report.house)}${report.street ? `, ${esc(report.street)}` : ''}`,
      report.ref && `${esc(t.entranceNo)}: ${esc(report.ref)}${report.flats ? ` · ${esc(t.flats)} ${esc(report.flats)}` : ''}`,
      report.levels && `${esc(t.levels)}: ${esc(report.levels)}`,
      report.road && esc(t.roads[report.road] || ''),
      report.target?.title && `${esc(t.about)}: ${esc(report.target.title)}`,
    ].filter(Boolean);
    frame(t.kinds[report.kind] || t.kinds.other, `<p class="yoobi-sheet-meta">${esc(t.at)} ${esc(when)} · ${esc(t.unverified)}${report.mine ? ` · ${esc(t.yours)}` : ''}</p>
      ${rows.length ? `<p class="yoobi-sheet-text">${rows.join('<br>')}</p>` : ''}
      ${report.text ? `<p class="yoobi-sheet-text">${esc(report.text)}</p>` : ''}
      <div class="yoobi-sheet-actions">${report.mine && store.remove ? `<button type="button" data-act="remove">${esc(t.remove)}</button>` : ''}
      <button type="button" data-act="close">${esc(t.close)}</button></div>`);
    pinAt = null;
    placePin();
    setMode(null);
    sheet.querySelector('[data-act="close"]').addEventListener('click', close);
    sheet.querySelector('[data-act="remove"]')?.addEventListener('click', async () => {
      try { await store.remove(report.id); close(); toast(t.removed); } catch (err) { console.warn(err); }
    });
  }

  // ——— Жесты: долгое нажатие, правая кнопка, нажатия в режимах ———
  let press = null;
  const cancelPress = () => { if (press) { clearTimeout(press.timer); press = null; } };
  function onTouchStart(e) {
    if (mode || e.originalEvent.touches.length !== 1) { cancelPress(); return; }
    const { point, lngLat } = e;
    press = { point, timer: setTimeout(() => { press = null; menu([lngLat.lng, lngLat.lat]); }, 600) };
  }
  function onTouchMove(e) {
    if (press && Math.hypot(e.point.x - press.point.x, e.point.y - press.point.y) > 10) cancelPress();
  }
  function onContext(e) {
    e.originalEvent?.preventDefault?.();
    cancelPress(); // на Android долгое нажатие присылает и contextmenu
    if (mode === 'draw' || mode === 'pick') return;
    menu([e.lngLat.lng, e.lngLat.lat]);
  }
  function onClick(e) {
    const at = [e.lngLat.lng, e.lngLat.lat];
    if (mode && onPick) { onPick(at); return; }
    if (mode) return;
    const layers = LAYERS.filter((id) => map.getLayer(id));
    const hit = layers.length ? map.queryRenderedFeatures(e.point, { layers })[0] : null;
    const report = hit && reports.find((r) => r.id === hit.properties.id);
    if (report) view(report);
  }
  map.on('touchstart', onTouchStart);
  map.on('touchmove', onTouchMove);
  map.on('touchend', cancelPress);
  map.on('touchcancel', cancelPress);
  map.on('dragstart', cancelPress);
  map.on('contextmenu', onContext);
  map.on('click', onClick);
  const pointer = () => { if (!mode) map.getCanvas().style.cursor = 'pointer'; };
  const unpointer = () => { if (!mode) map.getCanvas().style.cursor = ''; };
  map.on('mouseenter', 'yoobi-reports-dot', pointer);
  map.on('mouseleave', 'yoobi-reports-dot', unpointer);
  const onKey = (e) => { if (e.key === 'Escape' && !sheet.hidden) close(); };
  document.addEventListener('keydown', onKey);

  // Кнопка «+» под навигацией: для тех, кто не знает про долгое нажатие.
  let control = null;
  if (button) {
    const box = document.createElement('div');
    box.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    box.innerHTML = `<button type="button" class="yoobi-report-add">${PLUS}</button>`;
    const b = box.querySelector('button');
    const label = () => { b.title = t.add; b.setAttribute('aria-label', t.add); };
    label();
    b.addEventListener('click', () => {
      const c = map.getCenter();
      menu([c.lng, c.lat], null, null);
    });
    control = { onAdd: () => box, onRemove: () => box.remove(), label };
    map.addControl(control, 'top-right');
  }

  return {
    /** Сообщить об изменении места или дома из карточки (ctx из enableSearchPanel onReport). */
    report(ctx) { menu(ctx.at, ctx); },
    /** Открыть меню «Что здесь изменилось?» в точке [lon, lat]. */
    openAt(at) { menu(at); },
    close,
    get reports() { return reports.slice(); },
    get writable() { return writable; },
    setLang(next) {
      lang = next;
      t = TEXT[lang] || TEXT.ru;
      control?.label();
      onStyle();
      if (!sheet.hidden) close();
    },
    destroy() {
      close();
      unsubscribe?.();
      map.off('styledata', onStyle);
      map.off('move', placePin);
      map.off('touchstart', onTouchStart);
      map.off('touchmove', onTouchMove);
      map.off('touchend', cancelPress);
      map.off('touchcancel', cancelPress);
      map.off('dragstart', cancelPress);
      map.off('contextmenu', onContext);
      map.off('click', onClick);
      map.off('mouseenter', 'yoobi-reports-dot', pointer);
      map.off('mouseleave', 'yoobi-reports-dot', unpointer);
      document.removeEventListener('keydown', onKey);
      if (control) map.removeControl(control);
      for (const id of [...LAYERS, 'yoobi-reports-draft-line', 'yoobi-reports-draft-dot']) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of [SRC, DRAFT]) if (map.getSource(id)) map.removeSource(id);
      sheet.remove();
      pin.remove();
      toastEl?.remove();
    },
  };
}
