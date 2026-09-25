import { Router } from 'express';
import { query, pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { calculateDeposit, calculateLateFee, overdueDays, calculatePenalty, buildBill } from '../bookingUtils.js';
import { buildNotification, eventForStatus, recipientSide, canDecide } from '../notificationUtils.js';
import { buildProfile } from '../customerUtils.js';
import { signFileUrl } from './files.js';
import { identityVerified } from '../middleware/requireVerified.js';
import { standingFor, quoteFor, openClaim } from '../protection.js';
import { refundBooking } from './payments.js';
import { checkGuarantor, handoverCode, escalationStage, hoursLate } from '../protectionUtils.js';

const router = Router();
const VALID_STATUSES = ['Pending', 'Approved', 'Cancelled', 'Completed', 'Rejected'];

// The hand-over code is shown to the renter alone (GET /api/protection/handover),
// so it never leaves the server in any booking response.
// Who may see a booking: the item's owner, the renter, and admin / staff.
function canView(user, b) {
  if (!user || !b) return false;
  if (user.role === 'admin' || user.role === 'staff') return true;
  if (Number(b.owner_id) === Number(user.id)) return true;
  if (b.renter_id && Number(b.renter_id) === Number(user.id)) return true;
  return String(b.customer_email || '').toLowerCase() === String(user.email || '').toLowerCase();
}
const NOT_YOURS = { error: 'You can only see bookings for your own items or your own rentals.' };

function publicBooking(b) {
  if (!b) return b;
  const { handover_code: _code, ...rest } = b;
  return rest;
}

// Write one in-app notification. `side` is 'owner' or 'customer'; the customer
// only has an account if they signed up with the same email they booked with,
// so a guest booking simply produces no customer-side row.
async function notify(client, side, booking, type) {
  const content = buildNotification(type, booking);
  if (!content) return null;

  let userId = null;
  if (side === 'owner') {
    userId = booking.owner_id || null;
  } else {
    const { rows } = await client.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [booking.customer_email || '']
    );
    userId = rows[0]?.id || null;
  }
  if (!userId) return null;

  const { rows } = await client.query(
    `INSERT INTO notifications (user_id, booking_id, type, title, body)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [userId, booking.id, type, content.title, content.body]
  );
  return rows[0];
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  return d.toISOString().slice(0, 10);
}

async function getBookingById(id) {
  const { rows } = await query(
    `SELECT b.*, i.name AS item_name, i.rental_price, i.replacement_cost,
            i.status AS item_status, i.owner_id
       FROM bookings b
       LEFT JOIN items i ON i.id = b.item_id
      WHERE b.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function ensureNoOverlap(client, itemId, startDate, endDate, ignoreId = null) {
  const { rows } = await client.query(
    `SELECT id, start_date, end_date, status FROM bookings
      WHERE item_id = $1
        AND status IN ('Pending', 'Approved', 'Completed')
        AND ($2::int IS NULL OR id != $2::int)
        AND start_date < $3 AND end_date > $4`,
    [itemId, ignoreId, endDate, startDate]
  );
  return rows;
}

async function syncItemStatus(client, itemId) {
  const { rows } = await client.query(
    `SELECT status FROM bookings WHERE item_id = $1 AND status = 'Approved'`,
    [itemId]
  );
  const nextStatus = rows.length ? 'Rented' : 'Available';
  await client.query('UPDATE items SET status = $2 WHERE id = $1', [itemId, nextStatus]);
}

router.get('/', authRequired, async (req, res) => {
  const { item_id, status } = req.query;
  const clauses = [];
  const params = [];
  if (item_id) {
    params.push(item_id);
    clauses.push(`b.item_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    clauses.push(`b.status = $${params.length}`);
  }
  // A member only sees bookings that concern them: requests on the items they
  // own, plus the bookings they made themselves. Admin and staff run the
  // counter, so they see everything.
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    params.push(req.user.id, req.user.email || '');
    clauses.push(`(i.owner_id = $${params.length - 1} OR LOWER(b.customer_email) = LOWER($${params.length}))`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT b.*, i.name AS item_name, i.rental_price, i.replacement_cost,
            i.status AS item_status, i.owner_id,
            c.id AS claim_id, c.kind AS claim_kind, c.status AS claim_status, c.charges AS claim_charges,
            c.deposit_applied AS claim_deposit_applied, c.balance AS claim_balance,
            c.respond_by AS claim_respond_by, c.renter_response AS claim_response, c.paid_at AS claim_paid_at
       FROM bookings b
       LEFT JOIN items i ON i.id = b.item_id
       LEFT JOIN damage_claims c ON c.booking_id = b.id
       ${where}
       ORDER BY b.start_date ASC, b.id DESC`,
    params
  );
  const me = req.user;
  res.json(rows.map((b) => {
    const out = b.checked_out_at && !b.checked_in_at && b.status === 'Approved';
    return {
      ...publicBooking(b),
      overdue_days: overdueDays(b.end_date),
      // which side of this booking the viewer is on
      my_role: Number(b.owner_id) === Number(me.id) ? 'owner'
        : (Number(b.renter_id) === Number(me.id) || String(b.customer_email).toLowerCase() === String(me.email || '').toLowerCase()) ? 'renter'
          : 'staff',
      escalation: out ? escalationStage(b.end_date) : 0,
      hours_late: out ? hoursLate(b.end_date) : 0,
    };
  }));
});

router.get('/:id', authRequired, async (req, res) => {
  const booking = await getBookingById(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (!canView(req.user, booking)) return res.status(403).json(NOT_YOURS);
  res.json({ ...publicBooking(booking), overdue_days: overdueDays(booking.end_date) });
});

// GET /api/bookings/:id/renter — who is asking for this item, and are they real?
//
// The person about to hand over their own equipment needs to see the verified
// identity behind the request BEFORE they approve or reject it. Access is the
// same rule as making the decision itself (`canDecide`): the item's owner, an
// admin, or staff — nobody else. A member cannot look up the NID of someone who
// booked a different member's item.
//
// Reading an identity is sensitive, so unlike other GETs it is written to the
// audit log: the platform can always show who looked at whose NID, and when.
router.get('/:id/renter', authRequired, async (req, res) => {
  const booking = await getBookingById(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (!canDecide(req.user, booking)) {
    return res.status(403).json({ error: 'Only the item owner, staff or an admin can view the renter’s identity.' });
  }

  // The renter is matched to an account by the email they booked with.
  const { rows: users } = await query(
    `SELECT id, name, email, phone, status, created_at, role, verification_status,
            nid_number, nid_name, nid_front_url, nid_back_url, nid_submitted_at
       FROM users WHERE LOWER(email) = LOWER($1)`,
    [booking.customer_email || '']
  );
  const account = users[0] || null;

  // Their track record with the platform, so the decision has context beyond
  // the ID card: how many rentals, how reliably returned, what they were charged.
  const { rows: historyRows } = await query(
    `SELECT b.id, b.status, b.start_date, b.end_date, b.late_fee_amount, b.penalty_amount,
            i.name AS item_name,
            ((b.end_date - b.start_date) * i.rental_price) + b.late_fee_amount + b.penalty_amount AS revenue
       FROM bookings b JOIN items i ON i.id = b.item_id
      WHERE LOWER(b.customer_email) = LOWER($1)
      ORDER BY b.start_date DESC`,
    [booking.customer_email || '']
  );
  const history = historyRows.map((b) => ({
    ...b,
    revenue: Number(Number(b.revenue || 0).toFixed(2)),
    customer_name: booking.customer_name,
    customer_email: booking.customer_email,
  }));

  // Record the look-up. Never let an audit failure block the response — the
  // owner still has a decision to make.
  try {
    await query(
      `INSERT INTO audit_logs (user_id, user_email, action, entity, entity_id, path, status_code, summary)
       VALUES ($1,$2,'GET','bookings',$3,$4,200,$5)`,
      [req.user.id, req.user.email, String(booking.id), `/api/bookings/${booking.id}/renter`,
        `Viewed renter identity for booking #${booking.id} (${booking.customer_email})`]
    );
  } catch (err) {
    console.error('Could not audit identity view:', err.message);
  }

  res.json({
    booking: {
      id: booking.id,
      status: booking.status,
      item_name: booking.item_name,
      start_date: booking.start_date,
      end_date: booking.end_date,
      deposit_amount: booking.deposit_amount,
      replacement_cost: booking.replacement_cost,
      notes: booking.notes,
    },
    // What was typed into the booking form.
    contact: {
      name: booking.customer_name,
      email: booking.customer_email,
      phone: account?.phone || null,
    },
    // Whether that email belongs to a real, verified account.
    account: account
      ? { exists: true, name: account.name, status: account.status, memberSince: account.created_at }
      : { exists: false },
    // The identity. A lister sees only THAT the renter is verified; the NID
    // number and card photos are shown to admins alone, who handle any
    // real-world damage claim on the lister's behalf.
    nid: account?.nid_number
      ? (req.user.role === 'admin'
        ? {
          onFile: true,
          verified: identityVerified(account),
          number: account.nid_number,
          name: account.nid_name,
          frontUrl: signFileUrl(account.nid_front_url),
          backUrl: signFileUrl(account.nid_back_url),
          submittedAt: account.nid_submitted_at,
        }
        : { onFile: true, verified: identityVerified(account), submittedAt: account.nid_submitted_at, private: true })
      : { onFile: false },
    profile: history.length ? buildProfile(history) : null,
    history,
  });
});

router.post('/', authRequired, async (req, res) => {
  const { item_id, start_date, end_date, notes } = req.body;
  let { customer_name, customer_email } = req.body;
  // A member always books as themselves: the booking is tied to their verified
  // account, not to whatever name and email were typed. (Staff at the counter
  // may still book for a walk-in customer.)
  let renterId = null;
  if (req.user.role === 'member') {
    const { rows: [me] } = await query('SELECT id, name, email FROM users WHERE id = $1', [req.user.id]);
    renterId = me.id;
    customer_name = me.name;
    customer_email = me.email;
  } else if (customer_email) {
    const { rows: [acct] } = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [customer_email]);
    renterId = acct?.id || null;
  }
  if (!item_id || !customer_name || !customer_email || !start_date || !end_date) {
    return res.status(400).json({ error: 'item_id, customer_name, customer_email, start_date and end_date are required' });
  }

  try {
    // Damage control (F21): a booking must be backed by a verified identity so
    // that a penalty for a damaged item is enforceable. That rule now lives in
    // middleware/requireVerified.js — the full NID + live-selfie check, done at
    // a member's first rental and saved on the account.

    const normalizedStart = parseDate(start_date);
    const normalizedEnd = parseDate(end_date);
    if (!normalizedStart || !normalizedEnd) throw new Error('Invalid date');
    if (normalizedStart >= normalizedEnd) {
      return res.status(400).json({ error: 'end_date must be after start_date' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existingItem = await client.query('SELECT id, name, owner_id, replacement_cost, rental_price, status FROM items WHERE id = $1', [item_id]);
      if (!existingItem.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Item not found' });
      }
      if (existingItem.rows[0].status !== 'Available') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'This item is not currently available for booking' });
      }

      if (renterId && Number(existingItem.rows[0].owner_id) === Number(renterId)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You cannot rent your own item.' });
      }

      const overlapRows = await ensureNoOverlap(client, item_id, normalizedStart, normalizedEnd);
      if (overlapRows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'The selected dates overlap with an existing booking' });
      }

      // Rental protection: the renter's standing decides whether they may rent
      // now, how big the deposit is, and whether a guarantor is needed.
      let depositAmount = calculateDeposit(existingItem.rows[0].replacement_cost);
      let trustLevel = null;
      let depositRate = null;
      let guarantor = { name: null, phone: null, relation: null };
      if (renterId) {
        const standing = await standingFor(renterId, client);
        if (standing.blocks.length) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: standing.blocks[0].text, reason: 'renter-blocked', blocks: standing.blocks });
        }
        const quote = quoteFor(standing, existingItem.rows[0]);
        depositAmount = quote.amount;
        depositRate = quote.rate;
        trustLevel = standing.tier.level;
        if (quote.needsGuarantor) {
          const g = req.body.guarantor || {};
          const problem = checkGuarantor(g);
          if (problem) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: problem, reason: 'guarantor-required' });
          }
          guarantor = { name: g.name.trim(), phone: String(g.phone).replace(/[\s-]/g, ''), relation: g.relation.trim() };
        }
      }
      const { rows } = await client.query(
        `INSERT INTO bookings (
          item_id, customer_name, customer_email, start_date, end_date, status, deposit_amount, late_fee_amount, notes,
          renter_id, trust_level, deposit_rate, guarantor_name, guarantor_phone, guarantor_relation
        ) VALUES ($1, $2, $3, $4, $5, 'Pending', $6, 0, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [item_id, customer_name, customer_email, normalizedStart, normalizedEnd, depositAmount, notes || null,
          renterId, trustLevel, depositRate, guarantor.name, guarantor.phone, guarantor.relation]
      );

      // Tell the member who owns the item that a request is waiting for them.
      await notify(client, 'owner', {
        ...rows[0],
        item_name: existingItem.rows[0].name,
        owner_id: existingItem.rows[0].owner_id,
      }, 'booking_requested');

      await client.query('COMMIT');
      res.status(201).json(publicBooking(rows[0]));
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authRequired, async (req, res) => {
  const { customer_name, customer_email, start_date, end_date, notes, status } = req.body;
  const booking = await getBookingById(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  // Editing a booking (dates, status) is the owner's or staff's job — a renter
  // must not be able to, say, mark their own rental "Completed".
  if (!canDecide(req.user, booking)) return res.status(403).json({ error: 'Only the owner of this item (or staff) can edit this booking.' });
  if (booking.status === 'Missing') return res.status(409).json({ error: 'This item was reported missing; an admin resolves it from Incidents.' });

  const normalizedStart = start_date ? parseDate(start_date) : booking.start_date;
  const normalizedEnd = end_date ? parseDate(end_date) : booking.end_date;
  if (!normalizedStart || !normalizedEnd) return res.status(400).json({ error: 'Invalid date' });
  if (normalizedStart >= normalizedEnd) return res.status(400).json({ error: 'end_date must be after start_date' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const overlapRows = await ensureNoOverlap(client, booking.item_id, normalizedStart, normalizedEnd, booking.id);
    if (overlapRows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The selected dates overlap with an existing booking' });
    }

    const depositAmount = booking.deposit_amount || calculateDeposit(booking.replacement_cost);
    const lateFeeAmount = booking.late_fee_amount || 0;
    const finalStatus = VALID_STATUSES.includes(status) ? status : booking.status;
    const { rows } = await client.query(
      `UPDATE bookings
       SET customer_name = COALESCE($2, customer_name),
           customer_email = COALESCE($3, customer_email),
           start_date = COALESCE($4, start_date),
           end_date = COALESCE($5, end_date),
           notes = COALESCE($6, notes),
           status = $7,
           deposit_amount = $8,
           late_fee_amount = $9
       WHERE id = $1
       RETURNING *`,
      [req.params.id, customer_name || null, customer_email || null, normalizedStart, normalizedEnd, notes ?? null, finalStatus, depositAmount, lateFeeAmount]
    );
    await client.query('COMMIT');
    res.json(publicBooking(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.patch('/:id/status', authRequired, async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT b.*, i.rental_price, i.owner_id, i.name AS item_name
         FROM bookings b LEFT JOIN items i ON i.id = b.item_id
        WHERE b.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }
    // Only the member who owns the item (or admin/staff) decides on a booking.
    // A customer may cancel their own request, nothing more.
    if (!canDecide(req.user, rows[0], status)) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Only the owner of this item can approve or reject its bookings',
      });
    }
    // When a rental is completed, automatically calculate any late fee from how
    // many days past its end date it is being returned. Not overdue -> stays 0.
    let lateFee = Number(rows[0].late_fee_amount) || 0;
    if (status === 'Completed') {
      lateFee = calculateLateFee(rows[0].rental_price, overdueDays(rows[0].end_date));
    }
    // Missing is set only by the missing-item report, never by hand.
    if (rows[0].status === 'Missing') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This item was reported missing; an admin resolves it from Incidents.' });
    }
    const updated = await client.query(
      `UPDATE bookings SET status = $2, late_fee_amount = $3,
              handover_code = CASE WHEN $5 AND handover_code IS NULL THEN $4 ELSE handover_code END
        WHERE id = $1 RETURNING *`,
      [req.params.id, status, lateFee, handoverCode(), status === 'Approved']
    );
    await syncItemStatus(client, rows[0].item_id);

    // Tell whichever side did not make this decision.
    const event = eventForStatus(status);
    if (event && status !== rows[0].status) {
      await notify(client, recipientSide(req.user, rows[0]), {
        ...updated.rows[0],
        item_name: rows[0].item_name,
        owner_id: rows[0].owner_id,
      }, event);
    }

    // A paid request that does not go ahead is refunded (demo payments).
    if (['Rejected', 'Cancelled'].includes(status) && status !== rows[0].status) await refundBooking(client, rows[0].id);

    await client.query('COMMIT');
    res.json(publicBooking(updated.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post('/:id/late-fee', authRequired, async (req, res) => {
  const booking = await getBookingById(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (!canDecide(req.user, booking)) return res.status(403).json({ error: 'Only the owner of this item (or staff) can set its late fee.' });
  // Auto-detect overdue days from the booking's end date when the caller does
  // not pass an explicit value, so late fees apply automatically once overdue.
  const days = req.body.overdue_days != null
    ? Math.max(0, Number(req.body.overdue_days) || 0)
    : overdueDays(booking.end_date);
  const lateFee = calculateLateFee(booking.rental_price, days);
  const { rows } = await query(
    `UPDATE bookings SET late_fee_amount = $2 WHERE id = $1 RETURNING *`,
    [req.params.id, lateFee]
  );
  res.json({ ...publicBooking(rows[0]), overdue_days: days });
});

// ---------------------------------------------------------------------------
// Sprint 3: rental checkout lifecycle (F11–F15)
// ---------------------------------------------------------------------------

// Persist a condition report (F13). One 'checkout' and one 'checkin' per booking.
async function insertConditionReport(client, bookingId, phase, body, userId) {
  const { condition_status, notes, scratch_details, missing_accessories, photos, repair_cost, missing_charge } = body;
  const { rows } = await client.query(
    `INSERT INTO condition_reports
      (booking_id, phase, condition_status, notes, scratch_details, missing_accessories, photos, repair_cost, missing_charge, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [bookingId, phase, condition_status, notes || null, scratch_details || null,
     missing_accessories || null, Array.isArray(photos) ? photos : [],
     Number(repair_cost || 0), Number(missing_charge || 0), userId || null]
  );
  return rows[0];
}

