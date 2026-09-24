// ============================================================
//  RentalFlow  |  Rental protection  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: API — standing, hand-over codes, claims, incidents
// ============================================================
//   GET  /api/protection/standing            my trust level + anything blocking me   (member)
//   GET  /api/protection/quote?item_id=      deposit + guarantor rule for one item    (member)
//   GET  /api/protection/handover/:bookingId my one-time hand-over code              (the renter only)
//   GET  /api/protection/claims              claims I am part of (admin: all)
//   POST /api/protection/claims/:id/accept   renter accepts the charges
//   POST /api/protection/claims/:id/dispute  renter disputes, with a reason → admin decides
//   POST /api/protection/claims/:id/decide   admin sets the final charges
//   POST /api/protection/claims/:id/paid     owner / admin: the balance was paid
//   POST /api/protection/report-missing/:bookingId   owner / admin, once 72 h overdue
//   GET  /api/protection/incidents           admin: overdue, missing, disputes
//   POST /api/protection/incidents/:id/resolve       admin (optionally lifting the ban)
//   GET  /api/protection/report/:bookingId   data for the incident-report PDF (owner / admin)
//   POST /api/protection/escalate            admin: run the escalation sweep now
//   GET  /api/protection/cron                the daily scheduled sweep (Vercel Cron)
import { Router } from 'express';
import { query, pool } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { signFileUrl } from './files.js';
import {
  standingFor, quoteFor, openClaim, notifyUser, notifyAdmins, runEscalation,
} from '../protection.js';
import { escalationStage, hoursLate, settle, handoverCode, dueAt } from '../protectionUtils.js';

