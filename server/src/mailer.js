// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: sending email (verification codes, decisions)
// ============================================================
// Sends through a Gmail account with an "app password" — free, ~500 mails a day.
// Set in server/.env (or the Vercel project's environment variables):
//   GMAIL_USER=rentalflow.verify@gmail.com
//   GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
//
// Without those two, mail runs in DEV MODE: nothing is sent, the message is
// printed in the server log, and the verification route hands the code back to
// the screen, clearly labelled — so development and demos work with no setup.
import nodemailer from 'nodemailer';

let transport = null;

export function mailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, ''),
      },
    });
  }
  return transport;
}

// Returns { sent: true } or, in dev mode, { sent: false, dev: true }.
export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured()) {
    console.log(`[mail:dev] to=${to} subject="${subject}"\n${text}`);
    return { sent: false, dev: true };
  }
  await getTransport().sendMail({
    from: `"RentalFlow" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
  return { sent: true };
}

// The 6-digit code email. Short, and the code is the first thing you see.
export function codeEmail(name, code) {
  const text = `Hi ${name},\n\nYour RentalFlow verification code is ${code}\n\n`
    + 'It expires in 10 minutes. If you did not sign up for RentalFlow, ignore this email.';
  const html = `<div style="font-family:system-ui,sans-serif;max-width:420px">
    <p>Hi ${escapeHtml(name)},</p>
    <p>Your RentalFlow verification code is</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:8px 0">${code}</p>
    <p style="color:#666">It expires in 10 minutes. If you did not sign up for RentalFlow, ignore this email.</p>
  </div>`;
  return { subject: `${code} is your RentalFlow code`, text, html };
}

export function decisionEmail(name, approved, note) {
  const subject = approved ? 'Your RentalFlow account is verified' : 'Your RentalFlow ID check needs attention';
  const text = approved
    ? `Hi ${name},\n\nYour identity has been verified. You can now use RentalFlow.`
    : `Hi ${name},\n\nWe could not verify your identity.${note ? `\n\nReason: ${note}` : ''}\n\n`
      + 'Open RentalFlow to try again.';
  return { subject, text, html: `<div style="font-family:system-ui,sans-serif;white-space:pre-line">${escapeHtml(text)}</div>` };
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
