// ============================================================
//  RentalFlow  |  Rental protection  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: admin — incidents, disputes, unpaid balances, blacklist
// ============================================================
// Where admins handle what goes wrong after a hand-over:
//   Overdue   rentals 2+ days late (the renter is frozen; the guarantor is listed)
//   Missing   items reported not returned (renter banned, identity blacklisted)
//   Disputes  a renter disagrees with damage charges → the admin sets the amount
// plus every balance still unpaid and the identity blacklist.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { money } from '../money.js';
import { exportIncidentReportPdf } from '../incidentPdf.js';

const KIND = { overdue: 'Overdue 48 h+', missing: 'Reported missing', dispute: 'Disputed charges' };
const when = (v) => (v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

function IncidentCard({ n, onDone, onError }) {
  const [charges, setCharges] = useState(n.charges ?? '');
  const [notes, setNotes] = useState('');
  const [resolution, setResolution] = useState('');
  const [liftBan, setLiftBan] = useState(false);
  const [busy, setBusy] = useState(false);
  async function act(fn, msg) {
    setBusy(true);
    try { await fn(); onDone(msg); } catch (e) { onError(e.message); } finally { setBusy(false); }
  }
  return (
    <div className={`card incident ${n.status}`}>
      <div className="protect-row">
        <span className={`badge incident-kind ${n.kind}`}>{KIND[n.kind]}</span>
        <span className={`badge ${n.status === 'open' ? 'Pending' : 'Completed'}`}>{n.status}</span>
      </div>
      <h3>{n.item_name}</h3>
      <p className="desc">{n.summary}</p>
      <dl className="product-facts">
        <div><dt>Renter</dt><dd>{n.customer_name}<br /><span className="muted">{n.customer_email}</span></dd></div>
        <div><dt>Owner</dt><dd>{n.owner_name}</dd></div>
        <div><dt>Due</dt><dd>{String(n.end_date).slice(0, 10)}{n.hours_late > 0 && n.booking_status !== 'Completed' && <span className="owed"> · {n.hours_late} h late</span>}</dd></div>
        <div><dt>Deposit / value</dt><dd>{money(n.deposit_amount)} / {money(n.replacement_cost)}</dd></div>
        {n.guarantor_name && <div><dt>Guarantor</dt><dd>{n.guarantor_name} ({n.guarantor_relation})<br /><a href={`tel:${n.guarantor_phone}`}>{n.guarantor_phone}</a></dd></div>}
        <div><dt>Renter account</dt><dd>{n.renter_status || '—'}</dd></div>
        {n.claim_id && <div><dt>Claim</dt><dd>{money(n.charges)} · {n.claim_status}{Number(n.balance) > 0 && <span className="owed"> · {money(n.balance)} owed</span>}</dd></div>}
      </dl>
      {n.renter_response && <p className="muted">Renter says: “{n.renter_response}”</p>}

      {n.status === 'open' && n.kind === 'dispute' && n.claim_status === 'disputed' && (
        <div className="protect-box">
          <b>Decide the charges</b>
          <p className="muted">Compare the pick-up and return photos on the booking, then set what the renter pays in total. The deposit covers it first.</p>
          <div className="row">
            <div className="field"><label>Final charges (৳)</label>
              <input type="number" min="0" value={charges} onChange={(e) => setCharges(e.target.value)} /></div>
            <div className="field"><label>Note to both sides</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. scratch was already there at pick-up" /></div>
          </div>
          <button className="btn small" disabled={busy} onClick={() => act(() => api.post(`/protection/claims/${n.claim_id}/decide`, { charges: Number(charges), notes }), 'Decision sent to both sides')}>Set charges</button>
        </div>
      )}

      {n.status === 'open' && n.kind !== 'dispute' && (
        <div className="protect-box">
          <b>Resolve</b>
          <textarea rows={2} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="e.g. item returned to the owner on 25 Sep" />
          {n.renter_status === 'suspended' && (
            <label className="check-line"><input type="checkbox" checked={liftBan} onChange={(e) => setLiftBan(e.target.checked)} /> The item came back — lift the ban and the identity blacklist</label>
          )}
          <button className="btn small" disabled={busy} onClick={() => act(() => api.post(`/protection/incidents/${n.id}/resolve`, { resolution, lift_ban: liftBan }), 'Incident resolved')}>Mark resolved</button>
        </div>
      )}
      {n.status === 'resolved' && <p className="muted">Resolved {when(n.resolved_at)} — {n.resolution}</p>}

      <div className="card-actions">
        {(n.kind === 'missing' || n.kind === 'overdue') && (
          <button className="btn secondary small" disabled={busy} onClick={() => act(async () => exportIncidentReportPdf(await api.get(`/protection/report/${n.booking_id}`)), 'Incident report downloaded')}>
            <Icon name="file" size={14} /> Police report (admin copy)
          </button>
        )}
      </div>
    </div>
  );
}

export default function Incidents() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const load = () => api.get('/protection/incidents').then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const done = (m) => { setError(''); setSuccess(m); load(); };
  const fail = (m) => { setSuccess(''); setError(m); };

  if (!data) return <div className="container">{error ? <div className="error">{error}</div> : <div className="center-empty">Loading…</div>}</div>;
  const open = data.incidents.filter((n) => n.status === 'open');
  const closed = data.incidents.filter((n) => n.status !== 'open');

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Incidents</h1>
          <div className="sub">Late returns, missing items, disputed damage and unpaid balances.</div>
        </div>
        <button className="btn secondary" onClick={() => api.post('/protection/escalate', {}).then((r) => done(`Checked ${r.checked} rental(s) out with renters; ${r.moved} moved to a new stage`)).catch((e) => fail(e.message))}>
          <Icon name="calendar" size={15} /> Run overdue checks now
        </button>
      </div>
      {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}
      {success && <div className="success"><Icon name="check" size={16} /> {success}</div>}

      <h2 className="section-title">Open <span className="muted">({open.length})</span></h2>
      {open.length ? (
        <div className="grid">{open.map((n) => <IncidentCard key={n.id} n={n} onDone={done} onError={fail} />)}</div>
      ) : <div className="center-empty">Nothing needs attention.</div>}

      <h2 className="section-title">Unpaid balances <span className="muted">({data.unpaid.length})</span></h2>
      {data.unpaid.length ? (
        <table className="data-table">
          <thead><tr><th>Renter</th><th>Item</th><th>Charged</th><th>Owed</th><th /></tr></thead>
          <tbody>
            {data.unpaid.map((c) => (
              <tr key={c.id}>
                <td>{c.customer_name}<div className="muted small">{c.customer_email}</div></td>
                <td>{c.item_name}</td>
                <td className="num">{money(c.charges)}</td>
                <td className="num owed">{money(c.balance)}</td>
                <td><button className="btn secondary small" onClick={() => api.post(`/protection/claims/${c.id}/paid`, {}).then(() => done('Marked as paid')).catch((e) => fail(e.message))}>Mark paid</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="center-empty">No unpaid balances. Renters who owe money cannot rent again until they pay.</div>}

      <h2 className="section-title">Blacklisted identities <span className="muted">({data.blacklist.length})</span></h2>
      {data.blacklist.length ? (
        <table className="data-table">
          <thead><tr><th>Person</th><th>Why</th><th>Since</th></tr></thead>
          <tbody>
            {data.blacklist.map((l) => (
              <tr key={l.id}><td>{l.name || '—'}<div className="muted small">{l.email}</div></td><td>{l.reason}</td><td>{when(l.created_at)}</td></tr>
            ))}
          </tbody>
        </table>
      ) : <div className="center-empty">No one is blacklisted. A new account with a blacklisted NID or face is refused automatically.</div>}

      {closed.length > 0 && (
        <>
          <h2 className="section-title">Resolved <span className="muted">({closed.length})</span></h2>
          <div className="grid">{closed.map((n) => <IncidentCard key={n.id} n={n} onDone={done} onError={fail} />)}</div>
        </>
      )}
    </div>
  );
}
