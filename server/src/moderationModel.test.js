// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: unit tests — moderation model + photo check thresholds
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FEATURES, featureVector, predict, priorModel, train, explain, examplesFrom, agreement, lessons, buildReport, LABEL,
} from './moderationModel.js';
import { verdictFor } from './nsfwEngine.js';

const scam = featureVector({
  text: 'Pay me on bkash first, whatsapp 01712345678',
  reports: [{ reason: 'scam', reporter_trust: 0.9 }, { reason: 'scam', reporter_trust: 0.8 }],
  author: { removals: 2, warnings: 1, age_days: 2, verified: false },
});
const harmless = featureVector({
  text: 'Anyone tried the DJI Mini 4 Pro in the rain?',
  reports: [{ reason: 'other', reporter_trust: 0.1 }],
  author: { removals: 0, warnings: 0, age_days: 400, verified: true },
});

test('every signal has a label and a prior weight', () => {
  for (const [k, label, w] of FEATURES) {
    assert.equal(typeof k, 'string');
    assert.ok(label.length > 5);
    assert.equal(typeof w, 'number');
  }
});

test('features: an off-platform scam looks like one, a question does not', () => {
  assert.equal(scam.offplatform, 1);
  assert.equal(scam.reason_scam, 1);
  assert.ok(scam.reporter_trust > 0.5);
  assert.equal(scam.author_new, 1);
  assert.equal(harmless.offplatform, 0);
  assert.equal(harmless.author_verified, 1);
  assert.ok(harmless.reporter_trust < 0);
});

test('features: Bangla phone numbers count as off-platform too', () => {
  assert.equal(featureVector({ text: 'কল দিন ০১৭১২৩৪৫৬৭৮' }).offplatform, 1);
});

test('features: capitals only count on longer text', () => {
  assert.equal(featureVector({ text: 'BUY NOW CHEAPEST PRICE IN DHAKA' }).shouting, 1);
  assert.equal(featureVector({ text: 'OK' }).shouting, 0);
});

test('prior model: the scam is far more likely to go than the question', () => {
  const m = priorModel();
  assert.ok(predict(m, scam) > 0.9);
  assert.ok(predict(m, harmless) < 0.2);
});

test('training follows the admin: reports of "spam" that keep being dismissed lose weight', () => {
  const spammy = featureVector({ text: 'New lens arrived!', reports: [{ reason: 'spam' }, { reason: 'spam' }] });
  const examples = Array.from({ length: 30 }, () => ({ x: spammy, y: 0 }));
  const before = predict(priorModel(), spammy);
  const m = train(examples);
  assert.ok(predict(m, spammy) < before, 'dismissals lower the guess');
  assert.ok(m.weights.reason_spam < 0.4, 'the spam signal was weakened');
});

test('training: a couple of decisions barely move the model (it is pulled to its prior)', () => {
  const m = train([{ x: harmless, y: 1 }]);
  for (const [k, , w] of FEATURES) assert.ok(Math.abs(m.weights[k] - w) < 0.5, k);
});

test('explain: names the signals that pushed the guess most', () => {
  const why = explain(priorModel(), scam);
  assert.ok(why.length >= 1 && why.length <= 3);
  assert.equal(why[0].key, 'offplatform');
});

test('examples: only remove/keep decisions with features count', () => {
  const ex = examplesFrom([
    { action: 'remove', features: scam }, { action: 'dismiss', features: harmless },
    { action: 'warn', features: scam }, { action: 'restore', features: null },
  ]);
  assert.deepEqual(ex.map((e) => e.y), [1, 0]);
});

test('agreement: compares the guess made before each decision with the decision', () => {
  const a = agreement([
    { action: 'remove', predicted: 0.9 }, { action: 'dismiss', predicted: 0.2 },
    { action: 'remove', predicted: 0.3 }, { action: 'ban', predicted: null },
  ]);
  assert.deepEqual(a, { judged: 3, agreed: 2, rate: 67 });
});

test('lessons: reports what changed from the prior, in words', () => {
  const m = priorModel();
  m.weights.offplatform += 0.8;
  m.weights.reason_spam -= 0.5;
  const l = lessons(m);
  assert.equal(l[0].key, 'offplatform');
  assert.match(l[0].text, /more/);
  assert.match(l[1].text, /less/);
});

test('report: counts, people to watch and plain advice', () => {
  const actions = [
    { action: 'remove', user_id: 7, user_name: 'Spammy Sam', predicted: 0.8 },
    { action: 'remove', user_id: 7, user_name: 'Spammy Sam', predicted: 0.7 },
    { action: 'dismiss', user_id: 8, user_name: 'Nice Nadia', predicted: 0.2 },
    { action: 'ban', user_id: 9, user_name: 'Gone Gary' },
  ];
  const r = buildReport({
    actions, all: actions.map((a) => ({ ...a, features: harmless })),
    pending: [{ p: 0.92, user_id: 7, user_name: 'Spammy Sam' }],
    photos: { approved: 4, removed: 1, pending: 0 },
    reasons: [{ reason: 'spam', upheld: 0, dismissed: 4 }],
  });
  assert.equal(r.summary.removed, 2);
  assert.equal(r.summary.kept, 1);
  assert.equal(r.summary.bans, 1);
  assert.equal(r.learning.agreement.rate, 100);
  assert.equal(r.watch[0].name, 'Spammy Sam');
  assert.equal(r.photos.false_alarm_rate, 80);
  assert.ok(r.advice.some((t) => /very likely/.test(t)));
  assert.ok(r.advice.some((t) => /no warning yet/.test(t)));
  assert.ok(r.advice.some((t) => /"spam" are usually dismissed/.test(t)));
});

test('report: a quiet period still says something useful', () => {
  const r = buildReport({ all: Array.from({ length: 25 }, () => ({ action: 'dismiss', features: harmless })) });
  assert.deepEqual(r.advice, ['Nothing needs special attention. The community is behaving well.']);
});

test('every label maps to keep (0) or remove (1)', () => {
  for (const v of Object.values(LABEL)) assert.ok(v === 0 || v === 1);
});

// ---------------------------------------------------------------- photo check

test('photo check: ordinary photos pass', () => {
  assert.equal(verdictFor({ Neutral: 0.97, Porn: 0.01, Hentai: 0, Sexy: 0.02 }), 'ok');
  // the old small model's score for a car seat — no longer refused
  assert.equal(verdictFor({ Neutral: 0.2, Porn: 0.02, Hentai: 0, Sexy: 0.71 }), 'ok');
});

test('photo check: borderline photos go to an admin, not a strike', () => {
  assert.equal(verdictFor({ Porn: 0.3, Hentai: 0.2, Sexy: 0.3 }), 'unsure');
  assert.equal(verdictFor({ Porn: 0.05, Sexy: 0.9 }), 'unsure');
});

test('photo check: only a confident verdict is refused', () => {
  assert.equal(verdictFor({ Porn: 0.8, Hentai: 0.1 }), 'adult');
  assert.equal(verdictFor({ Porn: 0.7, Hentai: 0.1 }), 'unsure');
});
