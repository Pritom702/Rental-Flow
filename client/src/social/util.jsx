// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: shared bits — avatars, time, rich text
// ============================================================
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Icon, categoryIcon } from '../icons.jsx';

// RentalFlow's own reactions — "sparks" — drawn in glyphs.jsx.
export const REACTIONS = [
  { type: 'spark', label: 'Spark' },
  { type: 'want', label: 'Want it' },
  { type: 'genius', label: 'Genius' },
  { type: 'wow', label: 'Whoa' },
  { type: 'lol', label: 'LOL' },
  { type: 'adore', label: 'Adore' },
];
export const reactionLabel = (t) => REACTIONS.find((r) => r.type === t)?.label || 'Spark';

// What each kind of post is, as the composer and the card show it.
export const KINDS = {
  post:     { label: 'Post',     glyph: 'post',     hint: 'Say anything' },
  showcase: { label: 'Show off', glyph: 'showcase', hint: 'Photos or video of what you made or shot' },
  question: { label: 'Ask',      glyph: 'question', hint: 'Get advice before you rent or buy' },
  guide:    { label: 'Guide',    glyph: 'guide',    hint: 'Teach something you know' },
  wanted:   { label: 'Wanted',   glyph: 'wanted',   hint: 'Looking for something to rent' },
  poll:     { label: 'Poll',     glyph: 'poll',     hint: 'Let people vote' },
  sell:     { label: 'Sell',     glyph: 'sell',     hint: 'Sell something you own' },
};
export const CONDITIONS = { new: 'Brand new', like_new: 'Like new', good: 'Good', fair: 'Fair', for_parts: 'For parts' };

export function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 45) return 'now';
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  if (s < 604800) return `${Math.round(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function compact(n) {
  const v = Number(n) || 0;
  if (v < 1000) return String(v);
  if (v < 1e6) return `${(v / 1000).toFixed(v < 1e4 ? 1 : 0).replace(/\.0$/, '')}k`;
  return `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
}

export function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

// A person's circle: initials on one of a few theme-friendly colours, picked
// from their id so everyone keeps the same colour everywhere.
const HUES = ['a', 'b', 'c', 'd', 'e', 'f'];
export function Avatar({ id, name, size = 40, ring = false, className = '' }) {
  const hue = HUES[Math.abs(Number(id) || 0) % HUES.length];
  return (
    <span
      className={`av av-${hue}${ring ? ' av-ring' : ''} ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

// A community as a small chip: its category icon and its name — no prefixes.
export function CommunityChip({ slug, name, small = false }) {
  return (
    <Link to={`/c/${slug}`} className={`c-chip${small ? ' small' : ''}`}>
      <Icon name={categoryIcon(name || slug)} size={small ? 12 : 14} />{name || slug}
    </Link>
  );
}

export function LevelChip({ level, title }) {
  return <span className="lvl-chip" title={title || `Level ${level}`}>Lv {level}</span>;
}

export function VerifiedTick() {
  return (
    <span className="v-tick" title="Identity verified" aria-label="Identity verified">
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l2.4 1.8 3-.2 1 2.8 2.6 1.4-.6 3 1.6 2.6-2.1 2.1.2 3-2.9.9-1.4 2.6-3-.6L12 22l-2.4-1.8-3 .2-1-2.8-2.6-1.4.6-3L2 10.6l2.1-2.1-.2-3 2.9-.9L8.2 2l3 .6z" /><path d="m8 12 3 3 5-6" fill="none" stroke="var(--on-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

// Post and comment text: #tags, @people and web links become links. Nothing
// here is ever inserted as HTML, so a post cannot inject markup.
const TOKEN = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])|(^|[^\w&])#([a-zA-Z][a-zA-Z0-9_]{1,29})\b|(^|[^\w@])@([a-zA-Z0-9_]{2,32})\b/g;
export function RichText({ text = '' }) {
  const out = [];
  let last = 0;
  let key = 0;
  for (const m of String(text).matchAll(TOKEN)) {
    const lead = m[2] ?? m[4] ?? '';
    const start = m.index + lead.length;
    if (start > last) out.push(<Fragment key={key++}>{text.slice(last, start)}</Fragment>);
    if (m[1]) {
      out.push(<a key={key++} href={m[1]} target="_blank" rel="noopener noreferrer nofollow ugc" className="rt-link">{m[1].replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)}</a>);
    } else if (m[3]) {
      out.push(<Link key={key++} to={`/feed?tag=${m[3].toLowerCase()}`} className="rt-tag">#{m[3]}</Link>);
    } else {
      out.push(<Link key={key++} to={`/u/${m[5]}`} className="rt-mention">@{m[5]}</Link>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return out;
}
