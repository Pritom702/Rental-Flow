// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: pure helpers for the social layer + rewards
// ============================================================
// No database, no network: everything here is a plain function so it can be
// unit-tested (socialUtils.test.js) and reused by the routes.

// ---------------------------------------------------------------- text
export function slugify(name = '') {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'community';
}

// "#DSLR tips for #weddings" → ['dslr', 'weddings'] (unique, max 10, 2–30 chars)
export function parseHashtags(text = '') {
  const out = new Set();
  for (const m of String(text).matchAll(/(^|[^\w&])#([a-zA-Z][a-zA-Z0-9_]{1,29})\b/g)) {
    out.add(m[2].toLowerCase());
    if (out.size >= 10) break;
  }
  return [...out];
}

// "thanks @rahimuddin and @Karim" → ['rahimuddin', 'karim'] (unique, max 10)
export function parseMentions(text = '') {
  const out = new Set();
  for (const m of String(text).matchAll(/(^|[^\w@])@([a-zA-Z0-9_]{2,32})\b/g)) {
    out.add(m[2].toLowerCase());
    if (out.size >= 10) break;
  }
  return [...out];
}

// A handle from a display name: "Rahim Uddin" → "rahimuddin".
export function handleFromName(name = '') {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'member';
}

// ---------------------------------------------------------------- ranking
// "Hot": engagement divided by age, so a new post with a few reactions can
// beat an old one with many. Comments count double (they take more effort).
export function hotScore(reactions, comments, ageHours) {
  const engagement = Number(reactions || 0) + 2 * Number(comments || 0) + 1;
  return engagement / (Math.max(0, Number(ageHours) || 0) + 2) ** 1.5;
}
// The same formula in SQL, for ORDER BY on the feed.
export const HOT_SQL = `((p.reaction_count + 2 * p.comment_count + 1)
  / POWER(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 + 2, 1.5))`;

// ---------------------------------------------------------------- levels
// Early levels come quickly (the first one after a couple of actions), later
// ones take real contribution. XP needed to REACH level L:
//   20·(L−1)² + 30·(L−1)  →  L2 50 · L3 140 · L4 270 · L5 440 · L10 1890
export function xpForLevel(level) {
  const n = Math.max(0, level - 1);
  return 20 * n * n + 30 * n;
}
export const LEVEL_NAMES = ['Newcomer', 'Explorer', 'Regular', 'Local', 'Trusted', 'Insider', 'Pro', 'Expert', 'Legend', 'Icon'];
export function levelFor(xp = 0) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    name: LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1],
    floor,
    next,
    progress: Math.min(1, (xp - floor) / (next - floor)),
  };
}

