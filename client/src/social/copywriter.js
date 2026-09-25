// ============================================================
//  RentalFlow  |  Studio  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: the copywriter — captions without any API
// ============================================================
// Writes the post text and the video's hook line from the listings someone
// picked, the way a friend would say it: what the occasion is, why renting
// beats buying, and a couple of hashtags. Pure templates and a little logic —
// no AI service, no cost. "Shuffle" walks through the variants.

// What each kind of gear is for, by category keyword.
const OCCASIONS = [
  { k: ['game', 'console'], moment: 'game night', emoji: '🎮', tag: 'gamenight', verb: 'play' },
  { k: ['camera', 'lens'], moment: 'shoot', emoji: '📸', tag: 'photography', verb: 'shoot' },
  { k: ['drone'], moment: 'flight', emoji: '🚁', tag: 'drone', verb: 'fly' },
  { k: ['camping', 'outdoor'], moment: 'trip', emoji: '🏕️', tag: 'roadtrip', verb: 'explore' },
  { k: ['event', 'party'], moment: 'big day', emoji: '🎉', tag: 'wedding', verb: 'celebrate' },
  { k: ['tool', 'garden'], moment: 'DIY day', emoji: '🔧', tag: 'diy', verb: 'build' },
  { k: ['music', 'audio', 'mic'], moment: 'jam session', emoji: '🎸', tag: 'music', verb: 'play' },
  { k: ['kitchen', 'home'], moment: 'baking day', emoji: '🎂', tag: 'homemade', verb: 'bake' },
  { k: ['projector', 'screen'], moment: 'movie night', emoji: '🎬', tag: 'movienight', verb: 'watch' },
  { k: ['phone', 'computer', 'laptop'], moment: 'project', emoji: '💻', tag: 'tech', verb: 'work' },
  { k: ['sport', 'fitness'], moment: 'match day', emoji: '⚽', tag: 'fitness', verb: 'train' },
];
const DEFAULT = { moment: 'weekend', emoji: '✨', tag: 'rentdontbuy', verb: 'try' };

// The occasion, when every listing points to the same one; otherwise a
// neutral "weekend" (a mixer and a camera are not one "shoot").
export function occasionFor(items) {
  const each = items.map((i) => {
    const text = `${i.category_name || ''} ${i.name}`.toLowerCase();
    return OCCASIONS.find((o) => o.k.some((k) => text.includes(k))) || DEFAULT;
  });
  return each.every((o) => o === each[0]) ? each[0] : DEFAULT;
}

function whenWord(date = new Date()) {
  const d = date.getDay();
  if (d === 5) return 'Friday night';
  if (d === 6 || d === 0) return 'This weekend';
  if (d === 4) return 'This Friday';
  return 'This weekend';
}

const taka = (n) => `৳${Math.round(n).toLocaleString('en-IN')}`;
// "a PS5 and a Switch" / "the Sony A7 III, a tripod and 2 lenses"
function shortName(name) {
  return String(name).replace(/\s*[(+].*$/, '').replace(/\s{2,}/g, ' ').trim().split(' ').slice(0, 4).join(' ');
}
function listNames(items) {
  const names = items.map((i) => shortName(i.name));
  if (names.length === 1) return `the ${names[0]}`;
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

// A friendly comparison for the price.
function priceLine(items) {
  const perDay = items.reduce((s, i) => s + Number(i.rental_price || 0), 0);
  const each = perDay / items.length;
  const worth = items.reduce((s, i) => s + Number(i.replacement_cost || 0), 0);
  if (items.length > 1 && each < 1100) return `for less than one pizza each`;
  if (perDay < 600) return `for less than a coffee date`;
  if (worth > 0) {
    const pct = (perDay / worth) * 100;
    if (pct < 1) return 'for less than 1% of what it costs to buy';
    if (pct < 5) return `for about ${Math.round(pct)}% of what it costs to buy`;
  }
  return `from just ${taka(perDay)} a day`;
}

const TEMPLATES = [
  (c) => `${c.when} ${c.moment} sorted ${c.emoji} Rented ${c.names} ${c.price}. Who is in? #${c.tag}`,
  (c) => `Why buy it when you can ${c.verb} with it tonight? ${c.names} — ${c.price} ${c.emoji} #rentdontbuy #${c.tag}`,
  (c) => `${c.emoji} ${c.when} plans: ${c.names}. ${c.priceCap}, no commitment, verified owners. #${c.tag} #dhaka`,
  (c) => `Tried ${c.names} before buying — best decision ever ${c.emoji} ${c.priceCap} on RentalFlow. #${c.tag}`,
  (c) => `Your ${c.moment} kit is one tap away ${c.emoji} ${c.names}, ${c.price}. #rentdontbuy #${c.tag}`,
];
const HOOKS = [
  (c) => `${c.when} ${c.moment} sorted`,
  (c) => `Why buy? Rent it.`,
  (c) => `Your ${c.moment} kit`,
  (c) => `${c.moment[0].toUpperCase()}${c.moment.slice(1)}, upgraded`,
  (c) => `Rent it tonight`,
];

// → [{ caption, hook }] — several variants to shuffle through.
export function writeCopy(items, date = new Date()) {
  if (!items.length) return [];
  const o = occasionFor(items);
  const price = priceLine(items);
  const c = {
    when: whenWord(date), moment: o.moment, emoji: o.emoji, tag: o.tag, verb: o.verb,
    names: listNames(items), price, priceCap: price[0].toUpperCase() + price.slice(1),
  };
  return TEMPLATES.map((t, i) => ({ caption: t(c).replace(/\s{2,}/g, ' '), hook: HOOKS[i](c) }));
}

export function totalPerDay(items) {
  return items.reduce((s, i) => s + Number(i.rental_price || 0), 0);
}