const router = Router();
const money = (n) => `৳${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

async function bookingWithItem(db, id) {
  const { rows } = await db.query(
    `SELECT b.*, i.name AS item_name, i.owner_id, i.replacement_cost, i.rental_price, o.name AS owner_name
       FROM bookings b JOIN items i ON i.id = b.item_id LEFT JOIN users o ON o.id = i.owner_id
      WHERE b.id = $1`,
    [id]
  );
  return rows[0] || null;
}
const isStaff = (u) => u.role === 'admin' || u.role === 'staff';
const isOwner = (u, b) => Number(b.owner_id) === Number(u.id);
const isRenter = (u, b) => (b.renter_id && Number(b.renter_id) === Number(u.id))
  || String(b.customer_email || '').toLowerCase() === String(u.email || '').toLowerCase();

// ---------------------------------------------------------------- standing + quote
router.get('/standing', authRequired, async (req, res) => {
  const s = await standingFor(req.user.id);
  delete s._tier;
  res.json(s);
});

router.get('/quote', authRequired, async (req, res) => {
  const { rows } = await query('SELECT id, replacement_cost, owner_id FROM items WHERE id = $1', [req.query.item_id]);
  if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
  const s = await standingFor(req.user.id);
  const q = quoteFor(s, rows[0]);
  delete s._tier;
  res.json({ ...s, deposit: q, ownItem: Number(rows[0].owner_id) === Number(req.user.id) });
});

// ---------------------------------------------------------------- hand-over code
router.get('/handover/:bookingId', authRequired, async (req, res) => {
  const b = await bookingWithItem({ query }, req.params.bookingId);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  if (!isRenter(req.user, b)) return res.status(403).json({ error: 'Only the renter sees the hand-over code.' });
  let phase = null;
  if (b.status === 'Approved' && !b.checked_out_at) phase = 'checkout';
  else if (b.status === 'Approved' && b.checked_out_at && !b.checked_in_at) phase = 'checkin';
  if (!phase) return res.json({ phase: null });
  let code = b.handover_code;
  if (!code) {                                     // bookings approved before codes existed
    code = handoverCode();
    await query('UPDATE bookings SET handover_code = $2 WHERE id = $1', [b.id, code]);
  }
  res.json({ phase, code });
});

// ---------------------------------------------------------------- claims
router.get('/claims', authRequired, async (req, res) => {
  const params = [];
  let where = '';
  if (!isStaff(req.user)) {
    params.push(req.user.id);
    where = 'WHERE c.renter_id = $1 OR i.owner_id = $1';
  }
  const { rows } = await query(
    `SELECT c.*, b.item_id, b.customer_name, b.customer_email, b.deposit_amount, i.name AS item_name, i.owner_id
       FROM damage_claims c JOIN bookings b ON b.id = c.booking_id JOIN items i ON i.id = b.item_id
       ${where} ORDER BY c.created_at DESC`,
    params
  );
  res.json(rows.map((c) => ({ ...c, mine: Number(c.renter_id) === Number(req.user.id) })));
});

async function claimFor(db, id) {
  const { rows } = await db.query(
    `SELECT c.*, i.owner_id, i.name AS item_name, b.deposit_amount
       FROM damage_claims c JOIN bookings b ON b.id = c.booking_id JOIN items i ON i.id = b.item_id
      WHERE c.id = $1`,
    [id]
  );
  return rows[0] || null;
}

router.post('/claims/:id/accept', authRequired, async (req, res) => {
  const c = await claimFor({ query }, req.params.id);
  if (!c) return res.status(404).json({ error: 'Claim not found' });
  if (Number(c.renter_id) !== Number(req.user.id)) return res.status(403).json({ error: 'Only the renter can accept this claim.' });
  if (c.status !== 'open') return res.status(409).json({ error: 'This claim has already been answered.' });
  const { rows } = await query(
    `UPDATE damage_claims SET status = CASE WHEN balance > 0 THEN 'accepted' ELSE 'paid' END,
            paid_at = CASE WHEN balance > 0 THEN NULL ELSE NOW() END, responded_at = NOW()
      WHERE id = $1 RETURNING *`, [c.id]);
  await notifyUser({ query }, c.owner_id, c.booking_id, 'claim_update', `Claim accepted — ${c.item_name}`,
    `The renter accepted the charges of ${money(c.charges)}`
    + (Number(c.balance) > 0 ? `; ${money(c.balance)} is owed to you beyond the deposit.` : ', all covered by the deposit.'));
  res.json(rows[0]);
});

router.post('/claims/:id/dispute', authRequired, async (req, res) => {
  const reason = String(req.body.reason || '').trim();
  if (reason.length < 10) return res.status(400).json({ error: 'Explain what you disagree with (at least a sentence).' });
  const c = await claimFor({ query }, req.params.id);
  if (!c) return res.status(404).json({ error: 'Claim not found' });
  if (Number(c.renter_id) !== Number(req.user.id)) return res.status(403).json({ error: 'Only the renter can dispute this claim.' });
  if (c.status !== 'open') return res.status(409).json({ error: 'This claim has already been answered.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE damage_claims SET status = 'disputed', renter_response = $2, responded_at = NOW() WHERE id = $1 RETURNING *`,
      [c.id, reason]);
    await client.query(
      `INSERT INTO incidents (booking_id, renter_id, kind, summary) VALUES ($1,$2,'dispute',$3)
       ON CONFLICT (booking_id, kind) DO UPDATE SET status = 'open', summary = EXCLUDED.summary, resolved_at = NULL`,
      [c.booking_id, c.renter_id, `Renter disputes ${money(c.charges)} for ${c.item_name}: “${reason}”`]);
    await notifyAdmins(client, c.booking_id, `Claim disputed: ${c.item_name}`, `The renter disputes ${money(c.charges)}: “${reason}”`);
    await notifyUser(client, c.owner_id, c.booking_id, 'claim_update', `Claim disputed — ${c.item_name}`,
      'The renter disputes the charges. An admin will compare the check-out and return photos and decide.');
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
});

