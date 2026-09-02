// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: Payment methods — add-only list (a method is permanent)
// ============================================================
// There is deliberately no "Remove" control anywhere in this component. A
// payment method can only be added, made default, or deactivated. The server
// refuses a DELETE and the database blocks it with a trigger, so the UI simply
// never offers something the system would reject.
import { useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';

const KINDS = ['bKash', 'Nagad', 'Rocket', 'Card', 'Bank'];
const MFS = ['bKash', 'Nagad', 'Rocket'];

const placeholderFor = (kind) => {
  if (MFS.includes(kind)) return '01XXXXXXXXX';
  if (kind === 'Card') return '4111 1111 1111 1111';
  return 'Account number';
};

export default function PaymentMethods({ methods = [], onChange }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ kind: 'bKash', account_ref: '', label: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/profile/payment-methods', form);
      setForm({ kind: 'bKash', account_ref: '', label: '' });
      setAdding(false);
      onChange?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function patch(id, body) {
    setError('');
    try {
      await api.patch(`/profile/payment-methods/${id}`, body);
      onChange?.();
    } catch (err) { setError(err.message); }
  }

  return (
    <>
      {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}

      {methods.length === 0 ? (
        <div className="center-empty" style={{ padding: '28px 20px' }}>
          <Icon name="wallet" size={26} />
          <div className="empty-title">No payment method yet</div>
          Add bKash, Nagad, Rocket, a card or a bank account to settle deposits and fees.
        </div>
      ) : (
        <ul className="pm-list">
          {methods.map((m) => (
            <li key={m.id} className={m.is_active ? '' : 'inactive'}>
              <span className="pm-kind">{m.kind}</span>
              <span className="pm-body">
                <span className="pm-label">{m.label}</span>
                <span className="pm-ref mono">{m.account_ref}</span>
              </span>
              <span className="pm-tags">
                {m.is_default && <span className="badge Completed">Default</span>}
                {!m.is_active && <span className="badge Retired">Inactive</span>}
              </span>
              <span className="pm-actions">
                {m.is_active && !m.is_default && (
                  <button className="btn ghost small" onClick={() => patch(m.id, { is_default: true })}>
                    Make default
                  </button>
                )}
                {m.is_active ? (
                  <button className="btn ghost small" onClick={() => patch(m.id, { is_active: false })}>
                    Deactivate
                  </button>
                ) : (
                  <button className="btn ghost small" onClick={() => patch(m.id, { is_active: true })}>
                    Reactivate
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="locked" style={{ margin: '14px 0' }}>
        <Icon name="shield" size={15} />
        A payment method is permanent. It can be deactivated so it is no longer used,
        but it is never deleted — past payments must stay traceable.
      </div>

      {adding ? (
        <form onSubmit={add} className="pm-form">
          <div className="row">
            <div className="field">
              <label>Type</label>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value, account_ref: '' })}>
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{MFS.includes(form.kind) ? 'Wallet number' : form.kind === 'Card' ? 'Card number' : 'Account number'}</label>
              <input
                value={form.account_ref}
                onChange={(e) => setForm({ ...form, account_ref: e.target.value })}
                placeholder={placeholderFor(form.kind)}
                inputMode="numeric"
                required
              />
              <div className="fieldhint">Stored masked — we never keep the full number.</div>
            </div>
          </div>
          <div className="field">
            <label>Label <span className="muted">optional</span></label>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. Personal bKash"
            />
          </div>
          <div className="card-actions">
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add permanently'}</button>
            <button className="btn secondary" type="button" onClick={() => { setAdding(false); setError(''); }}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className="btn secondary small" onClick={() => setAdding(true)}>
          <Icon name="plus" size={14} /> Add payment method
        </button>
      )}
    </>
  );
}
