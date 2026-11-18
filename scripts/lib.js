const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

export function normalizeUrl(url) {
  const u = new URL(url);
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) {
    if (key.startsWith('utm_') || key === 'ref') u.searchParams.delete(key);
  }
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
  return u.toString(); // URL already lowercases the host
}

export function cleanText(html, max = 200) {
  if (!html) return '';
  const text = String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => (d === '39' ? "'" : String.fromCodePoint(Number(d))))
    .replace(/&(\w+);/g, (m, n) => ENTITIES[n] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

export function monthKey(iso) {
  return new Date(iso).toISOString().slice(0, 7);
}

export function mergeItems(months, incoming) {
  const out = Object.fromEntries(Object.entries(months).map(([k, v]) => [k, v.map(i => ({ ...i }))]));
  const where = new Map(); // id -> month key
  for (const [k, items] of Object.entries(out)) for (const i of items) where.set(i.id, k);
  const changed = new Set();

  for (const item of incoming) {
    const k = where.get(item.id);
    if (k) {
      if (item.type !== 'repos') continue;
      const existing = out[k].find(i => i.id === item.id);
      if (existing.stars === item.stars && existing.summary === item.summary) continue;
      existing.stars = item.stars;
      existing.summary = item.summary;
      changed.add(k);
      continue;
    }
    const m = monthKey(item.date);
    (out[m] ??= []).push({ ...item });
    where.set(item.id, m);
    changed.add(m);
  }

  for (const k of changed) out[k].sort((a, b) => b.date.localeCompare(a.date));
  return { months: out, changed };
}
