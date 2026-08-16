// ============================================================
//  RentalFlow  |  Sprint 3  |  Part: PDF export (F11 agreement, F15 export)
// ============================================================
// Client-side PDF generation with jsPDF. Two documents:
//   - Rental agreement (before checkout)
//   - Return summary (after check-in) with condition comparison + final bill
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

  doc.save(`return-${number}.pdf`);
}
