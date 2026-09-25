// ============================================================
//  RentalFlow  |  Business  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Limes, payments, boosts, deals, ads, revenue
// ============================================================
//   GET  /api/market/limes                 my wallet, history, packs, prices, invite link
//   POST /api/market/orders                { pack } → buy Limes (payment gateway, or test checkout)
//   GET  /api/market/orders/:tran          one of my orders
//   POST /api/market/orders/:tran/test-pay { outcome } → the test checkout's answer
//   POST /api/market/sslcz/:result         the payment gateway's callback (success | fail | cancel | ipn)
//   POST /api/market/boost                 { kind: 'post' | 'item', id } → 24 hours at the top
//   GET  /api/market/featured              listings featured on Browse right now
//   POST /api/market/referral              { code } → who invited me
//   POST /api/market/deals                 { conversation_id, price } → an offer on something for sale
//   POST /api/market/deals/:id/:decision   accept | decline (the seller)
//   POST /api/market/report-offplatform    { conversation_id } → "they asked me to pay outside"
//   POST /api/market/ads                   { post_id, budget, headline } → promote a post
//   GET  /api/market/ads                   my campaigns
//   POST /api/market/ads/:id/:action       pause | resume | stop (stop refunds what is left)
//   POST /api/market/ads/:id/event         { kind: 'view' | 'click', viewer } → counted once a day
//   GET  /api/market/admin/revenue         the business at a glance (admins)
//
// Payments: with SSLCZ_STORE_ID + SSLCZ_STORE_PASSWORD set, Limes are bought
// through SSLCommerz (bKash, Nagad, cards) — sandbox unless SSLCZ_LIVE=1.
// Without them a clearly-marked TEST checkout stands in, so the whole flow can
// be shown without real money.
import { Router, urlencoded } from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { earn, spend, wallet, changeCredits } from '../credits.js';
import { PACKS, PRICES, EARN, saleFee, adSpent, BDT_PER_LIME } from '../marketUtils.js';

const router = Router();
const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });

const SSLCZ = {
  id: process.env.SSLCZ_STORE_ID,
  pass: process.env.SSLCZ_STORE_PASSWORD,
  base: process.env.SSLCZ_LIVE === '1' ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com',
};
const gatewayOn = () => Boolean(SSLCZ.id && SSLCZ.pass);
const publicUrl = (req) => process.env.PUBLIC_URL || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;

async function notify(userId, type, title, body, link) {
  await query('INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, $2, $3, $4, $5)', [userId, type, title, body, link]);
}

// ---------------------------------------------------------------- wallet
router.get('/limes', authRequired, async (req, res) => {
  const w = await wallet(req.user.id);
  const { rows: history } = await query(
    'SELECT delta, reason, note, created_at FROM credit_ledger WHERE user_id = $1 ORDER BY id DESC LIMIT 30', [req.user.id]);
  const { rows: boosts } = await query(
    `SELECT b.kind, b.target_id, b.ends_at,
            CASE WHEN b.kind = 'post' THEN (SELECT LEFT(body, 60) FROM posts WHERE id = b.target_id)
                 ELSE (SELECT name FROM items WHERE id = b.target_id) END AS title
       FROM boosts b WHERE b.user_id = $1 AND b.ends_at > NOW() ORDER BY b.ends_at`, [req.user.id]);
  res.json({
    balance: w.balance, earned: w.earned, bought: w.bought, spent: w.spent,
    referralCode: w.referral_code, packs: PACKS, prices: PRICES, earn: EARN,
    gateway: gatewayOn() ? 'sslcommerz' : 'test', history, boosts,
  });
});

