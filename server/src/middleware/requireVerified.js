// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: the gates — email at sign-up, identity to rent
// ============================================================
// Runs in front of every /api route and applies two rules to MEMBERS:
//
//   1. A new account must confirm its email before using the platform.
//      → 403 reason 'verification-required'; the app opens the email step.
//
//   2. Only an identity-verified member may request a rental. The NID and live
//      selfie check happens the first time someone rents, and is then saved on
//      the account for good; browsing, listing and chat need only the email.
//      → 403 reason 'rental-verification-required' on POST /api/bookings.
//
// Enforced here, on the server, so it cannot be skipped by typing a URL or
// calling the API directly. Admin and staff accounts are created by an admin
// and are never gated.
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const OPEN_PREFIXES = ['/auth', '/verify', '/files', '/health', '/notifications', '/handoff'];
// Public catalogue reads — a guest can see these anyway.
const OPEN_READS = ['/items', '/categories'];

// "Verified" for renting means: the check passed AND the NID is on file. An
// account from before verification existed, with no NID, does the new check
// at its first rental like everyone else.
export function identityVerified(u) {
  if (!u) return false;
  if (u.role && u.role !== 'member') return true;
  return u.verification_status === 'verified' && Boolean(u.nid_number);
}

export async function requireVerified(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();   // guests: routes decide for themselves

  let payload;
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    return next();   // invalid token: authRequired answers 401
  }
  if (payload.role !== 'member') return next();

  const requestingRental = req.method === 'POST' && req.path === '/bookings';
  const open = OPEN_PREFIXES.some((p) => req.path.startsWith(p))
    || (req.method === 'GET' && OPEN_READS.some((p) => req.path.startsWith(p)));
  if (open && !requestingRental) return next();

  const { rows } = await query(
    'SELECT role, verification_status, email_verified_at, nid_number FROM users WHERE id = $1',
    [payload.id]
  );
  const u = rows[0];
  if (!u) return next();

  if (!u.email_verified_at) {
    return res.status(403).json({
      error: 'Confirm your email to start using RentalFlow.',
      reason: 'verification-required',
    });
  }
  if (requestingRental && !identityVerified(u)) {
    return res.status(403).json({
      error: u.verification_status === 'pending_review'
        ? 'Your ID is being checked by our team. You can book as soon as it is approved.'
        : 'Verify your identity before your first rental. It takes about 2 minutes, and only once.',
      reason: 'rental-verification-required',
      status: u.verification_status,
    });
  }
  next();
}
