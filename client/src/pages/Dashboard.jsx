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
import QrModal from '../components/QrModal.jsx';
import { money, moneyRound } from '../money.js';

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
  const [qrItem, setQrItem] = useState(null);
  const [showCats, setShowCats] = useState(false);

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
    { label: 'Total listings', value: items.length, icon: 'package', color: 'var(--text-2)' },
    { label: 'Available', value: count('Available'), icon: 'check', color: 'var(--green)' },
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
      <div className="stat-row">
        {stats.map((s) => (
          <div className="stat-tile with-icon" key={s.label}>
            <span className="stat-icon" style={{ color: s.color }}>
              <Icon name={s.icon} size={19} />
            </span>
            <div>
              <div className="stat-value" style={{ marginTop: 0, fontSize: 24 }}>{s.value}</div>
              <div className="stat-label" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12.5, fontWeight: 500 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Category management — collapsed by default so it stops dominating the page */}
      <div className="panel">
        <div className="panel-head" style={{ marginBottom: showCats ? 16 : 0 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="tag" size={16} /> Categories
            <span className="muted" style={{ fontWeight: 400 }}>({categories.length})</span>
          </h3>
          <button className="btn ghost small" type="button" onClick={() => setShowCats((v) => !v)}>
            {showCats ? 'Hide' : 'Manage'}
          </button>
        </div>
        {showCats && (
          <>
            <div style={{ marginBottom: 14 }}>
              {[...categories]
                .sort((a, b) => b.item_count - a.item_count || a.name.localeCompare(b.name))
                .map((c) => (
                  <span className="tag" key={c.id}>{c.name} · {c.item_count}</span>
                ))}
            </div>
            <form onSubmit={addCategory} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div className="field" style={{ margin: 0, flex: '0 1 260px' }}>
                <input
                  placeholder="New category name"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                />
              </div>
              <button className="btn small"><Icon name="plus" size={14} /> Add</button>
            </form>
          </>
        )}
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
          <Icon name="package" size={30} />
          <div className="empty-title">
            {search || statusFilter ? 'No listings match those filters' : 'No listings yet'}
          </div>
          {search || statusFilter
            ? 'Try a different search term or status.'
            : 'List your first piece of equipment and it will show up here.'}
          <div>
            {search || statusFilter ? (
              <button className="btn secondary" type="button" onClick={() => { setSearch(''); setStatusFilter(''); }}>
                Clear filters
              </button>
            ) : (
              <Link to="/items/new" className="btn"><Icon name="plus" size={16} /> List an Item</Link>
            )}
          </div>
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
                {money(it.rental_price)} <span>/ day · replace {moneyRound(it.replacement_cost)}</span>
              </div>

              <div className="card-actions">
                <select
                  value={it.status}
                  onChange={(e) => changeStatus(it.id, e.target.value)}
                  aria-label="Change status"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <Link to={`/items/${it.id}/edit`} className="btn secondary small">Edit</Link>
                <button className="btn secondary small" onClick={() => setQrItem(it)}><Icon name="package" size={14} /> QR</button>
                <button className="btn danger small" onClick={() => removeItem(it.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {qrItem && <QrModal item={qrItem} onClose={() => setQrItem(null)} />}
    </div>
  );
}