// ---------------------------------------------------------------- buying Limes
router.post('/orders', authRequired, async (req, res) => {
  const pack = PACKS[req.body.pack];
  if (!pack) throw httpError(400, 'Pick a pack.');
  const tran = `LIM-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const provider = gatewayOn() ? 'sslcommerz' : 'test';
  await query(
    `INSERT INTO credit_orders (user_id, pack, credits, amount_bdt, provider, tran_id) VALUES ($1, $2, $3, $4, $5, $6)`,
    [req.user.id, req.body.pack, pack.credits, pack.bdt, provider, tran]);

  if (provider === 'test') return res.status(201).json({ tran, checkout: `/checkout/${tran}` });

  // SSLCommerz: open a payment session and send the member to its page.
  const { rows: [u] } = await query('SELECT name, email, phone FROM users WHERE id = $1', [req.user.id]);
  const base = publicUrl(req);
  const form = new URLSearchParams({
    store_id: SSLCZ.id, store_passwd: SSLCZ.pass, total_amount: String(pack.bdt), currency: 'BDT', tran_id: tran,
    success_url: `${base}/api/market/sslcz/success`, fail_url: `${base}/api/market/sslcz/fail`,
    cancel_url: `${base}/api/market/sslcz/cancel`, ipn_url: `${base}/api/market/sslcz/ipn`,
    cus_name: u.name, cus_email: u.email, cus_phone: u.phone || '01700000000', cus_add1: 'Dhaka', cus_city: 'Dhaka', cus_country: 'Bangladesh',
    shipping_method: 'NO', product_name: `${pack.credits} Limes`, product_category: 'Credits', product_profile: 'non-physical-goods',
  });
  const r = await fetch(`${SSLCZ.base}/gwprocess/v4/api.php`, { method: 'POST', body: form, signal: AbortSignal.timeout(15000) });
  const data = await r.json().catch(() => ({}));
  if (data.status !== 'SUCCESS' || !data.GatewayPageURL) {
    await query(`UPDATE credit_orders SET status = 'failed' WHERE tran_id = $1`, [tran]);
    throw httpError(502, 'The payment page could not be opened. Try again in a moment.');
  }
  res.status(201).json({ tran, redirect: data.GatewayPageURL });
});

router.get('/orders/:tran', authRequired, async (req, res) => {
  const { rows: [o] } = await query('SELECT * FROM credit_orders WHERE tran_id = $1 AND user_id = $2', [req.params.tran, req.user.id]);
  if (!o) throw httpError(404, 'Order not found.');
  res.json(o);
});

async function markPaid(tran) {
  const { rows: [o] } = await query(
    `UPDATE credit_orders SET status = 'paid', paid_at = NOW() WHERE tran_id = $1 AND status = 'pending' RETURNING *`, [tran]);
  if (!o) return null;
  await changeCredits(o.user_id, o.credits, 'purchase', { ref: `order:${o.tran_id}`, note: `${PACKS[o.pack]?.label || ''} pack`, kind: 'bought' });
  await notify(o.user_id, 'credits', `${o.credits} Limes added`, `Thanks for your purchase (৳${o.amount_bdt}).`, '/limes');
  return o;
}

// The test checkout (only while no real gateway is configured).
router.post('/orders/:tran/test-pay', authRequired, async (req, res) => {
  const { rows: [o] } = await query('SELECT * FROM credit_orders WHERE tran_id = $1 AND user_id = $2', [req.params.tran, req.user.id]);
  if (!o || o.provider !== 'test') throw httpError(404, 'Order not found.');
  if (o.status !== 'pending') return res.json(o);
  if (req.body.outcome === 'paid') {
    await markPaid(o.tran_id);
    return res.json({ ...o, status: 'paid' });
  }
  await query(`UPDATE credit_orders SET status = 'cancelled' WHERE tran_id = $1`, [o.tran_id]);
  res.json({ ...o, status: 'cancelled' });
});

// SSLCommerz posts the result back as a form. A payment only counts after the
// gateway's own validation service confirms it.
router.post('/sslcz/:result', urlencoded({ extended: false }), async (req, res) => {
  const { tran_id: tran, val_id: valId } = req.body || {};
  const back = (q) => res.redirect(303, `/limes?${q}`);
  if (!tran) return back('paid=0');
  if (req.params.result === 'success' || req.params.result === 'ipn') {
    if (!gatewayOn() || !valId) return back('paid=0');
    const url = `${SSLCZ.base}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(valId)}&store_id=${encodeURIComponent(SSLCZ.id)}&store_passwd=${encodeURIComponent(SSLCZ.pass)}&format=json`;
    const v = await fetch(url, { signal: AbortSignal.timeout(15000) }).then((r) => r.json()).catch(() => ({}));
    const { rows: [o] } = await query('SELECT * FROM credit_orders WHERE tran_id = $1', [tran]);
    const ok = ['VALID', 'VALIDATED'].includes(v.status) && v.tran_id === tran && o && Number(v.amount) >= o.amount_bdt;
    if (ok) await markPaid(tran);
    if (req.params.result === 'ipn') return res.json({ ok });
    return back(ok ? 'paid=1' : 'paid=0');
  }
  await query(`UPDATE credit_orders SET status = $2 WHERE tran_id = $1 AND status = 'pending'`,
    [tran, req.params.result === 'cancel' ? 'cancelled' : 'failed']);
  return back('paid=0');
});

// ---------------------------------------------------------------- spending
router.post('/boost', authRequired, async (req, res) => {
  const kind = req.body.kind === 'item' ? 'item' : 'post';
  const id = Number(req.body.id);
  const { rows: [t] } = kind === 'item'
    ? await query('SELECT owner_id AS owner FROM items WHERE id = $1', [id])
    : await query(`SELECT author_id AS owner, kind FROM posts WHERE id = $1 AND status = 'visible'`, [id]);
  if (!t) throw httpError(404, 'Not found.');
  if (t.owner !== req.user.id) throw httpError(403, 'You can only boost your own posts and listings.');
  const price = kind === 'item' ? PRICES.boost_item : t.kind === 'wanted' ? PRICES.boost_wanted : PRICES.boost_post;
  const { rows: [live] } = await query('SELECT ends_at FROM boosts WHERE kind = $1 AND target_id = $2 AND ends_at > NOW() ORDER BY ends_at DESC LIMIT 1', [kind, id]);
  const from = live ? new Date(live.ends_at) : new Date();
  const until = new Date(from.getTime() + 24 * 3600 * 1000);
  const balance = await spend(req.user.id, price, 'boost', { note: kind === 'item' ? 'Featured listing, 24 h' : 'Boosted post, 24 h' });
  await query('INSERT INTO boosts (user_id, kind, target_id, credits, starts_at, ends_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [req.user.id, kind, id, price, from, until]);
  res.status(201).json({ balance, until, price });
});

router.get('/featured', async (_req, res) => {
  const { rows } = await query(
    `SELECT DISTINCT ON (i.id) i.id, i.name, i.rental_price, i.status, c.name AS category_name, u.name AS owner_name,
            (SELECT url FROM item_images WHERE item_id = i.id ORDER BY position, id LIMIT 1) AS cover_url, b.ends_at
       FROM boosts b JOIN items i ON i.id = b.target_id LEFT JOIN categories c ON c.id = i.category_id LEFT JOIN users u ON u.id = i.owner_id
      WHERE b.kind = 'item' AND b.ends_at > NOW() AND i.status = 'Available'
      ORDER BY i.id, b.ends_at DESC LIMIT 12`);
  res.json(rows);
});

// ---------------------------------------------------------------- invites
router.post('/referral', authRequired, async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const { rows: [inviter] } = await query('SELECT user_id FROM credit_wallets WHERE referral_code = $1', [code]);
  if (!inviter || inviter.user_id === req.user.id) return res.json({ ok: false });
  const me = await wallet(req.user.id);
  const { rows: [u] } = await query(
    `SELECT (created_at > NOW() - INTERVAL '14 days') AS fresh, email_verified_at FROM users WHERE id = $1`, [req.user.id]);
  if (me.referred_by || !u.fresh) return res.json({ ok: false });
  await query('UPDATE credit_wallets SET referred_by = $2 WHERE user_id = $1 AND referred_by IS NULL', [req.user.id, inviter.user_id]);
  await earn(req.user.id, EARN.referral_welcome, 'referral_welcome', { ref: 'welcome', note: 'Welcome bonus for joining with an invite' });
  await earn(inviter.user_id, EARN.referral, 'referral', { ref: `invite:${req.user.id}`, note: 'Someone joined with your invite' });
  await notify(inviter.user_id, 'credits', `+${EARN.referral} Limes — your invite worked`, 'Someone joined RentalFlow with your link.', '/limes');
  res.json({ ok: true, bonus: EARN.referral_welcome });
});

// ---------------------------------------------------------------- deals on things for sale
async function convoFor(userId, id) {
  const { rows: [c] } = await query('SELECT * FROM conversations WHERE id = $1 AND (renter_id = $2 OR owner_id = $2)', [id, userId]);
  return c;
}
async function systemLine(convoId, senderId, text) {
  await query(`INSERT INTO messages (conversation_id, sender_id, body, kind) VALUES ($1, $2, $3, 'system')`, [convoId, senderId, text]);
  await query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [convoId]);
}

router.post('/deals', authRequired, async (req, res) => {
  const c = await convoFor(req.user.id, Number(req.body.conversation_id));
  if (!c?.post_id) throw httpError(404, 'Offers are made in a chat about something for sale.');
  if (c.renter_id !== req.user.id) throw httpError(403, 'Only the buyer makes an offer.');
  const price = Math.round(Number(req.body.price));
  if (!(price > 0)) throw httpError(400, 'Enter your offer.');
  const { rows: [open] } = await query(`SELECT id FROM sale_deals WHERE conversation_id = $1 AND status IN ('offered', 'accepted')`, [c.id]);
  if (open) throw httpError(409, 'There is already an offer in this chat.');
  const { rows: [d] } = await query(
    `INSERT INTO sale_deals (conversation_id, post_id, buyer_id, seller_id, price, platform_fee) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [c.id, c.post_id, req.user.id, c.owner_id, price, saleFee(price)]);
  await systemLine(c.id, req.user.id, `Offer: ৳${price.toLocaleString('en-IN')}`);
  await notify(c.owner_id, 'deal', 'You have an offer', `৳${price.toLocaleString('en-IN')} for your item.`, `/messages/${c.id}`);
  res.status(201).json(d);
});

