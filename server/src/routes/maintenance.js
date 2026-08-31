// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: F18 Maintenance & repair log API (raw SQL)
// ============================================================
import { Router } from 'express';
import { query, pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { nextItemStatus, summarizeJobs } from '../maintenanceUtils.js';

const router = Router();
const JOB_TYPES = ['Repair', 'Service', 'Inspection', 'Cleaning', 'Replacement'];
const PRIORITIES = ['Low', 'Normal', 'High'];
const STATUSES = ['Open', 'In Progress', 'Completed', 'Cancelled'];

// Re-derive the item's status from the jobs still attached to it, so an item is
// pulled out of the rental pool while it is in the shop and released after.
async function syncItemMaintenanceStatus(client, itemId) {
  const jobs = await client.query('SELECT status FROM maintenance_logs WHERE item_id = $1', [itemId]);
  const item = await client.query('SELECT status FROM items WHERE id = $1', [itemId]);
  if (!item.rows[0]) return;
  const next = nextItemStatus(jobs.rows, item.rows[0].status);
  await client.query('UPDATE items SET status = $2 WHERE id = $1', [itemId, next]);
}

// GET /api/maintenance — the repair log, newest first, optionally filtered.
router.get('/', authRequired, async (req, res) => {
  const { item_id, status } = req.query;
  const params = [];
  const clauses = [];
  if (item_id) { params.push(item_id); clauses.push(`m.item_id = $${params.length}`); }
  if (status) { params.push(status); clauses.push(`m.status = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT m.*,
            i.name  AS item_name,
            i.status AS item_status,
            u.name  AS reported_by_name,
            (m.parts_cost + m.labour_cost) AS total_cost
       FROM maintenance_logs m
       LEFT JOIN items i ON i.id = m.item_id
       LEFT JOIN users u ON u.id = m.reported_by
       ${where}
       ORDER BY (m.status IN ('Open','In Progress')) DESC, m.reported_at DESC`,
    params
  );
  res.json(rows);
});

// GET /api/maintenance/summary — headline numbers + cost per item for the page.
router.get('/summary', authRequired, async (_req, res) => {
  const { rows } = await query('SELECT * FROM maintenance_logs');
  const perItem = await query(
    `SELECT i.id, i.name,
            COUNT(m.id)                                   AS job_count,
            COALESCE(SUM(m.parts_cost + m.labour_cost), 0) AS total_cost
       FROM maintenance_logs m
       JOIN items i ON i.id = m.item_id
      GROUP BY i.id, i.name
      ORDER BY total_cost DESC
      LIMIT 8`
  );
  res.json({
    ...summarizeJobs(rows),
    perItem: perItem.rows.map((r) => ({
      id: r.id,
      name: r.name,
      jobCount: Number(r.job_count),
      totalCost: Number(r.total_cost),
    })),
  });
});

// POST /api/maintenance — log a new repair job (F18).
router.post('/', authRequired, async (req, res) => {
  const { item_id, description, job_type, priority, technician, parts_cost, labour_cost, booking_id } = req.body;
  if (!item_id || !description) {
    return res.status(400).json({ error: 'item_id and description are required' });
  }
  if (job_type && !JOB_TYPES.includes(job_type)) return res.status(400).json({ error: 'Invalid job_type' });
  if (priority && !PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const item = await client.query('SELECT id FROM items WHERE id = $1', [item_id]);
    if (!item.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }
    const { rows } = await client.query(
      `INSERT INTO maintenance_logs
         (item_id, booking_id, job_type, priority, status, description, technician, parts_cost, labour_cost, reported_by)
       VALUES ($1,$2,$3,$4,'Open',$5,$6,$7,$8,$9) RETURNING *`,
      [item_id, booking_id || null, job_type || 'Repair', priority || 'Normal', description,
       technician || null, Number(parts_cost || 0), Number(labour_cost || 0), req.user?.id || null]
    );
    await syncItemMaintenanceStatus(client, item_id);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/maintenance/:id — update a job (progress it, add costs, close it).
router.patch('/:id', authRequired, async (req, res) => {
  const { status, technician, parts_cost, labour_cost, description, priority } = req.body;
  if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (priority && !PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM maintenance_logs WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Maintenance job not found' });
    }
    const nextStatus = status || existing.rows[0].status;
    // Stamp completed_at the moment a job is closed; clear it if it reopens.
    const closing = ['Completed', 'Cancelled'].includes(nextStatus);
    const { rows } = await client.query(
      `UPDATE maintenance_logs
          SET status       = $2,
              description  = COALESCE($3, description),
              technician   = COALESCE($4, technician),
              priority     = COALESCE($5, priority),
              parts_cost   = COALESCE($6, parts_cost),
              labour_cost  = COALESCE($7, labour_cost),
              completed_at = CASE WHEN $8 THEN COALESCE(completed_at, NOW()) ELSE NULL END
        WHERE id = $1 RETURNING *`,
      [req.params.id, nextStatus, description ?? null, technician ?? null, priority ?? null,
       parts_cost != null ? Number(parts_cost) : null,
       labour_cost != null ? Number(labour_cost) : null, closing]
    );
    await syncItemMaintenanceStatus(client, existing.rows[0].item_id);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/maintenance/:id — remove a job logged by mistake.
router.delete('/:id', authRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('DELETE FROM maintenance_logs WHERE id = $1 RETURNING item_id', [req.params.id]);
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Maintenance job not found' });
    }
    await syncItemMaintenanceStatus(client, rows[0].item_id);
    await client.query('COMMIT');
    res.status(204).end();
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
