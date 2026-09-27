// ============================================================
//  RentalFlow  |  Trust  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: valuation model unit tests (node --test)
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { learn, suggest, replacementFor, compensationFor, PRIOR_RATIO } from './valuationModel.js';

test('replacement is 60% of market, compensation 50% of replacement', () => {
  assert.equal(replacementFor(100000), 60000);
  assert.equal(compensationFor(60000), 30000);
});

test('with no data: 40 days of rent, blended with what the owner says', () => {
  const m = learn([]);
  assert.equal(suggest(m, { category_id: 1, daily: 500 }).market, 500 * PRIOR_RATIO);
  assert.equal(suggest(m, { category_id: 1, declared: 50000 }).market, 50000);
  const both = suggest(m, { category_id: 1, daily: 500, declared: 50000 });
  // exp(0.6 ln 50000 + 0.4 ln 20000) ≈ 34,657 → rounded to 100
  assert.equal(both.market, 34700);
  assert.equal(both.replacement, 20820);
  assert.equal(both.compensation, 10410);
});

test('learns a category ratio from approvals, shrunk toward the prior', () => {
  const ex = Array.from({ length: 30 }, () => ({ category_id: 7, daily: 1000, declared: 100000, approved: 100000 }));
  const m = learn(ex);
  const s = suggest(m, { category_id: 7, daily: 1000 });
  // 30 examples at ratio 100 vs prior 40: close to 100 but not quite
  assert.ok(s.market > 85000 && s.market < 100000, s.market);
});

test('learns that owners overstate their prices', () => {
  const ex = Array.from({ length: 20 }, () => ({ category_id: 2, daily: 100, declared: 10000, approved: 8000 }));
  const m = learn(ex);
  assert.ok(Math.exp(m.logBias) < 0.9 && Math.exp(m.logBias) > 0.8);
  const s = suggest(m, { category_id: 9, declared: 10000 });
  assert.ok(s.market < 9000, s.market);
});

test('ignores broken examples', () => {
  const m = learn([{ category_id: 1, daily: 0, approved: 100 }, { category_id: 1, daily: 10, approved: 0 }]);
  assert.equal(m.examples, 0);
});