// POST /:id/checkout — record checkout condition, mark item Rented (F12/F13).
router.post('/:id/checkout', authRequired, async (req, res) => {
  if (!req.body.condition_status) return res.status(400).json({ error: 'condition_status is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = await client.query(
      `SELECT b.*, i.owner_id FROM bookings b
         LEFT JOIN items i ON i.id = b.item_id WHERE b.id = $1`, [req.params.id]);
    if (!b.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Booking not found' }); }
    if (!canDecide(req.user, b.rows[0])) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Only the owner of this item can check it out' }); }
    if (b.rows[0].status !== 'Approved') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Booking must be Approved before checkout' }); }
    if (b.rows[0].checked_out_at) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Already checked out' }); }
    // Rental protection: the deposit must be in hand, and the renter must be
    // present and agree to the recorded condition (their one-time code).
    if (Number(b.rows[0].deposit_amount) > 0 && !req.body.deposit_received) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Confirm you have received the deposit before handing the item over.', reason: 'deposit-not-received' });
    }
    const handover = checkHandover({ body: { ...req.body, phase: 'check-out' } }, b.rows[0]);
    if (handover.error) { await client.query('ROLLBACK'); return res.status(400).json(handover.error); }
    const report = await insertConditionReport(client, req.params.id, 'checkout', req.body, req.user?.id);
    const upd = await client.query(
      `UPDATE bookings SET checked_out_at = NOW(), deposit_received_at = COALESCE(deposit_received_at, NOW()),
              renter_confirmed_checkout_at = CASE WHEN $2 THEN NOW() END, handover_code = $3,
              handover_note = CONCAT_WS(' | ', handover_note, $4::text)
        WHERE id = $1 RETURNING *`,
      [req.params.id, handover.confirmed, handoverCode(), handover.note]);
    await client.query('UPDATE items SET status = $2 WHERE id = $1', [b.rows[0].item_id, 'Rented']);
    await client.query('COMMIT');
    res.status(201).json({ booking: publicBooking(upd.rows[0]), report });
  } catch (err) { await client.query('ROLLBACK'); res.status(400).json({ error: err.message }); }
  finally { client.release(); }
});

