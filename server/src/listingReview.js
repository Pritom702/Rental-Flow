// ============================================================
//  RentalFlow  |  Trust  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: new listings wait for an admin's valuation
// ============================================================
// A member's new listing goes live at once, with review_status 'pending': its
// replacement cost is not confirmed yet (until then it is 60% of the price the
// owner gave). Every admin is notified with a suggested market price from
// valuationModel.js. The admin confirms (or corrects) it; the replacement cost
// becomes 60% of that, the owner is told, and the approved price becomes a new
// example the model learns from. An admin can also send a listing back for
// changes, which hides it until the owner edits it.
import { query } from './db.js';
import { learn, suggest, replacementFor, compensationFor, RECOVERY_DAYS } from './valuationModel.js';
import { syncListingPost } from './listingPosts.js';
import { earn } from './credits.js';

const taka = (n) => `৳${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const httpError = (status, message) => Object.assign(new Error(message), { status });

export async function valuationModel() {
  const { rows } = await query('SELECT category_id, daily, declared, approved_market AS approved FROM item_valuations');
  return learn(rows.map((r) => ({ category_id: r.category_id, daily: Number(r.daily), declared: Number(r.declared) || 0, approved: Number(r.approved) })));
}

export async function suggestionFor(item, model) {
  return suggest(model || await valuationModel(), { category_id: item.category_id, daily: Number(item.rental_price), declared: Number(item.market_price) || 0 });
}

async function tell(userId, type, title, body, link) {
  await query('INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, $2, $3, $4, $5)', [userId, type, title.slice(0, 160), body, link]);
}

// Right after a member creates a listing: store the suggestion, tell admins.
export async function submitForReview(itemId) {
  const { rows: [it] } = await query(
    `SELECT i.*, u.name AS owner_name, c.name AS category_name FROM items i JOIN users u ON u.id = i.owner_id
       LEFT JOIN categories c ON c.id = i.category_id WHERE i.id = $1`, [itemId]);
  if (!it) return null;
  const s = await suggestionFor(it);
  await query('UPDATE items SET suggested_market = $2 WHERE id = $1', [itemId, s.market || null]);
  const { rows: admins } = await query(`SELECT id FROM users WHERE role = 'admin' AND status <> 'suspended'`);
  for (const a of admins) {
    await tell(a.id, 'listing_review', `Set the replacement cost: ${it.name}`,
      `${it.owner_name} listed “${it.name}” (${it.category_name || 'no category'}, ${taka(it.rental_price)}/day, says it is worth ${taka(it.market_price)}). It is live. Suggested market price ${taka(s.market)} → replacement cost ${taka(s.replacement)}.`,
      '/admin/moderation?tab=review');
  }
  return s;
}

export async function approveListing(itemId, adminId, marketPrice) {
  const market = Math.round(Number(marketPrice));
  if (!(market > 0)) throw httpError(400, 'Set the market price.');
  const { rows: [it] } = await query('SELECT * FROM items WHERE id = $1', [itemId]);
  if (!it) throw httpError(404, 'Listing not found.');
  if (it.review_status === 'approved') throw httpError(409, 'The replacement cost of this listing is already set.');
  const replacement = replacementFor(market);
  await query(
    `UPDATE items SET review_status = 'approved', market_price = $2, replacement_cost = $3,
            reviewed_by = $4, reviewed_at = NOW(), review_note = NULL WHERE id = $1`,
    [itemId, market, replacement, adminId]);
  await query(
    `INSERT INTO item_valuations (item_id, category_id, daily, declared, suggested, approved_market, admin_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [itemId, it.category_id, it.rental_price, it.market_price, it.suggested_market, market, adminId]);
  await syncListingPost(itemId);
  await tell(it.owner_id, 'listing_decision', `Replacement cost set: ${it.name}`,
    `Our team checked “${it.name}”. Market price ${taka(market)}, so its replacement cost is ${taka(replacement)} (60%). `
    + `If it is ever stolen during a rental and we cannot recover it within ${RECOVERY_DAYS} days, you get ${taka(compensationFor(replacement))} (50% of the replacement cost).`,
    `/product/${itemId}`);
  return { market, replacement, compensation: compensationFor(replacement) };
}

export async function rejectListing(itemId, adminId, reason) {
  const note = String(reason || '').trim();
  if (note.length < 5) throw httpError(400, 'Tell the owner what to fix.');
  const { rows: [it] } = await query('SELECT * FROM items WHERE id = $1', [itemId]);
  if (!it) throw httpError(404, 'Listing not found.');
  await query(`UPDATE items SET review_status = 'rejected', reviewed_by = $2, reviewed_at = NOW(), review_note = $3 WHERE id = $1`,
    [itemId, adminId, note.slice(0, 300)]);
  await syncListingPost(itemId);   // hides its feed post until it is fixed
  // The listing fee comes back when the listing does not go live.
  if (it.listing_fee > 0) {
    await earn(it.owner_id, it.listing_fee, 'refund', { note: `Listing fee refund: ${it.name}`, ref: `listing-refund:${itemId}` }).catch(() => {});
    await query('UPDATE items SET listing_fee = 0 WHERE id = $1', [itemId]);
  }
  await tell(it.owner_id, 'listing_decision', `Your listing needs changes: ${it.name}`,
    `${note.slice(0, 300)} Edit it and it goes back to our team.${it.listing_fee > 0 ? ` Your ${it.listing_fee} Limes were refunded.` : ''}`,
    `/items/${itemId}/edit`);
}

// Run by the daily protection sweep: a missing item not recovered within 30
// days → the owner is compensated with 50% of its replacement cost, once.
export async function compensateUnrecovered() {
  const { rows } = await query(
    `SELECT b.id AS booking_id, i.id AS item_id, i.owner_id, i.name, i.replacement_cost
       FROM bookings b JOIN items i ON i.id = b.item_id
      WHERE b.status = 'Missing' AND i.status = 'Missing'
        AND b.missing_reported_at < NOW() - make_interval(days => $1)
        AND NOT EXISTS (SELECT 1 FROM theft_compensations t WHERE t.booking_id = b.id)`, [RECOVERY_DAYS]);
  for (const r of rows) {
    const amount = compensationFor(r.replacement_cost);
    const { rowCount } = await query(
      `INSERT INTO theft_compensations (booking_id, item_id, owner_id, replacement, amount) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (booking_id) DO NOTHING`, [r.booking_id, r.item_id, r.owner_id, r.replacement_cost, amount]);
    if (!rowCount) continue;
    await tell(r.owner_id, 'listing_decision', `Compensation for ${r.name}`,
      `We could not recover “${r.name}” within ${RECOVERY_DAYS} days, so you are paid ${taka(amount)} — 50% of its replacement cost (${taka(r.replacement_cost)}). We keep pursuing the renter.`,
      '/bookings');
    const { rows: admins } = await query(`SELECT id FROM users WHERE role = 'admin'`);
    for (const a of admins) {
      await tell(a.id, 'admin_alert', `⚠ Theft compensation paid: ${r.name}`, `${taka(amount)} to the owner (booking #${r.booking_id}).`, '/admin/incidents');
    }
  }
  return rows.length;
}
