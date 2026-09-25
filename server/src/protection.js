// ============================================================
//  RentalFlow  |  Rental protection  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: database side — standing, claims, escalation
// ============================================================
// The rules are in protectionUtils.js; this file applies them to the data.
//   standingFor(userId)   trust level, deposit quote, and anything blocking a new rental
//   openClaim(...)        turn a return's charges into a claim against the deposit
//   runEscalation(now)    move unreturned rentals through their stages (idempotent)
//   maybeRunEscalation()  the same, at most once every few minutes (called as people use the site)
import { query, pool } from './db.js';
import { identityVerified } from './middleware/requireVerified.js';
import {
  trustTier, depositFor, renterBlocks, escalationStage, hoursLate, settle,
  CLAIM_RESPONSE_HOURS, BLOCK_TEXT,
} from './protectionUtils.js';

const money = (n) => `৳${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------- notifications
export async function notifyUser(db, userId, bookingId, type, title, body) {
  if (!userId) return;
  await db.query(
    'INSERT INTO notifications (user_id, booking_id, type, title, body) VALUES ($1,$2,$3,$4,$5)',
    [userId, bookingId, type, title, body]
  );
}
export async function notifyAdmins(db, bookingId, title, body) {
  await db.query(
    `INSERT INTO notifications (user_id, booking_id, type, title, body)
     SELECT id, $1, 'incident', $2, $3 FROM users WHERE role = 'admin' AND status = 'active'`,
    [bookingId, title, body]
  );
}

// ---------------------------------------------------------------- standing
// Everything the booking form and the booking route need to know about a renter.
export async function standingFor(userId, db = { query }) {
  const hist = await db.query(
    `SELECT COUNT(*) FILTER (WHERE status = 'Completed' AND checked_in_at IS NOT NULL
                               AND late_fee_amount = 0 AND penalty_amount = 0)::int AS clean,
            COUNT(*) FILTER (WHERE status = 'Completed' AND late_fee_amount > 0)::int AS late
       FROM bookings WHERE renter_id = $1`,
    [userId]
  );
  const { rows: claims } = await db.query(
    'SELECT id, booking_id, status, balance, paid_at FROM damage_claims WHERE renter_id = $1', [userId]
  );
  const { rows: active } = await db.query(
    `SELECT id, status, end_date FROM bookings
      WHERE renter_id = $1 AND ((status = 'Approved' AND checked_out_at IS NOT NULL AND checked_in_at IS NULL) OR status = 'Missing')`,
    [userId]
  );
  const { rows: [me] } = await db.query('SELECT role, verification_status, nid_number FROM users WHERE id = $1', [userId]);
  const tier = trustTier({ cleanReturns: hist.rows[0].clean, lateReturns: hist.rows[0].late });
  const blocks = renterBlocks({ claims, activeRentals: active });
  return {
    tier: { level: tier.level, name: tier.name, cap: Number.isFinite(tier.cap) ? tier.cap : null, rate: tier.rate, toNext: tier.toNext, nextName: tier.nextName },
    cleanReturns: hist.rows[0].clean,
    verified: identityVerified(me),
    blocks: blocks.map((code) => ({ code, text: BLOCK_TEXT[code] })),
    _tier: tier,
  };
}

// What renting this item would take: deposit, whether a guarantor is needed.
export function quoteFor(standing, item) {
  return depositFor({ replacementCost: item.replacement_cost, tier: standing._tier, verified: standing.verified });
}

// ---------------------------------------------------------------- claims
export async function openClaim(db, { booking, charges, kind = 'damage', details }) {
  const s = settle({ charges, deposit: booking.deposit_amount });
  if (s.charges <= 0) return null;
  const { rows } = await db.query(
    `INSERT INTO damage_claims (booking_id, renter_id, kind, charges, deposit_applied, balance, details, respond_by, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7, NOW() + ($8 || ' hours')::interval, $9)
     ON CONFLICT (booking_id) DO UPDATE
        SET kind = EXCLUDED.kind, charges = EXCLUDED.charges, deposit_applied = EXCLUDED.deposit_applied,
            balance = EXCLUDED.balance, details = EXCLUDED.details, status = EXCLUDED.status,
            respond_by = EXCLUDED.respond_by
     RETURNING *`,
    [booking.id, booking.renter_id, kind, s.charges, s.depositApplied, s.balance, details || null,
      String(CLAIM_RESPONSE_HOURS), kind === 'missing' ? 'accepted' : 'open']
  );
  const claim = rows[0];
  await notifyUser(db, booking.renter_id, booking.id, 'claim_opened',
    kind === 'missing' ? `${booking.item_name} was reported missing` : `Charges for your rental of ${booking.item_name}`,
    kind === 'missing'
      ? `The owner reported ${booking.item_name} as not returned. Its full value (${money(s.charges)}) is charged: `
        + `${money(s.depositApplied)} from your deposit, ${money(s.balance)} still owed. Your account is suspended.`
      : `${money(s.charges)} in late fees / damage: ${money(s.depositApplied)} comes from your deposit`
        + (s.balance > 0 ? ` and ${money(s.balance)} is still owed.` : '.')
        + ` Accept or dispute it within ${CLAIM_RESPONSE_HOURS} hours from your Bookings page.`);
  return claim;
}

// ---------------------------------------------------------------- escalation
const STAGE_TEXT = {
  1: (b) => [`${b.item_name} is due back today`, `Please return ${b.item_name} to ${b.owner_name} by the end of ${b.end_date}. Late returns are charged every day.`],
  2: (b) => [`${b.item_name} is overdue`, `${b.item_name} was due back on ${b.end_date}. A late fee is now charged for every day it is late.`],
  3: (b) => [`Return ${b.item_name} now — your account will be frozen`, `${b.item_name} is a day overdue. If it is not returned within 24 hours your account is frozen and your guarantor is contacted.`],
  4: (b) => [`Your account is frozen`, `${b.item_name} is 2 days overdue. You cannot rent anything until it is returned. Our team and your guarantor have been told.`],
};

async function escalate(client, b, stage) {
  const [title, body] = (STAGE_TEXT[stage] || (() => []))(b);
  if (stage >= 1 && stage <= 4) await notifyUser(client, b.renter_id, b.id, stage === 4 ? 'rental_frozen' : stage === 3 ? 'rental_warning' : stage === 2 ? 'rental_overdue' : 'rental_due_soon', title, body);
  if (stage === 4) {
    const guarantor = b.guarantor_name ? ` Guarantor: ${b.guarantor_name} (${b.guarantor_relation}), ${b.guarantor_phone}.` : '';
    await client.query(
      `INSERT INTO incidents (booking_id, renter_id, kind, summary)
       VALUES ($1,$2,'overdue',$3) ON CONFLICT (booking_id, kind) DO NOTHING`,
      [b.id, b.renter_id, `${b.item_name} is 2 days overdue with ${b.customer_name} (${b.customer_email}).${guarantor}`]
    );
    await notifyAdmins(client, b.id, `Overdue 48 h: ${b.item_name}`,
      `${b.customer_name} has kept ${b.item_name} 2 days past its return date. The account is frozen.${guarantor}`);
    await notifyUser(client, b.owner_id, b.id, 'rental_frozen', `${b.item_name}: renter frozen`,
      `${b.customer_name} is 2 days late. Their account is frozen and our team is following up.${guarantor}`);
  }
  if (stage === 5) {
    await notifyUser(client, b.owner_id, b.id, 'rental_missing', `You can report ${b.item_name} missing`,
      `${b.item_name} is 3 days overdue. If you cannot reach ${b.customer_name}, report it missing from your Bookings page — `
      + 'the renter is banned, the deposit is yours, and you get an incident report for the police.');
  }
}

export async function runEscalation(now = new Date()) {
  const { rows } = await query(
    `SELECT b.*, i.name AS item_name, i.owner_id, o.name AS owner_name
       FROM bookings b JOIN items i ON i.id = b.item_id LEFT JOIN users o ON o.id = i.owner_id
      WHERE b.status = 'Approved' AND b.checked_out_at IS NOT NULL AND b.checked_in_at IS NULL
        AND b.missing_reported_at IS NULL`
  );
  let moved = 0;
  for (const b of rows) {
    const stage = escalationStage(b.end_date, now);
    if (stage <= b.escalation_stage) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Claim the step first, so two sweeps can never both send it.
      const claimed = await client.query(
        'UPDATE bookings SET escalation_stage = $2 WHERE id = $1 AND escalation_stage < $2 RETURNING id', [b.id, stage]
      );
      if (claimed.rowCount) {
        // Jumped several stages at once (nobody used the site for a while)? The
        // side effects of each still happen, but the renter hears only the latest.
        if (stage >= 2 && b.escalation_stage < 2) {
          await notifyUser(client, b.owner_id, b.id, 'rental_overdue', `${b.item_name} is overdue`,
            `${b.customer_name} has not returned ${b.item_name} (due ${b.end_date}). We have reminded them; late fees now apply.`);
        }
        if (stage >= 4 && b.escalation_stage < 4) await escalate(client, b, 4);
        if (stage !== 4) await escalate(client, b, stage);
        moved += 1;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('escalation failed for booking', b.id, err.message);
    } finally {
      client.release();
    }
  }
  // Claims nobody answered within the window count as accepted.
  const expired = await query(
    `UPDATE damage_claims SET status = 'accepted', auto_accepted = TRUE, responded_at = NOW()
      WHERE status = 'open' AND respond_by < NOW() RETURNING booking_id, renter_id, balance`
  );
  for (const c of expired.rows) {
    await notifyUser({ query }, c.renter_id, c.booking_id, 'claim_update', 'Claim accepted automatically',
      `You did not answer within ${CLAIM_RESPONSE_HOURS} hours, so the charges now stand`
      + (Number(c.balance) > 0 ? ` and ${money(c.balance)} is owed.` : '.'));
  }
  return { checked: rows.length, moved, autoAccepted: expired.rowCount, hoursLate: rows.map((b) => hoursLate(b.end_date, now)) };
}

// Runs the sweep at most once every INTERVAL minutes across all requests: the
// UPDATE only succeeds for the one request that finds the clock stale.
const INTERVAL_MINUTES = 10;
export async function maybeRunEscalation() {
  try {
    const { rowCount } = await query(
      `UPDATE system_state SET value = NOW()
        WHERE key = 'escalation_last_run' AND value < NOW() - ($1 || ' minutes')::interval`,
      [String(INTERVAL_MINUTES)]
    );
    if (rowCount) await runEscalation();
  } catch (err) {
    console.error('escalation sweep skipped:', err.message);
  }
}