// The renter's one-time code proves they were there and agreed. If the renter
// has no account (a walk-in booked at the counter) there is no code. If they
// refuse to give it at the return, the owner can still close the rental with a
// written reason — and the renter can dispute the resulting claim.
function checkHandover(req, booking) {
  if (!booking.renter_id) return { confirmed: false, note: null };
  const typed = String(req.body.handover_code || '').trim();
  if (typed) {
    if (typed !== booking.handover_code) {
      return { error: { error: 'That hand-over code is not right. Ask the renter to open the booking on their phone.', reason: 'bad-handover-code' } };
    }
    return { confirmed: true, note: null };
  }
  const why = String(req.body.no_code_reason || '').trim();
  if (why.length >= 10) return { confirmed: false, note: `${req.body.phase || 'handover'} without the renter's code: ${why}` };
  return { error: { error: 'Enter the renter’s 6-digit hand-over code (they see it on their Bookings page).', reason: 'handover-code-required' } };
}

// POST /:id/checkin — record checkin condition, compute late fee + penalty,
// reconcile deposit, complete the booking (F12/F13/F14).
router.post('/:id/checkin', authRequired, async (req, res) => {
  if (!req.body.condition_status) return res.status(400).json({ error: 'condition_status is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = await client.query(
      `SELECT b.*, i.rental_price, i.replacement_cost, i.owner_id, i.name AS item_name
         FROM bookings b LEFT JOIN items i ON i.id = b.item_id WHERE b.id = $1`, [req.params.id]);
    if (!b.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Booking not found' }); }
    if (!canDecide(req.user, b.rows[0])) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Only the owner of this item can check it back in' }); }
    if (!b.rows[0].checked_out_at) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Cannot check in before checkout' }); }
    if (b.rows[0].checked_in_at) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Already checked in' }); }
    const booking = b.rows[0];
    const handover = checkHandover({ body: { ...req.body, phase: 'return' } }, booking);
    if (handover.error) { await client.query('ROLLBACK'); return res.status(400).json(handover.error); }
    const report = await insertConditionReport(client, req.params.id, 'checkin', req.body, req.user?.id);
    const lateFee = calculateLateFee(booking.rental_price, overdueDays(booking.end_date));
    const penalty = calculatePenalty({
      conditionStatus: req.body.condition_status,
      replacementCost: booking.replacement_cost,
      repairCost: req.body.repair_cost,
      missingCharge: req.body.missing_charge,
    });
    const bill = buildBill({
      rentalPrice: booking.rental_price, startDate: booking.start_date, endDate: booking.end_date,
      depositAmount: booking.deposit_amount, lateFee, penalty,
    });
    const itemStatus = ['Poor', 'Damaged'].includes(req.body.condition_status) ? 'Damaged' : 'Available';
    const upd = await client.query(
      `UPDATE bookings SET checked_in_at = NOW(), status = 'Completed',
         late_fee_amount = $2, penalty_amount = $3, penalty_notes = $4,
         renter_confirmed_checkin_at = CASE WHEN $5 THEN NOW() END, handover_code = NULL,
         handover_note = CONCAT_WS(' | ', handover_note, $6::text)
       WHERE id = $1 RETURNING *`,
      [req.params.id, lateFee, penalty, req.body.notes || null, handover.confirmed, handover.note]);
    // Any late fee or damage becomes a claim: paid from the deposit first, the
    // rest owed; the renter has 48 hours to accept or dispute it.
    const claim = await openClaim(client, {
      booking: { ...booking, ...upd.rows[0], item_name: booking.item_name },
      charges: lateFee + penalty,
      details: [
        lateFee > 0 ? `Late fee ${lateFee}` : null,
        penalty > 0 ? `Damage/missing parts ${penalty} (${req.body.condition_status})` : null,
        req.body.notes || null,
        handover.note,
      ].filter(Boolean).join(' · '),
    });
    await client.query('UPDATE items SET status = $2 WHERE id = $1', [booking.item_id, itemStatus]);
    // The rental is closed — let the customer know.
    await notify(client, 'customer', {
      ...upd.rows[0], item_name: booking.item_name, owner_id: booking.owner_id,
    }, 'booking_completed');
    await client.query('COMMIT');
    res.status(201).json({ booking: publicBooking(upd.rows[0]), report, bill, claim });
  } catch (err) { await client.query('ROLLBACK'); res.status(400).json({ error: err.message }); }
  finally { client.release(); }
});

// GET /:id/condition-reports — checkout + checkin reports for comparison (F14).
router.get('/:id/condition-reports', authRequired, async (req, res) => {
  const booking = await getBookingById(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (!canView(req.user, booking)) return res.status(403).json(NOT_YOURS);
  const { rows } = await query('SELECT * FROM condition_reports WHERE booking_id = $1 ORDER BY phase DESC', [req.params.id]);
  res.json(rows);
});

// GET /:id/agreement — data for the rental agreement PDF (F11).
router.get('/:id/agreement', authRequired, async (req, res) => {
  const booking = await getBookingById(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (!canView(req.user, booking)) return res.status(403).json(NOT_YOURS);
  res.json(publicBooking(booking));
});

// POST /:id/agreement — assign an agreement number the first time it is generated.
router.post('/:id/agreement', authRequired, async (req, res) => {
  const booking = await getBookingById(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (!canView(req.user, booking)) return res.status(403).json(NOT_YOURS);
  const number = booking.agreement_number
    || `RF-${booking.id}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  const { rows } = await query(
    `UPDATE bookings SET agreement_number = $2,
       agreement_generated_at = COALESCE(agreement_generated_at, NOW()) WHERE id = $1 RETURNING *`,
    [req.params.id, number]);
  res.json(publicBooking(rows[0]));
});

// GET /:id/bill — final settlement breakdown (F14/F15).
router.get('/:id/bill', authRequired, async (req, res) => {
  const booking = await getBookingById(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (!canView(req.user, booking)) return res.status(403).json(NOT_YOURS);
  res.json(buildBill({
    rentalPrice: booking.rental_price, startDate: booking.start_date, endDate: booking.end_date,
    depositAmount: booking.deposit_amount, lateFee: booking.late_fee_amount, penalty: booking.penalty_amount,
  }));
});

export default router;
