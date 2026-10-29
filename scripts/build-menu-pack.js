#!/usr/bin/env node
'use strict';
/**
 * Generator paczki zasobów "KasteuszClient-Menu".
 *
 * Wszystko jest rysowane proceduralnie (bez zewnętrznych bibliotek):
 *  - panorama menu (6 ścian sześcianu, bezszwowo) – synthwave: słońce, góry z bloków,
 *    planeta z pierścieniem, mgławica, gwiazdy i neonowa siatka podłogi,
 *  - logo "KASTEUSZ" z ametystowych bloków 3D + plakietka "CLIENT",
 *  - neonowe przyciski / suwaki / pola tekstowe,
 *  - ekran ładowania gry (mojangstudios.png),
 *  - pack.png i splashes.txt.
 *
 * Użycie:
 *   node scripts/build-menu-pack.js              -> buduje ZIP
 *   node scripts/build-menu-pack.js --view a.png -> dodatkowo renderuje podgląd widoku z menu
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const OUT_ZIP = path.join(ROOT, 'src/main/assets/resourcepacks/KasteuszClient-Menu.zip');

// ───────────────────────── matematyka ─────────────────────────
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const fract = (x) => x - Math.floor(x);
const TAU = Math.PI * 2;

function hash3(x, y, z) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const a = hash3(xi, yi, zi), b = hash3(xi + 1, yi, zi);
  const c = hash3(xi, yi + 1, zi), d = hash3(xi + 1, yi + 1, zi);
  const e = hash3(xi, yi, zi + 1), f = hash3(xi + 1, yi, zi + 1);
  const g = hash3(xi, yi + 1, zi + 1), h = hash3(xi + 1, yi + 1, zi + 1);
  return mix(mix(mix(a, b, u), mix(c, d, u), v), mix(mix(e, f, u), mix(g, h, u), v), w);
}

function fbm(x, y, z, oct) {
  let s = 0, amp = 0.5, n = 0;
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise(x, y, z);
    n += amp;
    x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; z = z * 2.03 + 9.2;
    amp *= 0.5;
  }
  return s / n;
}

const dirFrom = (az, el) => [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];

// ───────────────────────── PNG / ZIP ─────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** rgba: Uint8Array w*h*4 */
function encodePNG(w, h, rgba) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * stride + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function makeZip(entries) {
  const parts = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
    const comp = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(0, 30); ch.writeUInt32LE(0, 34);
    ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

// ───────────────────────── warstwa RGBA (premultiplied) ─────────────────────────
class Layer {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Float32Array(w * h * 4); }

  over(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = (y * this.w + x) * 4, d = this.d, k = 1 - a;
    d[i] = r * a + d[i] * k; d[i + 1] = g * a + d[i + 1] * k;
    d[i + 2] = b * a + d[i + 2] * k; d[i + 3] = a + d[i + 3] * k;
  }

  rect(x0, y0, w, h, c, a = 1) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.over(x, y, c[0], c[1], c[2], a);
  }

  composite(top, ox = 0, oy = 0) {
    for (let y = 0; y < top.h; y++) {
      const ty = y + oy; if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < top.w; x++) {
        const tx = x + ox; if (tx < 0 || tx >= this.w) continue;
        const s = (y * top.w + x) * 4, t = (ty * this.w + tx) * 4, k = 1 - top.d[s + 3];
        for (let c = 0; c < 4; c++) this.d[t + c] = top.d[s + c] + this.d[t + c] * k;
      }
    }
  }

  scale(f) { for (let i = 0; i < this.d.length; i++) this.d[i] *= f; }

  blur(r, passes = 3) {
    const tmp = new Float32Array(this.d.length);
    for (let p = 0; p < passes; p++) {
      boxPass(this.d, tmp, this.w, this.h, r, true);
      boxPass(tmp, this.d, this.w, this.h, r, false);
    }
  }

  toRGBA(dither = true) {
    const out = new Uint8Array(this.w * this.h * 4);
    for (let i = 0; i < this.w * this.h; i++) {
      const a = clamp(this.d[i * 4 + 3]);
      const n = dither ? (Math.random() - 0.5) / 255 : 0;
      for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(clamp(a > 0 ? this.d[i * 4 + c] / a + n : 0) * 255);
      out[i * 4 + 3] = Math.round(a * 255);
    }
    return out;
  }

  png() { return encodePNG(this.w, this.h, this.toRGBA()); }
}

function boxPass(src, dst, w, h, r, horiz) {
  const n = horiz ? w : h, m = horiz ? h : w, inv = 1 / (2 * r + 1);
  for (let j = 0; j < m; j++) {
    for (let c = 0; c < 4; c++) {
      const at = (i) => (i < 0 || i >= n) ? 0 : src[(horiz ? j * w + i : i * w + j) * 4 + c];
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += at(k);
      for (let i = 0; i < n; i++) {
        dst[(horiz ? j * w + i : i * w + j) * 4 + c] = acc * inv;
        acc += at(i + r + 1) - at(i - r);
      }
    }
  }
}

