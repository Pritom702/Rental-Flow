// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: Account profile — details, NID verification, payment methods, activity
// ============================================================
// One page for every role. A member sees their listings and rentals; an admin
// or staff account sees the same account and identity blocks, so the platform
// team is held to the same verification standard as its members.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';
import { money } from '../money.js';
import NidForm from '../components/NidForm.jsx';
import PaymentMethods from '../components/PaymentMethods.jsx';

const dateOf = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function Profile() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const d = await api.get('/profile');
      setData(d);
      setForm({ name: d.account.name || '', phone: d.account.phone || '' });
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function saveDetails(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/profile', { name: form.name, phone: form.phone });
      setEditing(false);
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  if (error && !data) return <div className="container"><div className="error"><Icon name="shield" size={16} /> {error}</div></div>;
  if (!data) return <div className="container"><div className="center-empty">Loading…</div></div>;

  const { account, nid, paymentMethods, activity } = data;
  const isMember = account.role === 'member';

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>My Profile</h1>
          <div className="sub">Your account details, verified identity, payment methods and activity.</div>
        </div>
      </div>

      {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}

      {/* ---------- Identity banner ---------- */}
      {!nid.onFile && (
        <div className="notice warn">
          <Icon name="shield" size={18} />
          <div>
            <strong>Your identity is not verified yet.</strong>
            <div className="muted" style={{ fontSize: 13.5 }}>
              RentalFlow needs a National ID on file before you can request a booking, so that
              damage and penalty claims can be settled. It is a one-time step.
            </div>
          </div>
        </div>
      )}

      {/* ---------- Account ---------- */}
      <section className="panel">
        <div className="panel-head">
          <h2>Account details</h2>
          {!editing && (
            <button className="btn secondary small" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>

        {editing ? (
          <form onSubmit={saveDetails}>
            <div className="row">
              <div className="field">
                <label>Full name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="field">
                <label>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" />
              </div>
            </div>
            <div className="card-actions">
              <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button className="btn secondary" type="button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <dl className="detail-grid">
            <div><dt>Name</dt><dd>{account.name}</dd></div>
            <div><dt>Email</dt><dd>{account.email}</dd></div>
            <div><dt>Phone</dt><dd>{account.phone || <span className="muted">Not added</span>}</dd></div>
            <div><dt>Role</dt><dd style={{ textTransform: 'capitalize' }}>{account.role}</dd></div>
            <div><dt>Status</dt><dd>
              <span className={`badge ${account.status === 'active' ? 'Available' : 'Retired'}`}>{account.status}</span>
            </dd></div>
            <div><dt>Member since</dt><dd>{dateOf(account.memberSince)}</dd></div>
          </dl>
        )}
      </section>

      {/* ---------- NID ---------- */}
      <section className="panel">
        <div className="panel-head">
          <h2>National ID verification</h2>
          {nid.onFile && <span className="badge Completed">Verified</span>}
        </div>
        {nid.onFile ? (
          <>
            <dl className="detail-grid">
              <div><dt>Name on NID</dt><dd>{nid.name}</dd></div>
              <div><dt>NID number</dt><dd className="mono">{nid.number}</dd></div>
              <div><dt>Submitted</dt><dd>{dateOf(nid.submittedAt)}</dd></div>
            </dl>
            <div className="nid-shots">
              {nid.frontUrl && <figure><img src={nid.frontUrl} alt="NID front" onError={(e) => { e.currentTarget.closest("figure").hidden = true; }} /><figcaption>Front</figcaption></figure>}
              {nid.backUrl && <figure><img src={nid.backUrl} alt="NID back" onError={(e) => { e.currentTarget.closest("figure").hidden = true; }} /><figcaption>Back</figcaption></figure>}
            </div>
            <div className="locked">
              <Icon name="shield" size={15} />
              Your National ID is recorded once and cannot be changed or removed.
              Contact an admin if something is wrong.
            </div>
          </>
        ) : (
          <NidForm onDone={load} />
        )}
      </section>

      {/* ---------- Payment methods ---------- */}
      <section className="panel">
        <div className="panel-head">
          <h2>Payment methods</h2>
          <span className="muted">{paymentMethods.length} on file</span>
        </div>
        <PaymentMethods methods={paymentMethods} onChange={load} />
      </section>

      {/* ---------- Activity ---------- */}
      <section className="panel">
        <div className="panel-head"><h2>Activity</h2></div>
        <div className="stat-row" style={{ marginBottom: 0 }}>
          <div className="stat-tile">
            <div className="stat-label">Listings</div>
            <div className="stat-value">{activity.listings.total}</div>
            <div className="stat-hint">{activity.listings.available} available · {activity.listings.rented} rented out</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Rentals taken</div>
            <div className="stat-value">{activity.bookingsMade.total}</div>
            <div className="stat-hint">{activity.bookingsMade.completed} completed · {activity.bookingsMade.active} active</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Requests received</div>
            <div className="stat-value">{activity.bookingsReceived.total}</div>
            <div className="stat-hint">{activity.bookingsReceived.pending} waiting for your decision</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Fees &amp; penalties paid</div>
            <div className="stat-value">{money(activity.bookingsMade.fees)}</div>
            <div className="stat-hint">late fees and damage charges</div>
          </div>
        </div>
        <div className="card-actions" style={{ marginTop: 16 }}>
          {isMember && <Link to="/dashboard" className="btn secondary small">My listings</Link>}
          <Link to="/bookings" className="btn secondary small">My bookings</Link>
          {activity.bookingsReceived.pending > 0 && (
            <Link to="/bookings" className="btn small">
              Review {activity.bookingsReceived.pending} pending request{activity.bookingsReceived.pending === 1 ? '' : 's'}
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
