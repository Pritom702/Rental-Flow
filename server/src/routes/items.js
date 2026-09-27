// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M1 - Md. Safinuzzaman (Shafin)
//  GitHub: @shaafin01  |  Part: Item catalog API (CRUD, tags, status, accessories)
// ============================================================
// Item (listing) routes for the rental marketplace.
// Covers: item catalog CRUD, categorization + tagging, status tracking,
// and accessory tracking. Every item is owned by the member who listed it.
// Only the owner or an admin may modify a listing. All raw SQL.
import { Router } from 'express';
import { syncListingPost, removeListingPost } from '../listingPosts.js';
import { randomUUID } from 'crypto';
import { query, pool } from '../db.js';
import { NAME_MAX, DESCRIPTION_MAX } from '../socialUtils.js';
import jwt from 'jsonwebtoken';
import { authRequired } from '../middleware/auth.js';
import { replacementFor } from '../valuationModel.js';
import { submitForReview } from '../listingReview.js';
import { spend, earn } from '../credits.js';
import { listingFee } from '../marketUtils.js';
import { assertNotRepost, noteDeletion } from '../fairPlay.js';

const router = Router();

const VALID_STATUSES = ['Available', 'Rented', 'Damaged', 'Under Maintenance', 'Retired'];

// Who is looking (browsing is public, so the token is optional).
function viewer(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.slice(7), process.env.JWT_SECRET); } catch { return null; }
}
const isTeam = (v) => v && (v.role === 'admin' || v.role === 'staff');

// Fetch one item with owner, category, tags, accessories.
async function getItemFull(id) {
  const { rows } = await query(
    `SELECT i.*, c.name AS category_name, u.name AS owner_name
       FROM items i
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN users u ON u.id = i.owner_id
      WHERE i.id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const item = rows[0];

  const { rows: tagRows } = await query(
    `SELECT t.id, t.name FROM tags t
       JOIN item_tags it ON it.tag_id = t.id
      WHERE it.item_id = $1
      ORDER BY t.name`,
    [id]
  );
  const { rows: accRows } = await query(
    `SELECT id, name FROM accessories WHERE parent_item_id = $1 ORDER BY id`,
    [id]
  );
  const { rows: imgRows } = await query(
    `SELECT id, url FROM item_images WHERE item_id = $1 ORDER BY position, id`,
    [id]
  );
  item.tags = tagRows;
  item.accessories = accRows;
  item.images = imgRows;
  return item;
}

// Middleware: ensure the current user owns the item (or is an admin).
async function requireOwnerOrAdmin(req, res, next) {
  const { rows } = await query('SELECT owner_id FROM items WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
  if (req.user.role !== 'admin' && rows[0].owner_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only manage your own listings' });
  }
  next();
}

// GET /api/items  — list with filters. Public so anyone can browse the market.
// Extra filter `owner_id` lets the dashboard show "my listings".
router.get('/', async (req, res) => {
  const { search, category_id, status, tag, owner_id } = req.query;
  const clauses = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(i.name ILIKE $${params.length} OR i.description ILIKE $${params.length} OR i.serial_number ILIKE $${params.length})`);
  }
  if (category_id) {
    params.push(category_id);
    clauses.push(`i.category_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    clauses.push(`i.status = $${params.length}`);
  }
  if (owner_id) {
    params.push(owner_id);
    clauses.push(`i.owner_id = $${params.length}`);
  }
  if (tag) {
    params.push(tag);
    clauses.push(`i.id IN (SELECT it.item_id FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE t.name = $${params.length})`);
  }
  // Listings go live at once. Only one an admin sent back for changes is
  // hidden, from everyone but its owner and the team.
  const v = viewer(req);
  if (!isTeam(v)) {
    params.push(v?.id || 0);
    clauses.push(`(i.review_status <> 'rejected' OR i.owner_id = $${params.length})`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT i.id, i.owner_id, u.name AS owner_name, i.name, i.description,
            i.serial_number, i.rental_price, i.replacement_cost,
            i.status, i.category_id, c.name AS category_name, i.created_at,
            i.market_price, i.review_status, i.review_note,
            (u.verification_status = 'verified' AND u.nid_number IS NOT NULL AND u.phone_verified_at IS NOT NULL) AS owner_verified,
            (SELECT url FROM item_images WHERE item_id = i.id
              ORDER BY position, id LIMIT 1) AS cover_url,
            (SELECT COUNT(*)::int FROM item_images WHERE item_id = i.id) AS image_count,
            COALESCE(
              (SELECT string_agg(t.name, ', ' ORDER BY t.name)
                 FROM item_tags it JOIN tags t ON t.id = it.tag_id
                WHERE it.item_id = i.id), '') AS tags
       FROM items i
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN users u ON u.id = i.owner_id
       ${where}
       ORDER BY i.created_at DESC, i.id DESC`,
    params
  );
  res.json(rows);
});