// ---------------------------------------------------------------- streaks
// Days are counted in Bangladesh time, where the members are.
export function localDate(d = new Date(), timeZone = 'Asia/Dhaka') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function dayBefore(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
// Visiting on consecutive days grows the streak; missing a day resets it to 1.
export function nextStreak(lastDate, today, streak = 0) {
  const last = lastDate ? String(lastDate).slice(0, 10) : null;
  if (last === today) return { streak: Math.max(1, streak), changed: false };
  if (last && last === dayBefore(today)) return { streak: streak + 1, changed: true };
  return { streak: 1, changed: true };
}

// ---------------------------------------------------------------- rewards
// XP per action, with a daily cap on how often it pays (so it cannot be
// farmed), and the words the little "+XP" toast shows.
export const REWARDS = {
  daily_visit:       { xp: 5,   cap: 1,   label: 'Daily check-in' },
  email_verified:    { xp: 25,  cap: 1,   label: 'Email confirmed' },
  verify_identity:   { xp: 100, cap: 1,   label: 'Identity verified' },
  profile_update:    { xp: 5,   cap: 1,   label: 'Profile updated' },
  view_item:         { xp: 1,   cap: 10,  label: 'Explored a listing' },
  list_item:         { xp: 40,  cap: 5,   label: 'Listed an item' },
  edit_item:         { xp: 2,   cap: 5,   label: 'Listing polished' },
  book:              { xp: 20,  cap: 5,   label: 'Booking requested' },
  approve_booking:   { xp: 10,  cap: 10,  label: 'Booking approved' },
  rental_completed:  { xp: 30,  cap: 10,  label: 'Rental completed' },
  return_logged:     { xp: 10,  cap: 10,  label: 'Return checked in' },
  start_chat:        { xp: 3,   cap: 5,   label: 'Started a chat' },
  message:           { xp: 1,   cap: 20,  label: 'Message sent' },
  post:              { xp: 10,  cap: 10,  label: 'Posted' },
  sold:              { xp: 25,  cap: 5,   label: 'Item sold' },
  poll:              { xp: 0,   cap: 99,  label: 'Poll started' },
  comment:           { xp: 3,   cap: 20,  label: 'Commented' },
  react:             { xp: 1,   cap: 30,  label: 'Reacted' },
  vote:              { xp: 1,   cap: 10,  label: 'Voted' },
  share:             { xp: 2,   cap: 10,  label: 'Shared' },
  follow:            { xp: 1,   cap: 10,  label: 'Followed someone' },
  join:              { xp: 2,   cap: 10,  label: 'Joined a community' },
  story:             { xp: 8,   cap: 3,   label: 'Moment shared' },
  reaction_received: { xp: 1,   cap: 100, label: 'Someone loved your post' },
};
// Extra XP on the daily check-in for keeping a streak alive (max +20).
export const streakBonus = (streak) => Math.min(20, Math.max(0, streak - 1) * 2);

// Badges unlock from the action counters (and the streak / level). `icon`
// names a glyph in the app's own icon set (client/src/social/glyphs.jsx).
//   c = counters { event: times }, s = { streak, best_streak, level }
export const BADGES = [
  { id: 'welcome',       icon: 'sprout', name: 'Welcome aboard',  hint: 'Confirm your email or visit for the first time', test: (c) => (c.email_verified || 0) + (c.daily_visit || 0) >= 1 },
  { id: 'verified',      icon: 'shield', name: 'Verified',        hint: 'Verify your identity',          test: (c) => (c.verify_identity || 0) >= 1 },
  { id: 'first_listing', icon: 'box', name: 'First listing',   hint: 'List your first item',          test: (c) => (c.list_item || 0) >= 1 },
  { id: 'shopkeeper',    icon: 'store', name: 'Shopkeeper',      hint: 'List 5 items',                  test: (c) => (c.list_item || 0) >= 5 },
  { id: 'first_sale',    icon: 'coin', name: 'First sale',      hint: 'Sell something',                test: (c) => (c.sold || 0) >= 1 },
  { id: 'first_rental',  icon: 'ticket', name: 'First rental',    hint: 'Request your first booking',    test: (c) => (c.book || 0) >= 1 },
  { id: 'trusted_host',  icon: 'key', name: 'Trusted host',    hint: 'Complete 5 rentals',            test: (c) => (c.rental_completed || 0) >= 5 },
  { id: 'explorer',      icon: 'compass', name: 'Explorer',        hint: 'Look at 20 listings',           test: (c) => (c.view_item || 0) >= 20 },
  { id: 'first_post',    icon: 'wave', name: 'Said hello',      hint: 'Write your first post',         test: (c) => (c.post || 0) >= 1 },
  { id: 'storyteller',   icon: 'camera', name: 'Storyteller',     hint: 'Share 3 moments',               test: (c) => (c.story || 0) >= 3 },
  { id: 'chatty',        icon: 'chat', name: 'Conversationalist', hint: 'Write 25 comments',           test: (c) => (c.comment || 0) >= 25 },
  { id: 'cheerleader',   icon: 'spark', name: 'Cheerleader',     hint: 'React to 50 posts',             test: (c) => (c.react || 0) >= 50 },
  { id: 'crowd_fav',     icon: 'star', name: 'Crowd favourite', hint: 'Receive 25 reactions',          test: (c) => (c.reaction_received || 0) >= 25 },
  { id: 'pollster',      icon: 'poll', name: 'Pollster',        hint: 'Start a poll',                  test: (c) => (c.poll || 0) >= 1 },
  { id: 'socialite',     icon: 'people', name: 'Socialite',       hint: 'Follow 5 people',               test: (c) => (c.follow || 0) >= 5 },
  { id: 'streak_3',      icon: 'flame', name: 'On fire',         hint: 'Visit 3 days in a row',         test: (_c, s) => s.best_streak >= 3 },
  { id: 'streak_7',      icon: 'bolt', name: 'Unstoppable',     hint: 'Visit 7 days in a row',         test: (_c, s) => s.best_streak >= 7 },
  { id: 'streak_30',     icon: 'crown', name: 'Royalty',         hint: 'Visit 30 days in a row',        test: (_c, s) => s.best_streak >= 30 },
  { id: 'level_5',       icon: 'medal', name: 'Level 5',         hint: 'Reach level 5',                 test: (_c, s) => s.level >= 5 },
  { id: 'level_10',      icon: 'trophy', name: 'Level 10',        hint: 'Reach level 10',                test: (_c, s) => s.level >= 10 },
];
export function badgeInfo(id) {
  const b = BADGES.find((x) => x.id === id);
  return b ? { id: b.id, icon: b.icon, name: b.name, hint: b.hint } : null;
}

// Apply a list of actions to a member's stats — the heart of the reward
// engine, kept pure so the rules are testable. `stats` is the user_stats row.
// Returns the new row values plus what to celebrate.
export function applyRewards(stats, events, today) {
  const counters = { ...(stats.counters || {}) };
  let todayTally = stats.today && stats.today.date === today ? { ...stats.today } : { date: today };
  let xp = Number(stats.xp || 0);
  let karma = Number(stats.karma || 0);
  let streak = Number(stats.streak_days || 0);
  let best = Number(stats.best_streak || 0);
  let lastActive = stats.last_active_date || null;
  let streakUp = false;
  let gained = 0;
  const labels = [];

  for (const event of events) {
    const rule = REWARDS[event];
    if (!rule) continue;
    counters[event] = (counters[event] || 0) + 1;
    if (event === 'reaction_received') karma += 1;
    if (event === 'daily_visit') {
      const s = nextStreak(lastActive, today, streak);
      if (!s.changed) { counters[event] -= 1; continue; }   // already checked in today
      streak = s.streak;
      best = Math.max(best, streak);
      lastActive = today;
      streakUp = streak > 1;
    }
    const used = todayTally[event] || 0;
    if (used >= rule.cap) continue;
    todayTally = { ...todayTally, [event]: used + 1 };
    let add = rule.xp;
    if (event === 'daily_visit') add += streakBonus(streak);
    if (add > 0) { gained += add; labels.push(rule.label); }
  }
  xp += gained;

  const before = levelFor(Number(stats.xp || 0));
  const after = levelFor(xp);
  const had = new Set(stats.badges || []);
  const newBadges = BADGES
    .filter((b) => !had.has(b.id) && b.test(counters, { streak, best_streak: best, level: after.level }))
    .map((b) => b.id);

  return {
    row: {
      xp, karma, counters, today: todayTally,
      streak_days: streak, best_streak: best, last_active_date: lastActive,
      badges: [...had, ...newBadges],
    },
    reward: {
      xp: gained,
      label: labels[0] || null,
      total: xp,
      level: after,
      levelUp: after.level > before.level,
      streak,
      streakUp,
      badges: newBadges.map(badgeInfo),
    },
  };
}

// ---------------------------------------------------------------- content policy
// A small first line of defence; members can report anything that slips
// through, and the admin moderation queue has the final word.
const BLOCKED = [
  // abuse and slurs (English + common Bangla romanised)
  'fuck', 'cunt', 'nigger', 'nigga', 'faggot', 'retard', 'kill yourself', 'kys',
  'khanki', 'magi', 'chudi', 'choda', 'bokachoda', 'madarchod', 'bhenchod', 'shuorer bachcha',
  // sexual content
  'porn', 'nudes', 'xxx', 'onlyfans',
  // scams seen on rental marketplaces
  'send money first', 'advance payment only', 'pay outside rentalflow', 'double your money',
  'crypto giveaway', 'guaranteed profit', 'bkash first', 'nagad first',
];
const BLOCKED_RE = new RegExp(`(^|[^a-z])(${BLOCKED.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).join('|')})(?![a-z])`, 'i');

export function policyCheck(text = '') {
  const t = String(text);
  if (BLOCKED_RE.test(t)) return 'This goes against the community rules (abuse, adult content or a payment scam). Please rephrase it.';
  if ((t.match(/https?:\/\//gi) || []).length > 5) return 'Too many links in one post. Share up to 5.';
  if (/(.)\1{24,}/.test(t)) return 'That looks like spam. Please write it normally.';
  return null;
}

// ---------------------------------------------------------------- files
// Decide what an uploaded file really is from its first bytes — never from
// its name or the browser's word — and refuse anything that could run code.
const has = (buf, sig, at = 0) => sig.every((b, i) => buf[at + i] === b);
const ascii = (buf, s, at = 0) => has(buf, [...s].map((c) => c.charCodeAt(0)), at);

export const FILE_KINDS = {
  jpg:  { mime: 'image/jpeg', type: 'image' },
  png:  { mime: 'image/png', type: 'image' },
  gif:  { mime: 'image/gif', type: 'image' },
  webp: { mime: 'image/webp', type: 'image' },
  pdf:  { mime: 'application/pdf', type: 'file' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', type: 'file' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', type: 'file' },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', type: 'file' },
  txt:  { mime: 'text/plain; charset=utf-8', type: 'file' },
  csv:  { mime: 'text/plain; charset=utf-8', type: 'file' },
  md:   { mime: 'text/plain; charset=utf-8', type: 'file' },
};

// → { ext, mime, type } or { error }
export function sniffFile(buf, name = '') {
  if (!buf || !buf.length) return { error: 'The file is empty.' };
  const ext = (String(name).toLowerCase().match(/\.([a-z0-9]{1,5})$/) || [])[1] || '';
  const ok = (e) => ({ ext: e, ...FILE_KINDS[e] });

  if (has(buf, [0xff, 0xd8, 0xff])) return ok('jpg');
  if (has(buf, [0x89, 0x50, 0x4e, 0x47])) return ok('png');
  if (ascii(buf, 'GIF8')) return ok('gif');
  if (ascii(buf, 'RIFF') && ascii(buf, 'WEBP', 8)) return ok('webp');
  if (ascii(buf, '%PDF-')) {
    return pdfLooksSafe(buf) ? ok('pdf') : { error: 'This PDF contains scripts or embedded files, so it cannot be shared.' };
  }
  if (has(buf, [0x50, 0x4b, 0x03, 0x04])) {
    if (!['docx', 'xlsx', 'pptx'].includes(ext)) return { error: 'Zip archives cannot be shared. Word, Excel and PowerPoint files are fine.' };
    if (buf.includes('vbaProject.bin')) return { error: 'Documents with macros cannot be shared.' };
    return ok(ext);
  }
  if (['txt', 'csv', 'md'].includes(ext)) {
    if (buf.includes(0)) return { error: 'That text file contains binary data.' };
    try { new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return { error: 'Text files must be UTF-8.' }; }
    return ok(ext);
  }
  return { error: 'Share photos, PDFs, Word, Excel, PowerPoint or text files.' };
}

// A PDF may carry JavaScript, launch actions or embedded files. Refuse those.
export function pdfLooksSafe(buf) {
  const s = buf.toString('latin1');
  return !/\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA)\b/.test(s);
}

// ---------------------------------------------------------------- links
// Only plain web links, no passwords in them, no raw IP addresses.
export function checkLinkUrl(raw = '') {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return { error: 'That link is not a valid web address.' }; }
  if (!['http:', 'https:'].includes(u.protocol)) return { error: 'Only http and https links can be shared.' };
  if (u.username || u.password) return { error: 'Links with a username or password cannot be shared.' };
  if (/^[\d.]+$/.test(u.hostname) || u.hostname.includes(':') || u.hostname === 'localhost' || !u.hostname.includes('.')) {
    return { error: 'Share links to websites, not to IP addresses or local machines.' };
  }
  if (u.href.length > 2000) return { error: 'That link is too long.' };
  return { url: u };
}

// Private, loopback and link-local addresses — the link previewer must never
// be tricked into fetching them (server-side request forgery).
export function isPrivateAddress(ip = '') {
  const a = String(ip).toLowerCase();
  if (a.startsWith('::ffff:')) return isPrivateAddress(a.slice(7));
  if (a.includes(':')) {
    return a === '::1' || a === '::' || /^f[cd]/.test(a) || /^fe[89ab]/.test(a);
  }
  const p = a.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [x, y] = p;
  return x === 0 || x === 10 || x === 127 || x >= 224
    || (x === 100 && y >= 64 && y <= 127)
    || (x === 169 && y === 254)
    || (x === 172 && y >= 16 && y <= 31)
    || (x === 192 && y === 168)
    || (x === 198 && (y === 18 || y === 19));
}

export function youtubeId(raw = '') {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1, 12) || null;
    if (host === 'youtube.com') {
      if (u.searchParams.get('v')) return u.searchParams.get('v').slice(0, 11);
      const m = u.pathname.match(/^\/(shorts|embed)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch { /* not a URL */ }
  return null;
}

// Pull the Open Graph / <title> preview out of a page's HTML.
export function parseMeta(html = '', pageUrl = '') {
  const meta = (key) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const v = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    return v ? decodeEntities(v).trim() : null;
  };
  const title = meta('og:title') || meta('twitter:title') || decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim() || null;
  let image = meta('og:image') || meta('twitter:image');
  if (image) {
    try { image = new URL(image, pageUrl).href; } catch { image = null; }
    if (image && !/^https:\/\//.test(image)) image = null;   // only secure images on our pages
  }
  return {
    title: title ? title.slice(0, 200) : null,
    description: (meta('og:description') || meta('description') || '').slice(0, 300) || null,
    image,
    site: meta('og:site_name')?.slice(0, 80) || null,
  };
}
function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
