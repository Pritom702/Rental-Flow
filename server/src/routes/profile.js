// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: User profile — account details, NID (write-once), payment methods
// ============================================================
// Every route here is about the CALLER's own account. There is no :userId in
// any path — the identity always comes from the verified JWT — so one member
// can never read or write another member's NID or payment details.
//
// Note the routes that deliberately do NOT exist:
//   DELETE /profile/nid                  — a NID is recorded once, forever
//   DELETE /profile/payment-methods/:id  — payment methods are permanent
import { Router } from 'express';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import {
  normalizeNid, maskNid, canSubmitNid,
  isValidPaymentMethod, maskAccountRef, defaultLabel, shouldBecomeDefault,
} from '../profileUtils.js';

const router = Router();
router.use(authRequired);

// Columns that are safe to send to the browser. The raw nid_number is NEVER in
// this list — it is masked by the handler before it leaves the server.
const ACCOUNT_COLUMNS = `id, name, email, role, status, phone,
  nid_number, nid_name, nid_front_url, nid_back_url, nid_submitted_at, created_at`;

async function loadUser(id) {
  const { rows } = await query(`SELECT ${ACCOUNT_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function loadPaymentMethods(userId) {
  const { rows } = await query(
    `SELECT id, kind, label, account_ref, is_default, is_active, created_at
       FROM payment_methods WHERE user_id = $1
      ORDER BY is_default DESC, created_at`,
    [userId]
  );
  return rows;
}

// Everything the profile page shows, in one round trip.
// GET /api/profile
router.get('/', async (req, res) => {
  const user = await loadUser(req.user.id);
  if (!user) return res.status(404).json({ error: 'Account not found' });

  // Activity: what this account has done on the platform. A member sees their
  // own listings and the bookings they made; owners also see bookings received.
  const [listings, madeBookings, receivedBookings] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'Available')::int AS available,
              COUNT(*) FILTER (WHERE status = 'Rented')::int    AS rented
         FROM items WHERE owner_id = $1`,
      [user.id]
    ),
    query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE b.status = 'Completed')::int AS completed,
              COUNT(*) FILTER (WHERE b.status IN ('Pending','Approved'))::int AS active,
              COALESCE(SUM(b.late_fee_amount + b.penalty_amount), 0)::numeric AS fees
         FROM bookings b WHERE LOWER(b.customer_email) = LOWER($1)`,
      [user.email]
    ),
    query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE b.status = 'Pending')::int AS pending
         FROM bookings b JOIN items i ON i.id = b.item_id
        WHERE i.owner_id = $1`,
      [user.id]
    ),
  ]);

  res.json({
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      phone: user.phone,
      memberSince: user.created_at,
    },
    // The identity block. `number` is masked; the full value never leaves the DB.
    nid: user.nid_number
      ? {
        onFile: true,
        number: maskNid(user.nid_number),
        name: user.nid_name,
        frontUrl: user.nid_front_url,
        backUrl: user.nid_back_url,
        submittedAt: user.nid_submitted_at,
      }
      : { onFile: false },
    paymentMethods: await loadPaymentMethods(user.id),
    activity: {
      listings: listings.rows[0],
      bookingsMade: {
        ...madeBookings.rows[0],
        fees: Number(madeBookings.rows[0].fees),
      },
      bookingsReceived: receivedBookings.rows[0],
    },
  });
});

// PATCH /api/profile — the few details a member may edit freely.
router.patch('/', async (req, res) => {
  const { name, phone } = req.body;
  const { rows } = await query(
    `UPDATE users SET name = COALESCE($2, name), phone = COALESCE($3, phone)
      WHERE id = $1 RETURNING ${ACCOUNT_COLUMNS}`,
    [req.user.id, name || null, phone || null]
  );
  res.json({ id: rows[0].id, name: rows[0].name, phone: rows[0].phone });
});

