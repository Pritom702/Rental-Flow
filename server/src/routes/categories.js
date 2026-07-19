// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Categories API
// ============================================================
// Category + tag routes (Feature 2). Raw SQL.
import { Router } from 'express';
import { query } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/categories  — list with item counts (public).
router.get('/', async (_req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.name, COUNT(i.id)::int AS item_count
       FROM categories c
       LEFT JOIN items i ON i.category_id = c.id
      GROUP BY c.id, c.name
      ORDER BY c.name`
  );
  res.json(rows);
});

// POST /api/categories  — any authenticated member (or admin) can add one.
router.post('/', authRequired, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING id, name',
      [name.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category already exists' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/categories/:id  — admin. Items keep existing (category set null).
router.delete('/:id', authRequired, requireRole('admin'), async (req, res) => {
  const { rowCount } = await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Category not found' });
  res.status(204).end();
});

export default router;
