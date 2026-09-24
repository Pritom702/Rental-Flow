-- ============================================================
--  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
--  GitHub: @pritom702  |  Part: email codes, NID + face checks, admin review
-- ============================================================
-- Raw SQL, no ORM. Safe to run again and again: nothing here drops a table or
-- deletes a row, so `npm run db:migrate` can upgrade a database that already
-- holds real data (the hosted one included). `npm run db:init` runs it too.
--
-- The rule this file supports: a NEW member must prove who they are before
-- they can use the platform —
--   1. confirm their email with a 6-digit code,
--   2. photograph their National ID card (number, name and date of birth are
--      read off the card and compared with what they typed),
--   3. take a live selfie that is matched against the face on the card.
-- Anything the machine cannot confirm is queued for an admin to decide.

-- ------------------------------------------------------------------
-- Account-level state
-- ------------------------------------------------------------------
-- DEFAULT 'verified' is deliberate: every account that already exists (the
-- seeded members, admins and staff) keeps working exactly as before. Only the
-- public signup route inserts 'unverified' explicitly.
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'verified';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_verification_status_check;
ALTER TABLE users ADD CONSTRAINT users_verification_status_check
  CHECK (verification_status IN ('unverified', 'pending_review', 'verified', 'rejected'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
-- Accounts that existed before email codes did were never asked for one;
-- record them as confirmed so the email gate only ever applies to new sign-ups.
UPDATE users SET email_verified_at = created_at
 WHERE email_verified_at IS NULL AND verification_status = 'verified';

-- The 13-digit "core" of the NID. A 17-digit card is the birth year followed by
-- the 13-digit number, so the same person could otherwise register twice — once
-- with each form. Uniqueness is enforced on this column, not on the raw input.
ALTER TABLE users ADD COLUMN IF NOT EXISTS nid_canonical VARCHAR(17);
-- NIDs recorded before this column existed get their core filled in, so they
-- are protected by the same uniqueness rule as new ones.
UPDATE users
   SET nid_canonical = CASE WHEN LENGTH(nid_number) = 17 THEN SUBSTRING(nid_number FROM 5) ELSE nid_number END
 WHERE nid_number IS NOT NULL AND nid_canonical IS NULL;
DROP INDEX IF EXISTS users_nid_canonical_key;
CREATE UNIQUE INDEX users_nid_canonical_key
  ON users (nid_canonical) WHERE nid_canonical IS NOT NULL;

-- 128 numbers that describe a face. Stored so a new selfie can be compared
-- against every verified member: one person, two accounts, two different NIDs
-- is caught here even though the numbers never collide.
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_descriptor REAL[];

-- ------------------------------------------------------------------
-- Email confirmation codes — one live code per account.
-- Only a hash of the code is stored, so reading this table does not let
-- anyone log in as someone else.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_codes (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash    VARCHAR(64) NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------
-- Private files (NID photos, selfies) kept inside the database.
--
-- Why not the uploads/ folder: identity documents must never be reachable by a
-- guessable public URL, and a serverless host (Vercel) has no persistent disk.
-- A row here is only ever served to its owner or to admin/staff.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS private_files (
  id         SERIAL PRIMARY KEY,
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       VARCHAR(20) NOT NULL
             CHECK (kind IN ('nid_front', 'nid_back', 'selfie', 'liveness')),
  mime       VARCHAR(40) NOT NULL DEFAULT 'image/jpeg',
  data       BYTEA NOT NULL,
  sha256     CHAR(64) NOT NULL,
  -- 64-bit "difference hash" of the picture: near-identical images (the same
  -- photo resized or re-saved) have hashes only a few bits apart.
  dhash      BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS private_files_owner_idx ON private_files (owner_id);
CREATE INDEX IF NOT EXISTS private_files_sha_idx   ON private_files (sha256);

-- ------------------------------------------------------------------
-- Verification attempts — the full audit trail.
--
-- Every submission is a row, kept forever, including the ones that failed.
-- Admins see exactly which check passed or failed and by how much.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS identity_verifications (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- in_progress: NID accepted, waiting for the selfie
  -- verified / pending_review / rejected: final outcomes
  -- retry: the member must fix something (blurry photo, failed liveness...)
  decision         VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                   CHECK (decision IN ('in_progress', 'retry', 'pending_review', 'verified', 'rejected')),
  nid_number       VARCHAR(17) NOT NULL,
  nid_canonical    VARCHAR(17) NOT NULL,
  nid_name         VARCHAR(120) NOT NULL,
  date_of_birth    DATE,
  front_file_id    INTEGER REFERENCES private_files(id),
  back_file_id     INTEGER REFERENCES private_files(id),
  selfie_file_id   INTEGER REFERENCES private_files(id),
  -- scores, kept so a human can see why the machine decided what it did
  front_sharpness  REAL,
  back_sharpness   REAL,
  selfie_sharpness REAL,
  ocr_text         TEXT,
  ocr_number       VARCHAR(17),
  ocr_name         VARCHAR(120),
  ocr_dob          DATE,
  name_score       REAL,
  face_distance    REAL,
  card_descriptor  REAL[],
  selfie_descriptor REAL[],
  liveness_challenge TEXT[],
  liveness_attempts INTEGER NOT NULL DEFAULT 0,
  liveness_passed  BOOLEAN,
  flags            TEXT[] NOT NULL DEFAULT '{}',
  reasons          TEXT[] NOT NULL DEFAULT '{}',
  reviewed_by      INTEGER REFERENCES users(id),
  review_note      TEXT,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS identity_verifications_user_idx
  ON identity_verifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS identity_verifications_queue_idx
  ON identity_verifications (decision, created_at);

-- While one account's claim on a NID is being processed or reviewed, nobody
-- else can submit the same NID — the database refuses the second INSERT even
-- if two people press "submit" in the same instant.
DROP INDEX IF EXISTS identity_verifications_active_nid_key;
CREATE UNIQUE INDEX identity_verifications_active_nid_key
  ON identity_verifications (nid_canonical)
  WHERE decision IN ('in_progress', 'pending_review', 'verified');

-- ------------------------------------------------------------------
-- Learning from admin decisions (riskModel.js).
--
-- Each finished attempt keeps the signals the model read (features) and the
-- score it gave (risk_score = estimated chance an admin would approve). Every
-- admin decision re-trains the model on all decisions so far; each training
-- run is kept as a row, so the history of what it learned stays visible.
-- ip_hash is a one-way hash of the network address, never the address itself.
-- ------------------------------------------------------------------
ALTER TABLE identity_verifications ADD COLUMN IF NOT EXISTS risk_score REAL;
ALTER TABLE identity_verifications ADD COLUMN IF NOT EXISTS features JSONB;
ALTER TABLE identity_verifications ADD COLUMN IF NOT EXISTS ip_hash CHAR(64);
CREATE INDEX IF NOT EXISTS identity_verifications_ip_idx ON identity_verifications (ip_hash, created_at);

CREATE TABLE IF NOT EXISTS risk_models (
  id              SERIAL PRIMARY KEY,
  bias            REAL NOT NULL,
  weights         JSONB NOT NULL,
  examples        INTEGER NOT NULL,       -- everything trained on
  admin_decisions INTEGER NOT NULL,       -- of which decided by an admin
  accuracy        REAL,                   -- leave-one-out, on admin decisions
  trained_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------
-- "Continue on your phone": a member who signed up on a computer scans a QR
-- code and the phone opens already signed in, at the same step. Each link is
-- single-use, expires after 15 minutes, and only a hash of it is stored.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS handoff_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------
-- Notifications: allow the three verification events alongside the booking ones.
-- ------------------------------------------------------------------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('booking_requested', 'booking_approved', 'booking_rejected',
                  'booking_cancelled', 'booking_completed',
                  'verification_approved', 'verification_rejected', 'verification_review'));
