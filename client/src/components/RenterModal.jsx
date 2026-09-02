// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: Renter identity check, shown before approving/rejecting a booking
// ============================================================
// Opened from the Bookings page. Shows who is behind a request — their verified
// National ID, their account, and their rental track record — so the owner (or
// an admin) can make an informed decision instead of approving a name and an
// email address. The look-up itself is recorded in the audit log by the server.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { money } from '../money.js';

const dateOf = (iso) => (iso
  ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  : '—');

export default function RenterModal({ bookingId, onClose, onDecide }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [deciding, setDeciding] = useState('');

  useEffect(() => {
    api.get(`/bookings/${bookingId}/renter`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [bookingId]);

  async function decide(status) {
    setDeciding(status);
    try {
      await onDecide(status);
      onClose();
    } catch (err) {
      setError(err.message);
      setDeciding('');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <h2>Who is renting this?</h2>
            <div className="muted">
              Check the identity and history before you approve.
            </div>
          </div>
          <button className="btn ghost small" type="button" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>

        {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}
        {!data && !error && <div className="center-empty">Loading…</div>}

        {data && (
          <>
            {/* ---- Verification verdict, first and largest ---- */}
            {data.nid.onFile ? (
              <div className="notice ok">
                <Icon name="check" size={18} />
                <div>
                  <strong>Identity verified</strong>
                  <div className="muted" style={{ fontSize: 13.5 }}>
                    A National ID has been on file since {dateOf(data.nid.submittedAt)}.
                  </div>
                </div>
              </div>
            ) : (
              <div className="notice warn">
                <Icon name="shield" size={18} />
                <div>
                  <strong>No National ID on file</strong>
                  <div className="muted" style={{ fontSize: 13.5 }}>
                    This request predates identity verification, or was made by a guest.
                    You would have no verified identity to pursue a damage claim against.
                  </div>
                </div>
              </div>
            )}

            {/* ---- The booking under decision ---- */}
            <h3 style={{ marginTop: 18 }}>This request</h3>
            <dl className="detail-grid">
              <div><dt>Item</dt><dd>{data.booking.item_name}</dd></div>
              <div><dt>Dates</dt><dd>{data.booking.start_date} → {data.booking.end_date}</dd></div>
              <div><dt>Deposit held</dt><dd>{money(data.booking.deposit_amount)}</dd></div>
              <div><dt>Item value at risk</dt><dd>{money(data.booking.replacement_cost)}</dd></div>
            </dl>
            {data.booking.notes && (
              <p className="muted" style={{ marginTop: 10 }}><b>Their note:</b> {data.booking.notes}</p>
            )}

            {/* ---- Contact + account ---- */}
            <h3 style={{ marginTop: 20 }}>Contact &amp; account</h3>
            <dl className="detail-grid">
              <div><dt>Booked as</dt><dd>{data.contact.name}</dd></div>
              <div><dt>Email</dt><dd>{data.contact.email}</dd></div>
              <div><dt>Phone</dt><dd>{data.contact.phone || <span className="muted">Not provided</span>}</dd></div>
              <div><dt>Account</dt><dd>
                {data.account.exists
                  ? <>{data.account.name} · <span className={`badge ${data.account.status === 'active' ? 'Available' : 'Retired'}`}>{data.account.status}</span></>
                  : <span className="warn-text">No account with this email</span>}
              </dd></div>
              {data.account.exists && (
                <div><dt>Member since</dt><dd>{dateOf(data.account.memberSince)}</dd></div>
              )}
            </dl>

            {/* ---- The NID itself ---- */}
            {data.nid.onFile && (
              <>
                <h3 style={{ marginTop: 20 }}>National ID</h3>
                <dl className="detail-grid">
                  <div><dt>Name on NID</dt><dd>{data.nid.name}</dd></div>
                  <div><dt>NID number</dt><dd className="mono">{data.nid.number}</dd></div>
                </dl>
                {/* A different name on the card than on the booking is worth noticing. */}
                {data.nid.name && data.contact.name
                  && data.nid.name.trim().toLowerCase() !== data.contact.name.trim().toLowerCase() && (
                  <div className="notice warn" style={{ marginTop: 12 }}>
                    <Icon name="shield" size={18} />
                    <div>
                      <strong>Name mismatch</strong>
                      <div className="muted" style={{ fontSize: 13.5 }}>
                        They booked as “{data.contact.name}” but the NID reads “{data.nid.name}”.
                      </div>
                    </div>
                  </div>
                )}
                <div className="nid-shots">
                  {data.nid.frontUrl && (
                    <figure>
                      <a href={data.nid.frontUrl} target="_blank" rel="noreferrer">
                        <img src={data.nid.frontUrl} alt="NID front" />
                      </a>
                      <figcaption>Front · click to enlarge</figcaption>
                    </figure>
                  )}
                  {data.nid.backUrl && (
                    <figure>
                      <a href={data.nid.backUrl} target="_blank" rel="noreferrer">
                        <img src={data.nid.backUrl} alt="NID back" />
                      </a>
                      <figcaption>Back · click to enlarge</figcaption>
                    </figure>
                  )}
                </div>
              </>
            )}

            {/* ---- Track record ---- */}
            {data.profile && (
              <>
                <h3 style={{ marginTop: 22 }}>Track record</h3>
                <div className="stat-row compact" style={{ marginBottom: 14 }}>
                  <div className="stat-tile">
                    <div className="stat-label">Rentals</div>
                    <div className="stat-value">{data.profile.bookingCount}</div>
                  </div>
                  {/* Reliability is only meaningful once something has actually
                      been returned. A brand-new renter scores 100 by default, so
                      showing "Excellent" here would overstate what we know. */}
                  <div className="stat-tile">
                    <div className="stat-label">Reliability</div>
                    {data.history.some((h) => h.status === 'Completed') ? (
                      <>
                        <div className="stat-value">{data.profile.reliability}%</div>
                        <div className="stat-hint">{data.profile.reliabilityLabel}</div>
                      </>
                    ) : (
                      <>
                        <div className="stat-value">—</div>
                        <div className="stat-hint">no completed rentals yet</div>
                      </>
                    )}
                  </div>
                  <div className="stat-tile">
                    <div className="stat-label">Tier</div>
                    <div className="stat-value">{data.profile.tier}</div>
                  </div>
                  <div className="stat-tile">
                    <div className="stat-label">Lifetime spend</div>
                    <div className="stat-value">{money(data.profile.totalSpend)}</div>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>Item</th><th>Dates</th><th>Status</th><th className="num">Fees charged</th></tr>
                    </thead>
                    <tbody>
                      {data.history.slice(0, 8).map((h) => {
                        const fees = Number(h.late_fee_amount || 0) + Number(h.penalty_amount || 0);
                        return (
                          <tr key={h.id}>
                            <td>{h.item_name}</td>
                            <td className="muted">{h.start_date} → {h.end_date}</td>
                            <td><span className={`badge ${h.status}`}>{h.status}</span></td>
                            <td className="num">
                              {fees > 0 ? <span className="warn-text">{money(fees)}</span> : <span className="muted">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ---- Decide, right here ---- */}
            {data.booking.status === 'Pending' && (
              <div className="card-actions" style={{ marginTop: 20 }}>
                <button className="btn" disabled={!!deciding} onClick={() => decide('Approved')}>
                  {deciding === 'Approved' ? 'Approving…' : 'Approve booking'}
                </button>
                <button className="btn danger" disabled={!!deciding} onClick={() => decide('Rejected')}>
                  {deciding === 'Rejected' ? 'Rejecting…' : 'Reject'}
                </button>
                <button className="btn secondary" type="button" onClick={onClose}>Decide later</button>
              </div>
            )}

            <div className="locked" style={{ marginTop: 16 }}>
              <Icon name="shield" size={15} />
              This identity was shown to you so you can settle a damage claim if one arises.
              Your access has been recorded in the audit log.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
