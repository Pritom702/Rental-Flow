// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: learning what each member is into
// ============================================================
// Every useful action nudges a member's interest in one community up. The
// feed's "For you" order reads these scores (routes/community.js), so someone
// who keeps looking at cameras and drones sees more of those — without having
// to join anything. A score fades by 3% a day, so interests can change.
import { query } from './db.js';

export const WEIGHTS = {
  view_item: 1, book: 6, list_item: 4,                 // marketplace
  read_post: 0.5, react: 1, comment: 2, save: 2, vote: 1, share: 2, join: 5, post: 3,
};
export const DECAY = 0.97;   // per day

// Add weight to (user, community). The community can be given directly, or
// found from a category, a listing or a post.
export async function noteInterest(userId, { communityId, categoryId, itemId, postId }, action) {
  const weight = WEIGHTS[action];
  if (!userId || !weight) return;
  let cid = communityId || null;
  if (!cid && postId) cid = (await query('SELECT community_id FROM posts WHERE id = $1', [postId])).rows[0]?.community_id;
  if (!cid && itemId) categoryId = (await query('SELECT category_id FROM items WHERE id = $1', [itemId])).rows[0]?.category_id;
  if (!cid && categoryId) cid = (await query('SELECT id FROM communities WHERE category_id = $1', [categoryId])).rows[0]?.id;
  if (!cid) return;
  await query(
    `INSERT INTO interests (user_id, community_id, score) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, community_id) DO UPDATE
       SET score = LEAST(200, interests.score * POWER($4::float, EXTRACT(EPOCH FROM (NOW() - interests.updated_at)) / 86400) + $3),
           updated_at = NOW()`,
    [userId, cid, weight, DECAY]);
}

// The same, never failing and never slowing the request down.
export function noteInterestLater(userId, target, action) {
  noteInterest(userId, target, action).catch((err) => console.error('Interest note failed:', err.message));
}

// Marketplace requests that tell us something about a member's interests.
export function interestFromRequest(userId, method, path, req, body) {
  let m;
  if (method === 'GET' && (m = path.match(/^\/items\/(\d+)$/))) noteInterestLater(userId, { itemId: Number(m[1]) }, 'view_item');
  else if (method === 'POST' && path === '/bookings') noteInterestLater(userId, { itemId: Number(req.body?.item_id) }, 'book');
  else if (method === 'POST' && path === '/items') noteInterestLater(userId, { categoryId: Number(body?.category_id || req.body?.category_id) }, 'list_item');
}

// SQL: the viewer's current (faded) interest in a post's community.
export const interestSql = (param) => `COALESCE((SELECT i.score * POWER(${DECAY}, EXTRACT(EPOCH FROM (NOW() - i.updated_at)) / 86400)
  FROM interests i WHERE i.user_id = ${param} AND i.community_id = p.community_id), 0)`;
