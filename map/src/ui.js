// Панель поиска и карточки мест для MapLibre GL JS — как в городских справочниках:
// строка поиска с подсказками, карточка места или дома по нажатию на карту
// (адрес, часы работы, телефон, сайт, организации в здании, что рядом).
//
//   import { loadSearch, enableSearchPanel } from './map/src/index.js';
//   const search = await loadSearch('https://cdn.example.com/map/tajikistan-search.json');
//   const panel = enableSearchPanel(map, search, { lang: 'ru' });
//   panel.destroy(); // убрать
//
// Цвета панели следуют теме карты: setTheme() ставит data-yoobi-theme на контейнер.

import { CATEGORY_BY_ID, AIRPORT, OTHER, ICONS } from './categories.js';
import { normalize } from './search.js';

const TEXT = {
  ru: {
    placeholder: 'Адрес, улица, место', clear: 'Очистить', close: 'Закрыть', empty: 'Ничего не нашлось',
    emptyHint: 'Попробуйте улицу и номер дома или название места', building: 'Здание', inside: 'В здании',
    nearby: 'Рядом', floors: (n) => `${n} ${plural(n, 'этаж', 'этажа', 'этажей')}`, copy: 'Скопировать координаты',
    copied: 'Скопировано', results: 'Результаты поиска', km: 'км', m: 'м',
  },
  tg: {
    placeholder: 'Суроға, кӯча, макон', clear: 'Тоза кардан', close: 'Пӯшидан', empty: 'Ҳеҷ чиз ёфт нашуд',
    emptyHint: 'Кӯча ва рақами хона ё номи маконро нависед', building: 'Бино', inside: 'Дар бино',
    nearby: 'Дар наздикӣ', floors: (n) => `${n} ошёна`, copy: 'Нусхабардории координатаҳо', copied: 'Нусха шуд',
    results: 'Натиҷаҳои ҷустуҷӯ', km: 'км', m: 'м',
  },
  en: {
    placeholder: 'Address, street, place', clear: 'Clear', close: 'Close', empty: 'Nothing found',
    emptyHint: 'Try a street and house number or a place name', building: 'Building', inside: 'In this building',
    nearby: 'Nearby', floors: (n) => `${n} ${n === 1 ? 'floor' : 'floors'}`, copy: 'Copy coordinates',
    copied: 'Copied', results: 'Search results', km: 'km', m: 'm',
  },
};

function plural(n, one, few, many) {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return few;
  return many;
}

const DAYS = {
  ru: { Mo: 'Пн', Tu: 'Вт', We: 'Ср', Th: 'Чт', Fr: 'Пт', Sa: 'Сб', Su: 'Вс', off: 'выходной', '24/7': 'круглосуточно' },
  tg: { Mo: 'Дш', Tu: 'Сш', We: 'Чш', Th: 'Пш', Fr: 'Ҷм', Sa: 'Шб', Su: 'Яш', off: 'рӯзи истироҳат', '24/7': 'шабонарӯзӣ' },
  en: { Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri', Sa: 'Sat', Su: 'Sun', off: 'closed', '24/7': 'open 24/7' },
};

/** Часы работы OSM («Mo-Fr 09:00-18:00; Sa off») — в читаемый вид на нужном языке. */
export function prettyHours(value, lang = 'ru') {
  const d = DAYS[lang] || DAYS.ru;
  return String(value)
    .replace(/24\/7/g, d['24/7'])
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|off)\b/g, (m) => d[m])
    .replace(/(\d)-(\d)/g, '$1–$2')
    .replace(/([А-Яа-яA-Za-zҶҷӢӣӮӯ])-([А-Яа-яA-Za-zҶҷӢӣӮӯ])/g, '$1–$2')
    .replace(/\s*;\s*/g, '; ')
    .replace(/,(?=\S)/g, ', ');
}

