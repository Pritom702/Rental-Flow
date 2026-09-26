import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBdPhone, maskPhone } from './phoneUtils.js';

test('phone: every common way of writing a BD mobile becomes 01XXXXXXXXX', () => {
  for (const raw of ['01712345678', '01712-345678', '+880 1712 345678', '8801712345678', '1712345678', '০১৭১২৩৪৫৬৭৮']) {
    assert.equal(normalizeBdPhone(raw), '01712345678', raw);
  }
});

test('phone: landlines, short numbers and other countries are refused', () => {
  for (const raw of ['', '0171234567', '017123456789', '01212345678', '0291234567', '+1 415 555 0100', 'abc']) {
    assert.equal(normalizeBdPhone(raw), null, raw);
  }
});

test('phone: masked for display', () => {
  assert.equal(maskPhone('01712345678'), '01712-•••678');
});
