// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M4 - Radowanul Haque (Radowan)
//  GitHub: @___  |  Part: Member/Admin dashboard
// ============================================================
// Member/Admin dashboard: manage listings with inline status changes,
// category management, search/filter. Members see only their own listings;
// admins see all. Features 1, 2, 3.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';
import { StatusBadge, TagList, CardPhoto } from '../components.jsx';

const STATUSES = ['Available', 'Rented', 'Damaged', 'Under Maintenance', 'Retired'];

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [newCat, setNewCat] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (!isAdmin) params.set('owner_id', user.id);
    setItems(await api.get(`/items?${params.toString()}`));
  }
  async function loadCats() { setCategories(await api.get('/categories')); }

  useEffect(() => { loadCats(); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search, statusFilter]);

  async function changeStatus(id, status) {
    try { await api.patch(`/items/${id}/status`, { status }); load(); }
    catch (e) { setError(e.message); }
  }
  async function removeItem(id) {
    if (!confirm('Delete this item permanently?')) return;
    try { await api.del(`/items/${id}`); load(); loadCats(); }
    catch (e) { setError(e.message); }
  }
  async function addCategory(e) {
    e.preventDefault();
    if (!newCat.trim()) return;
    try { await api.post('/categories', { name: newCat.trim() }); setNewCat(''); loadCats(); }
    catch (e) { setError(e.message); }
  }

  // Stat tiles (based on the currently loaded set)
  const count = (s) => items.filter((i) => i.status === s).length;
  const stats = [
    { label: 'Total listings', value: items.length, icon: 'package', color: 'var(--primary)' },
    { label: 'Available', value: count('Available'), icon: 'check', color: 'var(--accent)' },
    { label: 'Rented out', value: count('Rented'), icon: 'refresh', color: 'var(--blue)' },
    { label: 'Needs attention', value: count('Damaged') + count('Under Maintenance'), icon: 'tool', color: 'var(--amber)' },
  ];

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>{isAdmin ? 'All Listings' : 'My Listings'}</h1>
          <div className="sub">{isAdmin ? 'Every item across the marketplace.' : 'Manage the equipment you rent out.'}</div>
        </div>
        <Link to="/items/new" className="btn"><Icon name="plus" size={17} /> List an Item</Link>
      </div>

      {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}

      {/* Stat tiles */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 24 }}>
        {stats.map((s) => (
          <div className="card" key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-soft)', color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={s.icon} size={22} />
            </span>
            <div>
              <div style={{ fontFamily: 'Lexend', fontSize: 26, fontWeight: 800 }}>{s.value}</div>
              <div className="muted" style={{ fontSize: 13 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Category management */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="tag" size={18} /> Categories
        </h3>
        <div style={{ marginBottom: 14 }}>
          {categories.map((c) => (
            <span className="tag" key={c.id}>{c.name} · {c.item_count}</span>
          ))}
        </div>
        <form onSubmit={addCategory} style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="New category name"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            style={{ padding: '9px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', flex: '0 1 260px' }}
          />
          <button className="btn small"><Icon name="plus" size={15} /> Add</button>
        </form>
      </div>

      {/* Item toolbar */}
      <div className="toolbar">
        <div className="search-field" style={{ minWidth: 220, flex: '1 1 220px' }}>
          <Icon name="search" size={18} />
          <input placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%' }} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {items.length === 0 ? (
        <div className="center-empty">
          <Icon name="package" size={30} /><br />
          No listings yet. Click “List an Item” to add your first one.
        </div>
      ) : (
        <div className="grid">
          {items.map((it) => (
            <div className="card" key={it.id}>
              <CardPhoto url={it.cover_url} count={it.image_count} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <h3>{it.name}</h3>
                <StatusBadge status={it.status} />
              </div>
              <div className="serial">
                {it.serial_number || '—'} · {it.category_name || 'Uncategorized'}
                {isAdmin && <> · owner: <b>{it.owner_name}</b></>}
              </div>
              <div className="desc">{it.description || 'No description'}</div>
              <TagList tags={it.tags} />
              <div className="price" style={{ marginTop: 10 }}>
                ${Number(it.rental_price).toFixed(2)} <span>/ day · replace ${Number(it.replacement_cost).toFixed(0)}</span>
              </div>

              <div className="card-actions">
                <select
                  value={it.status}
                  onChange={(e) => changeStatus(it.id, e.target.value)}
                  aria-label="Change status"
                  style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <Link to={`/items/${it.id}/edit`} className="btn secondary small">Edit</Link>
                <button className="btn danger small" onClick={() => removeItem(it.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
