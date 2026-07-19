// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Public browse/marketplace page (search, filter)
// ============================================================
// Public marketplace page: browse items listed by members, filter by category,
// see price + availability + owner. Reads initial search/category from the URL
// (the landing page links here with query params).
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { StatusBadge, TagList, CardPhoto } from '../components.jsx';

export default function PublicBooking() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState(params.get('search') || '');
  const [categoryId, setCategoryId] = useState(params.get('category_id') || '');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (categoryId) q.set('category_id', categoryId);
    const data = await api.get(`/items?${q.toString()}`);
    setItems(data);
    setLoading(false);
    // keep the URL in sync so the view is shareable
    setParams(q, { replace: true });
  }

  useEffect(() => { api.get('/categories').then(setCategories); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search, categoryId]);

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Rental Marketplace</h1>
          <div className="sub">Browse equipment listed by members and check availability.</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-field" style={{ minWidth: 240, flex: '1 1 240px' }}>
          <Icon name="search" size={18} />
          <input
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.item_count})</option>
          ))}
        </select>
        <span className="muted">{items.length} result{items.length === 1 ? '' : 's'}</span>
      </div>

      {loading ? (
        <div className="center-empty">Loading…</div>
      ) : items.length === 0 ? (
        <div className="center-empty">No items match your search.</div>
      ) : (
        <div className="grid">
          {items.map((it) => (
            <div className="card" key={it.id}>
              <CardPhoto url={it.cover_url} count={it.image_count} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <h3>{it.name}</h3>
                <StatusBadge status={it.status} />
              </div>
              <div className="serial">Listed by <b>{it.owner_name || 'Unknown'}</b></div>
              <div className="desc">{it.description || 'No description'}</div>
              <TagList tags={it.tags} />
              <div className="price" style={{ marginTop: 12 }}>
                ${Number(it.rental_price).toFixed(2)} <span>/ day</span>
              </div>
              <div className="card-actions">
                <button
                  className="btn accent small"
                  disabled={it.status !== 'Available'}
                  title={it.status !== 'Available' ? 'Not available right now' : 'Request a booking'}
                >
                  <Icon name="calendar" size={15} />
                  {it.status === 'Available' ? 'Request Booking' : 'Unavailable'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