const svg = (d, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
const I = {
  search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  pin: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z',
  clock: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  phone: 'M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
  globe: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.93 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 0 1 5.08 16zm2.95-8H5.08a7.99 7.99 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z',
  building: 'M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z',
  street: 'M11 2h2v4h-2zm0 7h2v6h-2zm0 9h2v4h-2zM4 2h2v20H4zm14 0h2v20h-2z',
  place: 'M12 2 3 7v2h18V7l-9-5zM5 11v7H4v3h16v-3h-1v-7h-2v7h-3v-7h-2v7H9v-7H5z',
  copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
};

const CSS = `
.yoobi-panel{--y-bg:#fff;--y-fg:#1f2329;--y-muted:#6b7280;--y-line:#e7e3dc;--y-hover:#f4f1ec;--y-accent:#2f6fe4;
  --y-shadow:0 6px 24px rgba(28,32,40,.16),0 1px 3px rgba(28,32,40,.1);--y-chip:#f3f0ea;
  position:absolute;z-index:3;top:10px;left:10px;width:360px;max-width:calc(100% - 20px);
  display:flex;flex-direction:column;gap:8px;font:14px/1.35 system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans',sans-serif;
  color:var(--y-fg);pointer-events:none}
[data-yoobi-theme="dark"] .yoobi-panel{--y-bg:#232830;--y-fg:#e8ebef;--y-muted:#9aa3ae;--y-line:#343b46;--y-hover:#2c323c;
  --y-accent:#6fa3f0;--y-shadow:0 8px 28px rgba(0,0,0,.45),0 1px 3px rgba(0,0,0,.3);--y-chip:#2c323c}
.yoobi-panel>*{pointer-events:auto}
.yoobi-box{display:flex;align-items:center;gap:6px;height:46px;padding:0 6px 0 14px;border-radius:14px;background:var(--y-bg);
  box-shadow:var(--y-shadow)}
.yoobi-box svg{flex:none;color:var(--y-muted)}
.yoobi-box input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;color:var(--y-fg);font:inherit;font-size:16px}
.yoobi-box input::placeholder{color:var(--y-muted)}
.yoobi-box input::-webkit-search-cancel-button{display:none}
.yoobi-icon-btn{flex:none;display:grid;place-items:center;width:34px;height:34px;border:0;border-radius:10px;
  background:transparent;color:var(--y-muted);cursor:pointer}
.yoobi-icon-btn:hover{background:var(--y-hover);color:var(--y-fg)}
.yoobi-icon-btn:focus-visible,.yoobi-row:focus-visible{outline:2px solid var(--y-accent);outline-offset:-2px}
.yoobi-list,.yoobi-card{background:var(--y-bg);border-radius:14px;box-shadow:var(--y-shadow);overflow:auto;max-height:min(62vh,520px)}
.yoobi-list{padding:6px 0;margin:0;list-style:none}
.yoobi-row{display:flex;align-items:center;gap:12px;padding:8px 14px;cursor:pointer}
.yoobi-row[aria-selected="true"],.yoobi-row:hover{background:var(--y-hover)}
.yoobi-dot{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;color:#fff}
.yoobi-dot svg{width:17px;height:17px}
.yoobi-row-text{flex:1;min-width:0}
.yoobi-row-title{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.yoobi-row-title mark{background:none;color:var(--y-accent);font-weight:700}
.yoobi-row-sub{color:var(--y-muted);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.yoobi-row-dist{flex:none;color:var(--y-muted);font-size:12px;font-variant-numeric:tabular-nums}
.yoobi-empty{padding:14px 16px;color:var(--y-muted)}
.yoobi-empty b{display:block;color:var(--y-fg);font-weight:600;margin-bottom:2px}
.yoobi-card{padding:14px 16px 12px;position:relative}
.yoobi-card-head{display:flex;gap:12px;align-items:flex-start;padding-right:30px}
.yoobi-card-head .yoobi-dot{width:38px;height:38px}
.yoobi-card-head .yoobi-dot svg{width:21px;height:21px}
.yoobi-card h2{margin:0;font-size:17px;line-height:1.25;font-weight:650;text-wrap:balance}
.yoobi-card-type{color:var(--y-muted);margin-top:2px}
.yoobi-card .yoobi-icon-btn.yoobi-x{position:absolute;top:10px;right:10px}
.yoobi-facts{display:grid;gap:8px;margin:12px 0 4px;padding:0;list-style:none}
.yoobi-facts li{display:flex;gap:10px;align-items:flex-start}
.yoobi-facts svg{flex:none;margin-top:1px;color:var(--y-muted)}
.yoobi-facts a{color:var(--y-accent);text-decoration:none;word-break:break-word}
.yoobi-facts a:hover{text-decoration:underline}
.yoobi-section{margin-top:12px;border-top:1px solid var(--y-line);padding-top:10px}
.yoobi-section h3{margin:0 0 4px;font-size:12px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:var(--y-muted)}
.yoobi-section .yoobi-row{padding:6px 0;margin:0 -4px;border-radius:10px;padding-inline:4px}
.yoobi-section .yoobi-dot{width:26px;height:26px}
.yoobi-section .yoobi-dot svg{width:15px;height:15px}
.yoobi-coords{display:flex;align-items:center;gap:6px;margin-top:10px;color:var(--y-muted);font-size:12px;font-variant-numeric:tabular-nums}
.yoobi-coords button{display:inline-flex;align-items:center;gap:4px;border:0;border-radius:8px;padding:4px 8px;
  background:var(--y-chip);color:var(--y-fg);font:inherit;cursor:pointer}
.yoobi-pin{position:absolute;left:0;top:0;width:30px;height:40px;margin:-38px 0 0 -15px;z-index:2;pointer-events:none;
  filter:drop-shadow(0 3px 4px rgba(0,0,0,.3));will-change:transform}
.yoobi-pin svg{display:block}
.yoobi-hidden{display:none!important}
@media (max-width:560px){
  .yoobi-panel{top:8px;left:8px;width:auto;right:8px;max-width:none}
  .yoobi-has-panel .maplibregl-ctrl-top-right{top:58px}
  .yoobi-card{position:fixed;left:0;right:0;bottom:0;border-radius:18px 18px 0 0;max-height:52vh;
    padding-bottom:calc(14px + env(safe-area-inset-bottom,0px))}
}
`;

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function badge(item) {
  if (item.kind === 'poi') {
    const cat = item.category === 'airport' ? AIRPORT : CATEGORY_BY_ID[item.category] || OTHER;
    return { color: cat.color, icon: ICONS[cat.icon] || ICONS.dot };
  }
  if (item.kind === 'address') return { color: '#8a7f72', icon: I.building };
  if (item.kind === 'street') return { color: '#7b8594', icon: I.street };
  return { color: '#5a6b85', icon: I.place };
}

function dot(item) {
  const b = badge(item);
  return `<span class="yoobi-dot" style="background:${b.color}">${svg(b.icon)}</span>`;
}

// Подсветка найденного начала слов.
function highlight(title, query) {
  const words = normalize(query).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 0);
  if (!words.length) return esc(title);
  const norm = normalize(title);
  if (norm.length !== title.length) return esc(title);
  const marks = new Array(title.length).fill(false);
  for (const w of words) {
    let i = -1;
    while ((i = norm.indexOf(w, i + 1)) >= 0) {
      if (i === 0 || /[^\p{L}\p{N}]/u.test(norm[i - 1])) for (let k = i; k < i + w.length; k++) marks[k] = true;
    }
  }
  let out = '';
  for (let i = 0; i < title.length; i++) {
    const open = marks[i] && !marks[i - 1];
    const close = marks[i] && !marks[i + 1];
    out += (open ? '<mark>' : '') + esc(title[i]) + (close ? '</mark>' : '');
  }
  return out;
}

