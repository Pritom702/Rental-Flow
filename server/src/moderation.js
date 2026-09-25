// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: adult content — warning, then ban
// ============================================================
// RentalFlow does not allow porn or nudity anywhere: posts, moments, videos,
// comments' photos or listing photos.
//   1st time   the upload is refused, the member sees a clear warning and a
//              notification explains the rule
//   2nd time   the account is banned (status 'suspended'); every request
//              from then on is refused by middleware/accountStatus.js
// A strike comes from the image check (nsfwEngine.js) or from an admin who
// removes reported content as adult.
import { query } from './db.js';
import { screenImage, canScreen } from './nsfwEngine.js';

export const STRIKES_TO_BAN = 2;

export async function recordAdultStrike(userId, where) {
  const { rows: [who] } = await query('SELECT role FROM users WHERE id = $1', [userId]);
  if (who && (who.role === 'admin' || who.role === 'staff')) return { strikes: 0, banned: false };
  const { rows: [u] } = await query(
    `UPDATE users SET content_strikes = content_strikes + 1 WHERE id = $1 RETURNING content_strikes, role`, [userId]);
  if (!u) return { strikes: 0, banned: false };
  const banned = u.content_strikes >= STRIKES_TO_BAN && u.role === 'member';
  if (banned) {
    await query(
      `UPDATE users SET status = 'suspended', suspended_reason = $2 WHERE id = $1`,
      [userId, 'Banned for posting adult content twice']);
  }
  await query(
    `INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, 'social_moderation', $2, $3, NULL)`,
    [userId,
      banned ? 'Your account has been banned' : 'Warning: adult content is not allowed',
      banned
        ? `You shared adult content again (${where}). Accounts that do this twice are banned.`
        : `Porn and nudity are not allowed on RentalFlow (${where}). This is your one warning — next time your account will be banned.`]);
  return { strikes: u.content_strikes, banned };
}

// The error the API answers with, so the app can show the right screen.
export function adultError({ banned }) {
  return Object.assign(new Error(banned
    ? 'Your account has been banned for posting adult content twice.'
    : 'Warning: porn and nudity are not allowed on RentalFlow. This is your only warning — if it happens again, your account will be banned.'), {
    status: 403,
    reason: banned ? 'adult-banned' : 'adult-warning',
  });
}

// Admin and staff accounts run the platform; their uploads are never checked
// or given strikes (a false alarm on an admin's photo must not warn them).
export const trusted = (role) => role === 'admin' || role === 'staff';

// Check a photo before it is stored. Throws the right error when refused;
// otherwise returns { verdict, scores } — 'unsure' photos are stored and then
// queued for an admin with queuePhotoReview().
export async function assertCleanImage(buffer, mime, user, where) {
  if (!canScreen(mime)) {
    throw Object.assign(new Error('Photos must be JPEG or PNG.'), { status: 400 });
  }
  const { id: userId, role } = typeof user === 'object' ? user : { id: user };
  if (trusted(role)) return { verdict: 'ok', scores: null };
  const result = await screenImage(buffer, mime);
  if (result.verdict === 'adult') throw adultError(await recordAdultStrike(userId, where));
  return result;
}

// A photo the check was not sure about: it stays up, and an admin decides.
// Their decisions teach the moderation model (moderationModel.js).
export async function queuePhotoReview(userId, url, place, result) {
  if (result?.verdict !== 'unsure') return;
  await query(
    `INSERT INTO photo_reviews (user_id, url, place, scores) VALUES ($1, $2, $3, $4)`,
    [userId, url, place, JSON.stringify(result.scores || {})]).catch(() => {});
}
