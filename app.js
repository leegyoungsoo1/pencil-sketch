const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const photoInput = document.querySelector('#photo');
const seconds = document.querySelector('#seconds');
const strength = document.querySelector('#strength');
const soundToggle = document.querySelector('#sound');
const preview = document.querySelector('#preview');
const exportButton = document.querySelector('#export');
const status = document.querySelector('#status');
const fileName = document.querySelector('#fileName');
const W = canvas.width, H = canvas.height;
// Timeline budget in "pixel-equivalents" per second: how much pencil travel fits in one second of video.
const SPEED = 2800;
const KIND = {
  construct: { speed:1.9, lift:26 },
  contour:   { speed:1.0, lift:30 },
  hatch:     { speed:1.6, lift:26 },
  accent:    { speed:0.9, lift:34 },
};
let source = null, analysis = null, plan = null, raf = 0, session = null;

// ───────────────────────── utilities ─────────────────────────
function clamp(value, low = 0, high = 1) { return Math.max(low, Math.min(high, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function random(seed) { // mulberry32: the same photo always produces the same drawing (preview == export)
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function fitImage(img) {
  const pad = 52, maxW = W - pad * 2, maxH = H - pad * 2;
  const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  return { x:Math.round((W - w) / 2), y:Math.round((H - h) / 2), w, h };
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
function hash(a, b, c) { let h = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2147483647) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; }
function percentile(values, p, step = 7) {
  const sample = []; for (let i = 0; i < values.length; i += step) sample.push(values[i]);
  sample.sort((a, b) => a - b); return sample[Math.floor(clamp(p) * (sample.length - 1))];
}

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
const graphite = (() => {
  const tile = document.createElement('canvas'); tile.width = tile.height = tooth.size;
  const c = tile.getContext('2d'), img = c.createImageData(tooth.size, tooth.size), rand = random(11);
  for (let i = 0; i < tooth.field.length; i++) {
    const p = i * 4; img.data[p] = 36; img.data[p + 1] = 34; img.data[p + 2] = 38;
    img.data[p + 3] = 255 * clamp(.18 + tooth.field[i] * .95 + (rand() - .5) * .3);
  }
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
function prepare(img) { // face-independent work, done once per photo
  const b = fitImage(img), gw = b.w, gh = b.h, n = gw * gh;
  const work = document.createElement('canvas'); work.width = gw; work.height = gh;
  const wctx = work.getContext('2d', { willReadFrequently:true });
  wctx.fillStyle = '#fff'; wctx.fillRect(0, 0, gw, gh); wctx.drawImage(img, 0, 0, gw, gh);
  const rgba = wctx.getImageData(0, 0, gw, gh).data, lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = rgba[i * 4] * .299 + rgba[i * 4 + 1] * .587 + rgba[i * 4 + 2] * .114;
  const soft = blur(lum, gw, gh, 3), lo = percentile(lum, .03), hi = percentile(lum, .97), tone = new Float32Array(n);
  for (let i = 0; i < n; i++) tone[i] = Math.pow(clamp((hi - soft[i]) / Math.max(1, hi - lo)), 1.25);
  return { b, gw, gh, n, work, rgba, tone, fine:blur(lum, gw, gh, 1), coarse:blur(lum, gw, gh, 2) };
}
function analyzeFace(base, face) { // everything that depends on where the face is; re-run when the user corrects it
  const { b, gw, gh, n, work, rgba, tone, fine, coarse } = base;
  const faceW = new Float32Array(n), far = new Float32Array(n);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const d = Math.hypot((x - face.x) / face.rx, (y - face.y) / face.ry);
    faceW[y * gw + x] = clamp(1 - (d - 1) / .45);
    // Detail fades away from the subject, but the body below the face stays important.
    const below = y > face.y ? .55 : 1;
    far[y * gw + x] = clamp((Math.hypot((x - face.x) / (face.rx * 2.6), (y - face.y) / (face.ry * 4 / below)) - .6) / 1.2);
  }

  // Gradients: fine detail inside the face, calmer long contours elsewhere.
  const gx = new Float32Array(n), gy = new Float32Array(n), mag = new Float32Array(n);
  const at = (f, x, y) => f[clamp(y, 0, gh - 1) * gw + clamp(x, 0, gw - 1)];
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x, t = faceW[i];
    const sob = f => [
      (at(f, x + 1, y - 1) + 2 * at(f, x + 1, y) + at(f, x + 1, y + 1)) - (at(f, x - 1, y - 1) + 2 * at(f, x - 1, y) + at(f, x - 1, y + 1)),
      (at(f, x - 1, y + 1) + 2 * at(f, x, y + 1) + at(f, x + 1, y + 1)) - (at(f, x - 1, y - 1) + 2 * at(f, x, y - 1) + at(f, x + 1, y - 1)),
    ];
    const [cx, cy] = sob(coarse), [fx, fy] = t > 0 ? sob(fine) : [cx, cy];
    gx[i] = lerp(cx, fx, t); gy[i] = lerp(cy, fy, t); mag[i] = Math.hypot(gx[i], gy[i]);
  }
  const norm = percentile(mag, .975) || 1;
  for (let i = 0; i < n; i++) mag[i] = clamp(mag[i] / norm);
  // Structure tensor gives a smooth stroke direction that follows the contour instead of pixel noise.
  const jxx = new Float32Array(n), jyy = new Float32Array(n), jxy = new Float32Array(n);
  for (let i = 0; i < n; i++) { jxx[i] = gx[i] * gx[i]; jyy[i] = gy[i] * gy[i]; jxy[i] = gx[i] * gy[i]; }
  const sxx = blur(jxx, gw, gh, 2), syy = blur(jyy, gw, gh, 2), sxy = blur(jxy, gw, gh, 2), ang = new Float32Array(n);
  for (let i = 0; i < n; i++) ang[i] = .5 * Math.atan2(2 * sxy[i], sxx[i] - syy[i]) + Math.PI / 2;

  const A = { b, gw, gh, n, work, rgba, tone, fine, coarse, mag, ang, faceW, far, face };
  A.contours = traceContours(A);
  return A;
}
// Face detection: MediaPipe's BlazeFace model (loaded once from the CDN); the colour heuristic is only a fallback.
const MEDIAPIPE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
let detectorPromise = null, detectorReady = false;
function loadFaceDetector() {
  detectorPromise ??= (async () => {
    const { FilesetResolver, FaceDetector } = await import(`${MEDIAPIPE}/vision_bundle.mjs`);
    const files = await FilesetResolver.forVisionTasks(`${MEDIAPIPE}/wasm`);
    const detector = await FaceDetector.createFromOptions(files, { baseOptions:{ modelAssetPath:FACE_MODEL, delegate:'CPU' }, runningMode:'IMAGE', minDetectionConfidence:.45 });
    detectorReady = true; return detector;
  })().catch(error => { detectorPromise = null; throw error; });
  return detectorPromise;
}
function faceFromBox(x, y, w, h, source) {
  // The detector box runs roughly brow-to-chin; widen it upward to include forehead and hairline.
  return { x:x + w / 2, y:y + h * .42, rx:w * .56, ry:h * .62, source };
}
async function detectFace(base) {
  const guess = () => { const f = findFace(base.rgba, base.gw, base.gh); return { ...f, rx:Math.min(f.rx, base.gw * .3), ry:Math.min(f.ry, base.gh * .3) }; };
  try {
    const detector = await Promise.race([loadFaceDetector(), new Promise((_, fail) => setTimeout(() => fail(new Error('timeout')), 25000))]);
    const best = detector.detect(base.work).detections.filter(d => d.boundingBox)
      .map(d => ({ box:d.boundingBox, score:d.boundingBox.width * d.boundingBox.height * (d.categories?.[0]?.score ?? 1) }))
      .sort((a, z) => z.score - a.score)[0];
    return best ? faceFromBox(best.box.originX, best.box.originY, best.box.width, best.box.height, 'ai') : { ...guess(), source:'none' };
  } catch (error) {
    console.warn('Face detector unavailable:', error);
    return { ...guess(), source:'offline' };
  }
}
function traceContours(A) {
  const { gw, gh, mag, ang, faceW, far } = A, owner = new Int32Array(gw * gh), STEP = 2;
  const high = i => .30 * (1 - .42 * faceW[i]) * (1 + .7 * far[i]);
  const low = i => .12 * (1 - .45 * faceW[i]) * (1 + .7 * far[i]);
  const seeds = [];
  for (let y = 3; y < gh - 3; y += 2) for (let x = 3; x < gw - 3; x += 2) { const i = y * gw + x; if (mag[i] > high(i)) seeds.push(i); }
  seeds.sort((a, z) => mag[z] - mag[a]);
  const walk = (x, y, angle, id) => {
    const pts = []; let dx = Math.cos(angle), dy = Math.sin(angle);
    for (let k = 0; k < 110; k++) {
      let nx = x + dx * STEP, ny = y + dy * STEP;
      if (nx < 3 || ny < 3 || nx > gw - 4 || ny > gh - 4) break;
      // Stay on the ridge of the edge: nudge sideways toward the stronger response.
      const px = -dy, py = dx, idx = (u, v) => Math.round(v) * gw + Math.round(u);
      let bestM = mag[idx(nx, ny)], shift = 0;
      for (const o of [-1, 1]) { const m = mag[idx(nx + px * o, ny + py * o)]; if (m > bestM) { bestM = m; shift = o; } }
      nx += px * shift * .7; ny += py * shift * .7;
      const i = idx(nx, ny);
      if (mag[i] < low(i) || (owner[i] && owner[i] !== id)) break;
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
    const len = (pts.length - 1) * STEP, fw = faceW[seed];
    if (len < lerp(18, 7, fw)) continue;
    const radius = fw > .5 ? 2 : 3; let sum = 0, faceSum = 0;
    for (const p of pts) {
      const px = Math.round(p.x), py = Math.round(p.y), i = py * gw + px; sum += mag[i]; faceSum += faceW[i];
      for (let v = -radius; v <= radius; v++) for (let u = -radius; u <= radius; u++) {
        const j = (py + v) * gw + px + u; if (j >= 0 && j < owner.length && !owner[j]) owner[j] = id;
      }
    }
    strokes.push({ raw:pts, len, strength:clamp(sum / pts.length), face:faceSum / pts.length });
  }
  return strokes;
}
function makeHatching(A, density, rand) {
  const { gw, gh, tone, faceW, far, mag } = A, out = [], SPACING = 4.2;
  const layers = [
    { angle:-1.02, thr:.56 - density * .16 },
    { angle:.20, thr:.88 - density * .12 }, // cross-hatching only in the darkest passages
  ];
  layers.forEach((layer, layerIndex) => {
    const dx = Math.cos(layer.angle), dy = Math.sin(layer.angle), nx = -dy, ny = dx;
    const corners = [[0, 0], [gw, 0], [0, gh], [gw, gh]];
    const offs = corners.map(([x, y]) => x * nx + y * ny), alongs = corners.map(([x, y]) => x * dx + y * dy);
    const minA = Math.min(...alongs), maxA = Math.max(...alongs);
    for (let k = Math.floor(Math.min(...offs) / SPACING); k <= Math.max(...offs) / SPACING; k++) {
      const o = k * SPACING + (rand() - .5) * 1.4; let run = null;
      const emit = () => {
        if (!run) return; const total = run.s1 - run.s0, fw = run.face / run.n;
        if (total < 6) return;
        const maxPiece = lerp(40, 24, fw);
        for (let s = run.s0; s < run.s1 - 4;) {
          const piece = Math.min(run.s1 - s, maxPiece * (.6 + rand() * .4)), e = s + piece;
          const j = () => (rand() - .5) * 1.6, bow = (rand() - .5) * 2.4;
          let p0 = { x:dx * (s + j()) + nx * (o + j() * .5), y:dy * (s + j()) + ny * (o + j() * .5) };
          let p2 = { x:dx * (e + j()) + nx * (o + j() * .5), y:dy * (e + j()) + ny * (o + j() * .5) };
          // Each small patch gets its own slightly different angle, so hatching never reads as a printed mesh.
          const mx = (p0.x + p2.x) / 2, my = (p0.y + p2.y) / 2, turn = (hash(Math.floor(mx / 46), Math.floor(my / 46), layerIndex) - .5) * .42;
          const rot = p => ({ x:mx + (p.x - mx) * Math.cos(turn) - (p.y - my) * Math.sin(turn), y:my + (p.x - mx) * Math.sin(turn) + (p.y - my) * Math.cos(turn) });
          p0 = rot(p0); p2 = rot(p2);
          const p1 = { x:(p0.x + p2.x) / 2 + nx * bow, y:(p0.y + p2.y) / 2 + ny * bow };
          out.push({ raw:[p0, p1, p2], len:piece, tone:run.tone / run.n, face:fw, layer:layerIndex, offset:o, kind:'hatch' });
          s = e + 2 + rand() * 3;
        }
      };
      for (let s = minA; s <= maxA; s += 2) {
        const x = Math.round(dx * s + nx * o), y = Math.round(dy * s + ny * o);
        if (x < 2 || y < 2 || x >= gw - 2 || y >= gh - 2) { emit(); run = null; continue; }
        const i = y * gw + x, fw = faceW[i];
        // Wider spacing away from the face; cross-hatching stays sparse everywhere.
        const dense = layerIndex === 0 ? fw > .45 || k % 2 === 0 : k % 2 === 0 && (fw > .45 || k % 4 === 0);
        const inside = dense && far[i] < .95 && tone[i] > layer.thr + far[i] * .12 - fw * .04 && mag[i] < .85;
        if (inside) { if (!run) run = { s0:s, tone:0, face:0, n:0 }; run.s1 = s; run.tone += tone[i]; run.face += fw; run.n++; }
        else { emit(); run = null; }
      }
      emit();
    }
  });
  return out;
}

// ───────────────────────── planning: what to draw, in which order, at what time ─────────────────────────
function resample(raw, step, quadratic) {
  const pts = [raw[0]];
  if (quadratic) { // hatch strokes are a gentle arc through three points
    const approx = Math.hypot(raw[2].x - raw[0].x, raw[2].y - raw[0].y), count = Math.max(2, Math.ceil(approx / step));
    for (let i = 1; i <= count; i++) { const t = i / count, u = 1 - t; pts.push({ x:u * u * raw[0].x + 2 * u * t * raw[1].x + t * t * raw[2].x, y:u * u * raw[0].y + 2 * u * t * raw[1].y + t * t * raw[2].y }); }
    return pts;
  }
  let carry = 0;
  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1], b = raw[i], seg = Math.hypot(b.x - a.x, b.y - a.y);
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
  const pts = resample(s.kind === 'hatch' ? s.raw : chaikin(s.raw), 2, s.kind === 'hatch').map(p => ({ x:p.x + ox, y:p.y + oy }));
  const n = pts.length; if (n < 2) return null;
  const x = new Float32Array(n), y = new Float32Array(n), pr = new Float32Array(n);
  const wobble = s.kind === 'hatch' ? .25 : .6, freq = 1 + rand() * 2.5, phase = rand() * 6.28;
  let len = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const u = i / (n - 1), off = Math.sin(u * Math.PI * freq + phase) * wobble;
    x[i] = pts[i].x - (b.y - a.y) / l * off; y[i] = pts[i].y + (b.x - a.x) / l * off;
    // Pressure: pencil lands softly, presses through the middle and flicks off at the end.
    const taper = s.kind === 'hatch' ? Math.min(1, u / .22, (1 - u) / .5) : Math.min(1, u / .12, (1 - u) / .2);
    pr[i] = .22 + .78 * Math.pow(clamp(taper), .7);
    if (i) len += Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
  }
  return { ...s, x, y, pr, n, len };
}
function styleStroke(s, density) {
  const str = s.strength ?? .5;
  if (s.kind === 'construct') { s.width = 1.3; s.alpha = .2; s.ghost = 0; }
  else if (s.kind === 'contour') { s.width = lerp(1.0 + str * 1.1, .85 + str * .95, s.face); s.alpha = .55 + str * .45; s.ghost = .2; }
  else if (s.kind === 'accent') { s.width = 1.2 + str * 1.0; s.alpha = .8 + str * .2; s.ghost = .15; }
  else { s.width = lerp(1.05, .9, s.face); s.alpha = (.2 + s.tone * .4) * (.7 + density * .45) * (s.layer ? .7 : 1); s.ghost = 0; }
  return s;
}
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
    const key = `${s.layer}:${Math.floor(s.x[0] / 46)}:${Math.floor(s.y[0] / 46)}`;
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
function buildPlan(A, durationSec, densityPercent) {
  const density = densityPercent / 100, rand = random(1234), { b, face } = A;
  const totalMs = durationSec * 1000, leadMs = 380, outroMs = Math.min(1400, totalMs * .09), drawMs = totalMs - leadMs - outroMs;
  const capacity = (drawMs / 1000) * SPEED;
  const cost = s => s.len / KIND[s.kind].speed + 10;

  const contours = A.contours.map(s => finalizeStroke({ ...s, kind:'contour' }, rand, b.x, b.y)).filter(Boolean);
  const hatches = makeHatching(A, density, rand).map(s => finalizeStroke(s, rand, b.x, b.y)).filter(Boolean);
  const priority = s => s.strength * (.45 + Math.min(1.4, s.len / 70));
  const faceContours = contours.filter(s => s.face > .5).sort((a, z) => priority(z) - priority(a));
  const bodyContours = contours.filter(s => s.face <= .5).sort((a, z) => priority(z) - priority(a));
  const faceHatches = hatches.filter(s => s.face > .5).sort((a, z) => z.tone - a.tone);
  const bodyHatches = hatches.filter(s => s.face <= .5).sort((a, z) => z.tone - a.tone);

  let carry = 0;
  const take = (pool, share) => {
    let budget = capacity * share + carry, used = 0; const picked = [];
    for (const s of pool) { const c = cost(s); if (used + c <= budget) { picked.push(s); used += c; } }
    carry = Math.max(0, budget - used); return picked;
  };
  // Construction lines: a few long, faint, straightened lines that block in the figure first.
  const constructBudget = capacity * .05; let constructUsed = 0; const construct = [];
  for (const s of contours.slice().sort((a, z) => z.len - a.len)) {
    if (s.len < 40) break;
    const straight = simplify(s.raw, 3.5), a = straight[0], z = straight[straight.length - 1];
    const ext = (p, q) => { const l = Math.hypot(p.x - q.x, p.y - q.y) || 1, e = 5 + rand() * 6; return { x:p.x + (p.x - q.x) / l * e, y:p.y + (p.y - q.y) / l * e }; };
    const raw = [ext(a, straight[1]), ...straight.slice(1, -1), ext(z, straight[straight.length - 2])].map(p => ({ x:p.x + (rand() - .5) * 2.5, y:p.y + (rand() - .5) * 2.5 }));
    const c = finalizeStroke({ raw, kind:'construct', face:s.face, strength:s.strength }, rand, b.x, b.y);
    if (!c || constructUsed + cost(c) > constructBudget) continue;
    construct.push(c); constructUsed += cost(c);
  }
  const faceC = take(faceContours, .38);
  const faceH = take(faceHatches, .11);
  const accents = [];
  for (const s of faceC.slice().sort((a, z) => z.strength - a.strength).slice(0, Math.ceil(faceC.length * .14))) {
    const c = { ...s, kind:'accent', x:s.x.map(v => v + (rand() - .5) * .8), y:s.y.map(v => v + (rand() - .5) * .8), pr:s.pr.slice() };
    if (cost(c) <= capacity * .04 + carry) accents.push(c);
  }
  carry += capacity * .04 - accents.reduce((a, s) => a + cost(s), 0);
  const bodyC = take(bodyContours, .29);
  const bodyH = take(bodyHatches, .13);

  const faceCenter = { x:b.x + face.x, y:b.y + face.y - face.ry * .4 };
  const phases = [
    orderNearest(construct, faceCenter),
    orderNearest(faceC, faceCenter),
    orderHatching(faceH, faceCenter),
    orderNearest(accents, faceCenter),
  ];
  const faceEndIndex = phases.reduce((a, p) => a + p.length, 0);
  const lastOf = list => list.length ? { x:list[list.length - 1].x[list[list.length - 1].n - 1], y:list[list.length - 1].y[list[list.length - 1].n - 1] } : faceCenter;
  phases.push(orderNearest(bodyC, lastOf(phases[3].length ? phases[3] : phases[1])));
  phases.push(orderHatching(bodyH, lastOf(phases[4])));
  const strokes = phases.flat().map(s => styleStroke(s, density));

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
  const faceEndMs = faceEndIndex && strokes[faceEndIndex - 1] ? strokes[faceEndIndex - 1].tUp : 0;
  return { strokes, totalMs, drawEndMs:leadMs + drawMs, exitMs:Math.min(700, outroMs * .75), entry, exit:{ x:W + 60, y:H * .9 }, faceEndMs, audio:buildAudioEvents(strokes) };
}

// ───────────────────────── rendering ─────────────────────────
let cursor = { stroke:0, point:0, time:-1 };
function resetInk() { inkCtx.clearRect(0, 0, W, H); cursor = { stroke:0, point:0, time:-1 }; }
function drawSegment(s, i) {
  const p = (s.pr[i] + s.pr[i + 1]) / 2;
  inkCtx.globalAlpha = s.alpha * p; inkCtx.lineWidth = s.width * (.45 + .55 * p);
  inkCtx.beginPath(); inkCtx.moveTo(s.x[i], s.y[i]); inkCtx.lineTo(s.x[i + 1], s.y[i + 1]); inkCtx.stroke();
  if (s.ghost) { // a second, fainter graphite edge makes the line look drawn rather than vector-perfect
    const dx = s.x[i + 1] - s.x[i], dy = s.y[i + 1] - s.y[i], l = Math.hypot(dx, dy) || 1, o = .55;
    inkCtx.globalAlpha = s.alpha * p * s.ghost; inkCtx.lineWidth = s.width * .55;
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
  const list = plan.strokes;
  while (cursor.stroke < list.length) {
    const s = list[cursor.stroke];
    if (t < s.tDown) break;
    const done = t >= s.tUp, target = done ? s.n - 1 : Math.floor(strokeProgress(s, t));
    while (cursor.point < target) drawSegment(s, cursor.point++);
    if (!done) break;
    cursor.stroke++; cursor.point = 0;
  }
}
function pencilAt(t) {
  const list = plan.strokes;
  if (!list.length) return null;
  const s = list[Math.min(cursor.stroke, list.length - 1)];
  const ease = u => .5 - .5 * Math.cos(Math.PI * clamp(u));
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
  // Very fast hatch strokes are merged into audible back-and-forth bursts; contours keep their own attack.
  const events = []; let cur = null, flip = 0;
  for (const s of strokes) {
    const level = { construct:.35, contour:.8, accent:.9, hatch:.62 }[s.kind];
    if (cur && s.tDown - cur.end < 28 && cur.end - cur.start < 110) { cur.end = s.tUp; cur.level = Math.max(cur.level, level); continue; }
    if (cur) events.push(cur);
    flip ^= 1;
    cur = { start:s.tDown, end:s.tUp, level, tap:!s.chain && s.kind !== 'hatch', freq:(s.kind === 'hatch' ? 3100 : 2600) + (flip ? 520 : -380) };
  }
  if (cur) events.push(cur);
  return events;
}
const sound = {
  ac:null,
  ensure() {
    if (this.ac) return this.ac.state !== 'closed';
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    const ac = this.ac = new AC(), rate = ac.sampleRate, buffer = ac.createBuffer(1, rate * 2, rate), data = buffer.getChannelData(0);
    let grit = 0; // graphite scraping over paper tooth: noise with random crackles
    for (let i = 0; i < data.length; i++) { if (Math.random() < .0035) grit = 1; grit *= .9975; data[i] = (Math.random() * 2 - 1) * (.5 + grit * .5); }
    const src = ac.createBufferSource(); src.buffer = buffer; src.loop = true;
    const band = (f, q) => { const node = ac.createBiquadFilter(); node.type = 'bandpass'; node.frequency.value = f; node.Q.value = q; return node; };
    const gain = v => { const node = ac.createGain(); node.gain.value = v; return node; };
    this.hi = band(3000, .8); this.lo = band(1100, 1.1); this.env = gain(0); this.tap = gain(0); this.master = gain(.9);
    const tapBand = band(1700, 2.2), hiGain = gain(.9), loGain = gain(.32);
    src.connect(this.hi).connect(hiGain).connect(this.env); src.connect(this.lo).connect(loGain).connect(this.env);
    src.connect(tapBand).connect(this.tap).connect(this.master); this.env.connect(this.master);
    this.master.connect(ac.destination);
    this.stream = ac.createMediaStreamDestination(); this.master.connect(this.stream);
    src.start();
    return true;
  },
  schedule(events, startAt) {
    this.silence();
    const g = this.env.gain;
    for (const e of events) {
      const a = startAt + e.start / 1000, z = startAt + Math.max(e.end, e.start + 35) / 1000;
      this.hi.frequency.setTargetAtTime(e.freq, a, .01);
      g.setTargetAtTime(e.level, a, .012);
      g.setTargetAtTime(0, z, .028);
      if (e.tap) { this.tap.gain.setValueAtTime(.55, a); this.tap.gain.setTargetAtTime(0, a + .004, .012); }
    }
  },
  silence() {
    if (!this.ac) return; const now = this.ac.currentTime;
    for (const p of [this.env.gain, this.tap.gain, this.hi.frequency]) p.cancelScheduledValues(0);
    this.env.gain.setValueAtTime(0, now); this.tap.gain.setValueAtTime(0, now);
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
  plan = buildPlan(analysis, Number(seconds.value), Number(strength.value));
  resetInk(); renderFrame(plan.totalMs); drawFaceGuide();
  const faceAt = plan.faceEndMs ? ` 얼굴은 ${(plan.faceEndMs / 1000).toFixed(1)}초에 완성됩니다.` : '';
  status.textContent = `${FACE_NOTE[analysis.face.source] ?? ''} ${plan.strokes.length.toLocaleString()}개의 연필 획으로 계획했습니다.${faceAt} 주황 점선이 얼굴 위치입니다. 틀리면 얼굴을 클릭하거나 얼굴 둘레를 드래그하세요.`;
}
function setBusy(busy) { preview.disabled = busy; exportButton.disabled = busy; photoInput.disabled = busy; seconds.disabled = busy; strength.disabled = busy; }
let loadToken = 0;
photoInput.addEventListener('change', event => {
  const file = event.target.files[0]; if (!file) return; const image = new Image(), token = ++loadToken;
  image.onload = async () => {
    stopPlayback(); source = image; analysis = null; plan = null; renderFrame(0); fileName.textContent = file.name;
    status.textContent = detectorReady ? '사진에서 얼굴을 찾고 있습니다…' : '얼굴 인식 AI를 불러오는 중입니다… (처음 한 번만 조금 걸립니다)';
    await new Promise(resolve => setTimeout(resolve, 30));
    const base = prepare(image), face = await detectFace(base);
    if (token !== loadToken) return;
    analysis = analyzeFace(base, face); rebuild();
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
  const next = { x:clamp(box.x - b.x, 0, b.w), y:clamp(box.y - b.y, 0, b.h), rx:Math.max(18, box.rx), ry:Math.max(22, box.ry), source:'manual' };
  status.textContent = '지정한 얼굴 위치로 다시 분석하고 있습니다…';
  setTimeout(() => { analysis = analyzeFace(analysis, next); rebuild(); }, 20);
});
seconds.addEventListener('input', () => { document.querySelector('#secondsLabel').textContent = `${seconds.value}초`; stopPlayback(); preview.textContent = '미리보기'; rebuild(); });
strength.addEventListener('input', () => { document.querySelector('#strengthLabel').textContent = `${strength.value}%`; stopPlayback(); preview.textContent = '미리보기'; rebuild(); });
loadFaceDetector().catch(() => {}); // start fetching the model early so the first photo is quick
preview.addEventListener('click', async () => {
  if (!plan) return;
  if (session) { stopPlayback(); preview.textContent = '미리보기'; renderFrame(plan.totalMs); return; }
  preview.textContent = '정지'; status.textContent = '연필로 한 획씩 스케치하고 있습니다…';
  await play({ onDone:() => { preview.textContent = '미리보기'; status.textContent = '크로키 스케치가 완성되었습니다.'; } });
});
exportButton.addEventListener('click', async () => {
  if (!plan || !window.MediaRecorder) return;
  setBusy(true); preview.textContent = '미리보기';
  const withAudio = soundToggle.checked && sound.ensure();
  const tracks = [...canvas.captureStream(30).getVideoTracks(), ...(withAudio ? sound.stream.stream.getAudioTracks() : [])];
  const types = withAudio ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] : ['video/webm;codecs=vp9', 'video/webm'];
  const recorder = new MediaRecorder(new MediaStream(tracks), { mimeType:types.find(type => MediaRecorder.isTypeSupported(type)) });
  const parts = []; recorder.ondataavailable = event => event.data.size && parts.push(event.data);
  recorder.onstop = () => {
    const url = URL.createObjectURL(new Blob(parts, { type:'video/webm' })), link = document.createElement('a');
    link.href = url; link.download = 'pencil-sketch.webm'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
    setBusy(false); status.textContent = '영상 저장이 완료되었습니다.';
  };
  status.textContent = '연필 스케치 영상을 녹화하고 있습니다… 녹화 중에는 이 탭을 계속 띄워 두세요.';
  renderFrame(0); recorder.start(250);
  await play({ onDone:() => setTimeout(() => recorder.stop(), 250) });
});
renderFrame(0);
