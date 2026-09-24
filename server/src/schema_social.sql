-- ============================================================
--  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
--  GitHub: @pritom702  |  Part: the social layer — communities, posts, stories
-- ============================================================
-- Raw SQL, no ORM. Safe to run again and again (npm run db:migrate).
--
-- One community per product category (c/cameras, c/drones, ...). Members post
-- text, photos, files, links, polls, "wanted" requests and listing showcases;
-- others react, comment, reply, save and share. Stories ("moments") vanish
-- after 24 hours. Streaks, XP and levels reward coming back and contributing.
--
-- Speed: every counter a feed shows (reactions, comments, members) is stored
-- on its row and kept up to date by the API, so a feed page never counts
-- thousands of rows. Photos and files live in public_images like listing
-- photos, already shrunk in the browser before upload.

-- ---------------------------------------------------------------- people
-- A short public @handle for mentions and profile links, plus a bio.
ALTER TABLE users ADD COLUMN IF NOT EXISTS handle VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS community_rules_at TIMESTAMPTZ;
-- Adult content: 1st strike = warning, 2nd = banned (see moderation.js).
ALTER TABLE users ADD COLUMN IF NOT EXISTS content_strikes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason VARCHAR(160);
CREATE UNIQUE INDEX IF NOT EXISTS users_handle_key ON users (LOWER(handle));

-- Existing accounts get a handle from their name (rahimuddin, karimhasan, ...);
-- when two names collide, the later account gets its id appended.
WITH base AS (
  SELECT id,
         COALESCE(NULLIF(LEFT(LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g')), 20), ''), 'member') AS b
    FROM users WHERE handle IS NULL
), ranked AS (
  SELECT id, b, ROW_NUMBER() OVER (PARTITION BY b ORDER BY id) AS rn FROM base
)
UPDATE users u
   SET handle = CASE
     WHEN r.rn = 1 AND NOT EXISTS (SELECT 1 FROM users x WHERE LOWER(x.handle) = r.b) THEN r.b
     ELSE r.b || u.id END
  FROM ranked r
 WHERE u.id = r.id;

-- XP, level and the daily streak.
CREATE TABLE IF NOT EXISTS user_stats (
  user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp               INTEGER NOT NULL DEFAULT 0,
  karma            INTEGER NOT NULL DEFAULT 0,      -- reactions received
  streak_days      INTEGER NOT NULL DEFAULT 0,
  best_streak      INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  post_count       INTEGER NOT NULL DEFAULT 0,
  comment_count    INTEGER NOT NULL DEFAULT 0
);
-- The reward engine (rewards.js): how many times each action was done, the
-- badges already unlocked, and today's tallies (daily XP caps stop farming).
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS counters JSONB NOT NULL DEFAULT '{}';
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS badges   TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS today    JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX IF NOT EXISTS follows_followee_idx ON follows (followee_id);

-- ---------------------------------------------------------------- communities
CREATE TABLE IF NOT EXISTS communities (
  id           SERIAL PRIMARY KEY,
  category_id  INTEGER UNIQUE REFERENCES categories(id) ON DELETE SET NULL,
  slug         VARCHAR(60) UNIQUE NOT NULL,
  name         VARCHAR(80) NOT NULL,
  description  VARCHAR(300),
  member_count INTEGER NOT NULL DEFAULT 0,
  post_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Every category gets its community; categories added later are picked up
-- the next time this file runs (and on the fly by the API).
INSERT INTO communities (category_id, slug, name, description)
SELECT c.id,
       TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(c.name, '[^a-zA-Z0-9]+', '-', 'g'))),
       c.name,
       'Everything ' || LOWER(c.name) || ': show what you shot or built, ask before you rent, and find what you need.'
  FROM categories c
 WHERE NOT EXISTS (SELECT 1 FROM communities m WHERE m.category_id = c.id)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS community_members (
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         VARCHAR(12) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'mod')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);
CREATE INDEX IF NOT EXISTS community_members_user_idx ON community_members (user_id);

-- ---------------------------------------------------------------- posts
-- kind:        what the post is (drives how the card looks)
-- attachments: [{ url, type: 'image'|'file', name, size, mime, w, h, color }]
-- link:        { url, title, description, image, site, youtube }  (fetched once, server side)
-- poll:        { options: ['..', '..'], counts: [n, n], closes_at }
-- wanted:      { budget, from, to, area }
-- sale:        { price, condition, negotiable, sold }   (selling, not renting)
CREATE TABLE IF NOT EXISTS posts (
  id             SERIAL PRIMARY KEY,
  community_id   INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  author_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind           VARCHAR(12) NOT NULL DEFAULT 'post'
                 CHECK (kind IN ('post', 'showcase', 'question', 'guide', 'wanted', 'poll', 'sell')),
  body           TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 5000),
  attachments    JSONB NOT NULL DEFAULT '[]',
  link           JSONB,
  poll           JSONB,
  wanted         JSONB,
  sale           JSONB,
  item_id        INTEGER REFERENCES items(id) ON DELETE SET NULL,
  hashtags       TEXT[] NOT NULL DEFAULT '{}',
  reaction_count INTEGER NOT NULL DEFAULT 0,
  comment_count  INTEGER NOT NULL DEFAULT 0,
  share_count    INTEGER NOT NULL DEFAULT 0,
  status         VARCHAR(10) NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'removed')),
  report_count   INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at      TIMESTAMPTZ
);
-- Selling came after the first version of this table.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS sale JSONB;
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_kind_check;
ALTER TABLE posts ADD CONSTRAINT posts_kind_check
  CHECK (kind IN ('post', 'showcase', 'question', 'guide', 'wanted', 'poll', 'sell'));