router.post('/claims/:id/decide', authRequired, requireRole('admin'), async (req, res) => {
  const charges = Number(req.body.charges);
  if (!Number.isFinite(charges) || charges < 0) return res.status(400).json({ error: 'Enter the final charges (৳0 or more).' });
  const c = await claimFor({ query }, req.params.id);
  if (!c) return res.status(404).json({ error: 'Claim not found' });
  const s = settle({ charges, deposit: c.deposit_amount });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE damage_claims SET charges = $2, deposit_applied = $3, balance = $4,
              status = CASE WHEN $4::numeric > 0 THEN 'resolved' ELSE 'paid' END,
              paid_at = CASE WHEN $4::numeric > 0 THEN NULL ELSE NOW() END,
              decided_by = $5, decided_at = NOW(), decision_notes = $6
        WHERE id = $1 RETURNING *`,
      [c.id, s.charges, s.depositApplied, s.balance, req.user.id, req.body.notes || null]);
    await client.query(
      `UPDATE incidents SET status = 'resolved', resolved_by = $2, resolved_at = NOW(), resolution = $3
        WHERE booking_id = $1 AND kind = 'dispute'`,
      [c.booking_id, req.user.id, `Charges set to ${money(s.charges)}`]);
    const text = `An admin set the final charges to ${money(s.charges)}: ${money(s.depositApplied)} from the deposit`
      + (s.balance > 0 ? `, ${money(s.balance)} still owed.` : `, ${money(s.refund)} of the deposit refunded.`)
      + (req.body.notes ? ` Note: ${req.body.notes}` : '');
    await notifyUser(client, c.renter_id, c.booking_id, 'claim_update', `Decision on your claim — ${c.item_name}`, text);
    await notifyUser(client, c.owner_id, c.booking_id, 'claim_update', `Decision on your claim — ${c.item_name}`, text);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
});

router.post('/claims/:id/paid', authRequired, async (req, res) => {
  const c = await claimFor({ query }, req.params.id);
  if (!c) return res.status(404).json({ error: 'Claim not found' });
  if (!isStaff(req.user) && Number(c.owner_id) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Only the owner (or an admin) can confirm the balance was paid.' });
  }
  if (!['accepted', 'resolved'].includes(c.status)) return res.status(409).json({ error: 'Nothing is owed on this claim yet.' });
  const { rows } = await query(`UPDATE damage_claims SET status = 'paid', paid_at = NOW() WHERE id = $1 RETURNING *`, [c.id]);
  await notifyUser({ query }, c.renter_id, c.booking_id, 'claim_update', `Balance settled — ${c.item_name}`,
    'The owner confirmed your balance is paid. You can rent again.');
  res.json(rows[0]);
});

// ---------------------------------------------------------------- report missing
router.post('/report-missing/:bookingId', authRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = await bookingWithItem(client, req.params.bookingId);
    if (!b) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Booking not found' }); }
    if (!isStaff(req.user) && !isOwner(req.user, b)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the item’s owner (or an admin) can report it missing.' });
    }
    if (b.status !== 'Approved' || !b.checked_out_at || b.checked_in_at) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Only an item that is out with a renter can be reported missing.' });
    }
    // An owner must wait out the 72 hours; an admin may act sooner (e.g. clear evidence of theft).
    if (escalationStage(b.end_date) < 5 && req.user.role !== 'admin') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An item can be reported missing once it is 3 days overdue. Until then the renter is being reminded and frozen automatically.' });
    }
    const details = String(req.body.details || '').trim() || null;
    await client.query(
      `UPDATE bookings SET status = 'Missing', missing_reported_at = NOW(), escalation_stage = 5 WHERE id = $1`, [b.id]);
    await client.query(`UPDATE items SET status = 'Missing' WHERE id = $1`, [b.item_id]);
    // The item's full value is charged: the deposit pays first.
    const claim = await openClaim(client, {
      booking: { ...b, renter_id: b.renter_id }, charges: b.replacement_cost, kind: 'missing',
      details: details || 'Reported missing by the owner after the item was not returned.',
    });
    // Ban by identity: the account is suspended and its NID + face are blacklisted,
    // so a new account with the same card or face is refused (see routes/verify.js).
    let banned = false;
    if (b.renter_id) {
      const { rows: [renter] } = await client.query(
        'SELECT id, nid_canonical, face_descriptor FROM users WHERE id = $1', [b.renter_id]);
      if (renter && renter.id) {
        await client.query(`UPDATE users SET status = 'suspended' WHERE id = $1 AND role = 'member'`, [renter.id]);
        await client.query(
          `INSERT INTO identity_blacklist (user_id, nid_canonical, face_descriptor, reason, booking_id, created_by)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [renter.id, renter.nid_canonical, renter.face_descriptor,
            `Did not return ${b.item_name} (booking #${b.id}); reported missing.`, b.id, req.user.id]);
        banned = true;
      }
    }
    const { rows: [incident] } = await client.query(
      `INSERT INTO incidents (booking_id, renter_id, kind, summary, created_by)
       VALUES ($1,$2,'missing',$3,$4)
       ON CONFLICT (booking_id, kind) DO UPDATE SET status = 'open', summary = EXCLUDED.summary RETURNING *`,
      [b.id, b.renter_id, `${b.item_name} (worth ${money(b.replacement_cost)}) was not returned by ${b.customer_name} `
        + `(${b.customer_email}), ${hoursLate(b.end_date)} hours after its due date.${details ? ` Owner: “${details}”` : ''}`,
        req.user.id]);
    await client.query(
      `UPDATE incidents SET status = 'resolved', resolved_at = NOW(), resolution = 'Became a missing-item report'
        WHERE booking_id = $1 AND kind = 'overdue' AND status = 'open'`, [b.id]);
    await notifyAdmins(client, b.id, `Item reported missing: ${b.item_name}`,
      `${b.owner_name} reported ${b.item_name} missing. ${b.customer_name} is banned and their identity blacklisted. `
      + 'Open the incident to download the police report.');
    await client.query('COMMIT');
    res.status(201).json({ incident, claim, banned });
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
});

