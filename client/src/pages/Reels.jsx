// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Reels — every video, full screen, swipe up
// ============================================================
// One video fills the screen; swipe (or scroll, or ↑ ↓) to the next. Only the
// video on screen plays — the others are just their cover frames — and the
// next page of videos loads before you reach the end.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';
import { money } from '../money.js';
import { play } from '../sfx.js';
import { burst } from '../fx.js';
import FeedVideo from '../social/FeedVideo.jsx';
import { Avatar, CONDITIONS, RichText, VerifiedTick, compact, reactionEmoji } from '../social/util.jsx';
import { say } from '../social/toast.js';

export default function Reels() {
  const [params] = useSearchParams();
  const start = params.get('start');
  const [reels, setReels] = useState(null);
  const [next, setNext] = useState(0);
  const [active, setActive] = useState(0);
  const scroller = useRef(null);
  const navigate = useNavigate();

  const loadPage = useCallback(async (offset) => {
    const r = await api.get(`/community/feed?media=video&sort=hot&offset=${offset}`);
    setNext(r.nextOffset);
    return r.posts;
  }, []);

  useEffect(() => {
    (async () => {
      const first = await loadPage(0).catch(() => []);
      let list = first;
      if (start && !first.some((p) => String(p.id) === start)) {
        const one = await api.get(`/community/posts/${start}`).catch(() => null);
        if (one) list = [one, ...first];
      } else if (start) {
        list = [first.find((p) => String(p.id) === start), ...first.filter((p) => String(p.id) !== start)];
      }
      setReels(list);
    })();
  }, [loadPage, start]);

  // Which reel is on screen.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !reels) return undefined;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting && e.intersectionRatio > 0.6) setActive(Number(e.target.dataset.i)); });
    }, { root: el, threshold: [0.6] });
    el.querySelectorAll('.reel').forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [reels]);

  // Load more two videos before the end.
  useEffect(() => {
    if (!reels || next == null || active < reels.length - 2) return;
    loadPage(next).then((more) => setReels((cur) => {
      const seen = new Set(cur.map((p) => p.id));
      return [...cur, ...more.filter((p) => !seen.has(p.id))];
    })).catch(() => {});
  }, [active, reels, next, loadPage]);

  useEffect(() => {
    const onKey = (e) => {
      if (!scroller.current) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        scroller.current.scrollBy({ top: (e.key === 'ArrowDown' ? 1 : -1) * scroller.current.clientHeight, behavior: 'smooth' });
      }
      if (e.key === 'Escape') navigate(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const update = (p) => setReels((all) => all.map((x) => (x.id === p.id ? p : x)));

  return (
    <div className="reels-page">
      <div className="reels-top">
        <button type="button" className="reels-back" onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/feed'))} aria-label="Back"><Icon name="close" size={20} /></button>
        <b>Reels</b>
      </div>
      {reels == null ? (
        <div className="reel-loading" aria-label="Loading" />
      ) : reels.length === 0 ? (
        <div className="reel-empty">
          <span>🎬</span>
          <b>No videos yet</b>
          <span>Post the first one — it shows up here for everyone.</span>
          <Link to="/feed" className="btn accent">Go to the feed</Link>
        </div>
      ) : (
        <div className="reels-scroller" ref={scroller}>
          {reels.map((p, i) => <Reel key={p.id} post={p} i={i} active={i === active} onChange={update} />)}
        </div>
      )}
    </div>
  );
}

function Reel({ post, i, active, onChange }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const video = post.attachments.find((a) => a.type === 'video');
  const [expanded, setExpanded] = useState(false);
  const guest = () => { if (user) return false; navigate(`/login?mode=signup&next=${encodeURIComponent(pathname + search)}`); return true; };

  async function love(e) {
    if (guest()) return;
    if (e?.clientX) burst(e.clientX, e.clientY, '❤️', 10);
    const type = post.my_reaction ? null : 'love';
    if (e?.clientX && post.my_reaction) return;       // double-tap never un-loves
    onChange({ ...post, my_reaction: type, reaction_count: post.reaction_count + (type ? 1 : -1) });
    if (type) play('pop');
    try { onChange({ ...post, ...(await api.post(`/community/posts/${post.id}/react`, { type })) }); } catch { onChange(post); }
  }
  async function save() {
    if (guest()) return;
    onChange({ ...post, saved: !post.saved });
    try { onChange({ ...post, ...(await api.post(`/community/posts/${post.id}/save`, {})) }); } catch { onChange(post); }
  }
  async function share() {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ url });
      else { await navigator.clipboard.writeText(url); say('Link copied', '🔗'); }
      if (user) api.post(`/community/posts/${post.id}/share`, {}).catch(() => {});
    } catch { /* cancelled */ }
  }
  async function follow() {
    if (guest()) return;
    onChange({ ...post, following_author: !post.following_author });
    try {
      const r = await api.post(`/community/users/${post.author_id}/follow`, {});
      onChange({ ...post, following_author: r.following });
      if (r.following) play('pop');
    } catch { onChange(post); }
  }

  return (
    <section className="reel" data-i={i}>
      {video && <FeedVideo video={video} reel active={active} onLove={love} />}
      <div className="reel-info">
        <div className="reel-who">
          <Link to={`/u/${post.author_handle || post.author_id}`}><Avatar id={post.author_id} name={post.author_name} size={36} /></Link>
          <Link to={`/u/${post.author_handle || post.author_id}`} className="reel-name">{post.author_name}</Link>
          {post.author_verified && <VerifiedTick />}
          {user?.id !== post.author_id && (
            <button type="button" className={`reel-follow${post.following_author ? ' on' : ''}`} onClick={follow}>{post.following_author ? 'Following' : 'Follow'}</button>
          )}
        </div>
        {post.body && (
          <div className={`reel-caption${expanded ? ' open' : ''}`} onClick={() => setExpanded(!expanded)}>
            <RichText text={post.body} />
          </div>
        )}
        <Link to={`/c/${post.community_slug}`} className="reel-community">c/{post.community_slug}</Link>
        {post.sale && !post.sale.sold && (
          <Link to={`/post/${post.id}`} className="reel-sale">🏷️ {money(post.sale.price)} · {CONDITIONS[post.sale.condition]} ›</Link>
        )}
        {post.item_id && post.item_name && <Link to={`/product/${post.item_id}`} className="reel-sale">📦 Rent {post.item_name} · {money(post.item_price)}/day ›</Link>}
      </div>
      <div className="reel-actions">
        <button type="button" className={`ra${post.my_reaction ? ' on' : ''}`} onClick={() => love()} aria-label="Love" data-sfx="none">
          <span>{post.my_reaction ? reactionEmoji(post.my_reaction) : '🤍'}</span><small>{compact(post.reaction_count)}</small>
        </button>
        <Link to={`/post/${post.id}#reply`} className="ra" aria-label="Comments"><span>💬</span><small>{compact(post.comment_count)}</small></Link>
        <button type="button" className="ra" onClick={share} aria-label="Share"><span>↗️</span><small>{post.share_count ? compact(post.share_count) : 'Share'}</small></button>
        <button type="button" className={`ra${post.saved ? ' on' : ''}`} onClick={save} aria-label="Save"><span>{post.saved ? '🔖' : '📑'}</span><small>{post.saved ? 'Saved' : 'Save'}</small></button>
      </div>
    </section>
  );
}
