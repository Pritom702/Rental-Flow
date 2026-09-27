// ============================================================
//  RentalFlow  |  Marketplace  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: RentalFlow Pay — the DEMO payment gateway
// ============================================================
// A booking or a sale is paid only after it is agreed: the owner approves the
// booking (or the seller accepts the offer) and sends a payment request into
// the chat, which leads to this payment page. This is a demo:
// no real money moves and no payment brand is imitated. It shows the whole
// journey — what is paid, how, the receipt — and does what a real payment
// would do on RentalFlow:
//   • a sale: the deal is agreed at the paid price, the item is marked sold,
//     the chat unlocks and the seller is told they have been paid
//   • a booking: the approved booking is marked paid (rent + fees + refundable
//     deposit, held until the rental ends); a cancelled paid booking is refunded
import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { earn } from '../credits.js';
import { EARN, rentalDays, rentalFees } from '../marketUtils.js';

const router = Router();
const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });
const taka = (n) => `৳${Math.round(n).toLocaleString('en-IN')}`;
const METHODS = ['bkash', 'nagad', 'rocket', 'card'];
const newTran = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

async function notify(userId, title, body, link) {
  await query(`INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, 'deal', $2, $3, $4)`, [userId, title, body, link]);
}
async function systemLine(convoId, senderId, text) {
  await query(`INSERT INTO messages (conversation_id, sender_id, body, kind) VALUES ($1, $2, $3, 'system')`, [convoId, senderId, text]);
  await query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [convoId]);
}

// ---------------------------------------------------------------- payment requests
// Asking to book or to buy costs nothing. Once the owner approves the booking
// (or the seller accepts the offer), THEY send a payment request into the
// chat; the renter / buyer taps it and pays on RentalFlow Pay.

// What a booking costs the renter: rent, service fee, protection, deposit.
async function bookingLines(b) {
  const { rows: [saved] } = await query('SELECT * FROM booking_fees WHERE booking_id = $1', [b.id]);
  const days = rentalDays(b.start_date, b.end_date);
  const f = saved
    ? { rentalTotal: saved.rental_total, renterFee: saved.renter_fee, protectionFee: saved.protection_fee }
    : rentalFees(b.rental_price, days, { protection: false });
  const deposit = Math.round(Number(b.deposit_amount) || 0);
  return [
    { label: `Rent (${days === 1 ? '1 day' : `${days} days`})`, amount: Math.round(Number(f.rentalTotal)) },
    { label: 'Service fee', amount: Math.round(Number(f.renterFee)) },
    ...(Number(f.protectionFee) ? [{ label: 'Damage protection', amount: Math.round(Number(f.protectionFee)) }] : []),
    ...(deposit ? [{ label: 'Refundable deposit', amount: deposit }] : []),
  ].filter((l) => l.amount > 0);
}

const isoDay = (d) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);

// What the owner / seller could ask to be paid in this chat right now, if anything.
export async function payableIn(convo) {
  if (convo.item_id) {
    const { rows: [b] } = await query(
      `SELECT b.*, i.rental_price, i.name AS item_name FROM bookings b JOIN items i ON i.id = b.item_id
        WHERE b.item_id = $1 AND b.renter_id = $2 AND b.status = 'Approved' AND b.paid_at IS NULL
        ORDER BY b.id DESC LIMIT 1`, [convo.item_id, convo.renter_id]);
    if (!b) return null;
    const lines = await bookingLines(b);
    const amount = lines.reduce((s, l) => s + l.amount, 0);
    if (!(amount > 0)) return null;
    return { purpose: 'booking', ref: b.id, amount, lines, label: `${b.item_name}, ${isoDay(b.start_date)} to ${isoDay(b.end_date)}` };
  }
  if (convo.post_id) {
    const { rows: [d] } = await query(
      `SELECT * FROM sale_deals WHERE conversation_id = $1 AND status = 'accepted' AND paid_at IS NULL ORDER BY id DESC LIMIT 1`, [convo.id]);
    if (!d) return null;
    return { purpose: 'sale', ref: d.id, amount: d.price, lines: [{ label: 'Item price', amount: d.price }], label: 'the agreed price' };
  }
  return null;
}

