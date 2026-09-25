-- ============================================================
--  RentalFlow  |  Business  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
--  GitHub: @pritom702  |  Part: keeping deals on-platform, credits, fees, ads
-- ============================================================
-- Raw SQL, no ORM. Safe to run again and again (npm run db:migrate).
--
--   chat guard     contact details stay hidden until a deal is on RentalFlow
--   sale deals     a buyer's offer on a "for sale" post, accepted in the chat
--   Limes          RentalFlow's credits: earned by doing things on the
--                  platform, bought in packs, spent on boosts and ads.
--                  Spend-only — they can never be cashed out.
--   booking fees   the platform's cut of every rental, kept per booking
--   ads            members promote their videos and posts with Limes

-- ---------------------------------------------------------------- chat guard
-- body = what the other person sees while the chat is locked (masked);
-- raw_body = what was typed, shown to both once the deal is on the platform.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS raw_body TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS guard_flags TEXT[] NOT NULL DEFAULT '{}';
-- How often someone tried to take a deal off the platform (for trust + admins).
ALTER TABLE users ADD COLUMN IF NOT EXISTS offplatform_flags INTEGER NOT NULL DEFAULT 0;
-- System lines in a chat ("Offer accepted", "Contact details are now visible").
ALTER TABLE messages ADD COLUMN IF NOT EXISTS kind VARCHAR(12) NOT NULL DEFAULT 'text';

-- ---------------------------------------------------------------- sale deals
CREATE TABLE IF NOT EXISTS sale_deals (
  id              SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  post_id         INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  buyer_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price           INTEGER NOT NULL CHECK (price > 0),
  platform_fee    INTEGER NOT NULL DEFAULT 0,
  status          VARCHAR(12) NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'declined', 'completed', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sale_deals_convo_idx ON sale_deals (conversation_id);

-- ---------------------------------------------------------------- Limes (credits)
CREATE TABLE IF NOT EXISTS credit_wallets (
  user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance         INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  earned          INTEGER NOT NULL DEFAULT 0,
  bought          INTEGER NOT NULL DEFAULT 0,
  spent           INTEGER NOT NULL DEFAULT 0,
  referral_code   VARCHAR(16) UNIQUE,
  referred_by     INTEGER REFERENCES users(id) ON DELETE SET NULL
);
-- Every change to a balance, with why — the wallet is the sum of this.
CREATE TABLE IF NOT EXISTS credit_ledger (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta      INTEGER NOT NULL,
  reason     VARCHAR(40) NOT NULL,
  note       VARCHAR(160),
  ref        VARCHAR(60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS credit_ledger_user_idx ON credit_ledger (user_id, created_at DESC);
-- One-off rewards are paid once per (user, reason, ref).
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_once ON credit_ledger (user_id, reason, ref) WHERE ref IS NOT NULL;

-- Buying Limes with money (a payment gateway; a test checkout without one).
CREATE TABLE IF NOT EXISTS credit_orders (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack        VARCHAR(20) NOT NULL,
  credits     INTEGER NOT NULL,
  amount_bdt  INTEGER NOT NULL,
  provider    VARCHAR(20) NOT NULL,          -- 'sslcommerz' | 'test'
  tran_id     VARCHAR(60) UNIQUE NOT NULL,
  status      VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at     TIMESTAMPTZ
);

-- Boosts bought with Limes: a post lifted in the feed, a listing featured on
-- Browse, a "wanted" request highlighted.
CREATE TABLE IF NOT EXISTS boosts (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       VARCHAR(12) NOT NULL CHECK (kind IN ('post', 'item')),
  target_id  INTEGER NOT NULL,
  credits    INTEGER NOT NULL,
  starts_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at    TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS boosts_live_idx ON boosts (kind, target_id, ends_at);

-- ---------------------------------------------------------------- booking fees
-- Kept per booking when it is requested; counted as revenue once completed.
CREATE TABLE IF NOT EXISTS booking_fees (
  booking_id     INTEGER PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  rental_total   INTEGER NOT NULL,
  renter_fee     INTEGER NOT NULL,     -- service fee added for the renter
  owner_fee      INTEGER NOT NULL,     -- commission taken from the owner's payout
  protection_fee INTEGER NOT NULL DEFAULT 0,   -- optional damage protection
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------- ads
-- A member promotes a post (usually a video from the studio) with a budget in
-- Limes. It is shown between posts in the feed and between videos in Flows,
-- marked "Sponsored"; every view costs a little of the budget.
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id      INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  budget       INTEGER NOT NULL CHECK (budget > 0),
  spent        INTEGER NOT NULL DEFAULT 0,
  impressions  INTEGER NOT NULL DEFAULT 0,
  clicks       INTEGER NOT NULL DEFAULT 0,
  status       VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'finished')),
  headline     VARCHAR(80),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ad_campaigns_live_idx ON ad_campaigns (status) WHERE status = 'active';
-- One view / click per person per ad per day is counted (no double charging).
CREATE TABLE IF NOT EXISTS ad_events (
  campaign_id INTEGER NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  viewer      VARCHAR(40) NOT NULL,       -- user id, or an anonymous browser id
  kind        VARCHAR(10) NOT NULL CHECK (kind IN ('view', 'click')),
  day         DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (campaign_id, viewer, kind, day)
);

-- ---------------------------------------------------------------- notifications
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('booking_requested', 'booking_approved', 'booking_rejected',
                  'booking_cancelled', 'booking_completed',
                  'verification_approved', 'verification_rejected', 'verification_review',
                  'rental_due_soon', 'rental_overdue', 'rental_warning', 'rental_frozen',
                  'rental_missing', 'claim_opened', 'claim_update', 'incident',
                  'social_reaction', 'social_comment', 'social_reply', 'social_mention',
                  'social_follow', 'social_milestone', 'social_wanted', 'social_moderation',
                  'credits', 'deal', 'ad'));
