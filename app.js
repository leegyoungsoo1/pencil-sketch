const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const photoInput = document.querySelector('#photo');
const seconds = document.querySelector('#seconds');
const strength = document.querySelector('#strength');
const styleSelect = document.querySelector('#style');
const darkness = document.querySelector('#darkness');
const formatSelect = document.querySelector('#format');
const signatureToggle = document.querySelector('#signature');
const titleInput = document.querySelector('#title');
const introToggle = document.querySelector('#intro');
const messageInput = document.querySelector('#message');
const signatureInput = document.querySelector('#signatureText');
const talkToggle = document.querySelector('#talk');
const handToggle = document.querySelector('#hand');
const polaroidToggle = document.querySelector('#polaroidSketch');
const soundToggle = document.querySelector('#sound');
const volume = document.querySelector('#volume');
const preview = document.querySelector('#preview');
const exportButton = document.querySelector('#export');
const status = document.querySelector('#status');
const fileName = document.querySelector('#fileName');
// The drawing sheet (all analysis and strokes live in these coordinates) and the video frame it sits in:
// a warm wooden studio with the sheet as a canvas board on an easel.
const W = 720, H = 960, PAD = 52;
const VIEW_W = canvas.width, VIEW_H = canvas.height;
// The canvas board nearly fills the frame's width; the easel's clamp and mast show above, the tray and legs below.
const BOARD = (() => { const w = 980, h = w * H / W; return { x:(VIEW_W - w) / 2, y:Math.round((VIEW_H - h) * .42), w, h, s:w / W }; })();
// Timeline budget in "pixel-equivalents" per second: how much pencil travel fits in one second of video.
const SPEED = 4600;
// Shading is quick back-and-forth hand work, so it moves faster and costs less overhead than a considered contour.
const KIND = {
  construct: { speed:1.9, lift:26, overhead:8 },
  contour:   { speed:1.0, lift:30, overhead:8 },
  hatch:     { speed:3.6, lift:22, overhead:4 },
  fill:      { speed:1.4, lift:28, overhead:3 },
  accent:    { speed:0.9, lift:34, overhead:8 },
};
const strokeCost = (kind, len) => len / KIND[kind].speed + KIND[kind].overhead;
const SIGNATURE = { // "David Lee" — Allura (OFL) skeleton, reshaped: more slant, long rising tail
  aspect:5.54, dot:[5.508,0.327],
  paths:[
    [0.096,0.494,0.074,0.492,0.037,0.474,0.015,0.457,0.002,0.437,0.006,0.381,0.041,0.293,0.106,0.23,0.187,0.17,0.266,0.128,0.365,0.091,0.499,0.058,0.609,0.044,0.727,0.045,0.843,0.057,0.893,0.079,0.952,0.127,0.981,0.169,0.997,0.215,0.991,0.305,0.973,0.389,0.948,0.456,0.913,0.514,0.826,0.616,0.743,0.694,0.647,0.755,0.573,0.792,0.465,0.823,0.354,0.829,0.279,0.816,0.187,0.772,0.161,0.766,0.13,0.821,0.098,0.857,0.068,0.873,0.053,0.872,0.04,0.842,0.042,0.797,0.1,0.574],
    [0.074,0.662,0.116,0.692,0.157,0.743,0.164,0.762,0.186,0.74,0.261,0.62,0.379,0.45,0.409,0.394,0.443,0.349,0.58,0.226,0.625,0.199,0.652,0.199],
    [0.235,0.662,0.3,0.566],
    [0.412,0.391,0.472,0.319],
    [1.298,0.598,1.269,0.603,1.251,0.613,1.088,0.745,1.034,0.781,0.994,0.8,0.96,0.797,0.945,0.785,0.935,0.767,0.938,0.711,0.946,0.687,0.967,0.655,1.02,0.599,1.104,0.531,1.168,0.488,1.254,0.44,1.3,0.426,1.339,0.423,1.375,0.434,1.403,0.454],
    [1.348,0.534,1.31,0.584,1.282,0.636,1.25,0.733,1.245,0.775,1.255,0.796,1.28,0.805,1.315,0.803,1.345,0.793,1.467,0.694,1.521,0.642,1.56,0.593,1.571,0.584,1.604,0.573,1.62,0.559,1.65,0.484,1.651,0.442,1.628,0.426,1.584,0.43],
    [1.431,0.725,1.495,0.67],
    [1.514,0.813,1.518,0.798,1.534,0.78,1.592,0.734,1.728,0.593,1.904,0.434,1.972,0.386,2.038,0.354,2.077,0.352,2.092,0.36,2.102,0.375],
    [1.529,0.781,1.542,0.73,1.592,0.624,1.613,0.566],
    [1.825,0.502,1.863,0.462],
    [1.891,0.67,1.924,0.637,1.97,0.62,2.077,0.454],
    [1.936,0.63,1.948,0.64,1.945,0.666,1.911,0.755,1.909,0.772,1.929,0.801,1.951,0.808,1.983,0.803,2.026,0.782,2.127,0.712,2.179,0.689,2.201,0.662],
    [2.159,0.319,2.168,0.319,2.19,0.304,2.242,0.239],
    [2.595,0.534,2.575,0.561,2.545,0.571,2.498,0.602,2.381,0.702,2.251,0.794,2.219,0.803,2.195,0.797,2.175,0.769,2.17,0.745,2.183,0.694,2.216,0.64,2.337,0.537,2.407,0.486,2.457,0.456,2.512,0.432,2.566,0.423,2.623,0.432,2.641,0.45,2.64,0.47,2.576,0.565,2.493,0.734,2.467,0.803,2.444,0.902,2.458,0.932,2.488,0.953,2.525,0.949,2.561,0.925],
    [2.419,0.67,2.51,0.59],
    [2.648,0.462,2.664,0.45,2.685,0.451,2.717,0.439,2.79,0.391,2.942,0.262,3.04,0.166,3.085,0.102,3.103,0.046,3.103,0.034,3.093,0.022,3.054,0.016],
    [2.666,0.446,2.677,0.417,2.716,0.351,2.814,0.216,2.877,0.146,2.988,0.048],
    [2.789,0.255,2.827,0.201,2.869,0.158,2.885,0.134,2.963,0.064],
    [2.868,0.327,2.977,0.231],
    [2.864,0.845,2.882,0.832,2.916,0.824,3.041,0.841,3.152,0.875,3.417,0.977,3.459,0.99,3.518,0.999,3.604,0.995,3.664,0.974,3.684,0.953,3.693,0.931,3.693,0.901,3.684,0.885],
    [3.017,0.486,3.011,0.48,2.996,0.483,2.963,0.511,2.945,0.544,2.942,0.575,2.949,0.589,2.966,0.601,2.985,0.604,3.116,0.601,3.163,0.548,3.226,0.442,3.371,0.237,3.437,0.154,3.496,0.092,3.549,0.048,3.597,0.02,3.657,0.002,3.688,0,3.711,0.006,3.729,0.027,3.734,0.047,3.716,0.128,3.65,0.237,3.585,0.313,3.482,0.405,3.384,0.472,3.236,0.549,3.196,0.563,3.148,0.562,3.137,0.574],
    [2.936,0.821,2.943,0.806,3.037,0.705,3.117,0.598],
    [3.004,0.741,3.055,0.678],
    [3.276,0.375,3.341,0.279],
    [3.354,0.486,3.43,0.438],
    [3.473,0.112,3.52,0.064],
    [3.559,0.654,3.673,0.615,3.712,0.592,3.755,0.557,3.796,0.515,3.817,0.481,3.821,0.44,3.794,0.43,3.729,0.445,3.68,0.471,3.577,0.55,3.516,0.608,3.475,0.658,3.444,0.712,3.441,0.762,3.454,0.798,3.484,0.817,3.541,0.821,3.604,0.809,3.648,0.789,3.77,0.711,3.852,0.68,3.892,0.63,4.027,0.503,4.097,0.46,4.162,0.433,4.201,0.431,4.217,0.44,4.209,0.494,4.189,0.527,4.159,0.555,4.079,0.609,4.024,0.634,3.955,0.654],
    [3.865,0.662,3.848,0.685,3.836,0.733,3.837,0.766,3.852,0.796,3.873,0.814,3.889,0.819,3.948,0.821,3.986,0.816,4.102,0.756,4.185,0.695,4.24,0.644,4.342,0.535,4.426,0.466,4.518,0.408,4.616,0.36,4.72,0.322,4.832,0.295,4.951,0.278,5.076,0.271,5.209,0.274,5.348,0.287],
  ],
};
let source = null, analysis = null, plan = null, raf = 0, session = null;