// ───────────────────────── czcionka z bloków 5x7 ─────────────────────────
const GLYPHS = {
  K: ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'],
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  S: ['.XXXX', 'X....', 'X....', '.XXX.', '....X', '....X', 'XXXX.'],
  T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
  E: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
  U: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  Z: ['XXXXX', '....X', '...X.', '..X..', '.X...', 'X....', 'XXXXX'],
  C: ['.XXXX', 'X....', 'X....', 'X....', 'X....', 'X....', '.XXXX'],
  L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
  I: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
  N: ['X...X', 'XX..X', 'XX..X', 'X.X.X', 'X..XX', 'X..XX', 'X...X']
};

function textCells(text, spacing) {
  const filled = [];
  let cols = 0;
  for (const ch of text) {
    const g = GLYPHS[ch];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === 'X') filled.push([cols + c, r]);
    cols += 5 + spacing;
  }
  return { cols: cols - spacing, filled };
}

function sampleStops(stops, t) {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
      return mix3(c0, c1, (t - t0) / (t1 - t0));
    }
  }
  return stops[stops.length - 1][1];
}

/**
 * Rysuje napis z sześciennych bloków (ametyst / obsydian) z ekstruzją 3D, obrysem i neonową poświatą.
 */
function drawBlockText(layer, text, x0, y0, o) {
  const { B, tex = 1, bevel = 1, depth = 0, outline = 2, glowR = 6, glowA = 1, spacing = 1 } = o;
  const stops = o.stops;
  const { cols, filled } = textCells(text, spacing);
  const W = layer.w, H = layer.h;
  const has = new Set(filled.map(([c, r]) => c + ',' + r));
  const isOn = (c, r) => has.has(c + ',' + r);

  // maska całej bryły (lico + ekstruzja)
  const mask = new Uint8Array(W * H);
  for (const [cx, cy] of filled) {
    for (let y = y0 + cy * B; y < y0 + cy * B + B + depth; y++)
      for (let x = x0 + cx * B; x < x0 + cx * B + B; x++)
        if (x >= 0 && y >= 0 && x < W && y < H) mask[y * W + x] = 1;
  }

  // poświata
  const glow = new Layer(W, H);
  for (let i = 0; i < W * H; i++) if (mask[i]) glow.over(i % W, (i / W) | 0, o.glow[0], o.glow[1], o.glow[2], 1);
  const wide = new Layer(W, H); wide.d.set(glow.d);
  glow.blur(glowR);
  glow.scale(glowA);
  wide.blur(glowR * 3);
  wide.scale(glowA * 0.9);
  layer.composite(wide);
  layer.composite(glow);

  // obrys (dylatacja maski)
  if (outline > 0) {
    const dil = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      for (let dy = -outline; dy <= outline; dy++) for (let dx = -outline; dx <= outline; dx++) {
        if (dx * dx + dy * dy > outline * outline + 1) continue;
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H) dil[yy * W + xx] = 1;
      }
    }
    for (let i = 0; i < W * H; i++) if (dil[i]) layer.over(i % W, (i / W) | 0, 0.035, 0.0, 0.07, 1);
  }

  // ekstruzja (boki bloków)
  for (const [cx, cy] of filled) {
    for (let d = 0; d < depth; d++) {
      const t = d / Math.max(1, depth - 1);
      const c = mix3(o.side[0], o.side[1], t);
      for (let x = x0 + cx * B; x < x0 + cx * B + B; x++) {
        const edge = (x === x0 + cx * B || x === x0 + cx * B + B - 1) ? 0.75 : 1;
        layer.over(x, y0 + cy * B + B + d, c[0] * edge, c[1] * edge, c[2] * edge, 1);
      }
    }
  }

  // lica bloków
  const totalH = 7 * B, totalW = cols * B;
  for (const [cx, cy] of filled) {
    const top = !isOn(cx, cy - 1), bottom = !isOn(cx, cy + 1), left = !isOn(cx - 1, cy), right = !isOn(cx + 1, cy);
    for (let ly = 0; ly < B; ly++) for (let lx = 0; lx < B; lx++) {
      const px = x0 + cx * B + lx, py = y0 + cy * B + ly;
      const gy = (cy * B + ly) / totalH, gx = (cx * B + lx) / totalW;
      let c = sampleStops(stops, gy);
      const tint = mix3(o.tintL || [1, 1, 1], o.tintR || [1, 1, 1], gx);
      c = [c[0] * tint[0], c[1] * tint[1], c[2] * tint[2]];
      const tx = Math.floor(lx / tex), ty = Math.floor(ly / tex);
      let k = 1 + (tex > 1 ? (hash3(cx * 17 + tx, cy * 17 + ty, 11) - 0.5) * 0.18 : 0);
      if (ly < bevel) k += top ? 0.32 : 0.1;
      else if (ly >= B - bevel) k -= bottom ? 0.38 : 0.16;
      if (lx < bevel) k += left ? 0.2 : 0.06;
      else if (lx >= B - bevel) k -= right ? 0.26 : 0.1;
      // połysk po skosie
      const g = ((px - py * 0.8) % 300 + 300) % 300;
      if (g < 34) k += 0.22 * Math.sin((g / 34) * Math.PI);
      c = [c[0] * k, c[1] * k, c[2] * k];
      // iskry ametystu
      if (tex > 1 && gy < 0.55 && hash3(cx * 17 + tx, cy * 17 + ty, 23) > 0.93) c = mix3(c, [1, 1, 1], 0.55);
      layer.over(px, py, clamp(c[0]), clamp(c[1]), clamp(c[2]), 1);
    }
  }
  return { width: cols * B, height: 7 * B + depth };
}

