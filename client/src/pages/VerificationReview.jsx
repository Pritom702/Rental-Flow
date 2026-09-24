// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: admin screen — settle what the machine could not
// ============================================================
// Every attempt the automatic checks could not confirm lands here, plus every
// attempt to use an NID that already belongs to someone else. The admin sees
// the three photos side by side, what was typed next to what was read off the
// card, the face-match score, and the exact reasons — then approves or rejects
// with a note the member will read.
//
// Every decision also teaches the risk model (server/src/riskModel.js). Its
// estimate — how likely an admin is to approve — is shown on each case, with
// the signals behind it, and the panel at the top shows what it has learned.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';

function pct(p) {
  return `${Math.round(p * 100)}%`;
}

// A small coloured badge: the model's estimate that this is a genuine member.
function RiskBadge({ score, unread }) {
  if (unread) return <span className="risk-badge mid" title="The card could not be read, so the score says little">Card couldn't be read — check the photos</span>;
  if (score == null) return null;
  const tone = score >= 0.8 ? 'ok' : score >= 0.5 ? 'mid' : 'no';
  return <span className={`risk-badge ${tone}`} title="Learning model's estimate">{pct(score)} likely genuine</span>;
}

// What the model has learned so far from admin decisions.
function ModelPanel() {
  const [m, setM] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { api.get('/verify/admin/model').then(setM).catch(() => {}); }, []);
  if (!m) return null;
  const learned = m.signals.filter((s) => Math.abs(s.shift) >= 0.05);
  return (
    <section className="panel model-panel">
      <div className="model-head">
        <div>
          <h3>Learning model</h3>
          <p className="muted">
            {m.adminDecisions
              ? `Trained on ${m.adminDecisions} admin decision${m.adminDecisions === 1 ? '' : 's'} (${m.examples} cases in total).`
              : 'No admin decisions yet — it starts from the built-in rules and learns from every approve or reject you make.'}
            {m.accuracy != null && ` Agrees with admins ${pct(m.accuracy)} of the time on cases it was not trained on.`}
          </p>
        </div>
        <button className="btn ghost small" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'What it weighs'}</button>
      </div>
      {open && (
        <table className="review-table">
          <thead><tr><th>Signal</th><th>Weight</th><th>Learned change</th></tr></thead>
          <tbody>
            {m.signals.map((s) => (
              <tr key={s.key}>
                <td>{s.label}</td>
                <td className={s.weight >= 0 ? 'ok' : 'no'}>{s.weight >= 0 ? '+' : ''}{s.weight.toFixed(2)}</td>
                <td className="muted">{Math.abs(s.shift) >= 0.05 ? `${s.shift > 0 ? '+' : ''}${s.shift.toFixed(2)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!open && learned.length > 0 && (
        <p className="muted">Biggest lesson so far: <b>{learned.sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift))[0].label.toLowerCase()}</b> {learned[0].shift > 0 ? 'matters less than the rules assumed' : 'is a stronger warning sign than the rules assumed'}.</p>
      )}
    </section>
  );
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export default function VerificationReview() {
  const [queue, setQueue] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      setQueue(await api.get('/verify/admin/queue'));
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  if (openId) {
    return <AttemptDetail id={openId} onClose={() => { setOpenId(null); load(); }} />;
  }

  const pending = (queue || []).filter((q) => q.decision === 'pending_review');
  const fraud = (queue || []).filter((q) => q.decision === 'rejected');

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>ID reviews</h1>
          <div className="sub">Members verifying their identity before their first listing whose check could not be confirmed automatically, and attempts to use someone else's NID.</div>
        </div>
        <button className="btn secondary small" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
      </div>
      {error && <div className="error">{error}</div>}
      <ModelPanel />
      {!queue && !error && <p className="muted">Loading…</p>}

      {queue && !pending.length && !fraud.length && (
        <div className="center-empty">
          <Icon name="shield" size={30} />
          <p>Nothing to review right now.</p>
        </div>
      )}

      {pending.length > 0 && <h2 className="review-h">Waiting for a decision ({pending.length})</h2>}
      <div className="review-list">
        {pending.map((q) => (
          <button key={q.id} className="review-row" onClick={() => setOpenId(q.id)}>
            <div className="review-who">
              <b>{q.name}</b>
              <span>{q.email}</span>
            </div>
            <div className="review-why">{q.reasonText.slice(0, 2).join(' · ')}{q.reasonText.length > 2 ? ` · +${q.reasonText.length - 2} more` : ''}</div>
            <div className="review-when"><RiskBadge score={q.risk_score} unread={q.features?.card_face_missing && q.features?.number_unreadable} /> {fmtDate(q.created_at)}</div>
          </button>
        ))}
      </div>

      {fraud.length > 0 && <h2 className="review-h">Tried to use someone else's NID ({fraud.length})</h2>}
      <div className="review-list">
        {fraud.map((q) => (
          <button key={q.id} className="review-row warn" onClick={() => setOpenId(q.id)}>
            <div className="review-who">
              <b>{q.name}</b>
              <span>{q.email}</span>
            </div>
            <div className="review-why">Typed an NID already registered to another account</div>
            <div className="review-when">{fmtDate(q.created_at)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Compare({ label, typed, read, ok }) {
  return (
    <tr>
      <th>{label}</th>
      <td>{typed || '—'}</td>
      <td>{read || <span className="muted">not readable</span>}</td>
      <td className={ok ? 'ok' : 'no'}><Icon name={ok ? 'check' : 'close'} size={16} /></td>
    </tr>
  );
}

function AttemptDetail({ id, onClose }) {
  const [a, setA] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/verify/admin/attempts/${id}`).then(setA).catch((err) => setError(err.message));
  }, [id]);

  async function decide(approve) {
    setBusy(true);
    setError('');
    try {
      await api.post(`/verify/admin/attempts/${id}/decision`, { approve, note });
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!a) {
    return <div className="container">{error ? <div className="error">{error}</div> : <p className="muted">Loading…</p>}</div>;
  }

  const fraudOnly = a.decision === 'rejected';
  const pct = a.face.distance == null ? null : Math.max(0, Math.min(100, (1 - a.face.distance) * 100));
  const faceOk = a.face.distance != null && a.face.distance < a.face.match;

  return (
    <div className="container review-detail">
      <button className="btn ghost small" onClick={onClose}>← Back to the list</button>
      <div className="page-head">
        <div>
          <h1>{a.member.name}</h1>
          <div className="sub">{a.member.email} · submitted {fmtDate(a.createdAt)}</div>
        </div>
      </div>

      {a.nidHeldBy && (
        <div className="error">This NID is already registered to <b>{a.nidHeldBy.name}</b> ({a.nidHeldBy.email}).</div>
      )}

      <div className="review-reasons">
        {a.reasons.map((r) => <div key={r.code}><Icon name="shield" size={15} /> {r.text}</div>)}
      </div>

      {!fraudOnly && (
        <>
          <div className="review-photos">
            <figure><img src={a.images.front} alt="NID front" /><figcaption>NID front</figcaption></figure>
            <figure><img src={a.images.selfie} alt="Live selfie" /><figcaption>Live selfie</figcaption></figure>
            <figure><img src={a.images.back} alt="NID back" /><figcaption>NID back</figcaption></figure>
          </div>

          {a.risk && (
            <section className="panel risk-panel">
              <h3>Learning model <RiskBadge score={a.risk.score} unread={a.risk.cardUnread} /></h3>
              <p className="muted">Based on every approve and reject so far. You decide — every decision you make here teaches it.</p>
              <ul className="risk-factors">
                {a.risk.factors.map((f) => (
                  <li key={f.key} className={f.effect > 0 ? 'ok' : 'no'}>
                    <span>{f.effect > 0 ? '▲' : '▼'}</span> {f.label}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="review-grid">
            <section className="panel">
              <h3>Typed vs. read from the card</h3>
              <table className="review-table">
                <thead><tr><th /><th>Typed</th><th>On the card</th><th /></tr></thead>
                <tbody>
                  <Compare label="NID number" typed={a.typed.number} read={a.card.number} ok={a.card.number === a.typed.number} />
                  <Compare label="Name" typed={a.typed.name} read={a.card.name} ok={(a.card.nameScore ?? 0) >= 0.8} />
                  <Compare label="Date of birth" typed={a.typed.dob} read={a.card.dob} ok={a.card.dob === a.typed.dob} />
                </tbody>
              </table>
            </section>

            <section className="panel">
              <h3>Face match</h3>
              {pct == null ? <p className="muted">No face found on the card.</p> : (
                <>
                  <div className="meter"><span className={faceOk ? 'ok' : 'no'} style={{ width: `${pct}%` }} /></div>
                  <p className="muted">
                    Distance {a.face.distance.toFixed(2)} — {faceOk ? 'same person' : a.face.distance < 0.6 ? 'unsure' : 'looks like a different person'} (below {a.face.match} counts as a match).
                  </p>
                </>
              )}
              <p className="muted">Liveness: {a.face.livenessPassed ? 'passed' : 'not passed'} after {a.face.tries} {a.face.tries === 1 ? 'try' : 'tries'}.</p>
            </section>
          </div>

          <details className="panel ocr-raw">
            <summary>Everything read off the card</summary>
            <pre>{a.card.text || '(nothing)'}</pre>
          </details>
        </>
      )}

      <div className="panel review-decide">
        <div className="field">
          <label htmlFor="note">{fraudOnly ? 'Note (optional)' : 'Note to the member (required to reject)'}</label>
          <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={fraudOnly ? 'e.g. Contacted the real card holder' : 'e.g. The card photo is of a different person.'} />
        </div>
        {error && <div className="error">{error}</div>}
        <div className="review-buttons">
          {fraudOnly ? (
            <button className="btn" disabled={busy} onClick={() => decide(false)}>Mark as reviewed</button>
          ) : (
            <>
              <button className="btn danger" disabled={busy} onClick={() => decide(false)}>Reject</button>
              <button className="btn" disabled={busy} onClick={() => decide(true)}><Icon name="check" size={15} /> Approve</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