// ───────────────────────── utilities ─────────────────────────
function clamp(value, low = 0, high = 1) { return Math.max(low, Math.min(high, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function random(seed) { // mulberry32: the same photo always produces the same drawing (preview == export)
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function fitRect(w, h) {
  const maxW = W - PAD * 2, maxH = H - PAD * 2, scale = Math.min(maxW / w, maxH / h);
  const fw = Math.round(w * scale), fh = Math.round(h * scale);
  return { x:Math.round((W - fw) / 2), y:Math.round((H - fh) / 2), w:fw, h:fh };
}
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w; let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[row + clamp(i, 0, w - 1)];
    for (let x = 0; x < w; x++) { tmp[row + x] = acc * norm; acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += tmp[clamp(i, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) { out[y * w + x] = acc * norm; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
  }
  return out;
}
const blur = (src, w, h, r) => boxBlur(boxBlur(src, w, h, r), w, h, r);
// Feature-zone flags (one byte per pixel) and their bit positions for per-stroke fractions.
const Z = { BROW:1, EYE:2, IRIS:4, LIPS:8, NOSE:16, BRIDGE:32, HAND:64, JAW:128 };
const ZB = { BROW:0, EYE:1, IRIS:2, LIPS:3, NOSE:4, BRIDGE:5, HAND:6, JAW:7 };
// Geometry for landmark regions (all in analysis-grid pixels).
const centroid = pts => ({ x:pts.reduce((a, p) => a + p.x, 0) / pts.length, y:pts.reduce((a, p) => a + p.y, 0) / pts.length });
function convexHull(points) { // monotone chain
  const pts = points.slice().sort((a, z) => a.x - z.x || a.y - z.y), cross = (o, a, z) => (a.x - o.x) * (z.y - o.y) - (a.y - o.y) * (z.x - o.x);
  const half = list => { const out = []; for (const p of list) { while (out.length > 1 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop(); out.push(p); } out.pop(); return out; };
  return pts.length < 3 ? pts : [...half(pts), ...half(pts.slice().reverse())];
}
function insidePolygon(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function segmentDistance(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, t = clamp(((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(px - a.x - dx * t, py - a.y - dy * t);
}
function paintPolygon(zone, gw, gh, poly, flag, grow = 0) {
  const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - grow)), x1 = Math.min(gw - 1, Math.ceil(Math.max(...xs) + grow));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - grow)), y1 = Math.min(gh - 1, Math.ceil(Math.max(...ys) + grow));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let hit = insidePolygon(poly, x, y);
    for (let k = 0; !hit && grow > 0 && k < poly.length; k++) hit = segmentDistance(x, y, poly[k], poly[(k + 1) % poly.length]) <= grow;
    if (hit) zone[y * gw + x] |= flag;
  }
}
function paintCapsule(zone, gw, gh, a, b, radius, flag) { paintPolygon(zone, gw, gh, [a, b], flag, radius); }
function percentile(values, p, step = 7) {
  const sample = []; for (let i = 0; i < values.length; i += step) sample.push(values[i]);
  sample.sort((a, b) => a - b); return sample[Math.floor(clamp(p) * (sample.length - 1))];
}
function hash(a, b, c) { let h = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2147483647) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; }

// ───────────────────────── paper & graphite texture ─────────────────────────
const tooth = (() => { // paper tooth: graphite catches the peaks and skips the valleys
  const size = 256, rand = random(7), noise = new Float32Array(size * size);
  for (let i = 0; i < noise.length; i++) noise[i] = rand();
  const soft = blur(noise, size, size, 1), field = new Float32Array(size * size);
  for (let i = 0; i < field.length; i++) field[i] = clamp((soft[i] - .5) * 3.2 + .5 + (noise[i] - .5) * .35);
  return { size, field };
})();
const paperCanvas = (() => {
  const layer = document.createElement('canvas'); layer.width = W; layer.height = H;
  const c = layer.getContext('2d');
  // Canvas-board paper: warm white, lit a little brighter from the studio window at the upper left.
  const wash = c.createLinearGradient(0, 0, W, H); wash.addColorStop(0, '#fbf8f1'); wash.addColorStop(.55, '#f6f1e6'); wash.addColorStop(1, '#e9e0cf');
  c.fillStyle = wash; c.fillRect(0, 0, W, H);
  const img = c.getImageData(0, 0, W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const shade = (tooth.field[(y % tooth.size) * tooth.size + x % tooth.size] - .5) * 9, p = (y * W + x) * 4;
    d[p] += shade; d[p + 1] += shade; d[p + 2] += shade;
  }
  c.putImageData(img, 0, 0);
  return layer;
})();
// ───────────────────────── studio scene: wooden wall and floor, easel, canvas board ─────────────────────────
function woodPiece(g, x, y, w, h, seed, tone = 0) {
  // A pine board along its long axis: base colour, soft rounding light, and wavy grain lines.
  const rand = random(seed), vertical = h > w, len = vertical ? h : w, across = vertical ? w : h;
  g.save(); g.translate(x, y);
  if (!vertical) { g.translate(0, h); g.rotate(-Math.PI / 2); }
  const base = g.createLinearGradient(0, 0, across, 0);
  const light = `hsl(34, 52%, ${80 - tone}%)`, mid = `hsl(33, 50%, ${73 - tone}%)`, dark = `hsl(30, 42%, ${60 - tone}%)`;
  base.addColorStop(0, dark); base.addColorStop(.18, mid); base.addColorStop(.45, light); base.addColorStop(.8, mid); base.addColorStop(1, dark);
  g.fillStyle = base; g.fillRect(0, 0, across, len);
  g.beginPath(); g.rect(0, 0, across, len); g.clip();
  for (let k = 0; k < across * .55; k++) {
    const u = rand() * across, amp = .6 + rand() * 1.8, freq = 60 + rand() * 160, phase = rand() * 7;
    g.strokeStyle = `hsla(28, 40%, ${48 - tone}%, ${.05 + rand() * .12})`; g.lineWidth = .6 + rand() * 1.1;
    g.beginPath();
    for (let v = -4; v <= len + 4; v += 6) { const off = Math.sin(v / freq + phase) * amp; v === -4 ? g.moveTo(u + off, v) : g.lineTo(u + off, v); }
    g.stroke();
  }
  for (let k = 0; k < Math.floor(len / 700); k++) { // an occasional knot
    const kx = across * (.3 + rand() * .4), ky = len * rand(), r = across * (.12 + rand() * .08);
    const knot = g.createRadialGradient(kx, ky, 0, kx, ky, r * 1.8); knot.addColorStop(0, `hsla(26,45%,${40 - tone}%,.35)`); knot.addColorStop(1, 'hsla(26,45%,40%,0)');
    g.fillStyle = knot; g.beginPath(); g.ellipse(kx, ky, r, r * 1.8, 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
function leg(g, top, bottom, width, seed, tone) {
  // A leg from `top` to `bottom` (centre points), drawn as a rotated board.
  const dx = bottom.x - top.x, dy = bottom.y - top.y, len = Math.hypot(dx, dy);
  g.save(); g.translate(top.x, top.y); g.rotate(Math.atan2(dy, dx) - Math.PI / 2);
  woodPiece(g, -width / 2, 0, width, len, seed, tone);
  g.restore();
}
const sceneCanvas = (() => {
  const layer = document.createElement('canvas'); layer.width = VIEW_W; layer.height = VIEW_H;
  const g = layer.getContext('2d'), rand = random(21), floorY = Math.round(Math.min(VIEW_H * .92, BOARD.y + BOARD.h + 120));
  // Wall: warm vertical wood panelling.
  const wall = g.createLinearGradient(0, 0, 0, floorY); wall.addColorStop(0, '#c9a57c'); wall.addColorStop(1, '#b38b62');
  g.fillStyle = wall; g.fillRect(0, 0, VIEW_W, floorY);
  const panel = 135;
  for (let x = -20, k = 0; x < VIEW_W; x += panel, k++) {
    g.globalAlpha = .55; woodPiece(g, x, 0, panel, floorY, 100 + k, 14 + rand() * 6); g.globalAlpha = 1;
    g.fillStyle = 'rgba(70,45,25,.35)'; g.fillRect(x - 1.5, 0, 3, floorY); // seam
  }
  // Floor: darker planks in gentle perspective, with a skirting board.
  const floor = g.createLinearGradient(0, floorY, 0, VIEW_H); floor.addColorStop(0, '#8a6445'); floor.addColorStop(1, '#6d4c33');
  g.fillStyle = floor; g.fillRect(0, floorY, VIEW_W, VIEW_H - floorY);
  g.strokeStyle = 'rgba(45,28,16,.35)'; g.lineWidth = 2;
  for (let k = -8; k <= 8; k++) { g.beginPath(); g.moveTo(VIEW_W / 2 + k * 70, floorY); g.lineTo(VIEW_W / 2 + k * 190, VIEW_H); g.stroke(); }
  for (const f of [.14, .34, .6, .92]) { const yy = floorY + (VIEW_H - floorY) * f; g.strokeStyle = 'rgba(45,28,16,.18)'; g.beginPath(); g.moveTo(0, yy); g.lineTo(VIEW_W, yy); g.stroke(); }
  woodPiece(g, 0, floorY - 34, VIEW_W, 38, 7, 22);
  g.fillStyle = 'rgba(40,24,12,.35)'; g.fillRect(0, floorY, VIEW_W, 5);
  // Window light falling across the wall from the upper left.
  g.save(); g.globalCompositeOperation = 'soft-light';
  const beam = g.createLinearGradient(0, 0, VIEW_W * .9, VIEW_H * .7); beam.addColorStop(0, 'rgba(255,236,200,.85)'); beam.addColorStop(.55, 'rgba(255,230,190,.25)'); beam.addColorStop(1, 'rgba(0,0,0,.2)');
  g.fillStyle = beam; g.fillRect(0, 0, VIEW_W, VIEW_H); g.restore();

  const B = BOARD, cx = VIEW_W / 2, trayY = B.y + B.h + 6, trayH = 46;
  const easelShape = (off, spread) => { // a silhouette for the cast shadow
    g.fillRect(cx - 30 + off.x, -10 + off.y, 60, trayY + off.y + 10);
    g.fillRect(B.x + off.x - 8, B.y + off.y, B.w + 16, B.h);
    g.fillRect(B.x - 70 + off.x, trayY + off.y, B.w + 140, trayH);
    for (const [x0, x1] of [[cx - 300, cx - 380 - spread], [cx + 300, cx + 380 + spread], [cx, cx]]) {
      g.beginPath(); g.moveTo(x0 - 26 + off.x, trayY + off.y); g.lineTo(x0 + 26 + off.x, trayY + off.y); g.lineTo(x1 + 26 + off.x, VIEW_H); g.lineTo(x1 - 26 + off.x, VIEW_H); g.closePath(); g.fill();
    }
  };
  g.save(); g.filter = 'blur(22px)'; g.fillStyle = 'rgba(40,22,10,.32)'; easelShape({ x:48, y:26 }, 40); g.restore();
  // Easel, back to front: mast and back leg, front legs, board shadow, board, top clamp, tray.
  woodPiece(g, cx - 30, -10, 60, trayY + 60, 31, 0);
  leg(g, { x:cx, y:trayY + trayH - 4 }, { x:cx + 6, y:VIEW_H + 20 }, 50, 32, 8);
  leg(g, { x:cx - 300, y:trayY + 10 }, { x:cx - 380, y:VIEW_H + 60 }, 58, 33, 2);
  leg(g, { x:cx + 300, y:trayY + 10 }, { x:cx + 380, y:VIEW_H + 60 }, 58, 34, 2);
  g.save(); g.filter = 'blur(10px)'; g.fillStyle = 'rgba(30,18,8,.35)'; g.fillRect(B.x + 14, B.y + 16, B.w, B.h); g.restore();
  g.fillStyle = '#d9d0bf'; g.fillRect(B.x + B.w, B.y + 6, 9, B.h); g.fillRect(B.x + 6, B.y + B.h, B.w + 3, 7); // board thickness
  const clampW = 230;
  g.save(); g.filter = 'blur(6px)'; g.fillStyle = 'rgba(30,18,8,.35)'; g.fillRect(cx - clampW / 2 + 8, B.y - 26 + 10, clampW, 46); g.restore();
  woodPiece(g, cx - clampW / 2, B.y - 26, clampW, 44, 35, -2);
  g.save(); g.filter = 'blur(8px)'; g.fillStyle = 'rgba(30,18,8,.4)'; g.fillRect(B.x - 60, trayY + 16, B.w + 130, trayH); g.restore();
  woodPiece(g, B.x - 70, trayY, B.w + 140, 16, 36, -6);          // tray top face, catching the light
  woodPiece(g, B.x - 70, trayY + 16, B.w + 140, trayH - 16, 37, 6); // tray front face
  g.fillStyle = 'rgba(60,36,18,.25)'; g.fillRect(B.x - 70, trayY + 15, B.w + 140, 2);
  // Soft vignette to keep the eye on the canvas.
  const vig = g.createRadialGradient(cx, B.y + B.h * .45, B.h * .45, cx, B.y + B.h * .45, VIEW_H * .8);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(25,14,6,.45)');
  g.fillStyle = vig; g.fillRect(0, 0, VIEW_W, VIEW_H);
  return layer;
})();
// The instant-film card: the intro photo is shown on it, and in the "polaroid" style the sketch itself is drawn on it.
// Resting pose on the canvas board, and the square picture window's centre relative to the card's centre.
const POLAROID = (() => {
  const img = Math.round(BOARD.w * .68), border = Math.round(img * .055), bottom = Math.round(img * .26), tape = 32;
  const cardW = img + border * 2, cardH = img + border + bottom, angle = -.085, center = { x:VIEW_W / 2, y:BOARD.y + BOARD.h * .47 };
  const off = -(cardH + tape) / 2 + tape + border + img / 2; // picture centre below the card centre (the tape strip sits on top)
  return { img, border, bottom, tape, cardW, cardH, angle, center, window:{ x:center.x - Math.sin(angle) * off, y:center.y + Math.cos(angle) * off } };
})();
// Sheet → video frame. Normally the sheet fills the canvas board; in the polaroid style a square window of the sheet is
// shown, scaled and tilted, in the card's picture area (plan.polaroid holds that window).
function applySheet(g) {
  const p = plan?.polaroid;
  if (!p) { g.translate(BOARD.x, BOARD.y); g.scale(BOARD.s, BOARD.s); return; }
  g.translate(POLAROID.window.x, POLAROID.window.y); g.rotate(POLAROID.angle); g.scale(p.s, p.s); g.translate(-p.cx, -p.cy);
}
function sheetToView(x, y) {
  const p = plan?.polaroid; if (!p) return { x:BOARD.x + x * BOARD.s, y:BOARD.y + y * BOARD.s };
  const dx = (x - p.cx) * p.s, dy = (y - p.cy) * p.s, c = Math.cos(POLAROID.angle), s = Math.sin(POLAROID.angle);
  return { x:POLAROID.window.x + dx * c - dy * s, y:POLAROID.window.y + dx * s + dy * c };
}
function viewToSheet(x, y) {
  const p = plan?.polaroid; if (!p) return { x:(x - BOARD.x) / BOARD.s, y:(y - BOARD.y) / BOARD.s };
  const dx = x - POLAROID.window.x, dy = y - POLAROID.window.y, c = Math.cos(POLAROID.angle), s = Math.sin(POLAROID.angle);
  return { x:p.cx + (dx * c + dy * s) / p.s, y:p.cy + (-dx * s + dy * c) / p.s };
}
const onSheet = fn => { ctx.save(); applySheet(ctx); fn(); ctx.restore(); };
const clipWindow = () => { const p = plan?.polaroid; if (p) { ctx.beginPath(); ctx.rect(p.x0, p.y0, p.side, p.side); ctx.clip(); } };
let GRAPHITE_MEAN = 0;
const graphite = (() => {
  const tile = document.createElement('canvas'); tile.width = tile.height = tooth.size;
  const c = tile.getContext('2d'), img = c.createImageData(tooth.size, tooth.size), rand = random(11);
  for (let i = 0; i < tooth.field.length; i++) {
    const p = i * 4, a = clamp(.18 + tooth.field[i] * .95 + (rand() - .5) * .3);
    img.data[p] = 36; img.data[p + 1] = 34; img.data[p + 2] = 38; img.data[p + 3] = 255 * a; GRAPHITE_MEAN += a;
  }
  GRAPHITE_MEAN /= tooth.field.length;
  c.putImageData(img, 0, 0);
  return tile;
})();
const ink = document.createElement('canvas'); ink.width = W; ink.height = H;
const inkCtx = ink.getContext('2d');
inkCtx.strokeStyle = inkCtx.createPattern(graphite, 'repeat'); inkCtx.lineCap = 'butt';
// Polaroid style: the handwritten line and the signature go on the card's white margin, outside the picture window.
const notes = document.createElement('canvas'); notes.width = W; notes.height = H;
const notesCtx = notes.getContext('2d');
notesCtx.strokeStyle = notesCtx.createPattern(graphite, 'repeat'); notesCtx.lineCap = 'butt';
// AI style: the pencil's path is painted into a reveal mask; the AI graphite layer shows through wherever it has passed.
const reveal = document.createElement('canvas'); reveal.width = W; reveal.height = H;
const revealCtx = reveal.getContext('2d');
revealCtx.strokeStyle = '#fff'; revealCtx.lineCap = 'round'; revealCtx.lineJoin = 'round';
const aiFrame = document.createElement('canvas'); aiFrame.width = W; aiFrame.height = H;
const aiFrameCtx = aiFrame.getContext('2d');

// ───────────────────────── photo analysis ─────────────────────────
function findFace(rgba, w, h) {
  // Skin-tone blobs (YCbCr) scored by size, compactness and a portrait-like position.
  const step = 4, cw = Math.floor(w / step), ch = Math.floor(h / step), skin = new Uint8Array(cw * ch);
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
    const p = ((cy * step + 2) * w + cx * step + 2) * 4, r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
    const y = .299 * r + .587 * g + .114 * b, cb = 128 - .168736 * r - .331264 * g + .5 * b, cr = 128 + .5 * r - .418688 * g - .081312 * b;
    skin[cy * cw + cx] = y > 45 && cb >= 77 && cb <= 127 && cr >= 135 && cr <= 175 && r > g && r > b ? 1 : 0;
  }
  let best = null; const seen = new Uint8Array(cw * ch), queue = new Int32Array(cw * ch);
  for (let start = 0; start < skin.length; start++) {
    if (!skin[start] || seen[start]) continue;
    let head = 0, tail = 0, count = 0, minX = cw, maxX = 0, minY = ch, maxY = 0, sumX = 0;
    queue[tail++] = start; seen[start] = 1;
    while (head < tail) {
      const i = queue[head++], x = i % cw, y = (i / cw) | 0; count++; sumX += x;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const j of [i - 1, i + 1, i - cw, i + cw]) {
        if (j < 0 || j >= skin.length || seen[j] || !skin[j] || Math.abs((j % cw) - x) > 1) continue;
        seen[j] = 1; queue[tail++] = j;
      }
    }
    if (count < cw * ch * .012) continue;
    const bw = maxX - minX + 1, bh = Math.min(maxY - minY + 1, bw * 1.35);
    const fill = count / (bw * (maxY - minY + 1)), centerX = sumX / count / cw, centerY = (minY + bh / 2) / ch;
    const score = count * (.4 + fill) * (1.2 - Math.abs(centerX - .5)) * (1.25 - centerY * .6);
    if (!best || score > best.score) best = { score, x:(minX + bw / 2) * step, y:(minY + bh * .42) * step, rx:bw * step * .62, ry:bh * step * .74 };
  }
  return best ? { ...best, found:true } : { x:w * .5, y:h * .36, rx:w * .24, ry:h * .22, found:false };
}
function prepare(img, crop = null) { // face-independent work, done once per photo (and once more for the zoomed crop)
  const src = crop ?? { x:0, y:0, w:img.naturalWidth, h:img.naturalHeight };
  const b = fitRect(src.w, src.h), gw = b.w, gh = b.h, n = gw * gh;
  const work = document.createElement('canvas'); work.width = gw; work.height = gh;
  const wctx = work.getContext('2d', { willReadFrequently:true });
  wctx.fillStyle = '#fff'; wctx.fillRect(0, 0, gw, gh); wctx.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, gw, gh);
  const rgba = wctx.getImageData(0, 0, gw, gh).data, lum = new Float32Array(n), value = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    lum[i] = rgba[i * 4] * .299 + rgba[i * 4 + 1] * .587 + rgba[i * 4 + 2] * .114;
    value[i] = Math.max(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]); // red lips and flushed cheeks stay light; real shadows don't
  }
  return { b, gw, gh, n, work, rgba, image:img, soft:blur(lum, gw, gh, 2), softValue:blur(value, gw, gh, 2), crop:src, b1:blur(lum, gw, gh, 1), b2:blur(lum, gw, gh, 2), b4:blur(lum, gw, gh, 4) };
}
function chooseCrop(img, base, face, hands = []) {
  // Frame the portrait: the face takes about a third of the drawing's height, hair and shoulders fill the rest —
  // and any visible hand is always kept whole, with a margin, even if that means pulling the framing back.
  if (face.source !== 'ai') return null;
  const natW = img.naturalWidth, natH = img.naturalHeight, s = natW / base.gw, aspect = (W - PAD * 2) / (H - PAD * 2);
  const boxH = face.ry / .62 * s, top = (face.y - face.ry / .62 * .42) * s, cx = face.x * s;
  let h = Math.min(boxH / .3, natH, natW / aspect), w = h * aspect;
  let x = clamp(cx - w / 2, 0, natW - w), y = clamp(top - h * .2, 0, natH - h);
  for (const hand of hands) {
    const xs = hand.map(p => p.x * s), ys = hand.map(p => p.y * s), m = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * .25;
    const ux0 = Math.min(x, Math.min(...xs) - m), uy0 = Math.min(y, Math.min(...ys) - m), ux1 = Math.max(x + w, Math.max(...xs) + m), uy1 = Math.max(y + h, Math.max(...ys) + m);
    if (ux0 >= x && uy0 >= y && ux1 <= x + w && uy1 <= y + h) continue;
    w = Math.min(natW, Math.max(ux1 - ux0, (uy1 - uy0) * aspect)); h = Math.min(natH, w / aspect); w = h * aspect;
    x = clamp((ux0 + ux1) / 2 - w / 2, 0, natW - w); y = clamp(Math.min(uy0, top - h * .2), 0, natH - h);
  }
  // Never at the face's expense: when a far-off hand can't share the frame, the face stays whole and the hand is cut.
  const fx0 = (face.x - face.rx * 1.15) * s, fx1 = (face.x + face.rx * 1.15) * s, fy0 = (face.y - face.ry * 1.3) * s, fy1 = (face.y + face.ry * 1.1) * s;
  if (fx1 - fx0 <= w) x = clamp(clamp(x, fx1 - w, fx0), 0, natW - w);
  if (fy1 - fy0 <= h) y = clamp(clamp(y, fy1 - h, fy0), 0, natH - h);
  if (w > natW * .92 && h > natH * .92) return null;
  return { x, y, w, h };
}
async function analyzePhoto(img) {
  let base = prepare(img), face = await detectFace(base);
  const early = face.source === 'ai' ? await detectLandmarks(base) : null; // hands on the whole photo, to frame them in
  if (early?.mesh) {
    // The face mesh only fits human faces. If the detector's pick doesn't contain the mesh's nose, trust the mesh.
    const nose = early.mesh[1], inside = Math.hypot((nose.x - face.x) / face.rx, (nose.y - face.y) / face.ry) < 1;
    if (!inside) {
      const oval = early.parts.oval.map(c => early.mesh[c.start]), xs = oval.map(p => p.x), ys = oval.map(p => p.y);
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      face = faceFromBox(Math.min(...xs), Math.min(...ys) + h * .12, w, h * .88, 'ai', [centroid(early.parts.irisL.map(i => early.mesh[i])), centroid(early.parts.irisR.map(i => early.mesh[i]))]);
    }
  }
  const crop = chooseCrop(img, base, face, early?.hands ?? []);
  if (crop) {
    const zoomed = prepare(img, crop), refound = await detectFace(zoomed), s0 = img.naturalWidth / base.gw, k = zoomed.gw / crop.w;
    // If the detector misses on the zoomed crop, carry the original face over into crop coordinates.
    const toCrop = p => ({ x:(p.x * s0 - crop.x) * k, y:(p.y * s0 - crop.y) * k });
    face = refound.source === 'ai' ? refound : { ...face, ...toCrop(face), rx:face.rx * s0 * k, ry:face.ry * s0 * k, eyes:face.eyes?.map(toCrop) ?? null };
    base = zoomed;
  }
  [base.person, base.marks, base.objects] = await Promise.all([segmentPerson(base), detectLandmarks(base), segmentObjects(base)]);
  const mesh = base.marks?.mesh;
  if (mesh && face.source === 'ai') {
    // The mesh's face oval is tighter and follows head tilt better than the detector box; irises are exact eye centres.
    const oval = base.marks.parts.oval.map(c => mesh[c.start]), xs = oval.map(p => p.x), ys = oval.map(p => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), centre = ids => centroid(ids.map(i => mesh[i]));
    face = { ...face, x:(x0 + x1) / 2, y:(y0 + y1) / 2, rx:(x1 - x0) / 2 * 1.02, ry:(y1 - y0) / 2 * 1.04, eyes:[centre(base.marks.parts.irisL), centre(base.marks.parts.irisR)] };
  }
  return analyzeFace(base, face);
}
function analyzeFace(base, face) { // everything that depends on where the face is; re-run when the user corrects it
  const { b, gw, gh, n, soft, softValue, b1, b2, b4 } = base;
  // Feature zones from the face mesh and hand landmarks: each pixel carries flags for the part it belongs to.
  const zone = new Uint8Array(n), marks = base.marks, mesh = marks?.mesh;
  if (mesh) {
    const P = ids => ids.map(i => mesh[i]), { parts } = marks;
    const eyeGap = Math.hypot(centroid(P(parts.irisL)).x - centroid(P(parts.irisR)).x, centroid(P(parts.irisL)).y - centroid(P(parts.irisR)).y) || face.rx;
    for (const ids of [parts.browL, parts.browR]) paintPolygon(zone, gw, gh, convexHull(P(ids)), Z.BROW, eyeGap * .03);
    for (const ids of [parts.eyeL, parts.eyeR]) paintPolygon(zone, gw, gh, convexHull(P(ids)), Z.EYE, eyeGap * .05);
    for (const ids of [parts.irisL, parts.irisR]) paintPolygon(zone, gw, gh, convexHull(P(ids)), Z.IRIS, 1);
    paintPolygon(zone, gw, gh, convexHull(P(parts.lips)), Z.LIPS, eyeGap * .04);
    paintPolygon(zone, gw, gh, convexHull(P([1, 2, 4, 98, 327, 129, 358, 115, 344])), Z.NOSE, eyeGap * .05); // tip, wings, nostrils
    paintCapsule(zone, gw, gh, mesh[168], mesh[5], eyeGap * .2, Z.BRIDGE);
    for (const c of parts.oval) paintCapsule(zone, gw, gh, mesh[c.start], mesh[c.end], eyeGap * .06, Z.JAW);
  }
  for (const hand of marks?.hands ?? []) {
    const palm = Math.hypot(hand[5].x - hand[17].x, hand[5].y - hand[17].y) || 20;
    // Generous margins: the zone must reach past the finger edges so the whole outline is measured at fine scale.
    paintPolygon(zone, gw, gh, convexHull([0, 1, 2, 5, 9, 13, 17].map(i => hand[i])), Z.HAND, palm * .4);
    for (const c of marks.bones) paintCapsule(zone, gw, gh, hand[c.start], hand[c.end], palm * .36, Z.HAND);
  }
  const handRaw = new Float32Array(n), eyeRaw = new Float32Array(n);
  for (let i = 0; i < n; i++) { handRaw[i] = zone[i] & Z.HAND ? 1 : 0; eyeRaw[i] = zone[i] & (Z.EYE | Z.IRIS) ? 1 : 0; }
  const handW = blur(handRaw, gw, gh, 3), meshEyes = mesh ? blur(eyeRaw, gw, gh, 2) : null;

  const faceW = new Float32Array(n), far = new Float32Array(n), subject = new Float32Array(n), head = new Uint8Array(n), eyeW = new Float32Array(n), detail = new Float32Array(n), core = [];
  const eyes = face.eyes ?? [];
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x, d = Math.hypot((x - face.x) / face.rx, (y - face.y) / face.ry);
    faceW[i] = clamp(1 - (d - 1) / .45);
    // Eye zones (lids, lashes, iris) — where likeness lives, so they get extra care.
    if (meshEyes) eyeW[i] = clamp(meshEyes[i] * 1.6);
    else for (const e of eyes) eyeW[i] = Math.max(eyeW[i], clamp(1 - (Math.hypot((x - e.x) / (face.rx * .3), (y - e.y) / (face.ry * .16)) - .7) / .5));
    detail[i] = Math.max(faceW[i], clamp(handW[i] * 1.5)); // faces and hands get the fine treatment
    head[i] = Math.hypot((x - face.x) / (face.rx * 1.7), (y - face.y) / (face.ry * 1.5)) < 1 ? 1 : 0;
    // Detail fades away from the subject, but the body below the face stays important — and hands never fade.
    const below = y > face.y ? .55 : 1;
    far[i] = clamp((Math.hypot((x - face.x) / (face.rx * 2.6), (y - face.y) / (face.ry * 4 / below)) - .6) / 1.2) * (1 - clamp(handW[i] * 1.5));
    if (base.person) subject[i] = Math.max(base.person[i], faceW[i], clamp(handW[i] * 1.5));
    else { // no segmentation model: assume a head with hair plus shoulders widening below it
      const headShape = clamp(1 - (Math.hypot((x - face.x) / (face.rx * 1.35), (y - face.y) / (face.ry * 1.3)) - 1) / .3);
      const top = face.y + face.ry * .7, halfWidth = face.rx * (1.1 + Math.max(0, y - top) / face.ry * 1.6);
      subject[i] = Math.max(headShape, y > top ? clamp(1 - (Math.abs(x - face.x) - halfWidth) / (face.rx * .4)) : 0);
    }
    if (d < .8 && !(x & 1) && !(y & 1)) core.push(soft[i]);
  }
  core.sort((a, z) => a - z);
  const skinHi = core.length ? core[Math.floor(core.length * .92)] : 255;

  // Line field (difference of Gaussians): strong on dark lines and the dark side of crisp edges,
  // weak on soft shading — so cheek and nose shadows become tone instead of wrinkle-like lines.
  // Hands use the same fine field, normalised by their own contrast: finger-against-finger edges are faint skin-on-skin.
  const faceDog = new Float32Array(n), bodyDog = new Float32Array(n), faceSample = [], handSample = [];
  for (let i = 0; i < n; i++) {
    faceDog[i] = Math.max(0, b2[i] - b1[i] + (b4[i] - b2[i]) * .5); bodyDog[i] = Math.max(0, b4[i] - b2[i]);
    if (i % 5 === 0) { if (faceW[i] > .5) faceSample.push(faceDog[i]); else if (handW[i] > .5) handSample.push(faceDog[i]); }
  }
  const highEnd = list => { list.sort((a, z) => a - z); return list.length ? list[Math.floor(list.length * .985)] : 0; };
  const nf = Math.max(4, highEnd(faceSample)), nh = Math.max(4, highEnd(handSample)), nb = Math.max(4, percentile(bodyDog, .985));
  const line = new Float32Array(n);
  // Near a hand the coarse body field is switched off: it paints a wide band just outside the fingers.
  for (let i = 0; i < n; i++) line[i] = clamp(lerp(bodyDog[i] / nb * (1 - clamp(handW[i] * 4)), faceDog[i] / (faceW[i] >= handW[i] ? nf : nh), detail[i]));

  // Structure tensor: a smooth stroke direction (along contours and hair strands) plus how coherent it is.
  const gx = new Float32Array(n), gy = new Float32Array(n);
  const at = (f, x, y) => f[clamp(y, 0, gh - 1) * gw + clamp(x, 0, gw - 1)];
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x, f = detail[i] > .5 ? b1 : b2;
    gx[i] = (at(f, x + 1, y - 1) + 2 * at(f, x + 1, y) + at(f, x + 1, y + 1)) - (at(f, x - 1, y - 1) + 2 * at(f, x - 1, y) + at(f, x - 1, y + 1));
    gy[i] = (at(f, x - 1, y + 1) + 2 * at(f, x, y + 1) + at(f, x + 1, y + 1)) - (at(f, x - 1, y - 1) + 2 * at(f, x, y - 1) + at(f, x + 1, y - 1));
  }
  // Precise edges for faces and hands: gradient magnitude thinned to a one-pixel ridge (non-maximum suppression).
  // The DoG field above only marks the darker side of an edge, so a light hand against a dark backdrop lost its outline;
  // this sits exactly on the boundary whichever side is darker.
  const edgeMag = new Float32Array(n), edgeSample = [];
  for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
    const i = y * gw + x; if (detail[i] < .3) continue;
    const m = Math.hypot(gx[i], gy[i]); if (m < 1) continue;
    const o = Math.round(gy[i] / m) * gw + Math.round(gx[i] / m);
    if (m >= Math.hypot(gx[i + o], gy[i + o]) && m >= Math.hypot(gx[i - o], gy[i - o])) { edgeMag[i] = m; if (i % 3 === 0) edgeSample.push(m); }
  }
  const ne = Math.max(60, highEnd(edgeSample) * .8);
  for (let i = 0; i < n; i++) if (edgeMag[i]) line[i] = Math.max(line[i], clamp(edgeMag[i] / ne) * (handW[i] > faceW[i] ? .95 : .75) * clamp(detail[i] * 1.5));

  // Hand outline from skin colour: the person mask is only 256×256 and turns fingers into mittens, so inside each
  // hand the boundary of "this hand's skin tone" is used instead (sampled at its own joints).
  const handSkin = new Float32Array(n), { rgba } = base;
  const ycc = i => { const r = rgba[i * 4], g = rgba[i * 4 + 1], bl = rgba[i * 4 + 2]; return [.299 * r + .587 * g + .114 * bl, 128 - .168736 * r - .331264 * g + .5 * bl, 128 + .5 * r - .418688 * g - .081312 * bl]; };
  for (const hand of marks?.hands ?? []) {
    const samples = [];
    const joints = [[0, 1], [0, 5], [0, 17], [5, 9], [9, 13], [1, 2], [5, 6], [9, 10], [13, 14], [17, 18], [6, 7], [10, 11]];
    for (const [a, z] of joints) {
      const x = Math.round((hand[a].x + hand[z].x) / 2), y = Math.round((hand[a].y + hand[z].y) / 2);
      if (x > 0 && y > 0 && x < gw - 1 && y < gh - 1) samples.push(ycc(y * gw + x));
    }
    if (samples.length < 5) continue;
    const med = k => samples.map(s => s[k]).sort((p, q) => p - q)[samples.length >> 1];
    const [my, mcb, mcr] = [med(0), med(1), med(2)], palm = Math.hypot(hand[5].x - hand[17].x, hand[5].y - hand[17].y) || 20;
    const xs = hand.map(p => p.x), ys = hand.map(p => p.y), grow = palm * .7;
    for (let y = Math.max(1, Math.floor(Math.min(...ys) - grow)); y < Math.min(gh - 1, Math.max(...ys) + grow); y++)
      for (let x = Math.max(1, Math.floor(Math.min(...xs) - grow)); x < Math.min(gw - 1, Math.max(...xs) + grow); x++) {
        const i = y * gw + x; if (handW[i] < .05) continue;
        const [yy, cb, cr] = ycc(i), chroma = Math.hypot(cb - mcb, cr - mcr);
        handSkin[i] = Math.max(handSkin[i], clamp(1 - (chroma - 7) / 9) * clamp(1 - (Math.abs(yy - my) - 70) / 40));
      }
  }
  const skinMask = blur(handSkin, gw, gh, 1);
  // The skin mask is soft, so its edge is a wide band; used as a line it floated a few pixels off the fingers.
  // Instead it only tells where the hand's true boundary is, and the one-pixel edge there is promoted to a full outline.
  if (marks?.hands?.length) {
    // Hands get their own contrast scale: a light hand on a white wall has faint edges next to a face full of dark hair.
    const handEdges = []; for (let i = 0; i < n; i += 2) if (edgeMag[i] && handW[i] > .3) handEdges.push(edgeMag[i]);
    const nhEdge = Math.max(30, Math.min(ne, highEnd(handEdges) * .7));
    for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
      const i = y * gw + x; if (handW[i] < .2) continue;
      const sx = (skinMask[i + 1] - skinMask[i - 1]) / 2, sy = (skinMask[i + gw] - skinMask[i - gw]) / 2, sm = Math.hypot(sx, sy);
      const boundary = clamp(sm * 6);
      if (edgeMag[i]) line[i] = Math.max(line[i], clamp(edgeMag[i] / nhEdge * (1 + boundary * 1.5)) * lerp(.8, 1, boundary));
      // Where brightness barely changes (skin against white), the colour boundary itself is the outline — thinned to one pixel.
      if (sm > .08) {
        const o = Math.round(sy / sm) * gw + Math.round(sx / sm), m = q => Math.hypot(skinMask[q + 1] - skinMask[q - 1], skinMask[q + gw] - skinMask[q - gw]) / 2;
        if (sm >= m(i + o) && sm >= m(i - o)) line[i] = Math.max(line[i], clamp(sm * 5) * .8 * clamp(handW[i] * 2));
      }
    }
  }

  const jxx = new Float32Array(n), jyy = new Float32Array(n), jxy = new Float32Array(n);
  for (let i = 0; i < n; i++) { jxx[i] = gx[i] * gx[i]; jyy[i] = gy[i] * gy[i]; jxy[i] = gx[i] * gy[i]; }
  const silhouette = new Float32Array(n);
  // Silhouette: the edge of a mask becomes a line too, so the figure always has a clear outer contour even where it
  // melts into the background. Its direction is fed into the stroke-direction field.
  const addMaskEdge = (p, weight, keepAt) => {
    for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
      const i = y * gw + x, k = keepAt(i); if (k <= 0) continue;
      const mx = (p[i + 1] - p[i - 1]) / 2, my = (p[i + gw] - p[i - gw]) / 2;
      const sil = clamp(1 - Math.abs(p[i] - .5) * 4) * clamp(Math.hypot(mx, my) * 12) * k;
      if (sil <= 0) continue;
      line[i] = Math.max(line[i], sil * weight); silhouette[i] = Math.max(silhouette[i], sil);
      jxx[i] += (mx * 3000) ** 2 * sil; jyy[i] += (my * 3000) ** 2 * sil; jxy[i] += mx * my * 9e6 * sil;
    }
  };
  if (base.person) addMaskEdge(base.person, .7, i => 1 - clamp(handW[i] * 2)); // the coarse person edge stays out of the hands
  // Direction field: widely smoothed for calm long contours, barely smoothed on faces and hands so it bends with each finger.
  const smooth = r => [blur(jxx, gw, gh, r), blur(jyy, gw, gh, r), blur(jxy, gw, gh, r)];
  const [sxx, syy, sxy] = smooth(3), [fxx, fyy, fxy] = smooth(1), ang = new Float32Array(n), coh = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const energy = sxx[i] + syy[i], t = clamp(detail[i] * 1.5);
    ang[i] = .5 * Math.atan2(2 * lerp(sxy[i], fxy[i], t), lerp(sxx[i], fxx[i], t) - lerp(syy[i], fyy[i], t)) + Math.PI / 2;
    coh[i] = Math.sqrt((sxx[i] - syy[i]) ** 2 + 4 * sxy[i] ** 2) / (energy + 1e-3) * clamp((energy - 50) / 400);
  }

  // Shadow field: how much darker a spot is than its own surroundings (averaged over the person only).
  // Uniformly dark hair or clothing scores nothing — a croquis leaves it as paper — while folds, cast shadows
  // and the shaded side of the face score high. Max-RGB keeps red lips and flushed cheeks from reading as shadow.
  const weighted = new Float32Array(n);
  for (let i = 0; i < n; i++) weighted[i] = softValue[i] * subject[i];
  const numS = blur(weighted, gw, gh, 10), denS = blur(subject, gw, gh, 10), numL = blur(weighted, gw, gh, 22), denL = blur(subject, gw, gh, 22);
  // Plus a gentle absolute term for genuinely dark hair and clothing (never on skin), so they get a light
  // parallel wash like the reference croquis — capped low in makeShading, so it can never turn into a fill.
  const personValues = []; for (let i = 0; i < n; i += 3) if (subject[i] > .5) personValues.push(softValue[i]);
  personValues.sort((a, z) => a - z);
  const vLo = personValues[Math.floor(personValues.length * .03)] ?? 0, vHi = personValues[Math.floor(personValues.length * .97)] ?? 255;
  // Hair: around the head, darker than average and not skin-coloured. The face detector's ellipse reaches up into
  // the fringe, so position alone can't separate hair from forehead — colour and darkness do.
  const hairRaw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (subject[i] < .5 || Math.hypot((i % gw - face.x) / (face.rx * 1.8), (((i / gw) | 0) - face.y) / (face.ry * 1.7)) > 1) continue;
    const r = rgba[i * 4], g = rgba[i * 4 + 1], bl = rgba[i * 4 + 2];
    const cb = 128 - .168736 * r - .331264 * g + .5 * bl, cr = 128 + .5 * r - .418688 * g - .081312 * bl;
    const skin = cb >= 77 && cb <= 127 && cr >= 137 && cr <= 175 && r > g;
    const dark = (vHi - softValue[i]) / Math.max(1, vHi - vLo);
    hairRaw[i] = !skin && dark > .45 ? 1 : 0;
  }
  const hair = blur(hairRaw, gw, gh, 2);
  const shade = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (subject[i] < .4) continue;
    const local = lerp(numL[i] / Math.max(.05, denL[i]), numS[i] / Math.max(.05, denS[i]), faceW[i]);
    const relative = clamp((local - softValue[i]) / (faceW[i] > .5 ? 32 : 40));
    const absolute = clamp(((vHi - softValue[i]) / Math.max(1, vHi - vLo) - .55) / .4) * .6 * Math.max(1 - faceW[i], hair[i]);
    shade[i] = Math.max(relative, absolute) * (1 - far[i] * .5);
  }

  // Outside mask: everything beyond the silhouette (grown by a few pixels). Graphite landing there is clipped
  // away as it is drawn. The mask is binary, so clipping every frame never eats into the drawing itself.
  const outside = document.createElement('canvas'); outside.width = W; outside.height = H;
  const octx = outside.getContext('2d'), mask = octx.createImageData(W, H), grown = base.person ? blur(subject, gw, gh, 3) : null;
  for (let p = 3; p < mask.data.length; p += 4) mask.data[p] = 255;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) mask.data[((y + b.y) * W + x + b.x) * 4 + 3] = grown && grown[y * gw + x] < .25 ? 255 : 0;
  octx.putImageData(mask, 0, 0);

  const A = { ...base, line, ang, coh, shade, silhouette, hair, faceW, handW, detail, zone, far, subject, head, eyeW, outside, face, skinHi };
  A.contours = traceContours(A);
  A.fills = [...makeFills(A), ...makeFeatureMarks(A)];
  A.ai = base.lineMap ? traceLineArt(A) : null; // re-traced when the face is corrected, without re-running the model
  return A;
}
async function ensureLineArt(A) {
  if (A.ai) return true;
  try { A.lineMap = await makeLineMap(A); A.ai = traceLineArt(A); return true; }
  catch (error) { console.warn('AI line art unavailable:', error); A.aiFailed = true; return false; }
}
// Vision models (MediaPipe, loaded once from the CDN): face detection frames the portrait, segmentation separates the person.
const MEDIAPIPE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const PERSON_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
const FACE_MESH_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
let visionPromise = null, detectorPromise = null, segmenterPromise = null, landmarkerPromise = null, detectorReady = false;
function loadVision() {
  visionPromise ??= (async () => {
    const vision = await import(`${MEDIAPIPE}/vision_bundle.mjs`);
    return { vision, files:await vision.FilesetResolver.forVisionTasks(`${MEDIAPIPE}/wasm`) };
  })().catch(error => { visionPromise = null; throw error; });
  return visionPromise;
}
function loadFaceDetector() {
  detectorPromise ??= (async () => {
    const { vision, files } = await loadVision();
    const detector = await vision.FaceDetector.createFromOptions(files, { baseOptions:{ modelAssetPath:FACE_MODEL, delegate:'CPU' }, runningMode:'IMAGE', minDetectionConfidence:.45 });
    detectorReady = true; return detector;
  })().catch(error => { detectorPromise = null; throw error; });
  return detectorPromise;
}
function loadSegmenter() {
  segmenterPromise ??= (async () => {
    const { vision, files } = await loadVision();
    return vision.ImageSegmenter.createFromOptions(files, { baseOptions:{ modelAssetPath:PERSON_MODEL, delegate:'CPU' }, runningMode:'IMAGE', outputConfidenceMasks:true, outputCategoryMask:false });
  })().catch(error => { segmenterPromise = null; throw error; });
  return segmenterPromise;
}
function loadLandmarkers() {
  // Face mesh (478 points: brows, lids, irises, nose, lips) and hand landmarks (21 joints per hand).
  landmarkerPromise ??= (async () => {
    const { vision, files } = await loadVision(), F = vision.FaceLandmarker;
    const [faceMesh, hands] = await Promise.all([
      F.createFromOptions(files, { baseOptions:{ modelAssetPath:FACE_MESH_MODEL, delegate:'CPU' }, runningMode:'IMAGE', numFaces:1 }),
      vision.HandLandmarker.createFromOptions(files, { baseOptions:{ modelAssetPath:HAND_MODEL, delegate:'CPU' }, runningMode:'IMAGE', numHands:2, minHandDetectionConfidence:.4 }),
    ]);
    const ids = connections => [...new Set(connections.flatMap(c => [c.start, c.end]))];
    const parts = {
      browL:ids(F.FACE_LANDMARKS_LEFT_EYEBROW), browR:ids(F.FACE_LANDMARKS_RIGHT_EYEBROW),
      eyeL:ids(F.FACE_LANDMARKS_LEFT_EYE), eyeR:ids(F.FACE_LANDMARKS_RIGHT_EYE),
      irisL:ids(F.FACE_LANDMARKS_LEFT_IRIS), irisR:ids(F.FACE_LANDMARKS_RIGHT_IRIS),
      lips:ids(F.FACE_LANDMARKS_LIPS), oval:F.FACE_LANDMARKS_FACE_OVAL,
    };
    return { faceMesh, hands, parts, bones:vision.HandLandmarker.HAND_CONNECTIONS };
  })().catch(error => { landmarkerPromise = null; throw error; });
  return landmarkerPromise;
}
async function detectLandmarks(base) {
  try {
    const L = await withTimeout(loadLandmarkers(), 40000), px = p => ({ x:p.x * base.gw, y:p.y * base.gh });
    const mesh = L.faceMesh.detect(base.work).faceLandmarks?.[0]?.map(px) ?? null;
    const hands = (L.hands.detect(base.work).landmarks ?? []).map(hand => hand.map(px));
    return { mesh, hands, parts:L.parts, bones:L.bones };
  } catch (error) {
    console.warn('Face/hand landmarks unavailable:', error);
    return null;
  }
}
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, fail) => setTimeout(() => fail(new Error('timeout')), ms))]);
async function segmentPerson(base) {
  // Person mask (0..1 per pixel): the subject gets drawn and shaded, the background stays bare paper.
  try {
    const segmenter = await withTimeout(loadSegmenter(), 25000), result = segmenter.segment(base.work);
    const masks = result.confidenceMasks ?? [], mask = masks[masks.length - 1];
    if (!mask) { result.close(); return null; }
    const data = mask.getAsFloat32Array(), mw = mask.width, mh = mask.height, out = new Float32Array(base.n);
    for (let y = 0; y < base.gh; y++) for (let x = 0; x < base.gw; x++) out[y * base.gw + x] = data[Math.min(mh - 1, (y * mh / base.gh) | 0) * mw + Math.min(mw - 1, (x * mw / base.gw) | 0)];
    result.close();
    return blur(out, base.gw, base.gh, 2);
  } catch (error) {
    console.warn('Person segmentation unavailable:', error);
    return null;
  }
}
// ───────────────────────── AI line art ─────────────────────────
// "Informative Drawings" (Caroline Chan, MIT) turns a photo into an artist-style line drawing; it runs in the browser
// through ONNX Runtime. DeepLab v3 finds people, animals and objects, so bare backgrounds (walls, text, logos) stay paper.
const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
const LINEART_MODEL = 'https://huggingface.co/rocca/informative-drawings-line-art-onnx/resolve/main/model.onnx';
const OBJECT_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite';
let lineArtPromise = null, objectPromise = null;
const REVEAL_RADIUS = 3; // how far either side of the pencil's path the AI graphite is uncovered (canvas px)
const loadScript = src => new Promise((resolve, reject) => {
  const tag = document.createElement('script'); tag.src = src; tag.onload = resolve; tag.onerror = () => reject(new Error(`cannot load ${src}`)); document.head.appendChild(tag);
});
function loadLineArt() {
  lineArtPromise ??= (async () => {
    if (!window.ort) await loadScript(`${ORT}ort.min.js`);
    ort.env.wasm.wasmPaths = ORT;
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
    return ort.InferenceSession.create(LINEART_MODEL, { executionProviders:['wasm'] });
  })().catch(error => { lineArtPromise = null; throw error; });
  return lineArtPromise;
}
function loadObjectSegmenter() {
  objectPromise ??= (async () => {
    const { vision, files } = await loadVision();
    return vision.ImageSegmenter.createFromOptions(files, { baseOptions:{ modelAssetPath:OBJECT_MODEL, delegate:'CPU' }, runningMode:'IMAGE', outputConfidenceMasks:false, outputCategoryMask:true });
  })().catch(error => { objectPromise = null; throw error; });
  return objectPromise;
}
async function segmentObjects(base) {
  // Everything DeepLab labels as something other than background: people, dogs, cats, chairs, sofas, plants, bottles…
  try {
    const segmenter = await withTimeout(loadObjectSegmenter(), 25000), result = segmenter.segment(base.work), mask = result.categoryMask;
    if (!mask) { result.close(); return null; }
    const data = mask.getAsUint8Array(), mw = mask.width, mh = mask.height, out = new Float32Array(base.n);
    for (let y = 0; y < base.gh; y++) for (let x = 0; x < base.gw; x++) out[y * base.gw + x] = data[Math.min(mh - 1, (y * mh / base.gh) | 0) * mw + Math.min(mw - 1, (x * mw / base.gw) | 0)] ? 1 : 0;
    result.close();
    return blur(out, base.gw, base.gh, 2);
  } catch (error) {
    console.warn('Object segmentation unavailable:', error);
    return null;
  }
}
async function makeLineMap(base) {
  // AI line drawing of exactly the analysed framing, returned as graphite darkness (0..1) on the analysis grid.
  // Phones with little memory get a lighter pass; everything with 6 GB or more (e.g. a Galaxy S23) keeps full detail.
  const session = await withTimeout(loadLineArt(), 120000), img = base.image, cr = base.crop, long = (navigator.deviceMemory ?? 8) <= 4 ? 512 : 768;
  const s = long / Math.max(cr.w, cr.h), w = Math.max(8, Math.round(cr.w * s / 8) * 8), h = Math.max(8, Math.round(cr.h * s / 8) * 8);
  const input = document.createElement('canvas'); input.width = w; input.height = h;
  const ictx = input.getContext('2d', { willReadFrequently:true }); ictx.drawImage(img, cr.x, cr.y, cr.w, cr.h, 0, 0, w, h);
  const px = ictx.getImageData(0, 0, w, h).data, tensor = new Float32Array(3 * w * h);
  for (let i = 0; i < w * h; i++) { tensor[i] = px[i * 4] / 255; tensor[w * h + i] = px[i * 4 + 1] / 255; tensor[2 * w * h + i] = px[i * 4 + 2] / 255; }
  const output = (await session.run({ [session.inputNames[0]]:new ort.Tensor('float32', tensor, [1, 3, h, w]) }))[session.outputNames[0]];
  const [, , oh, ow] = output.dims, drawn = document.createElement('canvas'); drawn.width = ow; drawn.height = oh;
  const dctx = drawn.getContext('2d'), image = dctx.createImageData(ow, oh);
  for (let i = 0; i < ow * oh; i++) { const v = 255 * clamp(output.data[i]); image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = v; image.data[i * 4 + 3] = 255; }
  dctx.putImageData(image, 0, 0);
  const grid = document.createElement('canvas'); grid.width = base.gw; grid.height = base.gh;
  const gctx = grid.getContext('2d', { willReadFrequently:true }); gctx.imageSmoothingQuality = 'high'; gctx.drawImage(drawn, 0, 0, base.gw, base.gh);
  const g = gctx.getImageData(0, 0, base.gw, base.gh).data, map = new Float32Array(base.n);
  for (let i = 0; i < base.n; i++) map[i] = 1 - g[i * 4] / 255;
  return map;
}
function thinLines(on, w, h) { // Zhang–Suen thinning, in place: every line becomes a one-pixel centreline
  let changed = true;
  const idx = [];
  for (let i = 0; i < on.length; i++) if (on[i]) idx.push(i);
  let active = idx;
  while (changed) {
    changed = false;
    for (const step of [0, 1]) {
      const del = [];
      for (const i of active) {
        if (!on[i]) continue;
        const x = i % w, y = (i / w) | 0; if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) { on[i] = 0; continue; }
        const p = [on[i - w], on[i - w + 1], on[i + 1], on[i + w + 1], on[i + w], on[i + w - 1], on[i - 1], on[i - w - 1]];
        const count = p[0] + p[1] + p[2] + p[3] + p[4] + p[5] + p[6] + p[7]; if (count < 2 || count > 6) continue;
        let transitions = 0; for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) transitions++;
        if (transitions !== 1) continue;
        if (step === 0 ? (p[0] && p[2] && p[4]) || (p[2] && p[4] && p[6]) : (p[0] && p[2] && p[6]) || (p[0] && p[4] && p[6])) continue;
        del.push(i);
      }
      for (const i of del) on[i] = 0;
      if (del.length) changed = true;
    }
    active = active.filter(i => on[i]);
  }
  return on;
}
function traceSkeleton(sk, w) {
  // Walk the centreline graph into polylines: branches run between ends and junctions, loops are walked last.
  // Diagonal steps are ignored when a straight neighbour already connects the same pixels (no false junctions).
  const D = [1, w + 1, w, w - 1, -1, -w - 1, -w, -w + 1];
  const links = i => { const out = []; for (let k = 0; k < 8; k++) { if (!sk[i + D[k]]) continue; if (k & 1 && (sk[i + D[k - 1]] || sk[i + D[(k + 1) % 8]])) continue; out.push(k); } return out; };
  const used = new Uint8Array(sk.length), paths = [];
  const walk = (start, k) => {
    const pts = [start]; let cur = start;
    for (;;) {
      const next = cur + D[k]; used[cur] |= 1 << k; used[next] |= 1 << ((k + 4) % 8); pts.push(next); cur = next;
      const l = links(cur); if (l.length !== 2) break;
      const free = l.find(q => !(used[cur] & (1 << q))); if (free === undefined) break; k = free;
    }
    return pts;
  };
  const pixels = []; for (let i = 0; i < sk.length; i++) if (sk[i]) pixels.push(i);
  for (const pass of [0, 1]) for (const i of pixels) {
    const l = links(i); if (pass === 0 && l.length === 2) continue;
    for (const k of l) if (!(used[i] & (1 << k))) paths.push(walk(i, k));
  }
  return paths.map(p => p.map(i => ({ x:i % w, y:(i / w) | 0 })));
}
function joinPaths(paths, maxGap = 2.9) {
  // Rejoin centreline pieces that continue each other through a junction or a one-pixel break.
  const end = (p, atStart) => { const n = p.length, k = Math.min(4, n - 1), a = atStart ? p[0] : p[n - 1], b = atStart ? p[k] : p[n - 1 - k], l = Math.hypot(a.x - b.x, a.y - b.y) || 1; return { x:a.x, y:a.y, dx:(a.x - b.x) / l, dy:(a.y - b.y) / l }; };
  for (let pass = 0; pass < 6; pass++) {
    const buckets = new Map(), key = (x, y) => `${Math.floor(x / 4)},${Math.floor(y / 4)}`;
    paths.forEach((p, id) => { if (!p) return; for (const s of [true, false]) { const e = end(p, s), kk = key(e.x, e.y); if (!buckets.has(kk)) buckets.set(kk, []); buckets.get(kk).push({ id, s, e }); } });
    let merged = 0; const taken = new Set();
    paths.forEach((p, id) => {
      if (!p || taken.has(id)) return;
      for (const s of [false, true]) {
        const e = end(p, s); let best = null, bestScore = .3;
        for (let bx = -1; bx <= 1; bx++) for (let by = -1; by <= 1; by++) for (const c of buckets.get(`${Math.floor(e.x / 4) + bx},${Math.floor(e.y / 4) + by}`) ?? []) {
          if (c.id === id || taken.has(c.id) || !paths[c.id]) continue;
          const gap = Math.hypot(c.e.x - e.x, c.e.y - e.y); if (gap > maxGap) continue;
          const score = (e.dx * -c.e.dx + e.dy * -c.e.dy) - gap * .08; // leaving one way, arriving from the opposite side
          if (score > bestScore) { bestScore = score; best = c; }
        }
        if (!best) continue;
        const other = paths[best.id], a = s ? p.slice().reverse() : p, b = best.s ? other : other.slice().reverse();
        paths[id] = a.concat(b); paths[best.id] = null; taken.add(id); taken.add(best.id); merged++; return;
      }
    });
    paths = paths.filter(Boolean);
    if (!merged) break;
  }
  return paths;
}
function traceLineArt(A) {
  const { gw, gh, n, b, lineMap, person, objects, faceW, handW, detail, zone, eyeW, head, b1, b4 } = A;
  // What to draw: people, animals and objects. Bare backgrounds stay paper. The face only vouches for its own core —
  // its soft falloff reaches past the jaw, and let background lettering beside the cheek slip in.
  const keepRaw = new Float32Array(n);
  for (let i = 0; i < n; i++) keepRaw[i] = person || objects ? Math.max(person?.[i] ?? 0, objects?.[i] ?? 0, clamp((faceW[i] - .9) * 10), clamp(handW[i] * 1.5)) : 1;
  const keep = blur(keepRaw, gw, gh, 4);
  // The model draws most lines mid-grey, so thresholds are relative to its own darkest lines in this photo.
  const inkSample = []; for (let i = 0; i < n; i += 2) if (keep[i] > .3 && lineMap[i] > .05) inkSample.push(lineMap[i]);
  inkSample.sort((a, z) => a - z);
  const top = Math.max(.25, inkSample[Math.floor(inkSample.length * .995)] ?? .6), ink = new Float32Array(n);
  for (let i = 0; i < n; i++) ink[i] = clamp(lineMap[i] / top);
  // Out-of-focus edges on the face (a blurred hand or strand in front of the cheek) are not part of the portrait.
  // A crisp edge is much steeper at a fine scale than a coarse one; a defocused edge is equally gentle at both.
  const grad = f => { const m = new Float32Array(n); for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) { const i = y * gw + x; m[i] = Math.hypot(f[i + 1] - f[i - 1], f[i + gw] - f[i - gw]); } return m; };
  const fineG = blur(grad(b1), gw, gh, 2), coarseG = blur(grad(b4), gw, gh, 2), protect = Z.EYE | Z.IRIS | Z.BROW | Z.LIPS | Z.NOSE | Z.JAW | Z.HAND;
  // Judged against this photo's own face lines: a film still or a softly lit photo is gentle everywhere, so the bar drops
  // with its typical line sharpness and only lines clearly softer than the rest count as out of focus. Crisp photos
  // (typical sharpness 1.6 and up) keep the original bar.
  const sharpness = []; for (let i = 0; i < n; i += 2) if (faceW[i] >= .5 && ink[i] > .28) sharpness.push(fineG[i] / (coarseG[i] + 1.5));
  sharpness.sort((a, z) => a - z);
  const sharpScale = clamp((sharpness[sharpness.length >> 1] ?? 1.6) / 1.6, .55, 1), soft0 = 1.2 * sharpScale, softSpan = .35 * sharpScale;
  // The figure's own outline against the background — a profile's nose, lips and chin — is never a stray edge.
  const outline = i => !!person && person[i] > .12 && person[i] < .88;
  let softened = 0;
  for (let i = 0; i < n; i++) {
    if (faceW[i] < .5 || zone[i] & protect || ink[i] < .1 || outline(i)) continue;
    const sharp = fineG[i] / (coarseG[i] + 1.5), keepInk = clamp((sharp - soft0) / softSpan);
    if (keepInk < 1) { ink[i] *= keepInk; softened++; }
  }
  A.softened = softened;
  A.ink = ink;
  // Busy textures (sequins, knit, prints) away from the head and hands: lines crowd together there, so only firm
  // ones count. Hair is exempt — its crowded strands are exactly what a portrait needs.
  const busyRaw = new Float32Array(n); for (let i = 0; i < n; i++) busyRaw[i] = ink[i] > .35 ? 1 : 0;
  const busyD = blur(busyRaw, gw, gh, 5), texture = i => !head[i] && detail[i] < .3 && busyD[i] > .24;
  // Line mask with hysteresis: firm strokes seed it, fainter pixels that touch them extend it.
  const on = new Uint8Array(n), stack = [];
  for (let i = 0; i < n; i++) if (keep[i] > .3 && ink[i] > (texture(i) ? .8 : .28)) { on[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop(), x = i % gw;
    for (const d of [-gw - 1, -gw, -gw + 1, -1, 1, gw - 1, gw, gw + 1]) {
      const j = i + d; if (j < 0 || j >= n || on[j] || Math.abs((j % gw) - x) > 1 || keep[j] <= .3 || ink[j] <= (texture(j) ? .5 : .12)) continue;
      on[j] = 1; stack.push(j);
    }
  }
  // Busy textures (sparkles, knit, prints) turn into crowds of tiny marks: there, only sizeable pieces survive.
  const onF = new Float32Array(n); for (let i = 0; i < n; i++) onF[i] = on[i];
  const density = blur(onF, gw, gh, 6), label = new Int32Array(n); let id = 0;
  for (let i = 0; i < n; i++) if (texture(i)) density[i] = Math.max(density[i], .3); // pieces inside a texture must be substantial
  for (let start = 0; start < n; start++) {
    if (!on[start] || label[start]) continue;
    id++; const pix = [start]; label[start] = id; let x0 = gw, x1 = 0, y0 = gh, y1 = 0, dens = 0, fine = 0;
    for (let h = 0; h < pix.length; h++) {
      const i = pix[h], x = i % gw, y = (i / gw) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); dens += density[i]; fine += detail[i];
      for (const d of [-gw - 1, -gw, -gw + 1, -1, 1, gw - 1, gw, gw + 1]) { const j = i + d; if (j >= 0 && j < n && on[j] && !label[j] && Math.abs((j % gw) - x) <= 1) { label[j] = id; pix.push(j); } }
    }
    const span = Math.hypot(x1 - x0, y1 - y0), minSpan = fine / pix.length > .5 ? 3 : dens / pix.length > .22 ? 30 : 7;
    if (span < minSpan) for (const i of pix) on[i] = 0;
  }
  thinLines(on, gw, gh);
  const paths = joinPaths(traceSkeleton(on, gw));
  const contours = [];
  for (const raw of paths) {
    const pts = chaikin(simplify(raw, .7)), m = raw.length;
    let len = 0; for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
    const mid = raw[m >> 1], fineMid = detail[mid.y * gw + mid.x] > .5;
    if (len < (fineMid ? 4 : 9)) continue;
    const zones = new Float32Array(8); let dark = 0, faceSum = 0, handSum = 0, headSum = 0, eyeSum = 0;
    for (const p of raw) {
      const i = p.y * gw + p.x; let v = ink[i];
      for (const d of [-1, 1, -gw, gw]) v = Math.max(v, ink[i + d] ?? 0); // the darkest core of the drawn line
      dark += v; faceSum += faceW[i]; handSum += handW[i]; headSum += head[i]; eyeSum += eyeW[i];
      for (let k = 0; k < 8; k++) if (zone[i] & (1 << k)) zones[k]++;
    }
    const hand = handSum / m;
    contours.push({ raw:pts, len, strength:clamp((dark / m - .2) / .7), inkMap:ink, inkW:gw, face:faceSum / m, hand, head:headSum / m > .5 && hand < .5, eye:eyeSum / m,
      zones:Array.from(zones, c => c / m), fine:fineMid, ai:true, meshed:!!A.marks?.mesh });
  }
  // The strokes are the pencil's path; the graphite they reveal is the AI drawing itself (see revealSegment).
  // Any visible line the strokes don't pass near yet gets a short stroke of its own, so nothing pops in at the end.
  const R = REVEAL_RADIUS, covered = new Uint8Array(n);
  const stamp = pts => { for (const p of pts) { const px = Math.round(p.x), py = Math.round(p.y); for (let v = -R; v <= R; v++) for (let u = -R; u <= R; u++) if (u * u + v * v <= R * R) { const q = (py + v) * gw + px + u; if (q >= 0 && q < n) covered[q] = 1; } } };
  for (const c of contours) stamp(c.raw);
  const visible = i => keep[i] > .3 && ink[i] > .18 && !texture(i);
  const seen = new Uint8Array(n);
  for (let start = 0; start < n; start++) {
    if (seen[start] || covered[start] || !visible(start)) continue;
    const pix = [start]; seen[start] = 1;
    for (let h = 0; h < pix.length; h++) {
      const i = pix[h], x = i % gw;
      for (const d of [-gw - 1, -gw, -gw + 1, -1, 1, gw - 1, gw, gw + 1]) { const j = i + d; if (j >= 0 && j < n && !seen[j] && !covered[j] && Math.abs((j % gw) - x) <= 1 && visible(j)) { seen[j] = 1; pix.push(j); } }
    }
    if (pix.length < 5) continue;
    let mx = 0, my = 0; for (const i of pix) { mx += i % gw; my += (i / gw) | 0; } mx /= pix.length; my /= pix.length;
    let cxx = 0, cyy = 0, cxy = 0; for (const i of pix) { const dx = i % gw - mx, dy = ((i / gw) | 0) - my; cxx += dx * dx; cyy += dy * dy; cxy += dx * dy; }
    const th = .5 * Math.atan2(2 * cxy, cxx - cyy), ux = Math.cos(th), uy = Math.sin(th);
    const along = pix.map(i => ({ x:i % gw, y:(i / gw) | 0 })).sort((p, q) => (p.x * ux + p.y * uy) - (q.x * ux + q.y * uy));
    const raw = along.filter((_, k) => k % 3 === 0 || k === along.length - 1);
    if (raw.length < 2) continue;
    stamp(raw);
    const i0 = Math.round(my) * gw + Math.round(mx), m = raw.length;
    contours.push({ raw, len:Math.hypot(raw[m - 1].x - raw[0].x, raw[m - 1].y - raw[0].y) + 2, strength:.4, face:faceW[i0], hand:handW[i0], head:!!head[i0] && handW[i0] < .5,
      eye:eyeW[i0], zones:new Array(8).fill(0), fine:detail[i0] > .5, ai:true, meshed:!!A.marks?.mesh });
  }
  // The graphite layer: the AI line drawing in pencil grey with paper tooth, limited to what the strokes cover.
  const layer = document.createElement('canvas'); layer.width = W; layer.height = H;
  const lctx = layer.getContext('2d'), data = lctx.createImageData(W, H);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x; if (!covered[i] || keep[i] < .2) continue;
    const X = x + b.x, Y = y + b.y, p = (Y * W + X) * 4, grain = tooth.field[(Y % tooth.size) * tooth.size + X % tooth.size];
    data.data[p] = 34; data.data[p + 1] = 32; data.data[p + 2] = 36;
    data.data[p + 3] = 255 * clamp(Math.pow(ink[i], .85) * 1.1 * (.62 + grain * .5));
  }
  lctx.putImageData(data, 0, 0);
  return { contours, layer };
}
function faceFromBox(x, y, w, h, source, eyes = null) {
  // The detector box runs roughly brow-to-chin; widen it upward to include forehead and hairline.
  return { x:x + w / 2, y:y + h * .42, rx:w * .56, ry:h * .62, source, eyes };
}
const shiftFace = (face, next) => ({ ...next, eyes:face.eyes?.map(e => ({ x:e.x + next.x - face.x, y:e.y + next.y - face.y })) ?? null });
async function detectFace(base) {
  const guess = () => { const f = findFace(base.rgba, base.gw, base.gh); return { ...f, rx:Math.min(f.rx, base.gw * .3), ry:Math.min(f.ry, base.gh * .3) }; };
  try {
    const detector = await withTimeout(loadFaceDetector(), 25000);
    // Confidence first: a pet's face can be bigger than the person's, but it scores lower. Among confident faces, prefer the larger.
    const found = detector.detect(base.work).detections.filter(d => d.boundingBox)
      .map(d => ({ box:d.boundingBox, keypoints:d.keypoints ?? [], confidence:d.categories?.[0]?.score ?? 1 }));
    const top = Math.max(0, ...found.map(d => d.confidence));
    const best = found.filter(d => d.confidence >= top - .12)
      .sort((a, z) => z.box.width * z.box.height * z.confidence - a.box.width * a.box.height * a.confidence)[0];
    if (!best) return { ...guess(), source:'none' };
    // BlazeFace keypoints 0 and 1 are the two eyes (normalized to the input image).
    const eyes = best.keypoints.length >= 2 ? best.keypoints.slice(0, 2).map(k => ({ x:k.x * base.gw, y:k.y * base.gh })) : null;
    return faceFromBox(best.box.originX, best.box.originY, best.box.width, best.box.height, 'ai', eyes);
  } catch (error) {
    console.warn('Face detector unavailable:', error);
    return { ...guess(), source:'offline' };
  }
}
function traceContours(A) {
  const { gw, gh, line, ang, faceW, handW, detail, zone, far, subject, head, eyeW, silhouette } = A, owner = new Int32Array(gw * gh), STEP = 2;
  // Hair and fabric texture raise the bar a little, so their long flowing lines survive but not every weave.
  // The silhouette ignores the distance fade: the outer contour of the figure is always drawn.
  // Features and hands lower it (more detail); the nose bridge raises it, since a sketch barely marks it.
  const featureBar = i => zone[i] & (Z.BROW | Z.EYE | Z.IRIS | Z.LIPS | Z.NOSE | Z.HAND) ? .7 : zone[i] & Z.BRIDGE ? 1.4 : 1;
  const bar = i => silhouette[i] > .3 ? .75 : (1 - .3 * detail[i]) * (1 + .7 * far[i]) * (1 - .35 * eyeW[i]) * (detail[i] > .5 ? 1 : 1.1) * featureBar(i);
  const high = i => .34 * bar(i), low = i => .14 * bar(i);
  const seeds = [];
  for (let y = 3; y < gh - 3; y += 2) for (let x = 3; x < gw - 3; x += 2) { const i = y * gw + x; if (subject[i] > .3 && line[i] > high(i)) seeds.push(i); }
  seeds.sort((a, z) => line[z] - line[a]);
  const walk = (x, y, angle, id) => {
    const pts = []; let dx = Math.cos(angle), dy = Math.sin(angle);
    for (let k = 0; k < 110; k++) {
      let nx = x + dx * STEP, ny = y + dy * STEP;
      if (nx < 3 || ny < 3 || nx > gw - 4 || ny > gh - 4) break;
      // Stay on the ridge of the line: nudge sideways toward the stronger response.
      const px = -dy, py = dx, idx = (u, v) => Math.round(v) * gw + Math.round(u);
      let bestM = line[idx(nx, ny)], shift = 0;
      for (const o of [-1, 1]) { const m = line[idx(nx + px * o, ny + py * o)]; if (m > bestM) { bestM = m; shift = o; } }
      nx += px * shift * .7; ny += py * shift * .7;
      const i = idx(nx, ny);
      if (line[i] < low(i) || (owner[i] && owner[i] !== id)) break;
      let tx = Math.cos(ang[i]), ty = Math.sin(ang[i]);
      if (tx * dx + ty * dy < 0) { tx = -tx; ty = -ty; }
      // A sharp corner ends the stroke, like lifting the pencil — but fingers and features bend a lot, so they turn further.
      if (tx * dx + ty * dy < (detail[i] > .5 ? .45 : .8)) break;
      dx = dx * .55 + tx * .45; dy = dy * .55 + ty * .45; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      x = nx; y = ny; pts.push({ x, y });
    }
    return pts;
  };
  const describe = pts => { // per-stroke statistics used for budgeting and styling
    const zones = new Float32Array(8); let sum = 0, faceSum = 0, handSum = 0, subjectSum = 0, headSum = 0, eyeSum = 0, len = 0;
    pts.forEach((p, k) => {
      const i = clamp(Math.round(p.y), 0, gh - 1) * gw + clamp(Math.round(p.x), 0, gw - 1);
      sum += line[i]; faceSum += faceW[i]; handSum += handW[i]; subjectSum += subject[i]; headSum += head[i]; eyeSum += eyeW[i];
      for (let b = 0; b < 8; b++) if (zone[i] & (1 << b)) zones[b]++;
      if (k) len += Math.hypot(p.x - pts[k - 1].x, p.y - pts[k - 1].y);
    });
    const m = pts.length, hand = handSum / m;
    return { raw:pts, len, strength:clamp(sum / m), face:faceSum / m, hand, head:headSum / m > .5 && hand < .5, eye:eyeSum / m,
      zones:Array.from(zones, c => c / m), subject:subjectSum / m, fine:detail[clamp(Math.round(pts[m >> 1].y), 0, gh - 1) * gw + clamp(Math.round(pts[m >> 1].x), 0, gw - 1)] > .5, meshed:!!A.marks?.mesh };
  };
  const claim = (pts, id, radius) => {
    for (const p of pts) {
      const px = Math.round(p.x), py = Math.round(p.y);
      for (let v = -radius; v <= radius; v++) for (let u = -radius; u <= radius; u++) {
        const j = (py + v) * gw + px + u; if (j >= 0 && j < owner.length && !owner[j]) owner[j] = id;
      }
    }
  };
  const strokes = []; let id = 0;
  // Mesh-guided feature lines first: upper lash lines and the lip line follow the face mesh, snapped onto the photo's
  // own darkest ridge, so eyes and mouth keep their exact shape instead of whatever fragments the tracer finds.
  for (const guide of featureGuides(A)) {
    const s = describe(guide.pts); id++; claim(guide.pts, id, 2);
    strokes.push({ ...s, strength:Math.max(s.strength, guide.strength), guide:guide.kind });
  }
  for (const seed of seeds) {
    if (owner[seed]) continue;
    id++;
    const sx = seed % gw, sy = (seed / gw) | 0;
    const pts = walk(sx, sy, ang[seed] + Math.PI, id).reverse().concat([{ x:sx, y:sy }], walk(sx, sy, ang[seed], id));
    const len = (pts.length - 1) * STEP, fine = detail[seed] > .5;
    // Short marks outside the face read as fur; on hands, stubs read as dirt, so they need a little length too.
    if (len < (fine ? (handW[seed] > faceW[seed] ? 10 : 6) : head[seed] ? 16 : 20)) continue;
    claim(pts, id, fine ? 2 : 3);
    const s = describe(pts);
    if (s.subject < .5) continue; // background lines are never drawn
    strokes.push(s);
  }
  return linkFragments(strokes);
}
function linkFragments(strokes) {
  // In faces and hands an outline often pauses at a knuckle or a crease and resumes a few pixels on.
  // Join such fragments end to end, so a finger reads as one continuous pencil line.
  const fine = strokes.filter(s => s.fine && !s.guide), rest = strokes.filter(s => !(s.fine && !s.guide));
  const ends = s => { const p = s.raw, n = p.length, k = Math.min(3, n - 1);
    return { head:p[0], headDir:{ x:p[0].x - p[k].x, y:p[0].y - p[k].y }, tail:p[n - 1], tailDir:{ x:p[n - 1].x - p[n - 1 - k].x, y:p[n - 1].y - p[n - 1 - k].y } }; };
  const unit = v => { const l = Math.hypot(v.x, v.y) || 1; return { x:v.x / l, y:v.y / l }; };
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let a = 0; a < fine.length; a++) for (let b = 0; b < fine.length; b++) {
      if (a === b) continue;
      const A = ends(fine[a]);
      for (const flip of [false, true]) {
        const B = ends(fine[b]), start = flip ? B.tail : B.head, into = unit(flip ? B.tailDir : B.headDir);
        const gap = Math.hypot(start.x - A.tail.x, start.y - A.tail.y); if (gap > 5) continue;
        const out = unit(A.tailDir), bridge = unit({ x:start.x - A.tail.x, y:start.y - A.tail.y });
        // Continue roughly straight on: A leaves one way, B arrives from the opposite side.
        if (out.x * -into.x + out.y * -into.y < .35 || (gap > 1.5 && out.x * bridge.x + out.y * bridge.y < .2)) continue;
        const pts = fine[a].raw.concat(flip ? fine[b].raw.slice().reverse() : fine[b].raw);
        const na = fine[a].raw.length, nb = fine[b].raw.length, w = x => x / (na + nb);
        const zones = fine[a].zones.map((z, k) => z * w(na) + fine[b].zones[k] * w(nb));
        fine[a] = { ...fine[a], raw:pts, len:fine[a].len + fine[b].len + gap, zones,
          strength:fine[a].strength * w(na) + fine[b].strength * w(nb), face:fine[a].face * w(na) + fine[b].face * w(nb),
          hand:fine[a].hand * w(na) + fine[b].hand * w(nb), eye:fine[a].eye * w(na) + fine[b].eye * w(nb) };
        fine.splice(b, 1); merged = true; break outer;
      }
    }
  }
  return rest.concat(fine);
}
function featureGuides(A) {
  const mesh = A.marks?.mesh; if (!mesh) return [];
  const { gw, gh, line, b1, skinHi } = A, guides = [];
  const sample = (f, x, y) => f[clamp(Math.round(y), 0, gh - 1) * gw + clamp(Math.round(x), 0, gw - 1)];
  const snap = ids => { // pull each mesh point up to 2px along its normal onto the strongest line response
    const pts = ids.map(i => ({ ...mesh[i] }));
    return pts.map((p, k) => {
      const a = pts[Math.max(0, k - 1)], z = pts[Math.min(pts.length - 1, k + 1)], l = Math.hypot(z.x - a.x, z.y - a.y) || 1, nx = -(z.y - a.y) / l, ny = (z.x - a.x) / l;
      let best = p, score = -1;
      for (let o = -2; o <= 2; o += .5) { const q = { x:p.x + nx * o, y:p.y + ny * o }, v = sample(line, q.x, q.y) - Math.abs(o) * .03; if (v > score) { score = v; best = q; } }
      return best;
    });
  };
  const densify = pts => { const out = [pts[0]]; for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], z = pts[k]; out.push({ x:(a.x + z.x) / 2, y:(a.y + z.y) / 2 }, z); } return out; };
  const add = (ids, kind) => {
    const pts = densify(snap(ids)), dark = pts.reduce((s, p) => s + clamp((skinHi - sample(b1, p.x, p.y)) / 120), 0) / pts.length;
    if (dark > .12) guides.push({ pts, kind, strength:clamp(.5 + dark) });
  };
  // Upper lids (outer corner → inner corner) carry the lash line; the lip line is where the lips meet.
  add([33, 246, 161, 160, 159, 158, 157, 173, 133], 'lash');
  add([263, 466, 388, 387, 386, 385, 384, 398, 362], 'lash');
  const gapOpen = Math.hypot(mesh[13].x - mesh[14].x, mesh[13].y - mesh[14].y) > Math.hypot(mesh[61].x - mesh[291].x, mesh[61].y - mesh[291].y) * .08;
  add([78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308], 'lip');
  if (gapOpen) add([78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308], 'lip'); // open mouth or a smile: the lower inner lip too
  return guides;
}
function makeShading(A, density, rand) {
  // Croquis shading: a few parallel diagonal strokes laid only into folds and cast shadows (the shadow field),
  // lighter and tighter on the face. Nothing is filled in — dark hair and dark clothes stay line drawings.
  const { gw, gh, shade, detail, handW, zone, head, line, eyeW } = A, out = [], ANGLE = -1.05, BASE = 1.5;
  const thr = lerp(.5, .14, density), dx = Math.cos(ANGLE), dy = Math.sin(ANGLE), nx = -dy, ny = dx;
  const corners = [[0, 0], [gw, 0], [0, gh], [gw, gh]];
  const offs = corners.map(([x, y]) => x * nx + y * ny), alongs = corners.map(([x, y]) => x * dx + y * dy);
  const minA = Math.min(...alongs), maxA = Math.max(...alongs);
  for (let k = Math.floor(Math.min(...offs) / BASE); k <= Math.max(...offs) / BASE; k++) {
    const o = k * BASE + (rand() - .5) * .8; let run = null;
    const emit = () => {
      if (!run || run.s1 - run.s0 < 8) { run = null; return; }
      const fw = run.face / run.n, maxPiece = lerp(44, 24, fw);
      for (let s = run.s0; s < run.s1 - 6;) {
        const piece = Math.min(run.s1 - s, maxPiece * (.55 + rand() * .45)), e = s + piece;
        const j = () => (rand() - .5) * 1.4, bow = (rand() - .5) * 1.6;
        let p0 = { x:dx * (s + j()) + nx * o, y:dy * (s + j()) + ny * o }, p2 = { x:dx * (e + j()) + nx * o, y:dy * (e + j()) + ny * o };
        // Each small patch leans a little differently, the way a hand re-sets its angle between groups of strokes.
        const mx = (p0.x + p2.x) / 2, my = (p0.y + p2.y) / 2, turn = (hash(Math.floor(mx / 40), Math.floor(my / 40), 3) - .5) * .35;
        const rot = p => ({ x:mx + (p.x - mx) * Math.cos(turn) - (p.y - my) * Math.sin(turn), y:my + (p.x - mx) * Math.sin(turn) + (p.y - my) * Math.cos(turn) });
        p0 = rot(p0); p2 = rot(p2);
        const p1 = { x:(p0.x + p2.x) / 2 + nx * bow, y:(p0.y + p2.y) / 2 + ny * bow }, sh = run.shade / run.n;
        const hand = run.hand / run.n;
        out.push({ raw:[p0, p1, p2], len:piece, kind:'hatch', face:fw, hand, head:run.head / run.n > .5 && hand < .5, shade:sh, layer:0, offset:o,
          alpha0:clamp(.24 + (sh - thr) * 1.2, .24, .65) * (fw > .5 ? .75 : 1), width0:fw > .5 ? .9 : 1.15 });
        s = e + 3 + rand() * 4;
      }
      run = null;
    };
    for (let s = minA; s <= maxA; s += 2) {
      const x = Math.round(dx * s + nx * o), y = Math.round(dy * s + ny * o);
      if (x < 2 || y < 2 || x >= gw - 2 || y >= gh - 2) { emit(); continue; }
      const i = y * gw + x, fw = detail[i];
      // Line spacing ~3px on the face and hands, ~4.5px elsewhere. Eyes, brows, lips and the drawn contours stay clean;
      // soft facial shadows (under the nose, lower lip, jaw) get a lower bar so the face gains some modelling.
      const onLine = fw > .5 ? k % 2 === 0 : k % 3 === 0;
      const clean = eyeW[i] < .4 && !(zone[i] & (Z.BROW | Z.EYE | Z.IRIS | Z.LIPS)) && line[i] < .55 && !isHair(A, i);
      // The nose is read almost entirely from its shadows (bridge side, wings, underside), so its bar is lowest.
      const bar = zone[i] & (Z.NOSE | Z.BRIDGE) ? .5 : fw > .5 ? .75 : 1;
      if (onLine && clean && shade[i] > thr * bar + (hash(x >> 3, y >> 3, 9) - .5) * .08) {
        if (!run) run = { s0:s, shade:0, face:0, hand:0, head:0, n:0 };
        run.s1 = s; run.shade += shade[i]; run.face += fw; run.hand += handW[i]; run.head += head[i]; run.n++;
      } else emit();
    }
    emit();
  }
  return out;
}
function hatchPolygon(A, poly, angle, spacing, alpha, width, rand) {
  // Parallel hatching clipped to a polygon (analysis-grid coordinates): the artist's way of shading one plane.
  const out = [], dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx;
  const offs = poly.map(p => p.x * nx + p.y * ny), alongs = poly.map(p => p.x * dx + p.y * dy);
  const minA = Math.min(...alongs) - 2, maxA = Math.max(...alongs) + 2;
  for (let o = Math.min(...offs) + spacing * .5; o < Math.max(...offs); o += spacing * (.85 + rand() * .3)) {
    let start = null, last = null;
    const emit = () => {
      if (start === null || last - start < 3) { start = null; return; }
      const j = () => (rand() - .5) * .8, at = s => ({ x:dx * s + nx * (o + j() * .3), y:dy * s + ny * (o + j() * .3) });
      const p0 = at(start + j()), p2 = at(last + j()), p1 = { x:(p0.x + p2.x) / 2 + nx * (rand() - .5) * .8, y:(p0.y + p2.y) / 2 + ny * (rand() - .5) * .8 };
      out.push({ raw:[p0, p1, p2], len:Math.hypot(p2.x - p0.x, p2.y - p0.y), kind:'hatch', face:1, hand:0, head:true, shade:2, layer:0, offset:o,
        alpha0:alpha * (.85 + rand() * .3), width0:width });
      start = null;
    };
    for (let s = minA; s <= maxA; s += 1) {
      if (insidePolygon(poly, dx * s + nx * o, dy * s + ny * o)) { start ??= s; last = s; } else emit();
    }
    emit();
  }
  return out;
}
function makeNoseShading(A, density, rand) {
  // A line model barely draws a nose: it is read from its planes. Using the face mesh, shade the two side planes
  // of the nose (the darker side firmer, as the photo shows) and the small shadow under its tip.
  const mesh = A.marks?.mesh; if (!mesh) return [];
  const { gw, gh, soft } = A, P = ids => ids.map(i => mesh[i]);
  const left = P([122, 196, 3, 51, 45, 220, 115, 131, 198, 236, 174, 188]), right = P([351, 419, 248, 281, 275, 440, 344, 360, 420, 456, 399, 412]);
  const under = P([98, 2, 327, 164]);
  const meanLum = poly => {
    const xs = poly.map(p => p.x), ys = poly.map(p => p.y); let sum = 0, count = 0;
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(gh - 1, Math.ceil(Math.max(...ys))); y++)
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(gw - 1, Math.ceil(Math.max(...xs))); x++)
        if (insidePolygon(poly, x, y)) { sum += soft[y * gw + x]; count++; }
    return count ? sum / count : 255;
  };
  const noseLen = Math.hypot(mesh[4].x - mesh[6].x, mesh[4].y - mesh[6].y); if (noseLen < 12) return [];
  const bridge = Math.atan2(mesh[4].y - mesh[6].y, mesh[4].x - mesh[6].x), spacing = clamp(noseLen / 18, 1.8, 3.2), gain = .4 + density * .9;
  const lL = meanLum(left), lR = meanLum(right), diff = lL - lR, strong = .42 * gain, soft1 = .22 * gain;
  // Strokes run down the nose and lean outward on each side, following the plane.
  const out = [
    ...hatchPolygon(A, left, bridge + .45, spacing, diff < -6 ? strong : diff > 6 ? soft1 * .7 : soft1 * 1.2, .95, rand),
    ...hatchPolygon(A, right, bridge - .45, spacing, diff > 6 ? strong : diff < -6 ? soft1 * .7 : soft1 * 1.2, .95, rand),
    ...hatchPolygon(A, under, bridge + Math.PI / 2 + .3, spacing * .9, soft1 * 1.4, .95, rand),
  ];
  return out;
}
const isHair = (A, i) => A.hair[i] > .5 && A.eyeW[i] < .2;
function makeHairStrands(A, density, rand) {
  // Hair in a croquis: a handful of long, light strands following the flow, well spaced — never a dense fur fill.
  const { gw, gh, shade, faceW, ang } = A, out = [], occ = new Uint8Array(gw * gh), STEP = 2, thr = lerp(.5, .14, density);
  const seeds = [];
  for (let y = 3; y < gh - 3; y += 5) for (let x = 3; x < gw - 3; x += 5) {
    const sx = clamp(x + (rand() - .5) * 5, 3, gw - 4), sy = clamp(y + (rand() - .5) * 5, 3, gh - 4), i = (sy | 0) * gw + (sx | 0);
    if (isHair(A, i) && shade[i] > thr) seeds.push([sx, sy, shade[i] + rand() * .05]);
  }
  seeds.sort((a, z) => z[2] - a[2]);
  for (const [sx, sy] of seeds) {
    const i0 = (sy | 0) * gw + (sx | 0); if (occ[i0]) continue;
    const walk = sign => {
      const pts = []; let x = sx, y = sy, dx = Math.cos(ang[i0]) * sign, dy = Math.sin(ang[i0]) * sign;
      for (let k = 0; k * STEP < 30; k++) {
        x += dx * STEP; y += dy * STEP;
        if (x < 2 || y < 2 || x >= gw - 2 || y >= gh - 2) break;
        const j = (y | 0) * gw + (x | 0);
        if (occ[j] || A.hair[j] < .3 || shade[j] < thr - .06) break;
        pts.push({ x, y });
        let nx = Math.cos(ang[j]), ny = Math.sin(ang[j]);
        if (nx * dx + ny * dy < 0) { nx = -nx; ny = -ny; }
        if (nx * dx + ny * dy < .85) break;
        dx = dx * .7 + nx * .3; dy = dy * .7 + ny * .3; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      }
      return pts;
    };
    const pts = walk(-1).reverse().concat([{ x:sx, y:sy }], walk(1)), len = (pts.length - 1) * STEP;
    if (len < 24) continue;
    let shadeSum = 0, faceSum = 0;
    for (const p of pts) {
      const px = p.x | 0, py = p.y | 0; shadeSum += shade[py * gw + px]; faceSum += faceW[py * gw + px];
      for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) { const q = (py + v) * gw + px + u; if (q >= 0 && q < occ.length) occ[q] = 1; }
    }
    const sh = shadeSum / pts.length;
    out.push({ raw:pts, len, kind:'hatch', face:faceSum / pts.length, head:true, shade:sh, layer:1, offset:sx * .3 + sy,
      alpha0:clamp(.22 + (sh - thr) * .9, .22, .5), width0:.95 });
  }
  return out;
}
function makeFeatureMarks(A) {
  // Mesh-guided features: eyebrows as short hair strokes along their growth, irises as dense shading that
  // keeps the catch-light — the details a portrait artist spends the most care on.
  const mesh = A.marks?.mesh; if (!mesh) return [];
  const { gw, gh, b1, skinHi } = A, { parts } = A.marks, out = [], rand = random(77), P = ids => ids.map(i => mesh[i]);
  const mark = (a, z, alpha, width) => out.push({ raw:[a, z], len:Math.hypot(z.x - a.x, z.y - a.y), face:1, strength:1, head:true, kind:'fill', alpha0:alpha, width0:width });
  const darkness = (x, y) => { const i = clamp(Math.round(y), 0, gh - 1) * gw + clamp(Math.round(x), 0, gw - 1); return skinHi - b1[i]; };
  const bridge = mesh[168];
  for (const ids of [parts.browL, parts.browR]) {
    const pts = P(ids), hull = convexHull(pts), c = centroid(pts);
    let cxx = 0, cyy = 0, cxy = 0; for (const p of pts) { cxx += (p.x - c.x) ** 2; cyy += (p.y - c.y) ** 2; cxy += (p.x - c.x) * (p.y - c.y); }
    const theta = .5 * Math.atan2(2 * cxy, cxx - cyy); let ux = Math.cos(theta), uy = Math.sin(theta);
    if ((c.x - bridge.x) * ux + (c.y - bridge.y) * uy < 0) { ux = -ux; uy = -uy; } // u runs from the inner end outward
    let vx = -uy, vy = ux; if (vy > 0) { vx = -vx; vy = -vy; } // v points up
    const us = hull.map(p => (p.x - c.x) * ux + (p.y - c.y) * uy), vs = hull.map(p => (p.x - c.x) * vx + (p.y - c.y) * vy);
    const minU = Math.min(...us), maxU = Math.max(...us), minV = Math.min(...vs), maxV = Math.max(...vs), browH = Math.max(3, maxV - minV);
    for (let v = minV; v <= maxV; v += 1.8) for (let u = minU; u <= maxU;) {
      const x = c.x + ux * u + vx * v, y = c.y + uy * u + vy * v, dk = darkness(x, y);
      // Skip where the skin isn't really darker, and where it is just as dark above the brow: that's a fringe covering it.
      const covered = darkness(x + vx * browH * 1.3, y + vy * browH * 1.3) > 35;
      if (!insidePolygon(hull, x, y) || dk < 35 || covered) { u += 1; continue; }
      // Inner hairs stand up, outer hairs lie flat along the brow; the tail thins out.
      const t = (u - minU) / Math.max(1, maxU - minU), lift = lerp(.75, .12, clamp(t * 2)), len = 3.5 + rand() * 3.5;
      const ex = x + (ux * Math.cos(lift) + vx * Math.sin(lift)) * len, ey = y + (uy * Math.cos(lift) + vy * Math.sin(lift)) * len;
      mark({ x, y }, { x:ex, y:ey }, clamp(.28 + dk / 200, .28, .65) * lerp(1, .6, clamp((t - .6) / .4)), .85);
      u += 2.6 + rand() * 2;
    }
  }
  for (const [irisIds, eyeIds] of [[parts.irisL, parts.eyeL], [parts.irisR, parts.eyeR]]) {
    const iris = P(irisIds), c = centroid(iris), r = Math.max(...iris.map(p => Math.hypot(p.x - c.x, p.y - c.y))) * .95, lids = convexHull(P(eyeIds));
    if (r < 1.5) continue;
    let hx = c.x, hy = c.y, hv = -Infinity; // the catch-light: the brightest spot inside the visible iris
    for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) {
      if (Math.hypot(x - c.x, y - c.y) > r || !insidePolygon(lids, x, y)) continue;
      const v = -darkness(x, y); if (v > hv) { hv = v; hx = x; hy = y; }
    }
    const glint = hv + darkness(c.x, c.y) > 40;
    const hatch = (angle, radius, alpha) => {
      const dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx;
      for (let o = -radius; o <= radius; o += 1.1) {
        let start = null, last = null;
        for (let s = -radius - 1; s <= radius + 1; s += .7) {
          const x = c.x + dx * s + nx * o, y = c.y + dy * s + ny * o;
          const ok = Math.hypot(x - c.x, y - c.y) <= radius && insidePolygon(lids, x, y) && !(glint && Math.hypot(x - hx, y - hy) < r * .3);
          if (ok) { start ??= { x, y }; last = { x, y }; }
          else if (start) { if (Math.hypot(last.x - start.x, last.y - start.y) > 1) mark(start, last, alpha, 1); start = null; }
        }
        if (start && Math.hypot(last.x - start.x, last.y - start.y) > 1) mark(start, last, alpha, 1);
      }
    };
    hatch(-.7, r, .45);        // iris
    hatch(.85, r * .5, .5);    // darker pupil
  }
  return out;
}
function makeFills(A) {
  // The darkest small shapes in the face — pupils, nostrils, the line between the lips, brows —
  // are filled with a tight zig-zag scribble along their long axis. They carry most of the likeness.
  const { gw, soft, b1, skinHi, faceW, eyeW, zone, face } = A, out = [], meshed = !!A.marks?.mesh;
  const x0 = Math.max(1, Math.floor(face.x - face.rx)), x1 = Math.min(gw - 2, Math.ceil(face.x + face.rx));
  const y0 = Math.max(1, Math.floor(face.y - face.ry)), y1 = Math.min(A.gh - 2, Math.ceil(face.y + face.ry));
  // Far darker than the skin: pupils, nostrils, lip line. In the eyes a sharper map catches the small iris.
  // With a face mesh, brows and irises are drawn by makeFeatureMarks instead.
  const dark = meshed
    ? i => faceW[i] > .6 && !(zone[i] & (Z.BROW | Z.EYE | Z.IRIS)) && skinHi - soft[i] > 124
    : i => faceW[i] > .6 && (eyeW[i] > .3 ? skinHi - b1[i] > 95 : skinHi - soft[i] > 124);
  const label = new Int32Array(gw * A.gh), maxArea = face.rx * face.ry * .05, maxSpan = face.rx * .6;
  let id = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const start = y * gw + x; if (label[start] || !dark(start)) continue;
    id++; const pix = [start]; label[start] = id;
    for (let h = 0; h < pix.length; h++) {
      const i = pix[h], px = i % gw, py = (i / gw) | 0;
      for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const qx = px + u, qy = py + v; if (qx < x0 || qx > x1 || qy < y0 || qy > y1) continue;
        const q = qy * gw + qx; if (!label[q] && dark(q)) { label[q] = id; pix.push(q); }
      }
    }
    const inEye = eyeW[pix[0]] > .3; // iris and lash line often join into one longer shape — allow it inside the eye
    if (pix.length < 6 || pix.length > maxArea * (inEye ? 1.8 : 1)) continue;
    let mx = 0, my = 0; for (const i of pix) { mx += i % gw; my += (i / gw) | 0; } mx /= pix.length; my /= pix.length;
    let cxx = 0, cyy = 0, cxy = 0; for (const i of pix) { const dx = i % gw - mx, dy = ((i / gw) | 0) - my; cxx += dx * dx; cyy += dy * dy; cxy += dx * dy; }
    const theta = .5 * Math.atan2(2 * cxy, cxx - cyy), ux = Math.cos(theta), uy = Math.sin(theta), vx = -uy, vy = ux;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const i of pix) { const dx = i % gw - mx, dy = ((i / gw) | 0) - my, u = dx * ux + dy * uy, v = dx * vx + dy * vy; minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v); }
    if (maxU - minU > maxSpan * (inEye ? 1.3 : 1)) continue;
    const inside = (u, v) => label[Math.round(my + uy * u + vy * v) * gw + Math.round(mx + ux * u + vx * v)] === id;
    const point = (u, v) => ({ x:mx + ux * u + vx * v, y:my + uy * u + vy * v });
    let pts = [], flip = false, lastEnd = null;
    const flush = () => {
      if (pts.length >= 2) { let len = 0; for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y); if (len > 3) out.push({ raw:pts, len, face:1, strength:1, head:true, kind:'fill' }); }
      pts = []; lastEnd = null;
    };
    for (let v = minV; v <= maxV + .01; v += 1.8) {
      let runStart = null;
      for (let u = minU - 1; u <= maxU + 1.01; u += 1) {
        const hit = inside(u, v);
        if (hit && runStart === null) runStart = u;
        if ((!hit || u > maxU) && runStart !== null) {
          const a = point(runStart, v), z = point(hit ? u : u - 1, v), [p, q] = flip ? [z, a] : [a, z]; flip = !flip;
          if (lastEnd && Math.hypot(p.x - lastEnd.x, p.y - lastEnd.y) > 5) flush();
          pts.push(p, q); lastEnd = q; runStart = null;
        }
      }
    }
    flush();
  }
  return out;
}

