// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: the feed (home, a community, a #tag, search)
// ============================================================
// /feed            everything, ranked "for you" (my communities + people I follow)
// /c/:slug         one community, with its header and Join button
// /feed?tag=drone  one #tag            /feed?q=text   search
//
// Pages of 12 load as you scroll (the next page starts loading before you hit
// the bottom). Every 45 seconds it asks — cheaply — whether anything new was
// posted, and shows a "new posts" pill instead of moving the page under you.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon, categoryIcon } from '../icons.jsx';
import { money } from '../money.js';
import { play } from '../sfx.js';
import PostCard from '../social/PostCard.jsx';
import Composer from '../social/Composer.jsx';
import StoriesRow from '../social/Stories.jsx';
import { LevelCard } from '../social/RewardLayer.jsx';
import { loadMe, useMe } from '../social/store.js';
import { Avatar, CONDITIONS, compact } from '../social/util.jsx';
import { say } from '../social/toast.js';

const NEW_POLL_MS = 45000;

const TABS = [
  { id: 'foryou', label: 'For you', scope: 'home', sort: 'hot', auth: true },
  { id: 'hot', label: 'Hot', scope: 'all', sort: 'hot', guest: true },
  { id: 'following', label: 'Following', scope: 'following', sort: 'new', auth: true },
  { id: 'new', label: 'New', scope: 'all', sort: 'new' },
  { id: 'top', label: 'Top this week', scope: 'all', sort: 'top' },
  { id: 'sale', label: '🏷️ For sale', scope: 'all', sort: 'new', kind: 'sell' },
  { id: 'saved', label: '🔖 Saved', scope: 'saved', sort: 'new', auth: true },
];

