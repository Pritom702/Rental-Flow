-- ============================================================
--  RentalFlow  |  Deployment  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
--  GitHub: @pritom702  |  Part: product photos stored in the database
-- ============================================================
-- Raw SQL, no ORM. Safe to run repeatedly (npm run db:migrate).
--
-- Why: a serverless host (Vercel) has no permanent disk — a photo written to
-- server/src/uploads/ vanishes when the function goes to sleep. Keeping the
-- bytes in PostgreSQL means a listing photo works the same on a laptop and on
-- the hosted site, and the database dump carries the photos with it.
--
-- The public URL does not change: an item still points at /uploads/<name>.
-- The server looks for <name> in this table (and, for older photos, on disk).
CREATE TABLE IF NOT EXISTS public_images (
  name       VARCHAR(120) PRIMARY KEY,
  mime       VARCHAR(40) NOT NULL,
  data       BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
