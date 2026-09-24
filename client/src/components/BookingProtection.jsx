// ============================================================
//  RentalFlow  |  Rental protection  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: the protection panel on each booking card
// ============================================================
// Shows each side what protects them on this booking:
//   Renter  the one-time hand-over code to read out at pick-up and return,
//           overdue warnings, and any claim to accept or dispute.
//   Owner   the deposit and guarantor, how late the item is, the claim and its
//           balance ("mark paid"), and — 3 days overdue — "Report missing",
//           which bans the renter and gives an incident report for the police.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { money } from '../money.js';
import { exportIncidentReportPdf } from '../incidentPdf.js';

const STAGE_NOTE = {
  1: 'Due back today.',
  2: 'Overdue — late fees are running.',
  3: 'A day overdue — the account freezes tomorrow.',
  4: 'Two days overdue — the renter is frozen and our team is on it.',
  5: 'Three days overdue.',
};

function hoursLeft(until) {
  const h = Math.max(0, Math.round((new Date(until) - Date.now()) / 36e5));
  return h >= 1 ? `${h} h` : 'under an hour';
}

export default function BookingProtection({ booking: b, onChange, onError, onDone }) {
  const role = b.my_role;
  const active = b.status === 'Approved' && !b.checked_in_at;
  const [code, setCode] = useState(null);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  // The renter's code for the next hand-over (check-out, then return).
  useEffect(() => {
    if (role !== 'renter' || !active) return;
    api.get(`/protection/handover/${b.id}`).then(setCode).catch(() => {});
  }, [role, active, b.id, b.checked_out_at]);

  async function act(fn, done) {
    setBusy(true);
    try { await fn(); onDone?.(done); onChange?.(); } catch (e) { onError?.(e.message); } finally { setBusy(false); }
  }
  const report = () => act(async () => exportIncidentReportPdf(await api.get(`/protection/report/${b.id}`)), 'Incident report downloaded');

  const claim = b.claim_id ? {
    id: b.claim_id, kind: b.claim_kind, status: b.claim_status, charges: Number(b.claim_charges),
    fromDeposit: Number(b.claim_deposit_applied), balance: Number(b.claim_balance), respondBy: b.claim_respond_by,
  } : null;
  const late = active && b.checked_out_at && b.escalation >= 1;

  return (
    <div className="protect">
      {/* ---------- deposit + guarantor (both sides) */}
      <div className="protect-row">
        <span><Icon name="shield" size={14} /> Deposit <b>{money(b.deposit_amount)}</b>
          {b.deposit_rate != null && <span className="muted"> ({Math.round(Number(b.deposit_rate) * 100)}%)</span>}
          {b.deposit_received_at && <span className="protect-ok"> · received</span>}
        </span>
        {b.guarantor_name && role !== 'renter' && (
          <span className="muted">Guarantor: {b.guarantor_name} ({b.guarantor_relation}) · {b.guarantor_phone}</span>
        )}
      </div>

      {/* ---------- the renter's one-time code */}
      {role === 'renter' && code?.phase && (
        <div className="handover-code">
          <span>{code.phase === 'checkout' ? 'Pick-up code' : 'Return code'}</span>
          <b>{code.code.replace(/(\d{3})(\d{3})/, '$1 $2')}</b>
          <small>Read it out to the owner only when you have the item in your hands{code.phase === 'checkin' ? ' back with them' : ''} and agree with its condition.</small>
        </div>
      )}

      {/* ---------- overdue */}
      {late && (
        <div className={`protect-alert stage-${b.escalation}`}>
          <Icon name="calendar" size={15} /> {STAGE_NOTE[b.escalation]}
          {b.hours_late > 0 && <span className="muted"> ({b.hours_late} h late)</span>}
          {role === 'renter' && b.escalation >= 2 && <> Return it as soon as possible — late fees are charged every day.</>}
        </div>
      )}
      {role === 'owner' && active && b.escalation >= 5 && !reporting && (
        <button className="btn danger small" onClick={() => setReporting(true)}><Icon name="shield" size={14} /> Report missing</button>
      )}
      {reporting && (
        <div className="protect-box">
          <b>Report {b.item_name} as not returned?</b>
          <p className="muted">The renter is banned and their ID and face are blocked from RentalFlow, the deposit is kept towards the item’s value, and you get an incident report to file a GD at the police station.</p>
          <textarea rows={2} placeholder="What happened? e.g. phone switched off since the due date" value={details} onChange={(e) => setDetails(e.target.value)} />
          <div className="card-actions">
            <button className="btn danger small" disabled={busy}
              onClick={() => act(async () => {
                await api.post(`/protection/report-missing/${b.id}`, { details });
                setReporting(false);
                exportIncidentReportPdf(await api.get(`/protection/report/${b.id}`));
              }, 'Reported missing — the incident report is downloading')}>Report missing</button>
            <button className="btn secondary small" onClick={() => setReporting(false)}>Cancel</button>
          </div>
        </div>
      )}
      {b.status === 'Missing' && (
        <div className="protect-alert stage-5">
          <Icon name="shield" size={15} /> Reported missing{role === 'owner' ? ' — the renter is banned and our team is following up.' : '.'}
          {role !== 'renter' && <button className="btn secondary small" onClick={report} disabled={busy}>Police report PDF</button>}
        </div>
      )}

      {/* ---------- the claim */}
      {claim && (
        <div className={`protect-box claim-${claim.status}`}>
          <div className="protect-row">
            <b>{claim.kind === 'missing' ? 'Item value charged' : 'Late / damage charges'}: {money(claim.charges)}</b>
            <span className={`badge claim-badge ${claim.status}`}>{claim.status}</span>
          </div>
          <div className="muted">
            {money(claim.fromDeposit)} from the deposit
            {claim.balance > 0 ? <> · <b className="owed">{money(claim.balance)} still owed</b></> : <> · nothing more owed</>}
          </div>
          {b.claim_response && <div className="muted">Renter says: “{b.claim_response}”</div>}

          {role === 'renter' && claim.status === 'open' && !disputing && (
            <div className="card-actions">
              <span className="muted">Answer within {hoursLeft(claim.respondBy)} or it is accepted automatically.</span>
              <button className="btn small" disabled={busy} onClick={() => act(() => api.post(`/protection/claims/${claim.id}/accept`, {}), 'Claim accepted')}>Accept</button>
              <button className="btn secondary small" onClick={() => setDisputing(true)}>Dispute</button>
            </div>
          )}
          {disputing && (
            <div>
              <textarea rows={2} placeholder="What do you disagree with? An admin compares the pick-up and return photos." value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="card-actions">
                <button className="btn small" disabled={busy} onClick={() => act(async () => { await api.post(`/protection/claims/${claim.id}/dispute`, { reason }); setDisputing(false); }, 'Dispute sent to our team')}>Send dispute</button>
                <button className="btn secondary small" onClick={() => setDisputing(false)}>Cancel</button>
              </div>
            </div>
          )}
          {claim.status === 'disputed' && <div className="muted">An admin is reviewing the photos from pick-up and return.</div>}
          {role === 'renter' && ['accepted', 'resolved'].includes(claim.status) && claim.balance > 0 && (
            <div className="muted">Pay {money(claim.balance)} to the owner (bKash, Nagad or cash). You can rent again once they confirm it.</div>
          )}
          {role !== 'renter' && ['accepted', 'resolved'].includes(claim.status) && claim.balance > 0 && (
            <button className="btn small" disabled={busy} onClick={() => act(() => api.post(`/protection/claims/${claim.id}/paid`, {}), 'Balance marked as paid')}>Mark {money(claim.balance)} as paid</button>
          )}
        </div>
      )}
    </div>
  );
}
