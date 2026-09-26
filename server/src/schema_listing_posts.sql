-- ============================================================
--  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
--  GitHub: @pritom702  |  Part: rental listings in the feed
-- ============================================================
-- Each listing for rent gets one 'rent' post (see listingPosts.js). This adds
-- the kind, keeps it to one post per listing, and posts the listings that
-- were already there, dated when each was listed.

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_kind_check;
ALTER TABLE posts ADD CONSTRAINT posts_kind_check
  CHECK (kind IN ('post', 'showcase', 'question', 'guide', 'wanted', 'poll', 'sell', 'rent'));

CREATE UNIQUE INDEX IF NOT EXISTS posts_one_per_listing ON posts (item_id) WHERE kind = 'rent';

INSERT INTO posts (community_id, author_id, kind, body, attachments, item_id, created_at)
SELECT c.id, i.owner_id, 'rent',
       CASE WHEN COALESCE(TRIM(i.description), '') = '' THEN i.name || ' is now for rent.'
            WHEN LENGTH(i.description) > 280 THEN LEFT(REGEXP_REPLACE(i.description, '\s+', ' ', 'g'), 279) || '…'
            ELSE REGEXP_REPLACE(i.description, '\s+', ' ', 'g') END,
       COALESCE((SELECT json_agg(json_build_object('type', 'image', 'url', im.url, 'mime', 'image/jpeg', 'name', '', 'size', 0)
                                 ORDER BY im.position, im.id)
                   FROM (SELECT * FROM item_images WHERE item_id = i.id ORDER BY position, id LIMIT 4) im), '[]')::jsonb,
       i.id, i.created_at
  FROM items i
  JOIN communities c ON c.category_id = i.category_id
 WHERE i.status <> 'Retired'
   AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.kind = 'rent' AND p.item_id = i.id);

-- A listing deleted outside the app leaves its post without a listing.
DELETE FROM posts WHERE kind = 'rent' AND item_id IS NULL;

UPDATE communities c SET post_count = (SELECT COUNT(*) FROM posts p WHERE p.community_id = c.id AND p.status = 'visible');
