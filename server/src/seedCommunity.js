// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: demo content for the communities
// ============================================================
// Usage: npm run db:seed-community        (needs BLOB_READ_WRITE_TOKEN for the videos)
//
// Fills the communities with demo posts so the feed is not empty in a demo:
// four demo members (…@rentalflow.test, password member123) plus Rahim and
// Karim post photos, short videos, a guide, questions, polls, a "wanted"
// request and things for sale, comment on each other, react, follow and share
// moments. The photos are the listings' own product photos; the videos were
// made from them (see demo-community/).
//
// Safe to run again: it first removes the content it created last time (the
// demo members' posts and the seeded posts by Rahim and Karim) and puts fresh
// copies back. Nobody else's posts are touched.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { put } from '@vercel/blob';
import { pool, query } from './db.js';
import { parseHashtags, levelFor } from './socialUtils.js';
import { fetchPreview } from './linkPreview.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, 'demo-community');

const DEMO_PEOPLE = [
  { key: 'nusrat', name: 'Nusrat Jahan', email: 'nusrat@rentalflow.test', handle: 'nusratshoots', bio: 'Wedding & street photographer. I rent before I buy 📸', xp: 620, streak: 12 },
  { key: 'tanvir', name: 'Tanvir Ahmed', email: 'tanvir@rentalflow.test', handle: 'tanvirflies', bio: 'Drones, sunsets and long rides 🚁', xp: 380, streak: 5 },
  { key: 'farhan', name: 'Farhan Kabir', email: 'farhan@rentalflow.test', handle: 'farhanplays', bio: 'Weekend gamer. Host of the best game nights in Dhanmondi 🎮', xp: 240, streak: 3 },
  { key: 'maliha', name: 'Maliha Chowdhury', email: 'maliha@rentalflow.test', handle: 'malihamakes', bio: 'Home baker and event planner 🎂', xp: 160, streak: 2 },
];