const AMETHYST = {
  stops: [[0, [1.0, 0.93, 1.0]], [0.28, [0.95, 0.6, 1.0]], [0.62, [0.72, 0.28, 1.0]], [1, [0.4, 0.09, 0.78]]],
  side: [[0.36, 0.09, 0.6], [0.1, 0.02, 0.2]],
  glow: [0.9, 0.22, 1.0],
  tintL: [1.06, 0.88, 0.96],
  tintR: [0.86, 0.96, 1.08]
};

// ───────────────────────── logo / edycja / ekran ładowania ─────────────────────────
function buildLogo() {
  const L = new Layer(1024, 256);
  drawBlockText(L, 'KASTEUSZ', 42, 6, { ...AMETHYST, B: 20, tex: 4, bevel: 3, depth: 8, outline: 3, glowR: 7, glowA: 1.7 });
  // Minecraft rysuje tylko górne 176 px – wygaszamy wszystko poniżej, żeby nie było twardej krawędzi
  for (let y = 150; y < 256; y++) {
    const f = 1 - smooth(158, 175, y);
    for (let x = 0; x < 1024; x++) { const i = (y * 1024 + x) * 4; for (let c = 0; c < 4; c++) L.d[i + c] *= f; }
  }
  return L;
}

function neonLine(L, x0, x1, y, th, col, fadeToLeft) {
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / (x1 - x0);
    const a = fadeToLeft ? smooth(0, 0.85, t) : smooth(1, 0.15, t);
    for (let d = 0; d < th; d++) L.over(x, y + d, col[0], col[1], col[2], a);
  }
}

function diamond(L, cx, cy, r, col) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (Math.abs(x) + Math.abs(y) <= r) L.over(cx + x, cy + y, col[0], col[1], col[2], 1);
}

function buildEdition() {
  const L = new Layer(512, 64);
  const deco = new Layer(512, 64);
  neonLine(deco, 34, 140, 30, 3, [1.0, 0.35, 0.85], true);
  neonLine(deco, 372, 478, 30, 3, [1.0, 0.35, 0.85], false);
  diamond(deco, 146, 31, 5, [0.35, 0.92, 1.0]);
  diamond(deco, 366, 31, 5, [0.35, 0.92, 1.0]);
  const g = new Layer(512, 64); g.composite(deco); g.blur(4); g.scale(1.4);
  L.composite(g); L.composite(deco);
  drawBlockText(L, 'CLIENT', 156, 14, {
    B: 5, tex: 1, bevel: 1, depth: 3, outline: 2, glowR: 4, glowA: 1.0, spacing: 2,
    stops: [[0, [1, 1, 1]], [0.5, [1, 0.78, 0.96]], [1, [1, 0.42, 0.86]]],
    side: [[0.5, 0.1, 0.45], [0.18, 0.03, 0.2]],
    glow: [1.0, 0.25, 0.85]
  });
  return L;
}

function buildMojangSplash() {
  // Gra składa logo z dwóch połówek tekstury: górna połowa -> lewa strona, dolna -> prawa.
  const wide = new Layer(1024, 256);
  drawBlockText(wide, 'KASTEUSZ', 136, 62, { ...AMETHYST, B: 16, tex: 4, bevel: 2, depth: 7, outline: 3, glowR: 8, glowA: 1.1 });
  const deco = new Layer(1024, 256);
  neonLine(deco, 300, 500, 206, 3, [1.0, 0.35, 0.85], true);
  neonLine(deco, 524, 724, 206, 3, [1.0, 0.35, 0.85], false);
  diamond(deco, 512, 207, 6, [0.35, 0.92, 1.0]);
  const g = new Layer(1024, 256); g.composite(deco); g.blur(4); g.scale(1.4);
  wide.composite(g); wide.composite(deco);

  const out = new Layer(512, 512);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) {
    const s1 = (y * 1024 + x) * 4, s2 = (y * 1024 + x + 512) * 4;
    const t1 = (y * 512 + x) * 4, t2 = ((y + 256) * 512 + x) * 4;
    for (let c = 0; c < 4; c++) { out.d[t1 + c] = wide.d[s1 + c]; out.d[t2 + c] = wide.d[s2 + c]; }
  }
  return out;
}

function buildPackIcon() {
  const L = new Layer(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const r = Math.hypot(x - 128, y - 118) / 180;
    const c = mix3([0.22, 0.05, 0.4], [0.03, 0.01, 0.07], clamp(r));
    L.over(x, y, c[0], c[1], c[2], 1);
  }
  drawBlockText(L, 'K', 58, 22, { ...AMETHYST, B: 28, tex: 7, bevel: 4, depth: 10, outline: 4, glowR: 10, glowA: 1.2 });
  return L;
}

