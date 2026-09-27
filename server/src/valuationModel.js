// ============================================================
//  RentalFlow  |  Trust  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: what a listed item is worth (learned from admins)
// ============================================================
// Every new listing is checked by an admin, who confirms the item's market
// price. The replacement cost is 60% of that market price, and if a rented
// item is stolen and not recovered within a month the owner is paid 50% of
// the replacement cost.
//
// To make the admin's job quick, this model suggests the market price. It
// learns from every price an admin approved, in two ways:
//   1. rent ratio — how many days of rent an item is worth in its category:
//        ratio = approved market price ÷ daily rent
//      (geometric mean per category, pulled toward the all-category mean
//       when a category has few examples — shrinkage with weight K)
//   2. declared bias — how far owners' own market prices are from what the
//      admin approves: bias = approved ÷ declared (geometric mean, pulled
//      toward 1 while there are few examples)
// The suggestion blends the two estimates in log space:
//   market = exp( W·ln(declared × bias) + (1 − W)·ln(daily × ratio) )
// Pure functions, no database: unit-tested in valuationModel.test.js.

export const REPLACEMENT_RATE = 0.6;     // replacement cost = 60% of market price
export const COMPENSATION_RATE = 0.5;    // theft payout = 50% of replacement cost
export const RECOVERY_DAYS = 30;         // we try to recover a stolen item for 1 month
export const PRIOR_RATIO = 40;           // before any data: an item is worth ~40 days of rent
export const SHRINK_K = 3;               // examples a category needs before it counts as much as the prior
export const DECLARED_WEIGHT = 0.6;      // how much the owner's own price counts in the blend

const ln = Math.log;
const roundTo = (n, step) => Math.max(step, Math.round(n / step) * step);
const tk = (n) => `৳${Math.round(n).toLocaleString('en-IN')}`;

export function replacementFor(market) { return Math.round(Number(market || 0) * REPLACEMENT_RATE); }
export function compensationFor(replacement) { return Math.round(Number(replacement || 0) * COMPENSATION_RATE); }

function meanLog(values) {
  const v = values.filter((x) => x > 0 && Number.isFinite(x));
  return v.length ? { mean: v.reduce((s, x) => s + ln(x), 0) / v.length, n: v.length } : { mean: 0, n: 0 };
}

// examples: [{ category_id, daily, declared, approved }]
export function learn(examples = []) {
  const ok = examples.filter((e) => Number(e.approved) > 0 && Number(e.daily) > 0);
  const all = meanLog(ok.map((e) => e.approved / e.daily));
  const globalLogRatio = all.n ? (all.n * all.mean + SHRINK_K * ln(PRIOR_RATIO)) / (all.n + SHRINK_K) : ln(PRIOR_RATIO);
  const byCategory = {};
  const groups = {};
  for (const e of ok) (groups[e.category_id] ||= []).push(e.approved / e.daily);
  for (const [cat, ratios] of Object.entries(groups)) {
    const m = meanLog(ratios);
    byCategory[cat] = { logRatio: (m.n * m.mean + SHRINK_K * globalLogRatio) / (m.n + SHRINK_K), n: m.n };
  }
  const b = meanLog(ok.filter((e) => Number(e.declared) > 0).map((e) => e.approved / e.declared));
  const logBias = b.n ? (b.n * b.mean) / (b.n + SHRINK_K) : 0;   // shrunk toward ln(1) = 0
  return { globalLogRatio, byCategory, logBias, examples: ok.length, biasExamples: b.n };
}

// → { market, replacement, compensation, basis: [text] }
export function suggest(model, { category_id, daily, declared }) {
  const m = model || learn([]);
  const cat = m.byCategory[category_id];
  const logRatio = cat ? cat.logRatio : m.globalLogRatio;
  const ratio = Math.exp(logRatio);
  const d = Number(daily) || 0;
  const own = Number(declared) || 0;
  const bias = Math.exp(m.logBias);
  const fromRent = d > 0 ? d * ratio : 0;
  const fromOwner = own > 0 ? own * bias : 0;
  let market;
  if (fromRent && fromOwner) market = Math.exp(DECLARED_WEIGHT * ln(fromOwner) + (1 - DECLARED_WEIGHT) * ln(fromRent));
  else market = fromOwner || fromRent;
  market = market ? roundTo(market, 100) : 0;
  const replacement = replacementFor(market);
  const basis = [
    fromRent ? `Rent: ${tk(d)}/day × ${ratio.toFixed(1)} days (${cat ? `learned from ${cat.n} approved in this category` : m.examples ? `learned from ${m.examples} approved listings` : 'starting estimate'}) = ${tk(fromRent)}` : null,
    fromOwner ? `Owner says ${tk(own)} × ${bias.toFixed(2)} (how owners' prices compare with approved ones, from ${m.biasExamples} examples) = ${tk(fromOwner)}` : null,
    fromRent && fromOwner ? `Blend: ${Math.round(DECLARED_WEIGHT * 100)}% owner, ${Math.round((1 - DECLARED_WEIGHT) * 100)}% rent (geometric) → market ${tk(market)}` : null,
    `Replacement cost = 60% of market = ${tk(replacement)}; theft compensation = 50% of that = ${tk(compensationFor(replacement))}`,
  ].filter(Boolean);
  return { market, replacement, compensation: compensationFor(replacement), basis };
}