// Posts: hours ago, author, community, kind, text, media, tagged listing, extras.
const POSTS = [
  { k: 'a7', h: 3, by: 'nusrat', c: 'cameras', kind: 'showcase', video: 'a7iii', item: 4,
    body: 'Took Karim\'s Sony A7 III out for a street walk in Old Dhaka 📸 The eye-AF is unreal — I did not miss a single shot. #sony #streetphotography' },
  { k: 'drone', h: 5, by: 'tanvir', c: 'drones', kind: 'showcase', video: 'drone', item: 45,
    body: 'Pocket drone, big views. Flew the DJI Mini 4 Pro over Hatirjheel at sunset 🚁 Rented it for two days and I am already planning the next trip. #drone #dhaka' },
  { k: 'game', h: 8, by: 'farhan', c: 'gaming-consoles', kind: 'showcase', video: 'gamenight', item: 44,
    body: 'Friday game night sorted 🎮 Rented a PS5 and a Switch for less than one pizza each. Who is in for FC 25? #gamenight' },
  { k: 'bike', h: 20, by: 'rahim', c: 'camping-outdoor', kind: 'showcase', video: 'bike', item: 28,
    body: 'Took the Hunter 350 out to Gazipur this weekend. Light, smooth, and that thump 😍 #roadtrip' },
  { k: 'guide', h: 26, by: 'nusrat', c: 'cameras', kind: 'guide', image: 'r6', item: 1,
    body: 'Guide: shooting a wedding with a rented camera 📘\n\n1. Rent it two days early and learn the menus at home.\n2. Carry two batteries and two memory cards.\n3. Switch to the silent shutter during the vows.\n4. Back up every card the same night.\n\nThe Canon R6 handles dim community-centre lighting really well. #wedding #tips' },
  { k: 'poll', h: 12, by: 'karim', c: 'cameras', kind: 'poll',
    body: 'Renting for a friend\'s holud next month — which body would you pick?',
    poll: ['Sony A7 III', 'Canon EOS R6', 'Sony α7R IV'], votes: { nusrat: 1, tanvir: 0, farhan: 0, maliha: 1, rahim: 1 } },
  { k: 'sherwani', h: 30, by: 'maliha', c: 'event-party', kind: 'showcase', image: 'sherwani', item: 20,
    body: 'Found the perfect sherwani for my brother\'s wedding right here 🤍 Fits like it was tailored for him. #wedding' },
  { k: 'mixer', h: 14, by: 'maliha', c: 'home-appliances', kind: 'question', image: 'mixer', item: 48,
    body: 'Has anyone rented the KitchenAid mixer? Is it strong enough for a one-time cake order — about 3 kg of dough? 🎂' },
  { k: 'drill', h: 40, by: 'karim', c: 'power-tools', kind: 'guide', image: 'drill', item: 5,
    body: 'Tip for hanging shelves on a concrete wall 🔧 Put the DeWalt on hammer mode with a 6 mm masonry bit, and stick masking tape where you drill so the plaster does not crack. #diy' },
  { k: 'iphone', h: 6, by: 'farhan', c: 'phones', kind: 'sell', image: 'iphone',
    sale: { price: 98000, condition: 'like_new', negotiable: true },
    body: 'Selling my iPhone 15 Pro, 256 GB. Battery health 94%, always in a case, box and cable included. Meet-up in Dhanmondi.' },
  { k: 'switch', h: 18, by: 'tanvir', c: 'gaming-consoles', kind: 'sell', image: 'switch',
    sale: { price: 32000, condition: 'good', negotiable: true },
    body: 'Selling my Nintendo Switch OLED — barely used, comes with Mario Kart 8 and the dock. #nintendo' },
  { k: 'wanted', h: 4, by: 'rahim', c: 'projectors-screens', kind: 'wanted',
    wanted: { budget: 1500, area: 'Mohammadpur' },
    body: 'Looking for a projector and a screen for a rooftop movie night this Friday 🎬 Anyone near Mohammadpur?' },
  { k: 'link', h: 50, by: 'nusrat', c: 'cameras', kind: 'post', link: 'https://www.dpreview.com',
    body: 'Before buying your first mirrorless camera: read the reviews here, then RENT the two you like for a weekend each. You will know in one shoot. 👇' },
  { k: 'noflight', h: 36, by: 'tanvir', c: 'drones', kind: 'question',
    body: 'First time flying in Dhaka — what should I know before I take the drone up? Any areas to avoid?' },
  { k: 'a7r', h: 44, by: 'karim', c: 'cameras', kind: 'showcase', image: 'a7r4', item: 47,
    body: 'Just added the Sony α7R IV with the Zeiss 55mm to my listings. 61 MP — perfect for product shoots and portraits ✨' },
  { k: 'bikephoto', h: 58, by: 'tanvir', c: 'camping-outdoor', kind: 'post', image: 'bike',
    body: 'Who else is doing a Sreemangal ride this winter? Looking for two more riders 🏍️ #roadtrip' },
];

// Comments: [post key, author, text, reply-to index within that post or null]
const COMMENTS = [
  ['a7', 'karim', 'These came out so sharp! Glad the A7 III treated you well 🙌'],
  ['a7', 'maliha', 'The colours in the second frame 😍'],
  ['a7', 'nusrat', '@karimhasan thank you — I will be renting it again for a wedding next month!', 0],
  ['drone', 'farhan', 'That sunset shot is unreal. How long does the battery last?'],
  ['drone', 'tanvir', '@farhanplays about 30 minutes a battery — I rented it with two spares.', 0],
  ['drone', 'nusrat', 'Adding this to my wedding kit for aerial shots 👀'],
  ['game', 'rahim', 'Count me in! I will bring snacks 🍿'],
  ['game', 'tanvir', 'Mario Kart rematch please 😂'],
  ['bike', 'tanvir', 'Gazipur roads are perfect for it. Next time I am joining!'],
  ['guide', 'maliha', 'Saving this for my brother\'s wedding, thank you!'],
  ['guide', 'karim', 'Point 4 is the one people forget. Great guide.'],
  ['poll', 'nusrat', 'The R6 for low light at a holud, easily.'],
  ['poll', 'rahim', 'A7 III — the battery life is better for a long event.'],
  ['mixer', 'nusrat', 'I used it for my sister\'s birthday cake — it handled a big batch fine. Go slow on the dough hook.'],
  ['mixer', 'maliha', '@nusratshoots perfect, booking it now 🎂', 0],
  ['drill', 'rahim', 'The tape trick is genius 👌'],
  ['iphone', 'rahim', 'Is the price negotiable for cash?'],
  ['iphone', 'farhan', '@rahimuddin yes, message me!', 0],
  ['switch', 'farhan', 'Does it come with the original box?'],
  ['wanted', 'karim', 'The ViewSonic projector on here does 3,800 lumens — bright enough even before it is fully dark. Check it out 👍'],
  ['wanted', 'tanvir', 'Rooftop movie night sounds amazing, invite me 😄'],
  ['noflight', 'karim', 'Stay well away from the airport area and check the CAAB rules before you fly. Keep it low and within sight.'],
  ['a7r', 'nusrat', '61 MP for product shots is a dream. Booking it for a client next week!'],
];

