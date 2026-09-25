// ============================================================
//  RentalFlow  |  Marketplace  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: RentalFlow Pay — the DEMO payment gateway
// ============================================================
// Buy now and booking requests both end at a payment page. This is a demo:
// no real money moves and no payment brand is imitated. It shows the whole
// journey — what is paid, how, the receipt — and does what a real payment
// would do on RentalFlow:
//   • a sale: the deal is agreed at the paid price, the item is marked sold,
//     the chat unlocks and the seller is told they have been paid
//   • a booking: the request is marked paid (rent + fees + refundable
//     deposit, held until the rental ends); a rejected or cancelled paid
//     booking is refunded
import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { earn } from '../credits.js';
import { EARN, saleFee, rentalDays, rentalFees } from '../marketUtils.js';

const router = Router();
const httpError = (status, message) => Object.assign(new Error(message), { status });
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

// ---------------------------------------------------------------- start a checkout

// POST /api/payments/sale  { conversation_id } — Buy now, or pay for an accepted offer.
router.post('/sale', authRequired, async (req, res) => {
  const { rows: [c] } = await query('SELECT * FROM conversations WHERE id = $1 AND renter_id = $2', [Number(req.body.conversation_id), req.user.id]);
  if (!c?.post_id) throw httpError(404, 'Payments are made in a chat about something for sale.');
  const { rows: [post] } = await query(`SELECT sale, body FROM posts WHERE id = $1 AND status <> 'removed'`, [c.post_id]);
  if (!post?.sale) throw httpError(404, 'That listing no longer exists.');

  // An offer the seller already accepted is paid at its price; otherwise this
  // is Buy now at the asking price.
  let { rows: [deal] } = await query(
    `SELECT * FROM sale_deals WHERE conversation_id = $1 AND buyer_id = $2 AND status IN ('offered', 'accepted') ORDER BY id DESC LIMIT 1`,
    [c.id, req.user.id]);
  if (deal?.paid_at) throw httpError(409, 'This is already paid.');
  if (!deal || (deal.status === 'offered' && deal.price !== Math.round(Number(post.sale.price)))) {
    if (post.sale.sold) throw httpError(409, 'That item is no longer for sale.');
    const price = Math.round(Number(post.sale.price));
    if (deal) await query(`UPDATE sale_deals SET status = 'declined', decided_at = NOW() WHERE id = $1`, [deal.id]);
    ({ rows: [deal] } = await query(
      `INSERT INTO sale_deals (conversation_id, post_id, buyer_id, seller_id, price, platform_fee) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [c.id, c.post_id, req.user.id, c.owner_id, price, saleFee(price)]));
  } else if (deal.status === 'offered' && post.sale.sold) {
    throw httpError(409, 'That item is no longer for sale.');
  }
  const tran = newTran('SALE');
  await query(
    `INSERT INTO payments (tran_id, user_id, purpose, ref_id, amount, breakdown) VALUES ($1, $2, 'sale', $3, $4, $5)`,
    [tran, req.user.id, deal.id, deal.price, JSON.stringify([{ label: 'Item price', amount: deal.price }])]);
  res.status(201).json({ tran, pay: `/pay/${tran}` });
});

// POST /api/payments/booking  { booking_id, protection? } — pay for a booking request.
router.post('/booking', authRequired, async (req, res) => {
  const { rows: [b] } = await query(
    `SELECT b.*, i.rental_price, i.name AS item_name FROM bookings b JOIN items i ON i.id = b.item_id WHERE b.id = $1 AND b.renter_id = $2`,
    [Number(req.body.booking_id), req.user.id]);
  if (!b) throw httpError(404, 'Booking not found.');
  if (b.paid_at) throw httpError(409, 'This booking is already paid.');
  if (!['Pending', 'Approved'].includes(b.status)) throw httpError(409, `This booking is ${b.status.toLowerCase()} and cannot be paid.`);
  // The fees the booking recorded; if that row is not written yet, the same sums.
  const { rows: [saved] } = await query('SELECT * FROM booking_fees WHERE booking_id = $1', [b.id]);
  const f = saved
    ? { rentalTotal: saved.rental_total, renterFee: saved.renter_fee, protectionFee: saved.protection_fee }
    : rentalFees(b.rental_price, rentalDays(b.start_date, b.end_date), { protection: Boolean(req.body.protection) });
  const deposit = Math.round(Number(b.deposit_amount) || 0);
  const lines = [
    { label: `Rent (${rentalDays(b.start_date, b.end_date)} day${rentalDays(b.start_date, b.end_date) === 1 ? '' : 's'})`, amount: f.rentalTotal },
    { label: 'Service fee', amount: f.renterFee },
    ...(f.protectionFee ? [{ label: 'Damage protection', amount: f.protectionFee }] : []),
    ...(deposit ? [{ label: 'Refundable deposit', amount: deposit }] : []),
  ];
  const amount = lines.reduce((s, l) => s + l.amount, 0);
  const tran = newTran('BOOK');
  await query(
    `INSERT INTO payments (tran_id, user_id, purpose, ref_id, amount, breakdown) VALUES ($1, $2, 'booking', $3, $4, $5)`,
    [tran, req.user.id, b.id, amount, JSON.stringify(lines)]);
  res.status(201).json({ tran, pay: `/pay/${tran}` });
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
      await notify(b.owner_id, 'A booking request is paid', `${b.item_name}: the renter paid ${taka(p.amount)} (deposit held by RentalFlow). Approve or reject it in Bookings.`, '/bookings');
    }
  }
  const { rows: [done] } = await query(
    `UPDATE payments SET status = 'paid', method = $2, account = $3, paid_at = NOW() WHERE id = $1 RETURNING *`, [p.id, method, account]);
  res.json(done);
});

export default router;

// A paid booking that is rejected or cancelled is refunded in full (demo).
export async function refundBooking(db, bookingId) {
  const { rows: [p] } = await db.query(
    `UPDATE payments SET status = 'refunded' WHERE purpose = 'booking' AND ref_id = $1 AND status = 'paid' RETURNING user_id, amount`, [bookingId]);
  if (p) {
    await db.query(`INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, 'deal', $2, $3, '/bookings')`,
      [p.user_id, 'Refunded', `${taka(p.amount)} is on its way back to you — the booking did not go ahead.`]);
  }
}
