// Рисует картинки спрайта в SVG и раскладывает их на общий лист.

import { ICONS, categoryIcons } from '../src/categories.js';

const SHADOW = `<filter id="s" x="-20%" y="-20%" width="140%" height="150%">
  <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#000" flood-opacity="0.28"/>
</filter>`;

function glyph(iconName, cx, cy, size) {
  const k = size / 24;
  return `<path fill="#fff" transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${k})" d="${ICONS[iconName]}"/>`;
}

// Круглый значок категории (для мелких масштабов).
function circleIcon(color, icon) {
  const w = 32, h = 32, c = 16;
  return {
    width: w, height: h,
    body: `<g filter="url(#s)"><circle cx="${c}" cy="${c}" r="12" fill="#fff"/></g>
      <circle cx="${c}" cy="${c}" r="10.4" fill="${color}"/>
      ${glyph(icon, c, c, 13.5)}`,
  };
}

// Значок + белая «таблетка» под название. Средняя часть тянется под длину текста
// (stretchX), текст ставится в область content — справа от круга.
function pill(color, icon) {
  const w = 60, h = 36, cy = 18;
  return {
    width: w, height: h,
    body: `<g filter="url(#s)">
        <rect x="15" y="7" width="41" height="22" rx="11" fill="#fff"/>
        <circle cx="17" cy="${cy}" r="13" fill="#fff"/>
      </g>
      <circle cx="17" cy="${cy}" r="11" fill="${color}"/>
      ${glyph(icon, 17, cy, 14)}`,
    // Тянутся только середина по ширине и узкая полоса по высоте; стиль подбирает
    // отступы так, чтобы по высоте растяжения не было и круг оставался круглым.
    stretchX: [[34, 44]],
    stretchY: [[17, 19]],
    content: [33, 9, 45, 27],
  };
}

// Треугольник вершины.
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
  }
  images.peak = peak();
  return images;
}

// Раскладка «полками»: картинки в строку, пока влезают в ширину листа.
export function layoutSprite(images, sheetWidth = 256, gap = 4) {
  const entries = Object.entries(images).sort((a, b) => b[1].height - a[1].height);
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
  const parts = Object.values(placed).map(
    (p) => `<g transform="translate(${p.x} ${p.y})">${p.body}</g>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>${SHADOW}</defs>
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
