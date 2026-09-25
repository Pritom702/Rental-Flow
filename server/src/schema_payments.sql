-- ============================================================
--  RentalFlow  |  Marketplace  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
--  GitHub: @pritom702  |  Part: payments for Buy now and bookings (demo gateway)
-- ============================================================
-- Raw SQL, safe to run repeatedly (npm run db:migrate).
-- One row per checkout. RentalFlow Pay is a DEMO gateway: no real money
-- moves; the rows record what would have been paid, for what, and when.
CREATE TABLE IF NOT EXISTS payments (
  id          SERIAL PRIMARY KEY,
  tran_id     VARCHAR(60) UNIQUE NOT NULL,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     VARCHAR(10) NOT NULL CHECK (purpose IN ('sale', 'booking')),
  ref_id      INTEGER NOT NULL,                 -- sale_deals.id or bookings.id
  amount      INTEGER NOT NULL CHECK (amount > 0),
  breakdown   JSONB NOT NULL DEFAULT '[]',     -- [{ label, amount }]
  method      VARCHAR(20),                      -- bkash | nagad | rocket | card
  account     VARCHAR(30),                      -- masked, e.g. 017•••••678
  status      VARCHAR(12) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS payments_ref_idx ON payments (purpose, ref_id);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE sale_deals ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
