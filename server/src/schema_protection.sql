-- ============================================================
--  RentalFlow  |  Rental protection  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
--  GitHub: @pritom702  |  Part: damage, non-payment and theft protection
-- ============================================================
-- Additive (safe on a live database — applied by `npm run db:migrate`).
-- The rules themselves live in protectionUtils.js.

-- ---------------------------------------------------------------- bookings
-- The account behind a booking (not just the email typed into the form), so
-- trust, claims and bans always land on the real, verified person.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS renter_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
UPDATE bookings b SET renter_id = u.id
  FROM users u
 WHERE b.renter_id IS NULL AND LOWER(u.email) = LOWER(b.customer_email);
CREATE INDEX IF NOT EXISTS bookings_renter_idx ON bookings (renter_id);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS trust_level SMALLINT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_rate NUMERIC(4,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_received_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guarantor_name VARCHAR(120);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guarantor_phone VARCHAR(20);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guarantor_relation VARCHAR(60);
-- one-time hand-over code (only the renter can see it; the owner types it in)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS handover_code VARCHAR(6);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS renter_confirmed_checkout_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS renter_confirmed_checkin_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS handover_note TEXT;
-- how far an unreturned rental has escalated (protectionUtils.STAGES)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS escalation_stage SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS missing_reported_at TIMESTAMP;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('Pending', 'Approved', 'Cancelled', 'Completed', 'Rejected', 'Missing'));
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_status_check;
ALTER TABLE items ADD CONSTRAINT items_status_check
  CHECK (status IN ('Available', 'Rented', 'Damaged', 'Under Maintenance', 'Retired', 'Missing'));

-- ---------------------------------------------------------------- claims
-- Late fees + damage charges at the return (or the item's value, if it went
-- missing). The deposit pays first; `balance` is what the renter still owes.
CREATE TABLE IF NOT EXISTS damage_claims (
  id               SERIAL PRIMARY KEY,
  booking_id       INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  renter_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind             VARCHAR(10) NOT NULL DEFAULT 'damage' CHECK (kind IN ('damage', 'missing')),
  charges          NUMERIC(12,2) NOT NULL,
  deposit_applied  NUMERIC(12,2) NOT NULL,
  balance          NUMERIC(12,2) NOT NULL,
  -- open → accepted | disputed → resolved (admin) ; paid once the balance is settled
  status           VARCHAR(10) NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'accepted', 'disputed', 'resolved', 'paid')),
  details          TEXT,
  respond_by       TIMESTAMP NOT NULL,
  renter_response  TEXT,
  responded_at     TIMESTAMP,
  auto_accepted    BOOLEAN NOT NULL DEFAULT FALSE,
  decided_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at       TIMESTAMP,
  decision_notes   TEXT,
  paid_at          TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS damage_claims_renter_idx ON damage_claims (renter_id);

-- ---------------------------------------------------------------- incidents
-- What admins watch: rentals 48 h+ overdue, items reported missing, disputes.
CREATE TABLE IF NOT EXISTS incidents (
  id           SERIAL PRIMARY KEY,
  booking_id   INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  renter_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind         VARCHAR(10) NOT NULL CHECK (kind IN ('overdue', 'missing', 'dispute')),
  status       VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  summary      TEXT NOT NULL,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at  TIMESTAMP,
  resolution   TEXT,
  UNIQUE (booking_id, kind)
);

-- ---------------------------------------------------------------- blacklist
-- Someone who stole an item is banned by IDENTITY, not just by account: their
-- NID and face are kept here, and any new account showing either is refused.
CREATE TABLE IF NOT EXISTS identity_blacklist (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  nid_canonical    VARCHAR(17),
  face_descriptor  REAL[],
  reason           TEXT NOT NULL,
  booking_id       INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS identity_blacklist_nid_idx ON identity_blacklist (nid_canonical);

-- ---------------------------------------------------------------- escalation clock
-- The escalation sweep runs as people use the site (at most every few minutes);
-- this row makes sure only one request at a time does it.
CREATE TABLE IF NOT EXISTS system_state (
  key    VARCHAR(40) PRIMARY KEY,
  value  TIMESTAMP NOT NULL
);
INSERT INTO system_state (key, value) VALUES ('escalation_last_run', '2000-01-01') ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------- notifications
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('booking_requested', 'booking_approved', 'booking_rejected',
                  'booking_cancelled', 'booking_completed',
                  'verification_approved', 'verification_rejected', 'verification_review',
                  'rental_due_soon', 'rental_overdue', 'rental_warning', 'rental_frozen',
                  'rental_missing', 'claim_opened', 'claim_update', 'incident',
                  -- the community's types (schema_social.sql), listed here too so that
                  -- re-running this file never rejects notifications that already exist
                  'social_reaction', 'social_comment', 'social_reply', 'social_mention',
                  'social_follow', 'social_milestone', 'social_wanted', 'social_moderation'));
