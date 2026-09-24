// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: unit tests — sharpness, fingerprints, liveness
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { sharpness, shrink, dHash, hammingDistance, sha256, cropGray, rotateRgba } from './imageUtils.js';
import {
  headDirection, frameShows, pickChallenge, challengeIsCurrent, ACTIONS,
} from './livenessUtils.js';

// A 64×64 checkerboard of 8-pixel squares: lots of hard edges.
function checkerboard(size = 64, cell = 8) {
  const data = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      data[y * size + x] = ((Math.floor(x / cell) + Math.floor(y / cell)) % 2) * 255;
    }
  }
  return { width: size, height: size, data };
}

// Simple 5×5 box blur — what hand-shake does to a photo.
function blur(img, r = 2) {
  const out = new Uint8Array(img.data.length);
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      let sum = 0;
      let n = 0;
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          const yy = Math.min(img.height - 1, Math.max(0, y + dy));
          const xx = Math.min(img.width - 1, Math.max(0, x + dx));
          sum += img.data[yy * img.width + xx];
          n += 1;
        }
      }
      out[y * img.width + x] = Math.round(sum / n);
    }
  }
  return { ...img, data: out };
}

test('a flat grey image has zero sharpness', () => {
  const flat = { width: 10, height: 10, data: new Uint8Array(100).fill(128) };
  assert.equal(sharpness(flat), 0);
});

test('blurring a sharp image collapses its sharpness score', () => {
  const sharp = checkerboard();
  const soft = blur(sharp);
  assert.ok(sharpness(sharp) > 5 * sharpness(soft), `${sharpness(sharp)} vs ${sharpness(soft)}`);
});

test('shrink keeps the aspect ratio and caps the longest side', () => {
  const big = { width: 1600, height: 800, data: new Uint8Array(1600 * 800).fill(10) };
  const small = shrink(big, 800);
  assert.equal(small.width, 800);
  assert.equal(small.height, 400);
  assert.equal(small.data[0], 10);
});

test('the same picture at two sizes has near-identical fingerprints', () => {
  const a = checkerboard(64, 8);
  const b = shrink(checkerboard(128, 16), 64);
  assert.ok(hammingDistance(dHash(a), dHash(b)) <= 4);
});

test('different pictures have very different fingerprints', () => {
  const a = checkerboard(64, 8);
  const b = checkerboard(64, 3);
  assert.ok(hammingDistance(dHash(a), dHash(b)) > 10);
});

test('hamming distance counts differing bits', () => {
  assert.equal(hammingDistance(0n, 0n), 0);
  assert.equal(hammingDistance(0b1011n, 0b0001n), 2);
  assert.equal(hammingDistance(-1n, 0n), 64);
});

test('sha256 is the standard digest', () => {
  assert.equal(sha256(Buffer.from('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

// ------------------------------------------------------------ liveness

// A cartoon set of 68 landmarks: jaw from x=0 to x=100, nose at `noseX`,
// eyes `eyeOpen` tall.
function face({ noseX = 50, eyeOpen = 6 } = {}) {
  const p = Array.from({ length: 68 }, () => ({ x: 50, y: 50 }));
  p[0] = { x: 0, y: 50 };
  p[16] = { x: 100, y: 50 };
  p[30] = { x: noseX, y: 60 };
  const eye = (start, cx) => {
    p[start] = { x: cx - 10, y: 40 };
    p[start + 1] = { x: cx - 4, y: 40 - eyeOpen / 2 };
    p[start + 2] = { x: cx + 4, y: 40 - eyeOpen / 2 };
    p[start + 3] = { x: cx + 10, y: 40 };
    p[start + 4] = { x: cx + 4, y: 40 + eyeOpen / 2 };
    p[start + 5] = { x: cx - 4, y: 40 + eyeOpen / 2 };
  };
  eye(36, 30);
  eye(42, 70);
  return p;
}

test('head direction is read from the nose position', () => {
  assert.equal(headDirection(face({ noseX: 50 })), 'forward');
  assert.equal(headDirection(face({ noseX: 72 })), 'left');    // camera's right = member's left
  assert.equal(headDirection(face({ noseX: 28 })), 'right');
  assert.equal(headDirection(face({ noseX: 62 })), 'between');
});

test('forward means facing the camera', () => {
  assert.equal(frameShows('forward', face()), true);
  assert.equal(frameShows('forward', face({ noseX: 75 })), false);
});

// A face whose nose sits `noseY` of the way from the eye line (y=40) to the chin.
function tilted(noseY) {
  const p = face();
  p[8] = { x: 50, y: 100 };                 // chin
  p[30] = { x: 50, y: 40 + 60 * noseY };
  return p;
}

test('tilting up is judged against the member\'s own straight-on frame', () => {
  const straight = tilted(0.4);
  assert.equal(frameShows('up', tilted(0.33), straight), true);    // nose moved towards the eyes
  assert.equal(frameShows('up', tilted(0.39), straight), false);   // barely moved
  assert.equal(frameShows('up', tilted(0.30)), false);              // no reference frame: never passes
  // the same absolute position counts as "up" only relative to a higher resting point
  assert.equal(frameShows('up', tilted(0.36), tilted(0.45)), true);
  assert.equal(frameShows('up', tilted(0.36), tilted(0.37)), false);
});

test('blink is retired: old challenges containing it are replaced', () => {
  assert.equal(challengeIsCurrent(['right', 'blink']), false);
  assert.equal(challengeIsCurrent(['left', 'up']), true);
  assert.equal(challengeIsCurrent(null), false);
});

test('a challenge is two different actions', () => {
  for (let i = 0; i < 50; i += 1) {
    const [a, b] = pickChallenge();
    assert.ok(ACTIONS.includes(a) && ACTIONS.includes(b));
    assert.notEqual(a, b);
  }
});

test('cropGray cuts a clamped rectangle', () => {
  const img = { width: 4, height: 3, data: Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) };
  assert.deepEqual(Array.from(cropGray(img, { x: 1, y: 1, width: 2, height: 2 }).data), [5, 6, 9, 10]);
  const edge = cropGray(img, { x: -5, y: 2, width: 100, height: 100 });
  assert.equal(edge.width, 4);
  assert.equal(edge.height, 1);
});

test('rotating a quarter turn four times gives the original back', () => {
  const img = { width: 3, height: 2, data: Uint8Array.from({ length: 24 }, (_, i) => i % 4 === 3 ? 255 : i) };
  const once = rotateRgba(img, 1);
  assert.equal(once.width, 2);
  assert.equal(once.height, 3);
  assert.deepEqual(Array.from(rotateRgba(img, 4).data), Array.from(img.data));
  // the top-left pixel ends up top-right after a clockwise turn
  assert.deepEqual(Array.from(once.data.slice(4, 7)), [0, 1, 2]);
});
