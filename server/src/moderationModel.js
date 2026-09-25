// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: moderation model that learns from admin decisions (pure)
// ============================================================
// Every reported post or comment, and every photo the adult-content check was
// unsure about, is a case. The admin decides: remove it, or keep it. This file
// learns from those decisions to
//
//   1. predict, for each case still waiting, how likely the admin is to remove
//      it — so the queue is sorted with the most likely problems first, and
//      each case shows the signals behind the guess;
//   2. write a report for the admin: what happened, how often the model and
//      the admin agree, what it has learned, who to keep an eye on, and what
//      to do next.
//
// The model is logistic regression, written by hand (same approach as the ID
// check's riskModel.js):
//
//   score = bias + w1·x1 + w2·x2 + …        (one weight per signal)
//   P(remove) = 1 / (1 + e^(−score))
//
// It starts from PRIOR weights that mirror common sense, so it is useful on
// day one, and is re-trained on every decision so far with gradient descent,
// pulled towards the prior by a penalty (λ): a few decisions barely move it;
// many decisions and it follows what this admin actually does.
//
// Pure functions only — no database, no HTTP — so all of it is unit tested.

// ---------------------------------------------------------------- signals

// [name, plain-English label shown to admins, prior weight]
export const FEATURES = [
  ['reports', 'Number of reports', 0.8],
  ['reason_adult', 'Reported as adult content', 0.6],
  ['reason_scam', 'Reported as a scam', 0.7],
  ['reason_spam', 'Reported as spam', 0.4],
  ['reason_abuse', 'Reported as abuse or harassment', 0.6],
  ['reporter_trust', 'Reporters whose reports are usually upheld', 1.0],
  ['author_removals', 'Author had content removed before', 0.9],
  ['author_warnings', 'Author was warned before', 0.6],
  ['author_new', 'Author joined in the last 7 days', 0.3],
  ['author_verified', 'Author verified their identity', -0.6],
  ['offplatform', 'Asks to deal or pay outside RentalFlow', 1.2],
  ['has_link', 'Contains a web link', 0.2],
  ['shouting', 'Mostly CAPITAL LETTERS', 0.3],
  ['photo_adult', 'Photo check: adult score', 2.0],
  ['photo_revealing', 'Photo check: revealing score', 0.8],
];
export const PRIOR_BIAS = -1.4;
export const PRIOR = Object.fromEntries(FEATURES.map(([k, , w]) => [k, w]));

