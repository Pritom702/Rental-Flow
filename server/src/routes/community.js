// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: social API — feed, posts, comments, stories
// ============================================================
// Communities (one per category), a feed, posts with photos / files / links /
// polls / "wanted" requests / things for sale / tagged listings, reactions, threaded comments,
// saves, shares, follows, 24-hour moments, profiles, trending and moderation.
//
// Reading is public (a guest can scroll the feed, which helps new people find
// RentalFlow); everything else needs an account with a confirmed email.
// All raw SQL. Counters are stored on their rows so the feed never counts.
import { Router } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { pool, query } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { grant, award } from '../rewards.js';
import { fetchPreview } from '../linkPreview.js';
import { assertCleanImage, recordAdultStrike, adultError } from '../moderation.js';
import { screenImage } from '../nsfwEngine.js';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { head } from '@vercel/blob';
import { noteInterestLater, interestSql } from '../interests.js';
import {
  HOT_SQL, parseHashtags, parseMentions, handleFromName, policyCheck, sniffFile,
  levelFor, BADGES, badgeInfo,
} from '../socialUtils.js';

const router = Router();

const KINDS = ['post', 'showcase', 'question', 'guide', 'wanted', 'poll', 'sell'];
// RentalFlow's own reactions, and how a notification says each one.
const REACTIONS = {
  spark: 'sparked', want: 'wants what you posted in', genius: 'found genius', wow: 'was wowed by', lol: 'laughed at', adore: 'adores',
};
const PAGE = 12;
const REPORTS_TO_HIDE = 3;
const MILESTONES = [10, 25, 50, 100, 250, 500];

function httpError(status, message, extra = {}) {
  return Object.assign(new Error(message), { status, ...extra });
}

// Reading is open to guests: decode the token when there is one.
function viewerId(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try { return jwt.verify(header.slice(7), process.env.JWT_SECRET).id; } catch { return null; }
}

// New categories get their community the first time anyone looks.
async function ensureCommunities() {
  await query(
    `INSERT INTO communities (category_id, slug, name, description)
     SELECT c.id, TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(c.name, '[^a-zA-Z0-9]+', '-', 'g'))), c.name,
            'Everything ' || LOWER(c.name) || ': show what you shot or built, ask before you rent, and find what you need.'
       FROM categories c
      WHERE NOT EXISTS (SELECT 1 FROM communities m WHERE m.category_id = c.id)
     ON CONFLICT (slug) DO NOTHING`
  );
}

// Accounts made after the social layer launched get their @handle lazily.
async function ensureHandle(userId) {
  const { rows: [u] } = await query('SELECT id, name, handle FROM users WHERE id = $1', [userId]);
  if (!u || u.handle) return u?.handle || null;
  const base = handleFromName(u.name);
  const { rows } = await query('SELECT 1 FROM users WHERE LOWER(handle) = $1', [base]);
  const handle = rows.length ? `${base}${u.id}` : base;
  await query('UPDATE users SET handle = $2 WHERE id = $1 AND handle IS NULL', [u.id, handle]);
  return handle;
}

