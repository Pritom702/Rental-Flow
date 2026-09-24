// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: admin-only view of a member's saved identity
// ============================================================
// The NID and selfie a member verified with are saved on their account, and
// only admins can open them — here, from the Admin page. Photos come through
// short-lived signed links, so a copied link stops working after an hour.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';

const dateOf = (iso) => (iso
  ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  : '—');

const DECISION = { verified: 'Verified', pending_review: 'Waiting for review', rejected: 'Rejected', in_progress: 'In progress', retry: 'Retried' };

export default function AdminIdentityModal({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/verify/admin/users/${userId}`).then(setData).catch((e) => setError(e.message));
  }, [userId]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <h2>{data ? data.account.name : 'Identity'}</h2>
            <div className="muted">{data?.account.email} · visible to admins only</div>
          </div>
          <button className="btn ghost small" type="button" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        {!data && !error && <div className="center-empty">Loading…</div>}
        {data && (
          <>
            <div className={`notice ${data.account.verified ? 'ok' : 'warn'}`}>
              <Icon name={data.account.verified ? 'check' : 'shield'} size={18} />
              <div>
                <strong>{data.account.verified ? 'Identity verified' : 'Not verified yet'}</strong>
                <div className="muted" style={{ fontSize: 13.5 }}>
                  {data.account.verified
                    ? `Saved on the account since ${dateOf(data.nid?.submittedAt)}.`
                    : 'This member verifies before their first rental.'}
                </div>
              </div>
            </div>

            {data.nid && (
              <dl className="detail-grid" style={{ marginTop: 14 }}>
                <div><dt>Name on NID</dt><dd>{data.nid.name}</dd></div>
                <div><dt>NID number</dt><dd className="mono">{data.nid.number}</dd></div>
                <div><dt>Date of birth</dt><dd>{data.nid.dob || '—'}</dd></div>
                <div><dt>Verified on</dt><dd>{dateOf(data.nid.submittedAt)}</dd></div>
              </dl>
            )}

            {data.photos && (
              <div className="nid-shots">
                {[['front', 'NID front'], ['back', 'NID back'], ['selfie', 'Live selfie']].map(([k, label]) => data.photos[k] && (
                  <figure key={k}>
                    <a href={data.photos[k]} target="_blank" rel="noreferrer"><img src={data.photos[k]} alt={label} /></a>
                    <figcaption>{label}</figcaption>
                  </figure>
                ))}
              </div>
            )}

            {data.attempts.length > 0 && (
              <>
                <h3 style={{ marginTop: 18 }}>Verification history</h3>
                <table className="data-table">
                  <thead><tr><th>When</th><th>Result</th><th>Face match</th><th>Model</th></tr></thead>
                  <tbody>
                    {data.attempts.map((a) => (
                      <tr key={a.id}>
                        <td className="muted">{dateOf(a.createdAt)}</td>
                        <td>{DECISION[a.decision] || a.decision}{a.reasons.length ? <div className="muted small">{a.reasons[0]}</div> : null}</td>
                        <td>{a.faceDistance == null ? '—' : a.faceDistance.toFixed(2)}</td>
                        <td>{a.riskScore == null ? '—' : `${Math.round(a.riskScore * 100)}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
