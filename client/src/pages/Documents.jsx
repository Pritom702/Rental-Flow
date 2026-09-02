// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M3 - Promit Ghosh Turjo (Promit)
//  Part: F15 Document centre — reprint agreements, return summaries, statements
// ============================================================
// Sprint 3 could only download a document from the booking that produced it.
// Sprint 4 collects every issued document in one place so staff can re-issue an
// agreement, a return summary, or a whole customer statement on request.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { StatTile } from '../components/Charts.jsx';
import { exportAgreementPdf, exportReturnSummaryPdf, exportCustomerStatementPdf } from '../pdf.js';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const FILTERS = [
  { key: 'all', label: 'All documents' },
  { key: 'agreement', label: 'Agreements' },
  { key: 'return', label: 'Return summaries' },
];

// A document only exists once the booking has reached the stage that produces it.
function documentsFor(booking) {
  const docs = [];
  if (['Approved', 'Completed'].includes(booking.status) || booking.agreement_number) docs.push('agreement');
  if (booking.checked_in_at) docs.push('return');
  return docs;
}

export default function Documents() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    api.get('/bookings')
      .then(setBookings)
      .catch((err) => setError(err.message));
  }, []);

  const rows = bookings
    .map((b) => ({ ...b, docs: documentsFor(b) }))
    .filter((b) => b.docs.length)
    .filter((b) => filter === 'all' || b.docs.includes(filter));

  async function downloadAgreement(booking) {
    setBusy(`a${booking.id}`);
    try {
      // Re-post so a booking that never had a number gets one, then print it.
      await api.post(`/bookings/${booking.id}/agreement`, {});
      exportAgreementPdf(await api.get(`/bookings/${booking.id}/agreement`));
      setBookings(await api.get('/bookings'));
    } catch (err) { setError(err.message); } finally { setBusy(null); }
  }

  async function downloadReturn(booking) {
    setBusy(`r${booking.id}`);
    try {
      const [full, bill, reports] = await Promise.all([
        api.get(`/bookings/${booking.id}/agreement`),
        api.get(`/bookings/${booking.id}/bill`),
        api.get(`/bookings/${booking.id}/condition-reports`),
      ]);
      exportReturnSummaryPdf(full, bill, reports);
    } catch (err) { setError(err.message); } finally { setBusy(null); }
  }

  async function downloadStatement(email) {
    setBusy(`s${email}`);
    try {
      const { profile, history } = await api.get(`/customers/${encodeURIComponent(email)}`);
      exportCustomerStatementPdf(profile, history);
    } catch (err) { setError(err.message); } finally { setBusy(null); }
  }

  const agreements = rows.filter((r) => r.docs.includes('agreement')).length;
  const returns = rows.filter((r) => r.docs.includes('return')).length;

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <div className="sub">Every agreement, return summary and statement RentalFlow has issued.</div>
        </div>
      </div>

      {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}

      <div className="stat-row">
        <StatTile label="Agreements issuable" value={agreements} hint="approved or completed rentals" />
        <StatTile label="Return summaries" value={returns} hint="rentals that were checked back in" />
        <StatTile label="Customer statements" value={new Set(rows.map((r) => r.customer_email)).size} hint="one per customer, on demand" />
      </div>

      <div className="toolbar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`btn small ${filter === f.key ? '' : 'secondary'}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="center-empty">No documents yet — approve a booking to issue its agreement.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Item</th>
                <th>Customer</th>
                <th>Period</th>
                <th className="num">Fees</th>
                <th>Downloads</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="cell-title">{b.agreement_number || `RF-${b.id}`}</div>
                    <div className="muted small">{b.checked_in_at ? 'closed' : b.status.toLowerCase()}</div>
                  </td>
                  <td>{b.item_name}</td>
                  <td>
                    <div>{b.customer_name}</div>
                    <div className="muted small">{b.customer_email}</div>
                  </td>
                  <td className="muted">{b.start_date} → {b.end_date}</td>
                  <td className="num">
                    {money(Number(b.late_fee_amount || 0) + Number(b.penalty_amount || 0))}
                  </td>
                  <td>
                    <div className="doc-actions">
                      <button
                        className="btn secondary small"
                        disabled={busy === `a${b.id}`}
                        onClick={() => downloadAgreement(b)}
                      >
                        Agreement
                      </button>
                      {b.docs.includes('return') && (
                        <button
                          className="btn secondary small"
                          disabled={busy === `r${b.id}`}
                          onClick={() => downloadReturn(b)}
                        >
                          Return summary
                        </button>
                      )}
                      <button
                        className="btn small"
                        disabled={busy === `s${b.customer_email}`}
                        onClick={() => downloadStatement(b.customer_email)}
                      >
                        Statement
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
