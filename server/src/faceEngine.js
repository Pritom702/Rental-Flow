// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: face detection + face matching
// ============================================================
// Wraps the open-source face-api models (@vladmandic/face-api) running on
// TensorFlow's WebAssembly backend — no native build, so it installs the same
// on Windows, macOS, Linux and Vercel.
//
// What it gives the rest of the app:
//   findFaces(rgba)  → every face in a photo: box, 68 landmarks, and a
//                      "descriptor" — 128 numbers summarising the face.
//   faceDistance(a, b) → how different two descriptors are. Two photos of the
//                      same person land close together (≈0.3–0.5), different
//                      people far apart (≈0.7+). Thresholds live in nidUtils.js.
import path from 'path';
import { createRequire } from 'module';
import { cropRgba } from './imageUtils.js';

const require = createRequire(import.meta.url);
let ready = null;
let faceapi = null;
let tf = null;

// Load once, on first use, and reuse for every later request. Model loading is
// the slow part (~0.1 s); a warm server skips it entirely.
function load() {
  if (!ready) {
    ready = (async () => {
      tf = require('@tensorflow/tfjs');
      require('@tensorflow/tfjs-backend-wasm');
      faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
      await tf.setBackend('wasm');
      await tf.ready();
      const modelDir = path.join(path.dirname(require.resolve('@vladmandic/face-api/package.json')), 'model');
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelDir);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(modelDir);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(modelDir);
    })().catch((err) => { ready = null; throw err; });
  }
  return ready;
}

// RGBA pixels → the RGB tensor the model expects.
function toTensor({ width, height, data }) {
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4) {
    rgb[j++] = data[i];
    rgb[j++] = data[i + 1];
    rgb[j++] = data[i + 2];
  }
  return tf.tensor3d(rgb, [height, width, 3]);
}

// All faces in the picture, biggest first.
export async function findFaces(rgba, minConfidence = 0.4) {
  await load();
  const input = toTensor(rgba);
  try {
    const found = await faceapi
      .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence }))
      .withFaceLandmarks()
      .withFaceDescriptors();
    return found
      .map((f) => ({
        score: f.detection.score,
        box: f.detection.box,
        area: f.detection.box.width * f.detection.box.height,
        landmarks: f.landmarks.positions.map((p) => ({ x: p.x, y: p.y })),
        descriptor: Array.from(f.descriptor),
      }))
      .sort((a, b) => b.area - a.area);
  } finally {
    input.dispose();
  }
}

// Euclidean distance between two 128-number descriptors.
export function faceDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

// The portrait printed on an NID card is small, grey and sits on a patterned
// background, and the detector shrinks the whole photo to 512×512 before it
// looks — so on a real card photo it often finds nothing. When the full photo
// gives no face, search overlapping zoomed-in sections of the card (a 2×2 and a
// 3×3 grid). Each section is enlarged by the same 512×512 step, which makes the
// portrait big enough to detect. Boxes and landmarks are mapped back to the
// full photo, so the rest of the code never knows a section was used.
export async function findCardFace(rgba) {
  const direct = await findFaces(rgba, 0.3);
  if (direct.length) return direct[0];
  let best = null;
  for (const [n, size] of [[2, 0.6], [3, 0.45]]) {
    const step = (1 - size) / (n - 1);
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        const x = col * step * rgba.width;
        const y = row * step * rgba.height;
        const part = cropRgba(rgba, x, y, size * rgba.width, size * rgba.height);
        const [face] = await findFaces(part, 0.3);
        if (face && (!best || face.score > best.score)) {
          best = {
            ...face,
            box: { x: face.box.x + x, y: face.box.y + y, width: face.box.width, height: face.box.height },
            landmarks: face.landmarks.map((p) => ({ x: p.x + x, y: p.y + y })),
          };
        }
      }
    }
    if (best) return best;
  }
  return null;
}
