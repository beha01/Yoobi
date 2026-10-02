// Нажатие на соседнюю страну: пульс в точке касания и всплывающее сообщение
// с размытым фоном. Работает с любым MapLibre GL JS; для мобильных SDK обработайте
// нажатие на слои 'outside-frost' / 'neighbor-lock' своими средствами.
//
//   const off = enableLockedCountries(map, { lang: 'ru' });
//   off(); // отключить

import { NEIGHBORS } from './borders.js';

const TEXT = {
  ru: (name) => [name ? `${name} пока недоступен` : 'Эта страна пока недоступна', 'Карта работает только по Таджикистану'],
  tg: (name) => [name ? `${name} ҳоло дастрас нест` : 'Ин кишвар ҳоло дастрас нест', 'Харита танҳо Тоҷикистонро дар бар мегирад'],
  en: (name) => [name ? `${name} is not available yet` : 'This country is not available yet', 'The map covers Tajikistan only'],
};

const CSS = `
.yoobi-lock-toast{position:absolute;left:50%;bottom:32px;z-index:10;display:flex;align-items:center;gap:12px;
  padding:12px 18px 12px 12px;border-radius:18px;background:rgba(255,255,255,.72);color:#2a2622;
  -webkit-backdrop-filter:blur(14px) saturate(1.4);backdrop-filter:blur(14px) saturate(1.4);
  box-shadow:0 10px 30px rgba(30,25,20,.18),inset 0 0 0 1px rgba(255,255,255,.6);
  font:500 14px/1.3 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;pointer-events:none;
  transform:translate(-50%,24px) scale(.96);opacity:0;transition:transform .45s cubic-bezier(.2,1.4,.4,1),opacity .25s}
.yoobi-lock-toast.show{transform:translate(-50%,0) scale(1);opacity:1}
.yoobi-lock-toast b{display:block;font-weight:650;font-size:15px}
.yoobi-lock-toast span{color:#7a7266;font-size:13px}
.yoobi-lock-icon{flex:none;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;
  background:#2F2A25;color:#fff}
.yoobi-lock-toast.show .yoobi-lock-icon svg{animation:yoobi-shake .5s .15s}
@keyframes yoobi-shake{20%{transform:rotate(-14deg)}40%{transform:rotate(12deg)}60%{transform:rotate(-8deg)}80%{transform:rotate(4deg)}}
[data-yoobi-theme="dark"] .yoobi-lock-toast{background:rgba(35,40,48,.74);color:#E8EBEF;
  box-shadow:0 10px 30px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.08)}
[data-yoobi-theme="dark"] .yoobi-lock-toast span{color:#9AA3AE}
[data-yoobi-theme="dark"] .yoobi-lock-icon{background:#E8EBEF;color:#232830}
.yoobi-lock-pulse{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;pointer-events:none;
  background:rgba(255,255,255,.9);box-shadow:0 0 0 0 rgba(143,123,174,.55);animation:yoobi-pulse .8s ease-out forwards}
@keyframes yoobi-pulse{to{transform:scale(3.2);opacity:0;box-shadow:0 0 0 14px rgba(143,123,174,0)}}
@media (prefers-reduced-motion:reduce){.yoobi-lock-toast,.yoobi-lock-toast.show .yoobi-lock-icon svg,.yoobi-lock-pulse{transition:none;animation:none}}
`;

const LOCK_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>';

// Ближайший сосед к точке — чтобы назвать страну в сообщении.
function nearestNeighbor(lngLat, lang) {
  let best = null;
  let bestD = Infinity;
  for (const f of NEIGHBORS.features) {
    const [x, y] = f.geometry.coordinates;
    const d = (x - lngLat.lng) ** 2 + (y - lngLat.lat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = f.properties[`name_${lang}`];
    }
  }
  return bestD < 16 ? best : null;
}

export function enableLockedCountries(map, { lang = 'ru', duration = 2600, message } = {}) {
  const container = map.getContainer();
  if (!document.getElementById('yoobi-lock-css')) {
    const style = document.createElement('style');
    style.id = 'yoobi-lock-css';
    style.textContent = CSS;
    document.head.append(style);
  }
  const toast = document.createElement('div');
  toast.className = 'yoobi-lock-toast';
  toast.setAttribute('role', 'status');
  toast.innerHTML = `<div class="yoobi-lock-icon">${LOCK_SVG}</div><div><b></b><span></span></div>`;
  container.append(toast);
  let timer;

  const onClick = (e) => {
    const name = e.features?.[0]?.properties?.[`name_${lang}`] || nearestNeighbor(e.lngLat, lang);
    const [title, subtitle] = message ? message(name) : (TEXT[lang] || TEXT.ru)(name);
    toast.querySelector('b').textContent = title;
    toast.querySelector('span').textContent = subtitle;

    const pulse = document.createElement('div');
    pulse.className = 'yoobi-lock-pulse';
    pulse.style.left = `${e.point.x}px`;
    pulse.style.top = `${e.point.y}px`;
    container.append(pulse);
    setTimeout(() => pulse.remove(), 900);

    toast.classList.remove('show');
    void toast.offsetWidth; // перезапуск анимации
    toast.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove('show'), duration);
  };
  const layers = ['neighbor-lock', 'outside-frost'].filter((id) => map.getLayer(id));
  const pointer = () => { map.getCanvas().style.cursor = 'not-allowed'; };
  const reset = () => { map.getCanvas().style.cursor = ''; };
  map.on('click', layers, onClick);
  map.on('mouseenter', layers, pointer);
  map.on('mouseleave', layers, reset);

  return () => {
    map.off('click', layers, onClick);
    map.off('mouseenter', layers, pointer);
    map.off('mouseleave', layers, reset);
    clearTimeout(timer);
    toast.remove();
  };
}
