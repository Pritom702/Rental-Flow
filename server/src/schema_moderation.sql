-- ============================================================
--  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
--  GitHub: @pritom702  |  Part: admin moderation — actions, photo reviews, warnings
-- ============================================================
-- Raw SQL, safe to run repeatedly (npm run db:migrate).

-- Every decision an admin makes about a member or their content. It is the
-- history the admin console shows, and the examples the moderation model
-- (moderationModel.js) learns from: `features` is what the model saw at the
-- time, `predicted` what it guessed before the admin decided.
CREATE TABLE IF NOT EXISTS moderation_actions (
  id           SERIAL PRIMARY KEY,
  admin_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  target_type  VARCHAR(12) NOT NULL CHECK (target_type IN ('post', 'comment', 'photo', 'user')),
  target_id    INTEGER,
  action       VARCHAR(20) NOT NULL CHECK (action IN (
                 'remove', 'remove_adult', 'restore', 'dismiss',
                 'approve_photo', 'remove_photo', 'warn', 'ban', 'unban')),
  reason       VARCHAR(300),
  features     JSONB,
  predicted    REAL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS moderation_actions_user_idx ON moderation_actions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS moderation_actions_time_idx ON moderation_actions (created_at DESC);

-- Photos the adult-content check was not sure about. They stay up; an admin
-- keeps or removes them.
CREATE TABLE IF NOT EXISTS photo_reviews (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  place       VARCHAR(40) NOT NULL,
  scores      JSONB,
  status      VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'removed')),
  decided_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS photo_reviews_pending_idx ON photo_reviews (status, created_at DESC);

-- Warnings an admin sent by hand (strikes for adult content are separate).
ALTER TABLE users ADD COLUMN IF NOT EXISTS warning_count INTEGER NOT NULL DEFAULT 0;

-- Communities an admin made that are not tied to a category.
ALTER TABLE communities ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Posting in bursts: after 10 posts in a row, a 30-minute break until this time.
ALTER TABLE users ADD COLUMN IF NOT EXISTS post_cooldown_until TIMESTAMPTZ;
