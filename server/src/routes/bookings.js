import { Router } from 'express';
import { query, pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { calculateDeposit, calculateLateFee } from '../bookingUtils.js';

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
        AND ($2 IS NULL OR id != $2)
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
  res.json(rows);
});

router.get('/:id', authRequired, async (req, res) => {
  const booking = await getBookingById(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  res.json(booking);
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
    const { rows } = await client.query('SELECT item_id FROM bookings WHERE id = $1', [req.params.id]);
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }
    const updated = await client.query(
      'UPDATE bookings SET status = $2 WHERE id = $1 RETURNING *',
      [req.params.id, status]
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
  const { overdue_days } = req.body;
  const booking = await getBookingById(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const lateFee = calculateLateFee(booking.rental_price, overdue_days || 0);
  const { rows } = await query(
    `UPDATE bookings SET late_fee_amount = $2 WHERE id = $1 RETURNING *`,
    [req.params.id, lateFee]
  );
  res.json(rows[0]);
});

export default router;
