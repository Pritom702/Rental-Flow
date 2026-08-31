// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: F20 suspended-account guard
// ============================================================
// An admin can suspend a staff/member account instead of deleting it (deleting
// would take their rental history with it). Existing JWTs stay valid for 7 days,
// so suspension is enforced here on every authenticated API call.
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

export async function blockSuspended(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();
  let payload;
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    return next();   // invalid token: let authRequired produce the 401
  }
  try {
    const { rows } = await query('SELECT status FROM users WHERE id = $1', [payload.id]);
    if (rows[0] && rows[0].status === 'suspended') {
      return res.status(403).json({ error: 'This account has been suspended by an administrator' });
    }
  } catch {
    // Table missing (schema not migrated yet) — do not lock everyone out.
  }
  next();
}
