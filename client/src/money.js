// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Currency formatting (Bangladeshi Taka)
// ============================================================
// RentalFlow is a Bangladeshi marketplace, so every amount is shown in Taka.
// One helper here keeps the symbol and grouping identical on every page and in
// the generated PDFs — no page should format money on its own.

export const CURRENCY_SYMBOL = '৳';
export const CURRENCY_CODE = 'BDT';

// Bangla uses the Indian digit grouping (1,00,000 rather than 100,000), which
// `en-IN` gives us without pulling in a formatting library.
const LOCALE = 'en-IN';

// Full precision — prices, deposits, fees, bill lines.
export function money(n) {
  return `${CURRENCY_SYMBOL}${Number(n || 0).toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Rounded — chart axes and KPI tiles, where decimals are noise.
export function moneyShort(n) {
  return `${CURRENCY_SYMBOL}${Number(n || 0).toLocaleString(LOCALE, {
    maximumFractionDigits: 0,
  })}`;
}

// Whole Taka with no decimals but still grouped (e.g. replacement cost).
export const moneyRound = moneyShort;

// The PDF generator writes with jsPDF's built-in Helvetica, which has no glyph
// for '৳' — it would render as a blank box. Use the ISO code there instead.
export function moneyAscii(n) {
  return `${CURRENCY_CODE} ${Number(n || 0).toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