// ───────────────────────── widżety GUI (200x20, nine-slice) ─────────────────────────
function buildButton(kind) {
  const W = 200, H = 20, L = new Layer(W, H);
  const P = {
    normal: { edge: [0.62, 0.25, 1.0], ring: [0.16, 0.06, 0.3], top: [0.17, 0.06, 0.32], bot: [0.07, 0.02, 0.15], hl: [0.36, 0.17, 0.58], sh: [0.04, 0.01, 0.09], a: 0.9 },
    highlighted: { edge: [1.0, 0.5, 0.92], ring: [0.55, 0.2, 0.8], top: [0.5, 0.14, 0.76], bot: [0.24, 0.05, 0.45], hl: [0.95, 0.65, 1.0], sh: [0.14, 0.03, 0.26], a: 0.95 },
    disabled: { edge: [0.24, 0.18, 0.32], ring: [0.1, 0.08, 0.14], top: [0.09, 0.07, 0.13], bot: [0.06, 0.05, 0.09], hl: [0.13, 0.1, 0.18], sh: [0.04, 0.03, 0.06], a: 0.8 }
  }[kind];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const corner = (x === 0 || x === W - 1) && (y === 0 || y === H - 1);
    if (corner) continue;
    const onEdge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
    const onRing = x === 1 || y === 1 || x === W - 2 || y === H - 2;
    let c, a = 1;
    if (onEdge) c = P.edge;
    else if (y === 2 && x > 1 && x < W - 2) c = P.hl;
    else if (y === H - 3 && x > 1 && x < W - 2) c = P.sh;
    else if (onRing) c = P.ring;
    else { c = mix3(P.top, P.bot, (y - 2) / (H - 5)); a = P.a; }
    L.over(x, y, c[0], c[1], c[2], a);
  }
  if (kind === 'highlighted') {
    // cyjanowy akcent po lewej stronie (mieści się w ramce nine-slice, więc się nie rozciąga w poziomie)
    for (let y = 3; y < H - 3; y++) L.over(2, y, 0.35, 0.92, 1.0, 1);
  }
  return L;
}

function buildTrack(highlight) {
  const W = 200, H = 20, L = new Layer(W, H);
  const edge = highlight ? [1.0, 0.5, 0.92] : [0.5, 0.2, 0.85];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const onEdge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
    if (onEdge) L.over(x, y, edge[0], edge[1], edge[2], 1);
    else { const c = mix3([0.05, 0.015, 0.1], [0.02, 0.005, 0.05], y / H); L.over(x, y, c[0], c[1], c[2], 0.92); }
  }
  return L;
}

function buildHandle(highlight) {
  const W = 8, H = 20, L = new Layer(W, H);
  const P = highlight
    ? { edge: [1.0, 0.75, 1.0], top: [1.0, 0.45, 0.9], bot: [0.7, 0.15, 0.75] }
    : { edge: [0.85, 0.55, 1.0], top: [0.7, 0.3, 1.0], bot: [0.38, 0.1, 0.7] };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const onEdge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
    let c = onEdge ? P.edge : mix3(P.top, P.bot, y / H);
    if (!onEdge && (y === 1 || x === 1)) c = mix3(c, [1, 1, 1], 0.35);
    if (!onEdge && (y >= H - 3 || x === W - 2)) c = [c[0] * 0.65, c[1] * 0.65, c[2] * 0.65];
    L.over(x, y, c[0], c[1], c[2], 1);
  }
  return L;
}

function buildTextField(highlight) {
  const W = 200, H = 20, L = new Layer(W, H);
  const edge = highlight ? [1.0, 0.6, 0.95] : [0.42, 0.22, 0.62];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const onEdge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
    if (onEdge) L.over(x, y, edge[0], edge[1], edge[2], 1);
    else L.over(x, y, 0.02, 0.005, 0.04, 1);
  }
  return L;
}

const nineSlice = (w, h, border) => JSON.stringify({ gui: { scaling: { type: 'nine_slice', width: w, height: h, border } } }, null, 2);

// ───────────────────────── scena panoramy ─────────────────────────
const PAL = {
  zenith: [0.012, 0.006, 0.035],
  upper: [0.06, 0.018, 0.15],
  mid: [0.26, 0.05, 0.46],
  horizon: [1.0, 0.24, 0.62]
};
const SUN_EL = 0.1, SUN_R = 0.24, SUN = dirFrom(0, SUN_EL);
const PLANET = (() => {
  const dir = dirFrom(2.55, 0.4);
  const rl = Math.hypot(dir[2], dir[0]);
  const right = [dir[2] / rl, 0, -dir[0] / rl];
  const up = [dir[1] * right[2] - dir[2] * right[1], dir[2] * right[0] - dir[0] * right[2], dir[0] * right[1] - dir[1] * right[0]];
  return { dir, right, up, R: Math.tan(0.11) };
})();

