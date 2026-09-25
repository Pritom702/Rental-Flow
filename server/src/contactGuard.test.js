// ============================================================
//  RentalFlow  |  Trust  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: chat guard unit tests (node --test)
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { guardMessage, guardNote, normaliseDigits } from './contactGuard.js';

test('Bangla digits are read as numbers', () => {
  assert.equal(normaliseDigits('০১৭১২৩৪৫৬৭৮'), '01712345678');
});

test('phone numbers are hidden however they are written', () => {
  for (const t of ['call 01712345678', '017 1234 5678', '+880-1712-345678', 'number: ০১৭১২৩৪৫৬৭৮', '0 1 7 1 2 3 4 5 6 7 8']) {
    const g = guardMessage(t);
    assert.ok(g.flags.includes('phone'), t);
    assert.ok(!/\d{9,}/.test(g.text.replace(/\D/g, '')), `digits left in: ${g.text}`);
  }
});

test('prices, dates and times are left alone', () => {
  for (const t of ['It is 4,800 a day', 'From 2026-09-25 to 2026-09-27', 'See you at 10:30', 'Deposit ৳30,000']) {
    const g = guardMessage(t);
    assert.deepEqual(g.flags, [], t);
    assert.equal(g.hits, 0);
  }
});

test('emails, messenger links and wallets are caught', () => {
  assert.ok(guardMessage('mail me rahim@gmail.com').flags.includes('email'));
  assert.ok(guardMessage('rahim (at) gmail (dot) com').flags.includes('email'));
  assert.ok(guardMessage('text me on wa.me/8801712345678').flags.includes('link'));
  assert.ok(guardMessage('add me on WhatsApp').flags.includes('app'));
  assert.ok(guardMessage('send it by bKash').flags.includes('wallet'));
  assert.ok(guardMessage("let's pay outside the app, no platform fee").flags.includes('outside'));
});

test('the note fits what was found', () => {
  assert.equal(guardNote([]), null);
  assert.match(guardNote(['phone']), /hidden until the booking/);
  assert.match(guardNote(['wallet']), /no deposit protection/);
});