// What each admin action teaches: 1 = "this should go", 0 = "this is fine".
// Warnings, bans and unbans are about people, not one case — not examples.
export const LABEL = { remove: 1, remove_adult: 1, remove_photo: 1, restore: 0, dismiss: 0, approve_photo: 0 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const log1 = (n) => Math.log1p(Math.max(0, Number(n) || 0));

const OFFPLATFORM = /(whats\s?app|imo\b|viber|telegram|bkash|b-kash|nagad|rocket|pay (me )?(outside|directly|first)|cash only|direct deal|call me|01[3-9]\d{8}|০১[৩-৯][০-৯]{8})/i;

// One case → the numbers the model reads (each roughly within −1.5…1.5).
//   c: { text, reports: [{ reason, reporter_trust }], author: { removals, warnings, strikes,
//        age_days, verified }, scores: { Porn, Hentai, Sexy } | null }
export function featureVector(c = {}) {
  const reports = c.reports || [];
  const share = (r) => (reports.length ? reports.filter((x) => x.reason === r).length / reports.length : 0);
  const trusts = reports.map((r) => r.reporter_trust).filter((t) => t != null);
  const text = String(c.text || '');
  const letters = text.replace(/[^A-Za-z]/g, '');
  const caps = letters.length >= 12 ? letters.replace(/[^A-Z]/g, '').length / letters.length : 0;
  const a = c.author || {};
  const s = c.scores || {};
  return {
    reports: clamp(log1(reports.length), 0, 1.5),
    reason_adult: share('adult'),
    reason_scam: share('scam'),
    reason_spam: share('spam'),
    reason_abuse: share('abuse'),
    // −1 (their reports are usually dismissed) … +1 (usually upheld); 0 = unknown
    reporter_trust: trusts.length ? clamp(trusts.reduce((x, y) => x + y, 0) / trusts.length * 2 - 1, -1, 1) : 0,
    author_removals: clamp(log1(a.removals), 0, 1.5),
    author_warnings: clamp(log1((a.warnings || 0) + (a.strikes || 0)), 0, 1.5),
    author_new: a.age_days != null && a.age_days < 7 ? 1 : 0,
    author_verified: a.verified ? 1 : 0,
    offplatform: OFFPLATFORM.test(text) ? 1 : 0,
    has_link: /https?:\/\//i.test(text) ? 1 : 0,
    shouting: caps > 0.7 ? 1 : 0,
    photo_adult: clamp(((s.Porn || 0) + (s.Hentai || 0)) * 1.5, 0, 1.5),
    photo_revealing: clamp((s.Sexy || 0) * 1.2, 0, 1.2),
  };
}

// ---------------------------------------------------------------- the model

export function priorModel() {
  return { bias: PRIOR_BIAS, weights: { ...PRIOR } };
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

export function predict(model, x) {
  let z = model.bias;
  for (const [k] of FEATURES) z += (model.weights[k] || 0) * (x[k] || 0);
  return sigmoid(z);
}

// Fit the weights to labelled examples: [{ x, y }]. Gradient descent on the
// log-loss, with every weight pulled back towards its prior by λ (worth about
// four decisions, so one odd call cannot swing it; many consistent ones do).
export function train(examples, { lambda = 4, rate = 0.15, epochs = 400 } = {}) {
  const model = priorModel();
  if (!examples.length) return model;
  const n = examples.length;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const grad = Object.fromEntries(FEATURES.map(([k]) => [k, 0]));
    let gradBias = 0;
    for (const e of examples) {
      const err = predict(model, e.x) - e.y;
      gradBias += err;
      for (const [k] of FEATURES) grad[k] += err * (e.x[k] || 0);
    }
    model.bias -= rate * (gradBias / n + lambda * (model.bias - PRIOR_BIAS) / n);
    for (const [k] of FEATURES) {
      model.weights[k] -= rate * (grad[k] / n + lambda * (model.weights[k] - PRIOR[k]) / n);
    }
  }
  return model;
}

// The signals that pushed this prediction up or down the most.
export function explain(model, x, top = 3) {
  return FEATURES
    .map(([k, label]) => ({ key: k, label, effect: (model.weights[k] || 0) * (x[k] || 0) }))
    .filter((f) => Math.abs(f.effect) > 0.08)
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
    .slice(0, top);
}

// Past decisions → training examples.
export function examplesFrom(actions) {
  return actions
    .filter((a) => a.action in LABEL && a.features)
    .map((a) => ({ x: a.features, y: LABEL[a.action] }));
}

// ---------------------------------------------------------------- the report

const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

// How often the model's guess (made before the admin decided) matched the decision.
export function agreement(actions) {
  const judged = actions.filter((a) => a.action in LABEL && a.predicted != null);
  if (!judged.length) return { judged: 0, agreed: 0, rate: null };
  const agreed = judged.filter((a) => (a.predicted >= 0.5 ? 1 : 0) === LABEL[a.action]).length;
  return { judged: judged.length, agreed, rate: pct(agreed, judged.length) };
}

// What the model now believes differently from where it started.
export function lessons(model, top = 4) {
  return FEATURES
    .map(([k, label, prior]) => ({ key: k, label, prior, now: model.weights[k], change: model.weights[k] - prior }))
    .filter((l) => Math.abs(l.change) >= 0.15)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, top)
    .map((l) => ({
      ...l,
      text: l.change > 0
        ? `"${l.label}" matters more to you than it assumed — it now weighs it more.`
        : `"${l.label}" matters less to you than it assumed — it now weighs it less.`,
    }));
}

