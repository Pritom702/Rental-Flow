// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: One-time National ID capture (damage control)
// ============================================================
// Used in two places, which is exactly why it is a component:
//   - the Profile page, when the account has no NID yet
//   - the booking modal, as a step in front of the booking form
// Submitting is allowed once. After that the server refuses any change, so this
// form is never shown again for that account.
import { useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';

export default function NidForm({ onDone, compact = false }) {
  const [form, setForm] = useState({ nid_number: '', nid_name: '' });
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [uploading, setUploading] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [problemField, setProblemField] = useState('');

  // A NID is digits only, so letters are dropped as they are typed rather than
  // silently ignored later — otherwise "f1244..." looks accepted but counts as
  // one digit short, and the reason for the rejection is invisible.
  const digits = form.nid_number;
  const validLength = [10, 13, 17].includes(digits.length);

  // What is still missing, in the order the fields appear. The submit button is
  // never disabled: a greyed-out button with no explanation is indistinguishable
  // from a broken one, so we always accept the click and say what is wrong.
  function firstProblem() {
    if (!form.nid_name.trim()) return { field: 'name', message: 'Enter the full name exactly as printed on the NID.' };
    if (!digits) return { field: 'number', message: 'Enter your NID number.' };
    if (!validLength) {
      return {
        field: 'number',
        message: `Your NID number is ${digits.length} digit${digits.length === 1 ? '' : 's'}. A Bangladeshi NID must be 10, 13 or 17 digits.`,
      };
    }
    if (!front) return { field: 'front', message: 'Upload a photo of the front of your NID.' };
    return null;
  }

  async function pick(side, e) {
    const files = e.target.files;
    if (!files || !files.length) return;
    setUploading(side);
    setError('');
    try {
      const { urls } = await api.uploadImages([files[0]]);
      (side === 'front' ? setFront : setBack)(urls[0]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading('');
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');

    const problem = firstProblem();
    if (problem) {
      setProblemField(problem.field);
      setError(problem.message);
      return;
    }
    setProblemField('');

    setBusy(true);
    try {
      await api.post('/profile/nid', {
        nid_number: digits,
        nid_name: form.nid_name.trim(),
        nid_front_url: front,
        nid_back_url: back || null,
      });
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {!compact && (
        <p className="muted" style={{ marginTop: 0 }}>
          RentalFlow holds a verified identity for every renter so that damage and penalty
          claims can be settled fairly. You only ever do this once.
        </p>
      )}

      <div className="row">
        <div className="field">
          <label>Full name as printed on the NID</label>
          <input
            value={form.nid_name}
            onChange={(e) => { setForm({ ...form, nid_name: e.target.value }); setProblemField(''); setError(''); }}
            aria-invalid={problemField === 'name'}
            className={problemField === 'name' ? 'invalid' : undefined}
            placeholder="e.g. Rahim Uddin"
          />
        </div>
        <div className="field">
          <label>NID number</label>
          <input
            value={form.nid_number}
            onChange={(e) => { setForm({ ...form, nid_number: e.target.value.replace(/\D/g, '') }); setProblemField(''); setError(''); }}
            aria-invalid={problemField === 'number'}
            className={problemField === 'number' ? 'invalid' : undefined}
            placeholder="10, 13 or 17 digits"
            inputMode="numeric"
          />
          <div className="fieldhint">
            {digits.length === 0
              ? 'Bangladeshi NID: 10, 13 or 17 digits.'
              : validLength
                ? <span className="ok-text">{digits.length} digits — looks right.</span>
                : <span className="warn-text">{digits.length} digits — must be 10, 13 or 17.</span>}
          </div>
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label>Photo of the NID front <span className="req">required</span></label>
          <input type="file" accept="image/*" onChange={(e) => pick('front', e)} />
          {uploading === 'front' && <div className="fieldhint">Uploading…</div>}
          {front && <div className="nid-preview"><img src={front} alt="NID front" /></div>}
        </div>
        <div className="field">
          <label>Photo of the NID back <span className="muted">optional</span></label>
          <input type="file" accept="image/*" onChange={(e) => pick('back', e)} />
          {uploading === 'back' && <div className="fieldhint">Uploading…</div>}
          {back && <div className="nid-preview"><img src={back} alt="NID back" /></div>}
        </div>
      </div>

      {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}

      <div className="locked" style={{ marginBottom: 14 }}>
        <Icon name="shield" size={15} />
        Once submitted, your NID is saved to your account permanently and cannot be edited or removed.
      </div>

      <div className="card-actions">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Verifying…' : 'Verify my identity'}
        </button>
      </div>
    </form>
  );
}
