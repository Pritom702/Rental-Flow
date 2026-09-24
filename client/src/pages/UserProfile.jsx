// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: public profile — level, badges, posts
// ============================================================
// /u/:handle (or /u/me). Shows who someone is on RentalFlow: their level and
// streak, badges, followers, what they post, sell and rent out. On your own
// profile the badges you have not earned yet are shown greyed out with how to
// get them — there is always a next goal in sight.
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';
import { money } from '../money.js';
import { play } from '../sfx.js';
import PostCard from '../social/PostCard.jsx';
import { loadMe, useMe } from '../social/store.js';
import { Avatar, VerifiedTick, compact } from '../social/util.jsx';
import { say } from '../social/toast.js';
import { PostSkeleton } from './Feed.jsx';

export default function UserProfile() {
  const { who } = useParams();
  const { user } = useAuth();
  const me = useMe();
  const navigate = useNavigate();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('posts');
  const [posts, setPosts] = useState(null);
  const [editing, setEditing] = useState(false);

  const target = who === 'me' ? (user ? String(user.id) : null) : who;
  useEffect(() => {
    if (who === 'me' && !user) { navigate('/login'); return; }
    setP(null);
    setError('');
    api.get(`/community/users/${target}`).then(setP).catch((e) => setError(e.message));
    if (user) loadMe();
  }, [target, who, user, navigate]);

  const loadPosts = useCallback(() => {
    if (!p) return;
    setPosts(null);
    const kind = tab === 'sale' ? '&kind=sell' : '';
    api.get(`/community/feed?author=${p.id}&sort=new${kind}`).then((r) => setPosts(r.posts)).catch(() => setPosts([]));
  }, [p, tab]);
  useEffect(() => { if (tab === 'posts' || tab === 'sale') loadPosts(); }, [tab, loadPosts]);

  async function follow() {
    if (!user) { navigate(`/login?mode=signup&next=/u/${who}`); return; }
    const following = !p.is_following;
    setP({ ...p, is_following: following, followers: p.followers + (following ? 1 : -1) });
    if (following) play('pop');
    try {
      const r = await api.post(`/community/users/${p.id}/follow`, {});
      setP((x) => ({ ...x, is_following: r.following, followers: r.followers }));
    } catch { setP(p); }
  }

  if (error) return <div className="container"><div className="center-empty"><span style={{ fontSize: 34 }}>🫥</span><div className="empty-title">{error}</div><Link to="/feed" className="btn">Back to the feed</Link></div></div>;
  if (!p) return <div className="container feed-page narrow"><div className="profile-skel" /><PostSkeleton /></div>;

  const allBadges = p.isMe && me ? me.badges : p.badges.map((b) => ({ ...b, unlocked: true }));
  const pct = Math.round((p.level.progress || 0) * 100);
  const joined = new Date(p.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="container feed-page narrow">
      <section className="profile-card">
        <div className="pf-cover" aria-hidden="true" />
        <div className="pf-top">
          <span className={`pf-avatar${p.streak >= 3 ? ' hot' : ''}`}><Avatar id={p.id} name={p.name} size={96} /></span>
          <div className="pf-actions">
            {p.isMe
              ? <button type="button" className="btn secondary small" onClick={() => setEditing(true)}>Edit profile</button>
              : <button type="button" className={`btn ${p.is_following ? 'secondary' : 'accent'} small follow-btn`} onClick={follow}>{p.is_following ? '✓ Following' : 'Follow'}</button>}
          </div>
        </div>
        <h1 className="pf-name">{p.name}{p.verified && <VerifiedTick />}</h1>
        <div className="pf-handle">@{p.handle} · joined {joined}</div>
        {p.bio && <p className="pf-bio">{p.bio}</p>}
        <div className="pf-stats">
          <span><b>{compact(p.posts)}</b> post{p.posts === 1 ? '' : 's'}</span>
          <span><b>{compact(p.followers)}</b> follower{p.followers === 1 ? '' : 's'}</span>
          <span><b>{compact(p.following)}</b> following</span>
          <span><b>{compact(p.karma)}</b> reaction{p.karma === 1 ? '' : 's'}</span>
          {p.rentals_hosted > 0 && <span><b>{p.rentals_hosted}</b> rental{p.rentals_hosted === 1 ? '' : 's'} hosted</span>}
        </div>
        <div className="pf-level">
          <div className="pf-level-num"><small>Level</small><b>{p.level.level}</b></div>
          <div className="pf-level-main">
            <div className="pf-level-name"><b>{p.level.name}</b><span className="muted">{p.xp} / {p.level.next} XP</span></div>
            <div className="lc-bar"><i style={{ width: `${pct}%` }} /></div>
          </div>
          <div className={`lc-streak${p.streak ? '' : ' cold'}`}><span>🔥</span><b>{p.streak}</b><small>best {p.best_streak}</small></div>
        </div>
      </section>

      <section className="badge-shelf">
        <h2>Badges <span className="muted">{allBadges.filter((b) => b.unlocked).length}{p.isMe ? `/${allBadges.length}` : ''}</span></h2>
        {allBadges.length === 0 ? <p className="muted">No badges yet.</p> : (
          <div className="badge-grid">
            {allBadges.map((b) => (
              <div key={b.id} className={`badge-tile${b.unlocked ? '' : ' locked'}`} title={b.hint}>
                <span className="bt-icon">{b.unlocked ? b.icon : '🔒'}</span>
                <b>{b.name}</b>
                <small>{b.unlocked ? 'Unlocked' : b.hint}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="feed-tabs" role="tablist">
        {[['posts', 'Posts'], ['sale', '🏷️ For sale'], ['listings', `📦 For rent${p.listings.length ? ` (${p.listings.length})` : ''}`], ['communities', 'Communities']].map(([id, label]) => (
          <button type="button" key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {(tab === 'posts' || tab === 'sale') && (
        posts == null ? <PostSkeleton /> : posts.length === 0 ? (
          <div className="feed-empty"><span className="fe-emoji">🌱</span><b>{p.isMe ? 'Your posts show up here' : 'Nothing here yet'}</b>{p.isMe && <Link to="/feed" className="btn accent">Write your first post</Link>}</div>
        ) : (
          <div className="feed-list">
            {posts.map((x) => <PostCard key={x.id} post={x} onChange={(n) => setPosts((all) => all.map((y) => (y.id === n.id ? n : y)))} onRemove={(id) => setPosts((all) => all.filter((y) => y.id !== id))} />)}
          </div>
        )
      )}
      {tab === 'listings' && (
        p.listings.length === 0 ? <div className="feed-empty"><span className="fe-emoji">📦</span><b>No listings yet</b>{p.isMe && <Link to="/items/new" className="btn accent">List an item (+40 XP)</Link>}</div> : (
          <div className="sale-grid">
            {p.listings.map((it) => (
              <Link key={it.id} to={`/product/${it.id}`} className="sale-tile">
                <span className="st-photo">{it.cover_url ? <img src={it.cover_url} alt="" loading="lazy" style={{ objectFit: 'contain' }} /> : <Icon name="package" size={30} />}</span>
                <b className="st-price">{money(it.rental_price)}<small>/day</small></b>
                <span className="st-title">{it.name}</span>
                <span className="st-meta">{it.status}</span>
              </Link>
            ))}
          </div>
        )
      )}
      {tab === 'communities' && (
        <div className="pick-chips">
          {p.communities.length === 0 ? <p className="muted">Not in any communities yet.</p> : p.communities.map((c) => (
            <Link key={c.slug} to={`/c/${c.slug}`} className="pick-chip">c/{c.slug}</Link>
          ))}
        </div>
      )}

      {editing && <EditProfile p={p} onClose={() => setEditing(false)} onSaved={(np) => { setP({ ...p, ...np }); setEditing(false); if (np.handle !== p.handle) navigate(`/u/${np.handle}`, { replace: true }); }} />}
    </div>
  );
}

function EditProfile({ p, onClose, onSaved }) {
  const [handle, setHandle] = useState(p.handle || '');
  const [bio, setBio] = useState(p.bio || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.patch('/community/me', { handle, bio });
      play('success');
      say('Profile saved', '✓');
      onSaved({ handle: handle.replace(/^@/, '').toLowerCase(), bio });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal narrow" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="panel-head"><h2>Edit profile</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button></div>
        <div className="field"><label>Handle</label><div className="handle-input"><span>@</span><input value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={20} /></div><div className="fieldhint">3–20 letters, numbers or underscores. People mention you with it.</div></div>
        <div className="field"><label>Bio</label><textarea rows={3} value={bio} maxLength={200} onChange={(e) => setBio(e.target.value)} placeholder="What do you rent, shoot, build or love?" /><div className="fieldhint">{200 - bio.length} left</div></div>
        {error && <div className="error">{error}</div>}
        <div className="card-actions"><button type="submit" className="btn" disabled={busy}>Save</button><button type="button" className="btn secondary" onClick={onClose}>Cancel</button></div>
      </form>
    </div>
  );
}