function makeRidge(blk, seed, scale, base, amp, lo, hi, dipIn, dipOut, dipMin) {
  const n = Math.round(TAU / blk);
  blk = TAU / n;
  const h = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI + (i + 0.5) * blk;
    const v = fbm(Math.cos(a) * scale + seed, Math.sin(a) * scale, seed * 0.37, 5);
    let hh = base + amp * smooth(lo, hi, v);
    hh *= dipMin + (1 - dipMin) * smooth(dipIn, dipOut, Math.abs(a));
    h[i] = Math.round(hh / blk) * blk;
  }
  return { n, blk, h };
}
const FAR = makeRidge(0.014, 3.1, 2.2, 0.03, 0.19, 0.3, 0.72, 0.12, 0.5, 0.35);
const NEAR = makeRidge(0.024, 8.7, 3.4, 0.0, 0.13, 0.36, 0.78, 0.22, 0.7, 0.08);

function ridgeAt(R, a, e) {
  const fa = (a + Math.PI) / R.blk;
  const idx = ((Math.floor(fa) % R.n) + R.n) % R.n;
  const h = R.h[idx];
  if (e >= h) return null;
  return { fx: fract(fa), fy: e / R.blk, h: h / R.blk, idx };
}

function skyGradient(e) {
  if (e <= 0) return PAL.horizon.slice();
  let c = mix3(PAL.horizon, PAL.mid, smooth(0.0, 0.16, e));
  c = mix3(c, PAL.upper, smooth(0.1, 0.55, e));
  return mix3(c, PAL.zenith, smooth(0.5, 1.4, e));
}

function starLayer(dx, dy, dz, S, thr, size, seed) {
  const x = dx * S, y = dy * S, z = dz * S;
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const h = hash3(xi + seed, yi, zi);
  if (h < thr) return null;
  const ox = xi + 0.3 + 0.4 * hash3(xi, yi + seed, zi);
  const oy = yi + 0.3 + 0.4 * hash3(xi, yi, zi + seed);
  const oz = zi + 0.3 + 0.4 * hash3(xi + seed, yi + seed, zi);
  const d2 = (x - ox) ** 2 + (y - oy) ** 2 + (z - oz) ** 2;
  const s = size * (0.5 + 0.5 * (h - thr) / (1 - thr));
  const k = (0.4 + 0.6 * hash3(zi, xi, yi + seed)) * Math.exp(-d2 / (s * s));
  const t = hash3(yi, zi, xi + seed);
  const col = t < 0.25 ? [1, 0.7, 0.92] : t < 0.45 ? [0.7, 0.92, 1] : [1, 1, 1];
  return [col[0] * k, col[1] * k, col[2] * k];
}

function planetSample(dx, dy, dz) {
  const P = PLANET;
  const lz = dx * P.dir[0] + dy * P.dir[1] + dz * P.dir[2];
  if (lz < 0.95) return null;
  const X = (dx * P.right[0] + dy * P.right[1] + dz * P.right[2]) / lz / P.R;
  const Y = (dx * P.up[0] + dy * P.up[1] + dz * P.up[2]) / lz / P.R;
  const r = Math.hypot(X, Y);
  if (r > 3) return null;
  const th = 0.38, Xr = X * Math.cos(th) + Y * Math.sin(th), Yr = -X * Math.sin(th) + Y * Math.cos(th);
  const rr = Math.hypot(Xr, Yr / 0.26);

  let col = [0, 0, 0], a = 0;
  const add = [0, 0, 0];
  // atmosfera
  if (r > 1) { const g = Math.exp(-(r - 1) * 5) * 0.45; add[0] += 0.6 * g; add[1] += 0.25 * g; add[2] += 1.0 * g; }
  const ring = () => {
    if (rr < 1.35 || rr > 2.25) return 0;
    let d = smooth(1.35, 1.42, rr) * smooth(2.25, 2.12, rr);
    d *= 0.55 + 0.45 * Math.sin(rr * 38);
    if (rr > 1.74 && rr < 1.82) d *= 0.15;
    return d * 0.85;
  };
  const ringCol = [0.95, 0.78, 1.0];
  // tylna połowa pierścienia
  if (Yr > 0) { const ra = ring(); col = mix3(col, ringCol, ra); a = a + ra * (1 - a); }
  if (r < 1) {
    const nz = Math.sqrt(1 - r * r);
    const L = [-0.55, -0.2, 0.81];
    const diff = clamp(X * L[0] + Y * L[1] + nz * L[2]);
    const b = Math.sin(Y * 13 + 2.2 * fbm(X * 2.5 + 4, Y * 2.5, 1.3, 3)) * 0.5 + 0.5;
    let base = mix3([0.3, 0.08, 0.55], [0.95, 0.45, 0.88], b);
    base = mix3(base, [0.25, 0.8, 0.92], smooth(0.85, 1, b) * 0.6);
    const rim = Math.pow(1 - nz, 2.5) * 0.9;
    const pc = [base[0] * (0.07 + diff) + rim, base[1] * (0.07 + diff) + rim * 0.35, base[2] * (0.07 + diff) + rim * 0.8];
    const pa = smooth(1, 0.97, r);
    col = mix3(col, pc, pa); a = a + pa * (1 - a);
  }
  if (Yr <= 0) { const ra = ring(); col = mix3(col, ringCol, ra); a = a + ra * (1 - a); }
  return { col, a, add };
}