function formatDistance(m, t) {
  if (m == null) return '';
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} ${t.m}`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} ${t.km}`;
}

// Масштаб, на который приближаемся к найденному.
const ZOOM = { city: 12, town: 13.5, village: 15, hamlet: 15.5, suburb: 14.5, quarter: 15.5, neighbourhood: 15.5 };
const zoomFor = (item) => (item.kind === 'place' ? ZOOM[item.category] || 15 : item.kind === 'street' ? 16.5 : 17.6);

const BUILDING_LAYERS = ['building-3d', 'building'];

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Тайлы склеивают одинаковые дома в один мультиполигон — берём тот дом, на который нажали
// (или ближайший к точке, если нажали на стену объёмного дома).
function pickPolygon(feature, point) {
  const g = feature.geometry;
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') return null;
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let best = polygons.find((p) => inRing(point, p[0]));
  if (!best) {
    const d = (p) => Math.min(...p[0].map(([x, y]) => (x - point[0]) ** 2 + (y - point[1]) ** 2));
    best = polygons.reduce((a, b) => (d(b) < d(a) ? b : a));
  }
  return { geometry: { type: 'Polygon', coordinates: best }, properties: feature.properties };
}
const PLACE_LAYERS = ['poi-icon', 'poi-label', 'poi-landmark', 'poi-minor', 'park-label', 'airport-label'];

/**
 * Панель поиска и карточки мест. search — результат createSearch()/loadSearch().
 * Возвращает { open(item), close(), setLang(lang), destroy() }.
 */