// ---------------------------------------------------------------- notifications
// Reactions on one post fold into a single unread notification ("Karim and
// 3 others reacted"), so a popular post does not flood the bell.
async function notify(userId, actorId, type, link, title, body, { fold = false } = {}) {
  if (!userId || userId === actorId) return;
  if (fold) {
    const { rowCount } = await query(
      `UPDATE notifications SET title = $4, body = $5, actor_id = $6, created_at = NOW()
        WHERE user_id = $1 AND type = $2 AND link = $3 AND read_at IS NULL`,
      [userId, type, link, title, body, actorId]
    );
    if (rowCount) return;
  }
  await query(
    `INSERT INTO notifications (user_id, type, title, body, link, actor_id) VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, title.slice(0, 160), body, link, actorId]
  );
}
const snippet = (text, n = 90) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
async function nameOf(userId) {
  const { rows } = await query('SELECT name FROM users WHERE id = $1', [userId]);
  return rows[0]?.name || 'Someone';
}

// The week's top 3 posts (most reactions + comments). Everyone sees them near
// the top of their feed, marked "Top post".
const TOP_SQL = `(p.id IN (SELECT t.id FROM posts t WHERE t.status = 'visible' AND t.created_at > NOW() - INTERVAL '7 days'
    AND t.reaction_count + t.comment_count > 0 ORDER BY t.reaction_count + 2 * t.comment_count DESC, t.id DESC LIMIT 3))`;

// ---------------------------------------------------------------- posts, as the feed shows them
function postSelect(viewer) {
  const v = viewer ? Number(viewer) : null;
  return `
    SELECT p.id, p.community_id, p.author_id, p.kind, p.body, p.attachments, p.link, p.poll, p.wanted, p.sale,
           p.item_id, p.hashtags, p.reaction_count, p.comment_count, p.share_count, p.status,
           p.created_at, p.edited_at,
           u.name AS author_name, u.handle AS author_handle,
           (u.role <> 'member' OR (u.verification_status = 'verified' AND u.nid_number IS NOT NULL)) AS author_verified,
           COALESCE(us.xp, 0) AS author_xp, COALESCE(us.streak_days, 0) AS author_streak,
           c.slug AS community_slug, c.name AS community_name, c.category_id,
           ${TOP_SQL} AS is_top,
           i.name AS item_name, i.rental_price AS item_price, i.status AS item_status,
           (SELECT url FROM item_images WHERE item_id = i.id ORDER BY position, id LIMIT 1) AS item_cover,
           (SELECT COALESCE(json_agg(t), '[]') FROM (
              SELECT type, COUNT(*)::int AS n FROM post_reactions WHERE post_id = p.id
               GROUP BY type ORDER BY n DESC LIMIT 3) t) AS top_reactions,
           (SELECT json_build_object('id', cm.id, 'author', cu.name, 'handle', cu.handle, 'body', LEFT(cm.body, 200), 'likes', cm.like_count)
              FROM comments cm JOIN users cu ON cu.id = cm.author_id
             WHERE cm.post_id = p.id AND cm.status = 'visible' AND cm.parent_id IS NULL
             ORDER BY cm.like_count DESC, cm.id LIMIT 1) AS top_comment,
           ${v ? `(SELECT type FROM post_reactions WHERE post_id = p.id AND user_id = ${v}) AS my_reaction,
           EXISTS (SELECT 1 FROM post_saves WHERE post_id = p.id AND user_id = ${v}) AS saved,
           (SELECT option_idx FROM poll_votes WHERE post_id = p.id AND user_id = ${v}) AS my_vote,
           EXISTS (SELECT 1 FROM follows WHERE follower_id = ${v} AND followee_id = p.author_id) AS following_author,
           ROUND(${interestSql(v)}::numeric, 1)::float AS my_interest`
    : `NULL AS my_reaction, FALSE AS saved, NULL AS my_vote, FALSE AS following_author, 0 AS my_interest`}
      FROM posts p
      JOIN users u ON u.id = p.author_id
      JOIN communities c ON c.id = p.community_id
      LEFT JOIN user_stats us ON us.user_id = p.author_id
      LEFT JOIN items i ON i.id = p.item_id`;
}
function shapePost(row) {
  const level = levelFor(row.author_xp);
  return { ...row, author_level: level.level, author_level_name: level.name };
}
async function loadPost(id, viewer) {
  const { rows } = await query(`${postSelect(viewer)} WHERE p.id = $1`, [id]);
  return rows[0] ? shapePost(rows[0]) : null;
}

// ---------------------------------------------------------------- me
// GET /api/community/me — my level, streak, badges, communities.
router.get('/me', authRequired, async (req, res) => {
  const handle = await ensureHandle(req.user.id);
  await query('INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [req.user.id]);
  const { rows: [s] } = await query(
    `SELECT us.*, u.bio, u.community_rules_at FROM user_stats us JOIN users u ON u.id = us.user_id WHERE us.user_id = $1`,
    [req.user.id]
  );
  const { rows: joined } = await query(
    `SELECT c.id, c.slug, c.name FROM community_members m JOIN communities c ON c.id = m.community_id
      WHERE m.user_id = $1 ORDER BY c.name`, [req.user.id]
  );
  const unlocked = new Set(s.badges);
  res.json({
    handle,
    bio: s.bio,
    rulesAccepted: Boolean(s.community_rules_at),
    xp: s.xp,
    karma: s.karma,
    level: levelFor(s.xp),
    streak: s.streak_days,
    bestStreak: s.best_streak,
    activeToday: s.last_active_date === new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date()),
    badges: BADGES.map((b) => ({ ...badgeInfo(b.id), unlocked: unlocked.has(b.id) })),
    joined,
  });
});

// PATCH /api/community/me — bio and @handle.
router.patch('/me', authRequired, async (req, res) => {
  const { bio, handle } = req.body;
  if (handle !== undefined) {
    const h = String(handle).trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(h)) throw httpError(400, 'A handle is 3–20 letters, numbers or underscores.');
    const { rows } = await query('SELECT 1 FROM users WHERE LOWER(handle) = $1 AND id <> $2', [h, req.user.id]);
    if (rows.length) throw httpError(409, `@${h} is taken. Try another.`);
    await query('UPDATE users SET handle = $2 WHERE id = $1', [req.user.id, h]);
  }
  if (bio !== undefined) {
    const b = String(bio).trim().slice(0, 200);
    const bad = policyCheck(b);
    if (bad) throw httpError(400, bad);
    await query('UPDATE users SET bio = $2 WHERE id = $1', [req.user.id, b || null]);
  }
  res.json({ ok: true });
});

router.post('/rules/accept', authRequired, async (req, res) => {
  await query('UPDATE users SET community_rules_at = COALESCE(community_rules_at, NOW()) WHERE id = $1', [req.user.id]);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- communities
router.get('/communities', async (req, res) => {
  await ensureCommunities();
  const me = viewerId(req);
  const { rows } = await query(
    `SELECT c.id, c.slug, c.name, c.description, c.member_count, c.post_count, c.category_id,
            (SELECT COUNT(*)::int FROM posts p WHERE p.community_id = c.id AND p.status = 'visible'
                AND p.created_at > NOW() - INTERVAL '7 days') AS posts_this_week,
            (SELECT COUNT(*)::int FROM items i WHERE i.category_id = c.category_id AND i.status = 'Available') AS listings,
            ${me ? `EXISTS (SELECT 1 FROM community_members m WHERE m.community_id = c.id AND m.user_id = ${Number(me)})` : 'FALSE'} AS joined
       FROM communities c
      ORDER BY c.member_count DESC, c.post_count DESC, c.name`
  );
  res.json(rows);
});

router.get('/c/:slug', async (req, res) => {
  const me = viewerId(req);
  const { rows: [c] } = await query(
    `SELECT c.*, ${me ? `EXISTS (SELECT 1 FROM community_members m WHERE m.community_id = c.id AND m.user_id = ${Number(me)})` : 'FALSE'} AS joined,
            (SELECT COUNT(*)::int FROM items i WHERE i.category_id = c.category_id AND i.status = 'Available') AS listings
       FROM communities c WHERE c.slug = $1`, [req.params.slug]
  );
  if (!c) throw httpError(404, 'That community does not exist.');
  // Top voices this week: the members whose posts here drew the most.
  const { rows: leaders } = await query(
    `SELECT u.id, u.name, u.handle, SUM(p.reaction_count + 2 * p.comment_count)::int AS points
       FROM posts p JOIN users u ON u.id = p.author_id
      WHERE p.community_id = $1 AND p.status = 'visible' AND p.created_at > NOW() - INTERVAL '7 days'
      GROUP BY u.id ORDER BY points DESC LIMIT 5`, [c.id]
  );
  res.json({ ...c, leaders });
});

async function setMembership(req, res, join) {
  const { rows: [c] } = await query('SELECT id FROM communities WHERE slug = $1', [req.params.slug]);
  if (!c) throw httpError(404, 'That community does not exist.');
  if (join) {
    const { rowCount } = await query(
      'INSERT INTO community_members (community_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [c.id, req.user.id]);
    if (rowCount) {
      await query('UPDATE communities SET member_count = member_count + 1 WHERE id = $1', [c.id]);
      grant(res, 'join');
      noteInterestLater(req.user.id, { communityId: c.id }, 'join');
    }
  } else {
    const { rowCount } = await query('DELETE FROM community_members WHERE community_id = $1 AND user_id = $2', [c.id, req.user.id]);
    if (rowCount) await query('UPDATE communities SET member_count = GREATEST(0, member_count - 1) WHERE id = $1', [c.id]);
  }
  const { rows: [n] } = await query('SELECT member_count FROM communities WHERE id = $1', [c.id]);
  res.json({ joined: join, member_count: n.member_count });
}
router.post('/c/:slug/join', authRequired, (req, res) => setMembership(req, res, true));
router.delete('/c/:slug/join', authRequired, (req, res) => setMembership(req, res, false));

// Join several at once (the "pick your communities" welcome screen).
router.post('/join-many', authRequired, async (req, res) => {
  const slugs = Array.isArray(req.body.slugs) ? req.body.slugs.slice(0, 30).map(String) : [];
  const { rows } = await query(
    `WITH added AS (
       INSERT INTO community_members (community_id, user_id)
       SELECT id, $2 FROM communities WHERE slug = ANY($1)
       ON CONFLICT DO NOTHING RETURNING community_id)
     UPDATE communities SET member_count = member_count + 1 WHERE id IN (SELECT community_id FROM added) RETURNING id`,
    [slugs, req.user.id]
  );
  if (rows.length) grant(res, 'join');
  for (const r of rows) noteInterestLater(req.user.id, { communityId: r.id }, 'join');
  res.json({ joined: rows.length });
});

// ---------------------------------------------------------------- feed
// GET /api/community/feed?scope=home|all|following|saved&sort=hot|new|top
//     &community=<slug>&tag=<tag>&q=<text>&author=<id>&item=<id>&kind=<kind>&offset=<n>
function feedFilters(req, me, params) {
  const where = [`p.status = 'visible'`];
  const add = (sql, value) => { params.push(value); where.push(sql.replace('$?', `$${params.length}`)); };
  const { scope = 'all', community, tag, q, author, item, kind } = req.query;

  if (community) add(`c.slug = $?`, String(community));
  if (tag) add(`p.hashtags @> ARRAY[$?]::text[]`, String(tag).toLowerCase().replace(/^#/, ''));
  if (q) add(`p.body ILIKE $?`, `%${String(q).slice(0, 80)}%`);
  if (author) add(`p.author_id = $?`, Number(author));
  if (item) add(`p.item_id = $?`, Number(item));
  if (kind && KINDS.includes(kind)) add(`p.kind = $?`, kind);
  if (req.query.media === 'video') where.push(`p.attachments @> '[{"type":"video"}]'`);

  if (me && scope === 'following') {
    add(`p.author_id IN (SELECT followee_id FROM follows WHERE follower_id = $?)`, me);
  } else if (me && scope === 'saved') {
    add(`p.id IN (SELECT post_id FROM post_saves WHERE user_id = $?)`, me);
  }
  return where;
}

// "For you" never filters anything out (a feed must not come up empty just
// because someone joined a quiet community); it ranks:
//   fresh engagement (hot)
//   × what I am into — learned from what I view, book, list, react to, read
//     and join (interests.js), on a log scale so one topic cannot take over
//   × people I follow
//   × the week's top posts, which everyone gets to see
function forYouOrder(me, params) {
  params.push(me);
  const n = params.length;
  // A gentler age penalty than "Hot" (power 1.15 instead of 1.5), so a post
  // from a day ago about something I love can still beat a fresh one I don't.
  return `(((p.reaction_count + 2 * p.comment_count + 1)
      / POWER(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 + 2, 1.15))
    * (1 + 2.5 * LN(1 + ${interestSql(`$${n}`)})
         + 1.5 * (p.author_id IN (SELECT followee_id FROM follows WHERE follower_id = $${n}))::int
         + 3 * ${TOP_SQL}::int)) DESC, p.id DESC`;
}

router.get('/feed', async (req, res) => {
  const me = viewerId(req);
  const params = [];
  const where = feedFilters(req, me, params);
  const sort = ['hot', 'new', 'top'].includes(req.query.sort) ? req.query.sort : 'hot';
  if (sort === 'top') where.push(`p.created_at > NOW() - INTERVAL '7 days'`);
  const order = sort === 'new' ? 'p.created_at DESC, p.id DESC'
    : sort === 'top' ? '(p.reaction_count + 2 * p.comment_count) DESC, p.id DESC'
      : me && req.query.scope === 'home' ? forYouOrder(me, params)
        : `(${HOT_SQL} * (1 + 2.5 * ${TOP_SQL}::int)) DESC, p.id DESC`;
  const offset = Math.max(0, Math.min(Number(req.query.offset) || 0, 2000));
  params.push(PAGE + 1, offset);
  const { rows } = await query(
    `${postSelect(me)} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const more = rows.length > PAGE;
  res.json({ posts: rows.slice(0, PAGE).map(shapePost), nextOffset: more ? offset + PAGE : null });
});

