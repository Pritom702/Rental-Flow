// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: In-app notification API (raw SQL)
// ============================================================
import { Router } from 'express';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// GET /api/notifications?unread=1&limit=20 — the signed-in user's bell feed.
router.get('/', authRequired, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const onlyUnread = req.query.unread === '1';
  const { rows } = await query(
    `SELECT n.*, b.status AS booking_status, i.name AS item_name
       FROM notifications n
       LEFT JOIN bookings b ON b.id = n.booking_id
       LEFT JOIN items i    ON i.id = b.item_id
      WHERE n.user_id = $1
        ${onlyUnread ? 'AND n.read_at IS NULL' : ''}
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT $2`,
    [req.user.id, limit]
  );
  const counts = await query(
    `SELECT COUNT(*) FILTER (WHERE read_at IS NULL) AS unread, COUNT(*) AS total
       FROM notifications WHERE user_id = $1`,
    [req.user.id]
  );
  res.json({
    notifications: rows,
    unread: Number(counts.rows[0].unread),
    total: Number(counts.rows[0].total),
  });
});

// PATCH /api/notifications/:id/read — mark one as read (own rows only).
router.patch('/:id/read', authRequired, async (req, res) => {
  const { rows } = await query(
    `UPDATE notifications SET read_at = COALESCE(read_at, NOW())
      WHERE id = $1 AND user_id = $2 RETURNING *`,
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Notification not found' });
  res.json(rows[0]);
});

// POST /api/notifications/read-all — clear the badge in one go.
router.post('/read-all', authRequired, async (req, res) => {
  const { rowCount } = await query(
    `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
    [req.user.id]
  );
  res.json({ marked: rowCount });
});

export default router;
