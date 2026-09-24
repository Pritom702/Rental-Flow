// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: adult-content check for every shared photo
// ============================================================
// Runs the open-source NSFWJS classifier (MobileNetV2, ~3.5 MB) on the
// server, with the same TensorFlow WASM backend the face check uses, so it
// cannot be skipped by a modified app. It sorts a picture into Neutral,
// Drawing, Sexy, Porn or Hentai.
//
//   adult       Porn + Hentai ≥ 0.60      → refused, and a strike (moderation.js)
//   revealing   Sexy ≥ 0.90               → refused, no strike
//
// JPEG (what our app always uploads) and PNG can be read. Loading takes a few
// seconds once per server instance; after that a photo takes ~0.1–0.3 s.
import { createRequire } from 'module';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const require = createRequire(import.meta.url);
const ADULT = 0.6;
const REVEALING = 0.9;
const MAX_SIDE = 512;    // the model looks at 224 px; decoding more is wasted time

let ready = null;
let tf = null;
let model = null;

function load() {
  if (!ready) {
    ready = (async () => {
      tf = require('@tensorflow/tfjs');
      require('@tensorflow/tfjs-backend-wasm');
      if (tf.getBackend() !== 'wasm') await tf.setBackend('wasm');
      await tf.ready();
      // Only the small model is loaded (and bundled): 3.5 MB instead of 38 MB.
      const { load: loadModel } = require('nsfwjs/core');
      const { MobileNetV2Model } = require('nsfwjs/models/mobilenet_v2');
      model = await loadModel('MobileNetV2', { modelDefinitions: [MobileNetV2Model] });
    })().catch((err) => { ready = null; throw err; });
  }
  return ready;
}

// Decoded pixels → RGB tensor, sampled down to at most MAX_SIDE on the long edge.
function toTensor({ width, height, data, channels }) {
  const step = Math.max(1, Math.ceil(Math.max(width, height) / MAX_SIDE));
  const w = Math.floor(width / step);
  const h = Math.floor(height / step);
  const rgb = new Uint8Array(w * h * 3);
  let j = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = ((y * step) * width + x * step) * channels;
      rgb[j++] = data[i]; rgb[j++] = data[i + 1]; rgb[j++] = data[i + 2];
    }
  }
  return tf.tensor3d(rgb, [h, w, 3], 'int32');
}

export function canScreen(mime) {
  return mime === 'image/jpeg' || mime === 'image/png';
}

function decode(buffer, mime) {
  if (mime === 'image/jpeg') {
    const img = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: false, maxMemoryUsageInMB: 256 });
    return { ...img, channels: 3 };
  }
  if (mime === 'image/png') {
    const img = PNG.sync.read(buffer);
    return { width: img.width, height: img.height, data: img.data, channels: 4 };
  }
  throw Object.assign(new Error('Photos must be JPEG or PNG.'), { status: 400 });
}

// → { verdict: 'ok' | 'adult' | 'revealing', scores: { Porn, Hentai, Sexy, ... } }
export async function screenImage(buffer, mime) {
  let pixels;
  try { pixels = decode(buffer, mime); } catch (e) {
    throw Object.assign(new Error(e.status ? e.message : 'That photo could not be read.'), { status: 400 });
  }
  await load();
  const input = toTensor(pixels);
  let preds;
  try { preds = await model.classify(input); } finally { input.dispose(); }
  const scores = Object.fromEntries(preds.map((p) => [p.className, p.probability]));
  const adult = (scores.Porn || 0) + (scores.Hentai || 0);
  const verdict = adult >= ADULT ? 'adult' : (scores.Sexy || 0) >= REVEALING ? 'revealing' : 'ok';
  return { verdict, scores };
}
