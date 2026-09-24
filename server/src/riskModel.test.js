// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: unit tests — learning risk model
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FEATURES, featureVector, predict, priorModel, train, leaveOneOutAccuracy, explain, sigmoid,
} from './riskModel.js';

const clean = {
  nid_number: '4617289035', ocr_number: '4617289035', name_score: 1,
  date_of_birth: '1990-02-26', ocr_dob: '1990-02-26', face_distance: 0.35,
  liveness_passed: true, liveness_attempts: 1, flags: [], reasons: [], card_descriptor: [0.1],
};

test('sigmoid squashes any score into 0…1', () => {
  assert.equal(sigmoid(0), 0.5);
  assert.ok(sigmoid(10) > 0.99 && sigmoid(-10) < 0.01);
});

test('every signal has a value, and a clean attempt reads as clean', () => {
  const x = featureVector(clean, {});
  assert.equal(Object.keys(x).length, FEATURES.length);
  assert.equal(x.number_match, 1);
  assert.equal(x.duplicate_face, 0);
  assert.ok(x.face_match > 1);
});

test('before any decisions the model already trusts clean and distrusts fraud', () => {
  const m = priorModel();
  const good = predict(m, featureVector(clean, {}));
  const bad = predict(m, featureVector({ ...clean, face_distance: 0.8, flags: ['duplicate-face'] }, { nidTakenAttempts: 1 }));
  assert.ok(good > 0.95, `clean ${good}`);
  assert.ok(bad < 0.05, `fraud ${bad}`);
});

test('the model learns what admins actually do', () => {
  // Admins keep approving people whose card number could not be read (the
  // text reader struggles, the rest checks out) — the model should learn that
  // an unreadable number is not a real warning sign.
  const unreadable = featureVector({ ...clean, ocr_number: null }, {});
  const before = predict(priorModel(), unreadable);
  const examples = Array.from({ length: 30 }, () => ({ x: unreadable, y: 1, weight: 1 }));
  const after = predict(train(examples), unreadable);
  assert.ok(after > before, `${before} -> ${after}`);
});

test('a few decisions cannot flip the model (it is anchored to the prior)', () => {
  const dup = featureVector({ ...clean, flags: ['duplicate-face'] }, {});
  const one = train([{ x: dup, y: 1, weight: 1 }]);
  assert.ok(one.weights.duplicate_face < -3, String(one.weights.duplicate_face));
});

test('leave-one-out accuracy is measured on examples the model did not see', () => {
  const good = featureVector(clean, {});
  const bad = featureVector({ ...clean, face_distance: 0.9, flags: ['duplicate-photo'] }, {});
  const ex = [...Array(4).fill({ x: good, y: 1 }), ...Array(4).fill({ x: bad, y: 0 })].map((e) => ({ ...e }));
  assert.equal(leaveOneOutAccuracy(ex), 1);
  assert.equal(leaveOneOutAccuracy([]), null);
});

test('explanations name the signals that mattered most', () => {
  const x = featureVector({ ...clean, flags: ['duplicate-face'] }, {});
  const top = explain(priorModel(), x);
  assert.equal(top[0].key, 'duplicate_face');
  assert.ok(top[0].effect < 0);
});

test('a card that simply could not be read is "unknown", not "fraud"', () => {
  // Nothing read off the card, no portrait found — but liveness passed and
  // there is no sign of fraud. The score must stay in the middle so an admin
  // decides, not sink as if the face had failed to match.
  const unread = featureVector({
    nid_number: '4617289035', ocr_number: null, name_score: null, face_distance: null,
    card_descriptor: null, liveness_passed: true, liveness_attempts: 2, flags: [], reasons: [],
  }, {});
  const p = predict(priorModel(), unread);
  assert.ok(p > 0.3 && p < 0.85, String(p));
  // a real mismatch is still punished hard
  const mismatch = featureVector({ ...clean, face_distance: 0.85 }, {});
  assert.ok(predict(priorModel(), mismatch) < predict(priorModel(), unread));
});