export default function Feed() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const me = useMe();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const tag = params.get('tag');
  const q = params.get('q');

  const tabs = TABS.filter((t) => (user ? !t.guest : !t.auth));
  const [tabId, setTabId] = useState(params.get('tab') || (user && !slug && !tag && !q ? 'foryou' : 'hot'));
  const tab = tabs.find((t) => t.id === tabId) || tabs[0];

  const [posts, setPosts] = useState(null);
  const [next, setNext] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fresh, setFresh] = useState(0);
  const [community, setCommunity] = useState(null);
  const [composer, setComposer] = useState(null);   // null | { kind, startWith }
  const [queryText, setQueryText] = useState(q || '');
  const since = useRef(new Date().toISOString());
  const sentinel = useRef(null);

  const feedQuery = useCallback((offset) => {
    const p = new URLSearchParams({ scope: slug || tag || q ? 'all' : tab.scope, sort: tab.sort, offset: String(offset) });
    if (slug) p.set('community', slug);
    if (tag) p.set('tag', tag);
    if (q) p.set('q', q);
    if (tab.kind) p.set('kind', tab.kind);
    if (slug && tab.scope === 'saved') p.set('scope', 'saved');
    return p;
  }, [slug, tag, q, tab]);

  const load = useCallback(async () => {
    setPosts(null);
    setFresh(0);
    since.current = new Date().toISOString();
    try {
      const r = await api.get(`/community/feed?${feedQuery(0)}`);
      setPosts(r.posts);
      setNext(r.nextOffset);
    } catch {
      setPosts([]);
      setNext(null);
    }
  }, [feedQuery]);
  useEffect(() => { load(); }, [load]);
  // The "pick your communities" card asks for a reload once they are joined.
  useEffect(() => {
    window.addEventListener('rf:feed-refresh', load);
    return () => window.removeEventListener('rf:feed-refresh', load);
  }, [load]);

  useEffect(() => {
    if (!slug) { setCommunity(null); return; }
    api.get(`/community/c/${slug}`).then(setCommunity).catch(() => setCommunity(false));
  }, [slug]);

  // Infinite scroll: fetch the next page a screen before the end.
  const loadMore = useCallback(async () => {
    if (next == null || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await api.get(`/community/feed?${feedQuery(next)}`);
      setPosts((cur) => {
        const seen = new Set((cur || []).map((p) => p.id));
        return [...(cur || []), ...r.posts.filter((p) => !seen.has(p.id))];
      });
      setNext(r.nextOffset);
    } finally {
      setLoadingMore(false);
    }
  }, [next, loadingMore, feedQuery]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) loadMore(); }, { rootMargin: '900px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, posts]);

  // "New posts" pill.
  useEffect(() => {
    const check = () => {
      if (document.hidden) return;
      api.get(`/community/feed/new-count?${feedQuery(0)}&since=${encodeURIComponent(since.current)}`)
        .then((r) => setFresh(r.count)).catch(() => {});
    };
    const t = setInterval(check, NEW_POLL_MS);
    return () => clearInterval(t);
  }, [feedQuery]);

  function switchTab(id) {
    setTabId(id);
    const p = new URLSearchParams(params);
    p.set('tab', id);
    setParams(p, { replace: true });
  }
  function openComposer(kind = 'post', startWith) {
    if (!user) { navigate(`/login?mode=signup&next=${encodeURIComponent(pathname + search)}`); return; }
    setComposer({ kind, startWith });
  }
  const onChange = useCallback((p) => setPosts((all) => all.map((x) => (x.id === p.id ? p : x))), []);
  const onRemove = useCallback((id) => setPosts((all) => all.filter((x) => x.id !== id)), []);

  async function toggleJoin() {
    if (!user) { navigate(`/login?mode=signup&next=${encodeURIComponent(pathname)}`); return; }
    const joined = !community.joined;
    setCommunity({ ...community, joined, member_count: community.member_count + (joined ? 1 : -1) });
    if (joined) play('pop');
    try {
      const r = joined ? await api.post(`/community/c/${slug}/join`, {}) : await api.del(`/community/c/${slug}/join`);
      setCommunity((c) => ({ ...c, ...r }));
      loadMe();
      if (joined) say(`Welcome to c/${slug}!`, '🎉');
    } catch { setCommunity(community); }
  }

  function submitSearch(e) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (queryText.trim()) p.set('q', queryText.trim());
    navigate(`/feed${p.toString() ? `?${p}` : ''}`);
  }

  const heading = slug ? null : tag ? `#${tag}` : q ? `“${q}”` : null;
  const showOnboarding = user && me && me.joined.length === 0 && !slug && !tag && !q;
  const saleGrid = tab.kind === 'sell';

  return (
    <div className="container feed-page">
      <div className="feed-layout">
        <main className="feed-main">
          {community === false && <div className="center-empty">That community does not exist. <Link to="/communities">See all communities</Link></div>}
          {community && <CommunityHeader c={community} onJoin={toggleJoin} />}

          {heading && (
            <div className="feed-heading">
              <h1>{heading}</h1>
              <Link to="/feed" className="btn ghost small">Clear</Link>
            </div>
          )}

          {!slug && !tag && !q && <StoriesRow />}

          {showOnboarding && <PickCommunities />}

          <div
            className="compose-prompt"
            role="button"
            tabIndex={0}
            onClick={() => openComposer('post')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openComposer('post'); } }}
          >
            {user ? <Avatar id={user.id} name={user.name} size={40} /> : <span className="av av-a" style={{ width: 40, height: 40 }}>+</span>}
            <span className="cp-text">{user ? `What's on your mind, ${user.name.split(' ')[0]}?` : 'Join RentalFlow to post, react and chat'}</span>
            <span className="cp-tools" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => openComposer('showcase', 'media')} title="Photo or video">🖼️</button>
              <button type="button" onClick={() => openComposer('sell')} title="Sell something">🏷️</button>
              <button type="button" onClick={() => openComposer('question')} title="Ask">🙋</button>
              <button type="button" onClick={() => openComposer('poll')} title="Poll">📊</button>
            </span>
          </div>

          <div className="feed-tabs" role="tablist">
            {tabs.map((t) => (
              <button type="button" key={t.id} role="tab" aria-selected={t.id === tab.id} className={t.id === tab.id ? 'on' : ''} onClick={() => switchTab(t.id)}>{t.label}</button>
            ))}
            <Link to="/flow" className="reels-tab">▶ Flow</Link>
          </div>

          {fresh > 0 && (
            <button type="button" className="new-pill" onClick={() => { load(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              ↑ {fresh} new post{fresh === 1 ? '' : 's'}
            </button>
          )}

          {posts == null ? (
            <div className="feed-list">{[0, 1, 2].map((i) => <PostSkeleton key={i} />)}</div>
          ) : posts.length === 0 ? (
            <EmptyFeed tab={tab} slug={slug} onCompose={openComposer} />
          ) : saleGrid ? (
            <div className="sale-grid">
              {posts.map((p) => <SaleTile key={p.id} post={p} />)}
            </div>
          ) : (
            <div className="feed-list">
              {posts.map((p) => <PostCard key={p.id} post={p} onChange={onChange} onRemove={onRemove} />)}
            </div>
          )}
          <div ref={sentinel} className="feed-sentinel" />
          {loadingMore && <div className="feed-list"><PostSkeleton /></div>}
          {posts?.length > 0 && next == null && (
            <div className="feed-end">
              <span>✨</span>
              <b>You're all caught up</b>
              <span className="muted">Explore another community, or share something of your own.</span>
              <div className="feed-end-actions">
                <Link to="/communities" className="btn secondary small">Explore communities</Link>
                <button type="button" className="btn small" onClick={() => openComposer('post')}>Create a post</button>
              </div>
            </div>
          )}
        </main>

        <aside className="feed-rail">
          <form className="rail-search" onSubmit={submitSearch}>
            <Icon name="search" size={16} />
            <input placeholder="Search posts…" value={queryText} onChange={(e) => setQueryText(e.target.value)} />
          </form>
          {user ? <LevelCard /> : (
            <div className="rail-card join-card">
              <b>Join the community</b>
              <p className="muted">Post, react, sell, and earn badges for everything you do.</p>
              <Link to={`/login?mode=signup&next=${encodeURIComponent(pathname)}`} className="btn accent block">Create an account</Link>
            </div>
          )}
          <TrendingRail />
        </aside>
      </div>

      <Composer
        open={Boolean(composer)}
        startKind={composer?.kind}
        startWith={composer?.startWith}
        community={slug}
        onClose={() => setComposer(null)}
        onCreated={(p) => { setPosts((all) => [p, ...(all || [])]); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      />
    </div>
  );
}

function CommunityHeader({ c, onJoin }) {
  return (
    <section className="c-header">
      <div className="c-banner" aria-hidden="true"><Icon name={categoryIcon(c.name)} size={120} /></div>
      <div className="c-body">
        <span className="c-icon"><Icon name={categoryIcon(c.name)} size={30} /></span>
        <div className="c-meta">
          <h1>c/{c.slug}</h1>
          <p>{c.description}</p>
          <div className="c-stats">
            <span><b>{compact(c.member_count)}</b> member{c.member_count === 1 ? '' : 's'}</span>
            <span><b>{compact(c.post_count)}</b> posts</span>
            {c.category_id && <Link to={`/browse?category_id=${c.category_id}`}><b>{c.listings}</b> for rent ›</Link>}
          </div>
        </div>
        <button type="button" className={`btn ${c.joined ? 'secondary' : 'accent'} join-btn${c.joined ? ' joined' : ''}`} onClick={onJoin}>
          {c.joined ? '✓ Joined' : 'Join'}
        </button>
      </div>
      {c.leaders?.length > 0 && (
        <div className="c-leaders">
          <span className="muted">Top voices this week</span>
          {c.leaders.map((l, i) => (
            <Link key={l.id} to={`/u/${l.handle || l.id}`} title={`${l.name} · ${l.points} points`}>
              <Avatar id={l.id} name={l.name} size={28} /><span className="medal">{['🥇', '🥈', '🥉', '', ''][i]}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// First visit: pick a few communities so "For you" means something.
function PickCommunities() {
  const [all, setAll] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/community/communities').then(setAll).catch(() => {}); }, []);
  function toggle(slug) {
    play('pop');
    setPicked((s) => { const n = new Set(s); if (n.has(slug)) n.delete(slug); else n.add(slug); return n; });
  }
  async function save() {
    setBusy(true);
    try {
      await api.post('/community/join-many', { slugs: [...picked] });
      await loadMe();
      say(`Joined ${picked.size} communit${picked.size === 1 ? 'y' : 'ies'} — your feed is ready`, '🎉');
      window.dispatchEvent(new Event('rf:feed-refresh'));
    } finally { setBusy(false); }
  }
  if (!all.length) return null;
  return (
    <section className="pick-card">
      <h2>What are you into?</h2>
      <p className="muted">Pick a few communities — your feed fills with them. You can change this any time.</p>
      <div className="pick-chips">
        {all.map((c) => (
          <button type="button" key={c.slug} className={`pick-chip${picked.has(c.slug) ? ' on' : ''}`} onClick={() => toggle(c.slug)} data-sfx="none">
            <Icon name={categoryIcon(c.name)} size={16} /> {c.name}
            {picked.has(c.slug) && <span className="pick-check">✓</span>}
          </button>
        ))}
      </div>
      <button type="button" className="btn accent" disabled={!picked.size || busy} onClick={save}>
        {picked.size ? `Join ${picked.size} and build my feed` : 'Pick at least one'}
      </button>
    </section>
  );
}

function TrendingRail() {
  const [t, setT] = useState(null);
  useEffect(() => { api.get('/community/trending').then(setT).catch(() => {}); }, []);
  if (!t) return null;
  return (
    <>
      {t.tags.length > 0 && (
        <div className="rail-card">
          <h3>🔥 Trending</h3>
          <div className="trend-tags">
            {t.tags.map((x, i) => (
              <Link key={x.tag} to={`/feed?tag=${x.tag}`} className="trend-tag">
                <span className="muted">{i + 1}</span> #{x.tag} <small>{x.n} post{x.n === 1 ? '' : 's'}</small>
              </Link>
            ))}
          </div>
        </div>
      )}
      {t.leaders.length > 0 && (
        <div className="rail-card">
          <h3>🏆 Top this week</h3>
          {t.leaders.map((l, i) => (
            <Link key={l.id} to={`/u/${l.handle || l.id}`} className="leader-row">
              <span className="leader-rank">{['🥇', '🥈', '🥉'][i] || i + 1}</span>
              <Avatar id={l.id} name={l.name} size={30} />
              <span className="leader-name">{l.name}<small>Lv {l.level}{l.streak >= 3 ? ` · 🔥${l.streak}` : ''}</small></span>
              <b>{compact(l.points)}</b>
            </Link>
          ))}
        </div>
      )}
      {t.top.length > 0 && (
        <div className="rail-card">
          <h3>⭐ Best posts</h3>
          {t.top.map((p) => (
            <Link key={p.id} to={`/post/${p.id}`} className="top-post">
              {p.image && <img src={p.image} alt="" loading="lazy" />}
              <span>{p.body || 'A post'}<small>c/{p.community_slug} · {p.reaction_count} reactions · {p.comment_count} comments</small></span>
            </Link>
          ))}
        </div>
      )}
      <div className="rail-card">
        <h3>🌱 Communities</h3>
        {t.rising.map((c) => (
          <Link key={c.slug} to={`/c/${c.slug}`} className="rail-community">
            <Icon name={categoryIcon(c.name)} size={16} /> c/{c.slug}
            <small>{c.posts ? `${c.posts} new` : `${compact(c.member_count)} members`}</small>
          </Link>
        ))}
        <Link to="/communities" className="rail-more">See all ›</Link>
      </div>
    </>
  );
}

function SaleTile({ post }) {
  const cover = (post.attachments || []).find((a) => a.type === 'image') || (post.attachments || []).find((a) => a.type === 'video');
  return (
    <Link to={`/post/${post.id}`} className={`sale-tile${post.sale?.sold ? ' sold' : ''}`}>
      <span className="st-photo" style={{ background: cover?.color || 'var(--surface-2)' }}>
        {cover && <img src={cover.type === 'video' ? cover.poster : cover.url} alt="" loading="lazy" />}
        {post.sale?.sold && <span className="st-sold">Sold</span>}
      </span>
      <b className="st-price">{money(post.sale?.price)}</b>
      <span className="st-title">{post.body || 'For sale'}</span>
      <span className="st-meta">{CONDITIONS[post.sale?.condition] || 'Good'}{post.sale?.negotiable ? ' · Negotiable' : ''}</span>
    </Link>
  );
}

function EmptyFeed({ tab, slug, onCompose }) {
  const copy = {
    following: ['Follow people to fill this', 'Tap a name on any post, then Follow.'],
    saved: ['Nothing saved yet', 'Tap the bookmark on a post to keep it here.'],
    sale: ['Nothing for sale yet', 'Got something you no longer use? Sell it here in a minute.'],
  }[tab.id] || [slug ? 'Be the first to post here' : 'Nothing here yet', 'Start the conversation — it takes ten seconds.'];
  return (
    <div className="feed-empty">
      <span className="fe-emoji">{tab.id === 'sale' ? '🏷️' : tab.id === 'saved' ? '🔖' : '🌱'}</span>
      <b>{copy[0]}</b>
      <span className="muted">{copy[1]}</span>
      {tab.id !== 'saved' && tab.id !== 'following' && (
        <button type="button" className="btn accent" onClick={() => onCompose(tab.id === 'sale' ? 'sell' : 'post')}>
          {tab.id === 'sale' ? 'Sell something' : 'Create a post'}
        </button>
      )}
    </div>
  );
}

export function PostSkeleton() {
  return (
    <div className="post-card skeleton" aria-hidden="true">
      <div className="sk-head"><span className="sk-circle" /><span className="sk-lines"><i /><i /></span></div>
      <i className="sk-line" /><i className="sk-line short" />
      <div className="sk-media" />
    </div>
  );
}