function sunColor(v) {
  return sampleStops([[-1, [0.85, 0.1, 0.65]], [-0.3, [1.0, 0.28, 0.5]], [0.3, [1.0, 0.62, 0.3]], [1, [1.0, 0.95, 0.45]]], v);
}

function sky(dx, dy, dz, full) {
  const e = Math.asin(clamp(dy, -1, 1)), a = Math.atan2(dx, dz);
  let c = skyGradient(e);
  const sunAz = Math.exp(-(a * a) / 0.4);
  const hg = Math.exp(-Math.max(e, 0) / 0.06) * (0.3 + 0.7 * sunAz) * 0.35;
  c[0] += hg; c[1] += 0.3 * hg; c[2] += 0.55 * hg;
  const sunAng = Math.acos(clamp(dx * SUN[0] + dy * SUN[1] + dz * SUN[2], -1, 1));

  if (full) {
    const fade = smooth(0.03, 0.32, e);
    if (fade > 0) {
      const n1 = fbm(dx * 1.8 + 5.2, dy * 1.8 + 1.1, dz * 1.8 - 3.3, 5);
      const n2 = fbm(dx * 3.5 - 2.1, dy * 3.5 + 7.7, dz * 3.5 + 0.4, 4);
      const neb = smooth(0.42, 0.78, n1) * (0.3 + 0.7 * smooth(0.38, 0.75, n2)) * 0.55 * fade;
      const nc = mix3([0.55, 0.12, 0.95], [0.12, 0.72, 1.0], smooth(0.4, 0.72, n2));
      c[0] += nc[0] * neb; c[1] += nc[1] * neb; c[2] += nc[2] * neb;
      const sf = fade * smooth(0.3, 0.65, sunAng);
      const s1 = starLayer(dx, dy, dz, 150, 0.965, 0.16, 1);
      const s2 = starLayer(dx, dy, dz, 48, 0.985, 0.07, 7);
      for (const s of [s1, s2]) if (s) { c[0] += s[0] * sf; c[1] += s[1] * sf; c[2] += s[2] * sf; }
    }
  }

  const p = planetSample(dx, dy, dz);
  if (p) { c = mix3(c, p.col, p.a); c[0] += p.add[0]; c[1] += p.add[1]; c[2] += p.add[2]; }

  // słońce synthwave + halo
  const o = Math.max(0, sunAng - SUN_R);
  const halo = 0.55 * Math.exp(-o / 0.05) + 0.3 * Math.exp(-o / 0.25);
  c[0] += halo; c[1] += 0.32 * halo; c[2] += 0.6 * halo;
  if (sunAng < SUN_R * 1.02) {
    const v = (e - SUN_EL) / SUN_R;
    let alpha = smooth(SUN_R, SUN_R * 0.985, sunAng);
    if (v < 0.35) {
      const s = (0.35 - v) / 1.35;
      const phase = fract((0.35 - v) / 0.13);
      if (phase < 0.06 + 0.5 * s) alpha = 0;
    }
    if (alpha > 0) { const sc = sunColor(v); c = mix3(c, [sc[0] * 1.15, sc[1] * 1.15, sc[2] * 1.15], alpha); }
  }

  // góry z bloków: dalsza warstwa
  const fm = ridgeAt(FAR, a, e);
  const nm = ridgeAt(NEAR, a, e);
  if (nm) {
    let col = mix3([0.035, 0.01, 0.07], [0.3, 0.07, 0.32], 0.35 * (1 - nm.fy / Math.max(nm.h, 1)));
    const seam = nm.fx < 0.06 || fract(nm.fy) < 0.06;
    if (seam) col = [col[0] * 0.55, col[1] * 0.55, col[2] * 0.55];
    const row = Math.floor(nm.fy);
    if (!seam && row < nm.h - 1 && hash3(nm.idx, row, 7) > 0.965) {
      const cx = Math.abs(nm.fx - 0.5), cy = Math.abs(fract(nm.fy) - 0.5);
      col = Math.max(cx, cy) < 0.25 ? [0.85, 0.45, 1.0] : [0.45, 0.12, 0.85];
    }
    if (nm.fy > nm.h - 0.16) col = [1.0, 0.4, 0.9];
    return col;
  }
  if (fm) {
    let col = mix3([0.2, 0.05, 0.34], [0.75, 0.2, 0.6], 0.45 * (1 - fm.fy / Math.max(fm.h, 1)));
    if (fm.fx < 0.06 || fract(fm.fy) < 0.06) col = [col[0] * 0.78, col[1] * 0.78, col[2] * 0.78];
    if (fm.fy > fm.h - 0.15) col = mix3(col, [1.0, 0.45, 0.85], 0.7);
    return col;
  }
  // neonowa linia horyzontu
  const hl = Math.exp(-Math.abs(e) / 0.004) * 0.8;
  c[0] += hl; c[1] += 0.45 * hl; c[2] += 0.85 * hl;
  return c;
}

