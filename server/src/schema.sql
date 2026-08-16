-- ============================================================
--  RentalFlow  |  Sprint 1  |  Owner: M1 - Md. Safinuzzaman (Shafin)
--  GitHub: @shaafin01  |  Part: Database schema (all tables)
-- ============================================================
-- RentalFlow database schema (Sprint 1 scope)
-- Raw SQL, no ORM. Run via `npm run db:init`.

DROP TABLE IF EXISTS condition_reports CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS item_images CASCADE;
DROP TABLE IF EXISTS item_tags CASCADE;
DROP TABLE IF EXISTS accessories CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users of the rental marketplace.
--   admin  : platform owner, oversees all listings and users
--   member : lists their own equipment AND rents from other members
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) UNIQUE NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'member'
                CHECK (role IN ('admin', 'member')),
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Feature 2: Categorization
CREATE TABLE categories (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL
);

-- Feature 2: Tagging
CREATE TABLE tags (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(60) UNIQUE NOT NULL
);

-- Feature 1: Item catalog + Feature 3: Item status tracking
-- Every item is a marketplace LISTING owned by the member who posted it.
CREATE TABLE items (
  id               SERIAL PRIMARY KEY,
  owner_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             VARCHAR(160) NOT NULL,
  description      TEXT,
  serial_number    VARCHAR(120) UNIQUE,
  rental_price     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  replacement_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status           VARCHAR(20) NOT NULL DEFAULT 'Available'
                   CHECK (status IN ('Available', 'Rented', 'Damaged',
                                     'Under Maintenance', 'Retired')),
  category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  -- Sprint 3 / F4: unique code encoded into each item's QR for scan check-out/in
  qr_token         TEXT UNIQUE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Feature 2: many-to-many between items and tags
CREATE TABLE item_tags (
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

-- Feature 1: product images uploaded from the member's device (multiple per item).
-- `url` points at a file served from /uploads. `position` orders them (0 = cover).
CREATE TABLE item_images (
  id       SERIAL PRIMARY KEY,
  item_id  INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  url      TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

-- Feature 5: Accessory tracking (accessory belongs to a main item)
CREATE TABLE accessories (
  id             SERIAL PRIMARY KEY,
  parent_item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  name           VARCHAR(120) NOT NULL
);

CREATE TABLE bookings (
  id               SERIAL PRIMARY KEY,
  item_id          INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  customer_name    VARCHAR(120) NOT NULL,
  customer_email   VARCHAR(160) NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  status           VARCHAR(30) NOT NULL DEFAULT 'Pending'
                   CHECK (status IN ('Pending', 'Approved', 'Cancelled', 'Completed', 'Rejected')),
  deposit_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  late_fee_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  -- Sprint 3: rental checkout lifecycle
  checked_out_at         TIMESTAMP,
  checked_in_at          TIMESTAMP,
  penalty_amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  penalty_notes          TEXT,
  agreement_number       TEXT,
  agreement_generated_at TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Sprint 3 / F13: condition report captured at check-out and again at check-in.
-- Comparing the two drives damage control & penalty (F14).
CREATE TABLE condition_reports (
  id                  SERIAL PRIMARY KEY,
  booking_id          INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  phase               VARCHAR(10) NOT NULL CHECK (phase IN ('checkout','checkin')),
  condition_status    VARCHAR(20) NOT NULL
                      CHECK (condition_status IN ('New','Good','Fair','Poor','Damaged')),
  notes               TEXT,
  scratch_details     TEXT,
  missing_accessories TEXT,
  photos              TEXT[] NOT NULL DEFAULT '{}',   -- URLs from /api/uploads
  repair_cost         NUMERIC(10,2) NOT NULL DEFAULT 0,   -- entered at check-in
  missing_charge      NUMERIC(10,2) NOT NULL DEFAULT 0,   -- entered at check-in
  created_by          INTEGER REFERENCES users(id),
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, phase)
);
