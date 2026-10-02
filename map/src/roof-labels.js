// Номера домов на крышах в объёмном виде, как в 2ГИС: номер стоит над крышей своего дома,
// а не на земле под ним, и прячется за домами, которые стоят перед ним.
//
//   import { enableRoofLabels } from './map/src/index.js';
//   enableRoofLabels(map);
//
// Обычный слой подписей MapLibre не умеет ставить подпись на высоту и рисует её поверх всех
// домов. Этот слой (WebGL2) рисует номер квадратиком, повёрнутым к камере, на высоте крыши
// (render_height из тайлов) и пишет глубину как дома: передние дома его закрывают. Пока
// карта наклонена и включены объёмные дома, плоский слой housenumber скрыт; в виде сверху
// всё как раньше. Подписи не налезают друг на друга: ближние к камере важнее.

import { compile, localFrame, localOrigin, toLocal } from './objects3d.js';

const ID = 'yoobi-roof-labels';
const FLAT = 'housenumber';
const MINZOOM = 16;
const PITCH_ON = 22;   // наклон, с которого номера переезжают на крыши…
const PITCH_OFF = 16;  // …и обратно на землю (зазор — чтобы не мигали)
const ATLAS = 2048;
const SCALE = 2;       // атлас в двойном разрешении — чётко и на телефонах
const CELL = 60;       // клетка поиска домов, м
const STRIDE = 12;
const MAX_LABELS = 6000;

const HEAD = '#version 300 es\nprecision highp float;\n';
const VS = `${HEAD}
uniform mat4 u_matrix;
uniform vec3 u_camera;
uniform vec2 u_viewport;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 a_pos;   // x, y, z крыши, сдвиг к камере
layout(location = 2) in vec4 a_size;  // ширина и высота в пикселях, прозрачность
layout(location = 3) in vec4 a_uv;
out vec2 v_uv;
out float v_alpha;
void main() {
  vec3 p = a_pos.xyz;
  // Чуть ближе к камере, чтобы своя крыша не закрывала номер; дома перед ним — закрывают.
  vec3 toCam = u_camera - p;
  p += normalize(toCam) * min(a_pos.w, length(toCam) * 0.5);
  vec4 c = u_matrix * vec4(p, 1.0);
  vec2 offset = (a_corner - vec2(0.5, 0.0)) * a_size.xy;
  c.xy += offset * 2.0 / u_viewport * c.w;
  v_uv = mix(a_uv.xy, a_uv.zw, vec2(a_corner.x, 1.0 - a_corner.y));
  v_alpha = a_size.z;
  gl_Position = c;
}`;
const FS = `${HEAD}
uniform sampler2D u_atlas;
in vec2 v_uv;
in float v_alpha;
out vec4 fragColor;
void main() {
  fragColor = texture(u_atlas, v_uv) * v_alpha;
}`;

const COLORS = {
  light: { text: '#5F554B', halo: 'rgba(255,253,249,0.96)', roof: 'rgba(255,253,249,0.0)' },
  dark: { text: '#C9D0D8', halo: 'rgba(28,33,41,0.95)', roof: 'rgba(28,33,41,0.0)' },
};
const FONT = '600 {px}px "Noto Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const houseText = (v) => String(v ?? '').replace(/\\/g, '/').trim();

class RoofLabelsLayer {
  constructor(map, { source = 'openmaptiles', size = 12 } = {}) {
    this.id = ID;
    this.type = 'custom';
    this.renderingMode = '3d';
    this.map = map;
    this.source = source;
    this.size = size;
    this.labels = [];      // { x, y, z, text, w, h, uv }
    this.origin = null;
    this.active = false;
    this.hidFlat = false;
    this.timer = null;
    this.last = 0;
    this.theme = null;
    this.atlasDirty = true;
    this.entries = new Map(); // текст -> { u0, v0, u1, v1, w, h } в атласе
    this.cursor = { x: 1, y: 1, row: 0 };
    this.onData = (e) => {
      if (e.sourceId === this.source && (e.tile || e.isSourceLoaded)) this.schedule();
    };
    this.onMove = () => this.schedule();
    this.onPitch = () => {
      const want = this.wanted();
      if (want !== this.active) this.schedule();
    };
  }

