// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M3 - Promit Ghosh Turjo (Promit)
//  Part: F15 Document centre — reprint agreements, return summaries, statements
// ============================================================
// Sprint 3 could only download a document from the booking that produced it.
// Sprint 4 collects every issued document in one place so staff can re-issue an
// agreement, a return summary, or a whole customer statement on request.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';
import { exportAgreementPdf, exportReturnSummaryPdf, exportCustomerStatementPdf } from '../pdf.js';

import { money } from '../money.js';

// The three kinds of paperwork, in plain words, so each button says what it makes.
const KINDS = [
  { key: 'agreement', icon: 'file', title: 'Rental agreement',
    text: 'The contract for one rental: who, what, the dates, the price, the deposit and the rules. Ready once a booking is approved.' },
  { key: 'return', icon: 'check', title: 'Return summary',
    text: 'Proof of how the item came back: its condition at pickup and at return, plus any late fee or damage charge.' },
  { key: 'statement', icon: 'users', title: 'Renter statement',
    text: 'Every rental one person has made, with what they paid in total. Handy for records or a dispute.' },
];

// A document only exists once the booking has reached the stage that produces it.
function documentsFor(booking) {
  const docs = [];
  if (['Approved', 'Completed'].includes(booking.status) || booking.agreement_number) docs.push('agreement');
  if (booking.checked_in_at) docs.push('return');
  return docs;
}

export default function Documents() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    api.get('/bookings')
      .then(setBookings)
      .catch((err) => setError(err.message));
  }, []);

  const all = bookings
    .map((b) => ({ ...b, docs: documentsFor(b) }))
    .filter((b) => b.docs.length);
  const rows = all.filter((b) => filter === 'all' || b.docs.includes(filter));

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

  const agreements = all.filter((r) => r.docs.includes('agreement')).length;
  const returns = all.filter((r) => r.docs.includes('return')).length;
  const statements = new Set(all.map((r) => String(r.customer_email).toLowerCase())).size;
  const countOf = { agreement: agreements, return: returns, statement: statements };
  const TABS = [
    { key: 'all', label: 'All', n: all.length },
    { key: 'agreement', label: 'Agreements', n: agreements },
    { key: 'return', label: 'Return summaries', n: returns },
  ];
  // Which side of the rental the viewer was on, for members.
  const sideOf = (b) => (b.my_role === 'owner' ? 'You rented it out' : b.my_role === 'renter' ? 'You rented it' : null);

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <div className="sub">Download the paperwork for your rentals as PDF files.</div>
        </div>
      </div>

      {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}

      <div className="doc-kinds">
        {KINDS.map((k) => (
          <div className="doc-kind" key={k.key}>
            <span className="doc-kind-icon"><Icon name={k.icon} size={18} /></span>
            <div>
              <b>{k.title}</b>
              <p>{k.text}</p>
            </div>
            <span className="doc-kind-n">{countOf[k.key]}</span>
          </div>
        ))}
      </div>

      <div className="seg-tabs" role="tablist" aria-label="Show">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={filter === t.key}
            className={filter === t.key ? 'on' : ''}
            onClick={() => setFilter(t.key)}
          >
            {t.label} <span className="seg-n">{t.n}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="center-empty">
          {filter === 'return'
            ? 'No return summaries yet. One appears after a rented item is checked back in.'
            : 'No documents yet. An agreement appears as soon as a booking is approved.'}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Item</th>
                <th>Renter</th>
                <th>Dates</th>
                <th className="num">Extra charges</th>
                <th>Download PDF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="cell-title">{b.agreement_number || `RF-${b.id}`}</div>
                    <div className="muted small">{b.checked_in_at ? 'returned' : b.status.toLowerCase()}</div>
                  </td>
                  <td>
                    <div>{b.item_name}</div>
                    {sideOf(b) && <div className="muted small">{sideOf(b)}</div>}
                  </td>
                  <td>
                    <div>{b.customer_name}</div>
                    <div className="muted small">{b.customer_email}</div>
                  </td>
                  <td className="muted">{b.start_date} → {b.end_date}</td>
                  <td className="num" title="Late fees and damage charges">
                    {money(Number(b.late_fee_amount || 0) + Number(b.penalty_amount || 0))}
                  </td>
                  <td>
                    <div className="doc-actions">
                      <button
                        className="btn secondary small"
                        disabled={busy === `a${b.id}`}
                        onClick={() => downloadAgreement(b)}
                        title="The rental contract for this booking"
                      >
                        <Icon name="file" size={14} /> {busy === `a${b.id}` ? 'Making…' : 'Agreement'}
                      </button>
                      {b.docs.includes('return') && (
                        <button
                          className="btn secondary small"
                          disabled={busy === `r${b.id}`}
                          onClick={() => downloadReturn(b)}
                          title="Condition at pickup and return, plus any charges"
                        >
                          <Icon name="check" size={14} /> {busy === `r${b.id}` ? 'Making…' : 'Return summary'}
                        </button>
                      )}
                      <button
                        className="btn secondary small"
                        disabled={busy === `s${b.customer_email}`}
                        onClick={() => downloadStatement(b.customer_email)}
                        title="Every rental this renter has made"
                      >
                        <Icon name="users" size={14} /> {busy === `s${b.customer_email}` ? 'Making…' : 'Renter statement'}
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
