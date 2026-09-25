// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: admin console — queue, members, communities, report
// ============================================================
// Admin only. The platform admin has the last word on everything:
//   • the queue: reported posts and comments, and photos the automatic check
//     was unsure about — sorted by how likely the model thinks each is to go
//   • members: find anyone, warn them, ban or unban them
//   • communities: create new ones
//   • the report: what the moderation model learned and what to do next
// Every decision is logged in moderation_actions and teaches the model.
import { Router } from 'express';
import { query } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { recordAdultStrike } from '../moderation.js';
import { assess, currentModel, recordDecision } from '../moderationCases.js';
import { buildReport } from '../moderationModel.js';

const router = Router();
router.use(authRequired, requireRole('admin'));

const httpError = (status, message) => Object.assign(new Error(message), { status });
const snippet = (t = '', n = 80) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

async function notify(userId, title, body, link = null) {
  await query(`INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, 'social_moderation', $2, $3, $4)`,
    [userId, title.slice(0, 160), body, link]);
}

// ---------------------------------------------------------------- the queue

router.get('/queue', async (_req, res) => {
  const { rows: posts } = await query(
    `SELECT p.id, p.body, p.attachments, p.status, p.report_count, p.created_at, p.author_id, u.name AS author_name, c.slug AS community_slug,
            (SELECT COALESCE(json_agg(json_build_object('reason', r.reason, 'note', r.note)), '[]')
               FROM content_reports r WHERE r.post_id = p.id AND r.resolved_at IS NULL) AS reports
       FROM posts p JOIN users u ON u.id = p.author_id JOIN communities c ON c.id = p.community_id
      WHERE p.status <> 'removed' AND (p.status = 'hidden' OR EXISTS (SELECT 1 FROM content_reports r WHERE r.post_id = p.id AND r.resolved_at IS NULL))
      LIMIT 100`);
  const { rows: comments } = await query(
    `SELECT cm.id, cm.post_id, cm.body, cm.status, cm.report_count, cm.created_at, cm.author_id, u.name AS author_name,
            (SELECT COALESCE(json_agg(json_build_object('reason', r.reason, 'note', r.note)), '[]')
               FROM content_reports r WHERE r.comment_id = cm.id AND r.resolved_at IS NULL) AS reports
       FROM comments cm JOIN users u ON u.id = cm.author_id
      WHERE cm.status <> 'removed' AND (cm.status = 'hidden' OR EXISTS (SELECT 1 FROM content_reports r WHERE r.comment_id = cm.id AND r.resolved_at IS NULL))
      LIMIT 100`);
  const { rows: photos } = await query(
    `SELECT pr.id, pr.url, pr.place, pr.scores, pr.created_at, pr.user_id AS author_id, u.name AS author_name
       FROM photo_reviews pr JOIN users u ON u.id = pr.user_id
      WHERE pr.status = 'pending' ORDER BY pr.created_at DESC LIMIT 100`);

  const cases = [
    ...posts.map((p) => ({ type: 'post', ...p })),
    ...comments.map((c) => ({ type: 'comment', ...c })),
    ...photos.map((p) => ({ type: 'photo', ...p })),
  ];
  for (const c of cases) {
    const a = await assess(c.type, c.id);
    c.p = a ? Math.round(a.p * 100) / 100 : null;
    c.why = a ? a.why.map((w) => ({ label: w.label, up: w.effect > 0 })) : [];
  }
  cases.sort((a, b) => (b.p ?? 0) - (a.p ?? 0));
  res.json({ cases });
});

