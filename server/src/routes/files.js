// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: serving private photos through signed links
// ============================================================
// NID photos and selfies live in the private_files table, never on a public
// path. The server hands out a link only to someone allowed to see the photo
// (the member themself, an admin, or the owner checking a renter), and that
// link carries a signature that expires after an hour:
//
//   /api/files/12?sig=<signed token naming file 12>
//
// An <img> tag cannot send the login header, which is why the permission is
// baked into the link instead. A copied link stops working after an hour and
// cannot be edited to open file 13 — the signature names file 12 only.
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const router = Router();
const LINK_LIFETIME = '1h';

// "/api/files/12" → "/api/files/12?sig=…". Any other URL (a public product
// image, the old demo NID pictures) is returned unchanged.
export function signFileUrl(url) {
  const m = /^\/api\/files\/(\d+)$/.exec(url || '');
  if (!m) return url;
  const sig = jwt.sign({ f: Number(m[1]) }, process.env.JWT_SECRET, { expiresIn: LINK_LIFETIME });
  return `${url}?sig=${sig}`;
}

router.get('/:id', async (req, res) => {
  let payload;
  try {
    payload = jwt.verify(String(req.query.sig || ''), process.env.JWT_SECRET);
  } catch {
    return res.status(403).json({ error: 'This link has expired. Reload the page.' });
  }
  if (payload.f !== Number(req.params.id)) return res.status(403).json({ error: 'Forbidden' });

  const { rows } = await query('SELECT mime, data FROM private_files WHERE id = $1', [payload.f]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.set('Content-Type', rows[0].mime);
  res.set('Cache-Control', 'private, max-age=3600');
  res.send(rows[0].data);
});

export default router;