// Reactions per post: who reacted with what.
const REACTIONS = {
  a7: { karim: 'spark', maliha: 'adore', tanvir: 'wow', farhan: 'want', rahim: 'want' },
  drone: { nusrat: 'want', farhan: 'wow', maliha: 'adore', rahim: 'spark', karim: 'wow' },
  game: { rahim: 'lol', tanvir: 'spark', nusrat: 'spark', maliha: 'lol' },
  bike: { tanvir: 'want', farhan: 'adore', karim: 'spark' },
  guide: { maliha: 'genius', karim: 'genius', tanvir: 'spark', rahim: 'genius', farhan: 'spark' },
  poll: { nusrat: 'spark', rahim: 'spark' },
  sherwani: { nusrat: 'adore', rahim: 'adore', farhan: 'spark' },
  mixer: { nusrat: 'spark' },
  drill: { rahim: 'genius', tanvir: 'genius' },
  iphone: { rahim: 'want', tanvir: 'wow' },
  switch: { farhan: 'want' },
  wanted: { karim: 'spark', tanvir: 'lol' },
  link: { tanvir: 'genius', karim: 'spark', maliha: 'genius' },
  noflight: { nusrat: 'spark' },
  a7r: { nusrat: 'want', tanvir: 'wow', maliha: 'adore' },
  bikephoto: { rahim: 'want' },
};

const FOLLOWS = [
  ['rahim', 'nusrat'], ['rahim', 'tanvir'], ['karim', 'nusrat'], ['nusrat', 'karim'], ['tanvir', 'nusrat'],
  ['farhan', 'tanvir'], ['maliha', 'nusrat'], ['maliha', 'farhan'], ['tanvir', 'rahim'], ['farhan', 'rahim'],
];
const JOINS = {
  nusrat: ['cameras', 'lenses', 'drones', 'event-party', 'lighting'],
  tanvir: ['drones', 'camping-outdoor', 'gaming-consoles', 'cameras'],
  farhan: ['gaming-consoles', 'phones', 'computers-laptops'],
  maliha: ['event-party', 'home-appliances', 'kitchen-appliances', 'cameras'],
  rahim: ['cameras', 'drones', 'camping-outdoor', 'projectors-screens'],
  karim: ['cameras', 'power-tools', 'gaming-consoles'],
};
const STORIES = [
  { by: 'nusrat', image: 'a7r4', caption: 'New lens day ✨', item: 47, h: 2 },
  { by: 'farhan', image: 'ps5', caption: 'Game night tonight 🎮', item: 44, h: 5 },
  { by: 'maliha', image: 'mixer', caption: 'Cake order done 🎂', item: 48, h: 7 },
  { by: 'tanvir', image: 'drone', caption: 'Golden hour flight', item: 45, h: 9 },
];
const BADGES = {
  nusrat: ['welcome', 'first_post', 'storyteller', 'chatty', 'crowd_fav', 'streak_3', 'streak_7', 'level_5', 'first_rental'],
  tanvir: ['welcome', 'first_post', 'first_sale', 'streak_3', 'first_rental', 'socialite'],
  farhan: ['welcome', 'first_post', 'first_rental', 'streak_3'],
  maliha: ['welcome', 'first_post', 'first_rental'],
};

const ago = (h) => new Date(Date.now() - h * 3600 * 1000);