let PIX = (Math.PI / 2) / 2048;

function ground(dx, dy, dz) {
  const t = 1 / -dy;
  const px = dx * t, pz = dz * t;
  const dist = Math.hypot(px, pz);
  const S = 1.0;
  const gx = Math.abs(fract(px / S + 0.5) - 0.5) * S;
  const gz = Math.abs(fract(pz / S + 0.5) - 0.5) * S;
  const fwx = t * PIX * 1.5, fwz = t * t * PIX * 1.5, w = 0.006;
  const lx = (1 - smooth(w, w + fwx, gx)) * clamp(1 - fwx / (S * 0.35));
  const lz = (1 - smooth(w, w + fwz, gz)) * clamp(1 - fwz / (S * 0.35));
  const line = Math.max(lx, lz) * Math.exp(-dist / 30) * (0.75 + 0.25 * smooth(1, 4, dist));
  const glow = (Math.exp(-gx / 0.05) + Math.exp(-gz / 0.05)) * 0.16 * Math.exp(-dist / 14);
  const gc = mix3([1.0, 0.3, 0.9], [0.55, 0.25, 1.0], smooth(2, 25, dist));

  const ripple = 0.006 * Math.sin(pz * 4 + Math.sin(px * 1.3) * 2) * smooth(0, 0.08, -dy);
  const refl = sky(dx, Math.max(0.0005, -dy + ripple), dz, false);
  const fres = 0.22 + 0.45 * Math.pow(1 + dy, 6);
  let c = [0.025 + refl[0] * fres * 0.6, 0.008 + refl[1] * fres * 0.6, 0.05 + refl[2] * fres * 0.6];
  c = mix3(c, [0.6, 0.14, 0.45], 1 - Math.exp(-dist / 45));
  const k = line * 1.15 + glow;
  c[0] += gc[0] * k; c[1] += gc[1] * k; c[2] += gc[2] * k;
  const e = Math.asin(clamp(dy, -1, 1));
  const hl = Math.exp(-Math.abs(e) / 0.004) * 0.8;
  c[0] += hl; c[1] += 0.45 * hl; c[2] += 0.85 * hl;
  return c;
}

const shade = (dx, dy, dz) => (dy < 0 ? ground(dx, dy, dz) : sky(dx, dy, dz, true));
const tone = (x) => (x <= 0.8 ? Math.max(0, x) : 0.8 + 0.2 * (1 - Math.exp(-(x - 0.8) / 0.2)));

// Orientacja ścian zgodna z vanilla (sprawdzone na krawędziach oryginalnej panoramy)
function faceDir(f, u, v) {
  switch (f) {
    case 0: return [u, -v, 1];
    case 1: return [1, -v, -u];
    case 2: return [-u, -v, -1];
    case 3: return [-1, -v, u];
    case 4: return [u, 1, v];
    default: return [u, -1, -v];
  }
}

function renderFace(f, size, ss) {
  const n = size * ss;
  PIX = (Math.PI / 2) / n;
  const L = new Layer(size, size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let r = 0, g = 0, b = 0;
    for (let sj = 0; sj < ss; sj++) for (let si = 0; si < ss; si++) {
      const u = ((i * ss + si + 0.5) / n) * 2 - 1, v = ((j * ss + sj + 0.5) / n) * 2 - 1;
      const d = faceDir(f, u, v), l = Math.hypot(d[0], d[1], d[2]);
      const c = shade(d[0] / l, d[1] / l, d[2] / l);
      r += tone(c[0]); g += tone(c[1]); b += tone(c[2]);
    }
    const q = 1 / (ss * ss), k = (j * size + i) * 4;
    L.d[k] = r * q; L.d[k + 1] = g * q; L.d[k + 2] = b * q; L.d[k + 3] = 1;
  }
  return L;
}

/** Podgląd: kamera jak w menu (pochylona 10° w dół, FOV 85°). */
function renderView(W, H, yaw) {
  PIX = (85 * Math.PI / 180) / H;
  const L = new Layer(W, H);
  const th = 10 * Math.PI / 180, tf = Math.tan(42.5 * Math.PI / 180);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = (2 * (i + 0.5) / W - 1) * tf * (W / H), y = (1 - 2 * (j + 0.5) / H) * tf;
    let dx = x, dy = y * Math.cos(th) - Math.sin(th), dz = y * Math.sin(th) + Math.cos(th);
    const cx = dx * Math.cos(yaw) + dz * Math.sin(yaw), cz = -dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const l = Math.hypot(cx, dy, cz);
    const c = shade(cx / l, dy / l, cz / l);
    const k = (j * W + i) * 4;
    L.d[k] = tone(c[0]); L.d[k + 1] = tone(c[1]); L.d[k + 2] = tone(c[2]); L.d[k + 3] = 1;
  }
  return L;
}

