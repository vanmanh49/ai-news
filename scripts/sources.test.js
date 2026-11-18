import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedEntryToItem, repoToItem } from './sources.js';

const feed = { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', type: 'news' };
const now = new Date('2026-11-18T12:00:00.000Z');

test('feedEntryToItem maps a normal entry', () => {
  const entry = { title: 'T', link: 'https://x.com/a?utm_source=rss', isoDate: '2026-11-10T00:00:00Z', contentSnippet: '<b>S</b>' };
  assert.deepEqual(feedEntryToItem(entry, feed, now), {
    id: 'https://x.com/a', type: 'news', title: 'T', url: 'https://x.com/a?utm_source=rss',
    source: 'Hugging Face', date: '2026-11-10T00:00:00.000Z', summary: 'S',
  });
});

test('feedEntryToItem falls back to now for bad date', () => {
  const item = feedEntryToItem({ title: 'T', link: 'https://x.com/a', pubDate: 'not a date' }, feed, now);
  assert.equal(item.date, now.toISOString());
  assert.equal(feedEntryToItem({ title: 'T', link: 'https://x.com/b' }, feed, now).date, now.toISOString());
});

test('feedEntryToItem rejects non-http links and missing titles', () => {
  assert.equal(feedEntryToItem({ title: 'T', link: 'javascript:alert(1)' }, feed, now), null);
  assert.equal(feedEntryToItem({ title: 'T', link: 'not a url' }, feed, now), null);
  assert.equal(feedEntryToItem({ title: '  ', link: 'https://x.com/a' }, feed, now), null);
});

test('feedEntryToItem drops hnrss boilerplate summaries', () => {
  const entry = { title: 'T', link: 'https://x.com/a', contentSnippet: 'Article URL: https://x.com/a Comments URL: https://news.ycombinator.com/item?id=1 Points: 60' };
  assert.equal(feedEntryToItem(entry, feed, now).summary, '');
});

test('repoToItem maps search result', () => {
  const item = repoToItem({ full_name: 'a/b', html_url: 'https://github.com/a/b', description: 'd', stargazers_count: 7 }, now);
  assert.deepEqual(item, {
    id: 'https://github.com/a/b', type: 'repos', title: 'a/b', url: 'https://github.com/a/b',
    source: 'GitHub', date: now.toISOString(), summary: 'd', stars: 7,
  });
});
