// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: NID validation + payment-method rules (pure, unit tested)
// ============================================================
// Pure functions only — no database, no HTTP — so every rule here can be unit
// tested in isolation, the same way bookingUtils.js is.

// ---------------------------------------------------------------- NID

// A Bangladeshi National ID is 10, 13 or 17 digits. Older cards are 13 or 17;
// the smart card issued since 2016 is 10.
const NID_LENGTHS = [10, 13, 17];

// Strip spaces, dashes and any other separator people type in.
export function normalizeNid(value) {
  return String(value || '').replace(/\D/g, '');
}

export function isValidNid(value) {
  const digits = normalizeNid(value);
  return NID_LENGTHS.includes(digits.length);
}

// Never show a full national ID back to the browser. Keep the last 4 digits so
// the owner can recognise their own card, and mask the rest.
export function maskNid(value) {
  const digits = normalizeNid(value);
  if (!digits) return null;
  if (digits.length <= 4) return '•'.repeat(digits.length);
  return `${'•'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

// Write-once rule. A NID may be submitted only when the account has none yet.
// Returns { ok } or { ok: false, reason } so the route can pick a status code.
export function canSubmitNid(user = {}, submission = {}) {
  if (user.nid_number) return { ok: false, reason: 'already-on-file' };
  if (!isValidNid(submission.nid_number)) return { ok: false, reason: 'invalid-number' };
  if (!String(submission.nid_name || '').trim()) return { ok: false, reason: 'missing-name' };
  if (!submission.nid_front_url) return { ok: false, reason: 'missing-front-image' };
  return { ok: true };
}

// Damage control gate: a booking may only be requested by a verified identity.
export function hasVerifiedNid(user = {}) {
  return Boolean(user.nid_number);
}

// ---------------------------------------------------------------- payments

export const PAYMENT_KINDS = ['bKash', 'Nagad', 'Rocket', 'Card', 'Bank'];

// Mobile financial services in Bangladesh use an 11-digit mobile number.
const MFS_KINDS = ['bKash', 'Nagad', 'Rocket'];

export function isValidPaymentMethod({ kind, account_ref } = {}) {
  if (!PAYMENT_KINDS.includes(kind)) return { ok: false, reason: 'invalid-kind' };
  const ref = String(account_ref || '').replace(/[\s-]/g, '');
  if (!ref) return { ok: false, reason: 'missing-account' };
  if (MFS_KINDS.includes(kind) && !/^01[0-9]{9}$/.test(ref)) {
    return { ok: false, reason: 'invalid-mobile' };
  }
  if (kind === 'Card' && !/^[0-9]{13,19}$/.test(ref)) return { ok: false, reason: 'invalid-card' };
  if (kind === 'Bank' && ref.length < 6) return { ok: false, reason: 'invalid-account' };
  return { ok: true };
}

// We store the account reference already masked — RentalFlow never keeps a full
// card or wallet number, only enough for the owner to tell their methods apart.
export function maskAccountRef(kind, accountRef) {
  const ref = String(accountRef || '').replace(/[\s-]/g, '');
  if (!ref) return '';
  if (kind === 'Card') return `**** **** **** ${ref.slice(-4)}`;
  if (MFS_KINDS.includes(kind)) return `${ref.slice(0, 3)}****${ref.slice(-3)}`;
  return `****${ref.slice(-4)}`;
}

// A human label when the member does not type one, e.g. "bKash ·018****321".
export function defaultLabel(kind, maskedRef) {
  return `${kind} · ${maskedRef}`;
}

// Payment methods are permanent. This is the single place that answers
// "may this be removed?", and the answer is always no — the route, the UI and
// the database trigger all agree with it.
export function canRemovePaymentMethod() {
  return false;
}

// The first method a member adds becomes their default automatically; after
// that they choose. Deactivated methods can never be the default.
export function shouldBecomeDefault(existingMethods = []) {
  return existingMethods.filter((m) => m.is_active).length === 0;
}
