// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: social + reward rule unit tests (node --test)
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify, parseHashtags, parseMentions, handleFromName, hotScore,
  xpForLevel, levelFor, nextStreak, applyRewards, policyCheck,
  sniffFile, checkLinkUrl, isPrivateAddress, youtubeId, parseMeta,
} from './socialUtils.js';

test('slugs and handles are url-safe', () => {
  assert.equal(slugify('Tripods & Supports'), 'tripods-supports');
  assert.equal(slugify('  Event & Party!! '), 'event-party');
  assert.equal(handleFromName('Rahim Uddin'), 'rahimuddin');
  assert.equal(handleFromName('!!!'), 'member');
});

test('hashtags and mentions are found once each, lower-cased', () => {
  assert.deepEqual(parseHashtags('Shot on #Sony for a #wedding #sony'), ['sony', 'wedding']);
  assert.deepEqual(parseHashtags('price is #1 and a&#39;s'), []);
  assert.deepEqual(parseMentions('thanks @RahimUddin and @karim, mail me@x.com'), ['rahimuddin', 'karim']);
});

test('hot score favours fresh engagement', () => {
  assert.ok(hotScore(5, 2, 1) > hotScore(5, 2, 48));
  assert.ok(hotScore(10, 0, 5) > hotScore(1, 0, 5));
  assert.ok(hotScore(0, 5, 5) > hotScore(5, 0, 5), 'comments weigh more than reactions');
});

test('levels start fast and grow', () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 50);
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(49).level, 1);
  assert.equal(levelFor(50).level, 2);
  assert.equal(levelFor(440).level, 5);
  assert.equal(levelFor(95).progress, 0.5);
});

test('streak grows on consecutive days and resets after a gap', () => {
  assert.deepEqual(nextStreak(null, '2026-09-25', 0), { streak: 1, changed: true });
  assert.deepEqual(nextStreak('2026-09-24', '2026-09-25', 4), { streak: 5, changed: true });
  assert.deepEqual(nextStreak('2026-09-25', '2026-09-25', 5), { streak: 5, changed: false });
  assert.deepEqual(nextStreak('2026-09-20', '2026-09-25', 9), { streak: 1, changed: true });
  assert.deepEqual(nextStreak('2026-02-28', '2026-03-01', 2), { streak: 3, changed: true });
});

test('rewards: XP, level up, badges and the daily cap', () => {
  const fresh = { xp: 0, counters: {}, badges: [], today: {} };
  const first = applyRewards(fresh, ['list_item'], '2026-09-25');
  assert.equal(first.reward.xp, 40);
  assert.equal(first.reward.levelUp, false);
  assert.deepEqual(first.reward.badges.map((b) => b.id), ['first_listing']);

  const second = applyRewards(first.row, ['post'], '2026-09-25');
  assert.equal(second.reward.xp, 10);
  assert.equal(second.reward.levelUp, true, '50 XP reaches level 2');
  assert.deepEqual(second.reward.badges.map((b) => b.id), ['first_post']);

  // A badge is only ever announced once.
  const third = applyRewards(second.row, ['post'], '2026-09-25');
  assert.deepEqual(third.reward.badges, []);

  // Daily cap: the 6th listing of the day earns nothing more.
  let row = fresh;
  let last;
  for (let i = 0; i < 6; i += 1) ({ row, reward: last } = applyRewards(row, ['list_item'], '2026-09-25'));
  assert.equal(last.xp, 0);
  assert.equal(row.xp, 200);
  // ...and the cap resets the next day.
  assert.equal(applyRewards(row, ['list_item'], '2026-09-26').reward.xp, 40);
});

test('rewards: the daily check-in pays once a day and builds the streak', () => {
  const base = { xp: 0, counters: {}, badges: [], today: {}, streak_days: 2, best_streak: 2, last_active_date: '2026-09-24' };
  const a = applyRewards(base, ['daily_visit'], '2026-09-25');
  assert.equal(a.reward.streak, 3);
  assert.equal(a.reward.streakUp, true);
  assert.equal(a.reward.xp, 5 + 4, 'base 5 + streak bonus');
  assert.ok(a.reward.badges.some((b) => b.id === 'streak_3'));
  const again = applyRewards(a.row, ['daily_visit'], '2026-09-25');
  assert.equal(again.reward.xp, 0);
  assert.equal(again.row.counters.daily_visit, 1);
});

test('content policy stops abuse and scams but not ordinary words', () => {
  assert.ok(policyCheck('you are a retard'));
  assert.ok(policyCheck('Please SEND MONEY FIRST to my number'));
  assert.ok(policyCheck('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
  assert.equal(policyCheck('This magic lamp is great, scunthorpe grapes'), null);
  assert.equal(policyCheck('Anyone rented the Sony A7 III? How was it?'), null);
});

test('files are identified by their bytes, and risky ones refused', () => {
  assert.equal(sniffFile(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]), 'x.png').ext, 'jpg');
  assert.equal(sniffFile(Buffer.from('%PDF-1.7 hello'), 'a.pdf').ext, 'pdf');
  assert.ok(sniffFile(Buffer.from('%PDF-1.7 /OpenAction << /S /JavaScript /JS (app.alert(1)) >>'), 'a.pdf').error);
  assert.ok(sniffFile(Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.from('xx')]), 'a.zip').error);
  assert.ok(sniffFile(Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.from('word/vbaProject.bin')]), 'a.docx').error);
  assert.equal(sniffFile(Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.from('word/doc.xml')]), 'a.docx').ext, 'docx');
  assert.equal(sniffFile(Buffer.from('name,price\nDrill,300'), 'list.csv').ext, 'csv');
  assert.ok(sniffFile(Buffer.from('<svg onload=alert(1)>'), 'x.svg').error);
  assert.ok(sniffFile(Buffer.from('MZ\x90\x00'), 'setup.exe').error);
});

test('links: only real websites, never private addresses', () => {
  assert.ok(checkLinkUrl('https://www.dpreview.com/reviews').url);
  assert.ok(checkLinkUrl('javascript:alert(1)').error);
  assert.ok(checkLinkUrl('http://127.0.0.1/admin').error);
  assert.ok(checkLinkUrl('http://localhost:3000').error);
  assert.ok(checkLinkUrl('https://user:pw@site.com').error);
  assert.ok(isPrivateAddress('10.1.2.3'));
  assert.ok(isPrivateAddress('192.168.0.1'));
  assert.ok(isPrivateAddress('169.254.169.254'));
  assert.ok(isPrivateAddress('::1'));
  assert.ok(isPrivateAddress('::ffff:127.0.0.1'));
  assert.equal(isPrivateAddress('142.250.72.14'), false);
});

test('youtube ids and page previews', () => {
  assert.equal(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://vimeo.com/1'), null);
  const meta = parseMeta(`<html><head><title>Fallback</title>
    <meta property="og:title" content="Sony A7 III review &amp; tips">
    <meta name="description" content="Everything you need">
    <meta property="og:image" content="/img/a.jpg"></head></html>`, 'https://site.com/post');
  assert.equal(meta.title, 'Sony A7 III review & tips');
  assert.equal(meta.description, 'Everything you need');
  assert.equal(meta.image, 'https://site.com/img/a.jpg');
});
