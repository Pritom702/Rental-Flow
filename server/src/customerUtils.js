// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: F17 customer CRM scoring (pure, unit tested)
// ============================================================
// A customer is identified by their email address — the booking form is public,
// so the same person can spell their name differently between bookings, but the
// email is what we can key on reliably.

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Loyalty tier, driven by lifetime spend and how many rentals they've taken.
// Thresholds are in Bangladeshi Taka and are set against the real day rates on
// the platform (roughly ৳900–৳14,000 a day). ৳1,00,000 of lifetime spend is
// several substantial rentals; ৳25,000 is about one. Getting this scale wrong
// is not cosmetic — it decides who the platform treats as a trusted customer.
export const TIER_VIP_SPEND = 100000;
export const TIER_REGULAR_SPEND = 25000;

export function customerTier({ totalSpend = 0, bookingCount = 0 } = {}) {
  const spend = Number(totalSpend || 0);
  if (spend >= TIER_VIP_SPEND || bookingCount >= 8) return 'VIP';
  if (spend >= TIER_REGULAR_SPEND || bookingCount >= 3) return 'Regular';
  return 'New';
}

// Reliability = share of finished rentals returned without a late fee or a
// damage penalty, as a 0-100 score. A customer with no finished rentals yet is
// given the benefit of the doubt at 100.
export function reliabilityScore(bookings = []) {
  const finished = bookings.filter((b) => b.status === 'Completed');
  if (!finished.length) return 100;
  const clean = finished.filter(
    (b) => Number(b.late_fee_amount || 0) === 0 && Number(b.penalty_amount || 0) === 0
  );
  return Math.round((clean.length / finished.length) * 100);
}

// A short human label for the reliability score, shown next to the number.
export function reliabilityLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Watch';
  return 'At risk';
}

// Collapse a customer's bookings into their CRM profile row.
export function buildProfile(bookings = []) {
  const sorted = [...bookings].sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
  // `revenue` already includes the booking's late fee and damage penalty, so it
  // is summed on its own — adding the fees again would double-count them.
  const totalSpend = bookings.reduce((sum, b) => sum + Number(b.revenue ?? 0), 0);
  const score = reliabilityScore(bookings);
  return {
    name: sorted[sorted.length - 1]?.customer_name || '',
    email: normalizeEmail(sorted[0]?.customer_email),
    bookingCount: bookings.length,
    totalSpend: Number(totalSpend.toFixed(2)),
    firstRental: sorted[0]?.start_date || null,
    lastRental: sorted[sorted.length - 1]?.start_date || null,
    activeCount: bookings.filter((b) => ['Pending', 'Approved'].includes(b.status)).length,
    tier: customerTier({ totalSpend, bookingCount: bookings.length }),
    reliability: score,
    reliabilityLabel: reliabilityLabel(score),
  };
}
