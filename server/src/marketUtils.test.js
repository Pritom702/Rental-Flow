// ============================================================
//  RentalFlow  |  Business  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: money rule unit tests (node --test)
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { rentalDays, rentalFees, saleFee, PACKS, adSpent, withAds } from './marketUtils.js';

test('rental days count nights, at least one', () => {
  assert.equal(rentalDays('2026-09-25', '2026-09-27'), 2);
  assert.equal(rentalDays('2026-09-25', '2026-09-25'), 1);
});

test('fees on a Tk 4,800 camera for 2 days', () => {
  const f = rentalFees(4800, 2);
  assert.equal(f.rentalTotal, 9600);
  assert.equal(f.renterFee, 480);      // 5%
  assert.equal(f.ownerFee, 768);       // 8%
  assert.equal(f.protectionFee, 0);
  assert.equal(f.renterPays, 10080);
  assert.equal(f.ownerGets, 8832);
  assert.equal(f.platformEarns, 1248);
});

test('small rentals pay the minimum service fee; protection is optional', () => {
  const f = rentalFees(100, 1, { protection: true });
  assert.equal(f.renterFee, 20);
  assert.equal(f.protectionFee, 30);
  assert.equal(f.renterPays, 150);
  assert.equal(rentalFees(0, 3).renterFee, 0, 'a free item has no fee');
});

test('sale fee is 3%, at least Tk 10', () => {
  assert.equal(saleFee(98000), 2940);
  assert.equal(saleFee(200), 10);
});

test('bigger packs give more Limes per taka', () => {
  const rate = (p) => p.credits / p.bdt;
  assert.ok(rate(PACKS.popular) > rate(PACKS.starter));
  assert.ok(rate(PACKS.pro) > rate(PACKS.popular));
});

test('ads: 10 views per Lime, and they slot between posts', () => {
  assert.equal(adSpent(9), 0);
  assert.equal(adSpent(25), 2);
  const posts = Array.from({ length: 12 }, (_, i) => `p${i}`);
  const mixed = withAds(posts, ['A', 'B']);
  assert.equal(mixed.length, 14);
  assert.equal(mixed[3], 'A');
  assert.equal(mixed[10], 'B');
  assert.deepEqual(withAds(['p0', 'p1'], ['A']), ['p0', 'p1'], 'no ad on a page too short for its slot');
});