CREATE INDEX IF NOT EXISTS posts_new_idx        ON posts (created_at DESC, id DESC) WHERE status = 'visible';
CREATE INDEX IF NOT EXISTS posts_community_idx  ON posts (community_id, created_at DESC) WHERE status = 'visible';
CREATE INDEX IF NOT EXISTS posts_author_idx     ON posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_item_idx       ON posts (item_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS posts_hashtags_idx   ON posts USING GIN (hashtags);
CREATE INDEX IF NOT EXISTS posts_moderation_idx ON posts (status) WHERE status <> 'visible' OR report_count > 0;

-- One reaction per person per post; changing it replaces the old one.
-- RentalFlow's own set ("sparks"): spark, want (I want this), genius, wow, lol, adore.
CREATE TABLE IF NOT EXISTS post_reactions (
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);
-- The first version used a generic emoji set; move those reactions over.
ALTER TABLE post_reactions DROP CONSTRAINT IF EXISTS post_reactions_type_check;
UPDATE post_reactions SET type = CASE type
  WHEN 'like' THEN 'spark' WHEN 'fire' THEN 'spark' WHEN 'love' THEN 'adore'
  WHEN 'haha' THEN 'lol' WHEN 'sad' THEN 'genius' ELSE type END
 WHERE type IN ('like', 'fire', 'love', 'haha', 'sad');
ALTER TABLE post_reactions ADD CONSTRAINT post_reactions_type_check
  CHECK (type IN ('spark', 'want', 'genius', 'wow', 'lol', 'adore'));
CREATE INDEX IF NOT EXISTS post_reactions_user_idx ON post_reactions (user_id);

CREATE TABLE IF NOT EXISTS post_saves (
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS poll_votes (
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_idx SMALLINT NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

-- ---------------------------------------------------------------- comments
-- One level of replies (parent_id), like most social apps show them.
CREATE TABLE IF NOT EXISTS comments (
  id           SERIAL PRIMARY KEY,
  post_id      INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id    INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  body         TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  like_count   INTEGER NOT NULL DEFAULT 0,
  status       VARCHAR(10) NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'removed')),
  report_count INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comments_post_idx ON comments (post_id, id);

CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (comment_id, user_id)
);

-- ---------------------------------------------------------------- reports
CREATE TABLE IF NOT EXISTS content_reports (
  id          SERIAL PRIMARY KEY,
  post_id     INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  comment_id  INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      VARCHAR(30) NOT NULL,
  note        VARCHAR(300),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CHECK ((post_id IS NULL) <> (comment_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_post_once    ON content_reports (post_id, reporter_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_comment_once ON content_reports (comment_id, reporter_id) WHERE comment_id IS NOT NULL;

-- ---------------------------------------------------------------- stories
CREATE TABLE IF NOT EXISTS stories (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  caption    VARCHAR(140),
  color      VARCHAR(9),
  item_id    INTEGER REFERENCES items(id) ON DELETE SET NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);
CREATE INDEX IF NOT EXISTS stories_live_idx ON stories (expires_at, user_id);

CREATE TABLE IF NOT EXISTS story_views (
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, user_id)
);

-- ---------------------------------------------------------------- selling: chat about a post
-- A buyer messages the seller about a "for sale" post the same way a renter
-- asks about a listing: one conversation per (post, buyer, seller).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_post_pair_key
  ON conversations (post_id, renter_id, owner_id) WHERE post_id IS NOT NULL;

-- Shared files include Word / Excel / PowerPoint, whose type names are long.
ALTER TABLE public_images ALTER COLUMN mime TYPE VARCHAR(120);

-- ---------------------------------------------------------------- notifications
-- Social notifications carry the link they open and who caused them.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link VARCHAR(200);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('booking_requested', 'booking_approved', 'booking_rejected',
                  'booking_cancelled', 'booking_completed',
                  'verification_approved', 'verification_rejected', 'verification_review',
                  'rental_due_soon', 'rental_overdue', 'rental_warning', 'rental_frozen',
                  'rental_missing', 'claim_opened', 'claim_update', 'incident',
                  'social_reaction', 'social_comment', 'social_reply', 'social_mention',
                  'social_follow', 'social_milestone', 'social_wanted', 'social_moderation'));
CREATE INDEX IF NOT EXISTS notifications_link_idx ON notifications (user_id, type, link) WHERE read_at IS NULL;

-- ---------------------------------------------------------------- interests
-- What each member is into, learned from what they do (see interests.js):
-- looking at, booking or listing a product in a category, and reacting,
-- commenting, saving, voting or reading in a community. Scores fade by 3% a
-- day, so the feed follows what someone likes NOW. "For you" ranks with it.
CREATE TABLE IF NOT EXISTS interests (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  score        REAL NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, community_id)
);
-- People who joined communities before interests existed start with them.
INSERT INTO interests (user_id, community_id, score)
SELECT user_id, community_id, 5 FROM community_members
ON CONFLICT (user_id, community_id) DO NOTHING;
