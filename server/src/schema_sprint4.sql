-- ============================================================
--  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
--  Part: Sprint-4 schema — maintenance & repair log (F18),
--        staff accounts + audit logs (F20)
-- ============================================================
-- Raw SQL, no ORM. Runs right after schema.sql via `npm run db:init`.

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS maintenance_logs CASCADE;

-- F20: staff accounts.
-- Sprint 1 only had 'admin' and 'member'. Sprint 4 introduces 'staff': a person
-- who can operate bookings, check-outs and maintenance but cannot manage user
-- accounts. An account can also be suspended without deleting its history.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'staff', 'member'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('active', 'suspended'));

-- F18: maintenance & repair log.
-- One row per repair/service job on an item. A job that is still 'Open' or
-- 'In Progress' holds the item out of the rental pool (items.status =
-- 'Under Maintenance'); closing the last open job releases it back.
CREATE TABLE maintenance_logs (
  id           SERIAL PRIMARY KEY,
  item_id      INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  -- The check-in that revealed the damage, when the job came from a return (F14).
  booking_id   INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  job_type     VARCHAR(20) NOT NULL DEFAULT 'Repair'
               CHECK (job_type IN ('Repair', 'Service', 'Inspection', 'Cleaning', 'Replacement')),
  priority     VARCHAR(10) NOT NULL DEFAULT 'Normal'
               CHECK (priority IN ('Low', 'Normal', 'High')),
  status       VARCHAR(20) NOT NULL DEFAULT 'Open'
               CHECK (status IN ('Open', 'In Progress', 'Completed', 'Cancelled')),
  description  TEXT NOT NULL,
  technician   VARCHAR(120),
  parts_cost   NUMERIC(10,2) NOT NULL DEFAULT 0,
  labour_cost  NUMERIC(10,2) NOT NULL DEFAULT 0,
  reported_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reported_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX maintenance_logs_item_idx   ON maintenance_logs (item_id);
CREATE INDEX maintenance_logs_status_idx ON maintenance_logs (status);

-- F20: audit log.
-- Every state-changing API call (POST/PUT/PATCH/DELETE) is written here by the
-- audit middleware, so an admin can see who did what and when.
CREATE TABLE audit_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_email  VARCHAR(160),
  action      VARCHAR(10) NOT NULL,          -- HTTP verb: POST / PUT / PATCH / DELETE
  entity      VARCHAR(60) NOT NULL,          -- first API path segment, e.g. 'bookings'
  entity_id   VARCHAR(60),                   -- second path segment when it is an id
  path        TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  summary     TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_entity_idx  ON audit_logs (entity);
