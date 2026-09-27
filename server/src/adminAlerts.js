// ============================================================
//  RentalFlow  |  Trust  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: tell the admins the moment something looks fishy
// ============================================================
// Anything suspicious — deleting and reposting to jump the feed, sharing a
// phone number or asking to pay outside RentalFlow in a locked chat, adult
// content, a blacklisted ID, a report of an off-platform deal — lands in every
// admin's notifications straight away (the bell checks every few seconds).
// Never throws: the member's request must not fail because of an alert.
import { query } from './db.js';

export async function alertAdmins(title, body, link = '/admin/moderation?tab=members') {
  try {
    await query(
      `INSERT INTO notifications (user_id, type, title, body, link)
       SELECT id, 'admin_alert', $1, $2, $3 FROM users WHERE role = 'admin' AND status <> 'suspended'`,
      [`⚠ ${String(title).slice(0, 150)}`, String(body).slice(0, 500), link]);
  } catch (e) {
    console.error('Could not alert the admins:', e.message);
  }
}

// "Rahim Uddin (rahim@…, #2)" — who did it, for the alert text.
export async function who(userId) {
  const { rows: [u] } = await query('SELECT name, email FROM users WHERE id = $1', [userId]).catch(() => ({ rows: [] }));
  return u ? `${u.name} (${u.email}, #${userId})` : `member #${userId}`;
}
