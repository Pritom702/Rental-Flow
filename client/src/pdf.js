// ============================================================
//  RentalFlow  |  Sprint 3-4  |  Owner: M3 - Promit Ghosh Turjo (Promit)
//  Part: PDF export (F11 agreement, F15 export)
// ============================================================
// Client-side PDF generation with jsPDF. Three documents:
//   - Rental agreement (before checkout)
//   - Return summary (after check-in) with condition comparison + final bill
//   - Customer statement (Sprint 4): every rental a customer has taken, billed
import { jsPDF } from 'jspdf';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const AGREEMENT_TERMS = [
  '1. The customer is responsible for the rented item(s) for the full rental period.',
  '2. A refundable deposit is held and reconciled against late fees and damage penalties.',
  '3. Late returns incur a late fee of 10% of the daily rental price per overdue day.',
  '4. Damage, missing accessories, or a worse return condition may incur a penalty.',
  '5. The item must be returned in the same condition recorded at check-out.',
];

// Small layout helper: prints a heading + key/value lines, returns next y.
function section(doc, title, lines, y) {
  doc.setFont('helvetica', 'bold').setFontSize(12).text(title, 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal').setFontSize(11);
  for (const line of lines) { doc.text(line, 16, y); y += 6; }
  return y + 4;
}

// Sprint 4: shared footer so every document RentalFlow issues is identifiable
// and paginated the same way.
function stampFooter(doc, reference) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(120);
    doc.text(`RentalFlow · ${reference}`, 14, 288);
    doc.text(`Page ${page} of ${pages}`, 196, 288, { align: 'right' });
    doc.setTextColor(0);
  }
}

export function exportAgreementPdf(booking) {
  const doc = new jsPDF();
  const number = booking.agreement_number || `RF-${booking.id}`;
  doc.setFont('helvetica', 'bold').setFontSize(18).text('RentalFlow — Rental Agreement', 14, 20);
  doc.setFont('helvetica', 'normal').setFontSize(10)
    .text(`Agreement No: ${number}`, 14, 28)
    .text(`Generated: ${new Date().toLocaleString()}`, 14, 33);

  let y = 45;
  y = section(doc, 'Customer', [
    `Name:  ${booking.customer_name || '-'}`,
    `Email: ${booking.customer_email || '-'}`,
  ], y);
  y = section(doc, 'Rental', [
    `Item:          ${booking.item_name || `#${booking.item_id}`}`,
    `Rental period: ${booking.start_date} to ${booking.end_date}`,
    `Daily price:   ${money(booking.rental_price)}`,
    `Deposit held:  ${money(booking.deposit_amount)}`,
  ], y);
  y = section(doc, 'Terms & Return Conditions', AGREEMENT_TERMS, y);

  doc.setFontSize(10).text('Customer signature: ______________________', 14, y + 10);
  doc.text('Staff signature: ______________________', 14, y + 20);
  stampFooter(doc, `Agreement ${number}`);
  doc.save(`agreement-${number}.pdf`);
}

export function exportReturnSummaryPdf(booking, bill, reports = []) {
  const doc = new jsPDF();
  const number = booking.agreement_number || `RF-${booking.id}`;
  const checkout = reports.find((r) => r.phase === 'checkout');
  const checkin = reports.find((r) => r.phase === 'checkin');

  doc.setFont('helvetica', 'bold').setFontSize(18).text('RentalFlow — Return Summary', 14, 20);
  doc.setFont('helvetica', 'normal').setFontSize(10)
    .text(`Agreement No: ${number}`, 14, 28)
    .text(`Item: ${booking.item_name || `#${booking.item_id}`}  ·  Customer: ${booking.customer_name || '-'}`, 14, 33);

  let y = 45;
  y = section(doc, 'Condition comparison', [
    `At check-out: ${checkout ? checkout.condition_status : '-'}${checkout?.notes ? ` (${checkout.notes})` : ''}`,
    `At check-in:  ${checkin ? checkin.condition_status : '-'}${checkin?.notes ? ` (${checkin.notes})` : ''}`,
    `Missing accessories: ${checkin?.missing_accessories || 'none reported'}`,
  ], y);
  y = section(doc, 'Final bill', [
    `Rental (${bill.rentalDays} day(s)): ${money(bill.rentalSubtotal)}`,
    `Deposit held:               ${money(bill.depositAmount)}`,
    `Late fee:                   ${money(bill.lateFee)}`,
    `Damage penalty:             ${money(bill.penalty)}`,
    `-----------------------------------------`,
    `Total charges:              ${money(bill.charges)}`,
    `Deposit refund:             ${money(bill.depositRefund)}`,
    `Balance due:                ${money(bill.balanceDue)}`,
  ], y);

  stampFooter(doc, `Return summary ${number}`);
  doc.save(`return-${number}.pdf`);
}

// --- Sprint 4 / F15: customer statement -------------------------------------
// One page listing every rental a customer has taken with what each one was
// billed, and the totals at the bottom. Staff hand this to repeat customers.
function statementNumber(email, date = new Date()) {
  const handle = String(email || 'guest').split('@')[0].replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);
  return `RF-ST-${handle || 'GUEST'}-${date.toISOString().slice(0, 7).replace('-', '')}`;
}

export function exportCustomerStatementPdf(profile, history = []) {
  const doc = new jsPDF();
  const number = statementNumber(profile.email);

  doc.setFont('helvetica', 'bold').setFontSize(18).text('RentalFlow — Customer Statement', 14, 20);
  doc.setFont('helvetica', 'normal').setFontSize(10)
    .text(`Statement No: ${number}`, 14, 28)
    .text(`Issued: ${new Date().toLocaleDateString()}`, 14, 33);

  let y = 45;
  y = section(doc, 'Customer', [
    `Name:        ${profile.name || '-'}`,
    `Email:       ${profile.email || '-'}`,
    `Tier:        ${profile.tier}  (${profile.bookingCount} rental(s))`,
    `Reliability: ${profile.reliability}% — ${profile.reliabilityLabel}`,
  ], y);

  doc.setFont('helvetica', 'bold').setFontSize(12).text('Rental history', 14, y);
  y += 7;
  doc.setFontSize(9);
  doc.text('Item', 16, y);
  doc.text('Period', 82, y);
  doc.text('Status', 132, y);
  doc.text('Billed', 196, y, { align: 'right' });
  y += 2;
  doc.line(14, y, 196, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  let total = 0;
  for (const b of history) {
    if (y > 265) { doc.addPage(); y = 20; }
    const billed = ['Cancelled', 'Rejected'].includes(b.status) ? 0 : Number(b.revenue || 0);
    total += billed;
    doc.text(String(b.item_name || `#${b.item_id}`).slice(0, 32), 16, y);
    doc.text(`${b.start_date} - ${b.end_date}`, 82, y);
    doc.text(b.status, 132, y);
    doc.text(money(billed), 196, y, { align: 'right' });
    y += 6;
  }

  y += 2;
  doc.line(120, y, 196, y);
  y += 6;
  doc.setFont('helvetica', 'bold').setFontSize(11);
  doc.text('Total billed to date', 120, y);
  doc.text(money(total), 196, y, { align: 'right' });

  stampFooter(doc, `Statement ${number}`);
  doc.save(`statement-${number}.pdf`);
}
