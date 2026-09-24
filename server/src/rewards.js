// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: the reward engine (XP, streaks, levels, badges)
// ============================================================
// Everything a member does on RentalFlow can earn a little reward — listing
// an item, booking, chatting, verifying, posting, reacting, simply coming back
// tomorrow. The rules live in socialUtils.js (applyRewards); this file stores
// the result and tells the app about it.
//
// How the app hears about a reward without every route changing its answer:
// the reward travels in an `X-Reward` response header. The frontend's fetch
// wrapper reads it and shows the "+XP" pop, the level-up and the new badge.
//
// Existing routes are recognised by method + path below, so the marketplace
// files stay untouched. Community routes add their own actions with grant().
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { applyRewards, localDate } from './socialUtils.js';

// Record actions for a member; returns what to celebrate (or null).
export async function award(userId, events) {
  if (!userId || !events?.length) return null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
    const { rows: [stats] } = await client.query('SELECT * FROM user_stats WHERE user_id = $1 FOR UPDATE', [userId]);
    const { row, reward } = applyRewards(stats, events, localDate());
    await client.query(
      `UPDATE user_stats
          SET xp = $2, karma = $3, counters = $4, today = $5, streak_days = $6,
              best_streak = $7, last_active_date = $8, badges = $9
        WHERE user_id = $1`,
      [userId, row.xp, row.karma, row.counters, row.today, row.streak_days, row.best_streak, row.last_active_date, row.badges]
    );
    await client.query('COMMIT');
    return reward;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Reward failed:', err.message);
    return null;   // a reward must never break the action itself
  } finally {
    client.release();
  }
}

// A route adds actions to the reward for this request.
export function grant(res, ...events) {
  res.locals.rewardEvents = [...(res.locals.rewardEvents || []), ...events];
}

// Marketplace actions, recognised from the request that succeeded.
const ACTIONS = [
  ['POST', /^\/items$/, () => 'list_item'],
  ['PUT', /^\/items\/\d+$/, () => 'edit_item'],
  ['GET', /^\/items\/\d+$/, () => 'view_item'],
  ['POST', /^\/bookings$/, () => 'book'],
  ['PATCH', /^\/bookings\/\d+\/status$/, (req) => ({ Approved: 'approve_booking', Completed: 'rental_completed' })[req.body?.status]],
  ['POST', /^\/bookings\/\d+\/checkin$/, () => 'return_logged'],
  ['POST', /^\/messages\/conversations$/, () => 'start_chat'],
  ['POST', /^\/messages\/conversations\/\d+$/, () => 'message'],
  ['POST', /^\/verify\/email\/confirm$/, () => 'email_verified'],
  ['POST', /^\/verify\/(nid|selfie)$/, (_req, body) => (body?.step === 'done' ? 'verify_identity' : null)],
  ['PATCH', /^\/profile$/, () => 'profile_update'],
];

// The daily check-in is noticed on a member's first request of the day. This
// in-memory note only saves a database trip; the rule itself is in the table.
const checkedIn = new Map();

function userIdFrom(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try { return jwt.verify(header.slice(7), process.env.JWT_SECRET).id; } catch { return null; }
}

export function rewardMiddleware(req, res, next) {
  const userId = userIdFrom(req);
  if (!userId) return next();
  // Captured now: routers rewrite req.path as the request travels inward.
  const method = req.method;
  const path = req.path;
  const send = res.json.bind(res);

  res.json = (body) => {
    res.json = send;
    if (res.statusCode >= 300) return send(body);
    const events = [...(res.locals.rewardEvents || [])];
    const action = ACTIONS.find(([m, re]) => m === method && re.test(path));
    const fromRoute = action && action[2](req, body);
    if (fromRoute) events.push(fromRoute);
    const today = localDate();
    if (checkedIn.get(userId) !== today) {
      checkedIn.set(userId, today);
      events.unshift('daily_visit');
    }
    if (!events.length) return send(body);

    award(userId, events)
      .then((reward) => {
        if (reward && (reward.xp > 0 || reward.levelUp || reward.badges.length) && !res.headersSent) {
          res.set('X-Reward', encodeURIComponent(JSON.stringify(reward)));
        }
      })
      .finally(() => send(body));
    return res;
  };
  next();
}
