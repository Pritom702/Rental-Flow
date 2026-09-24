// ============================================================
//  RentalFlow  |  Rental protection  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: the rules (pure, unit tested)
// ============================================================
// How RentalFlow protects the people who lend their things:
//
//   Trust levels   A renter earns trust with clean returns (on time, no
//                  damage charge). The level sets how valuable an item they can
//                  rent at a normal deposit, and how big that deposit is.
//   Deposits       New renters leave more. Renting above your level is allowed,
//                  but only with a deposit of the item's FULL value — so a
//                  renter who disappears has already paid for it.
//   Guarantor      Anything worth ৳50,000 or more, rented by someone who is not
//                  yet a top renter, needs a guarantor (a named person to contact).
//   Escalation     A rental that is not returned moves through stages:
//                  reminder → overdue → warning → frozen → can be reported missing.
//   Claims         Late fees and damage charges come out of the deposit first;
//                  anything left over is a balance the renter owes. Until it is
//                  paid (or an admin rules otherwise) they cannot rent again.
// Everything here is plain arithmetic on plain objects, so it is tested without
// a database (protectionUtils.test.js).

export const TIERS = [
  { level: 0, name: 'New renter', minClean: 0, cap: 30000, rate: 0.5 },
  { level: 1, name: 'Trusted renter', minClean: 2, cap: 100000, rate: 0.35 },
  { level: 2, name: 'Top renter', minClean: 5, cap: Infinity, rate: 0.2 },
];
export const GUARANTOR_FROM = 50000;          // ৳ — item value that needs a guarantor
export const CLAIM_RESPONSE_HOURS = 48;       // renter's window to accept or dispute a claim

// Trust from the renter's history. A late return costs one clean return, so a
// habit of returning late holds a renter back.
export function trustTier({ cleanReturns = 0, lateReturns = 0 } = {}) {
  const score = Math.max(0, Number(cleanReturns) - Number(lateReturns));
  let tier = TIERS[0];
  for (const t of TIERS) if (score >= t.minClean) tier = t;
  const next = TIERS[tier.level + 1] || null;
  return { ...tier, score, toNext: next ? next.minClean - score : 0, nextName: next?.name || null };
}

// The deposit for renting an item of this value at this trust level.
export function depositFor({ replacementCost, tier }) {
  const value = Math.max(0, Number(replacementCost) || 0);
  const overCap = value > tier.cap;
  const rate = overCap ? 1 : tier.rate;
  return {
    rate,
    amount: Number((value * rate).toFixed(2)),
    overCap,
    needsGuarantor: value >= GUARANTOR_FROM && tier.level < TIERS.length - 1,
  };
}

// A Bangladeshi mobile number: 01XXXXXXXXX, or +8801XXXXXXXXX (the 0 dropped).
export function validPhone(phone) {
  const digits = String(phone || '').replace(/[\s-]/g, '');
  return /^(?:\+?880|0)1[3-9]\d{8}$/.test(digits);
}

export function checkGuarantor({ name, phone, relation } = {}) {
  if (String(name || '').trim().length < 3) return 'Enter the guarantor’s full name.';
  if (!validPhone(phone)) return 'Enter the guarantor’s mobile number (01XXXXXXXXX).';
  if (String(relation || '').trim().length < 2) return 'Say how the guarantor knows you (e.g. father, employer).';
  return null;
}

// When a rental is due back: the end of its last day, Bangladesh time.
export function dueAt(endDate) {
  return new Date(`${String(endDate).slice(0, 10)}T23:59:59+06:00`);
}

// Escalation stages for an item that is out with a renter.
export const STAGES = {
  0: 'on-time',
  1: 'due-soon',       // due within 12 hours — reminder
  2: 'overdue',        // past due — late fees run from here
  3: 'warning',        // 24 h late — the account will be frozen tomorrow
  4: 'frozen',         // 48 h late — no new rentals; admins and the guarantor are brought in
  5: 'missing',        // 72 h late — the owner can report the item missing
};
export function escalationStage(endDate, now = new Date()) {
  const hours = (new Date(now).getTime() - dueAt(endDate).getTime()) / 3600000;
  if (hours >= 72) return 5;
  if (hours >= 48) return 4;
  if (hours >= 24) return 3;
  if (hours >= 0) return 2;
  if (hours >= -12) return 1;
  return 0;
}
export const hoursLate = (endDate, now = new Date()) =>
  Math.max(0, Math.floor((new Date(now).getTime() - dueAt(endDate).getTime()) / 3600000));

// Split what the renter is charged between the deposit and a balance owed.
export function settle({ charges, deposit }) {
  const c = Math.max(0, Number(charges) || 0);
  const d = Math.max(0, Number(deposit) || 0);
  const depositApplied = Math.min(c, d);
  return {
    charges: Number(c.toFixed(2)),
    depositApplied: Number(depositApplied.toFixed(2)),
    balance: Number((c - depositApplied).toFixed(2)),
    refund: Number((d - depositApplied).toFixed(2)),
  };
}

// A claim the renter still has to pay.
export function isUnpaid(claim) {
  return ['accepted', 'resolved'].includes(claim.status) && Number(claim.balance) > 0 && !claim.paid_at;
}

// Can this renter book right now? Returns the reasons they cannot (empty = yes).
export function renterBlocks({ claims = [], activeRentals = [], now = new Date() } = {}) {
  const reasons = [];
  if (claims.some(isUnpaid)) reasons.push('unpaid-balance');
  if (claims.some((c) => c.status === 'open' && Number(c.balance) > 0)) reasons.push('claim-pending');
  if (activeRentals.some((b) => b.status === 'Missing')) reasons.push('missing-item');
  else if (activeRentals.some((b) => escalationStage(b.end_date, now) >= 4)) reasons.push('overdue-return');
  return reasons;
}

export const BLOCK_TEXT = {
  'unpaid-balance': 'You have an unpaid damage or late-fee balance. Settle it with the owner before renting again.',
  'claim-pending': 'A damage claim from your last rental is waiting for your answer. Accept or dispute it first.',
  'overdue-return': 'An item you rented is more than 2 days overdue. Return it before renting anything else.',
  'missing-item': 'An item you rented has been reported missing.',
};

// A six-digit one-time code, shown only to the renter, typed in by the owner
// at the hand-over — proof the renter was there and agreed to the condition.
export function handoverCode(random = Math.random) {
  return String(Math.floor(random() * 1000000)).padStart(6, '0');
}