// GET /api/community/feed/new-count?since=<iso> — for the "3 new posts" pill.
router.get('/feed/new-count', async (req, res) => {
  const me = viewerId(req);
  const since = new Date(req.query.since);
  if (Number.isNaN(since.getTime())) return res.json({ count: 0 });
  const params = [];
  const where = feedFilters(req, me, params);
  params.push(since.toISOString());
  where.push(`p.created_at > $${params.length}`);
  if (me) { params.push(me); where.push(`p.author_id <> $${params.length}`); }
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM posts p JOIN communities c ON c.id = p.community_id WHERE ${where.join(' AND ')}`, params
  );
  res.json(rows[0]);
});

// ---------------------------------------------------------------- one post + its comments
router.get('/posts/:id', async (req, res) => {
  const me = viewerId(req);
  const post = await loadPost(req.params.id, me);
  const isAdmin = req.headers.authorization && (() => {
    try { return jwt.verify(req.headers.authorization.slice(7), process.env.JWT_SECRET).role === 'admin'; } catch { return false; }
  })();
  if (!post || (post.status !== 'visible' && post.author_id !== me && !isAdmin)) throw httpError(404, 'This post is not available.');
  if (me) noteInterestLater(me, { communityId: post.community_id }, 'read_post');
  const { rows: comments } = await query(
    `SELECT cm.id, cm.parent_id, cm.body, cm.like_count, cm.created_at, cm.author_id, cm.status,
            u.name AS author_name, u.handle AS author_handle,
            (u.role <> 'member' OR (u.verification_status = 'verified' AND u.nid_number IS NOT NULL)) AS author_verified,
            ${me ? `EXISTS (SELECT 1 FROM comment_likes l WHERE l.comment_id = cm.id AND l.user_id = ${Number(me)})` : 'FALSE'} AS liked
       FROM comments cm JOIN users u ON u.id = cm.author_id
      WHERE cm.post_id = $1 AND (cm.status = 'visible' OR cm.author_id = $2)
      ORDER BY cm.id`, [post.id, me || 0]
  );
  res.json({ ...post, comments });
});

// ---------------------------------------------------------------- create a post
async function rateLimit(userId, table, perDay, newAccountPerDay) {
  const { rows: [u] } = await query(
    `SELECT (created_at > NOW() - INTERVAL '1 day') AS brand_new,
            (SELECT COUNT(*)::int FROM ${table} WHERE author_id = $1 AND created_at > NOW() - INTERVAL '1 day') AS today
       FROM users WHERE id = $1`, [userId]
  );
  const limit = u.brand_new ? newAccountPerDay : perDay;
  if (u.today >= limit) {
    throw httpError(429, u.brand_new
      ? `New accounts can post ${limit} times on their first day. Come back tomorrow for more.`
      : `That's the daily limit of ${limit}. Take a break and come back tomorrow!`);
  }
}

// A video lives in the Blob store, under a path that names its uploader.
const BLOB_HOST = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/;
async function cleanVideo(a, me) {
  let u;
  try { u = new URL(String(a.url)); } catch { return null; }
  if (u.protocol !== 'https:' || !BLOB_HOST.test(u.hostname) || !u.pathname.startsWith(`/videos/u${me}-`)) return null;
  const poster = String(a.poster || '');
  if (!/^\/api\/community\/files\/s-[\w.-]+$/.test(poster)) return null;
  const { rows } = await query('SELECT 1 FROM public_images WHERE name = $1', [poster.split('/').pop()]);
  if (!rows.length) return null;
  try {
    const info = await head(u.href);
    if (!info.contentType?.startsWith('video/')) return null;
    return {
      type: 'video', url: u.href, poster, mime: info.contentType, size: info.size,
      duration: Math.min(600, Number(a.duration) || 0) || null,
      w: Number(a.w) || null, h: Number(a.h) || null,
      color: /^#[0-9a-f]{6}$/i.test(a.color || '') ? a.color : null,
      name: '',
    };
  } catch { return null; }
}

async function cleanAttachments(list, me) {
  if (!Array.isArray(list) || !list.length) return [];
  const videos = [];
  for (const a of list.filter((x) => x && x.type === 'video').slice(0, 1)) {
    const v = await cleanVideo(a, me);
    if (v) videos.push(v);
  }
  list = list.filter((x) => x && x.type !== 'video');
  const clean = list.slice(0, 10).map((a) => ({
    url: String(a.url || ''),
    name: String(a.name || '').slice(0, 120),
    w: Number(a.w) || null,
    h: Number(a.h) || null,
    color: /^#[0-9a-f]{6}$/i.test(a.color || '') ? a.color : null,
  })).filter((a) => /^\/api\/community\/files\/s-[\w.-]+$/.test(a.url));
  const names = clean.map((a) => a.url.split('/').pop());
  const { rows } = await query(
    'SELECT name, mime, octet_length(data)::int AS size FROM public_images WHERE name = ANY($1)', [names]
  );
  const found = Object.fromEntries(rows.map((r) => [r.name, r]));
  return [...videos, ...clean
    .filter((a) => found[a.url.split('/').pop()])
    .map((a) => {
      const f = found[a.url.split('/').pop()];
      return { ...a, mime: f.mime, size: f.size, type: f.mime.startsWith('image/') ? 'image' : 'file' };
    })];
}