router.post('/deals/:id/:decision', authRequired, async (req, res) => {
  const decision = req.params.decision === 'accept' ? 'accepted' : req.params.decision === 'decline' ? 'declined' : null;
  if (!decision) throw httpError(400, 'Accept or decline.');
  const { rows: [d] } = await query(
    `UPDATE sale_deals SET status = $3, decided_at = NOW() WHERE id = $1 AND seller_id = $2 AND status = 'offered' RETURNING *`,
    [req.params.id, req.user.id, decision]);
  if (!d) throw httpError(404, 'That offer is no longer open.');
  if (decision === 'accepted') {
    if (d.post_id) await query(`UPDATE posts SET sale = jsonb_set(sale, '{sold}', 'true') WHERE id = $1`, [d.post_id]);
    await systemLine(d.conversation_id, req.user.id, 'Offer accepted — the deal is on RentalFlow, so contact details are now visible to both of you.');
    for (const who of [d.buyer_id, d.seller_id]) {
      await earn(who, EARN.sale_completed, 'sale_completed', { ref: `sale:${d.id}`, note: 'A sale agreed on RentalFlow' }).catch(() => {});
    }
    await notify(d.buyer_id, 'deal', 'Your offer was accepted', `৳${d.price.toLocaleString('en-IN')} — arrange the hand-over in the chat.`, `/messages/${d.conversation_id}`);
  } else {
    await systemLine(d.conversation_id, req.user.id, 'Offer declined.');
    await notify(d.buyer_id, 'deal', 'Your offer was declined', 'You can make another one.', `/messages/${d.conversation_id}`);
  }
  res.json(d);
});

