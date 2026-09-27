-- ============================================================
--  RentalFlow  |  Marketplace  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
--  GitHub: @pritom702  |  Part: fair play — reposting, admin control, support chats
-- ============================================================
-- Raw SQL, safe to run repeatedly (npm run db:migrate).

-- What a member deleted recently. Deleting a listing or post and putting the
-- same thing up again (to jump back to the top of the feed) is caught by
-- comparing against this, and costs a one-hour posting break.
CREATE TABLE IF NOT EXISTS content_deletions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         VARCHAR(10) NOT NULL,          -- item | post
  fingerprint  TEXT NOT NULL,
  deleted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS content_deletions_user_idx ON content_deletions (user_id, deleted_at DESC);

-- A direct chat from the RentalFlow team to a member (not about a listing).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_support BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_support_key
  ON conversations (renter_id, owner_id) WHERE is_support;

-- Admins now act on listings too, and can message anyone.
ALTER TABLE moderation_actions DROP CONSTRAINT IF EXISTS moderation_actions_target_type_check;
ALTER TABLE moderation_actions ADD CONSTRAINT moderation_actions_target_type_check
  CHECK (target_type IN ('post', 'comment', 'photo', 'user', 'item'));
ALTER TABLE moderation_actions DROP CONSTRAINT IF EXISTS moderation_actions_action_check;
ALTER TABLE moderation_actions ADD CONSTRAINT moderation_actions_action_check
  CHECK (action IN ('remove', 'remove_adult', 'restore', 'dismiss',
                    'approve_photo', 'remove_photo', 'warn', 'ban', 'unban', 'message'));

-- Instant alerts to admins when something looks fishy (adminAlerts.js).
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('booking_requested', 'booking_approved', 'booking_rejected',
                  'booking_cancelled', 'booking_completed',
                  'verification_approved', 'verification_rejected', 'verification_review',
                  'rental_due_soon', 'rental_overdue', 'rental_warning', 'rental_frozen',
                  'rental_missing', 'claim_opened', 'claim_update', 'incident',
                  'social_reaction', 'social_comment', 'social_reply', 'social_mention',
                  'social_follow', 'social_milestone', 'social_wanted', 'social_moderation',
                  'credits', 'deal', 'ad', 'admin_alert')) NOT VALID;

-- "Show off" posts are ordinary posts now.
UPDATE posts SET kind = 'post' WHERE kind = 'showcase';
