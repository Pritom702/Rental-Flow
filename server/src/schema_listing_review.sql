-- ============================================================
--  RentalFlow  |  Trust  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
--  GitHub: @pritom702  |  Part: listing review, valuation and theft compensation
-- ============================================================
-- Raw SQL, safe to run repeatedly (npm run db:migrate).
--
-- A new listing waits for an admin. The owner gives the market price; the
-- admin confirms it (helped by valuationModel.js) and the replacement cost is
-- set to 60% of it. Listings from before this existed count as approved.
ALTER TABLE items ADD COLUMN IF NOT EXISTS market_price     NUMERIC(12, 2);
ALTER TABLE items ADD COLUMN IF NOT EXISTS review_status    VARCHAR(10) NOT NULL DEFAULT 'approved';
ALTER TABLE items ADD COLUMN IF NOT EXISTS suggested_market NUMERIC(12, 2);
ALTER TABLE items ADD COLUMN IF NOT EXISTS reviewed_by      INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE items ADD COLUMN IF NOT EXISTS reviewed_at      TIMESTAMPTZ;
ALTER TABLE items ADD COLUMN IF NOT EXISTS review_note      VARCHAR(300);
ALTER TABLE items ADD COLUMN IF NOT EXISTS listing_fee      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_review_status_check;
ALTER TABLE items ADD CONSTRAINT items_review_status_check CHECK (review_status IN ('pending', 'approved', 'rejected'));
CREATE INDEX IF NOT EXISTS items_review_idx ON items (review_status) WHERE review_status <> 'approved';

-- What admins approved: the valuation model learns from these rows.
CREATE TABLE IF NOT EXISTS item_valuations (
  id              SERIAL PRIMARY KEY,
  item_id         INTEGER REFERENCES items(id) ON DELETE SET NULL,
  category_id     INTEGER,
  daily           NUMERIC(12, 2) NOT NULL,
  declared        NUMERIC(12, 2),
  suggested       NUMERIC(12, 2),
  approved_market NUMERIC(12, 2) NOT NULL,
  admin_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A rented item reported missing and not recovered within 30 days: the owner
-- is paid 50% of its replacement cost (RentalFlow Pay demo — recorded, not charged).
CREATE TABLE IF NOT EXISTS theft_compensations (
  id          SERIAL PRIMARY KEY,
  booking_id  INTEGER UNIQUE REFERENCES bookings(id) ON DELETE SET NULL,
  item_id     INTEGER REFERENCES items(id) ON DELETE SET NULL,
  owner_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  replacement NUMERIC(12, 2) NOT NULL,
  amount      NUMERIC(12, 2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('booking_requested', 'booking_approved', 'booking_rejected',
                  'booking_cancelled', 'booking_completed',
                  'verification_approved', 'verification_rejected', 'verification_review',
                  'rental_due_soon', 'rental_overdue', 'rental_warning', 'rental_frozen',
                  'rental_missing', 'claim_opened', 'claim_update', 'incident',
                  'social_reaction', 'social_comment', 'social_reply', 'social_mention',
                  'social_follow', 'social_milestone', 'social_wanted', 'social_moderation',
                  'credits', 'deal', 'ad', 'admin_alert', 'listing_review', 'listing_decision'));