// ---------------------------------------------------------------- incidents (admin)
router.get('/incidents', authRequired, requireRole('admin'), async (req, res) => {
  const { rows } = await query(
    `SELECT n.*, b.item_id, b.end_date, b.status AS booking_status, b.customer_name, b.customer_email,
            b.deposit_amount, b.guarantor_name, b.guarantor_phone, b.guarantor_relation, b.escalation_stage,
            i.name AS item_name, i.replacement_cost, o.name AS owner_name,
            c.id AS claim_id, c.status AS claim_status, c.charges, c.balance, c.renter_response,
            u.status AS renter_status
       FROM incidents n JOIN bookings b ON b.id = n.booking_id JOIN items i ON i.id = b.item_id
       LEFT JOIN users o ON o.id = i.owner_id LEFT JOIN users u ON u.id = n.renter_id
       LEFT JOIN damage_claims c ON c.booking_id = n.booking_id
      ORDER BY (n.status = 'open') DESC, n.created_at DESC`
  );
  const { rows: unpaid } = await query(
    `SELECT c.*, i.name AS item_name, b.customer_name, b.customer_email
       FROM damage_claims c JOIN bookings b ON b.id = c.booking_id JOIN items i ON i.id = b.item_id
      WHERE c.status IN ('accepted', 'resolved') AND c.balance > 0 AND c.paid_at IS NULL
      ORDER BY c.created_at`
  );
  const { rows: blacklist } = await query(
    `SELECT l.id, l.reason, l.created_at, l.booking_id, u.name, u.email
       FROM identity_blacklist l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.created_at DESC`
  );
  res.json({ incidents: rows.map((r) => ({ ...r, hours_late: hoursLate(r.end_date) })), unpaid, blacklist });
});

