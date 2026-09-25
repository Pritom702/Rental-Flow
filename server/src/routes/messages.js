// ============================================================
//  RentalFlow  |  Messaging  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: chat between renters and listers
// ============================================================
//   GET  /api/messages/unread                   → { count } (for the nav badge)
//   GET  /api/messages/conversations            → my conversations, newest first
//   POST /api/messages/conversations            { item_id } → open (or reuse) a chat with its lister
//                                               { post_id } → ...or with the seller of a "for sale" post
//   GET  /api/messages/conversations/:id        ?after=<message id> → messages; marks theirs read
//   POST /api/messages/conversations/:id        { body } → send
//
// Privacy: every query is scoped to the caller being one of the two people in
// the conversation. Anyone else — including admins — gets a 404, not a 403, so
// the API does not even reveal that the conversation exists.
//
// The phone polls for new messages every few seconds (a serverless host cannot
// hold a socket open), asking only for messages newer than the last one it has.
import { Router } from 'express';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { guardMessage, guardNote } from '../contactGuard.js';

const router = Router();
router.use(authRequired);

export const MAX_MESSAGE = 2000;

// The conversation, if the caller takes part in it.
async function mine(conversationId, userId) {
  const { rows } = await query(
    `SELECT * FROM conversations WHERE id = $1 AND (renter_id = $2 OR owner_id = $2)`,
    [conversationId, userId]
  );
  return rows[0] || null;
}

// Keeping deals on RentalFlow: until the deal is on the platform — a booking
// approved for this item, or an offer accepted on this sale — the chat is
// "locked" and contact details are covered up (see contactGuard.js).
export async function chatUnlocked(convo) {
  if (convo.item_id) {
    const { rows } = await query(
      `SELECT 1 FROM bookings WHERE item_id = $1 AND renter_id = $2 AND status IN ('Approved', 'Completed') LIMIT 1`,
      [convo.item_id, convo.renter_id]);
    return rows.length > 0;
  }
  if (convo.post_id) {
    const { rows } = await query(
      `SELECT 1 FROM sale_deals WHERE conversation_id = $1 AND status IN ('accepted', 'completed') LIMIT 1`, [convo.id]);
    return rows.length > 0;
  }
  return false;
}

