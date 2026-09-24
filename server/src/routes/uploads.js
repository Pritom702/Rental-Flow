// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M1 - Md. Safinuzzaman (Shafin)
//  GitHub: @shaafin01  |  Part: Product image upload endpoint
// ============================================================
// Image upload route. Members upload product photos FROM THEIR DEVICE.
// Files are stored on disk under /uploads and served statically; the DB only
// stores the resulting URL path. Supports multiple images per request.
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authRequired } from '../middleware/auth.js';
import { query } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Older photos (and the seeded demo images) may still live in this folder;
// app.js serves from here first and then from the database.
export const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch { /* read-only disk on Vercel */ }

// GET /uploads/:name — a photo stored in the database.
export async function serveStoredImage(req, res) {
  const { rows } = await query('SELECT mime, data FROM public_images WHERE name = $1', [req.params.name]);
  if (!rows[0]) return res.status(404).json({ error: 'Image not found' });
  res.set('Content-Type', rows[0].mime);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');   // names are never reused
  res.send(rows[0].data);
}

// Photos are kept in memory just long enough to be written to the
// public_images table (see schema_images.sql) — there is no disk on Vercel.
const storage = multer.memoryStorage();

function uniqueName(originalName) {
  const ext = path.extname(originalName || '').toLowerCase().replace(/[^.a-z0-9]/g, '') || '.jpg';
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per image
  fileFilter: (_req, file, cb) => {
    // Photos only. SVG is refused on purpose: it can carry script, and these
    // files are served from our own domain.
    if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP or GIF photos are allowed'));
  },
});

const router = Router();

// POST /api/uploads  — field name "images", up to 8 files. Returns { urls: [...] }.
router.post('/', authRequired, (req, res) => {
  upload.array('images', 8)(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    try {
      const urls = [];
      for (const f of req.files) {
        const name = uniqueName(f.originalname);
        await query('INSERT INTO public_images (name, mime, data) VALUES ($1, $2, $3)', [name, f.mimetype, f.buffer]);
        urls.push(`/uploads/${name}`);
      }
      res.status(201).json({ urls });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

export default router;
