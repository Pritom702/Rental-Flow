// ============================================================
//  RentalFlow  |  Studio  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: the copywriter — captions without any API
// ============================================================
// Writes the post text, the video's opening hook and the words on each
// product's scene, from the listings someone picked: what the product is
// actually good at (from its own description), what it would cost to buy, the
// occasion, and hashtags from its own tags. Pure templates and a little logic —
// no AI service, no cost. "Write another" walks through the variants.

// What each kind of gear is for, by category keyword.
const OCCASIONS = [
  { k: ['game', 'console'], moment: 'game night', emoji: '🎮', tag: 'gamenight', verb: 'play', use: 'Game night, levelled up' },
  { k: ['camera', 'lens'], moment: 'shoot', emoji: '📸', tag: 'photography', verb: 'shoot', use: 'Made for your next shoot' },
  { k: ['drone'], moment: 'flight', emoji: '🚁', tag: 'drone', verb: 'fly', use: 'The view from above' },
  { k: ['camping', 'outdoor'], moment: 'trip', emoji: '🏕️', tag: 'roadtrip', verb: 'explore', use: 'Ready for the outdoors' },
  { k: ['event', 'party'], moment: 'big day', emoji: '🎉', tag: 'eventday', verb: 'celebrate', use: 'Make the big day bigger' },
  { k: ['tool', 'garden'], moment: 'DIY day', emoji: '🔧', tag: 'diy', verb: 'build', use: 'Get the job done right' },
  { k: ['music', 'audio', 'mic'], moment: 'jam session', emoji: '🎸', tag: 'music', verb: 'play', use: 'Sound that stands out' },
  { k: ['kitchen', 'home', 'appliance'], moment: 'baking day', emoji: '🎂', tag: 'homemade', verb: 'bake', use: 'Your kitchen, upgraded' },
  { k: ['projector', 'screen'], moment: 'movie night', emoji: '🎬', tag: 'movienight', verb: 'watch', use: 'Cinema at home' },
  { k: ['vehicle', 'car', 'bike', 'motor', 'scooter'], moment: 'road trip', emoji: '🚗', tag: 'roadtrip', verb: 'ride', use: 'Hit the road in style' },
  { k: ['phone', 'computer', 'laptop'], moment: 'project', emoji: '💻', tag: 'tech', verb: 'work', use: 'Power for your next project' },
  { k: ['sport', 'fitness'], moment: 'match day', emoji: '⚽', tag: 'fitness', verb: 'train', use: 'Game on' },
  { k: ['furniture'], moment: 'event', emoji: '🪑', tag: 'events', verb: 'host', use: 'Host in comfort' },
  { k: ['light'], moment: 'shoot', emoji: '💡', tag: 'lighting', verb: 'light', use: 'Light it like a pro' },
];
const DEFAULT = { moment: 'plans', emoji: '✨', tag: 'rentdontbuy', verb: 'try', use: 'Why buy when you can rent?' };

const occasionOf = (item) => {
  const text = `${item.category_name || ''} ${item.name}`.toLowerCase();
  return OCCASIONS.find((o) => o.k.some((k) => text.includes(k))) || DEFAULT;
};

// The occasion, when every listing points to the same one; otherwise a
// neutral one (a mixer and a camera are not one "shoot").
export function occasionFor(items) {
  const each = items.map(occasionOf);
  return each.every((o) => o === each[0]) ? each[0] : DEFAULT;
}

function whenWord(date = new Date()) {
  const d = date.getDay();
  if (d === 5) return 'Friday night';
  if (d === 4) return 'This Friday';
  return 'This weekend';
}

const taka = (n) => `৳${Math.round(n).toLocaleString('en-IN')}`;

