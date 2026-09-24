// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: all communities, join in one tap
// ============================================================
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon, categoryIcon } from '../icons.jsx';
import { play } from '../sfx.js';
import { loadMe } from '../social/store.js';
import { compact } from '../social/util.jsx';

export default function Communities() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/community/communities').then(setList).catch(() => setList([])); }, []);

  async function toggle(c, e) {
    e.preventDefault();
    if (!user) { navigate('/login?mode=signup&next=/communities'); return; }
    const joined = !c.joined;
    setList((all) => all.map((x) => (x.slug === c.slug ? { ...x, joined, member_count: x.member_count + (joined ? 1 : -1) } : x)));
    if (joined) play('pop');
    try {
      if (joined) await api.post(`/community/c/${c.slug}/join`, {}); else await api.del(`/community/c/${c.slug}/join`);
      loadMe();
    } catch { setList((all) => all.map((x) => (x.slug === c.slug ? c : x))); }
  }

  const shown = (list || []).filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Communities</h1>
          <div className="sub">One for every kind of gear. Join the ones you care about — they shape your feed.</div>
        </div>
      </div>
      <div className="toolbar">
        <div className="search-field" style={{ flex: '1 1 260px' }}>
          <Icon name="search" size={18} />
          <input placeholder="Find a community…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>
      {list == null ? <div className="page-loading" /> : (
        <div className="community-grid">
          {shown.map((c) => (
            <Link key={c.slug} to={`/c/${c.slug}`} className={`community-tile${c.joined ? ' joined' : ''}`}>
              <span className="ct-icon"><Icon name={categoryIcon(c.name)} size={24} /></span>
              <b>c/{c.slug}</b>
              <span className="ct-desc">{c.description}</span>
              <span className="ct-stats">
                <span>{compact(c.member_count)} members</span>
                {c.posts_this_week > 0 && <span className="ct-hot">🔥 {c.posts_this_week} this week</span>}
                {c.listings > 0 && <span>{c.listings} for rent</span>}
              </span>
              <button type="button" className={`btn small ${c.joined ? 'secondary' : 'accent'}`} onClick={(e) => toggle(c, e)}>{c.joined ? '✓ Joined' : 'Join'}</button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