router.get('/unread', async (req, res) => {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count
       FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE (c.renter_id = $1 OR c.owner_id = $1)
        AND m.sender_id <> $1 AND m.read_at IS NULL`,
    [req.user.id]
  );
  res.json(rows[0]);
});

router.get('/conversations', async (req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.item_id, c.post_id, c.last_message_at, c.created_at,
            COALESCE(i.name, CASE WHEN p.id IS NOT NULL THEN 'For sale · ' || LEFT(p.body, 50) END) AS item_name,
            COALESCE((SELECT url FROM item_images WHERE item_id = c.item_id ORDER BY position, id LIMIT 1),
                     (SELECT a->>'url' FROM jsonb_array_elements(p.attachments) a WHERE a->>'type' = 'image' LIMIT 1)) AS item_cover,
            other.id AS other_id, other.name AS other_name,
            (c.owner_id = $1) AS i_am_owner,
            last.body AS last_body, last.sender_id AS last_sender_id,
            (SELECT COUNT(*)::int FROM messages m
              WHERE m.conversation_id = c.id AND m.sender_id <> $1 AND m.read_at IS NULL) AS unread
       FROM conversations c
       LEFT JOIN items i ON i.id = c.item_id
       LEFT JOIN posts p ON p.id = c.post_id
       JOIN users other ON other.id = CASE WHEN c.owner_id = $1 THEN c.renter_id ELSE c.owner_id END
       LEFT JOIN LATERAL (
         SELECT body, sender_id FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1
       ) last ON TRUE
      WHERE c.renter_id = $1 OR c.owner_id = $1
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
    [req.user.id]
  );
  res.json(rows);
});

// Open the chat about an item with the person who listed it. Asking again
// returns the same conversation instead of starting a new one.
router.post('/conversations', async (req, res) => {
  if (req.body.post_id) return openAboutPost(req, res);
  const itemId = Number(req.body.item_id);
  const { rows: items } = await query('SELECT id, owner_id FROM items WHERE id = $1', [itemId]);
  const item = items[0];
  if (!item) return res.status(404).json({ error: 'That listing no longer exists.' });
  if (item.owner_id === req.user.id) {
    return res.status(400).json({ error: 'This is your own listing.' });
  }
  const { rows } = await query(
    `INSERT INTO conversations (item_id, renter_id, owner_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (item_id, renter_id, owner_id) WHERE item_id IS NOT NULL
     DO UPDATE SET item_id = EXCLUDED.item_id
     RETURNING id`,
    [item.id, req.user.id, item.owner_id]
  );
  res.status(201).json({ id: rows[0].id });
});

// A buyer writing to the seller of a "for sale" community post.
async function openAboutPost(req, res) {
  const { rows: [post] } = await query(
    `SELECT id, author_id, sale FROM posts WHERE id = $1 AND kind = 'sell' AND status = 'visible'`, [Number(req.body.post_id)]);
  if (!post) return res.status(404).json({ error: 'That item is no longer for sale.' });
  if (post.author_id === req.user.id) return res.status(400).json({ error: 'This is your own post.' });
  const { rows } = await query(
    `INSERT INTO conversations (post_id, renter_id, owner_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (post_id, renter_id, owner_id) WHERE post_id IS NOT NULL
     DO UPDATE SET post_id = EXCLUDED.post_id
     RETURNING id`,
    [post.id, req.user.id, post.author_id]
  );
  res.status(201).json({ id: rows[0].id });
}

router.get('/conversations/:id', async (req, res) => {
  const convo = await mine(req.params.id, req.user.id);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  const after = Number(req.query.after) || 0;

  // Opening a conversation reads everything the other person sent.
  await query(
    `UPDATE messages SET read_at = NOW()
      WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL`,
    [convo.id, req.user.id]
  );
  const unlocked = await chatUnlocked(convo);
  const { rows: msgs } = await query(
    `SELECT id, sender_id, kind, guard_flags,
            ${unlocked ? 'COALESCE(raw_body, body)' : 'body'} AS body, created_at, read_at FROM messages
      WHERE conversation_id = $1 AND id > $2
      ORDER BY id LIMIT 200`,
    [convo.id, after]
  );
  const { rows: meta } = await query(
    `SELECT i.id AS item_id, i.name AS item_name, i.rental_price, i.status AS item_status,
            (SELECT url FROM item_images WHERE item_id = i.id ORDER BY position, id LIMIT 1) AS item_cover,
            p.id AS post_id, LEFT(p.body, 80) AS post_title, p.sale,
            (SELECT a->>'url' FROM jsonb_array_elements(p.attachments) a WHERE a->>'type' = 'image' LIMIT 1) AS post_cover,
            other.id AS other_id, other.name AS other_name
       FROM conversations c
       LEFT JOIN items i ON i.id = c.item_id
       LEFT JOIN posts p ON p.id = c.post_id
       JOIN users other ON other.id = CASE WHEN c.owner_id = $2 THEN c.renter_id ELSE c.owner_id END
      WHERE c.id = $1`,
    [convo.id, req.user.id]
  );
  // How far the other person has read. Polling only fetches NEW messages, so
  // this is how an already-shown message learns it has been seen.
  const { rows: seen } = await query(
    `SELECT COALESCE(MAX(id), 0) AS seen_up_to FROM messages
      WHERE conversation_id = $1 AND sender_id = $2 AND read_at IS NOT NULL`,
    [convo.id, req.user.id]
  );
  const { rows: [deal] } = convo.post_id
    ? await query(`SELECT * FROM sale_deals WHERE conversation_id = $1 ORDER BY id DESC LIMIT 1`, [convo.id])
    : { rows: [] };
  res.json({
    id: convo.id, iAmOwner: convo.owner_id === req.user.id, ...meta[0],
    seenUpTo: seen[0].seen_up_to, messages: msgs,
    unlocked, deal: deal || null,
  });
});

router.post('/conversations/:id', async (req, res) => {
  const convo = await mine(req.params.id, req.user.id);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  const body = String(req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Type a message first.' });
  if (body.length > MAX_MESSAGE) {
    return res.status(400).json({ error: `Messages can be at most ${MAX_MESSAGE} characters.` });
  }
  // A locked chat stores the covered-up text for the other person and keeps
  // what was typed, shown to both once the deal is on RentalFlow.
  const unlocked = await chatUnlocked(convo);
  const g = unlocked ? { text: body, flags: [], hits: 0 } : guardMessage(body);
  const { rows } = await query(
    `INSERT INTO messages (conversation_id, sender_id, body, raw_body, guard_flags) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, sender_id, kind, guard_flags, body, created_at, read_at`,
    [convo.id, req.user.id, g.text, g.flags.length ? body : null, g.flags]
  );
  if (g.flags.length) {
    await query('UPDATE users SET offplatform_flags = offplatform_flags + $2 WHERE id = $1',
      [req.user.id, g.flags.includes('outside') || g.flags.includes('wallet') ? 2 : 1]);
  }
  await query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [convo.id]);
  res.status(201).json({ ...rows[0], guardNote: guardNote(g.flags) });
});

export default router;
