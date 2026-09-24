// ============================================================
//  RentalFlow  |  Messaging  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: chat between renters and listers
// ============================================================
//   GET  /api/messages/unread                   → { count } (for the nav badge)
//   GET  /api/messages/conversations            → my conversations, newest first
//   POST /api/messages/conversations            { item_id } → open (or reuse) a chat with its lister
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
    `SELECT c.id, c.item_id, c.last_message_at, c.created_at,
            i.name AS item_name,
            (SELECT url FROM item_images WHERE item_id = c.item_id ORDER BY position, id LIMIT 1) AS item_cover,
            other.id AS other_id, other.name AS other_name,
            (c.owner_id = $1) AS i_am_owner,
            last.body AS last_body, last.sender_id AS last_sender_id,
            (SELECT COUNT(*)::int FROM messages m
              WHERE m.conversation_id = c.id AND m.sender_id <> $1 AND m.read_at IS NULL) AS unread
       FROM conversations c
       LEFT JOIN items i ON i.id = c.item_id
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
  const { rows: msgs } = await query(
    `SELECT id, sender_id, body, created_at, read_at FROM messages
      WHERE conversation_id = $1 AND id > $2
      ORDER BY id LIMIT 200`,
    [convo.id, after]
  );
  const { rows: meta } = await query(
    `SELECT i.id AS item_id, i.name AS item_name, i.rental_price, i.status AS item_status,
            (SELECT url FROM item_images WHERE item_id = i.id ORDER BY position, id LIMIT 1) AS item_cover,
            other.id AS other_id, other.name AS other_name
       FROM conversations c
       LEFT JOIN items i ON i.id = c.item_id
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
  res.json({
    id: convo.id, iAmOwner: convo.owner_id === req.user.id, ...meta[0],
    seenUpTo: seen[0].seen_up_to, messages: msgs,
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
  const { rows } = await query(
    `INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3)
     RETURNING id, sender_id, body, created_at, read_at`,
    [convo.id, req.user.id, body]
  );
  await query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [convo.id]);
  res.status(201).json(rows[0]);
});

export default router;
