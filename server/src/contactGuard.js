// ============================================================
//  RentalFlow  |  Trust  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: keeping deals on RentalFlow (chat guard)
// ============================================================
// Before a booking is approved (or a sale agreed), a chat is "locked": phone
// numbers, emails, mobile-wallet numbers and messenger handles are covered up,
// and both people are reminded that a deal made outside RentalFlow loses the
// deposit protection, damage claims and refunds. Once the deal is on the
// platform, the chat unlocks and everything shows.
//
// It is a gentle guard, not a wall: blocking outright only teaches people code
// words. The aim is to make staying on RentalFlow the obviously better deal.
// Pure functions — tested in contactGuard.test.js.

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';
export function normaliseDigits(text = '') {
  return String(text).replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));
}

// A run of digits that people write with spaces, dots or dashes in between.
const DIGIT_RUN = /(?:\+?\d[\s.\-–()]*){9,15}\d/g;
const EMAIL = /[A-Za-z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[A-Za-z0-9.-]+\s*(?:\.|\(dot\)|\[dot\])\s*[A-Za-z]{2,}/gi;
const LINKS = /\b(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com|t\.me|telegram\.me|m\.me|fb\.me|(?:www\.)?facebook\.com|(?:www\.)?instagram\.com|imo\.im|viber\.me)\/[^\s]*/gi;
const APPS = /\b(whats\s?app|whatsapp|wa|telegram|tg|imo|viber|signal|messenger|insta(?:gram)?|snap(?:chat)?)\b/gi;
const WALLETS = /\b(b\s?kash|bkash|nagad|rocket|upay|tap)\b/gi;
const OUTSIDE = /\b(pay|payment|deal|talk|contact|chat|call|text)\s+(me\s+)?(outside|off)\s*(the\s+)?(app|platform|site|rentalflow)|\bdirect\s+(deal|payment)|\bcash\s+only\b|\bno\s+platform\s+fee\b|\bavoid\s+(the\s+)?fee/gi;

export const MASK = '•••';

// → { text, flags: ['phone' | 'email' | 'link' | 'app' | 'wallet' | 'outside'], hits }
export function guardMessage(raw = '') {
  const flags = new Set();
  let hits = 0;
  let text = normaliseDigits(raw);

  text = text.replace(LINKS, () => { flags.add('link'); hits += 1; return `[link hidden]`; });
  text = text.replace(EMAIL, () => { flags.add('email'); hits += 1; return `[email hidden]`; });
  text = text.replace(DIGIT_RUN, (m) => {
    const digits = m.replace(/\D/g, '');
    if (digits.length < 9) return m;          // prices, dates, short codes are fine
    flags.add('phone'); hits += 1;
    return `[number hidden]`;
  });
  if (WALLETS.test(text)) flags.add('wallet');
  WALLETS.lastIndex = 0;
  if (APPS.test(text)) flags.add('app');
  APPS.lastIndex = 0;
  if (OUTSIDE.test(text)) flags.add('outside');
  OUTSIDE.lastIndex = 0;

  return { text, flags: [...flags], hits };
}

// What to tell the sender, by what was found.
export function guardNote(flags = []) {
  if (!flags.length) return null;
  if (flags.includes('outside') || flags.includes('wallet')) {
    return 'Paying outside RentalFlow means no deposit protection, no damage claims and no refund if something goes wrong. Book here and you are covered.';
  }
  return 'Contact details stay hidden until the booking is approved — then they show for both of you automatically.';
}
