// ============================================================
//  RentalFlow  |  Business  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: rental fees, as the booking form shows them
// ============================================================
// The same rules as server/src/marketUtils.js (which is what is recorded):
// 5% service fee for the renter (at least ৳20), optional damage protection
// at 7% (at least ৳30). The owner's 8% commission comes out of their payout.
export function rentalDays(start, end) {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(1, Math.round((b - a) / 86400000)) : 1;
}
export function rentalFees(pricePerDay, days, protection = false) {
  const total = Math.round(Number(pricePerDay || 0) * Math.max(1, days));
  const service = total > 0 ? Math.max(20, Math.round(total * 0.05)) : 0;
  const cover = protection && total > 0 ? Math.max(30, Math.round(total * 0.07)) : 0;
  return { total, service, cover, pay: total + service + cover };
}
