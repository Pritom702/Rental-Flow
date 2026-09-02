// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M1 - Md. Safinuzzaman (Shafin)
//  GitHub: @shaafin01  |  Part: F19 revenue & utilization maths (pure, unit tested)
// ============================================================

export function daysBetween(startDate, endDate) {
  const s = new Date(`${String(startDate).slice(0, 10)}T00:00:00`);
  const e = new Date(`${String(endDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  return Math.max(0, Math.round((e - s) / (1000 * 60 * 60 * 24)));
}

// What a single booking actually earns: the rental itself plus any late fee and
// damage penalty charged on it. The deposit is NOT revenue — it is a refundable
// hold, so it is deliberately left out.
export function bookingRevenue(booking = {}) {
  const days = daysBetween(booking.start_date, booking.end_date);
  const rental = Number(booking.rental_price || 0) * days;
  const extras = Number(booking.late_fee_amount || 0) + Number(booking.penalty_amount || 0);
  return Number((rental + extras).toFixed(2));
}

// Utilization = share of the window in which the item was actually out on
// rental. Booked days are clipped to the window so a booking that starts before
// or ends after the reporting period is only counted for its overlapping part.
export function utilizationRate(bookings = [], windowStart, windowEnd) {
  const windowDays = daysBetween(windowStart, windowEnd);
  if (windowDays <= 0) return 0;
  let booked = 0;
  for (const b of bookings) {
    const start = String(b.start_date).slice(0, 10) < windowStart ? windowStart : String(b.start_date).slice(0, 10);
    const end = String(b.end_date).slice(0, 10) > windowEnd ? windowEnd : String(b.end_date).slice(0, 10);
    booked += daysBetween(start, end);
  }
  return Number(Math.min(100, (booked / windowDays) * 100).toFixed(1));
}

// Total rented days across a set of bookings, each clipped to the window. Unlike
// utilizationRate this is not capped, because a whole fleet can have many items
// out on the same day.
export function totalBookedDays(bookings = [], windowStart, windowEnd) {
  let booked = 0;
  for (const b of bookings) {
    const start = String(b.start_date).slice(0, 10) < windowStart ? windowStart : String(b.start_date).slice(0, 10);
    const end = String(b.end_date).slice(0, 10) > windowEnd ? windowEnd : String(b.end_date).slice(0, 10);
    booked += daysBetween(start, end);
  }
  return booked;
}

// Fleet-wide utilization: rented days across every item, over the days the whole
// fleet could have been rented (window length x item count).
export function fleetUtilization(bookings, windowStart, windowEnd, itemCount) {
  const capacity = daysBetween(windowStart, windowEnd) * Number(itemCount || 0);
  if (capacity <= 0) return 0;
  return Number(Math.min(100, (totalBookedDays(bookings, windowStart, windowEnd) / capacity) * 100).toFixed(1));
}

// Turn sparse `[{ month: '2026-03', revenue }]` rows into a continuous series of
// the last `count` months so the chart never shows a gap for a quiet month.
export function monthlySeries(rows = [], count = 6, asOf = new Date()) {
  const found = new Map(rows.map((r) => [String(r.month).slice(0, 7), Number(r.revenue || 0)]));
  const out = [];
  const cursor = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
  cursor.setUTCMonth(cursor.getUTCMonth() - (count - 1));
  for (let i = 0; i < count; i += 1) {
    const key = cursor.toISOString().slice(0, 7);
    out.push({
      month: key,
      label: cursor.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      revenue: Number((found.get(key) || 0).toFixed(2)),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

// Average revenue per completed rental — the "how valuable is a booking" number.
export function averageOrderValue(totalRevenue, bookingCount) {
  if (!bookingCount) return 0;
  return Number((Number(totalRevenue || 0) / bookingCount).toFixed(2));
}

// Growth vs. the previous period, as a signed percentage. No previous revenue
// but some now = 100% growth; nothing either way = 0.
export function growthPct(current, previous) {
  const c = Number(current || 0);
  const p = Number(previous || 0);
  if (p === 0) return c === 0 ? 0 : 100;
  return Number((((c - p) / p) * 100).toFixed(1));
}