// ---------------------------------------------------------------- "they asked me to pay outside"
router.post('/report-offplatform', authRequired, async (req, res) => {
  const c = await convoFor(req.user.id, Number(req.body.conversation_id));
  if (!c) throw httpError(404, 'Conversation not found.');
  const other = c.owner_id === req.user.id ? c.renter_id : c.owner_id;
  const paid = await earn(req.user.id, EARN.report_offplatform, 'report', { ref: `report:${c.id}`, note: 'Reported a request to pay outside' }).catch(() => null);
  if (paid == null) return res.json({ ok: true, already: true });
  await query('UPDATE users SET offplatform_flags = offplatform_flags + 3 WHERE id = $1', [other]);
  const { rows: admins } = await query(`SELECT id FROM users WHERE role = 'admin' AND status = 'active'`);
  for (const a of admins) await notify(a.id, 'social_moderation', 'Someone was asked to pay outside RentalFlow', `Conversation #${c.id}`, `/admin/revenue`);
  res.json({ ok: true, limes: EARN.report_offplatform });
});

// ---------------------------------------------------------------- ads
router.post('/ads', authRequired, async (req, res) => {
  const budget = Math.round(Number(req.body.budget));
  if (!(budget >= 20)) throw httpError(400, 'The smallest budget is 20 Limes (about 200 views).');
  const { rows: [p] } = await query(`SELECT id, author_id FROM posts WHERE id = $1 AND status = 'visible'`, [req.body.post_id]);
  if (!p) throw httpError(404, 'That post is not available.');
  if (p.author_id !== req.user.id) throw httpError(403, 'You can only promote your own posts.');
  const balance = await spend(req.user.id, budget, 'ad_budget', { note: 'Ad budget' });
  const headline = req.body.headline ? String(req.body.headline).slice(0, 80) : null;
  const { rows: [a] } = await query(
    'INSERT INTO ad_campaigns (user_id, post_id, budget, headline) VALUES ($1, $2, $3, $4) RETURNING *', [req.user.id, p.id, budget, headline]);
  res.status(201).json({ ...a, balance });
});

