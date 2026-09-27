// ============================================================
//  RentalFlow  |  Messaging  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: the other person's profile, record and history
// ============================================================
// Shown beside every chat, to both people, so a deal is made with full
// transparency. Every number is counted from real bookings, sales and
// moderation records; the trust score is trustScore() in marketUtils.js.
import { query } from './db.js';
import { trustScore } from './marketUtils.js';

export async function personRecord(userId) {
  const { rows: [r] } = await query(
    `SELECT u.id, u.name, u.handle, u.avatar_url, u.created_at AS member_since, u.status,
            (u.verification_status = 'verified' AND u.nid_number IS NOT NULL AND u.phone_verified_at IS NOT NULL) AS verified,
            u.warning_count, u.content_strikes,
            (SELECT COUNT(*) FROM items i WHERE i.owner_id = u.id AND i.status <> 'Retired')::int AS listings,
            (SELECT COUNT(*) FROM bookings b WHERE b.renter_id = u.id AND b.status = 'Completed')::int AS rented,
            (SELECT COUNT(*) FROM bookings b WHERE b.renter_id = u.id AND b.status = 'Completed'
                AND (b.late_fee_amount > 0 OR b.penalty_amount > 0))::int AS rented_with_charges,
            (SELECT COUNT(*) FROM bookings b WHERE b.renter_id = u.id AND b.status = 'Missing')::int AS not_returned,
            (SELECT COUNT(*) FROM bookings b JOIN items i ON i.id = b.item_id
              WHERE i.owner_id = u.id AND b.status = 'Completed')::int AS lent,
            (SELECT COUNT(*) FROM bookings b JOIN items i ON i.id = b.item_id
              WHERE i.owner_id = u.id AND b.status = 'Rejected')::int AS lend_rejected,
            (SELECT COUNT(*) FROM sale_deals d WHERE d.buyer_id = u.id AND d.status IN ('accepted', 'completed'))::int AS bought,
            (SELECT COUNT(*) FROM sale_deals d WHERE d.seller_id = u.id AND d.status IN ('accepted', 'completed'))::int AS sold,
            (SELECT COUNT(*) FROM sale_deals d WHERE (d.buyer_id = u.id OR d.seller_id = u.id) AND d.status IN ('declined', 'cancelled'))::int AS dropped,
            (SELECT COUNT(*) FROM damage_claims c JOIN bookings b ON b.id = c.booking_id
              WHERE b.renter_id = u.id AND c.status IN ('accepted', 'paid'))::int AS claims
       FROM users u WHERE u.id = $1`, [userId]);
  if (!r) return null;
  // good: deals that finished well; bad: charges, claims, dropped deals, items
  // never returned (counted 3×), warnings and content strikes.
  const good = (r.rented - r.rented_with_charges) + r.lent + r.bought + r.sold;
  const bad = r.rented_with_charges + r.claims + r.dropped + 3 * r.not_returned + r.warning_count + r.content_strikes;
  return { ...r, good, bad, trust: trustScore({ good, bad }) };
}

// Everything these two people have done together.
export async function sharedHistory(a, b) {
  const { rows: rentals } = await query(
    `SELECT 'rental' AS type, b.id, i.name AS title, b.start_date, b.end_date, b.status, b.paid_at, b.created_at,
            CASE WHEN i.owner_id = $1 THEN 'you lent' ELSE 'you rented' END AS side
       FROM bookings b JOIN items i ON i.id = b.item_id
      WHERE (i.owner_id = $1 AND b.renter_id = $2) OR (i.owner_id = $2 AND b.renter_id = $1)
      ORDER BY b.created_at DESC LIMIT 12`, [a, b]);
  const { rows: deals } = await query(
    `SELECT 'sale' AS type, d.id, LEFT(split_part(p.body, E'\n', 1), 60) AS title, d.price, d.status, d.paid_at, d.created_at,
            CASE WHEN d.seller_id = $1 THEN 'you sold' ELSE 'you bought' END AS side
       FROM sale_deals d LEFT JOIN posts p ON p.id = d.post_id
      WHERE (d.seller_id = $1 AND d.buyer_id = $2) OR (d.seller_id = $2 AND d.buyer_id = $1)
      ORDER BY d.created_at DESC LIMIT 12`, [a, b]);
  return [...rentals, ...deals].sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
}
