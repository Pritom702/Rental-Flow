// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Bangladeshi mobile numbers
// ============================================================
// People type their number many ways: "01712-345678", "+880 1712 345678",
// "8801712345678", or in Bangla digits. All of them become 01712345678.

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';

// The 11-digit local form (01XXXXXXXXX), or null when it is not a BD mobile.
export function normalizeBdPhone(raw) {
  const digits = String(raw || '')
    .replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)))
    .replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('880')) local = local.slice(2);          // 8801… → 01…
  else if (local.startsWith('1') && local.length === 10) local = `0${local}`;
  // Operators use 013–019 (013/017 Grameenphone, 014/019 Banglalink, 015 Teletalk, 016/018 Robi).
  return /^01[3-9]\d{8}$/.test(local) ? local : null;
}

// "01712345678" → "01712-•••678", for showing where a code went.
export function maskPhone(phone) {
  const p = String(phone || '');
  return p.length === 11 ? `${p.slice(0, 5)}-•••${p.slice(8)}` : p;
}
