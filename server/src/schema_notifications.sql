-- ============================================================
--  RentalFlow  |  Sprint 4  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
--  GitHub: @pritom702  |  Part: In-app notifications for the booking flow
-- ============================================================
-- Raw SQL, no ORM. Runs after schema.sql / schema_sprint4.sql via `npm run db:init`.
--
-- A notification always belongs to ONE recipient account. The booking flow has
-- two sides -- the member who owns the item and the customer who booked it --
-- so every event notifies the other side:
--   customer requests a booking  -> the item owner is told
--   owner approves / rejects it  -> the customer is told
--   customer cancels             -> the item owner is told

DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  type       VARCHAR(30) NOT NULL
             CHECK (type IN ('booking_requested', 'booking_approved', 'booking_rejected',
                             'booking_cancelled', 'booking_completed')),
  title      VARCHAR(160) NOT NULL,
  body       TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The bell asks "what is unread for me" on every poll, so index that pair.
CREATE INDEX notifications_user_idx    ON notifications (user_id, read_at);
CREATE INDEX notifications_created_idx ON notifications (created_at DESC);