// "Sony PlayStation 5 + DualSense" → "Sony PlayStation 5"
export function shortName(name) {
  return String(name).replace(/\s*[(+].*$/, '').replace(/\s{2,}/g, ' ').trim().split(' ').slice(0, 4).join(' ');
}
function listNames(items) {
  const names = items.map((i) => shortName(i.name));
  if (names.length === 1) return `the ${names[0]}`;
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

// The best short line about one product, from its own description:
// "61 MP full-frame mirrorless camera paired with …" → first clause, ≤ 64 chars.
const DANGLING = /\s+(with|and|or|for|the|a|an|of|to|in|on|at|by|from|that|which|your|its)$/i;
export function highlight(item, max = 64) {
  const d = String(item.description || '').replace(/\s+/g, ' ').trim();
  if (d.length >= 12) {
    let line = d.split(/\s[—–-]\s|[.!?;]\s/)[0].trim().replace(/[.!?]$/, '');
    if (line.length > max) {
      line = line.slice(0, max);
      line = line.slice(0, line.lastIndexOf(' ') > max / 2 ? line.lastIndexOf(' ') : max);
      while (DANGLING.test(line)) line = line.replace(DANGLING, '');
      line = `${line.replace(/[,:\s]+$/, '')}…`;
    }
    if (line.length >= 12) return line[0].toUpperCase() + line.slice(1);
  }
  return occasionOf(item).use;
}

// What it would cost to buy, next to the day rate: the reason to rent.
export function valueLine(item) {
  const worth = Number(item.replacement_cost || 0);
  const day = Number(item.rental_price || 0);
  if (worth > day * 5) return `Worth ${taka(worth)} to buy`;
  return '';
}

// Hashtags from the listing's own tags, then the occasion.
// Round-robin, so every product gets its own tag before any gets a second.
function hashtags(items, o) {
  const lists = items.map((i) => String(i.tags || '').split(',').map((t) => t.trim().toLowerCase().replace(/[^a-z0-9]/g, '')).filter((t) => t.length >= 2));
  const own = [];
  for (let r = 0; r < 3; r += 1) lists.forEach((l) => { if (l[r]) own.push(l[r]); });
  const all = [...new Set([...own, ...(o === DEFAULT ? [] : [o.tag]), 'rentdontbuy'])];
  const max = Math.max(4, items.length + 1);
  return [...all.slice(0, max - 1), 'rentdontbuy'].filter((t, i, a) => a.indexOf(t) === i).map((t) => `#${t}`).join(' ');
}

// A friendly comparison for the price.
function priceLine(items) {
  const perDay = items.reduce((s, i) => s + Number(i.rental_price || 0), 0);
  const worth = items.reduce((s, i) => s + Number(i.replacement_cost || 0), 0);
  if (worth > 0) {
    const pct = (perDay / worth) * 100;
    if (pct < 1) return `for less than 1% of what it costs to buy`;
    if (pct < 5) return `for about ${Math.round(pct)}% of what it costs to buy`;
  }
  if (items.length > 1 && perDay / items.length < 1100) return 'for less than one pizza each';
  return `from just ${taka(perDay)} a day`;
}

// Opening lines, written from the products themselves.
function hooks(items, c) {
  const first = shortName(items[0].name);
  const day = taka(items.reduce((s, i) => s + Number(i.rental_price || 0), 0));
  const worth = items.reduce((s, i) => s + Number(i.replacement_cost || 0), 0);
  if (items.length === 1) {
    return [
      `${first} for ${day} a day?`,
      `Don't buy the ${first}. Rent it.`,
      `${c.when}: ${first}`,
      worth > 0 ? `Skip the ${taka(worth)} price tag` : `${c.moment[0].toUpperCase()}${c.moment.slice(1)}, upgraded`,
      `${occasionOf(items[0]).use}`,
    ];
  }
  return [
    `${items.length} picks for ${c.when.toLowerCase()}`,
    `${first} + ${items.length - 1} more, ${day} a day`,
    worth > 0 ? `${taka(worth)} of gear. Rented.` : 'Why buy? Rent it.',
    `${items.length === 2 ? "Both" : `All ${items.length}`} for ${day} a day`,
    c.sorted,
  ];
}

const TEMPLATES = [
  (c) => `${c.sorted} ${c.emoji} Rented ${c.names} ${c.price}. ${c.detail} Who is in? ${c.tags}`,
  (c) => `Why buy ${c.it} when you can ${c.use} tonight? ${c.Names} — ${c.price} ${c.emoji} ${c.detail} ${c.tags}`,
  (c) => `${c.emoji} ${c.when} plans: ${c.names}. ${c.detail} ${c.priceCap}, no commitment, verified owners. ${c.tags}`,
  (c) => `Tried ${c.names} before buying — best decision ever ${c.emoji} ${c.detail} ${c.priceCap} on RentalFlow. ${c.tags}`,
  (c) => `${c.kit} is one tap away ${c.emoji} ${c.Names}, ${c.price}. ${c.detail} ${c.tags}`,
];

// → [{ caption, hook }] — several variants to shuffle through.
export function writeCopy(items, date = new Date()) {
  if (!items.length) return [];
  const o = occasionFor(items);
  const price = priceLine(items);
  const detail = items.length === 1 ? `${highlight(items[0], 140)}`.replace(/…$/, '…').replace(/([^…])$/, '$1.') : '';
  const when = whenWord(date);
  const mixed = o === DEFAULT;
  const names = listNames(items);
  const c = {
    when, moment: o.moment, emoji: o.emoji,
    names, Names: names[0].toUpperCase() + names.slice(1),
    it: items.length > 1 ? 'them' : 'it',
    use: mixed ? `have ${items.length > 1 ? 'them' : 'it'}` : `${o.verb} with ${items.length > 1 ? 'them' : 'it'}`,
    sorted: mixed ? `${when}, sorted` : `${o.moment[0].toUpperCase()}${o.moment.slice(1)} sorted for ${when.replace(/^This/, 'this')}`,
    kit: mixed ? 'Everything you need' : `Your ${o.moment} kit`,
    price, priceCap: price[0].toUpperCase() + price.slice(1),
    detail, tags: hashtags(items, o),
  };
  const h = hooks(items, c);
  return TEMPLATES.map((t, i) => ({ caption: t(c).replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').trim().slice(0, 500), hook: h[i % h.length] }));
}

export function totalPerDay(items) {
  return items.reduce((s, i) => s + Number(i.rental_price || 0), 0);
}
