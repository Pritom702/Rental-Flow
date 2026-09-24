// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: reading an uploaded photo on the server
// ============================================================
// Decodes the JPEG and runs the shared pixel checks from pixelUtils.js.
import crypto from 'crypto';
import jpeg from 'jpeg-js';
import { toGray, shrink, sharpness, dHash, cropGray } from './pixelUtils.js';

export {
  WORK_SIZE, MIN_SHARPNESS, toGray, shrink, sharpness, dHash, hammingDistance, cropGray,
} from './pixelUtils.js';

// JPEG bytes → { width, height, data (RGBA) }. Throws on anything that is not
// a JPEG; the browser converts every capture to JPEG before uploading.
export function decodeJpeg(buffer) {
  return jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 256 });
}

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Everything the upload step needs from one photo, in one pass.
export function analysePhoto(buffer) {
  const rgba = decodeJpeg(buffer);
  const gray = shrink(toGray(rgba));
  return {
    width: rgba.width,
    height: rgba.height,
    rgba,
    sharpness: sharpness(gray),
    dhash: dHash(gray),
    sha256: sha256(buffer),
  };
}

// Fingerprint of ONE region — the portrait on an ID card. Every NID card has
// the same printed template, so a fingerprint of the whole card cannot tell two
// different people's cards apart (measured: 1–3 bits apart, the same as two
// copies of one card). The portrait can: a re-saved copy of the same card is
// ~1 bit away, a different person's card ~20.
export function regionHash(rgba, box, pad = 0.15) {
  return dHash(cropGray(toGray(rgba), {
    x: box.x - box.width * pad,
    y: box.y - box.height * pad,
    width: box.width * (1 + 2 * pad),
    height: box.height * (1 + 2 * pad),
  }));
}

// Cut a rectangle out of an RGBA image — used to zoom in on part of a card.
export function cropRgba({ width, height, data }, x, y, w, h) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const cw = Math.min(width - x0, Math.round(w));
  const ch = Math.min(height - y0, Math.round(h));
  const out = new Uint8Array(cw * ch * 4);
  for (let row = 0; row < ch; row += 1) {
    const from = ((y0 + row) * width + x0) * 4;
    out.set(data.subarray(from, from + cw * 4), row * cw * 4);
  }
  return { width: cw, height: ch, data: out };
}

// Prepare the text part of an NID card for the text reader. The printed text
// on a phone photo of a card is only ~12–15 px tall and Tesseract reads best
// at 25 px or more, so: take the area to the right of (and below) the portrait,
// enlarge it with bilinear interpolation, turn it grey and stretch the contrast
// so faint or red print becomes dark on light. Returns JPEG bytes.
export function cardTextRegion(rgba, faceBox, scale = 2.5) {
  const x = faceBox ? faceBox.x + faceBox.width * 0.9 : 0;
  const y = faceBox ? Math.max(0, faceBox.y - faceBox.height * 0.6) : 0;
  const w = rgba.width - x;
  const h = faceBox ? Math.min(rgba.height - y, faceBox.height * 2.6) : rgba.height;
  const part = cropRgba(rgba, x, y, w, h);
  const gray = toGray(part);

  // contrast stretch between the 2nd and 98th percentile
  const hist = new Uint32Array(256);
  for (const v of gray.data) hist[v] += 1;
  const n = gray.data.length;
  let lo = 0; let hi = 255; let acc = 0;
  for (let v = 0; v < 256; v += 1) { acc += hist[v]; if (acc >= n * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v -= 1) { acc += hist[v]; if (acc >= n * 0.02) { hi = v; break; } }
  const span = Math.max(1, hi - lo);

  const W = Math.round(gray.width * scale);
  const H = Math.round(gray.height * scale);
  const out = Buffer.alloc(W * H * 4);
  for (let yy = 0; yy < H; yy += 1) {
    const sy = Math.min(gray.height - 1, yy / scale);
    const y0 = Math.floor(sy); const y1 = Math.min(gray.height - 1, y0 + 1); const fy = sy - y0;
    for (let xx = 0; xx < W; xx += 1) {
      const sx = Math.min(gray.width - 1, xx / scale);
      const x0 = Math.floor(sx); const x1 = Math.min(gray.width - 1, x0 + 1); const fx = sx - x0;
      const g = gray.data;
      const top = g[y0 * gray.width + x0] * (1 - fx) + g[y0 * gray.width + x1] * fx;
      const bot = g[y1 * gray.width + x0] * (1 - fx) + g[y1 * gray.width + x1] * fx;
      const v = Math.max(0, Math.min(255, ((top * (1 - fy) + bot * fy) - lo) * 255 / span));
      const i = (yy * W + xx) * 4;
      out[i] = v; out[i + 1] = v; out[i + 2] = v; out[i + 3] = 255;
    }
  }
  return jpeg.encode({ width: W, height: H, data: out }, 92).data;
}

// Turn an RGBA image a quarter-turn clockwise, `turns` times (1 = 90°).
// Phones take tall photos, so an ID card is often photographed sideways.
export function rotateRgba(img, turns) {
  let cur = img;
  for (let t = 0; t < ((turns % 4) + 4) % 4; t += 1) {
    const { width: w, height: h, data } = cur;
    const out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const s = (y * w + x) * 4;
        const d = (x * h + (h - 1 - y)) * 4;
        out[d] = data[s]; out[d + 1] = data[s + 1]; out[d + 2] = data[s + 2]; out[d + 3] = 255;
      }
    }
    cur = { width: h, height: w, data: out };
  }
  return cur;
}

export function encodeJpeg(rgba, quality = 90) {
  return Buffer.from(jpeg.encode({ width: rgba.width, height: rgba.height, data: Buffer.from(rgba.data) }, quality).data);
}
