// Объёмные деревья и ориентиры для MapLibre GL JS: гладкие кроны, стволы и мягкие тени
// под деревьями, изразцовые и золотые купола мечетей, шары минаретов.
//
//   import { enableObjects3D, supportsObjects3D } from './map/src/index.js';
//   const map = new maplibregl.Map({ style: createStyle({ trees3d: supportsObjects3D() }), ... });
//   enableObjects3D(map);
//
// Каждая крона и каждый купол — эллипсоид, нарисованный одним квадратом: форму, свет и
// глубину считает фрагментный шейдер (луч от камеры до поверхности эллипсоида). Поэтому
// поверхность гладкая при любом приближении, а треугольников в 50–100 раз меньше, чем у
// сетки. Глубина пишется в общий с fill-extrusion буфер: деревья и купола правильно прячутся
// за домами и заслоняют их. Данные — слои tree и object дополнительных тайлов (extraTiles).
// Нужен WebGL2 — он есть во всех современных браузерах; без него стиль рисует плоские кроны.

const ID = 'yoobi-objects-3d';
const MINZOOM = 15;
const EARTH = 2 * Math.PI * 6371008.8; // длина экватора в MapLibre, м
const MAX_INSTANCES = 80000;
// x, y, z центра, zmin (у деревьев — высота земли), радиус по горизонтали, по вертикали, тон, материал
const STRIDE = 8;

// Тона: 0–2 — листва, дальше — купола. Материал: 0 — листва, 1 — изразцы, 2 — металл.
const TONES = { turquoise: 3, gold: 4, white: 5, green: 6, blue: 7, bronze: 8 };
const METAL = new Set(['gold', 'bronze']);
const PALETTES = {
  light: {
    tones: ['#76B657', '#84C062', '#6BAA4E', '#3FBDB2', '#DDB24C', '#F1EEE7', '#45A765', '#4B8FD6', '#8F6A3E'],
    trunk: '#8A6A4B', shadow: 0.2,
  },
  dark: {
    tones: ['#2F5E39', '#356842', '#2A5634', '#23807B', '#B38D3C', '#8C95A2', '#2F6E45', '#2F5F92', '#6E5434'],
    trunk: '#4B3B2C', shadow: 0.34,
  },
};

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
const PACKED = Object.fromEntries(Object.entries(PALETTES).map(([k, p]) => [k, {
  tones: new Float32Array(p.tones.flatMap(hex)), trunk: new Float32Array(hex(p.trunk)), shadow: p.shadow,
}]));

// ——— Шейдеры ———

const HEAD = '#version 300 es\nprecision highp float;\n';

// Крона или купол: квадрат, повёрнутый к камере, чуть больше эллипсоида.
const ELLIPSOID_VS = `${HEAD}
uniform mat4 u_matrix;
uniform vec3 u_camera;
uniform vec3 u_up;
uniform float u_grow;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 a_center;
layout(location = 2) in vec4 a_shape;
out vec3 v_pos;
flat out vec3 v_center;
flat out vec3 v_radii;
flat out float v_zmin;
flat out int v_tone;
flat out int v_mat;
void main() {
  float g = a_shape.w < 0.5 ? u_grow : 1.0; // деревья вырастают при приближении, купола — нет
  float ground = a_shape.w < 0.5 ? a_center.w : 0.0;
  vec3 center = vec3(a_center.xy, ground + (a_center.z - ground) * g);
  vec3 radii = vec3(a_shape.xx, a_shape.y) * g;
  float r = max(radii.x, radii.z) * 1.1;
  vec3 w = normalize(u_camera - center);
  vec3 right = normalize(cross(u_up, w));
  vec3 up = cross(w, right);
  v_pos = center + (right * a_corner.x + up * a_corner.y) * r;
  v_center = center;
  v_radii = max(radii, vec3(0.01));
  v_zmin = a_center.w;
  v_tone = int(a_shape.z + 0.5);
  v_mat = int(a_shape.w + 0.5);
  gl_Position = u_matrix * vec4(v_pos, 1.0);
}`;