// ───────────────────────── planning: what to draw, in which order, at what time ─────────────────────────
function resample(raw, step) {
  const pts = [raw[0]];
  let carry = 0;
  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1], b = raw[i], seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (!seg) continue;
    let d = step - carry;
    while (d <= seg) { const t = d / seg; pts.push({ x:a.x + (b.x - a.x) * t, y:a.y + (b.y - a.y) * t }); d += step; }
    carry = seg - (d - step);
  }
  const last = raw[raw.length - 1]; if (Math.hypot(last.x - pts[pts.length - 1].x, last.y - pts[pts.length - 1].y) > .5) pts.push(last);
  return pts;
}
function chaikin(pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; out.push({ x:a.x * .75 + b.x * .25, y:a.y * .75 + b.y * .25 }, { x:a.x * .25 + b.x * .75, y:a.y * .25 + b.y * .75 }); }
  out.push(pts[pts.length - 1]); return out;
}
function simplify(pts, tol) { // Ramer–Douglas–Peucker: construction lines are straighter than the final contour
  if (pts.length < 3) return pts;
  const a = pts[0], z = pts[pts.length - 1], len = Math.hypot(z.x - a.x, z.y - a.y) || 1;
  if (Math.hypot(z.x - a.x, z.y - a.y) <= tol) {
    // A closed loop (the ㅇ of 영, an iris ring) has no chord to measure from and would collapse to a dot: split it at its far side.
    let far = 0, split = 0;
    for (let i = 1; i < pts.length - 1; i++) { const d = Math.hypot(pts[i].x - a.x, pts[i].y - a.y); if (d > far) { far = d; split = i; } }
    return far > tol ? simplify(pts.slice(0, split + 1), tol).slice(0, -1).concat(simplify(pts.slice(split), tol)) : [a, z];
  }
  let worst = 0, index = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((z.x - a.x) * (a.y - pts[i].y) - (a.x - pts[i].x) * (z.y - a.y)) / len; if (d > worst) { worst = d; index = i; } }
  return worst > tol ? simplify(pts.slice(0, index + 1), tol).slice(0, -1).concat(simplify(pts.slice(index), tol)) : [a, z];
}
function finalizeStroke(s, rand, ox, oy) {
  const pts = resample(chaikin(s.raw), 2).map(p => ({ x:p.x + ox, y:p.y + oy }));
  const n = pts.length; if (n < 2) return null;
  const x = new Float32Array(n), y = new Float32Array(n), pr = new Float32Array(n);
  // Hand tremor: loose on the body, nearly none on faces and hands, where a pixel of drift changes the likeness.
  const wobble = { hatch:.08, fill:.15 }[s.kind] ?? (s.fine ? .15 : .55), freq = 1 + rand() * 2.5, phase = rand() * 6.28;
  let len = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const u = i / (n - 1), off = Math.sin(u * Math.PI * freq + phase) * wobble;
    x[i] = pts[i].x - (b.y - a.y) / l * off; y[i] = pts[i].y + (b.x - a.x) / l * off;
    // Pressure: shading strokes are even with soft ends; contours land softly and flick off.
    const taper = { hatch:Math.min(1, u / .15, (1 - u) / .35), fill:Math.min(1, u / .06, (1 - u) / .12) }[s.kind] ?? Math.min(1, u / .12, (1 - u) / .2);
    pr[i] = (s.kind === 'hatch' ? .4 : .22) + (s.kind === 'hatch' ? .6 : .78) * Math.pow(clamp(taper), .7);
    if (s.inkMap) { // AI strokes: pressure follows the drawn line's own light and dark along its length
      const gx = Math.round(pts[i].x - ox), gy = Math.round(pts[i].y - oy), j = gy * s.inkW + gx;
      let v = s.inkMap[j] ?? 0; for (const d of [-1, 1, -s.inkW, s.inkW]) v = Math.max(v, s.inkMap[j + d] ?? 0);
      pr[i] *= lerp(.45, 1.15, clamp(v));
    }
    if (i) len += Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
  }
  const { inkMap, inkW, ...rest } = s; // the per-pixel map is only needed while sampling
  return { ...rest, x, y, pr, n, len };
}
function styleStroke(s) {
  const str = s.strength ?? .5;
  if (s.kind === 'construct') { s.width = 1.1; s.alpha = .24; s.ghost = 0; }
  else if (s.kind === 'contour' && s.ai) {
    // AI line art already decides which lines matter; its own darkness becomes pressure. Features stay a touch finer.
    s.width = (.7 + str * 1.5) * (s.fine ? .85 : 1); s.alpha = .3 + .7 * Math.pow(str, .75); s.ghost = .2;
    const z = s.zones ?? [];
    if (s.eye > .4 || z[ZB.EYE] > .4) s.alpha = Math.min(1, s.alpha + .1);
    else if (z[ZB.BRIDGE] > .5 && z[ZB.NOSE] < .3) s.alpha *= .7;
  }
  else if (s.kind === 'contour') { // confident graphite: strong lines press hard and broad, faint ones stay light
    s.width = lerp(1.05 + str * 1.5, .9 + str * 1.2, s.face); s.alpha = .42 + .58 * Math.pow(str, .7); s.ghost = .3;
    // Line hierarchy inside the face: lash lines and lids carry the expression, nostrils and the lip line come next,
    // the nose bridge and loose cheek lines stay whisper-light so the face doesn't look carved.
    const z = s.zones ?? [];
    if (s.eye > .4 || z[ZB.EYE] > .4) { s.width *= 1.35; s.alpha = Math.min(1, s.alpha + .2); }
    else if (z[ZB.BRIDGE] > .5 && z[ZB.NOSE] < .3) { s.alpha *= .4; s.width *= .7; s.ghost = 0; }
    else if (z[ZB.NOSE] > .4 || z[ZB.LIPS] > .4) s.alpha = Math.min(1, s.alpha + .12);
    else if (z[ZB.BROW] > .4) s.alpha *= .6; // brows get their own hair strokes
    else if (s.face > .5 && s.hand < .3 && (z[ZB.JAW] ?? 0) < .3 && s.meshed) { s.alpha *= .7; s.width *= .85; }
  }
  else if (s.kind === 'accent') { s.width = 1.1 + str * .9; s.alpha = .75; s.ghost = .1; }
  else if (s.kind === 'fill') { s.width = s.width0 ?? 1.2; s.alpha = s.alpha0 ?? .4; s.ghost = 0; }
  else { s.width = s.width0; s.alpha = s.alpha0; s.ghost = 0; }
  return s;
}
const endOf = s => ({ x:s.x[s.n - 1], y:s.y[s.n - 1] });
function orderNearest(list, from, reversible = true) {
  const left = list.slice(), out = []; let cx = from.x, cy = from.y;
  while (left.length) {
    let best = 0, bestD = Infinity, flip = false;
    for (let i = 0; i < left.length; i++) {
      const s = left[i], da = (s.x[0] - cx) ** 2 + (s.y[0] - cy) ** 2, dz = (s.x[s.n - 1] - cx) ** 2 + (s.y[s.n - 1] - cy) ** 2;
      // Slight preference for working downward, the way a portrait is usually built up.
      const bias = (s.y[0] < cy ? 1.25 : 1);
      if (da * bias < bestD) { bestD = da * bias; best = i; flip = false; }
      if (reversible && dz * bias < bestD) { bestD = dz * bias; best = i; flip = true; }
    }
    const s = left[best]; left[best] = left[left.length - 1]; left.pop();
    if (flip) { s.x.reverse(); s.y.reverse(); s.pr.reverse(); }
    out.push(s); cx = s.x[s.n - 1]; cy = s.y[s.n - 1];
  }
  return out;
}
function orderHatching(list, from) {
  // Hatch in small patches, zig-zagging back and forth inside each patch: the "쓱쓱" rhythm.
  const cells = new Map();
  for (const s of list) {
    const key = `${s.layer}:${Math.floor(s.x[0] / 36)}:${Math.floor(s.y[0] / 36)}`;
    if (!cells.has(key)) cells.set(key, []); cells.get(key).push(s);
  }
  const groups = [...cells.values()].map(strokes => {
    strokes.sort((a, z) => a.offset - z.offset);
    strokes.forEach((s, i) => { if (i % 2) { s.x.reverse(); s.y.reverse(); s.pr.reverse(); } s.chain = i > 0; });
    const x = strokes.reduce((a, s) => a + s.x[0], 0) / strokes.length, y = strokes.reduce((a, s) => a + s.y[0], 0) / strokes.length;
    return { strokes, x, y };
  });
  const out = []; let cx = from.x, cy = from.y;
  while (groups.length) {
    let best = 0, bestD = Infinity;
    groups.forEach((g, i) => { const d = (g.x - cx) ** 2 + (g.y - cy) ** 2; if (d < bestD) { bestD = d; best = i; } });
    const g = groups.splice(best, 1)[0]; out.push(...g.strokes);
    const last = g.strokes[g.strokes.length - 1]; cx = last.x[last.n - 1]; cy = last.y[last.n - 1];
  }
  return out;
}
// The signature is whatever the user types (an empty field signs the default name). "David Lee." keeps the hand-shaped
// Allura skeleton above; any other name is written in a script font (Allura for Latin letters, Nanum Brush Script for
// Hangul) and traced like the handwritten line. A trailing full stop becomes the final "탁" tap.
const SIGN_FONT = '"Allura", "Nanum Brush Script", cursive', DEFAULT_SIGNATURE = 'Yoonseul Lee.', SKELETON_SIGNATURE = 'David Lee.';
const signGlyphCache = new Map();
function signatureGlyphs(text) {
  const typed = (text ?? '').trim() || DEFAULT_SIGNATURE;
  if (typed === SKELETON_SIGNATURE) return { aspect:SIGNATURE.aspect, paths:SIGNATURE.paths.map(flat => { const pts = []; for (let k = 0; k < flat.length; k += 2) pts.push({ x:flat[k], y:flat[k + 1] }); return pts; }), dot:{ x:SIGNATURE.dot[0], y:SIGNATURE.dot[1] } };
  const name = typed.replace(/\.+$/, '').trim(), glyphs = name ? traceGlyphs(name, SIGN_FONT, signGlyphCache) : null;
  if (!glyphs) return null;
  return { aspect:glyphs.aspect, paths:glyphs.strokes, dot:name.length < typed.length ? { x:glyphs.aspect + .14, y:.82 } : null };
}
function signatureBox(sign, frame) {
  const span = sign.aspect + (sign.dot ? .3 : 0);
  if (frame) { // polaroid: small, at the right end of the white margin, below the handwritten line
    const height = Math.min(26, frame.side * .45 / span), width = height * span;
    return { x:frame.x0 + frame.side - 22 - width, y:frame.y0 + frame.side + frame.margin - 22 - height * 1.25, height, width };
  }
  // Top-left corner of the canvas, like an artist's mark: long names get narrower letters, short ones stop at a signature's height.
  const height = Math.min(W * .28 / SIGNATURE.aspect, W * .4 / sign.aspect), margin = 24; // "David Lee." keeps its original size
  return { x:PAD + margin, y:PAD + margin + 6, height, width:height * span };
}
function placeSignature(sign, frame) {
  const box = signatureBox(sign, frame), to = p => ({ x:box.x + p.x * box.height, y:box.y + p.y * box.height });
  return { paths:sign.paths.map(path => path.map(to)), dot:sign.dot ? to(sign.dot) : null, height:box.height };
}
const SIGN_MS = 3000; // travel + name + pause + tap + a moment before the pencil leaves, at full pace
const signPace = totalMs => clamp(totalMs / 12000, .55, 1); // short videos sign a little faster
function signatureStrokes(sign, startMs, rand, pace, frame) {
  // The name is written in one quick, continuous gesture, then a short pause, a lift — and the full stop: "탁".
  const { paths, dot, height } = placeSignature(sign, frame), out = [];
  for (const raw of paths) {
    const s = finalizeStroke({ raw, kind:'sign', fine:true, face:0, strength:1 }, rand, 0, 0);
    if (s) out.push(Object.assign(s, { width:1.5, alpha:.95, ghost:.25 }));
  }
  const writeMs = 1150 * pace, travelMs = 420 * pace, pauseMs = 260 * pace, tapMs = 70, total = out.reduce((a, s) => a + s.len, 0) || 1;
  let t = startMs + travelMs, prev = null;
  for (const s of out) {
    const gap = prev ? Math.hypot(s.x[0] - prev.x[prev.n - 1], s.y[0] - prev.y[prev.n - 1]) : 0;
    s.chain = !!prev && gap < height * .18; // letters that touch are joined without lifting the pencil
    s.tLift = prev ? prev.tUp : startMs;
    t += prev ? (s.chain ? 10 : 35 + gap * .5) * pace : 0;
    s.tDown = t; t += writeMs * s.len / total; s.tUp = t; prev = s;
  }
  if (!dot) return out;
  // The dot: a tight little press of graphite, placed after a beat.
  const ring = []; for (let a = 0; a <= Math.PI * 5; a += Math.PI / 6) { const r = 2.4 * (1 - a / (Math.PI * 6)); ring.push({ x:dot.x + Math.cos(a) * r, y:dot.y + Math.sin(a) * r }); }
  const tap = finalizeStroke({ raw:ring, kind:'dot', fine:true, face:0, strength:1 }, rand, 0, 0);
  if (tap) {
    tap.pr.fill(1); // pressed firmly all the way — no tapered ends on a dot
    Object.assign(tap, { width:2.4, alpha:1, ghost:.5, tLift:prev ? prev.tUp : startMs });
    tap.tDown = t + pauseMs; tap.tUp = tap.tDown + tapMs; out.push(tap);
  }
  return out;
}
// ───────────────────────── handwritten message ─────────────────────────
// A short line ("오늘하루 행복하세요!") written in pencil after the drawing, before the signature. The glyphs come from
// Nanum Pen Script (OFL): each character is rendered large, thinned to its centreline and traced into pen strokes.
const MESSAGE_FONT = '"Nanum Pen Script", "Malgun Gothic", sans-serif', MESSAGE_PX = 200;
const messageGlyphCache = new Map();
const messageGlyphs = text => traceGlyphs(text, MESSAGE_FONT, messageGlyphCache);
function traceGlyphs(text, font, cache) {
  // Returns strokes in "em" units (height of the rendered line = 1), in writing order, or null while the font loads.
  const face = `${MESSAGE_PX}px ${font}`;
  if (document.fonts && !document.fonts.check(face, text)) { document.fonts.load(face, text).then(() => { if (!session) rebuild(); }).catch(() => {}); return null; }
  if (cache.has(text)) return cache.get(text);
  const measure = document.createElement('canvas').getContext('2d'); measure.font = face;
  const w = Math.ceil(measure.measureText(text).width) + 40, h = Math.round(MESSAGE_PX * 1.3), c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently:true }); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#000'; g.font = face; g.textBaseline = 'middle';
  g.fillText(text, 20, h / 2);
  const d = g.getImageData(0, 0, w, h).data, on = new Uint8Array(w * h);
  for (let i = 0; i < on.length; i++) on[i] = d[i * 4] < 140 ? 1 : 0;
  thinLines(on, w, h);
  const paths = joinPaths(traceSkeleton(on, w), 2.2).filter(p => p.length > 4);
  // Writing order: character by character (left to right); within a character, top strokes first, each starting at its left/top end.
  const edges = [20]; for (let k = 1; k <= text.length; k++) edges.push(20 + measure.measureText(text.slice(0, k)).width);
  const charOf = x => { let k = 0; while (k < text.length - 1 && x >= edges[k + 1]) k++; return k; };
  const ordered = paths.map(p => {
    const xs = p.map(q => q.x), ys = p.map(q => q.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const a = p[0], z = p[p.length - 1], forward = a.x + a.y * .6 <= z.x + z.y * .6;
    return { pts:forward ? p : p.slice().reverse(), char:charOf(cx), top:Math.min(...ys), left:Math.min(...xs) };
  }).sort((p, q) => p.char - q.char || (Math.abs(p.top - q.top) > MESSAGE_PX * .12 ? p.top - q.top : p.left - q.left));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const o of ordered) for (const q of o.pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
  const em = Math.max(1, y1 - y0);
  const result = ordered.length ? { aspect:(x1 - x0) / em, strokes:ordered.map(o => chaikin(simplify(o.pts, 1.1)).map(q => ({ x:(q.x - x0) / em, y:(q.y - y0) / em }))) } : null;
  cache.set(text, result);
  return result;
}
function placeMessage(glyphs, strokes, A, sign, frame) {
  if (frame) {
    // Polaroid: the line is written across the card's white margin, like a caption under a snapshot.
    const height = Math.min(54, (frame.side - 48) / glyphs.aspect, frame.margin * .38), width = height * glyphs.aspect;
    const x = frame.x0 + (frame.side - width) / 2, y = frame.y0 + frame.side + (sign ? 14 : (frame.margin - height) / 2 - 4);
    return glyphs.strokes.map(p => p.map(q => ({ x:x + q.x * height, y:y + q.y * height })));
  }
  // Find the emptiest place on the canvas for the line: never across the face or hands, avoiding the figure where
  // there is bare paper, clear of the signature — and a little smaller when only a small gap is free.
  const G = 20, cols = Math.ceil(W / G), rows = Math.ceil(H / G), cost = new Float32Array(cols * rows);
  for (const s of strokes) for (let i = 0; i < s.n; i += 2) {
    const cx = Math.floor(s.x[i] / G), cy = Math.floor(s.y[i] / G); if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) cost[cy * cols + cx] += 1;
  }
  const { b, face, gw, gh, subject, handW } = A;
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const x = (cx + .5) * G, y = (cy + .5) * G, gx = Math.floor(x - b.x), gy = Math.floor(y - b.y), inside = gx >= 0 && gy >= 0 && gx < gw && gy < gh;
    const i = inside ? gy * gw + gx : -1;
    if (Math.hypot((x - b.x - face.x) / (face.rx * 1.35), (y - b.y - face.y) / (face.ry * 1.3)) < 1) cost[cy * cols + cx] += 400; // the face stays clear
    if (inside && handW[i] > .2) cost[cy * cols + cx] += 400;
    if (inside) cost[cy * cols + cx] += subject[i] * 6;
  }
  const box = sign ? signatureBox(sign) : null, maxW = W - PAD * 2 - 40, sig = box ? { x1:box.x + box.width + 25, y1:box.y + 80 } : { x1:0, y1:0 };
  let best = null;
  for (const size of [62, 52, 44]) {
    let height = size, width = height * glyphs.aspect;
    if (width > maxW) { width = maxW; height = width / glyphs.aspect; }
    for (let y = PAD + 20; y + height <= H - PAD - 20; y += 10) for (let x = PAD + 20; x + width <= W - PAD - 20; x += 10) {
      if (x < sig.x1 && y < sig.y1) continue;
      let sum = 0;
      for (let cy = Math.floor((y - 10) / G); cy <= Math.floor((y + height + 10) / G); cy++)
        for (let cx = Math.floor((x - 10) / G); cx <= Math.floor((x + width + 10) / G); cx++) if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) sum += cost[cy * cols + cx];
      // Bigger is better when it fits; ties go to the lower half and the centre line, where a message naturally sits.
      const score = sum - height * 1.5 + Math.abs(x + width / 2 - W / 2) * .03 + Math.abs(y - H * .8) * .03;
      if (!best || score < best.score) best = { score, x, y, height };
    }
  }
  best ??= { x:(W - 62 * glyphs.aspect) / 2, y:H - PAD - 92, height:62 };
  return glyphs.strokes.map(p => p.map(q => ({ x:best.x + q.x * best.height, y:best.y + q.y * best.height })));
}
const messageMs = (text, pace) => text ? clamp(500 + [...text].length * 190, 1400, 3800) * pace + 500 : 0; // writing + travel
function messageStrokes(glyphs, strokes, startMs, rand, pace, text, A, sign, frame) {
  const paths = placeMessage(glyphs, strokes, A, sign, frame), out = [];
  for (const raw of paths) {
    const s = finalizeStroke({ raw, kind:'sign', fine:true, face:0, strength:1 }, rand, 0, 0);
    if (!s) continue;
    // Pressed firmly, like a note meant to be read: a broad, dark line with only a slight taper at the ends.
    for (let i = 0; i < s.n; i++) s.pr[i] = .75 + .25 * s.pr[i];
    out.push(Object.assign(s, { width:3.2, alpha:1.3, ghost:.55, message:true }));
  }
  const writeMs = clamp(500 + [...text].length * 190, 1400, 3800) * pace, travelMs = 380 * pace, total = out.reduce((a, s) => a + s.len, 0) || 1;
  const liftMs = out.length > 1 ? Math.min(writeMs * .35, (out.length - 1) * 40 * pace) : 0; // pen lifts between strokes
  let t = startMs + travelMs, prev = null;
  for (const s of out) {
    s.tLift = prev ? prev.tUp : startMs; s.chain = false;
    t += prev ? liftMs / (out.length - 1) : 0;
    s.tDown = t; t += (writeMs - liftMs) * s.len / total; s.tUp = t; prev = s;
  }
  return out;
}
// ───────────────────────── talking portrait ─────────────────────────
// After the signature the finished sketch "says" the handwritten line: the lower lip and jaw are pulled down syllable by
// syllable (the gap filled with a pencil-dark mouth), and the eyes blink once. Pure image warping on the drawn sheet.
function planTalk(A, text, startMs, endMs) {
  // Spoken while the same line is being handwritten: the syllables are spread over the writing time.
  const mesh = A.marks?.mesh; if (!mesh || !text) return null;
  const P = i => ({ x:mesh[i].x + A.b.x, y:mesh[i].y + A.b.y });
  const left = P(61), right = P(291), top = P(13), bottom = P(14), chin = P(152), nose = P(2);
  const mouthW = Math.hypot(right.x - left.x, right.y - left.y); if (mouthW < 12) return null;
  const eye = (up, low, a, z) => { const c = { x:(P(up).x + P(low).x) / 2, y:(P(up).y + P(low).y) / 2 }, w = Math.hypot(P(z).x - P(a).x, P(z).y - P(a).y); return { ...c, w }; };
  // Syllable rhythm: each non-space character opens and closes the mouth once; a space is a short rest.
  const beats = [], speakMs = Math.max(600, endMs - startMs), rand = random(55);
  const chars = [...text], units = chars.reduce((a, ch) => a + (/\s/.test(ch) ? .6 : /[!?.,~]/.test(ch) ? .5 : 1), 0) || 1;
  let t = startMs;
  for (const ch of chars) {
    const len = speakMs * (/\s/.test(ch) ? .6 : /[!?.,~]/.test(ch) ? .5 : 1) / units;
    if (!/[\s!?.,~]/.test(ch)) beats.push({ start:t, end:t + len, amp:.65 + rand() * .35 });
    t += len;
  }
  return { start:startMs, end:t + 150, beats, left, right, top, bottom, chin, nose, mouthW,
    eyes:[eye(159, 145, 33, 133), eye(386, 374, 263, 362)], blinkAt:startMs + speakMs * .55 };
}
let talkSnapshot = null;
function drawTalk(t) {
  const talk = plan?.talk; if (!talk || t < talk.start || t > talk.end) return;
  // Snapshot of the finished sheet (taken once), so the warp always samples the complete drawing.
  if (!talkSnapshot || talkSnapshot.plan !== plan || talkSnapshot.darkness !== inkDarkness) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently:true });
    g.drawImage(paperCanvas, 0, 0);
    if (plan.aiLayer) g.drawImage(aiFrame, 0, 0); // drawSheet has just composed the fully revealed AI graphite
    g.drawImage(ink, 0, 0);
    talkSnapshot = { plan, darkness:inkDarkness, data:g.getImageData(0, 0, W, H), paper:paperCanvas.getContext('2d').getImageData(0, 0, W, H).data };
  }
  const src = talkSnapshot.data.data;
  let open = 0;
  for (const beat of talk.beats) if (t >= beat.start && t <= beat.end) open = Math.pow(Math.sin(Math.PI * (t - beat.start) / (beat.end - beat.start)), .8) * beat.amp;
  const blink = Math.max(0, 1 - Math.abs(t - talk.blinkAt) / 110);
  if (open > .01) warpMouth(talk, open, src, talkSnapshot.paper);
  if (blink > .01) for (const e of talk.eyes) closeEye(e, blink);
}
const talkBuffer = { canvas:document.createElement('canvas'), image:null };
function warpMouth(talk, open, src, paper) {
  // The lips part as a lens (wide in the middle, closed at the corners); everything under the lower lip slides down
  // with it, easing into a gentler jaw drop further down and fading out under the chin.
  const { left, right, top, bottom, chin, mouthW } = talk, drop = mouthW * .3 * open, half = mouthW * .5;
  const cx = (left.x + right.x) / 2, midLip = (top.y + bottom.y) / 2, cornerMid = (left.y + right.y) / 2;
  const x0 = Math.floor(cx - mouthW * 1.2), x1 = Math.ceil(cx + mouthW * 1.2);
  const y0 = Math.floor(Math.min(left.y, right.y, midLip) - 4), jawEnd = chin.y + mouthW * .5, y1 = Math.ceil(jawEnd + drop + 2);
  const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) return;
  const buf = talkBuffer; if (buf.canvas.width < w || buf.canvas.height < h) { buf.canvas.width = Math.max(w, buf.canvas.width); buf.canvas.height = Math.max(h, buf.canvas.height); buf.image = null; }
  if (!buf.image || buf.image.width !== w || buf.image.height !== h) buf.image = new ImageData(w, h);
  const out = buf.image.data, field = tooth.field, TS = tooth.size, blend = mouthW * .45;
  for (let x = 0; x < w; x++) {
    const X = x0 + x, u = (X - left.x) / ((right.x - left.x) || 1);
    const lip = lerp(left.y, right.y, u) + (midLip - cornerMid) * (1 - (2 * u - 1) ** 2);
    const across = Math.abs(X - cx) / half, lens = across < 1 ? Math.sqrt(1 - across * across) : 0;
    const bump = across < 2.4 ? .5 + .5 * Math.cos(Math.PI * across / 2.4) : 0;
    const gapH = drop * lens, jawD = drop * .75 * bump;
    for (let y = 0; y < h; y++) {
      const Y = y0 + y, p = (y * w + x) * 4;
      let sy = Y, dark = 0;
      if (Y >= lip) {
        const k = clamp((Y - lip - gapH) / blend), d = lerp(gapH, jawD, k) * (Y > chin.y ? clamp(1 - (Y - chin.y) / (jawEnd - chin.y)) : 1);
        if (Y < lip + gapH) { // inside the parted lips: bare paper with a soft pencil-shaded mouth (no stretched teeth)
          const v = (Y - lip) / gapH, core = Math.sin(Math.PI * v) * lens;
          dark = clamp(core * 1.3) * (.42 + field[(Y % TS) * TS + X % TS] * .2) * (.8 + .2 * Math.sin((X + Y) * 1.3));
          const q = (Y * W + X) * 4;
          for (let c = 0; c < 3; c++) out[p + c] = paper[q + c] * (1 - dark) + 42 * dark;
          out[p + 3] = 255; continue;
        }
        sy = Y - d;
      }
      // Bilinear sample of the finished sheet.
      const yy = clamp(sy, 0, H - 1.001), y0i = yy | 0, fy = yy - y0i, i0 = (y0i * W + X) * 4, i1 = i0 + W * 4;
      for (let c = 0; c < 3; c++) out[p + c] = src[i0 + c] * (1 - fy) + src[i1 + c] * fy;
      out[p + 3] = 255;
    }
  }
  buf.canvas.getContext('2d').putImageData(buf.image, 0, 0);
  onSheet(() => { clipWindow(); ctx.drawImage(buf.canvas, 0, 0, w, h, x0, y0, w, h); });
}
function closeEye(e, blink) {
  // A blink in pencil: the open eye is covered with paper and a closed-lid curve (with a few lashes) is drawn over it.
  const rx = e.w * .62, ry = e.w * .34, a = Math.min(1, blink * 1.6);
  onSheet(() => {
    clipWindow();
    ctx.save();
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.ellipse(e.x, e.y, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
    ctx.filter = 'blur(1.5px)'; ctx.drawImage(paperCanvas, 0, 0); ctx.filter = 'none';
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = a; ctx.strokeStyle = inkCtx.strokeStyle; ctx.lineCap = 'round';
    const x0 = e.x - e.w * .52, x1 = e.x + e.w * .52, y = e.y + e.w * .04, sag = e.w * .16;
    ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x0, y - sag * .2); ctx.quadraticCurveTo(e.x, y + sag, x1, y - sag * .2); ctx.stroke();
    ctx.lineWidth = 1.2;
    for (const f of [.3, .5, .7]) { const px = lerp(x0, x1, f), py = y + sag * (1 - (2 * f - 1) ** 2) * .5 + sag * .1; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (f - .5) * 6, py + e.w * .1); ctx.stroke(); }
    ctx.restore();
  });
}
function polaroidWindow(A) {
  // The square of the sheet shown in the card's picture: a portrait crop around the face, like a snapshot. What falls
  // outside is cut off, as on a real polaroid. It stays clear of the sheet's bottom so the white margin fits below it.
  const side = 600, s = POLAROID.img / side, margin = POLAROID.bottom / s;
  const fx = A.b.x + A.face.x, fy = A.b.y + A.face.y;
  const cx = clamp(fx, side / 2, W - side / 2), cy = clamp(fy + side * .04, side / 2, H - side / 2 - margin);
  return { side, s, cx, cy, x0:cx - side / 2, y0:cy - side / 2, margin };
}
function buildPlan(A, durationSec, densityPercent, style = 'shade', signature = null, showIntro = true, message = '', talking = false, polaroid = false) { // signature: from signatureGlyphs(), or null
  const density = densityPercent / 100, rand = random(1234), { b, face } = A;
  const frame = polaroid ? polaroidWindow(A) : null;
  // In the polaroid style, lines that would fall outside the picture are never planned: the pencil only works where it shows.
  const inFrame = s => { if (!frame) return true; let k = 0; for (let i = 0; i < s.n; i += 2) if (s.x[i] > frame.x0 - 4 && s.x[i] < frame.x0 + frame.side + 4 && s.y[i] > frame.y0 - 4 && s.y[i] < frame.y0 + frame.side + 4) k++; return k * 2 >= s.n * .35; };
  const totalMs = durationSec * 1000, outroMs = Math.min(1200, totalMs * .07);
  // Opening: the reference photo sits on the canvas for a moment, then fades away to bare paper before the pencil comes in.
  const intro = showIntro ? { hold:Math.min(1000, totalMs * .08), fade:Math.min(700, totalMs * .06) } : null;
  const introMs = intro ? intro.hold + intro.fade : 0, leadMs = 380 + introMs;
  const signMs = signature ? SIGN_MS * signPace(totalMs) : 0;
  const messageText = (message ?? '').trim(), glyphs = messageText ? messageGlyphs(messageText) : null;
  const writeMsgMs = glyphs ? messageMs(messageText, signPace(totalMs)) : 0;
  const speak = talking && messageText && A.marks?.mesh;
  const drawMs = totalMs - leadMs - outroMs - signMs - writeMsgMs;
  let capacity = (drawMs / 1000) * SPEED;
  const cost = s => strokeCost(s.kind, s.len);
  const prep = (list, kind) => list.map(s => finalizeStroke(kind ? { ...s, kind } : s, rand, b.x, b.y)).filter(s => s && inFrame(s));

  const ai = style === 'ai' && A.ai; // AI line art replaces the traced contours; otherwise the classic engine
  const sourceContours = ai ? A.ai.contours : A.contours;
  const contours = prep(sourceContours, 'contour'), fills = ai ? [] : prep(A.fills);
  // Hatching (parallel shadow strokes) in the shaded style, and on top of the AI line art, where it restores what a
  // line model can't draw: the nose, cheek and jaw shadows. The AI already draws hair, so no extra strands there.
  const shaded = style === 'shade' || !!ai;
  const hatchSource = !shaded || density <= 0 ? [] : ai ? [...makeNoseShading(A, density, rand), ...makeShading(A, density, rand)]
    : [...makeNoseShading(A, density, rand), ...makeShading(A, density, rand), ...makeHairStrands(A, density, rand)];
  const hatches = prep(hatchSource).sort((a, z) => z.shade - a.shade);
  const priority = s => s.strength * (.45 + Math.min(1.4, s.len / 70));
  const group = s => s.hand > .5 ? 'hand' : s.face > .5 || s.head ? 'head' : 'body';
  const pool = (list, name) => list.filter(s => group(s) === name).sort((a, z) => priority(z) - priority(a));
  const headContours = pool(contours, 'head'), handContours = pool(contours, 'hand'), bodyContours = pool(contours, 'body');
  const sumCost = list => list.reduce((a, s) => a + cost(s), 0);
  let aiShare = null;
  if (ai) {
    // The AI drawing is meant to be drawn whole: hurry the hand (up to 3×) rather than leave lines out,
    // and give every group exactly its own share, so nothing is starved.
    const parts = { head:sumCost(headContours), hand:sumCost(handContours), body:sumCost(bodyContours),
      headH:sumCost(hatches.filter(s => group(s) === 'head')), handH:sumCost(hatches.filter(s => group(s) === 'hand')), bodyH:sumCost(hatches.filter(s => group(s) === 'body')) };
    const total = Object.values(parts).reduce((a, v) => a + v, 0) / .93 || 1;
    capacity = Math.max(capacity, Math.min(total, capacity * 3));
    aiShare = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v / total * .999]));
  }

  let carry = 0; const stats = {};
  const take = (pool, share, name) => {
    let budget = capacity * share + carry, used = 0; const picked = [];
    for (const s of pool) { const c = cost(s); if (used + c <= budget) { picked.push(s); used += c; } }
    carry = Math.max(0, budget - used); stats[name] = `${picked.length}/${pool.length}`; return picked;
  };
  // Construction lines: a few long, faint, straightened lines that block in the figure first.
  const constructBudget = capacity * .06; let constructUsed = 0; const construct = [];
  for (const s of sourceContours.slice().sort((a, z) => z.len - a.len)) {
    if (s.len < 40) break;
    if (s.face > .3 || s.hand > .3) continue; // guide lines block in hair, shoulders and body — never across the face or hands
    // A searching line: the same curve, loosened, drawn a couple of pixels to one side and overshooting its ends.
    const loose = simplify(s.raw, 1.6), a = loose[0], z = loose[loose.length - 1];
    const ext = (p, q) => { const l = Math.hypot(p.x - q.x, p.y - q.y) || 1, e = 6 + rand() * 8; return { x:p.x + (p.x - q.x) / l * e, y:p.y + (p.y - q.y) / l * e }; };
    const ax = z.x - a.x, ay = z.y - a.y, al = Math.hypot(ax, ay) || 1, side = (rand() < .5 ? -1 : 1) * (1.5 + rand() * 1.8);
    const raw = [ext(a, loose[1]), ...loose.slice(1, -1), ext(z, loose[loose.length - 2])].map(p => ({ x:p.x - ay / al * side + (rand() - .5), y:p.y + ax / al * side + (rand() - .5) }));
    const c = finalizeStroke({ raw, kind:'construct', face:s.face, strength:s.strength }, rand, b.x, b.y);
    if (!c || !inFrame(c) || constructUsed + cost(c) > constructBudget) continue;
    construct.push(c); constructUsed += cost(c);
  }
  // Shares of the time budget. Lines always come first; shading only gets what the "선 + 그림자" style allows.
  const headC = take(headContours, ai ? aiShare.head : shaded ? .28 : .40, 'headContour');
  const headF = take(fills, ai ? 0 : .08, 'fill');
  const accents = [];
  let accentBudget = capacity * (ai ? 0 : .03) + carry; // the AI drawing already weights its own lines; no doubled accents
  for (const s of ai ? [] : headC.filter(c => c.face > .5).sort((a, z) => z.strength - a.strength).slice(0, Math.ceil(headC.length * .08))) {
    const c = { ...s, kind:'accent', x:s.x.map(v => v + (rand() - .5) * .8), y:s.y.map(v => v + (rand() - .5) * .8), pr:s.pr.slice() };
    if (cost(c) <= accentBudget) { accents.push(c); accentBudget -= cost(c); }
  }
  carry = accentBudget;
  const headH = take(hatches.filter(s => group(s) === 'head'), ai ? aiShare.headH : .10, 'headHatch');
  const handC = take(handContours, ai ? aiShare.hand : shaded ? .10 : .15, 'handContour');
  const handH = take(hatches.filter(s => group(s) === 'hand'), ai ? aiShare.handH : .03, 'handHatch');
  const bodyC = take(bodyContours, ai ? aiShare.body : shaded ? .20 : .30, 'bodyContour');
  const bodyH = take(hatches.filter(s => group(s) === 'body'), ai ? aiShare.bodyH : .14, 'bodyHatch');

  const faceCenter = { x:b.x + face.x, y:b.y + face.y - face.ry * .4 };
  const phases = []; let at = faceCenter;
  const add = list => { phases.push(list); if (list.length) at = endOf(list[list.length - 1]); };
  add(orderNearest(construct, at));
  add(orderNearest(headC, at));
  add(orderNearest(headF, at));
  add(orderNearest(accents, at));
  add(orderHatching(headH, at));
  const faceEndIndex = phases.reduce((a, p) => a + p.length, 0);
  add(orderNearest(handC, at));
  add(orderHatching(handH, at));
  add(orderNearest(bodyC, at));
  add(orderHatching(bodyH, at));
  const strokes = phases.flat().map(styleStroke);

  // Timeline in raw units, then scaled so the last stroke ends exactly before the outro.
  const entry = { x:W + 320, y:H * .95 }; let t = 0, px = entry.x, py = entry.y; // the hand comes in from off the easel, lower right
  for (const s of strokes) {
    const d = Math.hypot(s.x[0] - px, s.y[0] - py);
    s.tLift = t; t += s.chain ? 8 + d * .1 : KIND[s.kind].lift + d * .09;
    s.tDown = t; t += s.len / KIND[s.kind].speed; s.tUp = t;
    px = s.x[s.n - 1]; py = s.y[s.n - 1];
  }
  const scale = strokes.length ? drawMs / t : 0;
  for (const s of strokes) { s.tLift = s.tLift * scale + (s === strokes[0] ? introMs : leadMs); s.tDown = s.tDown * scale + leadMs; s.tUp = s.tUp * scale + leadMs; }
  const drawEndMs = leadMs + drawMs, faceEndMs = faceEndIndex && strokes[faceEndIndex - 1] ? strokes[faceEndIndex - 1].tUp : 0;
  let finaleMs = drawEndMs, talk = null;
  if (glyphs) {
    const msg = messageStrokes(glyphs, strokes, drawEndMs, random(777), signPace(totalMs), messageText, A, signature, frame); strokes.push(...msg);
    if (msg.length) {
      finaleMs = msg[msg.length - 1].tUp;
      if (speak) talk = planTalk(A, messageText, msg[0].tDown, finaleMs); // the portrait says the line as it is written
    }
  }
  if (signature) strokes.push(...signatureStrokes(signature, finaleMs, random(4321), signPace(totalMs), frame));
  const exitMs = Math.min(700, outroMs * .75);

  return { strokes, totalMs, drawEndMs, exitMs, talk, entry, exit:{ x:W + 340, y:H * 1.1 }, faceEndMs, outside:A.outside, ai:!!ai, polaroid:frame,
    intro:intro && { ...intro, photo:A.work, face:A.face, at:{ x:b.x, y:b.y } }, aiLayer:ai ? A.ai.layer : null, stats, audio:buildAudioEvents(strokes) };
}

