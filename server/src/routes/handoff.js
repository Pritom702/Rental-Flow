// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: "continue on your phone" — QR sign-in hand-off
// ============================================================
// Photographing an NID card and doing a live selfie is far easier on a phone
// than on a laptop webcam. A member who signed up on a computer can move the
// verification to their phone by scanning a QR code:
//
//   POST /api/verify/handoff   (computer, signed in)  → a one-time link
//   POST /api/handoff/redeem   (phone, not signed in) → a normal session
//
// The link is the only secret, so it is guarded three ways: it works once,
// it expires after 15 minutes, and it only signs in to an account that is still
// being verified — a verified account can never be taken over through one.
// Only a SHA-256 hash of the link is stored, like a password.
import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

export const HANDOFF_MINUTES = 15;

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Called by the verify router for the signed-in computer.
export async function createHandoff(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await query(
    `INSERT INTO handoff_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
    [hash(token), userId, String(HANDOFF_MINUTES)]
  );
  return { path: `/verify/phone/${token}`, expiresInMinutes: HANDOFF_MINUTES };
}

const router = Router();

router.post('/redeem', async (req, res) => {
  const token = String(req.body.token || '');
  // Mark the link used in the same statement that checks it, so two phones
  // scanning at the same instant cannot both get in.
  const { rows } = await query(
    `UPDATE handoff_tokens t SET used_at = NOW()
       FROM users u
      WHERE t.token_hash = $1 AND u.id = t.user_id
        AND t.used_at IS NULL AND t.expires_at > NOW()
        AND u.role = 'member' AND u.verification_status <> 'verified' AND u.status = 'active'
      RETURNING u.id, u.name, u.email, u.role, u.verification_status, u.email_verified_at`,
    [hash(token)]
  );
  const u = rows[0];
  if (!u) {
    return res.status(410).json({
      error: 'This QR code has expired or was already used. Make a new one on your computer.',
    });
  }
  const user = { id: u.id, name: u.name, email: u.email, role: u.role };
  const session = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token: session, user: { ...user, verificationStatus: u.verification_status, emailVerified: Boolean(u.email_verified_at) } });
});

export default router;