router.post('/incidents/:id/resolve', authRequired, requireRole('admin'), async (req, res) => {
  const resolution = String(req.body.resolution || '').trim();
  if (resolution.length < 3) return res.status(400).json({ error: 'Say how it was resolved.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [n] } = await client.query(
      `UPDATE incidents SET status = 'resolved', resolved_by = $2, resolved_at = NOW(), resolution = $3
        WHERE id = $1 RETURNING *`, [req.params.id, req.user.id, resolution]);
    if (!n) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Incident not found' }); }
    // The item came back after all: lift the ban and put the item back on the shelf.
    if (req.body.lift_ban && n.renter_id) {
      await client.query('DELETE FROM identity_blacklist WHERE user_id = $1 AND booking_id = $2', [n.renter_id, n.booking_id]);
      await client.query(`UPDATE users SET status = 'active' WHERE id = $1`, [n.renter_id]);
      if (n.kind === 'missing') {
        await client.query(`UPDATE bookings SET status = 'Completed', checked_in_at = COALESCE(checked_in_at, NOW()) WHERE id = $1`, [n.booking_id]);
        await client.query(`UPDATE items SET status = 'Available' WHERE id = (SELECT item_id FROM bookings WHERE id = $1)`, [n.booking_id]);
      }
    }
    await client.query('COMMIT');
    res.json(n);
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
});

// ---------------------------------------------------------------- incident report (PDF data)
// Everything needed to file a General Diary (GD) at the police station. The
// owner's copy names the renter and their verified contact details; the NID
// number and card photos are in the admin's copy only (the same rule as
// everywhere else) — the police can request them from RentalFlow.
router.get('/report/:bookingId', authRequired, async (req, res) => {
  const b = await bookingWithItem({ query }, req.params.bookingId);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  if (!isStaff(req.user) && !isOwner(req.user, b)) return res.status(403).json({ error: 'Not your booking.' });
  const { rows: [renter] } = await query(
    `SELECT id, name, email, phone, verification_status, nid_number, nid_name, nid_front_url, nid_back_url, created_at
       FROM users WHERE id = $1`, [b.renter_id || 0]);
  const { rows: reports } = await query('SELECT * FROM condition_reports WHERE booking_id = $1 ORDER BY created_at', [b.id]);
  const { rows: [claim] } = await query('SELECT * FROM damage_claims WHERE booking_id = $1', [b.id]);
  const { rows: messages } = await query(
    `SELECT m.body, m.created_at, u.name AS sender
       FROM conversations c JOIN messages m ON m.conversation_id = c.id JOIN users u ON u.id = m.sender_id
      WHERE c.item_id = $1 AND (c.renter_id = $2 OR c.owner_id = $2)
      ORDER BY m.created_at DESC LIMIT 30`,
    [b.item_id, b.renter_id || 0]
  ).catch(() => ({ rows: [] }));
  const admin = req.user.role === 'admin';
  res.json({
    generatedAt: new Date().toISOString(),
    booking: {
      id: b.id, status: b.status, item: b.item_name, value: b.replacement_cost, startDate: b.start_date, endDate: b.end_date,
      dueAt: dueAt(b.end_date).toISOString(), hoursLate: hoursLate(b.end_date), deposit: b.deposit_amount,
      depositReceivedAt: b.deposit_received_at, checkedOutAt: b.checked_out_at,
      renterConfirmedCheckoutAt: b.renter_confirmed_checkout_at, missingReportedAt: b.missing_reported_at,
      agreement: b.agreement_number,
    },
    owner: { name: b.owner_name },
    renter: renter ? {
      name: renter.name, email: renter.email, phone: renter.phone, memberSince: renter.created_at,
      identityVerified: renter.verification_status === 'verified',
      nidName: renter.nid_name,
      ...(admin ? { nidNumber: renter.nid_number, nidFront: signFileUrl(renter.nid_front_url), nidBack: signFileUrl(renter.nid_back_url) } : {}),
    } : { name: b.customer_name, email: b.customer_email },
    guarantor: b.guarantor_name ? { name: b.guarantor_name, phone: b.guarantor_phone, relation: b.guarantor_relation } : null,
    conditionReports: reports.map((r) => ({ phase: r.phase, condition: r.condition_status, notes: r.notes, photos: r.photos.length, at: r.created_at })),
    claim: claim ? { charges: claim.charges, depositApplied: claim.deposit_applied, balance: claim.balance, status: claim.status } : null,
    messages: messages.reverse(),
    adminCopy: admin,
  });
});

// ---------------------------------------------------------------- the sweep
router.post('/escalate', authRequired, requireRole('admin'), async (_req, res) => {
  res.json(await runEscalation());
});
// Vercel Cron calls this once a day as a safety net (the sweep also runs as the
// site is used). With CRON_SECRET set, only Vercel's call is accepted.
router.get('/cron', async (req, res) => {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.json(await runEscalation());
});

export default router;