const SPLASHES = [
  'Kasteusz Client na szczycie!',
  'Zero lagów, czysty skill!',
  'Synthwave mode: ON',
  'Szkolne SMP czeka!',
  'Mcqueen420_ approved!',
  'Ametyst > diament',
  'Gramy do rana!',
  'Klikasz Multiplayer i lecisz!',
  'Neonowo i płynnie!',
  'Obsydian w sercu, fiolet w oczach',
  'Totem? Jaki totem?',
  'GG EZ',
  'Odpalone z KasteuszLaunchera!',
  'Zrób test komputera w launcherze!',
  'Więcej FPS, mniej wymówek!',
  'Wróć przed świtem!',
  'Made in Poland!',
  'Bloki, neon i dobra muzyka',
  'Kto nie gra, ten nie wygrywa',
  'Jeszcze jedna runda...'
];

// ───────────────────────── budowa ─────────────────────────
function main() {
  const args = process.argv.slice(2);
  const viewIdx = args.indexOf('--view');
  const t0 = Date.now();
  const entries = [];
  const T = 'assets/minecraft/textures/gui/';

  entries.push({
    name: 'pack.mcmeta',
    data: JSON.stringify({
      pack: {
        description: '§d§lKasteusz Client §8• §5Synthwave Menu',
        pack_format: 75,
        supported_formats: [15, 99],
        min_format: 15,
        max_format: 99
      }
    }, null, 2)
  });
  entries.push({ name: 'pack.png', data: buildPackIcon().png() });
  entries.push({ name: 'assets/minecraft/texts/splashes.txt', data: SPLASHES.join('\n') + '\n' });

  const logo = buildLogo().png();
  entries.push({ name: T + 'title/minecraft.png', data: logo });
  entries.push({ name: T + 'title/minceraft.png', data: logo });
  entries.push({ name: T + 'title/edition.png', data: buildEdition().png() });
  entries.push({ name: T + 'title/mojangstudios.png', data: buildMojangSplash().png() });

  const W = T + 'sprites/widget/';
  entries.push({ name: W + 'button.png', data: buildButton('normal').png() });
  entries.push({ name: W + 'button.png.mcmeta', data: nineSlice(200, 20, 3) });
  entries.push({ name: W + 'button_highlighted.png', data: buildButton('highlighted').png() });
  entries.push({ name: W + 'button_highlighted.png.mcmeta', data: nineSlice(200, 20, 3) });
  entries.push({ name: W + 'button_disabled.png', data: buildButton('disabled').png() });
  entries.push({ name: W + 'button_disabled.png.mcmeta', data: nineSlice(200, 20, 1) });
  entries.push({ name: W + 'slider.png', data: buildTrack(false).png() });
  entries.push({ name: W + 'slider.png.mcmeta', data: nineSlice(200, 20, 1) });
  entries.push({ name: W + 'slider_highlighted.png', data: buildTrack(true).png() });
  entries.push({ name: W + 'slider_highlighted.png.mcmeta', data: nineSlice(200, 20, 1) });
  const handleBorder = { left: 2, top: 2, right: 2, bottom: 3 };
  entries.push({ name: W + 'slider_handle.png', data: buildHandle(false).png() });
  entries.push({ name: W + 'slider_handle.png.mcmeta', data: nineSlice(8, 20, handleBorder) });
  entries.push({ name: W + 'slider_handle_highlighted.png', data: buildHandle(true).png() });
  entries.push({ name: W + 'slider_handle_highlighted.png.mcmeta', data: nineSlice(8, 20, handleBorder) });
  entries.push({ name: W + 'text_field.png', data: buildTextField(false).png() });
  entries.push({ name: W + 'text_field.png.mcmeta', data: nineSlice(200, 20, 1) });
  entries.push({ name: W + 'text_field_highlighted.png', data: buildTextField(true).png() });
  entries.push({ name: W + 'text_field_highlighted.png.mcmeta', data: nineSlice(200, 20, 1) });
  console.log(`[menu-pack] GUI gotowe (${Date.now() - t0} ms)`);

  for (let f = 0; f < 6; f++) {
    const face = renderFace(f, 1024, 2);
    entries.push({ name: T + `title/background/panorama_${f}.png`, data: encodePNG(1024, 1024, face.toRGBA()) });
    console.log(`[menu-pack] panorama_${f} (${Date.now() - t0} ms)`);
  }
  entries.push({ name: T + 'title/background/panorama_overlay.png', data: new Layer(16, 16).png() });

  fs.mkdirSync(path.dirname(OUT_ZIP), { recursive: true });
  fs.writeFileSync(OUT_ZIP, makeZip(entries));
  console.log(`[menu-pack] Zapisano ${OUT_ZIP} (${(fs.statSync(OUT_ZIP).size / 1048576).toFixed(2)} MB, ${Date.now() - t0} ms)`);

  if (viewIdx >= 0) {
    const out = args[viewIdx + 1] || 'menu-view.png';
    const view = renderView(1600, 900, parseFloat(args[viewIdx + 2] || '0.35'));
    fs.writeFileSync(out, view.png());
    console.log(`[menu-pack] Podgląd: ${out}`);
  }
}

main();
