// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: moderation cases — what the model sees, and the decision log
// ============================================================
// Reads a case (a reported post or comment, or a flagged photo) from the
// database and turns it into the model's signals; records admin decisions;
// keeps the trained model in memory and re-trains it when decisions change.
import { query } from './db.js';
import { featureVector, predict, explain, train, examplesFrom, LABEL } from './moderationModel.js';

// ---------------------------------------------------------------- the model, trained on every decision

let cached = { key: null, model: null };
export async function currentModel() {
  const { rows: [k] } = await query(
    `SELECT COUNT(*)::int AS n, COALESCE(MAX(id), 0) AS last FROM moderation_actions WHERE action = ANY($1)`, [Object.keys(LABEL)]);
  const key = `${k.n}:${k.last}`;
  if (cached.key !== key) {
    const { rows } = await query(`SELECT action, features FROM moderation_actions WHERE action = ANY($1) AND features IS NOT NULL`, [Object.keys(LABEL)]);
    cached = { key, model: train(examplesFrom(rows)) };
  }
  return cached.model;
}

// ---------------------------------------------------------------- what the model sees

// Share of each reporter's earlier reports that an admin upheld (0…1).
async function reporterTrust(ids) {
  if (!ids.length) return new Map();
  const { rows } = await query(
    `SELECT cr.reporter_id,
            AVG(CASE WHEN ma.action IN ('remove', 'remove_adult') THEN 1.0 ELSE 0.0 END)::float AS trust
       FROM content_reports cr
       JOIN moderation_actions ma
         ON (ma.target_type = 'post' AND ma.target_id = cr.post_id)
         OR (ma.target_type = 'comment' AND ma.target_id = cr.comment_id)
      WHERE cr.reporter_id = ANY($1) AND ma.action IN ('remove', 'remove_adult', 'restore', 'dismiss')
      GROUP BY cr.reporter_id`, [ids]);
  return new Map(rows.map((r) => [r.reporter_id, r.trust]));
}

async function authorFacts(userId) {
  const { rows: [a] } = await query(
    `SELECT u.name, u.warning_count, u.content_strikes, u.created_at,
            (u.role <> 'member' OR (u.verification_status = 'verified' AND u.nid_number IS NOT NULL)) AS verified,
            (SELECT COUNT(*)::int FROM moderation_actions m
              WHERE m.user_id = u.id AND m.action IN ('remove', 'remove_adult', 'remove_photo')) AS removals
       FROM users u WHERE u.id = $1`, [userId]);
  if (!a) return { name: 'Unknown', facts: {} };
  return {
    name: a.name,
    facts: {
      removals: a.removals, warnings: a.warning_count, strikes: a.content_strikes,
      age_days: (Date.now() - new Date(a.created_at).getTime()) / 86400000, verified: a.verified,
    },
  };
}

// → { user_id, user_name, features } for a case, or null when it does not exist.
export async function caseFor(type, id) {
  let row;
  if (type === 'post' || type === 'comment') {
    const table = type === 'post' ? 'posts' : 'comments';
    const col = type === 'post' ? 'post_id' : 'comment_id';
    ({ rows: [row] } = await query(`SELECT author_id AS user_id, body AS text FROM ${table} WHERE id = $1`, [id]));
    if (!row) return null;
    const { rows: reports } = await query(`SELECT reporter_id, reason FROM content_reports WHERE ${col} = $1`, [id]);
    const trust = await reporterTrust(reports.map((r) => r.reporter_id));
    row.reports = reports.map((r) => ({ reason: r.reason, reporter_trust: trust.get(r.reporter_id) ?? null }));
  } else if (type === 'photo') {
    ({ rows: [row] } = await query(`SELECT user_id, scores FROM photo_reviews WHERE id = $1`, [id]));
    if (!row) return null;
    row.text = '';
    row.reports = [];
  } else return null;
  const { name, facts } = await authorFacts(row.user_id);
  return {
    user_id: row.user_id,
    user_name: name,
    features: featureVector({ text: row.text, reports: row.reports, author: facts, scores: row.scores }),
  };
}

// The model's guess for a case, and why.
export async function assess(type, id) {
  const c = await caseFor(type, id);
  if (!c) return null;
  const model = await currentModel();
  return { ...c, p: predict(model, c.features), why: explain(model, c.features) };
}

// ---------------------------------------------------------------- the decision log

// Record an admin decision. For remove/keep decisions the case's signals and
// the model's guess *before* deciding are stored — that is what it learns from.
export async function recordDecision({ adminId, type, id = null, action, reason = null, userId = null }) {
  let features = null;
  let predicted = null;
  let user = userId;
  if (action in LABEL && id != null) {
    const a = await assess(type, id).catch(() => null);
    if (a) { features = a.features; predicted = a.p; user = user ?? a.user_id; }
  }
  await query(
    `INSERT INTO moderation_actions (admin_id, user_id, target_type, target_id, action, reason, features, predicted)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [adminId, user, type, id, action, reason ? String(reason).slice(0, 300) : null, features && JSON.stringify(features), predicted]);
}
