// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: photo sharpness + fingerprints (hand-written)
// ============================================================
// Plain pixel arithmetic, no image-processing library and no imports at all,
// so the SAME file runs on the server (final check) and in the phone's browser
// (instant "too blurry, retake" feedback). One set of numbers, two places.
//
// Every function takes a greyscale image as { width, height, data } where data
// holds one 0-255 value per pixel, row by row, so each can be unit tested with
// a tiny array.

// Largest side we process. Bigger photos are shrunk first: the checks do not
// get more accurate past this size, they only get slower.
export const WORK_SIZE = 800;

// Below this a photo counts as blurry. Calibrated on card photos at WORK_SIZE:
// sharp photos of a card score around 1000, a slightly soft one around 220,
// a shaken or out-of-focus one around 20.
export const MIN_SHARPNESS = 60;

// RGBA → greyscale using the standard luminance weights (the eye is most
// sensitive to green, least to blue).
export function toGray({ width, height, data }) {
  const out = new Uint8Array(width * height);
  for (let i = 0, p = 0; p < out.length; i += 4, p += 1) {
    out[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return { width, height, data: out };
}

// Box-average shrink so the longest side is at most `max`. Averaging (rather
// than skipping pixels) keeps the result faithful, so the sharpness score of a
// big photo and a small photo of the same scene stay comparable.
export function shrink(gray, max = WORK_SIZE) {
  const scale = Math.max(gray.width, gray.height) / max;
  if (scale <= 1) return gray;
  const width = Math.max(1, Math.round(gray.width / scale));
  const height = Math.max(1, Math.round(gray.height / scale));
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor(y * scale);
    const y1 = Math.min(gray.height, Math.floor((y + 1) * scale));
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x * scale);
      const x1 = Math.min(gray.width, Math.floor((x + 1) * scale));
      let sum = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy += 1) {
        for (let xx = x0; xx < x1; xx += 1) { sum += gray.data[yy * gray.width + xx]; n += 1; }
      }
      out[y * width + x] = n ? Math.round(sum / n) : 0;
    }
  }
  return { width, height, data: out };
}

// Sharpness = variance of the Laplacian.
//
// The Laplacian (4 × centre − the 4 neighbours) is large where brightness
// changes suddenly — at crisp edges and printed text — and near zero on smooth
// areas. Blur smears edges into gentle slopes, so a blurry photo has few large
// values and the spread (variance) of the Laplacian collapses.
export function sharpness(gray) {
  const { width, height, data } = gray;
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const lap = 4 * data[i] - data[i - 1] - data[i + 1] - data[i - width] - data[i + width];
      sum += lap;
      sumSq += lap * lap;
      n += 1;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

// Difference hash: shrink to 9×8, then for each row record whether each pixel
// is brighter than its right-hand neighbour. 64 yes/no answers = one 64-bit
// number. Resizing, re-compressing or slight brightness changes flip very few
// of those answers, so two copies of the same photo differ by only a few bits.
// Returned as a signed 64-bit BigInt so it fits a Postgres BIGINT column.
export function dHash(gray) {
  const small = resizeExact(gray, 9, 8);
  let hash = 0n;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const bit = small.data[y * 9 + x] > small.data[y * 9 + x + 1] ? 1n : 0n;
      hash = (hash << 1n) | bit;
    }
  }
  return BigInt.asIntN(64, hash);
}

// Number of differing bits between two hashes.
export function hammingDistance(a, b) {
  let v = BigInt.asUintN(64, BigInt(a) ^ BigInt(b));
  let count = 0;
  while (v) { count += Number(v & 1n); v >>= 1n; }
  return count;
}

function resizeExact(gray, width, height) {
  const out = new Uint8Array(width * height);
  const sx = gray.width / width;
  const sy = gray.height / height;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x * sx);
      const y0 = Math.floor(y * sy);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
      let sum = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy += 1) {
        for (let xx = x0; xx < x1; xx += 1) { sum += gray.data[yy * gray.width + xx]; n += 1; }
      }
      out[y * width + x] = sum / n;
    }
  }
  return { width, height, data: out };
}

// Cut a rectangle out of a greyscale image (clamped to the edges), e.g. the
// portrait printed on an ID card, so it can be fingerprinted on its own.
export function cropGray(gray, { x, y, width, height }) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(gray.width, Math.ceil(x + width));
  const y1 = Math.min(gray.height, Math.ceil(y + height));
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const out = new Uint8Array(w * h);
  for (let row = 0; row < h; row += 1) {
    out.set(gray.data.subarray((y0 + row) * gray.width + x0, (y0 + row) * gray.width + x0 + w), row * w);
  }
  return { width: w, height: h, data: out };
}
