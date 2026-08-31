// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: F17 Customer CRM & rental history page
// ============================================================
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { StatTile } from '../components/Charts.jsx';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);   // { profile, history }
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      const q = search ? `?q=${encodeURIComponent(search)}` : '';
      Promise.all([api.get(`/customers${q}`), api.get('/customers/summary')])
        .then(([list, s]) => { setCustomers(list); setSummary(s); })
        .catch((err) => setError(err.message));
    }, 200);   // debounce so typing doesn't fire a request per keystroke
    return () => clearTimeout(timer);
  }, [search]);

  async function openCustomer(email) {
    try {
      setSelected(await api.get(`/customers/${encodeURIComponent(email)}`));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <div className="sub">Everyone who has booked, what they spent, and how reliably they return items.</div>
        </div>
        <Link to="/bookings" className="btn secondary">Bookings</Link>
      </div>

      {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}

      {summary && (
        <div className="stat-row">
          <StatTile label="Customers" value={summary.customers} hint={`${summary.bookings} bookings in total`} />
          <StatTile label="New this month" value={summary.newCustomers} hint="first booked in the last 30 days" />
          <StatTile label="Repeat customers" value={summary.repeatCustomers} hint={`${summary.repeatRate}% book more than once`} />
        </div>
      )}

      <div className="toolbar">
        <div className="search-field" style={{ flex: 1 }}>
          <Icon name="search" size={16} />
          <input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="center-empty">No customers yet — bookings from the browse page appear here.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Tier</th>
                <th className="num">Rentals</th>
                <th className="num">Lifetime spend</th>
                <th>Reliability</th>
                <th>Last rental</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.email}>
                  <td>
                    <div className="cell-title">{c.name}</div>
                    <div className="muted small">{c.email}</div>
                  </td>
                  <td><span className={`badge tier-${c.tier}`}>{c.tier}</span></td>
                  <td className="num">
                    {c.bookingCount}
                    {c.activeCount > 0 && <span className="tag" style={{ marginLeft: 6 }}>{c.activeCount} active</span>}
                  </td>
                  <td className="num">{money(c.totalSpend)}</td>
                  <td>
                    <span className={c.reliability >= 70 ? 'ok-text' : 'warn-text'}>
                      {c.reliability}% · {c.reliabilityLabel}
                    </span>
                  </td>
                  <td className="muted">{c.lastRental || '—'}</td>
                  <td>
                    <button className="btn secondary small" onClick={() => openCustomer(c.email)}>History</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <div>
                <h2>{selected.profile.name}</h2>
                <div className="muted">{selected.profile.email}</div>
              </div>
              <button className="btn secondary small" onClick={() => setSelected(null)}>Close</button>
            </div>

            <div className="stat-row compact">
              <StatTile label="Rentals" value={selected.profile.bookingCount} />
              <StatTile label="Lifetime spend" value={money(selected.profile.totalSpend)} />
              <StatTile label="Tier" value={selected.profile.tier} />
              <StatTile
                label="Reliability"
                value={`${selected.profile.reliability}%`}
                hint={selected.profile.reliabilityLabel}
              />
            </div>

            <h3 style={{ marginTop: 18 }}>Rental history</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Dates</th>
                    <th>Status</th>
                    <th className="num">Value</th>
                    <th className="num">Fees</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.history.map((b) => (
                    <tr key={b.id}>
                      <td>{b.item_name}</td>
                      <td className="muted">
                        {b.start_date} → {b.end_date}
                        {b.overdue_days > 0 && <span className="warn-text"> · {b.overdue_days}d overdue</span>}
                      </td>
                      <td><span className={`badge ${b.status}`}>{b.status}</span></td>
                      <td className="num">{money(b.revenue)}</td>
                      <td className="num">
                        {money(Number(b.late_fee_amount || 0) + Number(b.penalty_amount || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
