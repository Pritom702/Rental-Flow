// ============================================================
//  RentalFlow  |  Rental protection  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: incident report PDF (for a police GD)
// ============================================================
// When a rented item is not returned, the owner (or an admin) downloads this
// report and takes it to the local police station to file a General Diary.
// It gathers the verified identity, the hand-over proof, the timeline and the
// chat in one place. The NID number appears only in an admin's copy — the
// owner's copy says the police can request it from RentalFlow.
// jsPDF is loaded only when a report is actually made.
import { moneyAscii as money } from './money.js';

const when = (v) => (v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export async function exportIncidentReportPdf(r) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  let y = 18;
  const page = () => { if (y > 270) { doc.addPage(); y = 18; } };
  const heading = (t) => { page(); doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(16, 41, 29).text(t, 14, y); y += 7; };
  const line = (label, value) => {
    page();
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(80).text(label, 16, y);
    const wrapped = doc.splitTextToSize(String(value ?? '—'), 120);
    doc.setFont('helvetica', 'normal').setTextColor(20).text(wrapped, 70, y);
    y += 5.5 * wrapped.length;
  };
  const para = (t) => {
    const wrapped = doc.splitTextToSize(t, 180);
    wrapped.forEach((w) => { page(); doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(40).text(w, 14, y); y += 5; });
  };

  const ref = `RF-INC-${r.booking.id}`;
  doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(16, 41, 29).text('Incident report — rented item not returned', 14, y); y += 8;
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90)
    .text(`Reference ${ref} · generated ${when(r.generatedAt)} · ${r.adminCopy ? 'ADMIN COPY' : 'Owner copy'}`, 14, y); y += 10;

  heading('The item');
  line('Item', r.booking.item);
  line('Value', money(r.booking.value));
  line('Booking', `#${r.booking.id}${r.booking.agreement ? ` · agreement ${r.booking.agreement}` : ''}`);
  line('Owner', r.owner.name);
  y += 3;

  heading('The renter');
  line('Name', r.renter.name);
  line('Email', r.renter.email);
  line('Phone', r.renter.phone || '—');
  line('Identity', r.renter.identityVerified
    ? `Verified by RentalFlow (national ID card + live face check)${r.renter.nidName ? ` — name on NID: ${r.renter.nidName}` : ''}`
    : 'Not verified');
  if (r.adminCopy) line('NID number', r.renter.nidNumber || '—');
  else line('NID number', 'On file with RentalFlow — available to the police on request');
  if (r.renter.memberSince) line('Member since', when(r.renter.memberSince));
  if (r.guarantor) line('Guarantor', `${r.guarantor.name} (${r.guarantor.relation}), ${r.guarantor.phone}`);
  y += 3;

  heading('Timeline');
  line('Rental period', `${String(r.booking.startDate).slice(0, 10)} to ${String(r.booking.endDate).slice(0, 10)}`);
  line('Deposit received', `${money(r.booking.deposit)} — ${when(r.booking.depositReceivedAt)}`);
  line('Handed over', when(r.booking.checkedOutAt));
  line('Renter confirmed', r.booking.renterConfirmedCheckoutAt
    ? `${when(r.booking.renterConfirmedCheckoutAt)} (with their one-time code — proof they received the item)`
    : 'No code confirmation on record');
  line('Due back', when(r.booking.dueAt));
  line('Hours overdue', String(r.booking.hoursLate));
  line('Reported missing', when(r.booking.missingReportedAt));
  y += 3;

  if (r.claim) {
    heading('Charges');
    line('Charged', money(r.claim.charges));
    line('From the deposit', money(r.claim.depositApplied));
    line('Still owed', money(r.claim.balance));
    y += 3;
  }

  if (r.conditionReports?.length) {
    heading('Condition when handed over');
    r.conditionReports.forEach((c) => line(c.phase === 'checkout' ? 'At hand-over' : 'At return', `${c.condition}${c.notes ? ` — ${c.notes}` : ''} (${c.photos} photo${c.photos === 1 ? '' : 's'}, ${when(c.at)})`));
    y += 3;
  }

  if (r.messages?.length) {
    heading('Recent messages between owner and renter');
    r.messages.forEach((m) => para(`[${when(m.created_at)}] ${m.sender}: ${m.body}`));
    y += 3;
  }

  heading('What to do next');
  para('1. Take this report to the police station (thana) for the area where the item was handed over and file a General Diary (GD).');
  para('2. Give the police the reference number above. RentalFlow will share the renter’s verified national ID and photos with the police on request.');
  para('3. Keep RentalFlow informed — if the item is recovered, an admin closes the incident.');

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(120);
    doc.text(`RentalFlow · ${ref}`, 14, 288);
    doc.text(`Page ${i} of ${pages}`, 196, 288, { align: 'right' });
  }
  doc.save(`${ref}.pdf`);
}
