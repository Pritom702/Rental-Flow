// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M3 - Promit Ghosh Turjo (Promit)
//  Part: F15 document numbering + statement totals (pure, unit tested)
// ============================================================
// Shared rules for the documents RentalFlow issues: the rental agreement, the
// return summary, and (new in Sprint 4) the customer statement.

// Agreement numbers look like RF-<bookingId>-<YYYYMMDD>. They are generated once
// and then stored on the booking, so re-printing an agreement keeps its number.
export function agreementNumber(bookingId, date = new Date()) {
  const day = new Date(date).toISOString().slice(0, 10).replace(/-/g, '');
  return `RF-${bookingId}-${day}`;
}

// Statement numbers are per customer + month: RF-ST-<initials>-<YYYYMM>.
export function statementNumber(email, date = new Date()) {
  const handle = String(email || 'guest').split('@')[0].replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);
  const month = new Date(date).toISOString().slice(0, 7).replace('-', '');
  return `RF-ST-${handle || 'GUEST'}-${month}`;
}

export function formatMoney(amount) {
  // RentalFlow is a Bangladeshi marketplace, so amounts are Taka. These strings
  // are printed into PDFs whose font has no '৳' glyph, so use the ISO code.
  return `BDT ${Number(amount || 0).toFixed(2)}`;
}

// Roll a customer's rental history into the totals printed at the foot of a
// statement. Only bookings that were actually served are billed; cancelled and
// rejected requests are listed as $0 so the customer can see they were dropped.
export function statementTotals(history = []) {
  const billable = history.filter((b) => !['Cancelled', 'Rejected'].includes(b.status));
  const sum = (key) => billable.reduce((total, b) => total + Number(b[key] || 0), 0);
  const rentals = billable.reduce(
    (total, b) => total + (Number(b.revenue || 0) - Number(b.late_fee_amount || 0) - Number(b.penalty_amount || 0)),
    0
  );
  const lateFees = sum('late_fee_amount');
  const penalties = sum('penalty_amount');
  return {
    rentalCount: billable.length,
    rentals: Number(rentals.toFixed(2)),
    lateFees: Number(lateFees.toFixed(2)),
    penalties: Number(penalties.toFixed(2)),
    depositsHeld: Number(
      billable
        .filter((b) => b.status !== 'Completed')
        .reduce((total, b) => total + Number(b.deposit_amount || 0), 0)
        .toFixed(2)
    ),
    total: Number((rentals + lateFees + penalties).toFixed(2)),
  };
}

// A document is only issuable once the booking has reached the right stage —
// this keeps the "download" buttons honest instead of printing an empty PDF.
export function availableDocuments(booking = {}) {
  const docs = [];
  if (['Approved', 'Completed'].includes(booking.status) || booking.agreement_number) docs.push('agreement');
  if (booking.checked_in_at) docs.push('return-summary');
  return docs;
}
