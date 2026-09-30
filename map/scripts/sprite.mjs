// Рисует картинки спрайта в SVG и раскладывает их на общий лист.
// Размеры — в CSS-пикселях; спрайт собирается в 1x и 2x, в дневной и ночной теме.

import { ICONS, categoryIcons } from '../src/categories.js';
import { POI_RADIUS, TREE_CROWN_PX } from '../src/style.js';

// Цвета подложек, колец и узоров: в ночной теме плашки тёмные, а значки остаются цветными.
const THEME = {
  light: {
    shadow: '#1b2a3a', shadowOpacity: 0.26, plate: '#fff', plateStroke: '#B7AC9D', door: '#7A6652',
    arrowRing: '#6B5B4B', arrowFill: '#3F7FD8', lockStroke: '#D9D3CA', lockGlyph: '#6F6A62',
    dotFill: '#fff', dotRings: ['#2B2B2B', '#3A3A3A', '#4A4A4A'], peak: '#8B6B4A', peakStroke: '#fff',
    // Кроны сверху: блик (свет с северо-востока, как у объёмных домов), середина, край.
    crowns: [['#AEDC86', '#7DBD5A', '#5C9D42'], ['#B8E190', '#89C563', '#68A949'], ['#A2D47C', '#71B050', '#52903A']],
    crownShadow: '#2f5a22', crownShadowOpacity: 0.3, park: '#4B9A3A', oneway: '#8E98A5', signals: '#2F3338',
    liftPost: '#4E5560', liftStripe: '#E0433F',
  },
  dark: {
    shadow: '#000000', shadowOpacity: 0.45, plate: '#2A303A', plateStroke: '#4A5260', door: '#C9B8A4',
    arrowRing: '#AEB5BF', arrowFill: '#6FA3F0', lockStroke: '#4A5260', lockGlyph: '#C8CDD5',
    dotFill: '#1C2129', dotRings: ['#E6E9ED', '#D0D5DC', '#B8BFC8'], peak: '#C7A57D', peakStroke: '#1C2129',
    crowns: [['#4E8C54', '#35703D', '#244F2C'], ['#559459', '#3A7742', '#27552F'], ['#48854E', '#306937', '#204828']],
    crownShadow: '#000000', crownShadowOpacity: 0.45, park: '#2F6B38', oneway: '#8A94A3', signals: '#15181D',
    liftPost: '#AEB5BF', liftStripe: '#E0433F',
  },
};
let T = THEME.light;

const defs = () => `
<filter id="shadow" x="-30%" y="-30%" width="160%" height="170%">
  <feDropShadow dx="0" dy="1" stdDeviation="1.3" flood-color="${T.shadow}" flood-opacity="${T.shadowOpacity}"/>
</filter>
<filter id="crownBlur" x="-40%" y="-40%" width="180%" height="180%">
  <feGaussianBlur stdDeviation="2.2"/>
</filter>
${T.crowns.map(([hi, mid, edge], i) => `<radialGradient id="tc${i}" cx="62%" cy="34%" r="72%">
  <stop offset="0" stop-color="${hi}"/>
  <stop offset="0.5" stop-color="${mid}"/>
  <stop offset="1" stop-color="${edge}"/>
</radialGradient>
<radialGradient id="tl${i}" cx="60%" cy="36%" r="65%">
  <stop offset="0" stop-color="${hi}" stop-opacity="0.9"/>
  <stop offset="1" stop-color="${mid}" stop-opacity="0"/>
</radialGradient>`).join('')}`;

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

// Плоская крона дерева (вид сверху), как в 2ГИС: гладкий круг с бликом, мягкие «шапки»
// листвы и тень на юго-запад. Круг диаметром TREE_CROWN_PX по центру картинки: стиль
// масштабирует его до настоящего диаметра кроны в метрах.
function treeCrown(shade) {
  const size = TREE_CROWN_PX + 12;
  const c = size / 2;
  const r = TREE_CROWN_PX / 2;
  const lobes = [[0.38, -0.3, 0.46], [-0.34, -0.2, 0.42], [0.05, 0.4, 0.44], [0.42, 0.24, 0.36], [-0.3, 0.3, 0.34]]
    .map(([dx, dy, k]) => `<circle cx="${c + dx * r}" cy="${c + dy * r}" r="${k * r}" fill="url(#tl${shade})" fill-opacity="0.55"/>`)
    .join('');
  return {
    width: size, height: size,
    body: `<circle cx="${c - r * 0.14}" cy="${c + r * 0.16}" r="${r * 0.98}" fill="${T.crownShadow}" fill-opacity="${T.crownShadowOpacity}" filter="url(#crownBlur)"/>
      <circle cx="${c}" cy="${c}" r="${r}" fill="url(#tc${shade})"/>
      ${lobes}
      <circle cx="${c}" cy="${c}" r="${r - 0.4}" fill="none" stroke="${T.crowns[shade][2]}" stroke-opacity="0.35" stroke-width="0.8"/>`,
  };
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
  for (const shade of [0, 1, 2]) images[`tree-crown-${shade}`] = treeCrown(shade);
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
