// ============================================================
//  RentalFlow  |  Business  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: choosing which sponsored posts to show
// ============================================================
// A campaign with budget left is eligible. Each page of the feed (and each
// batch of Flows) gets up to two of them, picked at random so every advertiser
// gets a fair share, never the viewer's own ads. Views and clicks are counted
// in routes/market.js.
import { query } from './db.js';

export async function pickAds(viewerId, count = 2, { videosOnly = false } = {}) {
  const { rows } = await query(
    `SELECT a.id, a.post_id, a.headline FROM ad_campaigns a JOIN posts p ON p.id = a.post_id
      WHERE a.status = 'active' AND a.spent < a.budget AND p.status = 'visible'
        AND ($1::int IS NULL OR a.user_id <> $1)
        ${videosOnly ? `AND p.attachments @> '[{"type":"video"}]'` : ''}
      ORDER BY RANDOM() LIMIT $2`,
    [viewerId || null, count]);
  return rows;
}