router.post('/posts', authRequired, async (req, res) => {
  const me = req.user.id;
  const { rows: [u] } = await query('SELECT community_rules_at FROM users WHERE id = $1', [me]);
  if (!u?.community_rules_at) throw httpError(428, 'Please read and accept the community rules first.', { reason: 'rules-required' });
  await rateLimit(me, 'posts', 25, 3);

  const kind = KINDS.includes(req.body.kind) ? req.body.kind : 'post';
  const body = String(req.body.body || '').trim().slice(0, 5000);
  const bad = policyCheck(body);
  if (bad) throw httpError(400, bad);

  const { rows: [community] } = await query('SELECT id, name, category_id FROM communities WHERE slug = $1', [req.body.community]);
  if (!community) throw httpError(400, 'Pick a community to post in.');

  const attachments = await cleanAttachments(req.body.attachments, me);

  let link = null;
  if (req.body.link_url) link = await fetchPreview(req.body.link_url);

  let poll = null;
  if (kind === 'poll') {
    const options = (Array.isArray(req.body.poll_options) ? req.body.poll_options : [])
      .map((o) => String(o).trim().slice(0, 80)).filter(Boolean).slice(0, 4);
    if (options.length < 2) throw httpError(400, 'A poll needs at least two options.');
    if (options.some((o) => policyCheck(o))) throw httpError(400, policyCheck(options.find((o) => policyCheck(o))));
    poll = { options, counts: options.map(() => 0), closes_at: new Date(Date.now() + 3 * 86400000).toISOString() };
  }

  let wanted = null;
  if (kind === 'wanted') {
    const w = req.body.wanted || {};
    wanted = {
      budget: Number(w.budget) > 0 ? Math.round(Number(w.budget)) : null,
      from: /^\d{4}-\d{2}-\d{2}$/.test(w.from || '') ? w.from : null,
      to: /^\d{4}-\d{2}-\d{2}$/.test(w.to || '') ? w.to : null,
      area: w.area ? String(w.area).slice(0, 60) : null,
    };
  }

  let sale = null;
  if (kind === 'sell') {
    const s = req.body.sale || {};
    const price = Math.round(Number(s.price));
    if (!(price > 0 && price < 100000000)) throw httpError(400, 'Set a price for what you are selling.');
    if (!attachments.some((a) => a.type === 'image' || a.type === 'video')) throw httpError(400, 'Add at least one photo of what you are selling.');
    const conditions = ['new', 'like_new', 'good', 'fair', 'for_parts'];
    sale = {
      price,
      condition: conditions.includes(s.condition) ? s.condition : 'good',
      negotiable: Boolean(s.negotiable),
      sold: false,
    };
  }

  let itemId = null;
  if (req.body.item_id) {
    const { rows } = await query('SELECT id FROM items WHERE id = $1', [req.body.item_id]);
    itemId = rows[0]?.id || null;
  }

  if (!body && !attachments.length && !link && !poll) throw httpError(400, 'Write something, or add a photo, file or link.');

  const { rows: [created] } = await query(
    `INSERT INTO posts (community_id, author_id, kind, body, attachments, link, poll, wanted, sale, item_id, hashtags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [community.id, me, kind, body, JSON.stringify(attachments), link, poll, wanted, sale, itemId, parseHashtags(body)]
  );
  await query('UPDATE communities SET post_count = post_count + 1 WHERE id = $1', [community.id]);
  await query(
    `INSERT INTO user_stats (user_id, post_count) VALUES ($1, 1)
     ON CONFLICT (user_id) DO UPDATE SET post_count = user_stats.post_count + 1`, [me]
  );
  // Posting also joins you to that community.
  const joined = await query('INSERT INTO community_members (community_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [community.id, me]);
  if (joined.rowCount) await query('UPDATE communities SET member_count = member_count + 1 WHERE id = $1', [community.id]);

  const author = await nameOf(me);
  const linkTo = `/post/${created.id}`;
  for (const h of parseMentions(body)) {
    const { rows: [m] } = await query('SELECT id FROM users WHERE LOWER(handle) = $1', [h]);
    if (m) await notify(m.id, me, 'social_mention', linkTo, `${author} mentioned you`, snippet(body));
  }
  // A "wanted" request reaches the people who list that kind of item.
  if (kind === 'wanted' && community.category_id) {
    const { rows: owners } = await query(
      `SELECT DISTINCT owner_id FROM items WHERE category_id = $1 AND owner_id <> $2 LIMIT 25`, [community.category_id, me]);
    for (const o of owners) {
      await notify(o.owner_id, me, 'social_wanted', linkTo, `${author} is looking for something you list`, snippet(body));
    }
  }

  grant(res, 'post', ...(poll ? ['poll'] : []));
  noteInterestLater(me, { communityId: community.id }, 'post');
  res.status(201).json(await loadPost(created.id, me));
});

router.patch('/posts/:id', authRequired, async (req, res) => {
  const body = String(req.body.body || '').trim().slice(0, 5000);
  const bad = policyCheck(body);
  if (bad) throw httpError(400, bad);
  const { rowCount } = await query(
    `UPDATE posts SET body = $3, hashtags = $4, edited_at = NOW() WHERE id = $1 AND author_id = $2 AND status <> 'removed'`,
    [req.params.id, req.user.id, body, parseHashtags(body)]
  );
  if (!rowCount) throw httpError(404, 'You can only edit your own posts.');
  res.json(await loadPost(req.params.id, req.user.id));
});

// PATCH /api/community/posts/:id/sale  { sold: true|false } — the seller marks it sold.
router.patch('/posts/:id/sale', authRequired, async (req, res) => {
  const { rows: [p] } = await query(
    `UPDATE posts SET sale = jsonb_set(sale, '{sold}', to_jsonb($3::boolean))
      WHERE id = $1 AND author_id = $2 AND kind = 'sell' RETURNING sale`,
    [req.params.id, req.user.id, Boolean(req.body.sold)]);
  if (!p) throw httpError(404, 'You can only update your own sale posts.');
  if (req.body.sold) grant(res, 'sold');
  res.json(p);
});

router.delete('/posts/:id', authRequired, async (req, res) => {
  const { rows: [p] } = await query('SELECT author_id, community_id, status FROM posts WHERE id = $1', [req.params.id]);
  if (!p || p.status === 'removed') throw httpError(404, 'Post not found.');
  if (p.author_id !== req.user.id && req.user.role !== 'admin') throw httpError(403, 'You can only delete your own posts.');
  await query(`UPDATE posts SET status = 'removed' WHERE id = $1`, [req.params.id]);
  await query('UPDATE communities SET post_count = GREATEST(0, post_count - 1) WHERE id = $1', [p.community_id]);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- reactions, saves, shares, polls
router.post('/posts/:id/react', authRequired, async (req, res) => {
  const me = req.user.id;
  const type = req.body.type ? String(req.body.type) : null;
  if (type && !REACTIONS[type]) throw httpError(400, 'Unknown reaction.');
  const { rows: [p] } = await query(`SELECT id, author_id, body, reaction_count FROM posts WHERE id = $1 AND status = 'visible'`, [req.params.id]);
  if (!p) throw httpError(404, 'This post is not available.');

  const client = await pool.connect();
  let added = false;
  try {
    await client.query('BEGIN');
    const { rows: [old] } = await client.query('SELECT type FROM post_reactions WHERE post_id = $1 AND user_id = $2 FOR UPDATE', [p.id, me]);
    if (!type) {
      if (old) {
        await client.query('DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2', [p.id, me]);
        await client.query('UPDATE posts SET reaction_count = GREATEST(0, reaction_count - 1) WHERE id = $1', [p.id]);
      }
    } else if (old) {
      await client.query('UPDATE post_reactions SET type = $3 WHERE post_id = $1 AND user_id = $2', [p.id, me, type]);
    } else {
      await client.query('INSERT INTO post_reactions (post_id, user_id, type) VALUES ($1, $2, $3)', [p.id, me, type]);
      await client.query('UPDATE posts SET reaction_count = reaction_count + 1 WHERE id = $1', [p.id]);
      added = true;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const { rows: [now] } = await query('SELECT reaction_count FROM posts WHERE id = $1', [p.id]);
  if (added) noteInterestLater(me, { postId: p.id }, 'react');
  if (added && p.author_id !== me) {
    grant(res, 'react');
    award(p.author_id, ['reaction_received']).catch(() => {});
    const others = now.reaction_count - 1;
    const who = await nameOf(me);
    await notify(p.author_id, me, 'social_reaction', `/post/${p.id}`,
      `${who}${others > 0 ? ` and ${others} other${others === 1 ? '' : 's'}` : ''} ${others > 0 ? 'reacted to' : REACTIONS[type].replace(/ in$/, '')} your post`,
      snippet(p.body) || 'Your post', { fold: true });
    if (MILESTONES.includes(now.reaction_count)) {
      await notify(p.author_id, null, 'social_milestone', `/post/${p.id}`,
        `Your post just hit ${now.reaction_count} reactions`, snippet(p.body) || 'Keep it up!');
    }
  }
  const { rows: top } = await query(
    `SELECT type, COUNT(*)::int AS n FROM post_reactions WHERE post_id = $1 GROUP BY type ORDER BY n DESC LIMIT 3`, [p.id]);
  res.json({ my_reaction: type, reaction_count: now.reaction_count, top_reactions: top });
});

router.post('/posts/:id/save', authRequired, async (req, res) => {
  const del = await query('DELETE FROM post_saves WHERE post_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (del.rowCount) return res.json({ saved: false });
  await query('INSERT INTO post_saves (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, req.user.id]);
  noteInterestLater(req.user.id, { postId: Number(req.params.id) }, 'save');
  res.json({ saved: true });
});

router.post('/posts/:id/share', authRequired, async (req, res) => {
  const { rows } = await query('UPDATE posts SET share_count = share_count + 1 WHERE id = $1 RETURNING share_count', [req.params.id]);
  if (!rows[0]) throw httpError(404, 'Post not found.');
  grant(res, 'share');
  noteInterestLater(req.user.id, { postId: Number(req.params.id) }, 'share');
  res.json(rows[0]);
});

router.post('/posts/:id/vote', authRequired, async (req, res) => {
  const { rows: [p] } = await query(`SELECT id, poll FROM posts WHERE id = $1 AND status = 'visible'`, [req.params.id]);
  if (!p?.poll) throw httpError(404, 'This poll is not available.');
  if (new Date(p.poll.closes_at) < new Date()) throw httpError(409, 'This poll has closed.');
  const option = Number(req.body.option);
  if (!Number.isInteger(option) || option < 0 || option >= p.poll.options.length) throw httpError(400, 'Pick one of the options.');
  const { rowCount } = await query(
    'INSERT INTO poll_votes (post_id, user_id, option_idx) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [p.id, req.user.id, option]);
  if (!rowCount) throw httpError(409, 'You already voted in this poll.');
  const { rows } = await query('SELECT option_idx, COUNT(*)::int AS n FROM poll_votes WHERE post_id = $1 GROUP BY option_idx', [p.id]);
  const counts = p.poll.options.map((_, i) => rows.find((r) => r.option_idx === i)?.n || 0);
  const poll = { ...p.poll, counts };
  await query('UPDATE posts SET poll = $2 WHERE id = $1', [p.id, poll]);
  grant(res, 'vote');
  noteInterestLater(req.user.id, { postId: p.id }, 'vote');
  res.json({ poll, my_vote: option });
});

// ---------------------------------------------------------------- comments
router.post('/posts/:id/comments', authRequired, async (req, res) => {
  const me = req.user.id;
  const body = String(req.body.body || '').trim().slice(0, 2000);
  if (!body) throw httpError(400, 'Write a comment first.');
  const bad = policyCheck(body);
  if (bad) throw httpError(400, bad);
  await rateLimit(me, 'comments', 200, 30);
  const { rows: [p] } = await query(`SELECT id, author_id, body FROM posts WHERE id = $1 AND status = 'visible'`, [req.params.id]);
  if (!p) throw httpError(404, 'This post is not available.');

  let parent = null;
  if (req.body.parent_id) {
    const { rows } = await query('SELECT id, author_id, parent_id FROM comments WHERE id = $1 AND post_id = $2', [req.body.parent_id, p.id]);
    parent = rows[0] || null;
    if (!parent) throw httpError(400, 'That comment is gone.');
  }
  // One level of replies: replying to a reply joins the same thread.
  const parentId = parent ? (parent.parent_id || parent.id) : null;
  const { rows: [c] } = await query(
    'INSERT INTO comments (post_id, author_id, parent_id, body) VALUES ($1, $2, $3, $4) RETURNING id', [p.id, me, parentId, body]);
  await query('UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1', [p.id]);
  await query(
    `INSERT INTO user_stats (user_id, comment_count) VALUES ($1, 1)
     ON CONFLICT (user_id) DO UPDATE SET comment_count = user_stats.comment_count + 1`, [me]);

  const who = await nameOf(me);
  const link = `/post/${p.id}#c${c.id}`;
  const told = new Set([me]);
  if (parent && !told.has(parent.author_id)) {
    await notify(parent.author_id, me, 'social_reply', link, `${who} replied to you`, snippet(body));
    told.add(parent.author_id);
  }
  if (!told.has(p.author_id)) {
    await notify(p.author_id, me, 'social_comment', link, `${who} commented on your post`, snippet(body));
    told.add(p.author_id);
  }
  for (const h of parseMentions(body)) {
    const { rows: [m] } = await query('SELECT id FROM users WHERE LOWER(handle) = $1', [h]);
    if (m && !told.has(m.id)) { await notify(m.id, me, 'social_mention', link, `${who} mentioned you`, snippet(body)); told.add(m.id); }
  }

  grant(res, 'comment');
  noteInterestLater(me, { postId: p.id }, 'comment');
  const { rows: [out] } = await query(
    `SELECT cm.id, cm.parent_id, cm.body, cm.like_count, cm.created_at, cm.author_id, cm.status,
            u.name AS author_name, u.handle AS author_handle, FALSE AS liked,
            (u.role <> 'member' OR (u.verification_status = 'verified' AND u.nid_number IS NOT NULL)) AS author_verified
       FROM comments cm JOIN users u ON u.id = cm.author_id WHERE cm.id = $1`, [c.id]);
  res.status(201).json(out);
});

router.delete('/comments/:id', authRequired, async (req, res) => {
  const { rows: [c] } = await query('SELECT author_id, post_id, status FROM comments WHERE id = $1', [req.params.id]);
  if (!c || c.status === 'removed') throw httpError(404, 'Comment not found.');
  if (c.author_id !== req.user.id && req.user.role !== 'admin') throw httpError(403, 'You can only delete your own comments.');
  await query(`UPDATE comments SET status = 'removed' WHERE id = $1`, [req.params.id]);
  await query('UPDATE posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = $1', [c.post_id]);
  res.json({ ok: true });
});

router.post('/comments/:id/like', authRequired, async (req, res) => {
  const del = await query('DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  let liked = false;
  if (del.rowCount) {
    await query('UPDATE comments SET like_count = GREATEST(0, like_count - 1) WHERE id = $1', [req.params.id]);
  } else {
    const ins = await query(
      `INSERT INTO comment_likes (comment_id, user_id) SELECT id, $2 FROM comments WHERE id = $1 AND status = 'visible'
       ON CONFLICT DO NOTHING`, [req.params.id, req.user.id]);
    if (!ins.rowCount) throw httpError(404, 'Comment not found.');
    await query('UPDATE comments SET like_count = like_count + 1 WHERE id = $1', [req.params.id]);
    liked = true;
    grant(res, 'react');
  }
  const { rows: [c] } = await query('SELECT like_count FROM comments WHERE id = $1', [req.params.id]);
  res.json({ liked, like_count: c.like_count });
});

// ---------------------------------------------------------------- reports + moderation
const REPORT_REASONS = ['spam', 'scam', 'abuse', 'adult', 'violence', 'illegal', 'misleading', 'other'];

router.post('/report', authRequired, async (req, res) => {
  const reason = REPORT_REASONS.includes(req.body.reason) ? req.body.reason : 'other';
  const note = req.body.note ? String(req.body.note).slice(0, 300) : null;
  const table = req.body.post_id ? 'posts' : req.body.comment_id ? 'comments' : null;
  if (!table) throw httpError(400, 'Say what you are reporting.');
  const id = Number(req.body.post_id || req.body.comment_id);
  const { rowCount } = await query(
    `INSERT INTO content_reports (${table === 'posts' ? 'post_id' : 'comment_id'}, reporter_id, reason, note)
     VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [id, req.user.id, reason, note]);
  if (rowCount) {
    // Enough separate reports hide it until an admin decides.
    await query(
      `UPDATE ${table} SET report_count = report_count + 1,
              status = CASE WHEN status = 'visible' AND report_count + 1 >= $2 THEN 'hidden' ELSE status END
        WHERE id = $1`, [id, REPORTS_TO_HIDE]);
    const { rows: admins } = await query(`SELECT id FROM users WHERE role = 'admin' AND status = 'active'`);
    for (const a of admins) {
      await notify(a.id, req.user.id, 'social_moderation', '/admin/moderation', 'Community content was reported', `Reason: ${reason}`, { fold: true });
    }
  }
  res.json({ ok: true });
});

router.get('/moderation', authRequired, requireRole('admin'), async (_req, res) => {
  const { rows: posts } = await query(
    `SELECT p.id, p.body, p.attachments, p.link, p.status, p.report_count, p.created_at, u.name AS author_name, c.slug AS community_slug,
            (SELECT COALESCE(json_agg(json_build_object('reason', r.reason, 'note', r.note)), '[]')
               FROM content_reports r WHERE r.post_id = p.id AND r.resolved_at IS NULL) AS reports
       FROM posts p JOIN users u ON u.id = p.author_id JOIN communities c ON c.id = p.community_id
      WHERE p.status = 'hidden' OR EXISTS (SELECT 1 FROM content_reports r WHERE r.post_id = p.id AND r.resolved_at IS NULL)
      ORDER BY p.report_count DESC, p.created_at DESC LIMIT 100`);
  const { rows: comments } = await query(
    `SELECT cm.id, cm.post_id, cm.body, cm.status, cm.report_count, cm.created_at, u.name AS author_name,
            (SELECT COALESCE(json_agg(json_build_object('reason', r.reason, 'note', r.note)), '[]')
               FROM content_reports r WHERE r.comment_id = cm.id AND r.resolved_at IS NULL) AS reports
       FROM comments cm JOIN users u ON u.id = cm.author_id
      WHERE cm.status = 'hidden' OR EXISTS (SELECT 1 FROM content_reports r WHERE r.comment_id = cm.id AND r.resolved_at IS NULL)
      ORDER BY cm.report_count DESC, cm.created_at DESC LIMIT 100`);
  res.json({ posts, comments });
});

// POST /api/community/moderation/:type/:id  { action: 'restore' | 'remove' | 'dismiss' }
router.post('/moderation/:type/:id', authRequired, requireRole('admin'), async (req, res) => {
  const table = req.params.type === 'post' ? 'posts' : req.params.type === 'comment' ? 'comments' : null;
  const { action } = req.body;
  if (!table || !['restore', 'remove', 'dismiss'].includes(action)) throw httpError(400, 'Unknown moderation action.');
  const col = table === 'posts' ? 'post_id' : 'comment_id';
  const status = action === 'remove' ? 'removed' : 'visible';
  const { rows: [row] } = await query(
    `UPDATE ${table} SET status = $2, report_count = CASE WHEN $3 THEN report_count ELSE 0 END WHERE id = $1
     RETURNING author_id, body${table === 'comments' ? ', post_id' : ''}`,
    [req.params.id, status, action === 'remove']);
  if (!row) throw httpError(404, 'Not found.');
  await query(`UPDATE content_reports SET resolved_at = NOW() WHERE ${col} = $1 AND resolved_at IS NULL`, [req.params.id]);
  if (action === 'remove') {
    if (table === 'posts') {
      await query('UPDATE communities SET post_count = GREATEST(0, post_count - 1) WHERE id = (SELECT community_id FROM posts WHERE id = $1)', [req.params.id]);
    } else {
      await query('UPDATE posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = $1', [row.post_id]);
    }
    await notify(row.author_id, null, 'social_moderation', null,
      `Your ${table === 'posts' ? 'post' : 'comment'} was removed`,
      `It broke the community rules: "${snippet(row.body, 60)}"`);
    // Adult content confirmed by an admin counts as a strike (warning, then ban).
    if (req.body.adult) await recordAdultStrike(row.author_id, 'reported content');
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------- files
// Photos arrive already shrunk to WebP by the browser; documents as they are.
// 3.5 MB keeps a request under the host's 4.5 MB limit.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3.5 * 1024 * 1024, files: 1 } });

router.post('/upload', authRequired, (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    try {
      if (err) throw httpError(400, err.code === 'LIMIT_FILE_SIZE' ? 'Files can be up to 3.5 MB.' : err.message);
      if (!req.file) throw httpError(400, 'No file was sent.');
      const kind = sniffFile(req.file.buffer, req.file.originalname);
      if (kind.error) throw httpError(400, kind.error);
      if (req.query.images === '1' && kind.type !== 'image') throw httpError(400, 'Moments must be a photo.');
      // No adult content: every photo is checked before it is stored.
      if (kind.type === 'image') await assertCleanImage(req.file.buffer, kind.mime, req.user.id, 'a community photo');
      const name = `s-${Date.now()}-${Math.round(Math.random() * 1e9)}.${kind.ext}`;
      await query('INSERT INTO public_images (name, mime, data) VALUES ($1, $2, $3)', [name, kind.mime, req.file.buffer]);
      res.status(201).json({
        url: `/api/community/files/${name}`, type: kind.type, mime: kind.mime,
        name: String(req.file.originalname || name).slice(0, 120), size: req.file.size,
      });
    } catch (e) { next(e); }
  });
});

// GET /api/community/files/:name — served with headers that stop a browser
// from ever treating a shared file as a web page.
router.get('/files/:name', async (req, res) => {
  if (!/^s-[\w.-]+$/.test(req.params.name)) throw httpError(404, 'File not found.');
  const { rows } = await query('SELECT mime, data FROM public_images WHERE name = $1', [req.params.name]);
  if (!rows[0]) throw httpError(404, 'File not found.');
  const { mime, data } = rows[0];
  res.set('Content-Type', mime);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
  if (!mime.startsWith('image/') && mime !== 'application/pdf') {
    res.set('Content-Disposition', `attachment; filename="${req.params.name}"`);
  }
  if (!mime.startsWith('image/')) res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
  res.send(data);
});

// ---------------------------------------------------------------- videos
// 1. The app pulls a few frames from the video and sends them here. Each is
//    checked for adult content; a clean set earns a 30-minute clearance.
// 2. With the clearance the app asks for a one-time upload token and sends
//    the video straight to the Blob store (the API never carries video bytes,
//    so the 4.5 MB request limit does not apply and the server stays light).
const frameUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 800 * 1024, files: 8 } });
const VIDEO_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
const MAX_VIDEO = 100 * 1024 * 1024;

router.post('/video/check', authRequired, (req, res, next) => {
  frameUpload.array('frames', 8)(req, res, async (err) => {
    try {
      if (err) throw httpError(400, 'Those video frames could not be read.');
      if (!req.files?.length) throw httpError(400, 'No frames were sent.');
      if (!process.env.BLOB_READ_WRITE_TOKEN) throw httpError(503, 'Video uploads are not switched on for this server yet.');
      for (const f of req.files) {
        const { verdict } = await screenImage(f.buffer, 'image/jpeg');
        if (verdict === 'adult') throw adultError(await recordAdultStrike(req.user.id, 'a video'));
        if (verdict === 'revealing') throw httpError(400, 'This video is too revealing for RentalFlow.', { reason: 'revealing' });
      }
      const clearance = jwt.sign({ id: req.user.id, purpose: 'video' }, process.env.JWT_SECRET, { expiresIn: '30m' });
      res.json({ clearance });
    } catch (e) { next(e); }
  });
});

router.post('/video/token', authRequired, async (req, res) => {
  let ok = false;
  try {
    const c = jwt.verify(String(req.body.clearance || ''), process.env.JWT_SECRET);
    ok = c.purpose === 'video' && c.id === req.user.id;
  } catch { ok = false; }
  if (!ok) throw httpError(403, 'Check the video again before uploading.');
  const ext = VIDEO_TYPES[req.body.type];
  if (!ext) throw httpError(400, 'Share videos as MP4, WebM or MOV.');
  if (!(Number(req.body.size) > 0 && Number(req.body.size) <= MAX_VIDEO)) throw httpError(400, 'Videos can be up to 100 MB.');
  const pathname = `videos/u${req.user.id}-${Date.now()}.${ext}`;
  const token = await generateClientTokenFromReadWriteToken({
    token: process.env.BLOB_READ_WRITE_TOKEN,
    pathname,
    allowedContentTypes: [req.body.type],
    maximumSizeInBytes: MAX_VIDEO,
    validUntil: Date.now() + 30 * 60 * 1000,
    addRandomSuffix: true,
  });
  res.json({ token, pathname });
});

router.get('/link-preview', authRequired, async (req, res) => {
  res.json(await fetchPreview(String(req.query.url || '')));
});

// ---------------------------------------------------------------- people
router.get('/users/search', async (req, res) => {
  const q = String(req.query.q || '').replace(/^@/, '').trim().toLowerCase();
  if (!q) return res.json([]);
  const { rows } = await query(
    `SELECT id, name, handle FROM users
      WHERE status = 'active' AND handle IS NOT NULL AND (LOWER(handle) LIKE $1 OR LOWER(name) LIKE $2)
      ORDER BY (LOWER(handle) LIKE $1) DESC, name LIMIT 6`, [`${q}%`, `%${q}%`]);
  res.json(rows);
});

router.get('/users/:who', async (req, res) => {
  const me = viewerId(req);
  const who = String(req.params.who);
  const { rows: [u] } = await query(
    `SELECT u.id, u.name, u.handle, u.bio, u.role, u.created_at,
            (u.role <> 'member' OR (u.verification_status = 'verified' AND u.nid_number IS NOT NULL)) AS verified,
            COALESCE(us.xp, 0) AS xp, COALESCE(us.karma, 0) AS karma, COALESCE(us.streak_days, 0) AS streak,
            COALESCE(us.best_streak, 0) AS best_streak, COALESCE(us.badges, '{}') AS badges,
            (SELECT COUNT(*)::int FROM follows WHERE followee_id = u.id) AS followers,
            (SELECT COUNT(*)::int FROM follows WHERE follower_id = u.id) AS following,
            (SELECT COUNT(*)::int FROM posts WHERE author_id = u.id AND status = 'visible') AS posts,
            (SELECT COUNT(*)::int FROM bookings b JOIN items i ON i.id = b.item_id
              WHERE i.owner_id = u.id AND b.status = 'Completed') AS rentals_hosted,
            ${me ? `EXISTS (SELECT 1 FROM follows WHERE follower_id = ${Number(me)} AND followee_id = u.id)` : 'FALSE'} AS is_following
       FROM users u LEFT JOIN user_stats us ON us.user_id = u.id
      WHERE ${/^\d+$/.test(who) ? 'u.id = $1' : 'LOWER(u.handle) = LOWER($1)'} AND u.status = 'active'`, [who]);
  if (!u) throw httpError(404, 'That person could not be found.');
  const { rows: listings } = await query(
    `SELECT i.id, i.name, i.rental_price, i.status,
            (SELECT url FROM item_images WHERE item_id = i.id ORDER BY position, id LIMIT 1) AS cover_url
       FROM items i WHERE i.owner_id = $1 AND i.status <> 'Retired' ORDER BY i.created_at DESC LIMIT 6`, [u.id]);
  const { rows: communities } = await query(
    `SELECT c.slug, c.name FROM community_members m JOIN communities c ON c.id = m.community_id
      WHERE m.user_id = $1 ORDER BY m.joined_at LIMIT 8`, [u.id]);
  const unlocked = new Set(u.badges);
  res.json({
    ...u,
    level: levelFor(u.xp),
    badges: BADGES.filter((b) => unlocked.has(b.id)).map((b) => badgeInfo(b.id)),
    listings,
    communities,
    isMe: me === u.id,
  });
});

router.post('/users/:id/follow', authRequired, async (req, res) => {
  const target = Number(req.params.id);
  if (target === req.user.id) throw httpError(400, 'You cannot follow yourself.');
  const del = await query('DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2', [req.user.id, target]);
  let following = false;
  if (!del.rowCount) {
    const ins = await query(
      `INSERT INTO follows (follower_id, followee_id) SELECT $1, id FROM users WHERE id = $2 AND status = 'active' ON CONFLICT DO NOTHING`,
      [req.user.id, target]);
    if (!ins.rowCount) throw httpError(404, 'That person could not be found.');
    following = true;
    grant(res, 'follow');
    const who = await nameOf(req.user.id);
    const { rows: [h] } = await query('SELECT handle FROM users WHERE id = $1', [req.user.id]);
    await notify(target, req.user.id, 'social_follow', `/u/${h?.handle || req.user.id}`, `${who} started following you`, 'Follow back to see their posts in your feed.');
  }
  const { rows: [n] } = await query('SELECT COUNT(*)::int AS followers FROM follows WHERE followee_id = $1', [target]);
  res.json({ following, followers: n.followers });
});

// ---------------------------------------------------------------- trending
// Cached for a minute per server instance: it is the same for everyone.
let trendingCache = { at: 0, data: null };
router.get('/trending', async (_req, res) => {
  if (Date.now() - trendingCache.at < 60000 && trendingCache.data) return res.json(trendingCache.data);
  const [tags, top, leaders, rising] = await Promise.all([
    query(`SELECT tag, COUNT(*)::int AS n FROM posts, UNNEST(hashtags) AS tag
            WHERE status = 'visible' AND created_at > NOW() - INTERVAL '7 days'
            GROUP BY tag ORDER BY n DESC, tag LIMIT 8`),
    query(`SELECT p.id, LEFT(p.body, 120) AS body, p.reaction_count, p.comment_count, c.slug AS community_slug, c.name AS community_name,
                  (SELECT a->>'url' FROM jsonb_array_elements(p.attachments) a WHERE a->>'type' = 'image' LIMIT 1) AS image
             FROM posts p JOIN communities c ON c.id = p.community_id
            WHERE p.status = 'visible' AND p.created_at > NOW() - INTERVAL '7 days'
            ORDER BY (p.reaction_count + 2 * p.comment_count) DESC, p.id DESC LIMIT 4`),
    query(`SELECT u.id, u.name, u.handle, COALESCE(us.xp, 0) AS xp, COALESCE(us.streak_days, 0) AS streak,
                  SUM(p.reaction_count + 2 * p.comment_count + 3)::int AS points
             FROM posts p JOIN users u ON u.id = p.author_id LEFT JOIN user_stats us ON us.user_id = u.id
            WHERE p.status = 'visible' AND p.created_at > NOW() - INTERVAL '7 days'
            GROUP BY u.id, us.xp, us.streak_days ORDER BY points DESC LIMIT 5`),
    query(`SELECT c.slug, c.name, c.member_count, COUNT(p.id)::int AS posts
             FROM communities c LEFT JOIN posts p ON p.community_id = c.id AND p.status = 'visible'
                  AND p.created_at > NOW() - INTERVAL '7 days'
            GROUP BY c.id ORDER BY posts DESC, c.member_count DESC LIMIT 5`),
  ]);
  const data = {
    tags: tags.rows,
    top: top.rows,
    leaders: leaders.rows.map((l) => ({ ...l, level: levelFor(l.xp).level })),
    rising: rising.rows,
  };
  trendingCache = { at: Date.now(), data };
  res.json(data);
});

// ---------------------------------------------------------------- moments (24-hour stories)
router.get('/stories', async (req, res) => {
  const me = viewerId(req);
  if (Math.random() < 0.05) query(`DELETE FROM stories WHERE expires_at < NOW() - INTERVAL '1 day'`).catch(() => {});
  const { rows } = await query(
    `SELECT s.id, s.user_id, s.image_url, s.caption, s.color, s.item_id, s.view_count, s.created_at,
            u.name, u.handle, i.name AS item_name,
            ${me ? `EXISTS (SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.user_id = ${Number(me)})` : 'FALSE'} AS seen,
            ${me ? `EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${Number(me)} AND f.followee_id = s.user_id)` : 'FALSE'} AS followed
       FROM stories s JOIN users u ON u.id = s.user_id LEFT JOIN items i ON i.id = s.item_id
      WHERE s.expires_at > NOW()
      ORDER BY s.created_at`);
  const byUser = new Map();
  for (const s of rows) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, { user_id: s.user_id, name: s.name, handle: s.handle, followed: s.followed, stories: [] });
    byUser.get(s.user_id).stories.push(s);
  }
  const groups = [...byUser.values()].map((g) => ({
    ...g,
    mine: g.user_id === me,
    unseen: g.stories.some((s) => !s.seen),
    latest: g.stories[g.stories.length - 1].created_at,
  }));
  // Mine first, then unseen (people I follow first), then already watched.
  groups.sort((a, b) => (b.mine - a.mine) || (b.unseen - a.unseen) || (b.followed - a.followed) || (new Date(b.latest) - new Date(a.latest)));
  res.json(groups.slice(0, 40));
});

router.post('/stories', authRequired, async (req, res) => {
  const url = String(req.body.image_url || '');
  if (!/^\/api\/community\/files\/s-[\w.-]+$/.test(url)) throw httpError(400, 'Add a photo first.');
  const { rows: [f] } = await query('SELECT mime FROM public_images WHERE name = $1', [url.split('/').pop()]);
  if (!f?.mime.startsWith('image/')) throw httpError(400, 'Moments must be a photo.');
  const caption = req.body.caption ? String(req.body.caption).trim().slice(0, 140) : null;
  const bad = policyCheck(caption || '');
  if (bad) throw httpError(400, bad);
  const { rows: [{ n }] } = await query(
    `SELECT COUNT(*)::int AS n FROM stories WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 day'`, [req.user.id]);
  if (n >= 10) throw httpError(429, 'That is 10 moments today. Save some for tomorrow!');
  const color = /^#[0-9a-f]{6}$/i.test(req.body.color || '') ? req.body.color : null;
  const itemId = Number(req.body.item_id) || null;
  const { rows: [s] } = await query(
    `INSERT INTO stories (user_id, image_url, caption, color, item_id)
     VALUES ($1, $2, $3, $4, (SELECT id FROM items WHERE id = $5)) RETURNING *`,
    [req.user.id, url, caption, color, itemId]);
  grant(res, 'story');
  res.status(201).json(s);
});

router.post('/stories/:id/view', authRequired, async (req, res) => {
  const { rowCount } = await query(
    `INSERT INTO story_views (story_id, user_id) SELECT id, $2 FROM stories WHERE id = $1 AND user_id <> $2 ON CONFLICT DO NOTHING`,
    [req.params.id, req.user.id]);
  if (rowCount) await query('UPDATE stories SET view_count = view_count + 1 WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

router.delete('/stories/:id', authRequired, async (req, res) => {
  await query(`DELETE FROM stories WHERE id = $1 AND (user_id = $2 OR $3)`, [req.params.id, req.user.id, req.user.role === 'admin']);
  res.json({ ok: true });
});

export default router;
