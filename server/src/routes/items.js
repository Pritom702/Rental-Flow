// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M1 - Md. Safinuzzaman (Shafin)
//  GitHub: @shaafin01  |  Part: Item catalog API (CRUD, tags, status, accessories)
// ============================================================
// Item (listing) routes for the rental marketplace.
// Covers: item catalog CRUD, categorization + tagging, status tracking,
// and accessory tracking. Every item is owned by the member who listed it.
// Only the owner or an admin may modify a listing. All raw SQL.
import { Router } from 'express';
import { query, pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

const VALID_STATUSES = ['Available', 'Rented', 'Damaged', 'Under Maintenance', 'Retired'];

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

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT i.id, i.owner_id, u.name AS owner_name, i.name, i.description,
            i.serial_number, i.rental_price, i.replacement_cost,
            i.status, i.category_id, c.name AS category_name,
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

// GET /api/items/:id  — full detail
router.get('/:id', async (req, res) => {
  const item = await getItemFull(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

// POST /api/items  — any authenticated member (or admin) can list an item.
// The listing is owned by the current user.
router.post('/', authRequired, async (req, res) => {
  const {
    name, description, serial_number, rental_price, replacement_cost,
    status, category_id, tags = [], accessories = [], images = [],
  } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO items (owner_id, name, description, serial_number, rental_price,
                          replacement_cost, status, category_id)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'Available'),$8)
       RETURNING id`,
      [req.user.id, name, description || null, serial_number || null,
       rental_price || 0, replacement_cost || 0,
       status || null, category_id || null]
    );
    const itemId = rows[0].id;

    await attachTags(client, itemId, tags);
    await attachAccessories(client, itemId, accessories);
    await attachImages(client, itemId, images);

    await client.query('COMMIT');
    res.status(201).json(await getItemFull(itemId));
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Serial number already exists' });
    // Owner no longer exists (e.g. token issued before a DB reset) -> force re-login.
    if (err.constraint === 'items_owner_id_fkey') {
      return res.status(401).json({ error: 'Your session is no longer valid. Please log in again.' });
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/items/:id  — owner or admin. Full update incl. tags + accessories.
router.put('/:id', authRequired, requireOwnerOrAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    name, description, serial_number, rental_price, replacement_cost,
    status, category_id, tags, accessories, images,
  } = req.body;

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
         serial_number = $4,
         rental_price = COALESCE($5, rental_price),
         replacement_cost = COALESCE($6, replacement_cost),
         status = COALESCE($7, status),
         category_id = $8
       WHERE id = $1`,
      [id, name, description ?? null, serial_number ?? null,
       rental_price, replacement_cost,
       status, category_id ?? null]
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
    res.json(await getItemFull(id));
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Serial number already exists' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
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
  res.json(rows[0]);
});

// DELETE /api/items/:id  — owner or admin.
router.delete('/:id', authRequired, requireOwnerOrAdmin, async (req, res) => {
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
