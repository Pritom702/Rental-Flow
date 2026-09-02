// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M1 - Md. Safinuzzaman (Shafin)
//  GitHub: @shaafin01  |  Part: List/Edit item form (multi-image, tags, accessories)
// ============================================================
// Create / edit an item (Features 1, 2, 3, 5).
// Handles: catalog fields, category, tags (comma separated), status, and
// linked accessories (comma separated).
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';

const STATUSES = ['Available', 'Rented', 'Damaged', 'Under Maintenance', 'Retired'];
const empty = {
  name: '', description: '', serial_number: '', rental_price: '',
  replacement_cost: '', status: 'Available', category_id: '',
  tags: '', accessories: '',
};

export default function ItemForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [images, setImages] = useState([]); // array of URL strings
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function onPickImages(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-picking the same file
    if (!files.length) return;
    setError('');
    setUploading(true);
    try {
      const { urls } = await api.uploadImages(files);
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url) {
    setImages((prev) => prev.filter((u) => u !== url));
  }

  useEffect(() => { api.get('/categories').then(setCategories); }, []);

  useEffect(() => {
    if (!editing) return;
    api.get(`/items/${id}`).then((it) => {
      setForm({
        name: it.name || '',
        description: it.description || '',
        serial_number: it.serial_number || '',
        rental_price: it.rental_price ?? '',
        replacement_cost: it.replacement_cost ?? '',
        status: it.status || 'Available',
        category_id: it.category_id || '',
        tags: (it.tags || []).map((t) => t.name).join(', '),
        accessories: (it.accessories || []).map((a) => a.name).join(', '),
      });
      setImages((it.images || []).map((img) => img.url));
    }).catch((e) => setError(e.message));
  }, [id, editing]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const payload = {
      name: form.name,
      description: form.description || null,
      serial_number: form.serial_number || null,
      rental_price: form.rental_price === '' ? 0 : Number(form.rental_price),
      replacement_cost: form.replacement_cost === '' ? 0 : Number(form.replacement_cost),
      status: form.status,
      category_id: form.category_id ? Number(form.category_id) : null,
      tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
      accessories: form.accessories.split(',').map((s) => s.trim()).filter(Boolean),
      images,
    };
    try {
      if (editing) await api.put(`/items/${id}`, payload);
      else await api.post('/items', payload);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>{editing ? 'Edit listing' : 'List an item'}</h1>
          <div className="sub">{editing ? 'Update the details of your listing.' : 'Add a new item to the marketplace.'}</div>
        </div>
      </div>
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label>Name *</label>
          <input value={form.name} onChange={set('name')} required />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea rows={3} value={form.description} onChange={set('description')} />
        </div>
        <div className="row">
          <div className="field">
            <label>Serial number</label>
            <input value={form.serial_number} onChange={set('serial_number')} />
          </div>
          <div className="field">
            <label>Category</label>
            <select value={form.category_id} onChange={set('category_id')}>
              <option value="">Uncategorized</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Rental price / day (৳)</label>
            <input type="number" step="0.01" value={form.rental_price} onChange={set('rental_price')} />
          </div>
          <div className="field">
            <label>Replacement cost (৳)</label>
            <input type="number" step="0.01" value={form.replacement_cost} onChange={set('replacement_cost')} />
          </div>
        </div>
        <div className="field">
          <label>Status</label>
          <select value={form.status} onChange={set('status')}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Product photos (upload from your device — you can select multiple)</label>
          <input type="file" accept="image/*" multiple onChange={onPickImages} />
          {uploading && <div className="muted" style={{ marginTop: 6 }}>Uploading…</div>}
          {images.length > 0 && (
            <div className="image-grid">
              {images.map((url, i) => (
                <div className="thumb" key={url}>
                  <img src={url} alt={`product ${i + 1}`} />
                  {i === 0 && <span className="cover-tag">Cover</span>}
                  <button type="button" className="thumb-remove" onClick={() => removeImage(url)} title="Remove">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="field">
          <label>Tags (comma separated)</label>
          <input value={form.tags} onChange={set('tags')} placeholder="camera, lens, accessory" />
        </div>
        <div className="field">
          <label>Accessories (comma separated)</label>
          <input value={form.accessories} onChange={set('accessories')} placeholder="Battery, Charger, Tripod" />
        </div>

        {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" disabled={uploading}>
            <Icon name="check" size={16} /> {editing ? 'Save changes' : 'Create listing'}
          </button>
          <button type="button" className="btn secondary" onClick={() => navigate('/dashboard')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
