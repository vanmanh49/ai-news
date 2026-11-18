import Parser from 'rss-parser';
import { normalizeUrl, cleanText } from './lib.js';

const UA = 'ai-news-hub (+https://github.com)';
const parser = new Parser();

function httpUrl(link) {
  try {
    const u = new URL(link);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function feedEntryToItem(entry, feed, now) {
  const url = httpUrl(entry.link);
  const title = cleanText(entry.title, 300);
  if (!url || !title) return null;
  const d = new Date(entry.isoDate || entry.pubDate);
  const summary = cleanText(entry.contentSnippet || entry.content || entry.summary);
  return {
    id: normalizeUrl(url),
    type: feed.type,
    title,
    url: entry.link,
    source: feed.name,
    date: isNaN(d) ? now.toISOString() : d.toISOString(),
    summary: summary.startsWith('Article URL:') ? '' : summary, // hnrss puts only links/points here
  };
}

export function repoToItem(repo, now) {
  return {
    id: normalizeUrl(repo.html_url),
    type: 'repos',
    title: repo.full_name,
    url: repo.html_url,
    source: 'GitHub',
    date: now.toISOString(), // first-seen time; mergeItems keeps the original on re-sighting
    summary: cleanText(repo.description),
    stars: repo.stargazers_count,
  };
}

export async function fetchFeed(feed, now) {
  // built-in fetch, not parser.parseURL: it handles compressed responses (DeepMind's feed broke parseURL)
  const res = await fetch(feed.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { items = [] } = await parser.parseString(await res.text());
  return items.map(e => feedEntryToItem(e, feed, now)).filter(Boolean);
}

export async function fetchGithub(gh, token, now) {
  const since = new Date(now - gh.createdWithinDays * 86400000).toISOString().slice(0, 10);
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': UA };
  if (token) headers.Authorization = `Bearer ${token}`;
  const out = [];
  for (const topic of gh.topics) {
    const q = `topic:${topic} created:>${since} stars:>=${gh.minStars}`;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${gh.perPage}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`GitHub search "${topic}" failed: HTTP ${res.status}`);
    const { items = [] } = await res.json();
    out.push(...items.map(r => repoToItem(r, now)));
  }
  return out;
}