router.get('/ads', authRequired, async (req, res) => {
  const { rows } = await query(
    `SELECT a.*, LEFT(p.body, 80) AS post_body,
            (SELECT COALESCE(a2->>'poster', a2->>'url') FROM jsonb_array_elements(p.attachments) a2 LIMIT 1) AS cover
       FROM ad_campaigns a JOIN posts p ON p.id = a.post_id WHERE a.user_id = $1 ORDER BY a.id DESC`, [req.user.id]);
  res.json(rows);
});

router.post('/ads/:id/event', async (req, res) => {
  const kind = req.body.kind === 'click' ? 'click' : 'view';
  const viewer = String(req.body.viewer || '').slice(0, 40);
  if (!viewer) return res.json({ ok: false });
  const ins = await query(
    'INSERT INTO ad_events (campaign_id, viewer, kind) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [req.params.id, viewer, kind]);
  if (!ins.rowCount) return res.json({ ok: true, counted: false });
  const col = kind === 'click' ? 'clicks' : 'impressions';
  const { rows: [a] } = await query(
    `UPDATE ad_campaigns SET ${col} = ${col} + 1 WHERE id = $1 AND status = 'active' RETURNING *`, [req.params.id]);
  if (a && kind === 'view') {
    const spent = Math.min(a.budget, adSpent(a.impressions));
    const finished = spent >= a.budget;
    await query(`UPDATE ad_campaigns SET spent = $2, status = CASE WHEN $3 THEN 'finished' ELSE status END WHERE id = $1`, [a.id, spent, finished]);
    if (finished) await notify(a.user_id, 'ad', 'Your ad has finished', `${a.impressions} views and ${a.clicks} clicks.`, '/limes');
  }
  res.json({ ok: true, counted: true });
});

router.post('/ads/:id/:action', authRequired, async (req, res) => {
  const { rows: [a] } = await query('SELECT * FROM ad_campaigns WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!a) throw httpError(404, 'Campaign not found.');
  if (req.params.action === 'stop') {
    if (a.status === 'finished') return res.json(a);
    const left = a.budget - a.spent;
    await query(`UPDATE ad_campaigns SET status = 'finished', budget = spent WHERE id = $1`, [a.id]);
    if (left > 0) await changeCredits(req.user.id, left, 'ad_refund', { ref: `adrefund:${a.id}`, note: 'Unused ad budget returned', kind: 'earned' });
    return res.json({ ...a, status: 'finished', refunded: left });
  }
  const status = req.params.action === 'pause' ? 'paused' : req.params.action === 'resume' ? 'active' : null;
  if (!status || a.status === 'finished') throw httpError(400, 'That cannot be done to this campaign.');
  const { rows: [n] } = await query('UPDATE ad_campaigns SET status = $2 WHERE id = $1 RETURNING *', [a.id, status]);
  res.json(n);
});

// ---------------------------------------------------------------- revenue (admins)
router.get('/admin/revenue', authRequired, requireRole('admin'), async (_req, res) => {
  const one = async (sql, params = []) => (await query(sql, params)).rows[0];
  const bookingDone = await one(
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(f.rental_total), 0)::int AS gmv,
            COALESCE(SUM(f.renter_fee + f.owner_fee), 0)::int AS fees, COALESCE(SUM(f.protection_fee), 0)::int AS protection
       FROM booking_fees f JOIN bookings b ON b.id = f.booking_id WHERE b.status = 'Completed'`);
  const bookingPipe = await one(
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(f.renter_fee + f.owner_fee + f.protection_fee), 0)::int AS fees
       FROM booking_fees f JOIN bookings b ON b.id = f.booking_id WHERE b.status IN ('Pending', 'Approved')`);
  const sales = await one(`SELECT COUNT(*)::int AS n, COALESCE(SUM(price), 0)::int AS gmv, COALESCE(SUM(platform_fee), 0)::int AS fees FROM sale_deals WHERE status IN ('accepted', 'completed')`);
  const limes = await one(`SELECT COUNT(*)::int AS orders, COALESCE(SUM(amount_bdt), 0)::int AS bdt, COALESCE(SUM(credits), 0)::int AS credits FROM credit_orders WHERE status = 'paid'`);
  const ads = await one(`SELECT COUNT(*)::int AS campaigns, COALESCE(SUM(spent), 0)::int AS spent, COALESCE(SUM(impressions), 0)::int AS views, COALESCE(SUM(clicks), 0)::int AS clicks FROM ad_campaigns`);
  const boosts = await one(`SELECT COUNT(*)::int AS n, COALESCE(SUM(credits), 0)::int AS credits FROM boosts`);
  const leak = await one(`SELECT COUNT(*) FILTER (WHERE offplatform_flags > 0)::int AS members, COALESCE(SUM(offplatform_flags), 0)::int AS flags FROM users`);
  const { rows: daily } = await query(
    `WITH days AS (SELECT generate_series(CURRENT_DATE - 29, CURRENT_DATE, INTERVAL '1 day')::date AS d)
     SELECT d AS day,
       COALESCE((SELECT SUM(f.renter_fee + f.owner_fee + f.protection_fee) FROM booking_fees f WHERE f.created_at::date = d), 0)::int AS rentals,
       COALESCE((SELECT SUM(amount_bdt) FROM credit_orders WHERE status = 'paid' AND paid_at::date = d), 0)::int AS limes,
       COALESCE((SELECT SUM(platform_fee) FROM sale_deals WHERE status IN ('accepted', 'completed') AND decided_at::date = d), 0)::int AS sales
     FROM days ORDER BY d`);
  const { rows: flagged } = await query(
    `SELECT id, name, email, offplatform_flags FROM users WHERE offplatform_flags > 0 ORDER BY offplatform_flags DESC LIMIT 10`);
  res.json({
    bookings: { completed: bookingDone, pipeline: bookingPipe }, sales, limes, ads, boosts, leak, daily, flagged,
    bdtPerLime: BDT_PER_LIME,
    totals: {
      earned: bookingDone.fees + bookingDone.protection + sales.fees + limes.bdt,
      pipeline: bookingPipe.fees,
    },
  });
});

export default router;
