// Рисует картинки спрайта в SVG и раскладывает их на общий лист.
// Размеры — в CSS-пикселях; спрайт собирается в 1x и 2x, в дневной и ночной теме.

import { ICONS, categoryIcons } from '../src/categories.js';
import { POI_RADIUS } from '../src/style.js';

// Цвета подложек, колец и узоров: в ночной теме плашки тёмные, а значки остаются цветными.
const THEME = {
  light: {
    shadow: '#1b2a3a', shadowOpacity: 0.26, plate: '#fff', plateStroke: '#B7AC9D', door: '#7A6652',
    arrowRing: '#6B5B4B', arrowFill: '#3F7FD8', lockStroke: '#D9D3CA', lockGlyph: '#6F6A62',
    dotFill: '#fff', dotRings: ['#2B2B2B', '#3A3A3A', '#4A4A4A'], peak: '#8B6B4A', peakStroke: '#fff',
    wood: '#86C463', crown: ['#9BD36E', '#6DB34A', '#4C9236'], crown2: ['#8CCB60', '#5EA640', '#3F8430'],
    crownShadow: '#2f5a22', park: '#4B9A3A', oneway: '#8E98A5', signals: '#2F3338',
    liftPost: '#4E5560', liftStripe: '#E0433F',
  },
  dark: {
    shadow: '#000000', shadowOpacity: 0.45, plate: '#2A303A', plateStroke: '#4A5260', door: '#C9B8A4',
    arrowRing: '#AEB5BF', arrowFill: '#6FA3F0', lockStroke: '#4A5260', lockGlyph: '#C8CDD5',
    dotFill: '#1C2129', dotRings: ['#E6E9ED', '#D0D5DC', '#B8BFC8'], peak: '#C7A57D', peakStroke: '#1C2129',
    wood: '#1E3D2A', crown: ['#3F7F45', '#2D6634', '#1F4A26'], crown2: ['#397A40', '#285D30', '#1B4322'],
    crownShadow: '#000000', park: '#2F6B38', oneway: '#8A94A3', signals: '#15181D',
    liftPost: '#AEB5BF', liftStripe: '#E0433F',
  },
};
let T = THEME.light;

const defs = () => `
<filter id="shadow" x="-30%" y="-30%" width="160%" height="170%">
  <feDropShadow dx="0" dy="1" stdDeviation="1.3" flood-color="${T.shadow}" flood-opacity="${T.shadowOpacity}"/>
</filter>
<filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
  <feGaussianBlur stdDeviation="0.9"/>
</filter>
<filter id="softer" x="-30%" y="-30%" width="160%" height="160%">
  <feGaussianBlur stdDeviation="1.8"/>
</filter>
<radialGradient id="crown" cx="38%" cy="34%" r="70%">
  <stop offset="0" stop-color="${T.crown[0]}"/>
  <stop offset="0.55" stop-color="${T.crown[1]}"/>
  <stop offset="1" stop-color="${T.crown[2]}"/>
</radialGradient>
<radialGradient id="crown2" cx="38%" cy="34%" r="70%">
  <stop offset="0" stop-color="${T.crown2[0]}"/>
  <stop offset="0.55" stop-color="${T.crown2[1]}"/>
  <stop offset="1" stop-color="${T.crown2[2]}"/>
</radialGradient>`;

function glyph(iconName, cx, cy, size) {
  const k = size / 24;
  return `<path fill="#fff" transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${k})" d="${ICONS[iconName]}"/>`;
}

// Значок места, как в 2ГИС и Яндекс Картах: цветной круг с белым рисунком, тонкая
// светлая кайма и мягкая тень. 24×24, круг радиусом POI_RADIUS (по нему стиль
// отодвигает подпись).
function poiIcon(color, icon) {
  const r = POI_RADIUS;
  return {
    width: 24, height: 24,
    body: `<g filter="url(#shadow)"><circle cx="12" cy="12" r="${r}" fill="${T.plate}"/></g>
      <circle cx="12" cy="12" r="${r - 1.4}" fill="${color}"/>${glyph(icon, 12, 12, 11.5)}`,
  };
}

// Подъезд: значок двери слева, номер (и квартиры) справа.
function entranceLabel() {
  const k = 12 / 24;
  return {
    width: 34, height: 22,
    body: `<g filter="url(#shadow)"><rect x="1.5" y="1.5" width="31" height="19" rx="6" fill="${T.plate}"/></g>
      <rect x="1.5" y="1.5" width="31" height="19" rx="6" fill="none" stroke="${T.plateStroke}" stroke-width="0.8"/>
      <path fill="${T.door}" transform="translate(4 5) scale(${k})" d="${ICONS.door}"/>`,
    stretchX: [[18, 27]],
    stretchY: [[10, 12]],
    content: [17, 4, 29, 18],
  };
}

