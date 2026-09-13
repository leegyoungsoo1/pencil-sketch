const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const photoInput = document.querySelector('#photo');
const seconds = document.querySelector('#seconds');
const strength = document.querySelector('#strength');
const styleSelect = document.querySelector('#style');
const darkness = document.querySelector('#darkness');
const formatSelect = document.querySelector('#format');
const soundToggle = document.querySelector('#sound');
const volume = document.querySelector('#volume');
const preview = document.querySelector('#preview');
const exportButton = document.querySelector('#export');
const status = document.querySelector('#status');
const fileName = document.querySelector('#fileName');
const W = canvas.width, H = canvas.height, PAD = 52;
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
  c.fillStyle = '#ded4c5'; c.fillRect(0, 0, W, H);
  const wash = c.createLinearGradient(0, 0, W, H); wash.addColorStop(0, '#f7f3e9'); wash.addColorStop(.55, '#fcfbf7'); wash.addColorStop(1, '#eee7d9');
  c.fillStyle = wash; c.fillRect(25, 25, W - 50, H - 50);
  const img = c.getImageData(0, 0, W, H), d = img.data;
  for (let y = 25; y < H - 25; y++) for (let x = 25; x < W - 25; x++) {
    const shade = (tooth.field[(y % tooth.size) * tooth.size + x % tooth.size] - .5) * 9, p = (y * W + x) * 4;
    d[p] += shade; d[p + 1] += shade; d[p + 2] += shade;
  }
  c.putImageData(img, 0, 0);
  return layer;
})();
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
  return { b, gw, gh, n, work, rgba, soft:blur(lum, gw, gh, 2), softValue:blur(value, gw, gh, 2), crop:src, b1:blur(lum, gw, gh, 1), b2:blur(lum, gw, gh, 2), b4:blur(lum, gw, gh, 4) };
}
function chooseCrop(img, base, face) {
  // Frame the portrait: the face takes about a third of the drawing's height, hair and shoulders fill the rest.
  if (face.source !== 'ai') return null;
  const natW = img.naturalWidth, natH = img.naturalHeight, s = natW / base.gw, aspect = (W - PAD * 2) / (H - PAD * 2);
  const boxH = face.ry / .62 * s, top = (face.y - face.ry / .62 * .42) * s, cx = face.x * s;
  const h = Math.min(boxH / .3, natH, natW / aspect), w = h * aspect;
  if (w > natW * .92 && h > natH * .92) return null;
  return { x:clamp(cx - w / 2, 0, natW - w), y:clamp(top - h * .2, 0, natH - h), w, h };
}
async function analyzePhoto(img) {
  let base = prepare(img), face = await detectFace(base);
  const crop = chooseCrop(img, base, face);
  if (crop) {
    const zoomed = prepare(img, crop), refound = await detectFace(zoomed), s0 = img.naturalWidth / base.gw, k = zoomed.gw / crop.w;
    // If the detector misses on the zoomed crop, carry the original face over into crop coordinates.
    const toCrop = p => ({ x:(p.x * s0 - crop.x) * k, y:(p.y * s0 - crop.y) * k });
    face = refound.source === 'ai' ? refound : { ...face, ...toCrop(face), rx:face.rx * s0 * k, ry:face.ry * s0 * k, eyes:face.eyes?.map(toCrop) ?? null };
    base = zoomed;
  }
  [base.person, base.marks] = await Promise.all([segmentPerson(base), detectLandmarks(base)]);
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
    paintPolygon(zone, gw, gh, convexHull([0, 1, 2, 5, 9, 13, 17].map(i => hand[i])), Z.HAND, palm * .25);
    for (const c of marks.bones) paintCapsule(zone, gw, gh, hand[c.start], hand[c.end], palm * .2, Z.HAND);
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
  const nf = Math.max(4, highEnd(faceSample)), nh = Math.max(4, highEnd(handSample) * .7), nb = Math.max(4, percentile(bodyDog, .985));
  const line = new Float32Array(n);
  for (let i = 0; i < n; i++) line[i] = clamp(lerp(bodyDog[i] / nb, faceDog[i] / (faceW[i] >= handW[i] ? nf : nh), detail[i]));

  // Structure tensor: a smooth stroke direction (along contours and hair strands) plus how coherent it is.
  const gx = new Float32Array(n), gy = new Float32Array(n);
  const at = (f, x, y) => f[clamp(y, 0, gh - 1) * gw + clamp(x, 0, gw - 1)];
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x, f = detail[i] > .5 ? b1 : b2;
    gx[i] = (at(f, x + 1, y - 1) + 2 * at(f, x + 1, y) + at(f, x + 1, y + 1)) - (at(f, x - 1, y - 1) + 2 * at(f, x - 1, y) + at(f, x - 1, y + 1));
    gy[i] = (at(f, x - 1, y + 1) + 2 * at(f, x, y + 1) + at(f, x + 1, y + 1)) - (at(f, x - 1, y - 1) + 2 * at(f, x, y - 1) + at(f, x + 1, y - 1));
  }
  const jxx = new Float32Array(n), jyy = new Float32Array(n), jxy = new Float32Array(n);
  for (let i = 0; i < n; i++) { jxx[i] = gx[i] * gx[i]; jyy[i] = gy[i] * gy[i]; jxy[i] = gx[i] * gy[i]; }
  const silhouette = new Float32Array(n);
  if (base.person) {
    // Silhouette: the edge of the person mask becomes a line too, so the figure always has a clear outer contour
    // even where hair or clothing melts into a dark background. Its direction is fed into the stroke-direction field.
    for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
      const i = y * gw + x, p = base.person;
      const mx = (p[i + 1] - p[i - 1]) / 2, my = (p[i + gw] - p[i - gw]) / 2;
      const sil = clamp(1 - Math.abs(p[i] - .5) * 4) * clamp(Math.hypot(mx, my) * 12);
      if (sil <= 0) continue;
      line[i] = Math.max(line[i], sil * .7); silhouette[i] = sil;
      jxx[i] += (mx * 3000) ** 2 * sil; jyy[i] += (my * 3000) ** 2 * sil; jxy[i] += mx * my * 9e6 * sil;
    }
  }
  const sxx = blur(jxx, gw, gh, 3), syy = blur(jyy, gw, gh, 3), sxy = blur(jxy, gw, gh, 3), ang = new Float32Array(n), coh = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const energy = sxx[i] + syy[i];
    ang[i] = .5 * Math.atan2(2 * sxy[i], sxx[i] - syy[i]) + Math.PI / 2;
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
  const hairRaw = new Float32Array(n), { rgba } = base;
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
  return A;
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
function faceFromBox(x, y, w, h, source, eyes = null) {
  // The detector box runs roughly brow-to-chin; widen it upward to include forehead and hairline.
  return { x:x + w / 2, y:y + h * .42, rx:w * .56, ry:h * .62, source, eyes };
}
const shiftFace = (face, next) => ({ ...next, eyes:face.eyes?.map(e => ({ x:e.x + next.x - face.x, y:e.y + next.y - face.y })) ?? null });
async function detectFace(base) {
  const guess = () => { const f = findFace(base.rgba, base.gw, base.gh); return { ...f, rx:Math.min(f.rx, base.gw * .3), ry:Math.min(f.ry, base.gh * .3) }; };
  try {
    const detector = await withTimeout(loadFaceDetector(), 25000);
    const best = detector.detect(base.work).detections.filter(d => d.boundingBox)
      .map(d => ({ box:d.boundingBox, keypoints:d.keypoints ?? [], score:d.boundingBox.width * d.boundingBox.height * (d.categories?.[0]?.score ?? 1) }))
      .sort((a, z) => z.score - a.score)[0];
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
      if (tx * dx + ty * dy < .8) break; // a sharp corner ends the stroke, like lifting the pencil
      dx = dx * .55 + tx * .45; dy = dy * .55 + ty * .45; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      x = nx; y = ny; pts.push({ x, y });
    }
    return pts;
  };
  const strokes = []; let id = 0;
  for (const seed of seeds) {
    if (owner[seed]) continue;
    id++;
    const sx = seed % gw, sy = (seed / gw) | 0;
    const pts = walk(sx, sy, ang[seed] + Math.PI, id).reverse().concat([{ x:sx, y:sy }], walk(sx, sy, ang[seed], id));
    const len = (pts.length - 1) * STEP, fine = detail[seed] > .5;
    if (len < (fine ? 6 : head[seed] ? 16 : 20)) continue; // short marks outside the face and hands read as fur
    const radius = fine ? 2 : 3, zones = new Float32Array(8); let sum = 0, faceSum = 0, handSum = 0, subjectSum = 0, headSum = 0, eyeSum = 0;
    for (const p of pts) {
      const px = Math.round(p.x), py = Math.round(p.y), i = py * gw + px; sum += line[i]; faceSum += faceW[i]; handSum += handW[i]; subjectSum += subject[i]; headSum += head[i]; eyeSum += eyeW[i];
      for (let k = 0; k < 8; k++) if (zone[i] & (1 << k)) zones[k]++;
      for (let v = -radius; v <= radius; v++) for (let u = -radius; u <= radius; u++) {
        const j = (py + v) * gw + px + u; if (j >= 0 && j < owner.length && !owner[j]) owner[j] = id;
      }
    }
    if (subjectSum / pts.length < .5) continue; // background lines are never drawn
    const m = pts.length, hand = handSum / m;
    strokes.push({ raw:pts, len, strength:clamp(sum / m), face:faceSum / m, hand, head:headSum / m > .5 && hand < .5, eye:eyeSum / m, zones:Array.from(zones, c => c / m), meshed:!!A.marks?.mesh });
  }
  return strokes;
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
      if (onLine && clean && shade[i] > thr * (fw > .5 ? .75 : 1) + (hash(x >> 3, y >> 3, 9) - .5) * .08) {
        if (!run) run = { s0:s, shade:0, face:0, hand:0, head:0, n:0 };
        run.s1 = s; run.shade += shade[i]; run.face += fw; run.hand += handW[i]; run.head += head[i]; run.n++;
      } else emit();
    }
    emit();
  }
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
  let worst = 0, index = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((z.x - a.x) * (a.y - pts[i].y) - (a.x - pts[i].x) * (z.y - a.y)) / len; if (d > worst) { worst = d; index = i; } }
  return worst > tol ? simplify(pts.slice(0, index + 1), tol).slice(0, -1).concat(simplify(pts.slice(index), tol)) : [a, z];
}
function finalizeStroke(s, rand, ox, oy) {
  const pts = resample(chaikin(s.raw), 2).map(p => ({ x:p.x + ox, y:p.y + oy }));
  const n = pts.length; if (n < 2) return null;
  const x = new Float32Array(n), y = new Float32Array(n), pr = new Float32Array(n);
  const wobble = { hatch:.08, fill:.15 }[s.kind] ?? .55, freq = 1 + rand() * 2.5, phase = rand() * 6.28;
  let len = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const u = i / (n - 1), off = Math.sin(u * Math.PI * freq + phase) * wobble;
    x[i] = pts[i].x - (b.y - a.y) / l * off; y[i] = pts[i].y + (b.x - a.x) / l * off;
    // Pressure: shading strokes are even with soft ends; contours land softly and flick off.
    const taper = { hatch:Math.min(1, u / .15, (1 - u) / .35), fill:Math.min(1, u / .06, (1 - u) / .12) }[s.kind] ?? Math.min(1, u / .12, (1 - u) / .2);
    pr[i] = (s.kind === 'hatch' ? .4 : .22) + (s.kind === 'hatch' ? .6 : .78) * Math.pow(clamp(taper), .7);
    if (i) len += Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
  }
  return { ...s, x, y, pr, n, len };
}
function styleStroke(s) {
  const str = s.strength ?? .5;
  if (s.kind === 'construct') { s.width = 1.1; s.alpha = .24; s.ghost = 0; }
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
function buildPlan(A, durationSec, densityPercent, style = 'shade') {
  const density = densityPercent / 100, rand = random(1234), { b, face } = A;
  const totalMs = durationSec * 1000, leadMs = 380, outroMs = Math.min(1200, totalMs * .07);
  const drawMs = totalMs - leadMs - outroMs;
  const capacity = (drawMs / 1000) * SPEED;
  const cost = s => strokeCost(s.kind, s.len);
  const prep = (list, kind) => list.map(s => finalizeStroke(kind ? { ...s, kind } : s, rand, b.x, b.y)).filter(Boolean);

  const contours = prep(A.contours, 'contour'), fills = prep(A.fills);
  const priority = s => s.strength * (.45 + Math.min(1.4, s.len / 70));
  const group = s => s.hand > .5 ? 'hand' : s.face > .5 || s.head ? 'head' : 'body';
  const pool = (list, name) => list.filter(s => group(s) === name).sort((a, z) => priority(z) - priority(a));
  const headContours = pool(contours, 'head'), handContours = pool(contours, 'hand'), bodyContours = pool(contours, 'body');

  let carry = 0; const stats = {};
  const take = (pool, share, name) => {
    let budget = capacity * share + carry, used = 0; const picked = [];
    for (const s of pool) { const c = cost(s); if (used + c <= budget) { picked.push(s); used += c; } }
    carry = Math.max(0, budget - used); stats[name] = `${picked.length}/${pool.length}`; return picked;
  };
  // Construction lines: a few long, faint, straightened lines that block in the figure first.
  const constructBudget = capacity * .06; let constructUsed = 0; const construct = [];
  for (const s of A.contours.slice().sort((a, z) => z.len - a.len)) {
    if (s.len < 40) break;
    if (s.face > .3 || s.hand > .3) continue; // guide lines block in hair, shoulders and body — never across the face or hands
    // A searching line: the same curve, loosened, drawn a couple of pixels to one side and overshooting its ends.
    const loose = simplify(s.raw, 1.6), a = loose[0], z = loose[loose.length - 1];
    const ext = (p, q) => { const l = Math.hypot(p.x - q.x, p.y - q.y) || 1, e = 6 + rand() * 8; return { x:p.x + (p.x - q.x) / l * e, y:p.y + (p.y - q.y) / l * e }; };
    const ax = z.x - a.x, ay = z.y - a.y, al = Math.hypot(ax, ay) || 1, side = (rand() < .5 ? -1 : 1) * (1.5 + rand() * 1.8);
    const raw = [ext(a, loose[1]), ...loose.slice(1, -1), ext(z, loose[loose.length - 2])].map(p => ({ x:p.x - ay / al * side + (rand() - .5), y:p.y + ax / al * side + (rand() - .5) }));
    const c = finalizeStroke({ raw, kind:'construct', face:s.face, strength:s.strength }, rand, b.x, b.y);
    if (!c || constructUsed + cost(c) > constructBudget) continue;
    construct.push(c); constructUsed += cost(c);
  }
  // Shares of the time budget. Lines always come first; shading only gets what the "선 + 그림자" style allows.
  const shaded = style === 'shade';
  const hatches = shaded ? prep([...makeShading(A, density, rand), ...makeHairStrands(A, density, rand)]).sort((a, z) => z.shade - a.shade) : [];
  const headC = take(headContours, shaded ? .28 : .40, 'headContour');
  const headF = take(fills, .08, 'fill');
  const accents = [];
  let accentBudget = capacity * .03 + carry;
  for (const s of headC.filter(c => c.face > .5).sort((a, z) => z.strength - a.strength).slice(0, Math.ceil(headC.length * .08))) {
    const c = { ...s, kind:'accent', x:s.x.map(v => v + (rand() - .5) * .8), y:s.y.map(v => v + (rand() - .5) * .8), pr:s.pr.slice() };
    if (cost(c) <= accentBudget) { accents.push(c); accentBudget -= cost(c); }
  }
  carry = accentBudget;
  const headH = take(hatches.filter(s => group(s) === 'head'), .10, 'headHatch');
  const handC = take(handContours, shaded ? .10 : .15, 'handContour');
  const handH = take(hatches.filter(s => group(s) === 'hand'), .03, 'handHatch');
  const bodyC = take(bodyContours, shaded ? .20 : .30, 'bodyContour');
  const bodyH = take(hatches.filter(s => group(s) === 'body'), .14, 'bodyHatch');

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
  const entry = { x:W + 40, y:H * .78 }; let t = 0, px = entry.x, py = entry.y;
  for (const s of strokes) {
    const d = Math.hypot(s.x[0] - px, s.y[0] - py);
    s.tLift = t; t += s.chain ? 8 + d * .1 : KIND[s.kind].lift + d * .09;
    s.tDown = t; t += s.len / KIND[s.kind].speed; s.tUp = t;
    px = s.x[s.n - 1]; py = s.y[s.n - 1];
  }
  const scale = strokes.length ? drawMs / t : 0;
  for (const s of strokes) { s.tLift = s.tLift * scale + (s === strokes[0] ? 0 : leadMs); s.tDown = s.tDown * scale + leadMs; s.tUp = s.tUp * scale + leadMs; }
  const drawEndMs = leadMs + drawMs, faceEndMs = faceEndIndex && strokes[faceEndIndex - 1] ? strokes[faceEndIndex - 1].tUp : 0;

  return { strokes, totalMs, drawEndMs, exitMs:Math.min(700, outroMs * .75), entry, exit:{ x:W + 60, y:H * .9 }, faceEndMs, outside:A.outside, stats, audio:buildAudioEvents(strokes) };
}

// ───────────────────────── rendering ─────────────────────────
let cursor = { stroke:0, point:0, time:-1 };
function resetInk() { inkCtx.clearRect(0, 0, W, H); cursor = { stroke:0, point:0, time:-1 }; }
let inkDarkness = Number(darkness.value) / 100; // "선 진하기": scales every stroke's graphite
function drawSegment(s, i) {
  const p = (s.pr[i] + s.pr[i + 1]) / 2, a = s.alpha * p * inkDarkness;
  // Once a stroke is fully opaque, extra darkness presses harder: the line gets broader instead.
  const press = a > 1 ? Math.min(1.8, 1 + (a - 1) * .6) : 1;
  inkCtx.globalAlpha = Math.min(1, a); inkCtx.lineWidth = s.width * (.45 + .55 * p) * press;
  inkCtx.beginPath(); inkCtx.moveTo(s.x[i], s.y[i]); inkCtx.lineTo(s.x[i + 1], s.y[i + 1]); inkCtx.stroke();
  if (s.ghost) { // a second, fainter graphite edge makes the line look drawn rather than vector-perfect
    const dx = s.x[i + 1] - s.x[i], dy = s.y[i + 1] - s.y[i], l = Math.hypot(dx, dy) || 1, o = .55;
    inkCtx.globalAlpha = Math.min(1, a * s.ghost); inkCtx.lineWidth = s.width * .55 * press;
    inkCtx.beginPath(); inkCtx.moveTo(s.x[i] - dy / l * o, s.y[i] + dx / l * o); inkCtx.lineTo(s.x[i + 1] - dy / l * o, s.y[i + 1] + dx / l * o); inkCtx.stroke();
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
  while (cursor.stroke < list.length) {
    const s = list[cursor.stroke];
    if (t < s.tDown) break;
    const done = t >= s.tUp, target = done ? s.n - 1 : Math.floor(strokeProgress(s, t));
    while (cursor.point < target) { drawSegment(s, cursor.point++); drew = true; }
    if (!done) break;
    cursor.stroke++; cursor.point = 0;
  }
  if (drew) { // graphite never survives outside the figure's silhouette
    inkCtx.save(); inkCtx.globalCompositeOperation = 'destination-out'; inkCtx.globalAlpha = 1; inkCtx.drawImage(plan.outside, 0, 0); inkCtx.restore();
  }
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
  ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.drawImage(paperCanvas, 0, 0);
  if (!plan) return;
  advanceInk(t); ctx.drawImage(ink, 0, 0);
  const pen = pencilAt(t); if (pen) drawPencil(pen);
}

// ───────────────────────── pencil sound ─────────────────────────
function buildAudioEvents(strokes) {
  // One audible "쓱" per gesture: quick strokes are grouped into ~150ms swishes,
  // and every swish is followed by a short silence so the sound never smears into a hiss.
  const level = { construct:.4, contour:.9, accent:1, fill:.7, hatch:.75 };
  const merged = []; let cur = null;
  for (const s of strokes) {
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
  env.gain.value = 0; out.gain.value = volumeGain(Number(volume?.value ?? 30));
  src.connect(filter('highpass', 700, .7)).connect(filter('lowpass', 5500, .6)).connect(color).connect(env).connect(out).connect(destination);
  src.start();
  return { env, color, out };
}
function scheduleStrokes(voice, events, startAt) {
  const g = voice.env.gain;
  for (const e of events) {
    const a = startAt + e.start / 1000, z = startAt + e.end / 1000, attack = Math.min(.04, (z - a) * .35);
    voice.color.frequency.setValueAtTime(e.freq, a);
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
function stopPlayback() { cancelAnimationFrame(raf); sound.silence(); session = null; }
async function play({ onDone }) {
  stopPlayback(); resetInk();
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
    if (t < plan.totalMs) raf = requestAnimationFrame(tick); else { session = null; onDone(); }
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
  ctx.save(); ctx.setLineDash([9, 7]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(214,120,40,.9)';
  ctx.beginPath(); ctx.ellipse(g.x, g.y, g.rx, g.ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
function rebuild() {
  if (!analysis) return;
  plan = buildPlan(analysis, Number(seconds.value), Number(strength.value), styleSelect.value);
  resetInk(); renderFrame(plan.totalMs); drawFaceGuide();
  const faceAt = plan.faceEndMs ? ` 얼굴은 ${(plan.faceEndMs / 1000).toFixed(1)}초에 완성됩니다.` : '';
  const hands = analysis.marks?.hands?.length ?? 0, detailNote = analysis.marks?.mesh ? ` 이목구비${hands ? `와 손 ${hands}개` : ''}를 세밀하게 그립니다.` : '';
  status.textContent = `${FACE_NOTE[analysis.face.source] ?? ''}${detailNote} ${plan.strokes.length.toLocaleString()}개의 연필 획으로 계획했습니다.${faceAt} 주황 점선이 얼굴 위치입니다. 틀리면 얼굴을 클릭하거나 얼굴 둘레를 드래그하세요.`;
}
function setBusy(busy) {
  preview.disabled = busy; exportButton.disabled = busy; photoInput.disabled = busy; seconds.disabled = busy; styleSelect.disabled = busy; darkness.disabled = busy; formatSelect.disabled = busy;
  strength.disabled = busy || styleSelect.value !== 'shade'; // shadow amount only matters when shading is drawn
}
let loadToken = 0;
photoInput.addEventListener('change', event => {
  const file = event.target.files[0]; if (!file) return; const image = new Image(), token = ++loadToken;
  image.onload = async () => {
    stopPlayback(); source = image; analysis = null; plan = null; renderFrame(0); fileName.textContent = file.name;
    status.textContent = detectorReady ? '사진에서 얼굴과 인물을 찾고 있습니다…' : '얼굴 인식 AI를 불러오는 중입니다… (처음 한 번만 조금 걸립니다)';
    await new Promise(resolve => setTimeout(resolve, 30));
    const result = await analyzePhoto(image);
    if (token !== loadToken) return;
    analysis = result; rebuild();
  };
  image.src = URL.createObjectURL(file);
});
// Face correction: click moves the face centre, dragging draws a new face region.
let drag = null;
const canvasPoint = event => { const r = canvas.getBoundingClientRect(); return { x:(event.clientX - r.left) * W / r.width, y:(event.clientY - r.top) * H / r.height }; };
const dragBox = (a, z) => ({ x:(a.x + z.x) / 2, y:(a.y + z.y) / 2, rx:Math.abs(z.x - a.x) / 2, ry:Math.abs(z.y - a.y) / 2 });
canvas.addEventListener('pointerdown', event => {
  if (!plan || session || exportButton.disabled) return;
  drag = canvasPoint(event); try { canvas.setPointerCapture(event.pointerId); } catch {}
});
canvas.addEventListener('pointermove', event => {
  if (!drag) return; const p = canvasPoint(event);
  if (Math.hypot(p.x - drag.x, p.y - drag.y) < 10) return;
  renderFrame(plan.totalMs); drawFaceGuide(dragBox(drag, p));
});
canvas.addEventListener('pointerup', event => {
  if (!drag) return; const start = drag, p = canvasPoint(event), { b, face } = analysis; drag = null;
  const box = Math.hypot(p.x - start.x, p.y - start.y) < 10 ? { x:p.x, y:p.y, rx:face.rx, ry:face.ry } : dragBox(start, p);
  const next = shiftFace(face, { x:clamp(box.x - b.x, 0, b.w), y:clamp(box.y - b.y, 0, b.h), rx:Math.max(18, box.rx), ry:Math.max(22, box.ry), source:'manual' });
  status.textContent = '지정한 얼굴 위치로 다시 분석하고 있습니다…';
  setTimeout(() => { analysis = analyzeFace(analysis, next); rebuild(); }, 20);
});
seconds.addEventListener('input', () => { document.querySelector('#secondsLabel').textContent = `${seconds.value}초`; stopPlayback(); preview.textContent = '미리보기'; rebuild(); });
strength.addEventListener('input', () => { document.querySelector('#strengthLabel').textContent = `${strength.value}%`; stopPlayback(); preview.textContent = '미리보기'; rebuild(); });
styleSelect.addEventListener('change', () => { stopPlayback(); preview.textContent = '미리보기'; setBusy(false); rebuild(); });
darkness.addEventListener('input', () => {
  document.querySelector('#darknessLabel').textContent = `${darkness.value}%`; inkDarkness = Number(darkness.value) / 100;
  if (!plan) return; // no re-analysis needed: just redraw the finished sketch with the new pressure
  stopPlayback(); preview.textContent = '미리보기'; resetInk(); renderFrame(plan.totalMs); drawFaceGuide();
});
volume.addEventListener('input', () => { document.querySelector('#volumeLabel').textContent = `${volume.value}%`; sound.setVolume(Number(volume.value)); });
loadFaceDetector().catch(() => {}); loadSegmenter().catch(() => {}); loadLandmarkers().catch(() => {}); // start fetching the models early so the first photo is quick
preview.addEventListener('click', async () => {
  if (!plan) return;
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
for (const option of formatSelect.options) { // grey out a format this browser cannot record
  if (!supportedType(option.value, true) && !supportedType(option.value, false)) { option.disabled = true; option.textContent += ' — 이 브라우저 미지원'; }
}
if (formatSelect.selectedOptions[0]?.disabled) formatSelect.value = [...formatSelect.options].find(o => !o.disabled)?.value ?? 'webm';
const updateExportLabel = () => { exportButton.textContent = `${formatSelect.value.toUpperCase()} 영상 저장`; };
formatSelect.addEventListener('change', updateExportLabel); updateExportLabel();
exportButton.addEventListener('click', async () => {
  if (!plan || !window.MediaRecorder) return;
  setBusy(true); preview.textContent = '미리보기';
  const withAudio = soundToggle.checked && sound.ensure(), wanted = formatSelect.value, other = wanted === 'mp4' ? 'webm' : 'mp4';
  const tracks = [...canvas.captureStream(30).getVideoTracks(), ...(withAudio ? sound.stream.stream.getAudioTracks() : [])];
  const mimeType = supportedType(wanted, withAudio) || supportedType(other, withAudio);
  const recorder = new MediaRecorder(new MediaStream(tracks), mimeType ? { mimeType } : {});
  const actual = (recorder.mimeType || mimeType || '').includes('mp4') ? 'mp4' : 'webm';
  const parts = []; recorder.ondataavailable = event => event.data.size && parts.push(event.data);
  recorder.onstop = () => {
    const url = URL.createObjectURL(new Blob(parts, { type:`video/${actual}` })), link = document.createElement('a');
    link.href = url; link.download = `pencil-sketch.${actual}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
    setBusy(false);
    status.textContent = actual === wanted ? `${actual.toUpperCase()} 영상 저장이 완료되었습니다.` : `이 브라우저는 ${wanted.toUpperCase()} 녹화를 지원하지 않아 ${actual.toUpperCase()}로 저장했습니다.`;
  };
  status.textContent = `${actual.toUpperCase()} 영상을 녹화하고 있습니다… 녹화 중에는 이 탭을 계속 띄워 두세요.`;
  renderFrame(0); recorder.start(250);
  await play({ onDone:() => setTimeout(() => recorder.stop(), 250) });
});
renderFrame(0);
