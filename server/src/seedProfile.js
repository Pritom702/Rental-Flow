// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: Demo data for NID verification + payment methods
// ============================================================
// Usage: npm run db:seed5   (run after db:init / db:seed / db:seed4)
//
// Karim is seeded as ALREADY verified, so the demo can show the "identity on
// file, cannot be changed" state. Rahim is left UNVERIFIED on purpose, so the
// one-time NID step can be demonstrated live during a booking request.
import { pool, query } from './db.js';
import { maskAccountRef, defaultLabel } from './profileUtils.js';

async function main() {
  const { rows: users } = await query('SELECT id, email FROM users');
  const idOf = (email) => users.find((u) => u.email === email)?.id ?? null;

  const karim = idOf('karim@rentalflow.test');
  const admin = idOf('admin@rentalflow.test');

  // --- NID on file (damage control) ---
  // The write-once trigger rejects any change, so only fill an empty one.
  const verified = [
    [karim, '1990123456789', 'Karim Hasan', '01811223344'],
    [admin, '19855012345678901', 'Platform Admin', '01911223344'],
  ];
  for (const [id, nid, nidName, phone] of verified) {
    if (!id) continue;
    await query(
      `UPDATE users
          SET nid_number = $2, nid_name = $3, phone = $4,
              nid_front_url = '/uploads/demo-nid-front.svg',
              nid_back_url  = '/uploads/demo-nid-back.svg',
              nid_submitted_at = NOW() - INTERVAL '20 days'
        WHERE id = $1 AND nid_number IS NULL`,
      [id, nid, nidName, phone]
    );
  }

  // --- Payment methods (permanent, append-only) ---
  const methods = [
    [karim, 'bKash', '01811223344', true],
    [karim, 'Card', '4111111111111111', false],
    [admin, 'Nagad', '01911223344', true],
  ];
  let added = 0;
  for (const [userId, kind, raw, isDefault] of methods) {
    if (!userId) continue;
    const masked = maskAccountRef(kind, raw);
    // These rows can never be deleted, so never insert a duplicate.
    const { rows } = await query(
      'SELECT id FROM payment_methods WHERE user_id = $1 AND kind = $2 AND account_ref = $3',
      [userId, kind, masked]
    );
    if (rows.length) continue;
    await query(
      `INSERT INTO payment_methods (user_id, kind, label, account_ref, is_default)
       VALUES ($1,$2,$3,$4,$5)`,
      [userId, kind, defaultLabel(kind, masked), masked, isDefault]
    );
    added += 1;
  }

  const { rows: check } = await query(
    `SELECT COUNT(*) FILTER (WHERE nid_number IS NOT NULL)::int AS verified FROM users`
  );
  console.log(`✅ Profile demo data ready — ${check[0].verified} verified accounts, ${added} payment methods added.`);
  console.log('   Verified   : karim@rentalflow.test, admin@rentalflow.test');
  console.log('   UNVERIFIED : rahim@rentalflow.test  ← use this one to demo the NID step');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Failed to seed profile data:', err.message);
  process.exit(1);
});
