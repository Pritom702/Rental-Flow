-- ============================================================
--  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
--  Part: NID verification for damage control + user profiles
--        and permanent payment methods
-- ============================================================
-- Raw SQL, no ORM. Runs after schema_sprint4.sql via `npm run db:init`.

-- ------------------------------------------------------------------
-- NID (National ID) on the user account.
--
-- Why: damage control. When an item comes back broken the platform needs a
-- verified real-world identity behind the booking, otherwise a penalty is
-- unenforceable. The NID is collected once, on the member's first booking
-- request, and then lives on the account forever.
--
-- Write-once is enforced in three places, deliberately:
--   1. the API refuses to overwrite a value that is already set,
--   2. the trigger below blocks the UPDATE at the database level,
--   3. the UI hides the form once a NID is on file.
-- Defence in depth: a bug in the route still cannot rewrite someone's identity.
-- ------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS nid_number     VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS nid_front_url  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nid_back_url   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nid_name       VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS nid_submitted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone          VARCHAR(30);

-- A Bangladeshi NID is 10, 13 or 17 digits. Stored digits-only.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_nid_number_check;
ALTER TABLE users ADD CONSTRAINT users_nid_number_check
  CHECK (nid_number IS NULL OR nid_number ~ '^[0-9]{10}$|^[0-9]{13}$|^[0-9]{17}$');

-- The same national ID may not back two different accounts. A partial index is
-- used so the many rows with no NID yet do not all collide on NULL.
DROP INDEX IF EXISTS users_nid_number_key;
CREATE UNIQUE INDEX users_nid_number_key
  ON users (nid_number) WHERE nid_number IS NOT NULL;

-- Block any attempt to change or clear a NID that is already recorded.
CREATE OR REPLACE FUNCTION users_nid_write_once() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.nid_number IS NOT NULL AND NEW.nid_number IS DISTINCT FROM OLD.nid_number THEN
    RAISE EXCEPTION 'NID is recorded once and cannot be changed (user %)', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_nid_write_once_trg ON users;
CREATE TRIGGER users_nid_write_once_trg
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION users_nid_write_once();

-- ------------------------------------------------------------------
-- Payment methods — append-only, permanent.
--
-- Requirement: "once a payment method is added it cannot be removed forever."
-- We honour that literally. There is no DELETE endpoint, and the trigger below
-- refuses the DELETE even if someone runs it by hand in psql. A method can only
-- be deactivated (is_active = FALSE) so the row, and the payment history that
-- references it, survive.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_methods (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  kind        VARCHAR(20) NOT NULL
              CHECK (kind IN ('bKash', 'Nagad', 'Rocket', 'Card', 'Bank')),
  label       VARCHAR(80),
  -- Stored already masked by the API — RentalFlow never keeps a full card or
  -- wallet number, only enough to recognise which method this is.
  account_ref VARCHAR(120) NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_methods_user_idx ON payment_methods (user_id);

-- At most one default per user.
DROP INDEX IF EXISTS payment_methods_one_default;
CREATE UNIQUE INDEX payment_methods_one_default
  ON payment_methods (user_id) WHERE is_default;

-- The permanence guarantee, enforced by the database itself.
CREATE OR REPLACE FUNCTION payment_methods_no_delete() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Payment methods are permanent and cannot be deleted (id %)', OLD.id
    USING ERRCODE = 'restrict_violation',
          HINT = 'Deactivate it instead: UPDATE payment_methods SET is_active = FALSE.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_methods_no_delete_trg ON payment_methods;
CREATE TRIGGER payment_methods_no_delete_trg
  BEFORE DELETE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION payment_methods_no_delete();

-- Only is_default and is_active may ever change. The money details are frozen
-- so a method cannot be "removed" by quietly blanking what it points at.
CREATE OR REPLACE FUNCTION payment_methods_immutable_details() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id     IS DISTINCT FROM OLD.user_id
  OR NEW.kind        IS DISTINCT FROM OLD.kind
  OR NEW.account_ref IS DISTINCT FROM OLD.account_ref
  OR NEW.created_at  IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'A payment method''s details are permanent; only is_default/is_active may change'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_methods_immutable_trg ON payment_methods;
CREATE TRIGGER payment_methods_immutable_trg
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION payment_methods_immutable_details();
