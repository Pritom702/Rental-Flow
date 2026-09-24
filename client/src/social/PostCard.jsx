// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: one post in the feed
// ============================================================
// Everything a post can hold — text, photos, files, a link, a poll, a
// "wanted" request, something for sale, a tagged listing — and the things
// people do with it: spark it (tap, or hold for the fan of six sparks), double-tap a
// photo to adore it, reply, pass it on, keep it, report.
// Every action updates the screen first and the server second, so it feels
// instant; if the server says no, the card quietly goes back.
import { memo, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';
import { money } from '../money.js';
import { play } from '../sfx.js';
import { burst } from '../fx.js';
import {
  Avatar, CONDITIONS, CommunityChip, KINDS, REACTIONS, RichText, VerifiedTick, compact, reactionLabel, timeAgo,
} from './util.jsx';
import { Glyph } from './glyphs.jsx';
import { fileSize } from './media.js';
import FeedVideo from './FeedVideo.jsx';
import { say } from './toast.js';

const HOLD_MS = 380;

function useGuestGuard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  return () => {
    if (user) return false;
    navigate(`/login?mode=signup&next=${encodeURIComponent(pathname + search)}`);
    return true;
  };
}

function PostCard({ post, onChange, onRemove, full = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const guest = useGuestGuard();
  const [expanded, setExpanded] = useState(full);
  const [menu, setMenu] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const mine = user && user.id === post.author_id;
  const update = (patch) => onChange?.({ ...post, ...patch });

  const images = (post.attachments || []).filter((a) => a.type === 'image');
  const video = (post.attachments || []).find((a) => a.type === 'video');
  const files = (post.attachments || []).filter((a) => a.type === 'file');
  const long = post.body.length > 320 || post.body.split('\n').length > 6;
  const postUrl = `/post/${post.id}`;

  // ------------------------------------------------ reactions
  async function react(type, from) {
    if (guest()) return;
    const prev = { my_reaction: post.my_reaction, reaction_count: post.reaction_count, top_reactions: post.top_reactions };
    const next = post.my_reaction === type ? null : type;
    const delta = (next ? 1 : 0) - (post.my_reaction ? 1 : 0);
    update({ my_reaction: next, reaction_count: post.reaction_count + delta });
    if (next) {
      play('pop');
      if (from) burst(from.x, from.y, next, 7);
    }
    try {
      const r = await api.post(`/community/posts/${post.id}/react`, { type: next });
      update(r);
    } catch {
      update(prev);
    }
  }

  function loveFromPhoto(e) {
    if (guest()) return;
    const r = e.currentTarget.getBoundingClientRect();
    const at = { x: e.clientX || r.left + r.width / 2, y: e.clientY || r.top + r.height / 2 };
    burst(at.x, at.y, 'adore', 10);
    if (post.my_reaction !== 'adore') react('adore');
    else play('pop');
  }

  // ------------------------------------------------ share / save / delete / report
  async function share() {
    const url = `${window.location.origin}${postUrl}`;
    const text = post.body.slice(0, 100) || 'On RentalFlow';
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'RentalFlow', text, url });
      else { await navigator.clipboard.writeText(url); say('Link copied — paste it anywhere', 'link'); }
    } catch { return; }
    if (user) api.post(`/community/posts/${post.id}/share`, {}).then((r) => update(r)).catch(() => {});
  }
  async function toggleSave() {
    if (guest()) return;
    setMenu(false);
    update({ saved: !post.saved });
    play('pop');
    try {
      const r = await api.post(`/community/posts/${post.id}/save`, {});
      update(r);
      say(r.saved ? 'Kept — find it under Kept' : 'Removed from Kept', r.saved ? 'keep-on' : 'check');
    } catch { update({ saved: post.saved }); }
  }
  async function remove() {
    setMenu(false);
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    await api.del(`/community/posts/${post.id}`);
    say('Post deleted', 'trash');
    onRemove?.(post.id);
  }
  async function report(reason) {
    setMenu(false);
    if (guest()) return;
    await api.post('/community/report', { post_id: post.id, reason });
    say('Thanks — our team will take a look', 'shield');
  }

  // ------------------------------------------------ polls, sales
  async function vote(i) {
    if (guest()) return;
    const poll = { ...post.poll, counts: post.poll.counts.map((c, j) => (j === i ? c + 1 : c)) };
    update({ poll, my_vote: i });
    play('pop');
    try { update(await api.post(`/community/posts/${post.id}/vote`, { option: i })); } catch (e) { say(e.message, 'warn'); }
  }
  async function messageSeller() {
    if (guest()) return;
    try {
      const { id } = await api.post('/messages/conversations', { post_id: post.id });
      navigate(`/messages/${id}`);
    } catch (e) { say(e.message, 'warn'); }
  }
  async function markSold() {
    const sold = !post.sale.sold;
    update({ sale: { ...post.sale, sold } });
    try {
      const r = await api.patch(`/community/posts/${post.id}/sale`, { sold });
      update(r);
      if (sold) { play('success'); say('Marked as sold — nice one!', 'coin'); }
    } catch { update({ sale: post.sale }); }
  }

  const totalVotes = post.poll ? post.poll.counts.reduce((a, b) => a + b, 0) : 0;
  const pollClosed = post.poll && new Date(post.poll.closes_at) < new Date();
  const showResults = post.poll && (post.my_vote != null || pollClosed || !user || mine);

  // Why this post is in my feed — shown as a small line above it.
  const reason = post.is_top ? { glyph: 'trophy', text: 'Top post this week' }
    : post.following_author && !mine ? { glyph: 'people', text: `You follow ${post.author_name.split(' ')[0]}` }
      : post.my_interest >= 3 && !mine ? { glyph: 'spark', text: `You're into ${post.community_name}` }
        : null;

  return (
    <article className={`post-card kind-${post.kind}${post.status !== 'visible' ? ' is-hidden' : ''}${post.is_top ? ' is-top' : ''}`} id={`post-${post.id}`}>
      {post.kind !== 'post' && (
        <span className={`kind-ribbon k-${post.kind}`}><Glyph name={KINDS[post.kind].glyph} size={14} />{KINDS[post.kind].label}</span>
      )}
      {reason && !full && <div className="pc-reason"><Glyph name={reason.glyph} size={14} />{reason.text}</div>}
      <header className="pc-head">
        <Link to={`/u/${post.author_handle || post.author_id}`} className="pc-avatar" title={`Level ${post.author_level} · ${post.author_level_name}`}>
          <span className="lvl-avatar" style={{ '--lv': `${Math.min(1, post.author_level / 10) * 360}deg` }}>
            <Avatar id={post.author_id} name={post.author_name} size={40} />
          </span>
          <span className="lvl-num">{post.author_level}</span>
        </Link>
        <div className="pc-who">
          <div className="pc-name">
            <Link to={`/u/${post.author_handle || post.author_id}`}>{post.author_name}</Link>
            {post.author_verified && <VerifiedTick />}
            {post.author_streak >= 3 && <span className="pc-streak" title={`${post.author_streak}-day streak`}><Glyph name="flame" size={14} />{post.author_streak}</span>}
          </div>
          <div className="pc-sub">
            <CommunityChip slug={post.community_slug} name={post.community_name} small />
            <Link to={postUrl} className="pc-time">{timeAgo(post.created_at)}{post.edited_at ? ' · edited' : ''}</Link>
          </div>
        </div>
        <div className="pc-menu-wrap">
          <button type="button" className="icon-btn" aria-label="More" onClick={() => setMenu((v) => !v)}>
            <Glyph name="more" size={18} />
          </button>
          {menu && (
            <div className="pc-menu" onMouseLeave={() => setMenu(false)}>
              <button type="button" onClick={toggleSave}><Glyph name={post.saved ? 'keep-on' : 'keep'} size={16} />{post.saved ? 'Remove from Kept' : 'Keep'}</button>
              <button type="button" onClick={() => { setMenu(false); share(); }}><Glyph name="link" size={16} />Copy link</button>
              {(mine || user?.role === 'admin') && <button type="button" className="danger" onClick={remove}><Glyph name="trash" size={16} />Delete</button>}
              {!mine && (
                <details>
                  <summary><Glyph name="flag" size={16} />Report</summary>
                  {['spam', 'scam', 'abuse', 'adult', 'misleading', 'other'].map((r) => (
                    <button type="button" key={r} onClick={() => report(r)}>{r[0].toUpperCase() + r.slice(1)}</button>
                  ))}
                </details>
              )}
            </div>
          )}
        </div>
      </header>

      {post.status !== 'visible' && <div className="pc-hidden-note"><Glyph name="shield" size={14} /> Hidden while our team reviews reports. Only you can see it.</div>}

      {post.body && (
        <div className={`pc-body${long && !expanded ? ' clamped' : ''}`}>
          <RichText text={post.body} />
        </div>
      )}
      {long && !expanded && <button type="button" className="pc-more" onClick={() => setExpanded(true)}>See more</button>}

      {post.sale && (
        <div className={`sale-box${post.sale.sold ? ' sold' : ''}`}>
          <div className="sale-price">{money(post.sale.price)}</div>
          <div className="sale-tags">
            <span>{CONDITIONS[post.sale.condition] || 'Good'}</span>
            {post.sale.negotiable && <span>Negotiable</span>}
            {post.sale.sold && <span className="sold-tag">Sold</span>}
          </div>
          <div className="sale-actions">
            {mine
              ? <button type="button" className="btn secondary small" onClick={markSold}>{post.sale.sold ? 'Mark as available' : 'Mark as sold'}</button>
              : !post.sale.sold && <button type="button" className="btn accent small" onClick={messageSeller}><Icon name="chat" size={15} /> Message seller</button>}
          </div>
        </div>
      )}

      {post.wanted && (
        <div className="wanted-box">
          <div><span>Budget</span><b>{post.wanted.budget ? `${money(post.wanted.budget)}/day` : 'Open'}</b></div>
          {(post.wanted.from || post.wanted.to) && <div><span>When</span><b>{post.wanted.from || '…'} → {post.wanted.to || '…'}</b></div>}
          {post.wanted.area && <div><span>Where</span><b>{post.wanted.area}</b></div>}
          <Link to={`${postUrl}#reply`} className="btn small">I have one</Link>
        </div>
      )}

      {video && (
        <div className={`pc-video-wrap${post.sale?.sold ? ' sold' : ''}`}>
          <FeedVideo video={video} onLove={loveFromPhoto} onOpen={() => navigate(`/flows?start=${post.id}`)} />
          <Link to={`/flows?start=${post.id}`} className="pc-reels-link">Watch in Flows ›</Link>
        </div>
      )}

      {images.length > 0 && (
        <div className={`pc-media n${Math.min(images.length, 4)}${post.sale?.sold ? ' sold' : ''}`}>
          {images.slice(0, 4).map((img, i) => (
            <PostImage
              key={img.url}
              img={img}
              more={i === 3 && images.length > 4 ? images.length - 4 : 0}
              single={images.length === 1}
              onOpen={() => setLightbox(i)}
              onLove={loveFromPhoto}
            />
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="pc-files">
          {files.map((f) => (
            <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="pc-file">
              <span className="pc-file-ic">{f.mime === 'application/pdf' ? 'PDF' : (f.name.split('.').pop() || 'FILE').toUpperCase().slice(0, 4)}</span>
              <span className="pc-file-name">{f.name || 'Attachment'}</span>
              <span className="muted">{fileSize(f.size)}</span>
              <Icon name="arrow-right" size={16} />
            </a>
          ))}
        </div>
      )}

      {post.link && <LinkCard link={post.link} />}

      {post.poll && (
        <div className="poll">
          {post.poll.options.map((o, i) => {
            const pct = totalVotes ? Math.round((post.poll.counts[i] / totalVotes) * 100) : 0;
            return showResults ? (
              <div key={o} className={`poll-row result${post.my_vote === i ? ' mine' : ''}`}>
                <i style={{ width: `${pct}%` }} />
                <span>{o}{post.my_vote === i && <Glyph name="check" size={14} />}</span><b>{pct}%</b>
              </div>
            ) : (
              <button type="button" key={o} className="poll-row" onClick={() => vote(i)}>{o}</button>
            );
          })}
          <div className="poll-foot muted">{compact(totalVotes)} vote{totalVotes === 1 ? '' : 's'} · {pollClosed ? 'Final results' : `closes ${new Date(post.poll.closes_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`}</div>
        </div>
      )}

      {post.item_id && post.item_name && (
        <Link to={`/product/${post.item_id}`} className="pc-item">
          {post.item_cover ? <img src={post.item_cover} alt="" loading="lazy" /> : <span className="pc-item-ph"><Icon name="package" size={20} /></span>}
          <div><b>{post.item_name}</b><span>{money(post.item_price)}/day · {post.item_status}</span></div>
          <span className="btn accent small">Rent it</span>
        </Link>
      )}

      {/* The dock: sparks, replies, pass it on, keep. Counts sit on the buttons. */}
      <div className="pc-dock">
        <SparkButton mine={post.my_reaction} count={post.reaction_count} top={post.top_reactions} onReact={react} />
        <Link to={full ? '#reply' : `${postUrl}#reply`} className="dock-btn" onClick={(e) => { if (guest()) e.preventDefault(); }} aria-label="Replies">
          <Glyph name="chat" size={20} /><b>{post.comment_count ? compact(post.comment_count) : 'Reply'}</b>
        </Link>
        <button type="button" className="dock-btn" onClick={share} aria-label="Pass it on">
          <Glyph name="pass" size={20} /><b>{post.share_count ? compact(post.share_count) : 'Pass'}</b>
        </button>
        <span className="spacer" />
        <button type="button" className={`dock-btn keep${post.saved ? ' on' : ''}`} onClick={toggleSave} aria-label={post.saved ? 'Remove from Kept' : 'Keep'}>
          <Glyph name={post.saved ? 'keep-on' : 'keep'} size={20} />
        </button>
      </div>

      {!full && post.top_comment && (
        <Link to={postUrl} className="pc-reply-peek">
          <Avatar id={post.top_comment.id} name={post.top_comment.author} size={24} />
          <span><b>{post.top_comment.author}</b> {post.top_comment.body}</span>
          {post.comment_count > 1 && <em>+{post.comment_count - 1}</em>}
        </Link>
      )}

      {lightbox != null && <Lightbox images={images} start={lightbox} onClose={() => setLightbox(null)} />}
    </article>
  );
}
export default memo(PostCard);

// A photo keeps its shape and average colour while it loads, so nothing jumps.
// Tap opens it; a double tap loves the post.
function PostImage({ img, more, single, onOpen, onLove }) {
  const [loaded, setLoaded] = useState(false);
  const last = useRef(0);
  const timer = useRef(null);
  const ratio = single && img.w && img.h ? Math.max(0.6, Math.min(1.6, img.w / img.h)) : null;
  function onClick(e) {
    const now = Date.now();
    if (now - last.current < 300) {
      clearTimeout(timer.current);
      last.current = 0;
      onLove(e);
      return;
    }
    last.current = now;
    const ev = { clientX: e.clientX, clientY: e.clientY };
    timer.current = setTimeout(() => onOpen(ev), 300);
  }
  return (
    <button
      type="button"
      className={`pc-img${loaded ? ' in' : ''}`}
      style={{ background: img.color || 'var(--surface-2)', aspectRatio: ratio || undefined }}
      onClick={onClick}
      data-sfx="none"
      aria-label="Open photo (double-tap to love)"
    >
      <img src={img.url} alt="" loading="lazy" decoding="async" onLoad={() => setLoaded(true)} />
      {more > 0 && <span className="pc-img-more">+{more}</span>}
    </button>
  );
}

function Lightbox({ images, start, onClose }) {
  const [i, setI] = useState(start);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((v) => Math.min(images.length - 1, v + 1));
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length, onClose]);
  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-label="Photo">
      <img src={images[i].url} alt="" onClick={(e) => e.stopPropagation()} />
      {images.length > 1 && (
        <>
          <button type="button" className="lb-nav prev" disabled={i === 0} onClick={(e) => { e.stopPropagation(); setI(i - 1); }} aria-label="Previous">‹</button>
          <button type="button" className="lb-nav next" disabled={i === images.length - 1} onClick={(e) => { e.stopPropagation(); setI(i + 1); }} aria-label="Next">›</button>
          <div className="lb-count">{i + 1} / {images.length}</div>
        </>
      )}
      <button type="button" className="lb-close" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
    </div>
  );
}