const ELLIPSOID_FS = `${HEAD}
uniform mat4 u_matrix;
uniform vec3 u_camera;
uniform vec3 u_light;
uniform vec3 u_tones[9];
in vec3 v_pos;
flat in vec3 v_center;
flat in vec3 v_radii;
flat in float v_zmin;
flat in int v_tone;
flat in int v_mat;
out vec4 fragColor;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

void main() {
  // Луч от камеры через точку квадрата; начало луча — у самого эллипсоида (точность float).
  vec3 rd = normalize(v_pos - u_camera);
  vec3 o = (v_pos - v_center) / v_radii;
  vec3 d = rd / v_radii;
  float a = dot(d, d);
  float b = dot(o, d);
  float c = dot(o, o) - 1.0;
  float disc = b * b - a * c;
  if (disc < 0.0) discard;
  vec3 hit = v_pos + rd * ((-b - sqrt(disc)) / a);
  if (hit.z < v_zmin) discard; // низ купола внутри барабана
  vec3 n = normalize((hit - v_center) / (v_radii * v_radii));
  vec3 base = u_tones[v_tone];
  vec3 color;
  if (v_mat == 0) {
    // Листва: мягкий свет без резких теней, «шапки» листьев из шума, тёмный низ кроны.
    float fade = clamp(1.6 - length(fwidth(hit)) * 2.2, 0.0, 1.0); // вдали шум гаснет, без ряби
    float leaf = (noise(hit * 0.85 + v_center.xyx * 0.37) - 0.5) * fade;
    vec3 nn = normalize(n + vec3(leaf * 0.9, leaf * 0.9, leaf * 0.4));
    float diff = clamp(dot(nn, u_light) * 0.5 + 0.5, 0.0, 1.0);
    float sky = 0.5 + 0.5 * nn.z;
    float bottom = clamp((hit.z - v_center.z + v_radii.z) / (2.0 * v_radii.z), 0.0, 1.0);
    color = base * (0.5 + 0.55 * diff) * (0.84 + 0.2 * sky) * mix(0.74, 1.0, smoothstep(0.05, 0.6, bottom));
    color *= 1.0 + leaf * 0.28;
  } else {
    // Изразцы и металл: рассеянный свет плюс блик.
    float diff = max(dot(n, u_light), 0.0);
    vec3 h = normalize(u_light - rd);
    float shine = v_mat == 2 ? 70.0 : 32.0;
    float spec = pow(max(dot(n, h), 0.0), shine) * (v_mat == 2 ? 0.65 : 0.32);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * 0.12;
    color = base * (0.5 + 0.58 * diff) + vec3(spec + rim);
  }
  vec4 clip = u_matrix * vec4(hit, 1.0);
  gl_FragDepth = (gl_DepthRange.diff * clip.z / clip.w + gl_DepthRange.near + gl_DepthRange.far) * 0.5;
  fragColor = vec4(min(color, vec3(1.0)), 1.0);
}`;

// Ствол: вертикальная полоска, повёрнутая к камере вокруг своей оси.
const TRUNK_VS = `${HEAD}
uniform mat4 u_matrix;
uniform vec3 u_camera;
uniform float u_grow;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 a_center;
layout(location = 2) in vec4 a_shape;
out vec2 v_uv;
void main() {
  if (a_shape.w > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float ground = a_center.w;
  float top = (a_center.z - ground - a_shape.y * 0.35) * u_grow;
  float width = max(0.16, a_shape.x * 0.085) * u_grow;
  vec2 toCam = u_camera.xy - a_center.xy;
  float len = length(toCam);
  vec2 side = len > 0.001 ? vec2(-toCam.y, toCam.x) / len : vec2(1.0, 0.0);
  vec3 pos = vec3(a_center.xy + side * a_corner.x * width * (1.0 - 0.3 * a_corner.y), ground + a_corner.y * top);
  v_uv = a_corner;
  gl_Position = u_matrix * vec4(pos, 1.0);
}`;

const TRUNK_FS = `${HEAD}
uniform vec3 u_trunk;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  float round = sqrt(max(0.0, 1.0 - v_uv.x * v_uv.x));
  fragColor = vec4(u_trunk * (0.62 + 0.45 * round) * (0.8 + 0.2 * v_uv.y), 1.0);
}`;

// Тень под кроной: мягкое пятно на земле, чуть сдвинутое от света.
const SHADOW_VS = `${HEAD}
uniform mat4 u_matrix;
uniform float u_grow;
uniform vec2 u_offset;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 a_center;
layout(location = 2) in vec4 a_shape;
out vec2 v_uv;
void main() {
  if (a_shape.w > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float r = a_shape.x * 1.25 * u_grow;
  vec2 c = a_center.xy + u_offset * a_shape.x * u_grow;
  v_uv = a_corner;
  gl_Position = u_matrix * vec4(c + a_corner * r, a_center.w + 0.05, 1.0);
}`;

const SHADOW_FS = `${HEAD}
uniform float u_alpha;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  float d = length(v_uv);
  float a = (1.0 - smoothstep(0.2, 1.0, d)) * u_alpha;
  fragColor = vec4(0.0, 0.0, 0.0, a); // цвет с учётом прозрачности (premultiplied), как у MapLibre
}`;

