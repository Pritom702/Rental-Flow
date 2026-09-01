// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M1 - Md. Safinuzzaman (Shafin)
//  GitHub: @shaafin01  |  Part: F19 Revenue & utilization analytics page
// ============================================================
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { BarChart, DonutChart, UtilizationBar, StatTile } from '../components/Charts.jsx';

const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '1 year' },
];

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState(null);
  const [trend, setTrend] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get(`/analytics/overview?days=${days}`),
      api.get('/analytics/revenue-trend?months=6'),
      api.get(`/analytics/top-items?days=${days}`),
      api.get('/analytics/by-category'),
      api.get('/analytics/inventory'),
    ])
      .then(([o, t, items, cats, inv]) => {
        if (cancelled) return;
        setOverview(o);
        setTrend(t);
        setTopItems(items);
        setByCategory(cats);
        setInventory(inv);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => { cancelled = true; };
  }, [days]);

  const growth = overview?.growthPct ?? 0;

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <div className="sub">Revenue, fleet utilization and where the money actually comes from.</div>
        </div>
        <div className="toolbar" style={{ margin: 0 }}>
          {RANGES.map((r) => (
            <button
              key={r.days}
              className={`btn small ${days === r.days ? '' : 'secondary'}`}
              onClick={() => setDays(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}

      {!overview ? (
        <div className="center-empty">Loading analytics…</div>
      ) : (
        <>
          <div className="stat-row">
            <StatTile
              label={`Revenue · last ${overview.windowDays} days`}
              value={money(overview.revenue)}
              hint={`${growth >= 0 ? '▲' : '▼'} ${Math.abs(growth)}% vs. previous period`}
              tone={growth >= 0 ? 'var(--accent)' : 'var(--red)'}
            />
            <StatTile label="Rentals" value={overview.bookings} hint={`${money(overview.averageOrderValue)} average per rental`} />
            <StatTile
              label="Fleet utilization"
              value={`${overview.fleetUtilization}%`}
              hint={`${overview.totalItems} items in the fleet`}
            />
            <StatTile
              label="Fees & penalties"
              value={money(overview.lateFees + overview.penalties)}
              hint={`${money(overview.lateFees)} late · ${money(overview.penalties)} damage`}
            />
            <StatTile label="Deposits held" value={money(overview.depositsHeld)} hint="Refundable — not counted as revenue" />
          </div>

          <div className="analytics-grid">
            <section className="panel">
              <div className="panel-head">
                <h2>Revenue by month</h2>
                <span className="muted">last 6 months</span>
              </div>
              <BarChart data={trend.map((t) => ({ label: t.label, value: t.revenue }))} />
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Revenue by category</h2>
              </div>
              <DonutChart data={byCategory} />
            </section>
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2>Top earning items</h2>
              <span className="muted">utilization over the last {overview.windowDays} days</span>
            </div>
            {topItems.length === 0 ? (
              <div className="chart-empty">No rentals in this period yet</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th className="num">Rentals</th>
                      <th className="num">Revenue</th>
                      <th>Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td className="muted">{item.category}</td>
                        <td className="num">{item.bookings}</td>
                        <td className="num">{money(item.revenue)}</td>
                        <td className="util-cell">
                          <UtilizationBar value={item.utilization} />
                          <span className="util-pct">{item.utilization}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Inventory status</h2>
              <span className="muted">where every item currently sits</span>
            </div>
            <DonutChart data={inventory} format={(n) => `${n}`} />
          </section>
        </>
      )}
    </div>
  );
}