// POST /api/profile/nid — submit the National ID. Allowed exactly once.
//
// This is the damage-control requirement: before a member can request a booking
// we need a verified real identity behind it, so a penalty for a broken item is
// actually enforceable. Once stored the value can never be edited — by the API,
// by the UI, or by a direct UPDATE (a database trigger blocks that too).
router.post('/nid', async (req, res) => {
  const user = await loadUser(req.user.id);
  if (!user) return res.status(404).json({ error: 'Account not found' });

  const submission = {
    nid_number: normalizeNid(req.body.nid_number),
    nid_name: req.body.nid_name,
    nid_front_url: req.body.nid_front_url,
    nid_back_url: req.body.nid_back_url || null,
  };

  const check = canSubmitNid(user, submission);
  if (!check.ok) {
    const messages = {
      'already-on-file': 'A National ID is already recorded on this account and cannot be changed.',
      'invalid-number': 'A Bangladeshi NID must be 10, 13 or 17 digits.',
      'missing-name': 'Enter the full name exactly as printed on the NID.',
      'missing-front-image': 'Upload a photo of the front of the NID.',
    };
    return res.status(check.reason === 'already-on-file' ? 409 : 400)
      .json({ error: messages[check.reason], reason: check.reason });
  }

  try {
    const { rows } = await query(
      `UPDATE users
          SET nid_number = $2, nid_name = $3, nid_front_url = $4,
              nid_back_url = $5, nid_submitted_at = NOW()
        WHERE id = $1 AND nid_number IS NULL
        RETURNING id, nid_number, nid_name, nid_front_url, nid_back_url, nid_submitted_at`,
      [user.id, submission.nid_number, String(submission.nid_name).trim(),
        submission.nid_front_url, submission.nid_back_url]
    );
    // The WHERE guard lost a race with a second concurrent submit.
    if (!rows[0]) {
      return res.status(409).json({
        error: 'A National ID is already recorded on this account and cannot be changed.',
        reason: 'already-on-file',
      });
    }
    const saved = rows[0];
    res.status(201).json({
      onFile: true,
      number: maskNid(saved.nid_number),
      name: saved.nid_name,
      frontUrl: saved.nid_front_url,
      backUrl: saved.nid_back_url,
      submittedAt: saved.nid_submitted_at,
    });
  } catch (err) {
    // The partial unique index: this national ID already backs another account.
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'This National ID is already registered to another account.',
        reason: 'nid-taken',
      });
    }
    throw err;
  }
});

// POST /api/profile/payment-methods — add one. Append-only, and permanent.
router.post('/payment-methods', async (req, res) => {
  const { kind, account_ref, label } = req.body;

  const check = isValidPaymentMethod({ kind, account_ref });
  if (!check.ok) {
    const messages = {
      'invalid-kind': 'Choose bKash, Nagad, Rocket, Card or Bank.',
      'missing-account': 'Enter the account or wallet number.',
      'invalid-mobile': 'A mobile wallet number must be 11 digits, starting 01.',
      'invalid-card': 'A card number must be 13–19 digits.',
      'invalid-account': 'That bank account number looks too short.',
    };
    return res.status(400).json({ error: messages[check.reason], reason: check.reason });
  }

  // Mask before storing: the full number never reaches our database.
  const masked = maskAccountRef(kind, account_ref);
  const existing = await loadPaymentMethods(req.user.id);
  const makeDefault = shouldBecomeDefault(existing);

  const { rows } = await query(
    `INSERT INTO payment_methods (user_id, kind, label, account_ref, is_default)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, kind, label, account_ref, is_default, is_active, created_at`,
    [req.user.id, kind, (label || '').trim() || defaultLabel(kind, masked), masked, makeDefault]
  );
  res.status(201).json(rows[0]);
});

// PATCH /api/profile/payment-methods/:id — the only changes ever allowed:
// make it the default, or deactivate it. Deleting is not offered anywhere.
router.patch('/payment-methods/:id', async (req, res) => {
  const { id } = req.params;
  const { is_default, is_active } = req.body;

  const { rows: own } = await query(
    'SELECT id, is_active FROM payment_methods WHERE id = $1 AND user_id = $2',
    [id, req.user.id]
  );
  if (!own[0]) return res.status(404).json({ error: 'Payment method not found' });

  if (is_default === true) {
    if (own[0].is_active === false) {
      return res.status(400).json({ error: 'A deactivated method cannot be the default.' });
    }
    // One default per user is a unique index, so clear the old one first.
    await query('UPDATE payment_methods SET is_default = FALSE WHERE user_id = $1 AND is_default', [req.user.id]);
    await query('UPDATE payment_methods SET is_default = TRUE WHERE id = $1', [id]);
  }

  if (is_active === false) {
    // Deactivating the default leaves the account without one; that is fine,
    // the row and its history stay exactly where they are.
    await query('UPDATE payment_methods SET is_active = FALSE, is_default = FALSE WHERE id = $1', [id]);
  } else if (is_active === true) {
    await query('UPDATE payment_methods SET is_active = TRUE WHERE id = $1', [id]);
  }

  const { rows } = await query(
    `SELECT id, kind, label, account_ref, is_default, is_active, created_at
       FROM payment_methods WHERE id = $1`,
    [id]
  );
  res.json(rows[0]);
});

// Spelled out rather than left to the 404 handler, so the rule is visible in
// the API itself and anyone reading the code sees why it is missing.
router.delete('/payment-methods/:id', (_req, res) => {
  res.status(405).json({
    error: 'Payment methods are permanent and cannot be removed. Deactivate it instead.',
    reason: 'permanent',
  });
});

router.delete('/nid', (_req, res) => {
  res.status(405).json({
    error: 'A National ID is recorded once and cannot be removed.',
    reason: 'permanent',
  });
});

export default router;