// ——— Матрицы 4×4 (по столбцам, как в gl-matrix) ———

function invert(m) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10; const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10; const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11; const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30; const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30; const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31; const b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  const k = 1 / det;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * k, (a02 * b10 - a01 * b11 - a03 * b09) * k,
    (a31 * b05 - a32 * b04 + a33 * b03) * k, (a22 * b04 - a21 * b05 - a23 * b03) * k,
    (a12 * b08 - a10 * b11 - a13 * b07) * k, (a00 * b11 - a02 * b08 + a03 * b07) * k,
    (a32 * b02 - a30 * b05 - a33 * b01) * k, (a20 * b05 - a22 * b02 + a23 * b01) * k,
    (a10 * b10 - a11 * b08 + a13 * b06) * k, (a01 * b08 - a00 * b10 - a03 * b06) * k,
    (a30 * b04 - a31 * b02 + a33 * b00) * k, (a21 * b02 - a20 * b04 - a23 * b00) * k,
    (a11 * b07 - a10 * b09 - a12 * b06) * k, (a00 * b09 - a01 * b07 + a02 * b06) * k,
    (a31 * b01 - a30 * b03 - a32 * b00) * k, (a20 * b03 - a21 * b01 + a22 * b00) * k,
  ];
}

function apply(m, x, y, z, w) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w, m[3] * x + m[7] * y + m[11] * z + m[15] * w];
}

const mercX = (lng) => (lng + 180) / 360;
const mercY = (lat) => (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;

function compile(gl, vs, fs) {
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'program');
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(p, name);
  }
  return { program: p, u };
}

