-- ============================================================
--  RentalFlow  |  Messaging  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
--  GitHub: @pritom702  |  Part: renter <-> lister chat about a listing
-- ============================================================
-- Raw SQL, no ORM. Safe to run again and again (npm run db:migrate).
--
-- One conversation per (listing, renter, lister): asking about two different
-- items gives two threads, so every chat is clearly about one product. If the
-- listing is later deleted the conversation stays, just without its item.
CREATE TABLE IF NOT EXISTS conversations (
  id              SERIAL PRIMARY KEY,
  item_id         INTEGER REFERENCES items(id) ON DELETE SET NULL,
  renter_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  CHECK (renter_id <> owner_id)
);
-- NULL item_id (a deleted listing) must not collide, so the uniqueness rule
-- covers only conversations that still point at an item.
CREATE UNIQUE INDEX IF NOT EXISTS conversations_item_pair_key
  ON conversations (item_id, renter_id, owner_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS conversations_renter_idx ON conversations (renter_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_owner_idx  ON conversations (owner_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, id);
-- "How many unread messages do I have?" is asked on every page, so it is indexed.
CREATE INDEX IF NOT EXISTS messages_unread_idx ON messages (conversation_id) WHERE read_at IS NULL;