  onAdd(map, gl) {
    this.gl = gl;
    if (typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext)) {
      this.failed = true;
      return;
    }
    try {
      this.program = compile(gl, VS, FS);
    } catch (err) {
      this.failed = true;
      console.warn('Номера на крышах выключены:', err.message);
      return;
    }
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS;
    this.canvas.height = ATLAS;
    this.ctx = this.canvas.getContext('2d');
    this.texture = gl.createTexture();
    this.instances = gl.createBuffer();
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    this.quad = quad;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    for (const [loc, offset] of [[1, 0], [2, 16], [3, 32]]) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, STRIDE * 4, offset);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
    // Шрифт карты может ещё грузиться: атлас перерисуется, когда он придёт.
    document.fonts?.load?.(FONT.replace('{px}', String(this.size * SCALE)))
      .then(() => { this.resetAtlas(); this.schedule(); }, () => {});
    map.on('sourcedata', this.onData);
    map.on('moveend', this.onMove);
    map.on('pitch', this.onPitch);
    map.on('styledata', this.onMove);
    this.schedule();
  }

  onRemove(map, gl) {
    map.off('sourcedata', this.onData);
    map.off('moveend', this.onMove);
    map.off('pitch', this.onPitch);
    map.off('styledata', this.onMove);
    clearTimeout(this.timer);
    this.showFlat();
    if (this.failed || !gl) return;
    gl.deleteProgram(this.program.program);
    gl.deleteBuffer(this.instances);
    gl.deleteBuffer(this.quad);
    gl.deleteTexture(this.texture);
    gl.deleteVertexArray(this.vao);
  }

  // Номера на крышах — при наклоне, на 16+ зуме и с объёмными домами.
  wanted() {
    const map = this.map;
    if (this.failed || map.getZoom() < MINZOOM) return false;
    const pitch = map.getPitch();
    if (pitch < (this.active ? PITCH_OFF : PITCH_ON)) return false;
    const has3d = map.getLayer('building-3d') && map.getLayoutProperty('building-3d', 'visibility') !== 'none';
    if (!has3d || !map.getLayer(FLAT)) return false;
    // Плоские номера скрыло само приложение — тогда и на крышах их нет.
    return this.hidFlat || map.getLayoutProperty(FLAT, 'visibility') !== 'none';
  }

  hideFlat() {
    const map = this.map;
    if (!map.getLayer(FLAT)) return;
    if (map.getLayoutProperty(FLAT, 'visibility') !== 'none') {
      map.setLayoutProperty(FLAT, 'visibility', 'none');
      this.hidFlat = true;
    }
  }

  showFlat() {
    if (!this.hidFlat) return;
    this.hidFlat = false;
    if (this.map.getLayer(FLAT)) this.map.setLayoutProperty(FLAT, 'visibility', 'visible');
  }

  schedule() {
    if (this.timer) return;
    const wait = Math.max(0, 200 - (performance.now() - this.last));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.last = performance.now();
      this.rebuild();
    }, wait);
  }

  rebuild() {
    const map = this.map;
    // После смены стиля слой housenumber новый и снова виден.
    if (this.hidFlat && map.getLayer(FLAT) && map.getLayoutProperty(FLAT, 'visibility') !== 'none') this.hidFlat = false;
    const want = this.wanted();
    if (!want) {
      this.active = false;
      this.labels = [];
      this.showFlat();
      map.triggerRepaint();
      return;
    }
    let buildings;
    let numbers;
    try {
      buildings = map.querySourceFeatures(this.source, { sourceLayer: 'building' });
      numbers = map.querySourceFeatures(this.source, { sourceLayer: 'housenumber' });
    } catch {
      return;
    }
    const origin = localOrigin(map);
    // Дома — в сетку по рамкам: для номера быстро найти дом, в котором он стоит.
    const grid = new Map();
    const homes = [];
    for (const f of buildings) {
      const g = f.geometry;
      const polys = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
      const height = Number(f.properties?.render_height) || 0;
      if (height <= 0) continue;
      for (const poly of polys) {
        const ring = (poly[0] || []).map(([lng, lat]) => toLocal(origin, lng, lat));
        if (ring.length < 3) continue;
        let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
        for (const [x, y] of ring) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        if (x1 - x0 > 2000 || y1 - y0 > 2000) continue;
        const i = homes.push({ ring, height, area: (x1 - x0) * (y1 - y0), box: [x0, y0, x1, y1] }) - 1;
        for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
          for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) {
            const key = `${cx},${cy}`;
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(i);
          }
        }
      }
    }
    const terrain = map.getTerrain?.() ? map : null;
    const seen = new Set();
    const labels = [];
    for (const f of numbers) {
      if (labels.length >= MAX_LABELS || f.geometry?.type !== 'Point') continue;
      const text = houseText(f.properties?.housenumber);
      if (!text || text.length > 12) continue;
      const [lng, lat] = f.geometry.coordinates;
      const [x, y] = toLocal(origin, lng, lat);
      const key = `${text}|${Math.round(x / 3)},${Math.round(y / 3)}`;
      if (seen.has(key)) continue; // номер на краю тайла приходит и из соседнего
      seen.add(key);
      let best = null;
      for (const i of grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`) || []) {
        const h = homes[i];
        const [x0, y0, x1, y1] = h.box;
        if (x < x0 || x > x1 || y < y0 || y > y1 || !pointInRing(x, y, h.ring)) continue;
        if (!best || h.area < best.area) best = h;
      }
      const ground = terrain ? terrain.queryTerrainElevation([lng, lat]) || 0 : 0;
      labels.push({ x, y, z: ground + (best ? best.height + 0.6 : 0.6), text, onRoof: !!best });
    }
    this.origin = origin;
    this.labels = labels;
    this.active = true;
    this.hideFlat();
    map.triggerRepaint();
  }

  resetAtlas() {
    this.entries.clear();
    this.cursor = { x: 1, y: 1, row: 0 };
    this.atlasDirty = true;
    this.ctx?.clearRect(0, 0, ATLAS, ATLAS);
  }

  // Номер в атласе: тёмный текст со светлой обводкой, как у плоских номеров.
  entry(text) {
    let e = this.entries.get(text);
    if (e) return e;
    const ctx = this.ctx;
    const px = this.size * SCALE;
    const halo = 3 * SCALE;
    ctx.font = FONT.replace('{px}', String(px));
    const w = Math.ceil(ctx.measureText(text).width) + halo * 2 + 2;
    const h = Math.ceil(px * 1.35) + halo * 2;
    let { x, y, row } = this.cursor;
    if (x + w > ATLAS) { x = 1; y += row + 1; row = 0; }
    if (y + h > ATLAS) {
      this.resetAtlas();
      return this.entry(text);
    }
    const colors = COLORS[this.theme] || COLORS.light;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = halo * 2;
    ctx.strokeStyle = colors.halo;
    ctx.fillStyle = colors.text;
    ctx.strokeText(text, x + w / 2, y + h / 2);
    ctx.fillText(text, x + w / 2, y + h / 2);
    e = { u0: x / ATLAS, v0: y / ATLAS, u1: (x + w) / ATLAS, v1: (y + h) / ATLAS, w: w / SCALE, h: h / SCALE };
    this.entries.set(text, e);
    this.cursor = { x: x + w + 1, y, row: Math.max(row, h) };
    this.atlasDirty = true;
    return e;
  }

  render(gl, args) {
    if (this.failed || !this.active || !this.labels.length) return;
    const frame = localFrame(this.map, args, this.origin);
    if (!frame) return;
    const theme = this.map.getContainer().dataset.yoobiTheme === 'dark' ? 'dark' : 'light';
    if (theme !== this.theme) {
      this.theme = theme;
      this.resetAtlas();
    }
    const { m, matrix, camera } = frame;
    const canvas = this.map.getCanvas();
    const dpr = window.devicePixelRatio || 1;
    const vw = canvas.width;
    const vh = canvas.height;
    const zoom = this.map.getZoom();
    const fade = Math.min(1, Math.max(0, (zoom - MINZOOM) / 0.4));
    // Где номер на экране; ближние к камере — первыми, налезающие на уже поставленные — пропускаются.
    const placed = [];
    for (const l of this.labels) {
      const cw = m[3] * l.x + m[7] * l.y + m[11] * l.z + m[15];
      if (cw <= 0.01) continue;
      const sx = ((m[0] * l.x + m[4] * l.y + m[8] * l.z + m[12]) / cw + 1) * 0.5 * vw;
      const sy = (1 - (m[1] * l.x + m[5] * l.y + m[9] * l.z + m[13]) / cw) * 0.5 * vh;
      if (sx < -80 || sx > vw + 80 || sy < -80 || sy > vh + 80) continue;
      placed.push({ l, sx, sy, cw });
    }
    placed.sort((a, b) => a.cw - b.cw);
    if (this.entries.size > 1200) this.resetAtlas(); // атлас полон — заново, только нужные
    const cell = 48 * dpr;
    const taken = new Map();
    const out = [];
    for (const p of placed) {
      const e = this.entry(p.l.text);
      const w = e.w * dpr;
      const h = e.h * dpr;
      const box = [p.sx - w / 2 - 2 * dpr, p.sy - h - 2 * dpr, p.sx + w / 2 + 2 * dpr, p.sy + 2 * dpr];
      let free = true;
      const cells = [];
      for (let cx = Math.floor(box[0] / cell); cx <= Math.floor(box[2] / cell) && free; cx++) {
        for (let cy = Math.floor(box[1] / cell); cy <= Math.floor(box[3] / cell) && free; cy++) {
          const key = cx * 100003 + cy;
          cells.push(key);
          for (const b of taken.get(key) || []) {
            if (b[0] < box[2] && box[0] < b[2] && b[1] < box[3] && box[1] < b[3]) { free = false; break; }
          }
        }
      }
      if (!free) continue;
      for (const key of cells) {
        if (!taken.has(key)) taken.set(key, []);
        taken.get(key).push(box);
      }
      out.push(p.l, e);
      if (out.length / 2 >= 1500) break;
    }
    if (!out.length) return;
    const data = new Float32Array((out.length / 2) * STRIDE);
    for (let i = 0; i < out.length; i += 2) {
      const l = out[i];
      const e = out[i + 1];
      const o = (i / 2) * STRIDE;
      data[o] = l.x; data[o + 1] = l.y; data[o + 2] = l.z; data[o + 3] = l.onRoof ? 7 : 2;
      data[o + 4] = e.w * dpr; data[o + 5] = e.h * dpr; data[o + 6] = fade; data[o + 7] = 0;
      data[o + 8] = e.u0; data[o + 9] = e.v0; data[o + 10] = e.u1; data[o + 11] = e.v1;
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    if (this.atlasDirty) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.atlasDirty = false;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    const { program, u } = this.program;
    gl.useProgram(program);
    gl.uniformMatrix4fv(u.u_matrix, false, matrix);
    gl.uniform3fv(u.u_camera, camera);
    gl.uniform2f(u.u_viewport, vw, vh);
    gl.uniform1i(u.u_atlas, 0);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false); // номер сам ничего не закрывает
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, data.length / STRIDE);
    gl.bindVertexArray(null);
    gl.depthMask(true);
  }
}

/**
 * Включить номера домов на крышах. Слой встаёт за объёмными зданиями и деревьями и
 * возвращается сам после setStyle / setTheme. Возвращает функцию, которая его убирает.
 */
export function enableRoofLabels(map, { source = 'openmaptiles', size = 12 } = {}) {
  const layer = new RoofLabelsLayer(map, { source, size });
  let failed = false;
  const add = () => {
    if (failed || map.getLayer(ID) || !map.getSource(source) || !map.getLayer(FLAT)) return;
    const layers = map.getStyle()?.layers || [];
    let last = -1;
    layers.forEach((l, i) => { if (l.type === 'fill-extrusion' || l.type === 'custom') last = i; });
    const before = last >= 0 && last + 1 < layers.length ? layers[last + 1].id : undefined;
    map.addLayer(layer, before);
    if (layer.failed) {
      failed = true;
      map.removeLayer(ID);
    }
  };
  const onStyle = () => {
    try {
      add();
    } catch {
      // стиль ещё не разобран — добавим по style.load
    }
  };
  map.on('style.load', onStyle);
  map.on('styledata', onStyle);
  onStyle();
  return () => {
    map.off('style.load', onStyle);
    map.off('styledata', onStyle);
    if (map.getLayer(ID)) map.removeLayer(ID);
  };
}

export const ROOF_LABELS_LAYER = ID;