// GET /api/items/:id/bookings  — booking history for a specific item
router.get('/:id/bookings', async (req, res) => {
  const { rows } = await query(
    `SELECT id, customer_name, customer_email, start_date, end_date, status, deposit_amount, late_fee_amount, notes
       FROM bookings
      WHERE item_id = $1
      ORDER BY start_date ASC, id DESC`,
    [req.params.id]
  );
  res.json(rows);
});

// GET /api/items/:id/qr  — QR token + scan path (F4). Image is rendered client-side.
router.get('/:id/qr', async (req, res) => {
  const { rows } = await query('SELECT id, name, qr_token FROM items WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
  res.json({ qr_token: rows[0].qr_token, scan_path: `/scan/${rows[0].qr_token}` });
});

// GET /api/items/:id  — full detail
router.get('/:id', async (req, res) => {
  const item = await getItemFull(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const v = viewer(req);
  if (item.review_status === 'rejected' && !isTeam(v) && v?.id !== item.owner_id) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json(item);
});

// POST /api/items  — any authenticated member (or admin) can list an item.
// The listing is owned by the current user.
// A product name up to 50 characters, a description up to 1000.
function lengthProblem(name, description) {
  if (name != null && String(name).trim().length > NAME_MAX) return `A product name can be up to ${NAME_MAX} characters.`;
  if (description != null && String(description).length > DESCRIPTION_MAX) return `A description can be up to ${DESCRIPTION_MAX} characters.`;
  return null;
}

// Everything on the listing form is required except tags and accessories.
// The owner gives the market price; the replacement cost is 60% of it, set by
// an admin when the listing is checked (listingReview.js).
function missingField({ description, rental_price, market_price, category_id, images }) {
  if (!description || !String(description).trim()) return 'Add a description.';
  if (!category_id) return 'Choose a category.';
  if (!(Number(rental_price) > 0)) return 'Set a rental price per day.';
  if (!(Number(market_price) > 0)) return 'Set the market price (what it would cost to buy it now).';
  if (!Array.isArray(images) || !images.length) return 'Add at least one photo.';
  return null;
}

// How many listings a member has (retired ones do not count) and what the
// next one costs in Limes.
async function nextListingFee(user) {
  if (user.role !== 'member') return { count: 0, fee: 0 };
  const { rows: [r] } = await query(`SELECT COUNT(*)::int AS n FROM items WHERE owner_id = $1 AND status <> 'Retired'`, [user.id]);
  return { count: r.n, fee: listingFee(r.n + 1) };
}

// GET /api/items/me/listing-fee — shown on the listing form before saving.
router.get('/me/listing-fee', authRequired, async (req, res) => {
  const { rows: [w] } = await query('SELECT balance FROM credit_wallets WHERE user_id = $1', [req.user.id]);
  res.json({ ...(await nextListingFee(req.user)), balance: w?.balance ?? 0 });
});

router.post('/', authRequired, async (req, res) => {
  const {
    name, description, serial_number, rental_price, market_price,
    status, category_id, tags = [], accessories = [], images = [],
  } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });
  const missing = missingField(req.body);
  if (missing) return res.status(400).json({ error: missing });
  const tooLong = lengthProblem(name, description);
  if (tooLong) return res.status(400).json({ error: tooLong });
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  // Deleting a listing and putting it up again to reach the top of the feed
  // earns a one-hour break.
  if (req.user.role === 'member') {
    try { await assertNotRepost(req.user.id, name); } catch (e) {
      return res.status(e.status || 429).json({ error: e.message, reason: e.reason, minutes: e.minutes });
    }
  }
  // The first listing is free; the 2nd costs 10 Limes, the 3rd 15, the 4th 20...
  const { fee } = await nextListingFee(req.user);
  if (fee) {
    try { await spend(req.user.id, fee, 'listing_fee', { note: `Listing fee: ${String(name).slice(0, 60)}` }); } catch (e) {
      return res.status(e.status || 402).json({ error: e.status === 402 ? `This listing costs ${fee} Limes and you have ${e.balance ?? 0}. Earn more, or top up.` : e.message, reason: e.reason, fee, balance: e.balance });
    }
  }

  const client = await pool.connect();
  let itemId;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO items (owner_id, name, description, serial_number, rental_price,
                          replacement_cost, status, category_id, qr_token,
                          market_price, review_status, listing_fee)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'Available'),$8,$9,$10,$11,$12)
       RETURNING id`,
      [req.user.id, name, description || null, serial_number || null,
       rental_price || 0, replacementFor(market_price),
       status || null, category_id || null, randomUUID(),
       // A member's listing is live at once; its replacement cost waits for an admin.
       Number(market_price), req.user.role === 'member' ? 'pending' : 'approved', fee]
    );
    itemId = rows[0].id;

    await attachTags(client, itemId, tags);
    await attachAccessories(client, itemId, accessories);
    await attachImages(client, itemId, images);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    if (fee) await earn(req.user.id, fee, 'refund', { note: 'Listing fee refund' }).catch(() => {});
    if (err.code === '23505') return res.status(409).json({ error: 'Serial number already exists' });
    // Owner no longer exists (e.g. token issued before a DB reset) -> force re-login.
    if (err.constraint === 'items_owner_id_fkey') {
      return res.status(401).json({ error: 'Your session is no longer valid. Please log in again.' });
    }
    return res.status(500).json({ error: err.message });
  }
  // Give the connection back BEFORE reading the saved item: getItemFull() needs
  // a connection of its own, and on a small pool (Vercel) holding this one
  // while asking for another waited until timeout and answered 500 — after the
  // item had already been saved, so every retry created a duplicate listing.
  client.release();
  // Live straight away (and in the feed); an admin then sets the replacement cost.
  await syncListingPost(itemId);
  const review = req.user.role === 'member' ? await submitForReview(itemId) : null;
  res.status(201).json({ ...(await getItemFull(itemId)), limes_charged: fee, pending_review: Boolean(review) });
});

// PUT /api/items/:id  — owner or admin. Full update incl. tags + accessories.
router.put('/:id', authRequired, requireOwnerOrAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    name, description, serial_number, rental_price, market_price,
    status, category_id, tags, accessories, images,
  } = req.body;
  // Only an admin sets the replacement cost (60% of the market price they approve).
  const replacement_cost = req.user.role === 'admin' && req.body.replacement_cost != null ? req.body.replacement_cost : null;
  const { rows: [before] } = await query('SELECT review_status FROM items WHERE id = $1', [id]);

  const tooLong = lengthProblem(name, description);
  if (tooLong) return res.status(400).json({ error: tooLong });
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE items SET
         name = COALESCE($2, name),
         description = $3,
         serial_number = COALESCE($4, serial_number),
         rental_price = COALESCE($5, rental_price),
         replacement_cost = COALESCE($6, replacement_cost),
         status = COALESCE($7, status),
         category_id = $8,
         market_price = COALESCE($9, market_price),
         -- a listing sent back for changes goes to the admins again
         review_status = CASE WHEN review_status = 'rejected' THEN 'pending' ELSE review_status END
       WHERE id = $1`,
      [id, name, description ?? null, serial_number ?? null,
       rental_price, replacement_cost,
       status, category_id ?? null, Number(market_price) > 0 ? Number(market_price) : null]
    );

    if (Array.isArray(tags)) {
      await client.query('DELETE FROM item_tags WHERE item_id = $1', [id]);
      await attachTags(client, id, tags);
    }
    if (Array.isArray(accessories)) {
      await client.query('DELETE FROM accessories WHERE parent_item_id = $1', [id]);
      await attachAccessories(client, id, accessories);
    }
    if (Array.isArray(images)) {
      await client.query('DELETE FROM item_images WHERE item_id = $1', [id]);
      await attachImages(client, id, images);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    if (err.code === '23505') return res.status(409).json({ error: 'Serial number already exists' });
    return res.status(500).json({ error: err.message });
  }
  client.release();   // before getItemFull() — see POST above
  const saved = await getItemFull(id);
  await syncListingPost(id);
  if (before?.review_status === 'rejected') await submitForReview(id);   // fixed: back to the admins
  res.json(saved);
});

