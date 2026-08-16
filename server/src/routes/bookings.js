import { Router } from 'express';
import { query, pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { calculateDeposit, calculateLateFee, overdueDays, calculatePenalty, buildBill } from '../bookingUtils.js';

const router = Router();
const VALID_STATUSES = ['Pending', 'Approved', 'Cancelled', 'Completed', 'Rejected'];

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  return d.toISOString().slice(0, 10);
}

async function getBookingById(id) {
  const { rows } = await query(
    `SELECT b.*, i.name AS item_name, i.rental_price, i.replacement_cost, i.status AS item_status
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
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT b.*, i.name AS item_name, i.rental_price, i.replacement_cost, i.status AS item_status
       FROM bookings b
       LEFT JOIN items i ON i.id = b.item_id
       ${where}
       ORDER BY b.start_date ASC, b.id DESC`,
    params
  );
  res.json(rows.map((b) => ({ ...b, overdue_days: overdueDays(b.end_date) })));
});

router.get('/:id', authRequired, async (req, res) => {
  const booking = await getBookingById(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  res.json({ ...booking, overdue_days: overdueDays(booking.end_date) });
});

router.post('/', authRequired, async (req, res) => {
  const { item_id, customer_name, customer_email, start_date, end_date, notes } = req.body;
  if (!item_id || !customer_name || !customer_email || !start_date || !end_date) {
    return res.status(400).json({ error: 'item_id, customer_name, customer_email, start_date and end_date are required' });
  }

  try {
    const normalizedStart = parseDate(start_date);
    const normalizedEnd = parseDate(end_date);
    if (!normalizedStart || !normalizedEnd) throw new Error('Invalid date');
    if (normalizedStart >= normalizedEnd) {
      return res.status(400).json({ error: 'end_date must be after start_date' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existingItem = await client.query('SELECT id, replacement_cost, rental_price, status FROM items WHERE id = $1', [item_id]);
      if (!existingItem.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Item not found' });
      }
      if (existingItem.rows[0].status !== 'Available') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'This item is not currently available for booking' });
      }

      const overlapRows = await ensureNoOverlap(client, item_id, normalizedStart, normalizedEnd);
      if (overlapRows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'The selected dates overlap with an existing booking' });
      }

      const depositAmount = calculateDeposit(existingItem.rows[0].replacement_cost);
      const { rows } = await client.query(
        `INSERT INTO bookings (
          item_id, customer_name, customer_email, start_date, end_date, status, deposit_amount, late_fee_amount, notes
        ) VALUES ($1, $2, $3, $4, $5, 'Pending', $6, 0, $7)
        RETURNING *`,
        [item_id, customer_name, customer_email, normalizedStart, normalizedEnd, depositAmount, notes || null]
      );
      await client.query('COMMIT');
      res.status(201).json(rows[0]);
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
    res.json(rows[0]);
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
      `SELECT b.item_id, b.end_date, b.late_fee_amount, i.rental_price
         FROM bookings b LEFT JOIN items i ON i.id = b.item_id
        WHERE b.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }
    // When a rental is completed, automatically calculate any late fee from how
    // many days past its end date it is being returned. Not overdue -> stays 0.
    let lateFee = Number(rows[0].late_fee_amount) || 0;
    if (status === 'Completed') {
      lateFee = calculateLateFee(rows[0].rental_price, overdueDays(rows[0].end_date));
    }
    const updated = await client.query(
      'UPDATE bookings SET status = $2, late_fee_amount = $3 WHERE id = $1 RETURNING *',
      [req.params.id, status, lateFee]
    );
    await syncItemStatus(client, rows[0].item_id);
    await client.query('COMMIT');
    res.json(updated.rows[0]);
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
  res.json({ ...rows[0], overdue_days: days });
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
    const b = await client.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    if (!b.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Booking not found' }); }
    if (b.rows[0].status !== 'Approved') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Booking must be Approved before checkout' }); }
    if (b.rows[0].checked_out_at) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Already checked out' }); }
    const report = await insertConditionReport(client, req.params.id, 'checkout', req.body, req.user?.id);
    const upd = await client.query('UPDATE bookings SET checked_out_at = NOW() WHERE id = $1 RETURNING *', [req.params.id]);
    await client.query('UPDATE items SET status = $2 WHERE id = $1', [b.rows[0].item_id, 'Rented']);
    await client.query('COMMIT');
    res.status(201).json({ booking: upd.rows[0], report });
  } catch (err) { await client.query('ROLLBACK'); res.status(400).json({ error: err.message }); }
  finally { client.release(); }
});

// POST /:id/checkin — record checkin condition, compute late fee + penalty,
// reconcile deposit, complete the booking (F12/F13/F14).
router.post('/:id/checkin', authRequired, async (req, res) => {
  if (!req.body.condition_status) return res.status(400).json({ error: 'condition_status is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = await client.query(
      `SELECT b.*, i.rental_price, i.replacement_cost FROM bookings b
         LEFT JOIN items i ON i.id = b.item_id WHERE b.id = $1`, [req.params.id]);
    if (!b.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Booking not found' }); }
    if (!b.rows[0].checked_out_at) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Cannot check in before checkout' }); }
    if (b.rows[0].checked_in_at) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Already checked in' }); }
    const booking = b.rows[0];
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
         late_fee_amount = $2, penalty_amount = $3, penalty_notes = $4 WHERE id = $1 RETURNING *`,
      [req.params.id, lateFee, penalty, req.body.notes || null]);
    await client.query('UPDATE items SET status = $2 WHERE id = $1', [booking.item_id, itemStatus]);
    await client.query('COMMIT');
    res.status(201).json({ booking: upd.rows[0], report, bill });
  } catch (err) { await client.query('ROLLBACK'); res.status(400).json({ error: err.message }); }
  finally { client.release(); }
});

// GET /:id/condition-reports — checkout + checkin reports for comparison (F14).
router.get('/:id/condition-reports', authRequired, async (req, res) => {
  const { rows } = await query('SELECT * FROM condition_reports WHERE booking_id = $1 ORDER BY phase DESC', [req.params.id]);
  res.json(rows);
});

// GET /:id/agreement — data for the rental agreement PDF (F11).
router.get('/:id/agreement', authRequired, async (req, res) => {
  const booking = await getBookingById(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  res.json(booking);
});

// POST /:id/agreement — assign an agreement number the first time it is generated.
router.post('/:id/agreement', authRequired, async (req, res) => {
  const booking = await getBookingById(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const number = booking.agreement_number
    || `RF-${booking.id}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  const { rows } = await query(
    `UPDATE bookings SET agreement_number = $2,
       agreement_generated_at = COALESCE(agreement_generated_at, NOW()) WHERE id = $1 RETURNING *`,
    [req.params.id, number]);
  res.json(rows[0]);
});

// GET /:id/bill — final settlement breakdown (F14/F15).
router.get('/:id/bill', authRequired, async (req, res) => {
  const booking = await getBookingById(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  res.json(buildBill({
    rentalPrice: booking.rental_price, startDate: booking.start_date, endDate: booking.end_date,
    depositAmount: booking.deposit_amount, lateFee: booking.late_fee_amount, penalty: booking.penalty_amount,
  }));
});

export default router;
