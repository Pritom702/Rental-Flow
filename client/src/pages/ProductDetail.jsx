// ============================================================
//  RentalFlow  |  Marketplace  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: full product page
// ============================================================
// Everything about one listing: every photo, the full description, what comes
// with it, and two ways forward — request a booking, or ask the lister first.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';
import { StatusBadge, TagList } from '../components.jsx';
import { money } from '../money.js';

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  // Arriving from a card, show what the card already knew straight away (so the
  // photo can fly in); the full listing replaces it a moment later.
  const preview = state?.preview && String(state.preview.id) === String(id) ? state.preview : null;
  const [item, setItem] = useState(preview);
  const [photo, setPhoto] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setItem((cur) => (cur && String(cur.id) === String(id) ? cur : null));
    setPhoto(0);
    api.get(`/items/${id}`).then(setItem).catch((e) => setError(e.message));
  }, [id]);

  async function messageLister() {
    if (!user) return navigate('/login');
    setBusy(true);
    try {
      const { id: conversationId } = await api.post('/messages/conversations', { item_id: item.id });
      navigate(`/messages/${conversationId}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (error && !item) return <div className="container"><div className="error">{error}</div></div>;
  if (!item) return <div className="container"><p className="muted">Loading…</p></div>;

  const images = item.images?.length ? item.images : item.cover_url ? [{ id: 'cover', url: item.cover_url }] : [];
  const mine = user && user.id === item.owner_id;
  const available = item.status === 'Available';

  return (
    <div className="container product-page">
      <Link to="/browse" className="btn ghost small">← All listings</Link>

      <div className="product-layout">
        <section className="product-gallery">
          <div className="product-main-photo">
            {images.length
              ? <img src={images[photo].url} alt={item.name} />
              : <div className="no-photo"><Icon name="camera" size={34} /><span>No photos yet</span></div>}
          </div>
          {images.length > 1 && (
            <div className="product-thumbs">
              {images.map((img, i) => (
                <button key={img.id} type="button" className={i === photo ? 'on' : ''} onClick={() => setPhoto(i)}
                  aria-label={`Photo ${i + 1}`}>
                  <img src={img.url} alt="" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="product-info">
          <div className="product-title">
            <h1>{item.name}</h1>
            <StatusBadge status={item.status} />
          </div>
          <div className="product-price">{money(item.rental_price)} <span>/ day</span></div>
          <div className="muted">
            Listed by <b>{item.owner_name || 'Unknown'}</b>
            {item.category_name && <> · {item.category_name}</>}
          </div>

          <div className="product-actions">
            {!mine && (
              <button className="btn accent lg" disabled={!available}
                onClick={() => navigate(user
                  ? `/browse?item=${item.id}`
                  : `/login?mode=signup&next=${encodeURIComponent(`/browse?item=${item.id}`)}`)}>
                <Icon name="calendar" size={16} /> {available ? 'Request booking' : 'Not available right now'}
              </button>
            )}
            {!mine && (
              <button className="btn secondary lg" disabled={busy} onClick={messageLister}>
                <Icon name="chat" size={16} /> Message the lister
              </button>
            )}
            {mine && (
              <Link to={`/items/${item.id}/edit`} className="btn secondary lg">Edit your listing</Link>
            )}
          </div>
          {error && <div className="error">{error}</div>}

          <h2 className="product-h">Description</h2>
          <p className="product-description">{item.description || 'The lister has not written a description yet.'}</p>

          {item.accessories?.length > 0 && (
            <>
              <h2 className="product-h">Comes with</h2>
              <ul className="product-list">
                {item.accessories.map((a) => <li key={a.id}><Icon name="check" size={15} /> {a.name}</li>)}
              </ul>
            </>
          )}

          <h2 className="product-h">Details</h2>
          <dl className="product-facts">
            <div><dt>Daily price</dt><dd>{money(item.rental_price)}</dd></div>
            {item.replacement_cost != null && <div><dt>Replacement value</dt><dd>{money(item.replacement_cost)}</dd></div>}
            {item.serial_number && <div><dt>Serial number</dt><dd>{item.serial_number}</dd></div>}
            <div><dt>Status</dt><dd>{item.status}</dd></div>
          </dl>
          <TagList tags={item.tags} />
        </section>
      </div>
    </div>
  );
}
