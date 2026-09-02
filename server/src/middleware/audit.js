// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: F20 audit logging middleware
// ============================================================
// Writes one audit_logs row for every state-changing API call. It runs after the
// response has been sent (res 'finish') so logging never slows a request down,
// and a logging failure is swallowed — an audit problem must not break the app.
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const TRACKED = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Human-readable one-liner stored with the row, e.g. "status -> Approved".
function summarize(req) {
  const body = req.body || {};
  if (body.status) return `status -> ${body.status}`;
  if (req.path.includes('/checkout')) return 'item checked out';
  if (req.path.includes('/checkin')) return 'item checked in';
  if (body.name) return `name: ${body.name}`;
  if (body.description) return String(body.description).slice(0, 80);
  if (body.email) return `account: ${body.email}`;
  return null;
}

// The auth middleware only runs on protected routes, so read the token here too
// to attribute calls that were rejected before authRequired ran.
function readUser(req) {
  if (req.user) return req.user;
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

export function auditLogger(req, res, next) {
  if (!TRACKED.includes(req.method)) return next();

  res.on('finish', () => {
    const user = readUser(req);
    // '/api/bookings/12/status' -> entity 'bookings', entity_id '12'
    const segments = req.originalUrl.split('?')[0].split('/').filter(Boolean);
    const entity = segments[1] || 'api';
    const entityId = segments[2] && /^\d+$/.test(segments[2]) ? segments[2] : null;

    query(
      `INSERT INTO audit_logs (user_id, user_email, action, entity, entity_id, path, status_code, summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [user?.id || null, user?.email || null, req.method, entity, entityId,
       req.originalUrl, res.statusCode, summarize(req)]
    ).catch(() => { /* auditing must never break the request that was already served */ });
  });

  next();
}
