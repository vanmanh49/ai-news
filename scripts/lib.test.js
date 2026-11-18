import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, cleanText, monthKey, mergeItems } from './lib.js';

const item = (id, date, extra = {}) => ({ id, type: 'news', title: id, url: id, source: 'S', date, summary: '', ...extra });

test('normalizeUrl strips tracking, hash, trailing slash', () => {
  assert.equal(normalizeUrl('https://Ex.com/a/?utm_source=x&id=2#top'), 'https://ex.com/a?id=2');
  assert.equal(normalizeUrl('https://ex.com/'), 'https://ex.com/');
  assert.equal(normalizeUrl('https://ex.com/a?ref=hn'), 'https://ex.com/a');
});

test('cleanText strips tags and entities and truncates', () => {
  assert.equal(cleanText('<p>A &amp; <b>B</b></p>'), 'A & B');
  assert.equal(cleanText('&#39;x&#x27; &lt;y&gt;'), "'x' <y>");
  const long = cleanText('x'.repeat(300));
  assert.equal(long.length, 200);
  assert.ok(long.endsWith('…'));
  assert.equal(cleanText(undefined), '');
});

test('cleanText keeps invalid numeric entities instead of throwing', () => {
  assert.equal(cleanText('a &#99999999; b &#x110000; c'), 'a &#99999999; b &#x110000; c');
});

test('monthKey uses UTC', () => {
  assert.equal(monthKey('2026-11-30T23:30:00-05:00'), '2026-12');
});

test('mergeItems adds new items to their month and dedupes', () => {
  const a = item('https://a.com', '2026-11-02T00:00:00.000Z');
  const b = item('https://b.com', '2026-10-05T00:00:00.000Z');
  const { months, changed } = mergeItems({}, [a, { ...a }, b]);
  assert.equal(months['2026-11'].length, 1);
  assert.equal(months['2026-10'].length, 1);
  assert.deepEqual([...changed].sort(), ['2026-10', '2026-11']);
});

test('mergeItems sorts a changed month newest first', () => {
  const old = item('https://o.com', '2026-11-01T00:00:00.000Z');
  const neu = item('https://n.com', '2026-11-09T00:00:00.000Z');
  const { months } = mergeItems({ '2026-11': [old] }, [neu]);
  assert.deepEqual(months['2026-11'].map(i => i.id), ['https://n.com', 'https://o.com']);
});

test('mergeItems updates stars of existing repo in place', () => {
  const repo = item('https://github.com/a/b', '2026-10-01T00:00:00.000Z', { type: 'repos', stars: 10 });
  const existing = { '2026-10': [repo] };
  const again = { ...repo, date: '2026-11-15T00:00:00.000Z', stars: 99 };
  const { months, changed } = mergeItems(existing, [again]);
  assert.equal(months['2026-10'][0].stars, 99);
  assert.equal(months['2026-10'][0].date, '2026-10-01T00:00:00.000Z');
  assert.equal(months['2026-11'], undefined);
  assert.deepEqual([...changed], ['2026-10']);
  assert.equal(existing['2026-10'][0].stars, 10, 'input not mutated');
});

test('mergeItems leaves existing news untouched and reports no change', () => {
  const n = item('https://a.com', '2026-11-02T00:00:00.000Z');
  const { changed } = mergeItems({ '2026-11': [n] }, [{ ...n, title: 'changed' }]);
  assert.equal(changed.size, 0);
});

test('mergeItems reports no change when repo stars are the same', () => {
  const repo = item('https://github.com/a/b', '2026-10-01T00:00:00.000Z', { type: 'repos', stars: 10 });
  const { changed } = mergeItems({ '2026-10': [repo] }, [{ ...repo }]);
  assert.equal(changed.size, 0);
});
