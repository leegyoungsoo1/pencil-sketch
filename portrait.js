/* Deterministic, geometry-preserving graphite. No generated facial features. */
(function (root) {
  'use strict';
  function graphite(rgba, width, height, blurFn) {
    const n = width * height, luminance = new Float32Array(n);
    for (let i = 0; i < n; i++) luminance[i] = (.2126 * rgba[i * 4] + .7152 * rgba[i * 4 + 1] + .0722 * rgba[i * 4 + 2]) / 255;
    const fine = blurFn(luminance, width, height, 1);
    const broad = blurFn(luminance, width, height, Math.max(3, Math.round(width / 90)));
    const out = new Uint8ClampedArray(n * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const edge = Math.max(0, broad[i] - fine[i]) * 1.15;
      const tone = Math.pow(1 - luminance[i], 1.1) * .92;
      // Fine, low-amplitude grain preserves eyelids and skin gradients.
      const grain = (((Math.imul(i + 1, 1664525) >>> 8) % 101) / 100 - .5) * .025;
      const hatch = Math.sin((x + y * .68) * 2.4) * .012 * tone;
      out[i * 4] = 39; out[i * 4 + 1] = 35; out[i * 4 + 2] = 32;
      out[i * 4 + 3] = Math.round(Math.max(0, Math.min(.96, tone + edge + grain * tone + hatch)) * 255);
    }
    return out;
  }
  root.PortraitGraphite = { graphite };
  if (typeof module !== 'undefined') module.exports = root.PortraitGraphite;
})(globalThis);