/** Есть ли в браузере всё, что нужно объёмному слою (WebGL2). */
export function supportsObjects3D() {
  try {
    return typeof document !== 'undefined' && !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

class Objects3DLayer {
  constructor(map, { source = 'extra', trees = true } = {}) {
    this.id = ID;
    this.type = 'custom';
    this.renderingMode = '3d';
    this.map = map;
    this.source = source;
    this.trees = trees;
    this.objects = true;
    this.visible = true;
    this.count = 0;
    this.treeCount = 0;
    this.origin = null;
    this.timer = null;
    this.last = 0;
    this.onData = (e) => {
      if (e.sourceId === this.source && (e.tile || e.isSourceLoaded)) this.schedule();
    };
    this.onMove = () => this.schedule();
  }

  onAdd(map, gl) {
    this.gl = gl;
    if (typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext)) {
      this.failed = true;
      return;
    }
    try {
      this.ellipsoid = compile(gl, ELLIPSOID_VS, ELLIPSOID_FS);
      this.trunk = compile(gl, TRUNK_VS, TRUNK_FS);
      this.shadow = compile(gl, SHADOW_VS, SHADOW_FS);
    } catch (err) {
      this.failed = true;
      console.warn('Объёмные деревья выключены:', err.message);
      return;
    }
    this.instances = gl.createBuffer();
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const strip = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, strip);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 0, 1, 0, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.corners = [quad, strip];
    this.vaoQuad = this.vao(quad);
    this.vaoStrip = this.vao(strip);
    gl.bindVertexArray(null);
    map.on('sourcedata', this.onData);
    map.on('moveend', this.onMove);
    map.on('terrain', this.onMove);
    this.schedule();
  }

  vao(corners) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    for (const [loc, offset] of [[1, 0], [2, 16]]) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, STRIDE * 4, offset);
      gl.vertexAttribDivisor(loc, 1);
    }
    return vao;
  }

  onRemove(map, gl) {
    map.off('sourcedata', this.onData);
    map.off('moveend', this.onMove);
    map.off('terrain', this.onMove);
    clearTimeout(this.timer);
    if (this.failed || !gl) return;
    for (const p of [this.ellipsoid, this.trunk, this.shadow]) gl.deleteProgram(p.program);
    for (const b of [this.instances, ...this.corners]) gl.deleteBuffer(b);
    gl.deleteVertexArray(this.vaoQuad);
    gl.deleteVertexArray(this.vaoStrip);
  }

  setVisible(visible) {
    this.visible = visible;
    this.map.triggerRepaint();
  }

  setTrees(trees) {
    this.trees = trees;
    this.schedule();
  }

  setObjects(objects) {
    this.objects = objects;
    this.schedule();
  }

  // Данные пересобираются не чаще раза в 250 мс: при загрузке тайлов и после движения.
  // Буфер можно заливать вне render(): MapLibre в начале каждого кадра заново выставляет
  // своё состояние WebGL (context.setDirty).
  schedule() {
    if (this.timer) return;
    const wait = Math.max(0, 250 - (performance.now() - this.last));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.last = performance.now();
      this.rebuild();
    }, wait);
  }

  rebuild() {
    const map = this.map;
    if (this.failed || !map.getSource(this.source) || map.getZoom() < MINZOOM - 0.5) {
      this.count = 0;
      return;
    }
    let trees = [];
    let objects = [];
    try {
      if (this.trees) trees = map.querySourceFeatures(this.source, { sourceLayer: 'tree' });
      if (this.objects) objects = map.querySourceFeatures(this.source, { sourceLayer: 'object' });
    } catch {
      return;
    }
    const center = map.getCenter();
    const cos = Math.cos((center.lat * Math.PI) / 180);
    const ox = mercX(center.lng);
    const oy = mercY(center.lat);
    const k = EARTH * cos; // метров в единице меркатора у центра
    const terrain = map.getTerrain?.() ? map : null;
    const lift = terrain ? (map.transform?.elevation || 0) : 0;
    const data = new Float32Array(Math.min(trees.length + objects.length, MAX_INSTANCES) * STRIDE);
    const seen = new Set();
    let n = 0;
    const put = (f, fill) => {
      if (n >= MAX_INSTANCES || f.geometry?.type !== 'Point') return false;
      const [lng, lat] = f.geometry.coordinates;
      const x = (mercX(lng) - ox) * k;
      const y = (oy - mercY(lat)) * k;
      const p = f.properties || {};
      const key = `${Math.round(x * 10)},${Math.round(y * 10)},${p.kind || ''}`;
      if (seen.has(key)) return false; // точка на краю тайла приходит и из соседнего
      seen.add(key);
      const ground = terrain ? (terrain.queryTerrainElevation([lng, lat]) || 0) + lift : 0;
      fill(data, n * STRIDE, x, y, p, ground);
      n++;
      return true;
    };
    for (const f of trees) {
      put(f, (d, i, x, y, p, ground) => {
        const rh = Math.max(1.2, (Number(p.crown) || 7) / 2);
        const height = Number(p.height) || 9;
        const jitter = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        // Крона — около двух третей высоты дерева, как у чинар и тополей, а не шар на палке.
        const rv = Math.min(rh * 1.6, Math.max(rh * 0.95, height * 0.34)) * (0.92 + 0.16 * jitter);
        const z = Math.max(height - rv, rv + 0.9);
        d[i] = x; d[i + 1] = y; d[i + 2] = z + ground; d[i + 3] = ground;
        d[i + 4] = rh; d[i + 5] = rv; d[i + 6] = Math.min(2, Number(p.shade) || 0); d[i + 7] = 0;
      });
    }
    const treeCount = n;
    for (const f of objects) {
      put(f, (d, i, x, y, p, ground) => {
        const tone = TONES[p.tone] ?? TONES.turquoise;
        const metal = p.kind === 'finial' || METAL.has(p.tone);
        d[i] = x; d[i + 1] = y; d[i + 2] = (Number(p.z) || 0) + ground; d[i + 3] = (Number(p.zmin) || 0) + ground;
        d[i + 4] = Number(p.r) || 1; d[i + 5] = Number(p.h) || Number(p.r) || 1; d[i + 6] = tone; d[i + 7] = metal ? 2 : 1;
      });
    }
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n * STRIDE), gl.DYNAMIC_DRAW);
    this.count = n;
    this.treeCount = treeCount;
    this.origin = { ox, oy, k };
    map.triggerRepaint();
  }

  render(gl, args) {
    if (this.failed || !this.visible || !this.count || !this.origin) return;
    const zoom = this.map.getZoom();
    if (zoom < MINZOOM) return;
    const vp = args.modelViewProjectionMatrix;
    if (!vp || this.map.getProjection?.()?.type === 'globe') return;
    // Матрица из местных метров (x — восток, y — север, z — высота) в экран.
    const { ox, oy, k } = this.origin;
    const world = 512 * 2 ** zoom;
    const s = world / k;
    const m = new Float64Array(16);
    for (let r = 0; r < 4; r++) {
      m[r] = vp[r] * s;
      m[4 + r] = -vp[4 + r] * s;
      m[8 + r] = vp[8 + r];
      m[12 + r] = vp[r] * ox * world + vp[4 + r] * oy * world + vp[12 + r];
    }
    const inv = invert(m);
    if (!inv) return;
    const eye = apply(inv, 0, 0, 1, 0);
    if (!eye[3]) return;
    const camera = [eye[0] / eye[3], eye[1] / eye[3], eye[2] / eye[3]];
    const p0 = apply(inv, 0, 0, 0, 1);
    const p1 = apply(inv, 0, 1, 0, 1);
    const up = [p1[0] / p1[3] - p0[0] / p0[3], p1[1] / p1[3] - p0[1] / p0[3], p1[2] / p1[3] - p0[2] / p0[3]];
    const ul = Math.hypot(...up) || 1;
    const matrix = new Float32Array(m);
    const light = this.lightDirection();
    const grow = Math.min(1, Math.max(0, (zoom - MINZOOM) / 0.6));
    const palette = PACKED[this.map.getContainer().dataset.yoobiTheme === 'dark' ? 'dark' : 'light'];

    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // Тени: только проверка глубины, без записи.
    if (this.treeCount && grow > 0) {
      const { program, u } = this.shadow;
      gl.useProgram(program);
      gl.uniformMatrix4fv(u.u_matrix, false, matrix);
      gl.uniform1f(u.u_grow, grow);
      const len = Math.hypot(light[0], light[1]) || 1;
      gl.uniform2f(u.u_offset, (-light[0] / len) * 0.45, (-light[1] / len) * 0.45);
      gl.uniform1f(u.u_alpha, palette.shadow);
      gl.depthMask(false);
      gl.bindVertexArray(this.vaoQuad);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.treeCount);
      gl.depthMask(true);
      // Стволы.
      const t = this.trunk;
      gl.useProgram(t.program);
      gl.uniformMatrix4fv(t.u.u_matrix, false, matrix);
      gl.uniform3fv(t.u.u_camera, camera);
      gl.uniform1f(t.u.u_grow, grow);
      gl.uniform3fv(t.u.u_trunk, palette.trunk);
      gl.bindVertexArray(this.vaoStrip);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.treeCount);
    }
    // Кроны и купола.
    const e = this.ellipsoid;
    gl.useProgram(e.program);
    gl.uniformMatrix4fv(e.u.u_matrix, false, matrix);
    gl.uniform3fv(e.u.u_camera, camera);
    gl.uniform3f(e.u.u_up, up[0] / ul, up[1] / ul, up[2] / ul);
    gl.uniform1f(e.u.u_grow, grow);
    gl.uniform3fv(e.u.u_light, light);
    gl.uniform3fv(e.u.u_tones, palette.tones);
    gl.bindVertexArray(this.vaoQuad);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.bindVertexArray(null);
  }

  // Направление на свет — как у объёмных зданий (light в стиле): [r, азимут, полярный угол].
  lightDirection() {
    const light = this.map.getLight?.() || {};
    const [, azimuth = 210, polar = 30] = Array.isArray(light.position) ? light.position : [];
    const a = ((azimuth + 90) * Math.PI) / 180;
    const p = (polar * Math.PI) / 180;
    let x = Math.cos(a) * Math.sin(p);
    let y = Math.sin(a) * Math.sin(p);
    const z = Math.cos(p);
    if ((light.anchor || 'viewport') === 'viewport') {
      const b = (this.map.getBearing() * Math.PI) / 180;
      [x, y] = [x * Math.cos(b) - y * Math.sin(b), x * Math.sin(b) + y * Math.cos(b)];
    }
    // В MapLibre ось y смотрит на юг, здесь — на север.
    const len = Math.hypot(x, y, z) || 1;
    return [x / len, -y / len, z / len];
  }
}