async function storeImage(name) {
  const file = `s-demo-${name}.jpg`;
  await query(
    `INSERT INTO public_images (name, mime, data) VALUES ($1, 'image/jpeg', $2)
     ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data`,
    [file, fs.readFileSync(path.join(DIR, 'img', `${name}.jpg`))]);
  return `/api/community/files/${file}`;
}
async function storePoster(name) {
  const file = `s-demo-video-${name}.jpg`;
  await query(
    `INSERT INTO public_images (name, mime, data) VALUES ($1, 'image/jpeg', $2)
     ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data`,
    [file, fs.readFileSync(path.join(DIR, 'video', `${name}.jpg`))]);
  return `/api/community/files/${file}`;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is needed to upload the demo videos.');
  const hash = await bcrypt.hash('member123', 10);

  // ---------------------------------------------------------------- people
  const id = {};
  for (const p of DEMO_PEOPLE) {
    const { rows: [u] } = await query(
      `INSERT INTO users (name, email, password_hash, role, email_verified_at, verification_status, handle, bio)
       VALUES ($1, $2, $3, 'member', NOW(), 'unverified', $4, $5)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, handle = EXCLUDED.handle, bio = EXCLUDED.bio, status = 'active'
       RETURNING id`,
      [p.name, p.email, hash, p.handle, p.bio]);
    id[p.key] = u.id;
  }
  const { rows: team } = await query(`SELECT id, email FROM users WHERE email IN ('rahim@rentalflow.test', 'karim@rentalflow.test')`);
  id.rahim = team.find((u) => u.email.startsWith('rahim')).id;
  id.karim = team.find((u) => u.email.startsWith('karim')).id;
  // Rahim and Karim have community handles/rules like everyone else.
  await query(`UPDATE users SET community_rules_at = COALESCE(community_rules_at, NOW()) WHERE id = ANY($1)`, [Object.values(id)]);
  await query(`UPDATE users SET handle = 'rahimuddin' WHERE id = $1 AND handle IS NULL`, [id.rahim]);
  await query(`UPDATE users SET handle = 'karimhasan' WHERE id = $1 AND handle IS NULL`, [id.karim]);

  // ---------------------------------------------------------------- clear last run
  const demoIds = DEMO_PEOPLE.map((p) => id[p.key]);
  await query(`DELETE FROM posts WHERE author_id = ANY($1)`, [demoIds]);
  await query(`DELETE FROM posts WHERE author_id = ANY($1) AND body = ANY($2)`,
    [[id.rahim, id.karim], POSTS.filter((p) => p.by === 'rahim' || p.by === 'karim').map((p) => p.body)]);
  await query(`DELETE FROM stories WHERE user_id = ANY($1)`, [demoIds]);
  await query(`DELETE FROM follows WHERE follower_id = ANY($1) OR followee_id = ANY($1)`, [demoIds]);

  // ---------------------------------------------------------------- media
  const images = {};
  for (const f of fs.readdirSync(path.join(DIR, 'img'))) images[f.replace('.jpg', '')] = await storeImage(f.replace('.jpg', ''));
  const videos = {};
  for (const f of fs.readdirSync(path.join(DIR, 'video')).filter((x) => x.endsWith('.mp4'))) {
    const name = f.replace('.mp4', '');
    const owner = POSTS.find((p) => p.video === name);
    const blob = await put(`videos/u${id[owner.by]}-demo-${name}.mp4`, fs.readFileSync(path.join(DIR, 'video', f)), {
      access: 'public', contentType: 'video/mp4', addRandomSuffix: false, allowOverwrite: true,
    });
    videos[name] = { url: blob.url, poster: await storePoster(name) };
    console.log(`  video ${name} → ${blob.url}`);
  }

  // ---------------------------------------------------------------- communities + follows
  const { rows: comms } = await query('SELECT id, slug FROM communities');
  const cid = Object.fromEntries(comms.map((c) => [c.slug, c.id]));
  for (const [who, slugs] of Object.entries(JOINS)) {
    for (const s of slugs) {
      if (cid[s]) await query('INSERT INTO community_members (community_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [cid[s], id[who]]);
    }
  }
  for (const [a, b] of FOLLOWS) {
    await query('INSERT INTO follows (follower_id, followee_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [id[a], id[b], ago(60)]);
  }

  // ---------------------------------------------------------------- posts
  const postId = {};
  for (const p of POSTS) {
    if (!cid[p.c]) { console.log(`  skipped ${p.k}: no c/${p.c}`); continue; }
    const attachments = [];
    if (p.video) attachments.push({ type: 'video', url: videos[p.video].url, poster: videos[p.video].poster, mime: 'video/mp4', w: 720, h: 1280, duration: p.video === 'gamenight' ? 9 : 7, name: '' });
    if (p.image) attachments.push({ type: 'image', url: images[p.image], name: `${p.image}.jpg`, mime: 'image/jpeg' });
    let link = null;
    if (p.link) { try { link = await fetchPreview(p.link); } catch { link = { url: p.link, site: new URL(p.link).hostname, title: null }; } }
    const poll = p.poll ? { options: p.poll, counts: p.poll.map(() => 0), closes_at: new Date(Date.now() + 4 * 86400000).toISOString() } : null;
    const { rows: [row] } = await query(
      `INSERT INTO posts (community_id, author_id, kind, body, attachments, link, poll, wanted, sale, item_id, hashtags, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, (SELECT id FROM items WHERE id = $10), $11, $12) RETURNING id`,
      [cid[p.c], id[p.by], p.kind, p.body, JSON.stringify(attachments), link, poll,
        p.wanted ? { ...p.wanted, from: null, to: null } : null,
        p.sale ? { ...p.sale, sold: false } : null, p.item || null, parseHashtags(p.body), ago(p.h)]);
    postId[p.k] = row.id;

    if (p.votes) {
      const counts = p.poll.map(() => 0);
      for (const [who, opt] of Object.entries(p.votes)) {
        await query('INSERT INTO poll_votes (post_id, user_id, option_idx) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [row.id, id[who], opt]);
        counts[opt] += 1;
      }
      await query('UPDATE posts SET poll = $2 WHERE id = $1', [row.id, { ...poll, counts }]);
    }
  }

  // ---------------------------------------------------------------- reactions + comments
  for (const [k, who] of Object.entries(REACTIONS)) {
    if (!postId[k]) continue;
    for (const [person, type] of Object.entries(who)) {
      await query('INSERT INTO post_reactions (post_id, user_id, type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [postId[k], id[person], type]);
    }
  }
  const made = {};
  let step = 0;
  for (const [k, who, body, replyTo] of COMMENTS) {
    if (!postId[k]) continue;
    const post = POSTS.find((p) => p.k === k);
    made[k] = made[k] || [];
    const parent = replyTo != null ? made[k][replyTo] : null;
    step += 1;
    const { rows: [c] } = await query(
      `INSERT INTO comments (post_id, author_id, parent_id, body, like_count, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [postId[k], id[who], parent, body, step % 3, ago(Math.max(0.2, post.h - 0.3 - (step % 5) * 0.2))]);
    made[k].push(c.id);
  }
  await query(`UPDATE posts p SET
      reaction_count = (SELECT COUNT(*) FROM post_reactions r WHERE r.post_id = p.id),
      comment_count = (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.status = 'visible'),
      share_count = (p.id % 4)
    WHERE p.id = ANY($1)`, [Object.values(postId)]);

  // ---------------------------------------------------------------- moments
  for (const s of STORIES) {
    await query(
      `INSERT INTO stories (user_id, image_url, caption, item_id, view_count, created_at, expires_at)
       VALUES ($1, $2, $3, (SELECT id FROM items WHERE id = $4), $5, $6, $6::timestamptz + INTERVAL '24 hours')`,
      [id[s.by], images[s.image], s.caption, s.item, 3 + s.h, ago(s.h)]);
  }

  // ---------------------------------------------------------------- levels, streaks, badges
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
  for (const p of DEMO_PEOPLE) {
    const posts = POSTS.filter((x) => x.by === p.key).length;
    const karma = POSTS.filter((x) => x.by === p.key).reduce((n, x) => n + Object.keys(REACTIONS[x.k] || {}).length, 0);
    await query(
      `INSERT INTO user_stats (user_id, xp, karma, streak_days, best_streak, last_active_date, post_count, badges)
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET xp = EXCLUDED.xp, karma = EXCLUDED.karma, streak_days = EXCLUDED.streak_days,
         best_streak = GREATEST(user_stats.best_streak, EXCLUDED.best_streak), last_active_date = EXCLUDED.last_active_date,
         post_count = EXCLUDED.post_count, badges = EXCLUDED.badges`,
      [id[p.key], p.xp, karma, p.streak, today, posts, BADGES[p.key]]);
    console.log(`  ${p.name}: level ${levelFor(p.xp).level}, ${p.streak}-day streak`);
  }

  await query(`UPDATE communities c SET
      member_count = (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id),
      post_count = (SELECT COUNT(*) FROM posts p WHERE p.community_id = c.id AND p.status = 'visible')`);
  console.log(`✅ ${Object.keys(postId).length} posts, ${COMMENTS.length} comments, ${STORIES.length} moments, ${Object.keys(videos).length} videos`);
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Community demo failed:', err.message);
  process.exit(1);
});
