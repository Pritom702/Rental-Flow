// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: new rental listings appear in the feed
// ============================================================
// A listing for rent lives in the items table, the feed shows posts. So each
// listing gets one "For rent" post (kind 'rent') in its category's community,
// written by its owner: the listing's photos, a short description and the
// listing card with its price and a Rent it button. It can be reacted to and
// replied to like any post, and it follows the listing when it is edited or
// deleted. Sell posts are already posts, so they need nothing extra.
import { query } from './db.js';

const BODY_MAX = 280;

function bodyFor(item) {
  const text = String(item.description || '').replace(/\s+/g, ' ').trim();
  if (!text) return `${item.name} is now for rent.`;
  return text.length > BODY_MAX ? `${text.slice(0, BODY_MAX - 1)}…` : text;
}

async function listingFor(itemId) {
  const { rows: [item] } = await query(
    `SELECT i.id, i.owner_id, i.name, i.description, i.status, i.review_status, c.id AS community_id
       FROM items i LEFT JOIN communities c ON c.category_id = i.category_id
      WHERE i.id = $1`,
    [itemId]
  );
  if (!item) return null;
  const { rows: pics } = await query(
    'SELECT url FROM item_images WHERE item_id = $1 ORDER BY position, id LIMIT 4', [itemId]);
  item.attachments = pics.map((p) => ({ type: 'image', url: p.url, mime: 'image/jpeg', name: '', size: 0 }));
  return item;
}

// Create the listing's post, or bring it up to date after an edit. Never
// throws: the listing itself is already saved and must not fail because of
// the feed.
export async function syncListingPost(itemId) {
  try {
    const item = await listingFor(itemId);
    if (!item) return;
    const { rows: [post] } = await query(`SELECT id FROM posts WHERE kind = 'rent' AND item_id = $1`, [itemId]);
    if (post) {
      await query(
        `UPDATE posts SET body = $2, attachments = $3,
                community_id = COALESCE($4, community_id),
                status = CASE WHEN $5 = 'Retired' THEN 'hidden' WHEN status = 'hidden' THEN 'visible' ELSE status END
          WHERE id = $1 AND status <> 'removed'`,
        [post.id, bodyFor(item), JSON.stringify(item.attachments), item.community_id, item.status]
      );
      return;
    }
    if (!item.community_id || item.status === 'Retired') return;   // no category, nowhere to show it
    if (item.review_status !== 'approved') return;                   // waits for the admin's check
    await query(
      `INSERT INTO posts (community_id, author_id, kind, body, attachments, item_id)
       VALUES ($1, $2, 'rent', $3, $4, $5)`,
      [item.community_id, item.owner_id, bodyFor(item), JSON.stringify(item.attachments), item.id]
    );
    await query('UPDATE communities SET post_count = post_count + 1 WHERE id = $1', [item.community_id]);
    await joinCommunity(item.owner_id, item.community_id);
  } catch (e) {
    console.error('Could not post the listing to the feed:', e.message);
  }
}

// Listing (or selling) something in a category makes you a member of that
// category's community, so it shows up in your communities and feed.
export async function joinCommunity(userId, communityId) {
  if (!userId || !communityId) return;
  const { rowCount } = await query(
    'INSERT INTO community_members (community_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [communityId, userId]);
  if (rowCount) await query('UPDATE communities SET member_count = member_count + 1 WHERE id = $1', [communityId]);
}

// Before a listing is deleted: its post goes too.
export async function removeListingPost(itemId) {
  await query(`DELETE FROM posts WHERE kind = 'rent' AND item_id = $1`, [itemId]);
}