/**
 * Включить объёмные деревья и купола. Слой встаёт сразу за объёмными зданиями и
 * возвращается сам после setStyle / setTheme. Возвращает функцию, которая его убирает.
 * trees: false — только купола и минареты.
 */
// onFail — если у карты не вышло WebGL2 (старый телефон, выключенная видеокарта): слой
// убирается сам, а приложение включает плоские кроны — createStyle({ trees3d: false }).
export function enableObjects3D(map, { source = 'extra', trees = true, onFail = null } = {}) {
  const layer = new Objects3DLayer(map, { source, trees });
  let failed = false;
  const add = () => {
    if (failed || map.getLayer(ID) || !map.getSource(source)) return;
    const layers = map.getStyle()?.layers || [];
    let last = -1;
    layers.forEach((l, i) => { if (l.type === 'fill-extrusion') last = i; });
    const before = last >= 0 && last + 1 < layers.length ? layers[last + 1].id : undefined;
    map.addLayer(layer, before);
    if (layer.failed) {
      failed = true;
      map.removeLayer(ID);
      onFail?.();
    }
  };
  // Слой можно добавить, как только разобран стиль (style.load), не дожидаясь тайлов;
  // после setStyle без разницы (diff: false) он добавляется заново.
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

export const OBJECTS_3D_LAYER = ID;