export function enableSearchPanel(map, search, { lang = 'ru', placeholder, clickable = true } = {}) {
  let t = TEXT[lang] || TEXT.ru;
  const container = map.getContainer();
  if (!document.getElementById('yoobi-ui-css')) {
    const style = document.createElement('style');
    style.id = 'yoobi-ui-css';
    style.textContent = CSS;
    document.head.append(style);
  }

  container.classList.add('yoobi-has-panel');
  const panel = el('div', 'yoobi-panel');
  const box = el('div', 'yoobi-box');
  box.innerHTML = `${svg(I.search, 20)}<input type="search" role="combobox" aria-autocomplete="list" aria-expanded="false"
    autocomplete="off" spellcheck="false" enterkeyhint="search"><button type="button" class="yoobi-icon-btn yoobi-hidden">${svg(I.close)}</button>`;
  const input = box.querySelector('input');
  const clear = box.querySelector('button');
  const list = el('ul', 'yoobi-list yoobi-hidden');
  list.id = `yoobi-list-${Math.random().toString(36).slice(2, 8)}`;
  list.setAttribute('role', 'listbox');
  input.setAttribute('aria-controls', list.id);
  const card = el('div', 'yoobi-card yoobi-hidden');
  card.setAttribute('role', 'dialog');
  panel.append(box, list, card);
  container.append(panel);

  const pin = el('div', 'yoobi-pin yoobi-hidden',
    '<svg width="30" height="40" viewBox="0 0 30 40"><path d="M15 39s13-13.4 13-23.5C28 7.5 22.2 2 15 2S2 7.5 2 15.5C2 25.6 15 39 15 39z" fill="#E8433F" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15.5" r="5" fill="#fff"/></svg>');
  container.append(pin);
  let pinAt = null;
  const placePin = () => {
    if (!pinAt) return;
    const p = map.project(pinAt);
    pin.style.transform = `translate(${p.x}px, ${p.y}px)`;
  };
  map.on('move', placePin);

  let results = [];
  let resultsFor = null; // запрос, для которого посчитаны results
  let active = -1;
  let timer;

  function applyText() {
    input.placeholder = placeholder || t.placeholder;
    input.setAttribute('aria-label', placeholder || t.placeholder);
    clear.title = t.clear;
    clear.setAttribute('aria-label', t.clear);
    list.setAttribute('aria-label', t.results);
  }
  applyText();

  // Пока открыты подсказки, карточка прячется под ними и возвращается, если ничего не выбрали.
  function showList(show) {
    list.classList.toggle('yoobi-hidden', !show);
    input.setAttribute('aria-expanded', String(show));
    card.classList.toggle('yoobi-hidden', show || !pinAt);
  }

  function render() {
    const q = input.value;
    clear.classList.toggle('yoobi-hidden', !q);
    if (!q.trim()) { showList(false); return; }
    if (!results.length) {
      list.innerHTML = `<li class="yoobi-empty"><b>${esc(t.empty)}</b>${esc(t.emptyHint)}</li>`;
      showList(true);
      return;
    }
    list.innerHTML = results.map((r, i) => `<li class="yoobi-row" role="option" id="${list.id}-${i}" aria-selected="${i === active}">
      ${dot(r)}<span class="yoobi-row-text"><div class="yoobi-row-title">${highlight(r.title, q)}</div>
      <div class="yoobi-row-sub">${esc(r.subtitle)}</div></span><span class="yoobi-row-dist">${formatDistance(r.distance, t)}</span></li>`).join('');
    input.setAttribute('aria-activedescendant', active >= 0 ? `${list.id}-${active}` : '');
    showList(true);
  }

  function run() {
    const c = map.getCenter();
    resultsFor = input.value;
    results = search.search(input.value, { center: [c.lng, c.lat], lang, limit: 8 });
    active = -1;
    render();
  }

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 60); });
  input.addEventListener('focus', () => { if (input.value.trim()) render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!results.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      render();
    } else if (e.key === 'Enter') {
      clearTimeout(timer);
      if (resultsFor !== input.value) run(); // Enter раньше, чем обновились подсказки
      const r = results[Math.max(active, 0)];
      if (r) choose(r);
    } else if (e.key === 'Escape') {
      if (!list.classList.contains('yoobi-hidden')) showList(false);
      else { input.value = ''; render(); close(); }
    }
  });
  list.addEventListener('mousedown', (e) => e.preventDefault()); // не терять фокус до клика
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.yoobi-row');
    if (row) choose(results[Number(row.id.split('-').pop())]);
  });
  clear.addEventListener('click', () => { input.value = ''; results = []; resultsFor = ''; render(); close(); input.focus(); });

  function choose(item) {
    input.value = item.title;
    showList(false);
    input.blur();
    map.flyTo({ center: [item.lon, item.lat], zoom: Math.max(zoomFor(item), item.kind === 'place' ? 0 : map.getZoom()), speed: 1.6 });
    open(item);
  }

  function facts(item) {
    const out = [];
    const info = item.info || {};
    const where = info.addr || (item.kind === 'poi' ? search.reverse(item.lon, item.lat, { lang })?.title : '');
    if (where) out.push(`<li>${svg(I.pin)}<span>${esc(where)}${item.place ? `, ${esc(item.place)}` : ''}</span></li>`);
    if (info.hours) out.push(`<li>${svg(I.clock)}<span>${esc(prettyHours(info.hours, lang))}</span></li>`);
    if (info.phone) {
      for (const p of info.phone.split(/\s*;\s*/).slice(0, 3)) {
        out.push(`<li>${svg(I.phone)}<a href="tel:${esc(p.replace(/[^\d+]/g, ''))}">${esc(p)}</a></li>`);
      }
    }
    if (info.site) {
      const href = /^https?:\/\//.test(info.site) ? info.site : `https://${info.site}`;
      const label = info.site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
      out.push(`<li>${svg(I.globe)}<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a></li>`);
    }
    if (info.insta) out.push(`<li>${svg(I.globe)}<span>${esc(info.insta)}</span></li>`);
    return out.length ? `<ul class="yoobi-facts">${out.join('')}</ul>` : '';
  }

  function section(title, items) {
    if (!items.length) return '';
    return `<div class="yoobi-section"><h3>${esc(title)}</h3>${items.map((r, i) => `<div class="yoobi-row" tabindex="0" data-i="${i}">
      ${dot(r)}<span class="yoobi-row-text"><div class="yoobi-row-title">${esc(r.title)}</div>
      <div class="yoobi-row-sub">${esc(r.type)}</div></span></div>`).join('')}</div>`;
  }

  let related = [];
  function show({ item, title, type, extra = '', inside = [], nearby = [], at }) {
    related = [...inside, ...nearby];
    const coords = `${at[1].toFixed(5)}, ${at[0].toFixed(5)}`;
    card.innerHTML = `<button type="button" class="yoobi-icon-btn yoobi-x" aria-label="${esc(t.close)}" title="${esc(t.close)}">${svg(I.close)}</button>
      <div class="yoobi-card-head">${dot(item)}<div><h2>${esc(title)}</h2><div class="yoobi-card-type">${esc(type)}</div></div></div>
      ${extra}${section(`${t.inside} · ${inside.length}`, inside)}${section(t.nearby, nearby)}
      <div class="yoobi-coords"><span>${coords}</span><button type="button" title="${esc(t.copy)}">${svg(I.copy, 14)}<span>${esc(t.copy)}</span></button></div>`;
    card.setAttribute('aria-label', title);
    card.classList.remove('yoobi-hidden');
    card.querySelector('.yoobi-x').addEventListener('click', close);
    const copy = card.querySelector('.yoobi-coords button');
    copy.addEventListener('click', () => {
      const done = () => { copy.lastChild.textContent = t.copied; };
      navigator.clipboard?.writeText(coords).then(done, () => {});
    });
    card.querySelectorAll('.yoobi-section .yoobi-row').forEach((row, i) => {
      const go = () => {
        // Индексы секций: сначала «в здании», затем «рядом».
        const r = related[i];
        map.easeTo({ center: [r.lon, r.lat] });
        open(r);
      };
      row.addEventListener('click', go);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    });
    pinAt = at;
    pin.classList.remove('yoobi-hidden');
    placePin();
  }

  /** Открыть карточку результата поиска (объект из search.search/nearby/inside). */
  function open(item) {
    const radius = { address: 40, street: 120, poi: 25 }[item.kind];
    const nearby = radius
      ? search.nearby(item.lon, item.lat, { radius, lang, limit: 7 })
        .filter((r) => r.id !== item.id).slice(0, item.kind === 'poi' ? 4 : 6)
      : [];
    show({
      item,
      title: item.title,
      type: item.kind === 'poi' ? [item.type, item.place].filter(Boolean).join(' · ') : item.subtitle,
      extra: facts(item),
      nearby,
      at: [item.lon, item.lat],
    });
  }

  function close() {
    card.classList.add('yoobi-hidden');
    pin.classList.add('yoobi-hidden');
    pinAt = null;
    setSelection(null);
  }

  // Подсветка выбранного дома — отдельный источник поверх стиля.
  function setSelection(feature) {
    const data = { type: 'FeatureCollection', features: feature ? [{ type: 'Feature', geometry: feature.geometry, properties: {
      height: (feature.properties.render_height || 0) + 0.4, base: feature.properties.render_min_height || 0 } }] : [] };
    if (!map.getSource('yoobi-selection')) {
      if (!feature) return;
      map.addSource('yoobi-selection', { type: 'geojson', data });
      const threeD = map.getLayer('building-3d') && map.getLayoutProperty('building-3d', 'visibility') !== 'none';
      map.addLayer({ id: 'yoobi-selection-fill', type: threeD ? 'fill-extrusion' : 'fill', source: 'yoobi-selection',
        paint: threeD
          ? { 'fill-extrusion-color': '#6FA3F0', 'fill-extrusion-opacity': 0.55, 'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'base'] }
          : { 'fill-color': '#6FA3F0', 'fill-opacity': 0.35 } });
      map.addLayer({ id: 'yoobi-selection-line', type: 'line', source: 'yoobi-selection',
        paint: { 'line-color': '#2F6FE4', 'line-width': 2 } });
      return;
    }
    map.getSource('yoobi-selection').setData(data);
  }

  // Нажатие на карту: место → его карточка, дом → адрес и организации внутри.
  function onClick(e) {
    const layers = [...PLACE_LAYERS, ...BUILDING_LAYERS].filter((id) => map.getLayer(id));
    const features = map.queryRenderedFeatures(e.point, { layers });
    const placeFeature = features.find((f) => PLACE_LAYERS.includes(f.layer.id));
    if (placeFeature) {
      const p = placeFeature.properties;
      const name = p['name:ru'] || p.name || '';
      const [lon, lat] = placeFeature.geometry.type === 'Point' ? placeFeature.geometry.coordinates : [e.lngLat.lng, e.lngLat.lat];
      const same = search.nearby(lon, lat, { radius: 80, lang, limit: 30 })
        .find((r) => normalize(r.title) === normalize(name) || normalize(r.title) === normalize(p.name || ''));
      setSelection(null);
      if (same) open(same);
      else {
        open({ kind: 'poi', title: name || t.building, type: '', subtitle: '', place: '', lon, lat,
          category: p.class === 'aerodrome_label' ? 'airport' : '', info: null });
      }
      return;
    }
    const hit = features.find((f) => BUILDING_LAYERS.includes(f.layer.id));
    const building = hit && pickPolygon(hit, [e.lngLat.lng, e.lngLat.lat]);
    if (building) {
      const found = search.inside(building.geometry, { lang });
      const h = building.properties.render_height;
      const levels = h ? Math.max(1, Math.round(h / 3.2)) : 0;
      const address = found.address;
      const item = address || { kind: 'address', title: t.building, lon: e.lngLat.lng, lat: e.lngLat.lat };
      const type = [t.building, levels > 1 ? t.floors(levels) : '', address?.place].filter(Boolean).join(' · ');
      const nearby = found.places.length ? [] : search.nearby(e.lngLat.lng, e.lngLat.lat, { radius: 40, lang, limit: 5 });
      show({ item, title: address ? address.title : t.building, type, inside: found.places, nearby,
        at: [e.lngLat.lng, e.lngLat.lat] });
      setSelection(building);
      return;
    }
    if (!card.classList.contains('yoobi-hidden')) close();
  }
  const pointer = () => { map.getCanvas().style.cursor = 'pointer'; };
  const reset = () => { map.getCanvas().style.cursor = ''; };
  const hover = PLACE_LAYERS.filter((id) => map.getLayer(id));
  if (clickable) {
    map.on('click', onClick);
    map.on('mouseenter', hover, pointer);
    map.on('mouseleave', hover, reset);
  }
  const onKey = (e) => { if (e.key === 'Escape' && document.activeElement !== input) close(); };
  document.addEventListener('keydown', onKey);

  return {
    open,
    close,
    input,
    setLang(next) {
      lang = next;
      t = TEXT[lang] || TEXT.ru;
      applyText();
      if (input.value.trim()) run();
    },
    destroy() {
      map.off('move', placePin);
      map.off('click', onClick);
      map.off('mouseenter', hover, pointer);
      map.off('mouseleave', hover, reset);
      document.removeEventListener('keydown', onKey);
      setSelection(null);
      container.classList.remove('yoobi-has-panel');
      panel.remove();
      pin.remove();
    },
  };
}