// A payment request already sent and not paid yet.
async function pendingRequest(purpose, ref) {
  const { rows: [p] } = await query(
    `SELECT * FROM payments WHERE purpose = $1 AND ref_id = $2 AND status = 'pending' AND requested_by IS NOT NULL ORDER BY id DESC LIMIT 1`,
    [purpose, ref]);
  return p || null;
}
export async function pendingRequestFor(convo) {
  const due = await payableIn(convo);
  return due ? pendingRequest(due.purpose, due.ref) : null;
}

// POST /api/payments/request  { conversation_id } or { booking_id } — the owner / seller asks to be paid.
router.post('/request', authRequired, async (req, res) => {
  if (!(Number(req.body.booking_id) > 0) && !(Number(req.body.conversation_id) > 0)) throw httpError(400, 'Which booking or chat is this for?');
  let convo;
  if (req.body.booking_id) {
    const { rows: [b] } = await query(
      `SELECT b.item_id, b.renter_id, i.owner_id FROM bookings b JOIN items i ON i.id = b.item_id WHERE b.id = $1`, [Number(req.body.booking_id)]);
    if (!b || b.owner_id !== req.user.id) throw httpError(404, 'Booking not found.');
    if (!b.renter_id || b.renter_id === b.owner_id) throw httpError(400, 'This booking was made at the counter — take the payment in person.');
    ({ rows: [convo] } = await query(
      `INSERT INTO conversations (item_id, renter_id, owner_id) VALUES ($1, $2, $3)
       ON CONFLICT (item_id, renter_id, owner_id) WHERE item_id IS NOT NULL DO UPDATE SET item_id = EXCLUDED.item_id
       RETURNING *`, [b.item_id, b.renter_id, b.owner_id]));
  } else {
    ({ rows: [convo] } = await query('SELECT * FROM conversations WHERE id = $1 AND owner_id = $2', [Number(req.body.conversation_id), req.user.id]));
  }
  if (!convo) throw httpError(404, 'Only the owner or seller can ask for a payment in this chat.');
  const due = await payableIn(convo);
  if (!due) {
    throw httpError(409, convo.post_id
      ? 'Accept an offer first — then you can ask the buyer to pay.'
      : 'Approve the booking request first — then you can ask the renter to pay.', { reason: 'nothing-to-pay' });
  }
  // Asking twice re-sends the same request instead of making a second one.
  let p = await pendingRequest(due.purpose, due.ref);
  if (!p) {
    ({ rows: [p] } = await query(
      `INSERT INTO payments (tran_id, user_id, purpose, ref_id, amount, breakdown, requested_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [newTran(due.purpose === 'sale' ? 'SALE' : 'BOOK'), convo.renter_id, due.purpose, due.ref, due.amount, JSON.stringify(due.lines), req.user.id]));
  }
  const { rows: [msg] } = await query(
    `INSERT INTO messages (conversation_id, sender_id, body, kind, payment_tran) VALUES ($1, $2, $3, 'payreq', $4)
     RETURNING id, sender_id, kind, guard_flags, body, created_at, read_at, payment_tran`,
    [convo.id, req.user.id, `Payment request: ${taka(p.amount)} for ${due.label}.`, p.tran_id]);
  await query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [convo.id]);
  const { rows: [who] } = await query('SELECT name FROM users WHERE id = $1', [req.user.id]);
  await notify(convo.renter_id, 'Payment request', `${who?.name || 'They'} asked you to pay ${taka(p.amount)}. Tap to pay on RentalFlow.`, `/pay/${p.tran_id}`);
  res.status(201).json({
    conversation_id: convo.id, tran: p.tran_id,
    message: { ...msg, payment: { tran: p.tran_id, amount: p.amount, status: p.status, breakdown: p.breakdown } },
  });
});

// POST /api/payments/sale  { conversation_id } and /booking  { booking_id } — the buyer / renter
// opens the payment the other side asked for. Nothing can be paid before that request.
async function openRequested(res, convo, waitMsg) {
  const p = convo && await pendingRequestFor(convo);
  if (!p) throw httpError(409, waitMsg, { reason: 'awaiting-payment-request' });
  res.status(201).json({ tran: p.tran_id, pay: `/pay/${p.tran_id}` });
}
router.post('/sale', authRequired, async (req, res) => {
  const { rows: [c] } = await query('SELECT * FROM conversations WHERE id = $1 AND renter_id = $2', [Number(req.body.conversation_id), req.user.id]);
  if (!c?.post_id) throw httpError(404, 'Payments are made in a chat about something for sale.');
  const { rows: [deal] } = await query(
    `SELECT status, paid_at FROM sale_deals WHERE conversation_id = $1 ORDER BY id DESC LIMIT 1`, [c.id]);
  if (deal?.paid_at) throw httpError(409, 'This is already paid.');
  if (!deal || deal.status !== 'accepted') {
    throw httpError(409, 'The seller has to accept your offer first. They then send you a payment request.', { reason: 'awaiting-seller' });
  }
  await openRequested(res, c, 'The seller will send you a payment request in the chat. You can pay as soon as it arrives.');
});
router.post('/booking', authRequired, async (req, res) => {
  const { rows: [b] } = await query(
    `SELECT b.*, i.owner_id FROM bookings b JOIN items i ON i.id = b.item_id WHERE b.id = $1 AND b.renter_id = $2`,
    [Number(req.body.booking_id), req.user.id]);
  if (!b) throw httpError(404, 'Booking not found.');
  if (b.paid_at) throw httpError(409, 'This booking is already paid.');
  if (b.status !== 'Approved') {
    throw httpError(409, b.status === 'Pending'
      ? 'The owner has not approved your request yet. No payment is needed until they do.'
      : `This booking is ${b.status.toLowerCase()} and cannot be paid.`);
  }
  const { rows: [c] } = await query('SELECT * FROM conversations WHERE item_id = $1 AND renter_id = $2 AND owner_id = $3', [b.item_id, b.renter_id, b.owner_id]);
  await openRequested(res, c, 'The owner will send you a payment request in the chat. You can pay as soon as it arrives.');
});

// ---------------------------------------------------------------- the payment page

// GET /api/payments/:tran — what the page shows.
router.get('/:tran', authRequired, async (req, res) => {
  const { rows: [p] } = await query('SELECT * FROM payments WHERE tran_id = $1 AND user_id = $2', [req.params.tran, req.user.id]);
  if (!p) throw httpError(404, 'Payment not found.');
  let about;
  if (p.purpose === 'sale') {
    const { rows: [d] } = await query(
      `SELECT d.conversation_id, p.body, p.attachments, u.name AS seller
         FROM sale_deals d JOIN posts p ON p.id = d.post_id JOIN users u ON u.id = d.seller_id WHERE d.id = $1`, [p.ref_id]);
    const img = (d?.attachments || []).find((a) => a.type === 'image') || (d?.attachments || []).find((a) => a.type === 'video');
    about = { title: (d?.body || 'Item for sale').slice(0, 90), to: d?.seller, image: img ? (img.type === 'video' ? img.poster : img.url) : null,
      done: `/messages/${d?.conversation_id}`, doneLabel: 'Open the chat with the seller' };
  } else {
    const { rows: [b] } = await query(
      `SELECT b.start_date, b.end_date, i.name, i.id AS item_id, u.name AS owner,
              (SELECT url FROM item_images WHERE item_id = i.id ORDER BY position LIMIT 1) AS image
         FROM bookings b JOIN items i ON i.id = b.item_id JOIN users u ON u.id = i.owner_id WHERE b.id = $1`, [p.ref_id]);
    about = { title: b?.name, to: b?.owner, image: b?.image, dates: b && [b.start_date, b.end_date],
      done: '/bookings', doneLabel: 'See my bookings' };
  }
  res.json({ ...p, about });
});

// POST /api/payments/:tran/complete  { method, account, outcome: 'paid' | 'failed' | 'cancelled' }
router.post('/:tran/complete', authRequired, async (req, res) => {
  const { rows: [p] } = await query('SELECT * FROM payments WHERE tran_id = $1 AND user_id = $2', [req.params.tran, req.user.id]);
  if (!p) throw httpError(404, 'Payment not found.');
  if (p.status !== 'pending') return res.json(p);
  // A request that is no longer due (cancelled booking, already paid) cannot be paid.
  if (p.purpose === 'booking') {
    const { rows: [b] } = await query('SELECT status, paid_at FROM bookings WHERE id = $1', [p.ref_id]);
    if (!b || b.paid_at || b.status !== 'Approved') {
      await query(`UPDATE payments SET status = 'cancelled' WHERE id = $1`, [p.id]);
      throw httpError(409, 'This booking can no longer be paid. Nothing was charged.');
    }
  }
  const outcome = ['paid', 'failed', 'cancelled'].includes(req.body.outcome) ? req.body.outcome : 'failed';
  if (outcome !== 'paid') {
    const { rows: [q] } = await query(`UPDATE payments SET status = $2 WHERE id = $1 RETURNING *`, [p.id, outcome]);
    return res.json(q);
  }
  const method = METHODS.includes(req.body.method) ? req.body.method : null;
  if (!method) throw httpError(400, 'Choose how to pay.');
  const digits = String(req.body.account || '').replace(/\D/g, '');
  if (method === 'card' ? digits.length < 12 : !/^01[3-9]\d{8}$/.test(digits)) {
    throw httpError(400, method === 'card' ? 'Enter a card number.' : 'Enter an 11-digit mobile number, like 01712345678.');
  }
  const account = method === 'card' ? `•••• ${digits.slice(-4)}` : `${digits.slice(0, 3)}•••••${digits.slice(-3)}`;

  if (p.purpose === 'sale') {
    const { rows: [d] } = await query('SELECT * FROM sale_deals WHERE id = $1', [p.ref_id]);
    const { rows: [post] } = await query('SELECT sale FROM posts WHERE id = $1', [d.post_id]);
    if (post?.sale?.sold && d.status !== 'accepted') {
      await query(`UPDATE payments SET status = 'failed' WHERE id = $1`, [p.id]);
      throw httpError(409, 'Someone bought it just before you. Nothing was charged.');
    }
    await query(`UPDATE sale_deals SET status = 'accepted', decided_at = COALESCE(decided_at, NOW()), paid_at = NOW() WHERE id = $1`, [d.id]);
    await query(`UPDATE posts SET sale = jsonb_set(sale, '{sold}', 'true') WHERE id = $1`, [d.post_id]);
    await systemLine(d.conversation_id, d.buyer_id,
      `Paid ${taka(d.price)} through RentalFlow Pay (demo). RentalFlow holds it until the buyer confirms the hand-over. Contact details are now visible to both of you.`);
    const { rows: [buyer] } = await query('SELECT name FROM users WHERE id = $1', [d.buyer_id]);
    await notify(d.seller_id, 'Sold — payment received', `${buyer?.name || 'A buyer'} paid ${taka(d.price)}. Arrange the hand-over in the chat.`, `/messages/${d.conversation_id}`);
    for (const who of [d.buyer_id, d.seller_id]) {
      await earn(who, EARN.sale_completed, 'sale_completed', { ref: `sale:${d.id}`, note: 'A sale agreed on RentalFlow' }).catch(() => {});
    }
  } else {
    const { rows: [b] } = await query(
      `UPDATE bookings SET paid_at = NOW() WHERE id = $1 AND paid_at IS NULL
       RETURNING id, item_id, (SELECT owner_id FROM items WHERE id = item_id) AS owner_id, (SELECT name FROM items WHERE id = item_id) AS item_name`, [p.ref_id]);
    if (b?.owner_id) {
      await notify(b.owner_id, 'Booking paid', `${b.item_name}: the renter paid ${taka(p.amount)} (deposit held by RentalFlow until it comes back).`, '/bookings');
      const { rows: [c] } = await query(
        `SELECT c.id FROM conversations c JOIN bookings bk ON bk.item_id = c.item_id AND bk.renter_id = c.renter_id WHERE bk.id = $1 LIMIT 1`, [b.id]);
      if (c) await systemLine(c.id, p.user_id, `Paid ${taka(p.amount)} through RentalFlow Pay (demo). The deposit is held until the item comes back safely.`);
    }
  }
  const { rows: [done] } = await query(
    `UPDATE payments SET status = 'paid', method = $2, account = $3, paid_at = NOW() WHERE id = $1 RETURNING *`, [p.id, method, account]);
  res.json(done);
});

export default router;

// A paid booking that is rejected or cancelled is refunded in full (demo).
export async function refundBooking(db, bookingId) {
  // A payment request that was never paid simply lapses.
  await db.query(`UPDATE payments SET status = 'cancelled' WHERE purpose = 'booking' AND ref_id = $1 AND status = 'pending'`, [bookingId]);
  const { rows: [p] } = await db.query(
    `UPDATE payments SET status = 'refunded' WHERE purpose = 'booking' AND ref_id = $1 AND status = 'paid' RETURNING user_id, amount`, [bookingId]);
  if (p) {
    await db.query(`INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, 'deal', $2, $3, '/bookings')`,
      [p.user_id, 'Refunded', `${taka(p.amount)} is on its way back to you — the booking did not go ahead.`]);
  }
}
