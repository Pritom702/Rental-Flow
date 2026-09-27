// ============================================================
//  RentalFlow  |  Marketplace  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: fair play — no delete-and-repost to jump the feed
// ============================================================
// The feed shows the newest listings and posts first. Deleting something and
// putting the same thing up again would push it back to the top, so a repost
// of something deleted in the last day earns a one-hour break from posting
// and listing (users.post_cooldown_until, the same break the posting limit uses).
import { query } from './db.js';
import { alertAdmins, who } from './adminAlerts.js';
import { cooldownLeft, cooldownMessage } from './socialUtils.js';
import { REPOST_WINDOW_HOURS, REPOST_COOLDOWN_MINUTES, fingerprint } from './marketUtils.js';

const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });

// Remember what was deleted (a listing's name, a post's first line).
export async function noteDeletion(userId, kind, text) {
  const fp = fingerprint(text);
  if (!userId || !fp) return;
  await query('INSERT INTO content_deletions (user_id, kind, fingerprint) VALUES ($1, $2, $3)', [userId, kind, fp]).catch(() => {});
}

// Throws 429 while a break is running, and starts one for a repost.
export async function assertNotRepost(userId, text) {
  const { rows: [u] } = await query('SELECT post_cooldown_until FROM users WHERE id = $1', [userId]);
  const left = cooldownLeft(u?.post_cooldown_until);
  if (left) throw httpError(429, cooldownMessage(left), { reason: 'post-cooldown', minutes: left });
  const fp = fingerprint(text);
  if (fp.length < 8) return;   // "hi", "sold!" — too short to call it the same post
  const { rows } = await query(
    `SELECT 1 FROM content_deletions WHERE user_id = $1 AND fingerprint = $2
        AND deleted_at > NOW() - make_interval(hours => $3) LIMIT 1`,
    [userId, fp, REPOST_WINDOW_HOURS]);
  if (!rows.length) return;
  await query(`UPDATE users SET post_cooldown_until = NOW() + make_interval(mins => $2) WHERE id = $1`, [userId, REPOST_COOLDOWN_MINUTES]);
  // Used once: the break is the penalty, after it the member may post it.
  await query('DELETE FROM content_deletions WHERE user_id = $1 AND fingerprint = $2', [userId, fp]);
  await alertAdmins('Delete-and-repost caught', `${await who(userId)} deleted “${fp}” and tried to put it up again to get back to the top of the feed. They are paused for 1 hour.`);
  throw httpError(429,
    'You deleted this and put it up again to get back to the top of the feed. That is not allowed, so posting and listing are paused for 1 hour.',
    { reason: 'repost-cooldown', minutes: REPOST_COOLDOWN_MINUTES });
}