// Стрелка перед дверью (смотрит «вверх»; стиль поворачивает её к стене дома).
function entranceArrow() {
  return {
    width: 22, height: 22,
    body: `<g filter="url(#shadow)"><circle cx="11" cy="11" r="8.5" fill="${T.plate}"/></g>
      <circle cx="11" cy="11" r="8.5" fill="none" stroke="${T.arrowRing}" stroke-width="1.2"/>
      <path d="M11 4.8 15.4 12h-2.8v4.8H9.4V12H6.6z" fill="${T.arrowFill}"/>`,
  };
}

// Замок соседней страны: матовый круг со значком.
function lock() {
  return {
    width: 40, height: 40,
    body: `<g filter="url(#shadow)"><circle cx="20" cy="20" r="16" fill="${T.plate}" fill-opacity="0.96"/></g>
      <circle cx="20" cy="20" r="16" fill="none" stroke="${T.lockStroke}" stroke-width="1"/>
      <path fill="${T.lockGlyph}" transform="translate(10.5 10.5) scale(${19 / 24})" d="${ICONS.lock}"/>`,
  };
}

// Крона дерева с тенью (вид сверху).
function crown(cx, cy, r, fill = 'crown') {
  return `<ellipse cx="${cx + r * 0.22}" cy="${cy + r * 0.28}" rx="${r}" ry="${r * 0.92}" fill="${T.crownShadow}" fill-opacity="0.32" filter="url(#${r > 11 ? 'softer' : 'soft'})"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${fill})"/>`;
}


// Бесшовные узоры: кроны у краёв повторяются с другой стороны.
function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
function treePattern(size, count, rMin, rMax, background, seed) {
  const rnd = seeded(seed);
  const trees = [];
  for (let i = 0; i < count * 30 && trees.length < count; i++) {
    const t = { x: rnd() * size, y: rnd() * size, r: rMin + rnd() * (rMax - rMin) };
    const clash = trees.some((o) => {
      const dx = Math.min(Math.abs(o.x - t.x), size - Math.abs(o.x - t.x));
      const dy = Math.min(Math.abs(o.y - t.y), size - Math.abs(o.y - t.y));
      return Math.hypot(dx, dy) < (o.r + t.r) * 0.85;
    });
    if (!clash) trees.push(t);
  }
  let body = `<rect width="${size}" height="${size}" fill="${background}"/>`;
  trees.sort((a, b) => a.y - b.y);
  for (const t of trees) {
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        body += crown(t.x + dx, t.y + dy, t.r, t.r > (rMin + rMax) / 2 ? 'crown2' : 'crown');
      }
    }
  }
  return { width: size, height: size, body };
}


function dot(r, ring, center) {
  const s = Math.ceil(r * 2 + 4);
  const c = s / 2;
  return {
    width: s, height: s,
    body: `<circle cx="${c}" cy="${c}" r="${r}" fill="${T.dotFill}" stroke="${ring}" stroke-width="1.8"/>`
      + (center ? `<circle cx="${c}" cy="${c}" r="${r * 0.42}" fill="${ring}"/>` : ''),
  };
}

function peak() {
  return {
    width: 14, height: 13,
    body: `<path d="M7 1.5 12.8 11.5H1.2z" fill="${T.peak}" stroke="${T.peakStroke}" stroke-width="1.3" stroke-linejoin="round"/>`,
  };
}

// Стрелка одностороннего движения: белая «разметка» по направлению линии дороги.
function oneway() {
  return { width: 20, height: 12, body: `<path d="M1.5 4.6h11V1.4L18.5 6l-6 4.6V7.4h-11z" fill="${T.oneway}"/>` };
}

// Светофор: три сигнала в тёмном корпусе с каймой под цвет плашек.
function signals() {
  return {
    width: 12, height: 22,
    body: `<g filter="url(#shadow)"><rect x="1" y="1" width="10" height="20" rx="3.5" fill="${T.signals}" stroke="${T.plate}" stroke-width="1.2"/></g>
      <circle cx="6" cy="5.8" r="2.3" fill="#F0494E"/><circle cx="6" cy="11" r="2.3" fill="#F6B93B"/>
      <circle cx="6" cy="16.2" r="2.3" fill="#3CC46A"/>`,
  };
}