// PATCH /api/items/:id/status  — owner or admin (Feature 3).
router.patch('/:id/status', authRequired, requireOwnerOrAdmin, async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  const { rows } = await query(
    'UPDATE items SET status = $2 WHERE id = $1 RETURNING id, name, status',
    [req.params.id, status]
  );
  await syncListingPost(req.params.id);   // a retired listing leaves the feed
  res.json(rows[0]);
});

// DELETE /api/items/:id  — owner or admin.
router.delete('/:id', authRequired, requireOwnerOrAdmin, async (req, res) => {
  const { rows: [it] } = await query('SELECT owner_id, name FROM items WHERE id = $1', [req.params.id]);
  if (it && it.owner_id === req.user.id) await noteDeletion(it.owner_id, 'item', it.name);
  await removeListingPost(req.params.id);
  await query('DELETE FROM items WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

// --- helpers (find-or-create tags, insert accessories) ---
async function attachTags(client, itemId, tags) {
  for (const raw of tags) {
    const name = String(raw).trim().toLowerCase();
    if (!name) continue;
    const { rows } = await client.query(
      `INSERT INTO tags (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [name]
    );
    await client.query(
      'INSERT INTO item_tags (item_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [itemId, rows[0].id]
    );
  }
}

async function attachAccessories(client, itemId, accessories) {
  for (const raw of accessories) {
    const name = String(raw).trim();
    if (!name) continue;
    await client.query(
      'INSERT INTO accessories (parent_item_id, name) VALUES ($1, $2)',
      [itemId, name]
    );
  }
}

// images: array of URL strings (already uploaded via POST /api/uploads).
async function attachImages(client, itemId, images) {
  let position = 0;
  for (const raw of images) {
    const url = String(raw).trim();
    if (!url) continue;
    await client.query(
      'INSERT INTO item_images (item_id, url, position) VALUES ($1, $2, $3)',
      [itemId, url, position++]
    );
  }
}

export default router;