// POST /api/moderation/cases/:type/:id  { action, reason?, adult? }
//   post / comment: 'remove' | 'restore' | 'dismiss'   (adult: true → a strike too)
//   photo:          'approve' | 'remove'               (adult: true → a strike too)
router.post('/cases/:type/:id', async (req, res) => {
  const { type } = req.params;
  const id = Number(req.params.id);
  const { action, adult = false } = req.body;
  const reason = req.body.reason ? String(req.body.reason).slice(0, 300) : null;

  if (type === 'photo') {
    if (!['approve', 'remove'].includes(action)) throw httpError(400, 'Unknown action.');
    const { rows: [ph] } = await query(`SELECT * FROM photo_reviews WHERE id = $1`, [id]);
    if (!ph) throw httpError(404, 'Not found.');
    await recordDecision({ adminId: req.user.id, type, id, action: action === 'approve' ? 'approve_photo' : 'remove_photo', reason });
    await query(`UPDATE photo_reviews SET status = $2, decided_by = $3, decided_at = NOW() WHERE id = $1`,
      [id, action === 'approve' ? 'approved' : 'removed', req.user.id]);
    if (action === 'remove') {
      await removePhotoEverywhere(ph.url);
      await notify(ph.user_id, 'A photo of yours was removed', `It broke the community rules (${ph.place}).${reason ? ` ${reason}` : ''}`);
      if (adult) await recordAdultStrike(ph.user_id, `a ${ph.place}`);
    }
    return res.json({ ok: true });
  }

  const table = type === 'post' ? 'posts' : type === 'comment' ? 'comments' : null;
  if (!table || !['restore', 'remove', 'dismiss'].includes(action)) throw httpError(400, 'Unknown moderation action.');
  const col = table === 'posts' ? 'post_id' : 'comment_id';
  const { rows: [exists] } = await query(`SELECT id FROM ${table} WHERE id = $1`, [id]);
  if (!exists) throw httpError(404, 'Not found.');
  await recordDecision({ adminId: req.user.id, type, id, action: action === 'remove' && adult ? 'remove_adult' : action, reason });
  const { rows: [row] } = await query(
    `UPDATE ${table} SET status = $2, report_count = CASE WHEN $3 THEN report_count ELSE 0 END WHERE id = $1
     RETURNING author_id, body${table === 'comments' ? ', post_id' : ', community_id'}`,
    [id, action === 'remove' ? 'removed' : 'visible', action === 'remove']);
  await query(`UPDATE content_reports SET resolved_at = NOW() WHERE ${col} = $1 AND resolved_at IS NULL`, [id]);
  if (action === 'remove') {
    if (table === 'posts') await query('UPDATE communities SET post_count = GREATEST(0, post_count - 1) WHERE id = $1', [row.community_id]);
    else await query('UPDATE posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = $1', [row.post_id]);
    await notify(row.author_id, `Your ${type} was removed`,
      `It broke the community rules: "${snippet(row.body || '', 60)}"${reason ? ` — ${reason}` : ''}`);
    if (adult) await recordAdultStrike(row.author_id, 'reported content');
  }
  res.json({ ok: true });
});

// A removed photo disappears wherever it was used.
async function removePhotoEverywhere(url) {
  const name = url.split('/').pop();
  await query('DELETE FROM public_images WHERE name = $1', [name]);
  await query('DELETE FROM item_images WHERE url = $1', [url]);
  await query(
    `UPDATE posts SET attachments = COALESCE((SELECT jsonb_agg(a) FROM jsonb_array_elements(attachments) a
                                              WHERE a->>'url' <> $1 AND COALESCE(a->>'poster', '') <> $1), '[]'::jsonb)
      WHERE attachments::text LIKE '%' || $1 || '%'`, [url]);
  await query('DELETE FROM stories WHERE image_url = $1', [url]);
  await query('UPDATE users SET avatar_url = NULL, avatar_matched = FALSE WHERE avatar_url = $1', [url]);
}

// ---------------------------------------------------------------- members