// → the admin's report. Everything is derived from the arguments.
//   actions:  moderation_actions rows in the period (newest first), each with
//             { action, target_type, user_id, user_name, reason, created_at, predicted }
//   all:      every labelled action ever (for learning stats)
//   pending:  cases waiting, each with { p } (predicted P(remove)) and { user_id, user_name }
//   photos:   { approved, removed, pending } counts in the period
//   reasons:  [{ reason, upheld, dismissed }] — report reasons and how they ended
//   model:    the trained model
export function buildReport({ days = 7, actions = [], all = [], pending = [], photos = {}, reasons = [], model = priorModel() }) {
  const count = (list, names) => list.filter((a) => names.includes(a.action)).length;
  const summary = {
    decisions: actions.filter((a) => a.action in LABEL).length,
    removed: count(actions, ['remove', 'remove_adult', 'remove_photo']),
    kept: count(actions, ['restore', 'dismiss', 'approve_photo']),
    warnings: count(actions, ['warn']),
    bans: count(actions, ['ban']),
    unbans: count(actions, ['unban']),
    waiting: pending.length,
  };
  const examples = examplesFrom(all);
  const agree = agreement(actions);

  // Members to keep an eye on: most removals + warnings in the period, then
  // anyone with several cases the model thinks are likely to go.
  const byUser = new Map();
  const bump = (id, name, key) => {
    if (!id) return;
    const u = byUser.get(id) || { user_id: id, name, removals: 0, warnings: 0, likely: 0 };
    u[key] += 1; byUser.set(id, u);
  };
  actions.forEach((a) => {
    if (LABEL[a.action] === 1) bump(a.user_id, a.user_name, 'removals');
    if (a.action === 'warn') bump(a.user_id, a.user_name, 'warnings');
  });
  pending.filter((c) => c.p >= 0.7).forEach((c) => bump(c.user_id, c.user_name, 'likely'));
  const watch = [...byUser.values()]
    .map((u) => ({ ...u, score: u.removals * 2 + u.warnings * 1.5 + u.likely }))
    .filter((u) => u.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  // Which kinds of report usually turn out to be right.
  const reasonStats = reasons
    .map((r) => ({ ...r, total: r.upheld + r.dismissed, upheld_rate: pct(r.upheld, r.upheld + r.dismissed) }))
    .filter((r) => r.total >= 1)
    .sort((a, b) => b.total - a.total);

  const photoTotal = (photos.approved || 0) + (photos.removed || 0);
  const falseAlarmRate = pct(photos.approved || 0, photoTotal);

  // Plain advice, from the numbers above.
  const advice = [];
  const urgent = pending.filter((c) => c.p >= 0.8).length;
  if (urgent) advice.push(`${urgent} waiting case${urgent === 1 ? ' looks' : 's look'} very likely to break the rules — they are at the top of the queue.`);
  if (summary.waiting >= 10) advice.push(`The queue has ${summary.waiting} cases waiting. Clearing it daily keeps hidden posts from sitting in limbo.`);
  watch.filter((u) => u.removals >= 2 && u.warnings === 0).slice(0, 2)
    .forEach((u) => advice.push(`${u.name} had ${u.removals} posts removed but no warning yet — consider sending one.`));
  watch.filter((u) => u.warnings >= 2).slice(0, 2)
    .forEach((u) => advice.push(`${u.name} has been warned ${u.warnings} times this period — a ban may be due.`));
  if (photoTotal >= 3 && falseAlarmRate >= 60) advice.push(`You kept ${falseAlarmRate}% of the photos the automatic check flagged — it is being cautious; nothing is refused until it is sure.`);
  reasonStats.filter((r) => r.total >= 3 && r.upheld_rate <= 25).slice(0, 2)
    .forEach((r) => advice.push(`Reports marked "${r.reason}" are usually dismissed (${100 - r.upheld_rate}%) — they can wait behind other cases.`));
  if (examples.length < 10) advice.push(`The model has learned from ${examples.length} decision${examples.length === 1 ? '' : 's'} so far. Every remove, keep or dismiss teaches it — after about 20 its guesses follow your judgement.`);
  if (!advice.length) advice.push('Nothing needs special attention. The community is behaving well.');

  return {
    days,
    summary,
    learning: {
      examples: examples.length,
      agreement: agree,
      lessons: lessons(model),
      weights: FEATURES.map(([k, label, prior]) => ({ key: k, label, prior, now: Number(model.weights[k].toFixed(2)) })),
    },
    watch,
    reasons: reasonStats,
    photos: { ...photos, false_alarm_rate: falseAlarmRate },
    advice,
  };
}