// ───────────────────────── rendering ─────────────────────────
let cursor = { stroke:0, point:0, time:-1 };
function resetInk() { inkCtx.clearRect(0, 0, W, H); notesCtx.clearRect(0, 0, W, H); revealCtx.clearRect(0, 0, W, H); cursor = { stroke:0, point:0, time:-1 }; }
function revealSegment(s, i) {
  revealCtx.lineWidth = REVEAL_RADIUS * 2 + 1;
  revealCtx.beginPath(); revealCtx.moveTo(s.x[i], s.y[i]); revealCtx.lineTo(s.x[i + 1], s.y[i + 1]); revealCtx.stroke();
}
let inkDarkness = Number(darkness.value) / 100; // "선 진하기": scales every stroke's graphite
function drawSegment(s, i, g = inkCtx) {
  const p = (s.pr[i] + s.pr[i + 1]) / 2, a = s.alpha * p * inkDarkness;
  // Once a stroke is fully opaque, extra darkness presses harder: the line gets broader instead.
  const press = a > 1 ? Math.min(1.8, 1 + (a - 1) * .6) : 1;
  g.globalAlpha = Math.min(1, a); g.lineWidth = s.width * (.45 + .55 * p) * press;
  g.beginPath(); g.moveTo(s.x[i], s.y[i]); g.lineTo(s.x[i + 1], s.y[i + 1]); g.stroke();
  if (s.ghost) { // a second, fainter graphite edge makes the line look drawn rather than vector-perfect
    const dx = s.x[i + 1] - s.x[i], dy = s.y[i + 1] - s.y[i], l = Math.hypot(dx, dy) || 1, o = .55;
    g.globalAlpha = Math.min(1, a * s.ghost); g.lineWidth = s.width * .55 * press;
    g.beginPath(); g.moveTo(s.x[i] - dy / l * o, s.y[i] + dx / l * o); g.lineTo(s.x[i + 1] - dy / l * o, s.y[i + 1] + dx / l * o); g.stroke();
  }
}
function strokeProgress(s, t) {
  const f = clamp((t - s.tDown) / Math.max(1, s.tUp - s.tDown));
  return (f * .6 + (.5 - .5 * Math.cos(Math.PI * f)) * .4) * (s.n - 1);
}
function advanceInk(t) {
  if (t < cursor.time) resetInk();
  cursor.time = t;
  const list = plan.strokes; let drew = false;
  // Graphite never survives outside the figure's silhouette — except the signature, which lives on the bare paper.
  const clip = () => { inkCtx.save(); inkCtx.globalCompositeOperation = 'destination-out'; inkCtx.globalAlpha = 1; inkCtx.drawImage(plan.outside, 0, 0); inkCtx.restore(); drew = false; };
  while (cursor.stroke < list.length) {
    const s = list[cursor.stroke];
    if (t < s.tDown) break;
    const signing = s.kind === 'sign' || s.kind === 'dot', revealing = s.ai && plan.aiLayer, target2d = plan.polaroid && signing ? notesCtx : inkCtx;
    if (signing && drew) clip();
    const done = t >= s.tUp, target = done ? s.n - 1 : Math.floor(strokeProgress(s, t));
    while (cursor.point < target) {
      if (revealing) revealSegment(s, cursor.point++);
      else { drawSegment(s, cursor.point++, target2d); if (!signing) drew = true; }
    }
    if (!done) break;
    cursor.stroke++; cursor.point = 0;
  }
  if (drew) clip();
}
const ease = u => .5 - .5 * Math.cos(Math.PI * clamp(u));
function pencilAt(t) {
  const list = plan.strokes;
  if (!list.length) return null;
  const s = list[Math.min(cursor.stroke, list.length - 1)];
  if (cursor.stroke >= list.length) { // drawing finished: pencil lifts away
    const last = list[list.length - 1], u = (t - last.tUp) / plan.exitMs;
    if (u >= 1) return null;
    const e = ease(u); return { x:lerp(last.x[last.n - 1], plan.exit.x, e), y:lerp(last.y[last.n - 1], plan.exit.y, e), lift:Math.min(1, u * 3), dir:0 };
  }
  if (t < s.tDown) {
    const prev = list[cursor.stroke - 1], from = prev ? { x:prev.x[prev.n - 1], y:prev.y[prev.n - 1] } : plan.entry;
    const u = (t - s.tLift) / Math.max(1, s.tDown - s.tLift), e = ease(u);
    return { x:lerp(from.x, s.x[0], e), y:lerp(from.y, s.y[0], e), lift:clamp(Math.sin(Math.PI * clamp(u)) * (s.chain ? .25 : 1) + (prev ? 0 : 1 - e)), dir:0 };
  }
  const k = strokeProgress(s, t), i = Math.min(s.n - 2, Math.floor(k)), f = k - i;
  return { x:lerp(s.x[i], s.x[i + 1], f), y:lerp(s.y[i], s.y[i + 1], f), lift:0, dir:Math.sign(s.x[i + 1] - s.x[i]) };
}
function drawPencil(pen) {
  // A dark graphite pencil whose point rides the stroke; when lifted it rises and its shadow drifts away.
  const lift = pen.lift;
  ctx.save(); ctx.translate(pen.x - lift * 5, pen.y - lift * 9); ctx.rotate(.78 + pen.dir * .025);
  ctx.save(); ctx.translate(5 + lift * 12, 6 + lift * 9); ctx.filter = `blur(${4 + lift * 3}px)`; ctx.fillStyle = `rgba(42,34,27,${.22 - lift * .08})`; ctx.fillRect(-7, -153, 17, 150); ctx.restore();
  ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(-8, -162); ctx.lineTo(8, -162); ctx.lineTo(8, -10); ctx.closePath();
  const barrel = ctx.createLinearGradient(-8, 0, 8, 0); barrel.addColorStop(0, '#090e14'); barrel.addColorStop(.25, '#344352'); barrel.addColorStop(.48, '#7c8998'); barrel.addColorStop(.7, '#25313e'); barrel.addColorStop(1, '#080c12'); ctx.fillStyle = barrel; ctx.fill(); ctx.strokeStyle = 'rgba(4,7,10,.82)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(240,246,249,.52)'; ctx.fillRect(-4.4, -153, 1.9, 133);
  ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(8, -10); ctx.lineTo(0, 0); ctx.closePath(); ctx.fillStyle = '#d7ad77'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-2.3, -3.2); ctx.lineTo(2.3, -3.2); ctx.lineTo(0, 0); ctx.closePath(); ctx.fillStyle = '#111416'; ctx.fill();
  ctx.restore();
}
function renderFrame(t) {
  ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sceneCanvas, 0, 0);
  if (plan?.polaroid) {
    // Polaroid style: blank canvas board, the card taped on it, the sketch in its picture window, the notes on its margin.
    ctx.save(); ctx.translate(BOARD.x, BOARD.y); ctx.scale(BOARD.s, BOARD.s); ctx.drawImage(paperCanvas, 0, 0); ctx.restore();
    ctx.drawImage(polaroidBackdrop(), 0, 0);
    onSheet(() => { clipWindow(); drawSheet(t); });
    onSheet(() => {
      const p = plan.polaroid; ctx.drawImage(notes, 0, 0);
      ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 2 / p.s; ctx.strokeRect(p.x0, p.y0, p.side, p.side); // the picture's edge
    });
  } else onSheet(() => { ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); drawSheet(t); });
  drawTalk(t);
  drawPolaroid(t);
  const pen = plan ? pencilAt(t) : null, hand = pen && handToggle?.checked && handImage.naturalWidth > 0;
  if (hand) drawHand(pen); // the arm passes under the shorts title, like a caption laid over the video
  drawTitle();
  if (pen && !hand) onSheet(() => drawPencil(pen));
}
// ───────────────────────── drawing hand (experiment) ─────────────────────────
// A real right hand and forearm (a photo with the background removed, the sleeve continued past the photo's bottom edge)
// holds the pencil. Its graphite point rides the stroke; the arm leans in from the lower right and casts a soft shadow.
const HAND = { src:'assets/hand-right.webp', tip:{ x:16.6, y:243.1 }, pencilLength:423.6, screenPencil:380 };
const handImage = new Image(); let handShadow = null;
handImage.src = HAND.src;
handImage.decode().then(() => {
  // Shadow: the silhouette, darkened and blurred once at quarter size.
  const q = 4, w = Math.ceil(handImage.width / q), h = Math.ceil(handImage.height / q), pad = 12;
  const shape = document.createElement('canvas'); shape.width = w + pad * 2; shape.height = h + pad * 2;
  const sg = shape.getContext('2d'); sg.drawImage(handImage, pad, pad, w, h); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#1e140c'; sg.fillRect(0, 0, shape.width, shape.height);
  handShadow = document.createElement('canvas'); handShadow.width = shape.width; handShadow.height = shape.height;
  const hg = handShadow.getContext('2d'); hg.filter = 'blur(5px)'; hg.drawImage(shape, 0, 0);
  handShadow.q = q; handShadow.pad = pad;
  redrawStill();
}).catch(() => {});
function drawHand(pen) {
  const { x:tx, y:ty } = sheetToView(pen.x, pen.y), lift = pen.lift, scale = HAND.screenPencil / HAND.pencilLength;
  // Lean: the arm lies flatter when the point is on the left, so the photo's cut-off elbow side always stays off the frame.
  const angle = -.32 + .42 * clamp((tx - BOARD.x) / BOARD.w);
  if (handShadow) {
    // The shadow meets the point on the paper and falls further away with distance from it, and further still when lifted.
    const { q, pad } = handShadow, grow = 1.035 + lift * .03;
    ctx.save(); ctx.globalAlpha = .3 - lift * .08;
    ctx.translate(tx + 3 + lift * 22, ty + 5 + lift * 30); ctx.rotate(angle); ctx.scale(scale * grow, scale * grow);
    ctx.drawImage(handShadow, -HAND.tip.x - pad * q, -HAND.tip.y - pad * q, handShadow.width * q, handShadow.height * q);
    ctx.restore();
  }
  const lifted = scale * (1 + lift * .03); // a lifted hand comes a little toward the camera
  ctx.save(); ctx.translate(tx - lift * 8, ty - lift * 14); ctx.rotate(angle); ctx.scale(lifted, lifted);
  ctx.drawImage(handImage, -HAND.tip.x, -HAND.tip.y);
  ctx.restore();
}
// ───────────────────────── shorts title ─────────────────────────
const TITLE_FONT = '"Black Han Sans", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
function titleLayout(text) {
  // Up to two lines in the wall space above the canvas board, as large as fits: shorts-caption style.
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 2);
  if (!lines.length) return null;
  const maxW = VIEW_W - 80, top = 56, bottom = BOARD.y - 12, maxSize = 104, minSize = 44; // clear of the shorts top bar
  const width = (line, size) => { ctx.font = `${size}px ${TITLE_FONT}`; return ctx.measureText(line).width; };
  // One long line with spaces: break it near the middle rather than shrinking it to a whisper.
  if (lines.length === 1 && width(lines[0], maxSize) > maxW && lines[0].includes(' ')) {
    const words = lines[0].split(' '); let best = null;
    for (let k = 1; k < words.length; k++) {
      const a = words.slice(0, k).join(' '), b = words.slice(k).join(' '), wider = Math.max(width(a, maxSize), width(b, maxSize));
      if (!best || wider < best.wider) best = { a, b, wider };
    }
    lines.splice(0, 1, best.a, best.b);
  }
  const heightFit = (bottom - top) / (lines.length * 1.12);
  let size = Math.min(maxSize, heightFit);
  for (const line of lines) size = Math.min(size, maxSize * maxW / Math.max(1, width(line, maxSize)));
  return { lines, size:Math.max(minSize, Math.floor(size)), top, bottom };
}
function drawTitle() {
  const layout = titleLayout(titleInput?.value ?? ''); if (!layout) return;
  const { lines, size, top, bottom } = layout, lineH = size * 1.12, blockH = lineH * lines.length;
  // The web font arrives in per-script slices: fetch the glyphs of this title first, then redraw with them.
  const face = `${size}px ${TITLE_FONT}`, text = lines.join('');
  if (document.fonts && !document.fonts.check(face, text)) { document.fonts.load(face, text).then(redrawStill).catch(() => {}); }
  let y = top + (bottom - top - blockH) / 2 + lineH / 2;
  ctx.save();
  ctx.font = `${size}px ${TITLE_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  for (const line of lines) {
    // Soft drop shadow, a thick black outline, then white fill: legible over the wooden wall at phone size.
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = size * .18; ctx.shadowOffsetY = size * .06;
    ctx.strokeStyle = '#111'; ctx.lineWidth = size * .17; ctx.strokeText(line, VIEW_W / 2, y);
    ctx.shadowColor = 'transparent'; ctx.fillStyle = '#fff'; ctx.fillText(line, VIEW_W / 2, y);
    y += lineH;
  }
  ctx.restore();
}
async function ensureTitleFont() {
  const layout = titleLayout(titleInput?.value ?? ''); if (!layout || !document.fonts) return;
  try { await withTimeout(document.fonts.load(`${layout.size}px ${TITLE_FONT}`, layout.lines.join('')), 4000); } catch {}
}
function redrawStill() { // refresh the still preview after a setting that doesn't change the drawing plan
  if (session) return;
  if (plan) { renderFrame(plan.totalMs); drawFaceGuide(); } else renderFrame(0);
}
function drawSheet(t) {
  ctx.drawImage(paperCanvas, 0, 0);
  if (!plan) return;
  advanceInk(t);
  if (plan.aiLayer) {
    // AI graphite, darkened by the "선 진하기" slider (a second pass beyond 100%), shown only where the pencil has been.
    aiFrameCtx.clearRect(0, 0, W, H); aiFrameCtx.globalCompositeOperation = 'source-over';
    aiFrameCtx.globalAlpha = Math.min(1, inkDarkness); aiFrameCtx.drawImage(plan.aiLayer, 0, 0);
    if (inkDarkness > 1) { aiFrameCtx.globalAlpha = Math.min(1, inkDarkness - 1); aiFrameCtx.drawImage(plan.aiLayer, 0, 0); }
    aiFrameCtx.globalAlpha = 1; aiFrameCtx.globalCompositeOperation = 'destination-in'; aiFrameCtx.drawImage(reveal, 0, 0);
    aiFrameCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(aiFrame, 0, 0);
  }
  ctx.drawImage(ink, 0, 0);
}
function drawPolaroid(t) {
  // The reference photo as a polaroid taped to the canvas at a slight angle; it lifts away and fades before drawing starts.
  const intro = plan?.intro; if (!intro || t >= intro.hold + intro.fade) return;
  if (plan.polaroid) {
    // Polaroid style: the card stays put; the photo simply fades out of its picture window, leaving blank film to draw on.
    const u = t < intro.hold ? 0 : ease((t - intro.hold) / intro.fade);
    onSheet(() => { clipWindow(); ctx.globalAlpha = 1 - u; ctx.drawImage(intro.photo, intro.at.x, intro.at.y); ctx.fillStyle = 'rgba(255,240,215,.08)'; ctx.fillRect(plan.polaroid.x0, plan.polaroid.y0, plan.polaroid.side, plan.polaroid.side); });
    return;
  }
  intro.card ??= polaroidCard(intro.photo, intro.face); // built once, so it fades as one solid piece
  const { card } = intro, u = t < intro.hold ? 0 : ease((t - intro.hold) / intro.fade);
  const cx = VIEW_W / 2 + u * 40, cy = BOARD.y + BOARD.h * .47 - u * 90, angle = -.085 + u * .05, scale = 1 + u * .05;
  ctx.save();
  ctx.globalAlpha = 1 - u;
  ctx.translate(cx, cy); ctx.rotate(angle); ctx.scale(scale, scale);
  ctx.shadowColor = 'rgba(20,12,6,.5)'; ctx.shadowBlur = 38 + u * 30; ctx.shadowOffsetX = 14 + u * 16; ctx.shadowOffsetY = 22 + u * 34;
  ctx.drawImage(card, -card.width / 2, -card.height / 2);
  ctx.restore();
}
function polaroidCard(photo, face) {
  // Square crop centred a little below the eyes, like a portrait snapshot, in a white instant-film frame (blank without a photo).
  const { img, border, tape, cardW, cardH } = POLAROID;
  const card = document.createElement('canvas'); card.width = cardW; card.height = cardH + tape;
  const g = card.getContext('2d'); g.translate(0, tape);
  const paper = g.createLinearGradient(0, 0, cardW, cardH); paper.addColorStop(0, '#fdfcf8'); paper.addColorStop(1, '#ece7dc');
  g.fillStyle = paper; g.fillRect(0, 0, cardW, cardH);
  if (photo) {
    const side = Math.min(photo.width, photo.height, Math.max(face.rx, face.ry) * 3.4);
    const sx = clamp(face.x - side / 2, 0, photo.width - side), sy = clamp(face.y - side * .46, 0, photo.height - side);
    g.drawImage(photo, sx, sy, side, side, border, border, img, img);
    g.fillStyle = 'rgba(255,240,215,.08)'; g.fillRect(border, border, img, img); // a touch of instant-film warmth
  }
  g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 2; g.strokeRect(border, border, img, img);
  // A strip of translucent tape holding it to the canvas.
  g.translate(cardW / 2, 0); g.rotate(.06);
  g.fillStyle = 'rgba(236,228,205,.78)'; g.fillRect(-cardW * .16, -tape + 4, cardW * .32, 58);
  g.strokeStyle = 'rgba(160,145,115,.25)'; g.lineWidth = 1.5; g.strokeRect(-cardW * .16, -tape + 4, cardW * .32, 58);
  return card;
}
let backdrop = null;
function polaroidBackdrop() {
  // The blank card in its resting pose with its soft shadow, rendered once over a transparent frame-sized layer.
  if (backdrop) return backdrop;
  const card = polaroidCard(null); backdrop = document.createElement('canvas'); backdrop.width = VIEW_W; backdrop.height = VIEW_H;
  const g = backdrop.getContext('2d'); g.translate(POLAROID.center.x, POLAROID.center.y); g.rotate(POLAROID.angle);
  g.shadowColor = 'rgba(20,12,6,.5)'; g.shadowBlur = 38; g.shadowOffsetX = 14; g.shadowOffsetY = 22;
  g.drawImage(card, -card.width / 2, -card.height / 2);
  return backdrop;
}

// ───────────────────────── pencil sound ─────────────────────────
function buildAudioEvents(strokes) {
  // One audible "쓱" per gesture: quick strokes are grouped into ~150ms swishes,
  // and every swish is followed by a short silence so the sound never smears into a hiss.
  const level = { construct:.4, contour:.9, accent:1, fill:.7, hatch:.75, sign:.85 };
  const merged = []; let cur = null, tap = null;
  for (const s of strokes) {
    if (s.kind === 'dot') { tap = s; continue; } // the full stop gets its own sharp tap below
    if (cur && cur.kind === s.kind && s.tDown - cur.end < 45 && cur.end - cur.start < 150) { cur.end = s.tUp; cur.level = Math.max(cur.level, level[s.kind]); continue; }
    if (cur) merged.push(cur);
    cur = { start:s.tDown, end:s.tUp, level:level[s.kind], kind:s.kind };
  }
  if (cur) merged.push(cur);
  const events = []; let flip = 0;
  merged.forEach((e, i) => {
    const next = merged[i + 1];
    if (next) e.end = Math.min(e.end, next.start - 55);
    if (e.end - e.start < 45) { if (next && next.start - e.start < 100) return; e.end = e.start + 45; }
    flip ^= 1; // alternate stroke direction: slightly brighter on the push, softer on the pull
    events.push({ start:e.start, end:Math.min(e.end, e.start + 420), level:e.level * (flip ? 1 : .8), freq:flip ? 2600 : 1900 });
  });
  if (tap) events.push({ start:tap.tDown, end:tap.tDown + 40, level:1.6, freq:1250, tap:true });
  return events;
}
const volumeGain = percent => (percent / 100) * .5;
function createPencilVoice(ac, destination) {
  // Pink noise modulated by tiny random scratches (paper tooth), band-limited to the papery mid range.
  const rate = ac.sampleRate, buffer = ac.createBuffer(1, rate * 3, rate), data = buffer.getChannelData(0), rnd = random(99);
  const decay = Math.exp(-1 / (rate * .003));
  let b0 = 0, b1 = 0, b2 = 0, grain = 0, energy = 0;
  for (let i = 0; i < data.length; i++) {
    const white = rnd() * 2 - 1;
    b0 = .99765 * b0 + white * .099046; b1 = .963 * b1 + white * .2965164; b2 = .57 * b2 + white * 1.0526913;
    if (rnd() < 400 / rate) grain = .5 + rnd() * .5;
    grain *= decay;
    data[i] = (b0 + b1 + b2 + white * .1848) * .25 * (.45 + grain);
    energy += data[i] * data[i];
  }
  const norm = .25 / Math.sqrt(energy / data.length);
  for (let i = 0; i < data.length; i++) data[i] = clamp(data[i] * norm, -1, 1);
  const src = ac.createBufferSource(); src.buffer = buffer; src.loop = true;
  const filter = (type, f, q, gain = 0) => { const node = ac.createBiquadFilter(); node.type = type; node.frequency.value = f; node.Q.value = q; node.gain.value = gain; return node; };
  const color = filter('peaking', 2200, 1.1, 6), env = ac.createGain(), out = ac.createGain();
  env.gain.value = 0; out.gain.value = volumeGain(Number(volume?.value ?? 20));
  src.connect(filter('highpass', 700, .7)).connect(filter('lowpass', 5500, .6)).connect(color).connect(env).connect(out).connect(destination);
  src.start();
  return { env, color, out };
}
function scheduleStrokes(voice, events, startAt) {
  const g = voice.env.gain;
  for (const e of events) {
    const a = startAt + e.start / 1000, z = startAt + e.end / 1000, attack = Math.min(.04, (z - a) * .35);
    voice.color.frequency.setValueAtTime(e.freq, a);
    if (e.tap) { g.setValueAtTime(0, a); g.linearRampToValueAtTime(e.level, a + .003); g.setTargetAtTime(0, a + .006, .012); continue; } // "탁"
    g.setValueAtTime(0, a); g.linearRampToValueAtTime(e.level, a + attack); g.linearRampToValueAtTime(e.level * .6, z); g.setTargetAtTime(0, z, .015);
  }
}
const sound = {
  ac:null,
  ensure() {
    if (this.ac) return this.ac.state !== 'closed';
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    this.ac = new AC(); this.voice = createPencilVoice(this.ac, this.ac.destination);
    this.stream = this.ac.createMediaStreamDestination(); this.voice.out.connect(this.stream);
    return true;
  },
  setVolume(percent) { if (this.voice) this.voice.out.gain.setTargetAtTime(volumeGain(percent), this.ac.currentTime, .05); },
  schedule(events, startAt) { this.silence(); scheduleStrokes(this.voice, events, startAt); },
  silence() {
    if (!this.ac) return;
    this.voice.env.gain.cancelScheduledValues(0); this.voice.color.frequency.cancelScheduledValues(0);
    this.voice.env.gain.setValueAtTime(0, this.ac.currentTime);
  },
};

// ───────────────────────── playback, export & UI ─────────────────────────
function stopPlayback() { cancelAnimationFrame(raf); sound.silence(); session = null; keepAwake(false); }
let wakeLock = null;
async function keepAwake(on) { // keep a phone's screen on while playing or recording — a sleeping screen stops the recording
  try {
    if (on && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
}
async function play({ onDone }) {
  stopPlayback(); resetInk(); keepAwake(true);
  const useAudio = soundToggle.checked && sound.ensure();
  let clock;
  if (useAudio) {
    await sound.ac.resume();
    const startAt = sound.ac.currentTime + .1; sound.schedule(plan.audio, startAt);
    clock = () => (sound.ac.currentTime - startAt) * 1000; // the audio clock drives the picture, so sound and strokes stay in sync
  } else { const startAt = performance.now(); clock = () => performance.now() - startAt; }
  const token = session = {};
  const tick = () => {
    if (session !== token) return;
    const t = clock(); renderFrame(clamp(t, 0, plan.totalMs));
    if (t < plan.totalMs) raf = requestAnimationFrame(tick); else { session = null; keepAwake(false); onDone(); }
  };
  raf = requestAnimationFrame(tick);
  return useAudio;
}
const FACE_NOTE = {
  ai:'AI가 얼굴을 찾았습니다.',
  manual:'지정한 얼굴 위치로 다시 그렸습니다.',
  none:'AI가 얼굴을 찾지 못해 위치를 추정했습니다.',
  offline:'얼굴 인식 AI를 불러오지 못해(인터넷 연결 확인) 위치를 추정했습니다.',
};
function drawFaceGuide(box) {
  // Only on the still preview — never recorded into the video.
  const { b, face } = analysis, g = box ?? { x:b.x + face.x, y:b.y + face.y, rx:face.rx, ry:face.ry };
  onSheet(() => {
    ctx.setLineDash([9, 7]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(214,120,40,.9)';
    ctx.beginPath(); ctx.ellipse(g.x, g.y, g.rx, g.ry, 0, 0, Math.PI * 2); ctx.stroke();
  });
}
function rebuild() {
  if (!analysis) return;
  const sign = (signatureToggle?.checked ?? true) ? signatureGlyphs(signatureInput?.value) : null; // null for a moment while a script font loads
  plan = buildPlan(analysis, Number(seconds.value), Number(strength.value), styleSelect.value, sign, introToggle?.checked ?? true, messageInput?.value ?? '', talkToggle?.checked ?? false, polaroidToggle?.checked ?? false);
  resetInk(); renderFrame(plan.totalMs); drawFaceGuide();
  const faceAt = plan.faceEndMs ? ` 얼굴은 ${(plan.faceEndMs / 1000).toFixed(1)}초에 완성됩니다.` : '';
  const hands = analysis.marks?.hands?.length ?? 0, detailNote = analysis.marks?.mesh ? ` 이목구비${hands ? `와 손 ${hands}개` : ''}를 세밀하게 그립니다.` : '';
  const aiNote = styleSelect.value === 'ai' ? (plan.ai ? ' AI 선화로 그립니다.' : ' AI 선화를 불러오지 못해(인터넷 연결 확인) 기존 선 방식으로 그렸습니다.') : '';
  status.textContent = `${FACE_NOTE[analysis.face.source] ?? ''}${detailNote}${aiNote} ${plan.strokes.length.toLocaleString()}개의 연필 획으로 계획했습니다.${faceAt} 주황 점선이 얼굴 위치입니다. 틀리면 얼굴을 클릭하거나 얼굴 둘레를 드래그하세요.`;
}
function setBusy(busy) {
  preview.disabled = busy; exportButton.disabled = busy; photoInput.disabled = busy; seconds.disabled = busy; styleSelect.disabled = busy; darkness.disabled = busy; formatSelect.disabled = busy; if (signatureToggle) signatureToggle.disabled = busy; if (titleInput) titleInput.disabled = busy; if (introToggle) introToggle.disabled = busy; if (messageInput) messageInput.disabled = busy; if (signatureInput) signatureInput.disabled = busy; if (talkToggle) talkToggle.disabled = busy; if (handToggle) handToggle.disabled = busy; if (polaroidToggle) polaroidToggle.disabled = busy; if (suggestButton) suggestButton.disabled = busy; if (singerSelect) singerSelect.disabled = busy;
  strength.disabled = busy || styleSelect.value === 'line'; // shadow amount only matters when shading is drawn
  for (const range of SLIDERS) { const box = numberBox(range); if (box) box.disabled = range.disabled; }
}
// Every slider has a number box beside it: typing a value moves the slider (rounded and kept inside its range) and back.
const SLIDERS = [seconds, darkness, strength, volume], numberBox = range => document.querySelector(`#${range.id}Num`);
for (const range of SLIDERS) {
  const box = numberBox(range); if (!box) continue;
  range.addEventListener('input', () => { box.value = range.value; });
  box.addEventListener('change', () => {
    const typed = Math.round(Number(box.value)), value = Number.isFinite(typed) && box.value !== '' ? clamp(typed, Number(range.min), Number(range.max)) : Number(range.value);
    box.value = value;
    if (Number(range.value) !== value) { range.value = value; range.dispatchEvent(new Event('input')); }
  });
}
// Busy overlay on the canvas while a photo is analysed: a spinner, the current step, and the elapsed seconds.
const busyBox = document.querySelector('#busy'), busyText = document.querySelector('#busyText'), busyTime = document.querySelector('#busyTime');
let busyTimer = 0, busyStart = 0;
function showBusy(message) {
  if (!busyBox) return;
  busyText.textContent = message; preview.disabled = true; exportButton.disabled = true;
  if (busyBox.hidden) {
    busyBox.hidden = false; busyStart = performance.now(); clearInterval(busyTimer);
    const tick = () => { busyTime.textContent = `${Math.floor((performance.now() - busyStart) / 1000)}초 경과 · 잠시만 기다려 주세요`; };
    tick(); busyTimer = setInterval(tick, 500);
  }
}
function hideBusy() { if (!busyBox) return; busyBox.hidden = true; clearInterval(busyTimer); preview.disabled = false; exportButton.disabled = false; }
const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 30))); // let the overlay appear before heavy work
let loadToken = 0;
const uploadBox = document.querySelector('.upload');
photoInput.addEventListener('change', event => {
  const file = event.target.files[0]; if (!file) return; const image = new Image(), token = ++loadToken;
  // Say so at once, right in the picker the user just tapped: a large phone photo takes a moment even to open.
  uploadBox.classList.add('loading'); fileName.textContent = '이미지 분석중...'; status.textContent = '이미지 분석중...'; showBusy('이미지 분석중...');
  const settle = () => { if (token !== loadToken) return; uploadBox.classList.remove('loading'); fileName.textContent = file.name; };
  image.onerror = () => { if (token !== loadToken) return; settle(); hideBusy(); status.textContent = '사진을 열 수 없습니다. JPG, PNG, WEBP 사진을 선택해 주세요.'; };
  image.onload = async () => {
    stopPlayback(); source = image; analysis = null; plan = null; renderFrame(0);
    if (autoSuggest?.checked) fillSuggestion(autoFields());
    const step1 = detectorReady ? '얼굴과 인물을 찾고 있습니다' : '얼굴 인식 AI를 불러오는 중입니다\n(처음 한 번만 조금 걸립니다)';
    status.textContent = step1.replace('\n', ' '); showBusy(step1); await nextPaint();
    try {
      const result = await analyzePhoto(image);
      if (token !== loadToken) return;
      if (styleSelect.value === 'ai') {
        const step2 = 'AI가 사진을 선화로 옮기는 중입니다\n(휴대폰은 1분 가까이 걸릴 수 있어요)';
        status.textContent = step2.replace('\n', ' '); showBusy(step2); await nextPaint();
        await ensureLineArt(result);
        if (token !== loadToken) return;
      }
      showBusy('연필 획을 계획하고 있습니다'); await nextPaint();
      analysis = result; rebuild();
    } catch (error) {
      console.error(error); status.textContent = '사진을 처리하지 못했습니다. 다른 사진으로 다시 시도해 주세요.';
    } finally { if (token === loadToken) { settle(); hideBusy(); } }
  };
  image.src = URL.createObjectURL(file);
});
// Face correction: click moves the face centre, dragging draws a new face region.
let drag = null;
const canvasPoint = event => { // screen → video frame → sheet coordinates
  const r = canvas.getBoundingClientRect(), vx = (event.clientX - r.left) * VIEW_W / r.width, vy = (event.clientY - r.top) * VIEW_H / r.height;
  return viewToSheet(vx, vy);
};
const dragBox = (a, z) => ({ x:(a.x + z.x) / 2, y:(a.y + z.y) / 2, rx:Math.abs(z.x - a.x) / 2, ry:Math.abs(z.y - a.y) / 2 });
canvas.addEventListener('pointerdown', event => {
  if (!plan || session || exportButton.disabled) return;
  drag = canvasPoint(event);
  // On a touch screen the finger must stay free to scroll the page: a tap moves the face, a swipe just scrolls.
  if (event.pointerType === 'touch') drag.touch = true; else try { canvas.setPointerCapture(event.pointerId); } catch {}
});
canvas.addEventListener('pointercancel', () => { drag = null; }); // the browser took the gesture over for scrolling
canvas.addEventListener('pointermove', event => {
  if (!drag || drag.touch) return; const p = canvasPoint(event);
  if (Math.hypot(p.x - drag.x, p.y - drag.y) < 10) return;
  renderFrame(plan.totalMs); drawFaceGuide(dragBox(drag, p));
});
canvas.addEventListener('pointerup', event => {
  if (!drag) return; const start = drag, p = canvasPoint(event), { b, face } = analysis; drag = null;
  if (start.touch && Math.hypot(p.x - start.x, p.y - start.y) >= 10) return; // it was a swipe, not a tap
  const box = Math.hypot(p.x - start.x, p.y - start.y) < 10 ? { x:p.x, y:p.y, rx:face.rx, ry:face.ry } : dragBox(start, p);
  const next = shiftFace(face, { x:clamp(box.x - b.x, 0, b.w), y:clamp(box.y - b.y, 0, b.h), rx:Math.max(18, box.rx), ry:Math.max(22, box.ry), source:'manual' });
  status.textContent = '지정한 얼굴 위치로 다시 분석하고 있습니다…';
  setTimeout(() => { analysis = analyzeFace(analysis, next); rebuild(); }, 20);
});
seconds.addEventListener('input', () => { stopPlayback(); preview.textContent = '미리보기'; rebuild(); });
strength.addEventListener('input', () => { stopPlayback(); preview.textContent = '미리보기'; rebuild(); });
styleSelect.addEventListener('change', async () => {
  stopPlayback(); preview.textContent = '미리보기'; setBusy(false);
  if (styleSelect.value === 'ai' && analysis && !analysis.ai && !analysis.aiFailed) {
    const target = analysis; setBusy(true);
    status.textContent = 'AI가 사진을 선화로 옮기고 있습니다…'; showBusy('AI가 사진을 선화로 옮기는 중입니다'); await nextPaint();
    await ensureLineArt(target); setBusy(false); hideBusy();
    if (analysis !== target) return;
  }
  rebuild();
});
signatureToggle?.addEventListener('change', () => { stopPlayback(); preview.textContent = '미리보기'; rebuild(); });
introToggle?.addEventListener('change', () => { stopPlayback(); preview.textContent = '미리보기'; rebuild(); });
polaroidToggle?.addEventListener('change', () => { stopPlayback(); preview.textContent = '미리보기'; rebuild(); });
talkToggle?.addEventListener('change', () => { stopPlayback(); preview.textContent = '미리보기'; rebuild(); });
handToggle?.addEventListener('change', () => { stopPlayback(); preview.textContent = '미리보기'; redrawStill(); });
let messageTimer = 0; // re-plan shortly after typing stops, not on every keystroke
messageInput?.addEventListener('input', () => { clearTimeout(messageTimer); messageTimer = setTimeout(() => { stopPlayback(); preview.textContent = '미리보기'; rebuild(); }, 350); });
signatureInput?.addEventListener('input', () => { clearTimeout(messageTimer); messageTimer = setTimeout(() => { stopPlayback(); preview.textContent = '미리보기'; rebuild(); }, 350); });
titleInput?.addEventListener('input', () => {
  const lines = titleInput.value.split('\n'); if (lines.length > 2) titleInput.value = lines.slice(0, 2).join('\n'); // two lines at most
  redrawStill();
});
document.fonts?.load(`100px ${TITLE_FONT}`, '가나다 ABC').then(redrawStill).catch(() => {}); // the title font arrives from the web
// ───────────────────────── fan phrase suggestions ─────────────────────────
// A title and a handwritten line for the chosen singer, from phrases.js: the singer's own phrases (drawn twice as often) plus
// the shared ones with the name filled in. Choosing a photo fills them automatically, but only into fields that are empty or
// still hold an earlier suggestion — never over words the user typed. "다른 추천" always draws both again.
const singerSelect = document.querySelector('#singer'), suggestButton = document.querySelector('#suggest'), autoSuggest = document.querySelector('#autoSuggest');
const suggested = { title:false, message:false }; // true while a field holds a suggestion rather than the user's own words
const fieldInput = field => field === 'title' ? titleInput : messageInput;
function pickPhrase(field, current) {
  if (typeof FAN_PHRASES === 'undefined') return null;
  const kind = field === 'title' ? 'titles' : 'lines', singer = singerSelect.value, own = singer === '공통' ? [] : FAN_PHRASES[singer]?.[kind] ?? [];
  const shared = FAN_PHRASES.공통[kind].filter(p => singer !== '공통' || !p.includes('{name}')).map(p => p.replaceAll('{name}', singer));
  const pool = [...own, ...own, ...shared].filter(p => p !== current);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
function fillSuggestion(fields) {
  let changed = false;
  for (const field of fields) {
    const input = fieldInput(field), next = pickPhrase(field, input.value); if (!next) continue;
    input.value = next; suggested[field] = changed = true;
  }
  if (!changed) return;
  stopPlayback(); preview.textContent = '미리보기';
  if (analysis) rebuild(); else redrawStill();
}
const autoFields = () => ['title', 'message'].filter(field => suggested[field] || !fieldInput(field).value.trim());
titleInput?.addEventListener('input', () => { suggested.title = false; });
messageInput?.addEventListener('input', () => { suggested.message = false; });
suggestButton?.addEventListener('click', () => fillSuggestion(['title', 'message']));
singerSelect?.addEventListener('change', () => {
  try { localStorage.setItem('pencil.singer', singerSelect.value); } catch {}
  fillSuggestion(['title', 'message'].filter(field => suggested[field])); // a new singer replaces only the suggestions
});
autoSuggest?.addEventListener('change', () => { try { localStorage.setItem('pencil.autoSuggest', autoSuggest.checked ? '1' : '0'); } catch {} });
try { // remember the singer and the auto-fill choice on this device
  const singer = localStorage.getItem('pencil.singer'), auto = localStorage.getItem('pencil.autoSuggest');
  if (singer && [...singerSelect.options].some(o => o.value === singer)) singerSelect.value = singer;
  if (auto !== null) autoSuggest.checked = auto === '1';
} catch {}
darkness.addEventListener('input', () => {
  inkDarkness = Number(darkness.value) / 100;
  if (!plan) return; // no re-analysis needed: just redraw the finished sketch with the new pressure
  stopPlayback(); preview.textContent = '미리보기'; resetInk(); renderFrame(plan.totalMs); drawFaceGuide();
});
volume.addEventListener('input', () => { sound.setVolume(Number(volume.value)); });
// Start fetching the models early so the first photo is quick.
loadFaceDetector().catch(() => {}); loadSegmenter().catch(() => {}); loadLandmarkers().catch(() => {}); loadObjectSegmenter().catch(() => {});
if (styleSelect.value === 'ai') loadLineArt().catch(() => {});
function scrollToCanvas() { // bring the whole canvas into view, with its top at the top of the screen
  // Wait a frame: the status line above the canvas changes length when playback starts, which moves the canvas.
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector('.canvas-wrap')?.scrollIntoView({ behavior:'smooth', block:'start' })));
}
preview.addEventListener('click', async () => {
  if (!plan) return;
  scrollToCanvas();
  if (session) { stopPlayback(); preview.textContent = '미리보기'; renderFrame(plan.totalMs); return; }
  preview.textContent = '정지'; status.textContent = '연필로 한 획씩 스케치하고 있습니다…';
  await play({ onDone:() => { preview.textContent = '미리보기'; status.textContent = '연필 스케치가 완성되었습니다.'; } });
});
// Recording formats, best first. MP4 (H.264 + AAC) opens almost everywhere; WebM is the long-standing browser format.
const RECORD_TYPES = {
  mp4:  { audio:['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'], silent:['video/mp4;codecs=avc1', 'video/mp4'] },
  webm: { audio:['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'], silent:['video/webm;codecs=vp9', 'video/webm'] },
};
const supportedType = (format, withAudio) => window.MediaRecorder && RECORD_TYPES[format][withAudio ? 'audio' : 'silent'].find(type => MediaRecorder.isTypeSupported(type));
for (const option of formatSelect.options) { // grey out a format this browser can neither build nor record
  if (!window.VideoEncoder && !supportedType(option.value, true) && !supportedType(option.value, false)) { option.disabled = true; option.textContent += ' — 이 브라우저 미지원'; }
}
if (formatSelect.selectedOptions[0]?.disabled) formatSelect.value = [...formatSelect.options].find(o => !o.disabled)?.value ?? 'webm';
const updateExportLabel = () => { exportButton.textContent = `${formatSelect.value.toUpperCase()} 영상 저장`; };
formatSelect.addEventListener('change', updateExportLabel); updateExportLabel();
function saveVideo(blob, ext, wanted) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  const d = new Date(), pad = v => String(v).padStart(2, '0'), stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  link.href = url; link.download = `pencil-sketch-${stamp}.${ext}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  const where = /Android/i.test(navigator.userAgent) ? ' 휴대폰의 "다운로드" 폴더(내 파일 → 다운로드)에 저장됩니다. 편집 앱에서 불러오세요.' : '';
  status.textContent = (ext === wanted ? `${ext.toUpperCase()} 영상 저장이 완료되었습니다.` : `이 브라우저는 ${wanted.toUpperCase()} 저장을 지원하지 않아 ${ext.toUpperCase()}로 저장했습니다.`) + where;
}

// The video is built frame by frame (WebCodecs) rather than recorded off the screen in real time. A recording on a phone
// can stutter, drop frames or end up with a length that editing apps misread (a 20s clip opened as 3s); a built file is
// always exactly as long as the drawing, every frame is there, and the pencil sound is rendered offline in sync.
const FPS = 30, VIDEO_BITRATE = 10_000_000, AUDIO_RATE = 48000;
const MUXERS = {
  mp4: { src:'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.min.js', global:'Mp4Muxer',
    video:[['avc1.640028', 'avc'], ['avc1.4d0028', 'avc'], ['avc1.42e028', 'avc'], ['avc1.42002a', 'avc']], audio:[['mp4a.40.2', 'aac'], ['opus', 'opus']] },
  webm: { src:'https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.min.js', global:'WebMMuxer',
    video:[['vp09.00.40.08', 'V_VP9'], ['vp8', 'V_VP8']], audio:[['opus', 'A_OPUS']] },
};
async function pickEncoders(format, withAudio) {
  if (!window.VideoEncoder || !window.VideoFrame || (withAudio && (!window.AudioEncoder || !window.OfflineAudioContext))) return null;
  const supported = async (Encoder, config) => { try { return (await Encoder.isConfigSupported(config)).supported; } catch { return false; } };
  let video = null, audio = null;
  for (const [codec, mux] of MUXERS[format].video) {
    const config = { codec, width:VIEW_W, height:VIEW_H, bitrate:VIDEO_BITRATE, framerate:FPS, ...(mux === 'avc' ? { avc:{ format:'avc' } } : {}) };
    if (await supported(VideoEncoder, config)) { video = { config, mux }; break; }
  }
  if (!video) return null;
  if (withAudio) {
    search: for (const [codec, mux] of MUXERS[format].audio) for (const numberOfChannels of [2, 1]) {
      const config = { codec, sampleRate:AUDIO_RATE, numberOfChannels, bitrate:128000 };
      if (await supported(AudioEncoder, config)) { audio = { config, mux }; break search; }
    }
    if (!audio) return null;
  }
  return { video, audio };
}
async function encodePencilAudio(config, seconds) {
  // The same pencil voice as the preview, rendered offline, then compressed into chunks kept for interleaving with the frames.
  const channels = config.numberOfChannels, oac = new OfflineAudioContext(channels, Math.ceil(seconds * AUDIO_RATE), AUDIO_RATE);
  scheduleStrokes(createPencilVoice(oac, oac.destination), plan.audio, 0);
  const buffer = await oac.startRendering(), chunks = []; let failure = null;
  const encoder = new AudioEncoder({ output:(chunk, meta) => chunks.push({ chunk, meta }), error:e => { failure = e; } });
  encoder.configure(config);
  for (let offset = 0, step = AUDIO_RATE / 10; offset < buffer.length; offset += step) {
    const length = Math.min(step, buffer.length - offset), data = new Float32Array(length * channels);
    for (let c = 0; c < channels; c++) data.set(buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1)).subarray(offset, offset + length), c * length);
    const audioData = new AudioData({ format:'f32-planar', sampleRate:AUDIO_RATE, numberOfFrames:length, numberOfChannels:channels, timestamp:Math.round(offset / AUDIO_RATE * 1e6), data });
    encoder.encode(audioData); audioData.close();
  }
  await encoder.flush(); encoder.close();
  if (failure) throw failure;
  return chunks;
}
const yieldToPage = () => new Promise(resolve => { const channel = new MessageChannel(); channel.port1.onmessage = () => resolve(); channel.port2.postMessage(0); }); // not throttled like setTimeout
async function buildVideo(format, encoders, onProgress) {
  const spec = MUXERS[format];
  if (!window[spec.global]) await withTimeout(loadScript(spec.src), 30000);
  const { Muxer, ArrayBufferTarget } = window[spec.global], { video, audio } = encoders;
  const frames = Math.ceil((plan.totalMs + 300) / 1000 * FPS), seconds = frames / FPS; // hold the finished drawing a moment at the end
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target, firstTimestampBehavior:'offset', ...(format === 'mp4' ? { fastStart:'in-memory' } : {}),
    video:{ codec:video.mux, width:VIEW_W, height:VIEW_H, frameRate:FPS },
    ...(audio ? { audio:{ codec:audio.mux, numberOfChannels:audio.config.numberOfChannels, sampleRate:AUDIO_RATE } } : {}),
  });
  const sounds = audio ? await encodePencilAudio(audio.config, seconds) : [];
  let nextSound = 0, failure = null;
  const addSoundUntil = time => { while (nextSound < sounds.length && sounds[nextSound].chunk.timestamp <= time) { const { chunk, meta } = sounds[nextSound++]; muxer.addAudioChunk(chunk, meta); } };
  const encoder = new VideoEncoder({ output:(chunk, meta) => { addSoundUntil(chunk.timestamp); muxer.addVideoChunk(chunk, meta); }, error:e => { failure = e; } });
  encoder.configure(video.config);
  resetInk();
  for (let i = 0; i < frames; i++) {
    if (failure) throw failure;
    renderFrame(Math.min(i * 1000 / FPS, plan.totalMs)); // frames in order: the ink builds up incrementally
    const frame = new VideoFrame(canvas, { timestamp:Math.round(i * 1e6 / FPS), duration:Math.round(1e6 / FPS) });
    encoder.encode(frame, { keyFrame:i % (FPS * 2) === 0 }); frame.close();
    while (encoder.encodeQueueSize > 4 && !failure) await new Promise(resolve => { encoder.addEventListener('dequeue', resolve, { once:true }); setTimeout(resolve, 30); });
    if (i % 3 === 0) { onProgress(i / frames); await yieldToPage(); }
  }
  await encoder.flush(); encoder.close();
  if (failure) throw failure;
  addSoundUntil(Infinity); muxer.finalize();
  return new Blob([target.buffer], { type:`video/${format}` });
}
async function recordRealtime(wanted, other) {
  // Fallback for browsers without WebCodecs: record the canvas while the drawing plays.
  const withAudio = soundToggle.checked && sound.ensure();
  const tracks = [...canvas.captureStream(30).getVideoTracks(), ...(withAudio ? sound.stream.stream.getAudioTracks() : [])];
  const mimeType = supportedType(wanted, withAudio) || supportedType(other, withAudio);
  const recorder = new MediaRecorder(new MediaStream(tracks), { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond:VIDEO_BITRATE }); // 1080×1920 needs a generous bitrate for crisp graphite
  const actual = (recorder.mimeType || mimeType || '').includes('mp4') ? 'mp4' : 'webm';
  const parts = []; recorder.ondataavailable = event => event.data.size && parts.push(event.data);
  const stopped = new Promise(resolve => { recorder.onstop = resolve; });
  status.textContent = `${actual.toUpperCase()} 영상을 녹화하고 있습니다… 녹화 중에는 이 탭을 계속 띄워 두세요.`;
  renderFrame(0); recorder.start();
  await play({ onDone:() => setTimeout(() => recorder.stop(), 250) });
  await stopped;
  saveVideo(new Blob(parts, { type:`video/${actual}` }), actual, wanted);
}
exportButton.addEventListener('click', async () => {
  if (!plan) return;
  scrollToCanvas();
  stopPlayback(); setBusy(true); preview.textContent = '미리보기';
  await ensureTitleFont(); // never put a first frame with fallback glyphs in the title
  if (handToggle?.checked) await handImage.decode().catch(() => {});
  const withAudio = soundToggle.checked, wanted = formatSelect.value, other = wanted === 'mp4' ? 'webm' : 'mp4';
  const token = session = {}; keepAwake(true); // `session` keeps still-preview redraws from touching the canvas mid-build
  try {
    let format = wanted, encoders = await pickEncoders(wanted, withAudio);
    if (!encoders) { format = other; encoders = await pickEncoders(other, withAudio); }
    if (encoders) {
      status.textContent = '영상을 한 장씩 만들고 있습니다… 잠시만 기다려 주세요.';
      const blob = await buildVideo(format, encoders, share => {
        const percent = Math.floor(share * 100); exportButton.textContent = `영상 만드는 중 ${percent}%`;
        exportButton.style.setProperty('--progress', `${percent}%`); // the save button fills up as frames are built
        status.textContent = `영상을 한 장씩 만들고 있습니다… ${percent}%`;
      });
      saveVideo(blob, format, wanted);
    } else if (window.MediaRecorder) {
      session = null; await recordRealtime(wanted, other);
    } else status.textContent = '이 브라우저는 영상 저장을 지원하지 않습니다. 크롬에서 열어 주세요.';
  } catch (error) {
    console.error(error); status.textContent = `영상을 만들지 못했습니다. 다시 시도해 주세요. (${error?.message ?? error})`;
  } finally {
    if (session === token) session = null;
    keepAwake(false); setBusy(false); updateExportLabel(); exportButton.style.removeProperty('--progress'); resetInk(); renderFrame(plan.totalMs);
  }
});
renderFrame(0);
