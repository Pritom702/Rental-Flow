// ============================================================
//  RentalFlow  |  Business  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: the money rules — fees, Limes, ads (pure)
// ============================================================
// Every number the business runs on, in one place, as plain functions so they
// are unit-tested (marketUtils.test.js) and easy to explain to anyone.

// ---------------------------------------------------------------- rental fees
// On every rental done through RentalFlow:
//   renter service fee  5% of the rental (at least ৳20) — added to what they pay
//   owner commission    8% of the rental — taken from the owner's payout
//   damage protection   optional, 7% of the rental (at least ৳30) — covers
//                       accidental damage up to the item's value
export const FEES = { renterRate: 0.05, renterMin: 20, ownerRate: 0.08, protectionRate: 0.07, protectionMin: 30, saleRate: 0.03 };

export function rentalDays(start, end) {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(1, Math.round((b - a) / 86400000)) : 1;
}

export function rentalFees(pricePerDay, days, { protection = false } = {}) {
  const total = Math.round(Number(pricePerDay || 0) * Math.max(1, days));
  const renterFee = total > 0 ? Math.max(FEES.renterMin, Math.round(total * FEES.renterRate)) : 0;
  const ownerFee = Math.round(total * FEES.ownerRate);
  const protectionFee = protection && total > 0 ? Math.max(FEES.protectionMin, Math.round(total * FEES.protectionRate)) : 0;
  return {
    rentalTotal: total,
    renterFee,
    ownerFee,
    protectionFee,
    renterPays: total + renterFee + protectionFee,
    ownerGets: total - ownerFee,
    platformEarns: renterFee + ownerFee + protectionFee,
  };
}

// A sale agreed in the chat: 3% of the price, rounded, at least ৳10.
export const saleFee = (price) => Math.max(10, Math.round(Number(price || 0) * FEES.saleRate));

// ---------------------------------------------------------------- Limes
// Packs of Limes for money. Bigger packs give more per taka.
export const PACKS = {
  starter: { credits: 120, bdt: 99, label: 'Starter' },
  popular: { credits: 550, bdt: 399, label: 'Popular', best: true },
  pro:     { credits: 1300, bdt: 799, label: 'Pro' },
};
// What Limes buy (each lasts 24 hours).
export const PRICES = {
  boost_post: 30,       // your post lifted high in everyone's feed
  boost_item: 40,       // your listing featured at the top of Browse
  boost_wanted: 15,     // your "wanted" request highlighted
};
// What earns Limes — the things that keep RentalFlow healthy.
export const EARN = {
  daily: 2,               // coming back each day
  streak_week: 10,        // every 7 days in a row
  first_listing: 15,      // listing your first item
  rental_completed: 20,   // a rental finished ON RentalFlow (both people)
  sale_completed: 10,     // a sale agreed ON RentalFlow (both people)
  referral: 30,           // someone you invited joins and confirms their email
  referral_welcome: 20,   // ...and they get a welcome bonus too
  report_offplatform: 5,  // reporting someone who asked to pay outside
};
// Ads: every 10 views of a sponsored post cost 1 Lime of its budget.
export const VIEWS_PER_LIME = 10;
export const adSpent = (views) => Math.floor(Number(views || 0) / VIEWS_PER_LIME);

// Roughly what one Lime is worth in taka (the Popular pack's rate), for the
// revenue dashboard's estimates of ad and boost spending.
export const BDT_PER_LIME = PACKS.popular.bdt / PACKS.popular.credits;

// Where sponsored posts sit in a page of 12: after the 3rd and the 9th post.
export const AD_SLOTS = [3, 9];
export function withAds(posts, ads) {
  const out = [...posts];
  AD_SLOTS.forEach((slot, i) => {
    if (ads[i] && out.length >= slot) out.splice(slot + i, 0, ads[i]);
  });
  return out;
}