// Парковка: синий квадрат с белой «P», как на дорожном знаке.
function parking() {
  return {
    width: 20, height: 20,
    body: `<g filter="url(#shadow)"><rect x="2" y="2" width="16" height="16" rx="4" fill="#2F6FE4" stroke="${T.plate}" stroke-width="1.2"/></g>
      <path fill="#fff" transform="translate(4 4) scale(${12 / 24})" d="${ICONS.parking}"/>`,
  };
}

// Шлагбаум: столбик и полосатая стрела.
function liftGate() {
  const stripes = [6, 10, 14].map((x) => `<rect x="${x}" y="8" width="2.2" height="3" fill="${T.liftStripe}"/>`).join('');
  return {
    width: 22, height: 16,
    body: `<g filter="url(#shadow)"><rect x="2" y="5" width="3" height="10" rx="1" fill="${T.liftPost}"/>
      <rect x="4" y="8" width="16" height="3" rx="1.5" fill="#fff" stroke="${T.liftStripe}" stroke-width="0.6"/></g>${stripes}`,
  };
}

// Маленький круглый значок для мелочей: ворота, лавочки, фонтаны, туалеты, вода.
function smallBadge(color, icon) {
  return {
    width: 18, height: 18,
    body: `<g filter="url(#shadow)"><circle cx="9" cy="9" r="7.6" fill="${T.plate}"/></g>
      <circle cx="9" cy="9" r="6.3" fill="${color}"/>${glyph(icon, 9, 9, 8)}`,
  };
}

export function spriteImages(theme = 'light') {
  T = THEME[theme];
  const images = {};
  for (const { category, icon, color } of categoryIcons()) {
    images[`poi-${category}-${icon}`] = poiIcon(color, icon);
  }
  images['label-entrance'] = entranceLabel();
  images['entrance-arrow'] = entranceArrow();
  images.lock = lock();
  images['pattern-wood'] = treePattern(64, 14, 5.5, 8, T.wood, 11);
  images['dot-capital'] = dot(5.5, T.dotRings[0], true);
  images['dot-city'] = dot(4, T.dotRings[1], false);
  images['dot-town'] = dot(3, T.dotRings[2], false);
  images.peak = peak();
  images.oneway = oneway();
  images.signals = signals();
  images.parking = parking();
  images['lift-gate'] = liftGate();
  images.gate = smallBadge('#8A7F72', 'gate');
  images.bench = smallBadge('#9A7B55', 'bench');
  images.fountain = smallBadge('#3F8FD8', 'fountain');
  images.toilets = smallBadge('#6E7D95', 'wc');
  images.water = smallBadge('#35A3DC', 'drop');
  return images;
}

// Раскладка «полками»: картинки в строку, пока влезают в ширину листа.
export function layoutSprite(images, sheetWidth = 512, gap = 4) {
  const entries = Object.entries(images).sort((a, b) => b[1].height - a[1].height || a[0].localeCompare(b[0]));
  let x = 0, y = 0, rowH = 0;
  const placed = {};
  for (const [id, img] of entries) {
    if (x + img.width > sheetWidth) {
      x = 0;
      y += rowH + gap;
      rowH = 0;
    }
    placed[id] = { ...img, x, y };
    x += img.width + gap;
    rowH = Math.max(rowH, img.height);
  }
  return { placed, width: sheetWidth, height: y + rowH };
}

export function sheetSvg({ placed, width, height }) {
  const clips = [];
  const parts = Object.values(placed).map((p, i) => {
    clips.push(`<clipPath id="c${i}"><rect width="${p.width}" height="${p.height}"/></clipPath>`);
    return `<g transform="translate(${p.x} ${p.y})"><g clip-path="url(#c${i})">${p.body}</g></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>${defs()}${clips.join('')}</defs>
${parts.join('\n')}
</svg>`;
}

export function spriteIndex({ placed }, pixelRatio) {
  const k = pixelRatio;
  const index = {};
  for (const [id, p] of Object.entries(placed)) {
    index[id] = {
      x: p.x * k, y: p.y * k, width: p.width * k, height: p.height * k, pixelRatio,
      ...(p.stretchX && { stretchX: p.stretchX.map(([a, b]) => [a * k, b * k]) }),
      ...(p.stretchY && { stretchY: p.stretchY.map(([a, b]) => [a * k, b * k]) }),
      ...(p.content && { content: p.content.map((v) => v * k) }),
    };
  }
  return index;
}
