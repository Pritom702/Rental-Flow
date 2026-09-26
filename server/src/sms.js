// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: sending the phone code by SMS
// ============================================================
// Real SMS needs a Bangladeshi SMS gateway account. Until one is set up, the
// app runs in test mode, like the email step: the code is logged and shown on
// the screen so the check can still be done end to end.
//
// To switch real SMS on, set SMS_API_URL and SMS_API_KEY. The gateway gets a
// POST with JSON { api_key, to, message }; most BD gateways (BulkSMSBD, SSL
// Wireless, Alpha SMS) accept this shape or need a one-line change here.

export function smsConfigured() {
  return Boolean(process.env.SMS_API_URL && process.env.SMS_API_KEY);
}

// Returns { sent: true } or, in test mode, { sent: false, dev: true }.
export async function sendSms(to, message) {
  if (!smsConfigured()) {
    console.log(`[sms:dev] to=${to} ${message}`);
    return { sent: false, dev: true };
  }
  const res = await fetch(process.env.SMS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.SMS_API_KEY, to: `88${to}`, message }),
  });
  if (!res.ok) throw Object.assign(new Error('The text message could not be sent. Please try again in a minute.'), { status: 502 });
  return { sent: true };
}
