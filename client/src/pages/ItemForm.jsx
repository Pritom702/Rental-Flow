// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M1 - Md. Safinuzzaman (Shafin)
//  GitHub: @shaafin01  |  Part: List/Edit item form (multi-image, tags, accessories)
// ============================================================
// Create / edit an item (Features 1, 2, 3, 5).
// Handles: catalog fields, category, tags (comma separated), status, and
// linked accessories (comma separated).
import { useEffect, useRef, useState } from 'react';
import { celebrate } from '../fx.js';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';

const STATUSES = ['Available', 'Rented', 'Damaged', 'Under Maintenance', 'Retired'];
const empty = {
  name: '', description: '', serial_number: '', rental_price: '',
  replacement_cost: '', status: 'Available', category_id: '',
  tags: '', accessories: '',
};

// Unsaved work survives a refresh, a closed tab or a dropped connection: every
// change is written to this browser as a draft (one per account and per
// listing), restored on the next visit, and cleared once the listing is saved.
function draftKey(userId, itemId) {
  return `rentalflow_listing_draft_${userId || 'guest'}_${itemId || 'new'}`;
}
function readDraft(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeDraft(key, draft) {
  try { localStorage.setItem(key, JSON.stringify(draft)); } catch { /* storage full or blocked */ }
}
function clearDraft(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export default function ItemForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const key = draftKey(user?.id, id);
  const [form, setForm] = useState(empty);
  const [images, setImages] = useState([]); // array of URL strings
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [restored, setRestored] = useState(false);

  // A draft is written only after the member actually changes something, so
  // opening the form (or loading a listing to edit) never counts as a draft.
  const touched = useRef(false);

  const set = (k) => (e) => {
    touched.current = true;
    setForm({ ...form, [k]: e.target.value });
  };

  async function onPickImages(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-picking the same file
    if (!files.length) return;
    setError('');
    setUploading(true);
    try {
      const { urls } = await api.uploadImages(files);
      touched.current = true;
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url) {
    touched.current = true;
    setImages((prev) => prev.filter((u) => u !== url));
  }

  useEffect(() => { api.get('/categories').then(setCategories); }, []);

  // New listing: start from the draft, if there is one.
  useEffect(() => {
    if (editing) return;
    const draft = readDraft(key);
    if (draft) {
      setForm({ ...empty, ...draft.form });
      setImages(draft.images || []);
      setRestored(true);
    }
  }, [editing, key]);

  // Save a draft on every change the member makes.
  useEffect(() => {
    if (touched.current) writeDraft(key, { form, images, savedAt: Date.now() });
  }, [form, images, key]);

  function discardDraft() {
    touched.current = false;
    clearDraft(key);
    setRestored(false);
    if (editing) {
      loadItem().catch((e) => setError(e.message));
    } else {
      setForm(empty);
      setImages([]);
    }
  }

  function loadItem() {
    return api.get(`/items/${id}`).then((it) => {
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
    });
  }

  // Editing: load the saved listing, then lay any unsaved changes over it.
  useEffect(() => {
    if (!editing) return;
    loadItem().then(() => {
      const draft = readDraft(key);
      if (draft) {
        setForm((f) => ({ ...f, ...draft.form }));
        setImages(draft.images || []);
        setRestored(true);
      }
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, editing, key]);

  async function submit(e) {
    e.preventDefault();
    if (saving) return;   // a second tap while saving would create a duplicate
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
    setSaving(true);
    try {
      if (editing) await api.put(`/items/${id}`, payload);
      else await api.post('/items', payload);
      touched.current = false;
      clearDraft(key);
      celebrate();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      setSaving(false);
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
      {restored && (
        <div className="hint" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, maxWidth: 720 }}>
          <span><b>Restored your unsaved {editing ? 'changes' : 'listing'}.</b> Everything you typed before is back.</span>
          <button type="button" className="btn ghost small" onClick={discardDraft}>Discard</button>
        </div>
      )}
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
          <button className="btn" disabled={uploading || saving}>
            <Icon name="check" size={16} /> {saving ? 'Saving…' : editing ? 'Save changes' : 'Create listing'}
          </button>
          <button type="button" className="btn secondary" onClick={() => { clearDraft(key); navigate('/dashboard'); }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
