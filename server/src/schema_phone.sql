-- ============================================================
--  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
--  GitHub: @pritom702  |  Part: phone number check (one-time code by SMS)
-- ============================================================
-- A member is fully verified only with a checked National ID AND a checked
-- mobile number. The number is proved with a 6-digit code, like the email.

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- One verified account per mobile number.
CREATE UNIQUE INDEX IF NOT EXISTS users_verified_phone_idx
  ON users (phone) WHERE phone_verified_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS phone_codes (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone        VARCHAR(20) NOT NULL,
  code_hash    VARCHAR(64) NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