router.get('/users', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.handle, u.avatar_url, u.role, u.status, u.suspended_reason, u.created_at,
            u.warning_count, u.content_strikes,
            (u.role <> 'member' OR (u.verification_status = 'verified' AND u.nid_number IS NOT NULL)) AS verified,
            (SELECT COUNT(*)::int FROM posts p WHERE p.author_id = u.id AND p.status <> 'removed') AS posts,
            (SELECT COUNT(*)::int FROM moderation_actions m WHERE m.user_id = u.id AND m.action IN ('remove', 'remove_adult', 'remove_photo')) AS removals
       FROM users u
      WHERE $1 = '' OR u.name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%' OR u.handle ILIKE '%' || $1 || '%'
      ORDER BY (u.status = 'suspended') DESC, u.warning_count + u.content_strikes DESC, u.created_at DESC
      LIMIT 60`, [q]);
  res.json(rows);
});

router.get('/users/:id/history', async (req, res) => {
  const { rows } = await query(
    `SELECT m.action, m.target_type, m.target_id, m.reason, m.created_at, a.name AS admin_name
       FROM moderation_actions m LEFT JOIN users a ON a.id = m.admin_id
      WHERE m.user_id = $1 ORDER BY m.created_at DESC LIMIT 30`, [req.params.id]);
  res.json(rows);
});

async function memberOrFail(id, me) {
  const { rows: [u] } = await query('SELECT id, name, role, status FROM users WHERE id = $1', [id]);
  if (!u) throw httpError(404, 'Member not found.');
  if (u.id === me) throw httpError(400, 'You cannot do that to your own account.');
  if (u.role === 'admin') throw httpError(400, 'Admins cannot be warned or banned here.');
  return u;
}

// POST /api/moderation/users/:id/warn  { reason }
router.post('/users/:id/warn', async (req, res) => {
  const u = await memberOrFail(Number(req.params.id), req.user.id);
  const reason = String(req.body.reason || '').trim();
  if (reason.length < 5) throw httpError(400, 'Write the member a short reason for the warning.');
  await query('UPDATE users SET warning_count = warning_count + 1 WHERE id = $1', [u.id]);
  await recordDecision({ adminId: req.user.id, type: 'user', id: u.id, userId: u.id, action: 'warn', reason });
  await notify(u.id, 'Warning from the RentalFlow team', `${reason.slice(0, 280)} Please follow the community rules — repeated problems lead to a ban.`);
  res.json({ ok: true });
});

// POST /api/moderation/users/:id/ban  { reason }
router.post('/users/:id/ban', async (req, res) => {
  const u = await memberOrFail(Number(req.params.id), req.user.id);
  const reason = String(req.body.reason || '').trim();
  if (reason.length < 5) throw httpError(400, 'Write a short reason for the ban.');
  await query(`UPDATE users SET status = 'suspended', suspended_reason = $2 WHERE id = $1`, [u.id, `Banned: ${reason.slice(0, 200)}`]);
  await recordDecision({ adminId: req.user.id, type: 'user', id: u.id, userId: u.id, action: 'ban', reason });
  res.json({ ok: true });
});

router.post('/users/:id/unban', async (req, res) => {
  const u = await memberOrFail(Number(req.params.id), req.user.id);
  await query(`UPDATE users SET status = 'active', suspended_reason = NULL WHERE id = $1`, [u.id]);
  await recordDecision({ adminId: req.user.id, type: 'user', id: u.id, userId: u.id, action: 'unban', reason: req.body.reason || null });
  await notify(u.id, 'Your account is active again', 'The RentalFlow team lifted the ban on your account. Welcome back — please keep to the community rules.');
  res.json({ ok: true });
});

// ---------------------------------------------------------------- communities

// POST /api/moderation/communities  { name, description }
router.post('/communities', async (req, res) => {
  const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 60) throw httpError(400, 'Give the community a name of 3–60 characters.');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) throw httpError(400, 'Use letters or numbers in the name.');
  const description = String(req.body.description || '').trim().slice(0, 300)
    || `Everything ${name.toLowerCase()}: show what you shot or built, ask before you rent, and find what you need.`;
  const { rows: [c] } = await query(
    `INSERT INTO communities (slug, name, description, created_by) VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO NOTHING RETURNING id, slug, name, description`, [slug, name, description, req.user.id]);
  if (!c) throw httpError(409, 'A community with that name already exists.');
  res.status(201).json(c);
});

// ---------------------------------------------------------------- the report

router.get('/report', async (req, res) => {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 7;
  const { rows: actions } = await query(
    `SELECT m.action, m.target_type, m.user_id, u.name AS user_name, m.reason, m.predicted, m.created_at
       FROM moderation_actions m LEFT JOIN users u ON u.id = m.user_id
      WHERE m.created_at > NOW() - make_interval(days => $1) ORDER BY m.created_at DESC`, [days]);
  const { rows: all } = await query(`SELECT action, features FROM moderation_actions WHERE features IS NOT NULL`);
  const { rows: [photos] } = await query(
    `SELECT COUNT(*) FILTER (WHERE status = 'approved' AND decided_at > NOW() - make_interval(days => $1))::int AS approved,
            COUNT(*) FILTER (WHERE status = 'removed' AND decided_at > NOW() - make_interval(days => $1))::int AS removed,
            COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
       FROM photo_reviews`, [days]);
  const { rows: reasons } = await query(
    `SELECT cr.reason,
            COUNT(*) FILTER (WHERE ma.action IN ('remove', 'remove_adult'))::int AS upheld,
            COUNT(*) FILTER (WHERE ma.action IN ('restore', 'dismiss'))::int AS dismissed
       FROM content_reports cr
       JOIN moderation_actions ma
         ON (ma.target_type = 'post' AND ma.target_id = cr.post_id) OR (ma.target_type = 'comment' AND ma.target_id = cr.comment_id)
      WHERE ma.created_at > NOW() - make_interval(days => $1)
      GROUP BY cr.reason`, [days]);

  // What is waiting, with the model's guess.
  const model = await currentModel();
  const { rows: waiting } = await query(
    `SELECT 'post' AS type, id FROM posts WHERE status <> 'removed' AND (status = 'hidden' OR EXISTS (SELECT 1 FROM content_reports r WHERE r.post_id = posts.id AND r.resolved_at IS NULL))
     UNION ALL SELECT 'comment', id FROM comments WHERE status <> 'removed' AND (status = 'hidden' OR EXISTS (SELECT 1 FROM content_reports r WHERE r.comment_id = comments.id AND r.resolved_at IS NULL))
     UNION ALL SELECT 'photo', id FROM photo_reviews WHERE status = 'pending'
     LIMIT 200`);
  const pending = [];
  for (const w of waiting) {
    const a = await assess(w.type, w.id);
    if (a) pending.push({ p: a.p, user_id: a.user_id, user_name: a.user_name });
  }
  res.json(buildReport({ days, actions, all, pending, photos, reasons, model }));
});

export default router;
