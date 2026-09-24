// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: risk model that learns from admin decisions (pure)
// ============================================================
// Every identity check produces a handful of signals (how well the faces
// match, whether the card could be read, how the member behaved). Admins then
// approve or reject. This file turns those past decisions into a model that
// predicts, for a new attempt, how likely an admin would be to approve it.
//
// The model is logistic regression, written by hand:
//
//   score = bias + w1·x1 + w2·x2 + …        (one weight per signal)
//   P(genuine) = 1 / (1 + e^(−score))       (squashed into 0…1)
//
// It starts from PRIOR weights that mirror the existing rules, so it is useful
// on day one. Each time an admin decides, it is re-trained on every decision so
// far with gradient descent, pulled towards the prior by a penalty (λ). With a
// few decisions it barely moves; with many, it follows what admins actually do.
//
// Pure functions only — no database, no HTTP — so all of it is unit tested.

// ---------------------------------------------------------------- signals

// [name, plain-English label shown to admins, prior weight]
export const FEATURES = [
  ['face_match', 'Selfie matches the card photo', 2.5],
  ['face_mismatch', 'Selfie looks like a different person from the card', -5.0],
  ['number_match', 'NID number on card matches what was typed', 1.5],
  ['number_unreadable', 'NID number on card could not be read', -0.5],
  ['name_match', 'Name on card matches what was typed', 1.0],
  ['dob_match', 'Date of birth on card matches', 0.8],
  ['liveness_passed', 'Passed the live selfie check', 1.5],
  ['extra_liveness_tries', 'Needed extra tries at the live selfie', -0.4],
  ['blurry_photos', 'Blurry photos', -0.5],
  ['card_face_missing', 'No portrait found on the card', -0.5],
  ['duplicate_photo', 'Card photo already used by another account', -3.0],
  ['duplicate_face', 'Face already belongs to another account', -4.0],
  ['district_unknown', 'NID starts with an unknown district code', -0.5],
  ['prior_rejections', 'Earlier ID attempts were rejected', -1.0],
  ['nid_taken_attempts', "Tried to use someone else's NID", -2.5],
  ['rushed', 'Submitted very quickly after signing up', -0.3],
  ['shared_network', 'Other new accounts verified from the same network', -0.5],
];
export const PRIOR_BIAS = 0.5;
export const PRIOR = Object.fromEntries(FEATURES.map(([k, , w]) => [k, w]));

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// One attempt → the numbers the model reads. Every value is kept roughly in
// −1.5…1.5 so no single signal swamps the others just because of its units.
//   attempt:  a row of identity_verifications
//   activity: { priorRejections, nidTakenAttempts, minutesSinceSignup, sharedNetwork }
export function featureVector(attempt = {}, activity = {}) {
  const has = (flag) => (attempt.flags || []).includes(flag) || (attempt.reasons || []).includes(flag);
  const d = attempt.face_distance;
  return {
    // 0.6 = the "different person" line; each 0.2 closer adds a full point.
    // A check that could not run (no portrait on the card, name unreadable)
    // is 0 — unknown, not a failure. Only card_face_missing notes the gap, gently.
    face_match: d == null ? 0 : clamp((0.6 - d) / 0.2, -1.5, 1.5),
    // A clear mismatch is the stolen-card case: every detail on the card can
    // match what was typed (it is a real card) while the face is someone else's.
    // So it gets its own heavy signal instead of just "a low face_match".
    face_mismatch: d == null ? 0 : clamp((d - 0.55) / 0.1, 0, 1.5),
    number_match: attempt.ocr_number && attempt.ocr_number === attempt.nid_number ? 1 : 0,
    number_unreadable: attempt.ocr_number ? 0 : 1,
    name_match: attempt.name_score == null ? 0 : clamp((attempt.name_score - 0.8) * 5, -1.5, 1),
    dob_match: attempt.ocr_dob && attempt.date_of_birth && attempt.ocr_dob === attempt.date_of_birth ? 1 : 0,
    liveness_passed: attempt.liveness_passed ? 1 : 0,
    extra_liveness_tries: clamp((attempt.liveness_attempts || 1) - 1, 0, 3),
    blurry_photos: ['blurry-front', 'blurry-back', 'blurry-selfie'].filter(has).length,
    card_face_missing: attempt.card_descriptor == null && d == null ? 1 : 0,
    duplicate_photo: has('duplicate-photo') ? 1 : 0,
    duplicate_face: has('duplicate-face') ? 1 : 0,
    district_unknown: has('nid-district-unknown') ? 1 : 0,
    prior_rejections: clamp(activity.priorRejections || 0, 0, 3),
    nid_taken_attempts: clamp(activity.nidTakenAttempts || 0, 0, 3),
    rushed: activity.minutesSinceSignup != null && activity.minutesSinceSignup < 2 ? 1 : 0,
    shared_network: clamp((activity.sharedNetwork || 0) / 3, 0, 1.5),
  };
}

// ---------------------------------------------------------------- the model

export function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

// P(an admin would approve) for one feature vector.
export function predict(model, x) {
  let z = model.bias;
  for (const [k] of FEATURES) z += (model.weights[k] || 0) * (x[k] || 0);
  return sigmoid(z);
}

export function priorModel() {
  return { bias: PRIOR_BIAS, weights: { ...PRIOR } };
}

// Fit the weights to labelled examples: [{ x, y (1 approve / 0 reject), weight }].
//
// Gradient descent on the (weighted) log-loss. For each example the error is
// (prediction − label); nudging each weight against error × feature value
// makes the next prediction a little closer. The λ term pulls every weight
// back towards its prior, so a handful of decisions cannot flip the model.
export function train(examples, { lambda = 0.5, rate = 0.1, epochs = 400 } = {}) {
  const model = priorModel();
  if (!examples.length) return model;
  const total = examples.reduce((s, e) => s + (e.weight ?? 1), 0);
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const grad = Object.fromEntries(FEATURES.map(([k]) => [k, 0]));
    let gradBias = 0;
    for (const e of examples) {
      const err = (predict(model, e.x) - e.y) * (e.weight ?? 1);
      gradBias += err;
      for (const [k] of FEATURES) grad[k] += err * (e.x[k] || 0);
    }
    model.bias -= rate * (gradBias / total + lambda * (model.bias - PRIOR_BIAS) / total);
    for (const [k] of FEATURES) {
      model.weights[k] -= rate * (grad[k] / total + lambda * (model.weights[k] - PRIOR[k]) / total);
    }
  }
  return model;
}

// Leave-one-out accuracy: train without each example in turn and check the
// prediction on the one left out. An honest estimate on small data, because
// the model is never graded on an example it learned from.
export function leaveOneOutAccuracy(examples, options) {
  const labelled = examples.filter((e) => (e.weight ?? 1) >= 1);   // admin decisions only
  if (labelled.length < 2) return null;
  let right = 0;
  for (let i = 0; i < labelled.length; i += 1) {
    const rest = examples.filter((e) => e !== labelled[i]);
    const m = train(rest, { ...options, epochs: 200 });
    if ((predict(m, labelled[i].x) >= 0.5 ? 1 : 0) === labelled[i].y) right += 1;
  }
  return right / labelled.length;
}

// The signals that pushed this prediction up or down the most, for admins.
export function explain(model, x, top = 4) {
  return FEATURES
    .map(([k, label]) => ({ key: k, label, effect: (model.weights[k] || 0) * (x[k] || 0) }))
    .filter((f) => Math.abs(f.effect) > 0.05)
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
    .slice(0, top);
}

// Below this, an attempt the rules would auto-approve goes to an admin instead.
export const AUTO_APPROVE_MIN = 0.6;
