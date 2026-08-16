// ============================================================
//  RentalFlow  |  Sprint 3  |  Part: QR scan resolver (F12)
// ============================================================
// A phone's native camera opens /scan/:token (a URL encoded in the item's QR).
// The React app calls this endpoint to resolve the token into an item and its
// active booking, then offers check-out / check-in actions. Raw SQL, no ORM.
import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// GET /api/scan/:token  — resolve a QR token to its item + current booking.
router.get('/:token', async (req, res) => {
  const items = await query('SELECT * FROM items WHERE qr_token = $1', [req.params.token]);
  if (!items.rows[0]) return res.status(404).json({ error: 'Unknown QR code' });
  const item = items.rows[0];
  const bookings = await query(
    `SELECT * FROM bookings
      WHERE item_id = $1 AND status IN ('Approved','Pending')
      ORDER BY start_date ASC
      LIMIT 1`,
    [item.id]
  );
  res.json({ item, activeBooking: bookings.rows[0] || null });
});

export default router;
