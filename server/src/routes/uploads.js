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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per image
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const router = Router();

// POST /api/uploads  — field name "images", up to 8 files. Returns { urls: [...] }.
router.post('/', authRequired, (req, res) => {
  upload.array('images', 8)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    const urls = req.files.map((f) => `/uploads/${f.filename}`);
    res.status(201).json({ urls });
  });
});

export default router;
