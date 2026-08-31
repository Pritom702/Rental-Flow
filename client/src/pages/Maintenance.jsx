// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: F18 Maintenance & repair log page
// ============================================================
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { StatTile } from '../components/Charts.jsx';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const JOB_TYPES = ['Repair', 'Service', 'Inspection', 'Cleaning', 'Replacement'];
const PRIORITIES = ['Low', 'Normal', 'High'];
const STATUSES = ['Open', 'In Progress', 'Completed', 'Cancelled'];
const EMPTY = {
  item_id: '', job_type: 'Repair', priority: 'Normal',
  description: '', technician: '', parts_cost: '', labour_cost: '',
};

export default function Maintenance() {
  const [jobs, setJobs] = useState([]);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
    const [jobData, itemData, summaryData] = await Promise.all([
      api.get(`/maintenance${q}`),
      api.get('/items'),
      api.get('/maintenance/summary'),
    ]);
    setJobs(jobData);
    setItems(itemData);
    setSummary(summaryData);
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, [statusFilter]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/maintenance', {
        ...form,
        parts_cost: Number(form.parts_cost || 0),
        labour_cost: Number(form.labour_cost || 0),
      });
      setSuccess('Repair job logged — the item is now held out of the rental pool.');
      setForm(EMPTY);
      setShowForm(false);
      load();
    } catch (err) { setError(err.message); }
  }

  // Closing the last open job on an item releases it back to Available.
  async function changeStatus(job, status) {
    try {
      await api.patch(`/maintenance/${job.id}`, { status });
      setSuccess(
        ['Completed', 'Cancelled'].includes(status)
          ? `Job closed — ${job.item_name} is back in the rental pool.`
          : `Job marked ${status}.`
      );
      load();
    } catch (err) { setError(err.message); }
  }

  async function addCost(job) {
    const parts = window.prompt(`Parts cost for "${job.item_name}"`, String(job.parts_cost));
    if (parts === null) return;
    const labour = window.prompt('Labour cost', String(job.labour_cost));
    if (labour === null) return;
    try {
      await api.patch(`/maintenance/${job.id}`, {
        parts_cost: Number(parts) || 0,
        labour_cost: Number(labour) || 0,
      });
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Maintenance</h1>
          <div className="sub">Repair jobs, what they cost, and how long each item was off the shelf.</div>
        </div>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          <Icon name="tool" size={15} /> {showForm ? 'Close' : 'Log repair job'}
        </button>
      </div>

      {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}
      {success && (
        <div className="success" style={{ color: 'var(--accent)', marginBottom: 16 }}>
          <Icon name="check" size={16} /> {success}
        </div>
      )}

      {summary && (
        <div className="stat-row">
          <StatTile
            label="Open jobs"
            value={summary.openCount}
            hint={`${summary.jobCount} jobs logged in total`}
            tone={summary.openCount ? 'var(--amber)' : undefined}
          />
          <StatTile label="Repair spend" value={money(summary.totalCost)} hint={`${money(summary.averageCost)} average per job`} />
          <StatTile label="Downtime" value={`${summary.totalDowntimeDays} days`} hint="total time items spent in the shop" />
          <StatTile label="Completed" value={summary.completedCount} hint="jobs closed and released" />
        </div>
      )}

      {showForm && (
        <form className="form panel" onSubmit={submit}>
          <div className="row">
            <label className="field">
              <span>Item</span>
              <select value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })} required>
                <option value="">Select an item…</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Job type</span>
              <select value={form.job_type} onChange={(e) => setForm({ ...form, job_type: e.target.value })}>
                {JOB_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Priority</span>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
          </div>
          <label className="field">
            <span>What needs fixing</span>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Lens mount loose after the last return"
              required
            />
          </label>
          <div className="row">
            <label className="field">
              <span>Technician</span>
              <input
                value={form.technician}
                onChange={(e) => setForm({ ...form, technician: e.target.value })}
                placeholder="Who is doing the work"
              />
            </label>
            <label className="field">
              <span>Parts cost</span>
              <input type="number" step="0.01" min="0" value={form.parts_cost}
                onChange={(e) => setForm({ ...form, parts_cost: e.target.value })} />
            </label>
            <label className="field">
              <span>Labour cost</span>
              <input type="number" step="0.01" min="0" value={form.labour_cost}
                onChange={(e) => setForm({ ...form, labour_cost: e.target.value })} />
            </label>
          </div>
          <button className="btn" type="submit"><Icon name="plus" size={15} /> Log job</button>
        </form>
      )}

      <div className="toolbar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All jobs</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {jobs.length === 0 ? (
        <div className="center-empty">No repair jobs logged yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Job</th>
                <th>Technician</th>
                <th className="num">Cost</th>
                <th>Reported</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <div className="cell-title">{job.item_name}</div>
                    <div className="muted small">now: {job.item_status}</div>
                  </td>
                  <td>
                    <div>{job.description}</div>
                    <div className="muted small">
                      {job.job_type}
                      {job.priority === 'High' && <span className="warn-text"> · high priority</span>}
                    </div>
                  </td>
                  <td className="muted">{job.technician || '—'}</td>
                  <td className="num">{money(job.total_cost)}</td>
                  <td className="muted">{String(job.reported_at).slice(0, 10)}</td>
                  <td><span className={`badge job-${job.status.replace(/\s+/g, '-')}`}>{job.status}</span></td>
                  <td>
                    <div className="doc-actions">
                      <select value={job.status} onChange={(e) => changeStatus(job, e.target.value)}>
                        {STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <button className="btn secondary small" onClick={() => addCost(job)}>Costs</button>
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