// YouTube plays in place (only loaded when tapped); other links are a card.
function LinkCard({ link }) {
  const [playing, setPlaying] = useState(false);
  if (link.youtube) {
    return (
      <div className="pc-video">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${link.youtube}?autoplay=1&rel=0`}
            title={link.title || 'YouTube video'}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button type="button" className="pc-video-cover" onClick={() => setPlaying(true)} aria-label="Play video">
            <img src={link.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
            <span className="pc-play">▶</span>
            {link.title && <span className="pc-video-title">{link.title}</span>}
          </button>
        )}
      </div>
    );
  }
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer nofollow ugc" className={`pc-link${link.image ? ' has-img' : ''}`}>
      {link.image && <img src={link.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
      <div>
        <span className="pc-link-site">{link.site}</span>
        <b>{link.title || link.url}</b>
        {link.description && <span className="pc-link-desc">{link.description}</span>}
      </div>
    </a>
  );
}

// Tap: spark it (or take your reaction back). Hold (phone) or rest the mouse
// on it: the six sparks fan out in an arc above the button — pick one.
export function SparkButton({ mine, count, top = [], onReact }) {
  const [fan, setFan] = useState(false);
  const holdTimer = useRef(null);
  const hoverTimer = useRef(null);
  const held = useRef(false);
  const btn = useRef(null);

  const center = () => {
    const r = btn.current?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top } : null;
  };
  function down(e) {
    if (e.pointerType === 'mouse') return;
    held.current = false;
    holdTimer.current = setTimeout(() => { held.current = true; setFan(true); navigator.vibrate?.(8); }, HOLD_MS);
  }
  function up() { clearTimeout(holdTimer.current); }
  function click() {
    if (held.current) { held.current = false; return; }
    setFan(false);
    onReact(mine || 'spark', center());
  }
  // The reactions this post got, as separate full-colour coins (mine first).
  const coins = [...new Set([mine, ...(top || []).map((r) => r.type)].filter(Boolean))].slice(0, 3);
  return (
    <div
      className="spark-wrap"
      onMouseEnter={() => { hoverTimer.current = setTimeout(() => setFan(true), 420); }}
      onMouseLeave={() => { clearTimeout(hoverTimer.current); setFan(false); }}
    >
      {fan && (
        <div className="spark-fan" role="menu">
          {REACTIONS.map((r, i) => (
            <button
              type="button"
              key={r.type}
              style={{ '--i': i, '--n': REACTIONS.length }}
              className={mine === r.type ? 'on' : ''}
              onClick={(e) => { setFan(false); onReact(r.type, { x: e.clientX, y: e.clientY }); }}
              aria-label={r.label}
              data-sfx="none"
            >
              <Glyph name={r.type} size={30} />
              <em>{r.label}</em>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        ref={btn}
        className={`dock-btn spark${mine ? ` on r-${mine}` : ''}`}
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={up}
        onContextMenu={(e) => e.preventDefault()}
        onClick={click}
        aria-label={mine ? `${reactionLabel(mine)} — tap to undo` : 'Spark'}
        data-sfx="none"
      >
        {coins.length === 0
          ? <Glyph name="spark" size={20} className="spark-main hollow" />
          : (
            <span className="rx-coins">
              {coins.map((t) => (
                <span key={t} className={`rx-coin rx-${t}${t === mine ? ' mine' : ''}`}><Glyph name={t} size={14} /></span>
              ))}
            </span>
          )}
        <b>{count ? compact(count) : 'Spark'}</b>
      </button>
    </div>
  );
}
