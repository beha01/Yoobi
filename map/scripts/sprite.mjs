// Рисует картинки спрайта в SVG и раскладывает их на общий лист.
// Размеры — в CSS-пикселях; спрайт собирается в 1x и 2x.

import { ICONS, CATEGORIES, categoryIcons } from '../src/categories.js';
import { PILL, MARK } from '../src/style.js';

const LANDMARK = new Set(CATEGORIES.filter((c) => c.landmark).map((c) => c.id));

const DEFS = `
<filter id="shadow" x="-30%" y="-30%" width="160%" height="170%">
  <feDropShadow dx="0" dy="1" stdDeviation="1.3" flood-color="#1b2a3a" flood-opacity="0.26"/>
</filter>
<filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
  <feGaussianBlur stdDeviation="0.9"/>
</filter>
<filter id="softer" x="-30%" y="-30%" width="160%" height="160%">
  <feGaussianBlur stdDeviation="1.8"/>
</filter>
<radialGradient id="crown" cx="38%" cy="34%" r="70%">
  <stop offset="0" stop-color="#9BD36E"/>
  <stop offset="0.55" stop-color="#6DB34A"/>
  <stop offset="1" stop-color="#4C9236"/>
</radialGradient>
<radialGradient id="crown2" cx="38%" cy="34%" r="70%">
  <stop offset="0" stop-color="#8CCB60"/>
  <stop offset="0.55" stop-color="#5EA640"/>
  <stop offset="1" stop-color="#3F8430"/>
</radialGradient>`;

function glyph(iconName, cx, cy, size) {
  const k = size / 24;
  return `<path fill="#fff" transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${k})" d="${ICONS[iconName]}"/>`;
}

function badge(color, icon, cx, cy, r) {
  return `<g filter="url(#shadow)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/></g>
    <circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="${color}"/>
    ${glyph(icon, cx, cy, r * 1.07)}`;
}

// Круглый значок (мелкие масштабы).
function circleIcon(color, icon) {
  return { width: 30, height: 30, body: badge(color, icon, 15, 15, 12.5) };
}

// Значок слева + белая «таблетка» под название (одна строка).
function pill(color, icon) {
  const { width: w, height: h, circleX: cx, contentLeft: cl, contentHeight: ch } = PILL;
  const top = (h - ch) / 2;
  return {
    width: w, height: h,
    body: `<g filter="url(#shadow)"><rect x="18" y="4" width="${w - 22}" height="${h - 8}" rx="8" fill="#fff"/></g>
      ${badge(color, icon, cx, h / 2, 15)}`,
    stretchX: [[cl + 3, w - 14]],
    stretchY: [[h / 2 - 1, h / 2 + 1]],
    content: [cl, top, w - 12, top + ch],
  };
}

// Значок над зданием + полупрозрачная плашка под ним (подпись в несколько строк).
// Растягиваются только поля плашки слева и справа от круга, поэтому круг не искажается.
function mark(color, icon) {
  const { width: w, circleY: cy, contentTop: ct, contentHeight: ch } = MARK;
  return {
    width: w, height: MARK.height,
    body: `<g filter="url(#shadow)"><rect x="4" y="36" width="${w - 8}" height="24" rx="8" fill="#fff" fill-opacity="0.94"/></g>
      ${badge(color, icon, w / 2, cy, 15)}`,
    stretchX: [[6, 16], [w - 16, w - 6]],
    stretchY: [[46, 50]],
    content: [10, ct, w - 10, ct + ch],
  };
}

// Зелёная плашка для названий парков и садов.
function parkLabel() {
  return {
    width: 40, height: 30,
    body: '<rect x="2" y="2" width="36" height="26" rx="9" fill="#4B9A3A" fill-opacity="0.9"/>',
    stretchX: [[12, 28]],
    stretchY: [[13, 17]],
    content: [10, 7, 30, 23],
  };
}

// Номер подъезда.
function entranceLabel() {
  return {
    width: 24, height: 20,
    body: '<rect x="1.5" y="1.5" width="21" height="17" rx="5" fill="#fff" stroke="#8E8579" stroke-width="1"/>',
    stretchX: [[8, 16]],
    stretchY: [[9, 11]],
    content: [6, 4, 18, 16],
  };
}

function entranceDot() {
  return {
    width: 12, height: 12,
    body: '<circle cx="6" cy="6" r="4.2" fill="#fff" stroke="#8E8579" stroke-width="1.4"/>',
  };
}

// Крона дерева с тенью (вид сверху).
function crown(cx, cy, r, fill = 'crown') {
  return `<ellipse cx="${cx + r * 0.22}" cy="${cy + r * 0.28}" rx="${r}" ry="${r * 0.92}" fill="#2f5a22" fill-opacity="0.32" filter="url(#${r > 11 ? 'softer' : 'soft'})"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${fill})"/>`;
}

// Ряд деревьев для line-pattern: высота картинки = ширине линии (диаметру кроны).
// Между кронами — просветы, размеры и оттенки чуть разные, чтобы ряд не выглядел штампом.
function treeRow() {
  return {
    width: 168, height: 36,
    body: crown(20, 17, 14.8) + crown(76, 17, 16.4, 'crown2') + crown(132, 17, 14),
  };
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

// Одно дерево из OSM (natural=tree). Картинка крупная, чтобы вблизи не мылилась.
function tree() {
  return { width: 40, height: 40, body: crown(19, 19, 15) };
}

function dot(r, ring, center) {
  const s = Math.ceil(r * 2 + 4);
  const c = s / 2;
  return {
    width: s, height: s,
    body: `<circle cx="${c}" cy="${c}" r="${r}" fill="#fff" stroke="${ring}" stroke-width="1.8"/>`
      + (center ? `<circle cx="${c}" cy="${c}" r="${r * 0.42}" fill="${ring}"/>` : ''),
  };
}

function peak() {
  return {
    width: 14, height: 13,
    body: '<path d="M7 1.5 12.8 11.5H1.2z" fill="#8B6B4A" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/>',
  };
}

export function spriteImages() {
  const images = {};
  for (const { category, icon, color } of categoryIcons()) {
    images[`poi-${category}-${icon}`] = circleIcon(color, icon);
    images[`pill-${category}-${icon}`] = pill(color, icon);
    if (LANDMARK.has(category)) images[`mark-${category}-${icon}`] = mark(color, icon);
  }
  images['label-park'] = parkLabel();
  images['label-entrance'] = entranceLabel();
  images['entrance-dot'] = entranceDot();
  images['tree-row'] = treeRow();
  images.tree = tree();
  images['pattern-park'] = treePattern(96, 9, 6, 9, '#A6D57E', 7);
  images['pattern-wood'] = treePattern(64, 14, 5.5, 8, '#86C463', 11);
  images['dot-capital'] = dot(5.5, '#2B2B2B', true);
  images['dot-city'] = dot(4, '#3A3A3A', false);
  images['dot-town'] = dot(3, '#4A4A4A', false);
  images.peak = peak();
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
<defs>${DEFS}${clips.join('')}</defs>
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
