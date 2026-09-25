// ============================================================
//  RentalFlow  |  Business  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: the Limes wallet (credits) and money hooks
// ============================================================
// Limes are RentalFlow's credits. Every change to a wallet is a row in
// credit_ledger, written in the same transaction as the balance, so the two can
// never disagree. One-off rewards carry a `ref` and a unique index makes sure
// they are paid once (a second attempt simply earns nothing).
//
// Limes are spend-only: bought or earned, spent on boosts and ads, never
// cashed out.
import crypto from 'crypto';
import { pool, query } from './db.js';
import { EARN, rentalDays, rentalFees, localDateSafe } from './marketHelpers.js';

function httpError(status, message, extra = {}) {
  return Object.assign(new Error(message), { status, ...extra });
}

async function ensureWallet(client, userId) {
  await client.query(
    `INSERT INTO credit_wallets (user_id, referral_code) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
    [userId, crypto.randomBytes(4).toString('hex').toUpperCase()]);
}

// Add (or, with a negative delta, take) Limes. Returns the new balance, or
// null when a one-off reward was already paid. `kind` says which counter moves.
export async function changeCredits(userId, delta, reason, { note = null, ref = null, kind } = {}) {
  if (!userId || !delta) return null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureWallet(client, userId);
    const { rows: [w] } = await client.query('SELECT balance FROM credit_wallets WHERE user_id = $1 FOR UPDATE', [userId]);
    if (delta < 0 && w.balance + delta < 0) {
      await client.query('ROLLBACK');
      throw httpError(402, `That needs ${-delta} Limes — you have ${w.balance}. Earn more, or top up.`, { reason: 'not-enough-limes', balance: w.balance });
    }
    const ins = await client.query(
      `INSERT INTO credit_ledger (user_id, delta, reason, note, ref) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING RETURNING id`,
      [userId, delta, reason, note, ref]);
    if (!ins.rowCount) { await client.query('ROLLBACK'); return null; }
    const column = kind || (delta < 0 ? 'spent' : 'earned');
    const { rows: [n] } = await client.query(
      `UPDATE credit_wallets SET balance = balance + $2, ${column} = ${column} + ABS($2) WHERE user_id = $1 RETURNING balance`,
      [userId, delta]);
    await client.query('COMMIT');
    return n.balance;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export const earn = (userId, amount, reason, opts = {}) => changeCredits(userId, amount, reason, { ...opts, kind: 'earned' });
export const spend = (userId, amount, reason, opts = {}) => changeCredits(userId, -Math.abs(amount), reason, { ...opts, kind: 'spent' });

export async function wallet(userId) {
  const client = await pool.connect();
  try { await ensureWallet(client, userId); } finally { client.release(); }
  const { rows: [w] } = await query('SELECT * FROM credit_wallets WHERE user_id = $1', [userId]);
  return w;
}

// ---------------------------------------------------------------- hooks on marketplace requests
// Called by the reward middleware after a request succeeded; returns how many
// Limes the member earned (for the little "+2 Limes" pop), never throws.
export async function creditsFromRequest(userId, method, path, req, body, { dailyVisit, reward }) {
  let gained = 0;
  const add = async (amount, reason, ref, note) => {
    try { if (await earn(userId, amount, reason, { ref, note }) != null) gained += amount; } catch { /* never block the action */ }
  };
  try {
    const today = localDateSafe();
    if (dailyVisit) await add(EARN.daily, 'daily', `daily:${today}`, 'Daily check-in');
    if (reward?.streakUp && reward.streak % 7 === 0) await add(EARN.streak_week, 'streak', `streak:${today}`, `${reward.streak}-day streak`);

    if (method === 'POST' && path === '/items') await add(EARN.first_listing, 'first_listing', 'first_listing', 'Your first listing');

    // A new booking: keep what the platform earns from it (counted once completed).
    if (method === 'POST' && path === '/bookings' && body?.id) {
      const { rows: [b] } = await query(
        `SELECT b.id, b.start_date, b.end_date, i.rental_price FROM bookings b JOIN items i ON i.id = b.item_id WHERE b.id = $1`, [body.id]);
      if (b) {
        const f = rentalFees(b.rental_price, rentalDays(b.start_date, b.end_date), { protection: Boolean(req.body?.protection) });
        await query(
          `INSERT INTO booking_fees (booking_id, rental_total, renter_fee, owner_fee, protection_fee)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (booking_id) DO NOTHING`,
          [b.id, f.rentalTotal, f.renterFee, f.ownerFee, f.protectionFee]);
      }
    }

    // A rental finished on RentalFlow: both the owner and the renter earn.
    const done = path.match(/^\/bookings\/(\d+)\/status$/);
    if (method === 'PATCH' && done && req.body?.status === 'Completed') {
      const { rows: [b] } = await query(
        'SELECT b.id, b.renter_id, i.owner_id FROM bookings b JOIN items i ON i.id = b.item_id WHERE b.id = $1', [done[1]]);
      if (b) {
        for (const who of [b.owner_id, b.renter_id].filter(Boolean)) {
          try {
            const paid = await earn(who, EARN.rental_completed, 'rental_completed', { ref: `rental:${b.id}`, note: 'A rental finished on RentalFlow' });
            if (paid != null && who === userId) gained += EARN.rental_completed;
          } catch { /* ignore */ }
        }
      }
    }
  } catch (e) {
    console.error('Credits hook failed:', e.message);
  }
  return gained;
}
