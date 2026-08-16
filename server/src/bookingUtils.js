export function calculateDeposit(replacementCost, rate = 0.2) {
  return Number((Number(replacementCost || 0) * rate).toFixed(2));
}

export function calculateLateFee(rentalPrice, overdueDays, rate = 0.1) {
  return Number((Number(rentalPrice || 0) * rate * Math.max(0, Number(overdueDays || 0))).toFixed(2));
}

// How many days past its end date a booking is, as of `asOf` (defaults to now).
// Returns 0 when the booking is not yet overdue. Used to calculate late fees
// automatically instead of asking a staff member to type in the overdue days.
export function overdueDays(endDate, asOf = new Date()) {
  if (!endDate) return 0;
  const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00`);
  const refKey = new Date(asOf).toISOString().slice(0, 10);
  const ref = new Date(`${refKey}T00:00:00`);
  const diffMs = ref.getTime() - end.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// --- Sprint 3: damage penalty (F14) + final bill ---

// Fraction of replacement cost charged for a given return condition.
const SEVERITY = { New: 0, Good: 0, Fair: 0.05, Poor: 0.15, Damaged: 0.30 };

export function severityPct(conditionStatus) {
  return SEVERITY[conditionStatus] || 0;
}

// penalty = severity% of replacement + repair cost + missing-accessory charge,
// never more than the item's replacement cost.
export function calculatePenalty({ conditionStatus, replacementCost, repairCost = 0, missingCharge = 0 }) {
  const rc = Number(replacementCost || 0);
  const raw = severityPct(conditionStatus) * rc + Number(repairCost || 0) + Number(missingCharge || 0);
  return Number(Math.min(rc, Math.max(0, raw)).toFixed(2));
}

function daysBetween(startDate, endDate) {
  const s = new Date(`${String(startDate).slice(0, 10)}T00:00:00`);
  const e = new Date(`${String(endDate).slice(0, 10)}T00:00:00`);
  return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
}

// Final settlement. Deposit is a refundable hold reconciled against late fee +
// penalty: whatever the charges don't consume is refunded; any excess is owed.
export function buildBill({ rentalPrice, startDate, endDate, depositAmount, lateFee = 0, penalty = 0 }) {
  const rentalDays = daysBetween(startDate, endDate);
  const rentalSubtotal = Number((Number(rentalPrice || 0) * rentalDays).toFixed(2));
  const deposit = Number(depositAmount || 0);
  const charges = Number((Number(lateFee || 0) + Number(penalty || 0)).toFixed(2));
  return {
    rentalDays,
    rentalSubtotal,
    depositAmount: deposit,
    lateFee: Number(Number(lateFee || 0).toFixed(2)),
    penalty: Number(Number(penalty || 0).toFixed(2)),
    charges,
    depositRefund: Number(Math.max(0, deposit - charges).toFixed(2)),
    balanceDue: Number(Math.max(0, charges - deposit).toFixed(2)),
  };
}

export function hasDateOverlap(startDate, endDate, existingStart, existingEnd) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const existingStartDate = new Date(`${existingStart}T00:00:00`);
  const existingEndDate = new Date(`${existingEnd}T00:00:00`);
  return start < existingEndDate && end > existingStartDate;
}
