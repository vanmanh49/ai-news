import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mergeItems } from './lib.js';
import { fetchFeed, fetchGithub } from './sources.js';

const MONTH_FILE = /^\d{4}-\d{2}\.json$/;

async function loadMonths(dataDir) {
  let files;
  try {
    files = await fs.readdir(dataDir);
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
  const months = {};
  for (const f of files.filter(f => MONTH_FILE.test(f))) {
    try {
      months[f.slice(0, 7)] = JSON.parse(await fs.readFile(path.join(dataDir, f), 'utf8'));
    } catch (e) {
      throw new Error(`Cannot read ${f}: ${e.message} — aborting so it is not overwritten`);
    }
  }
  return months;
}

// write-then-rename so a crash never leaves a half-written month file
async function writeJson(file, data) {
  await fs.writeFile(file + '.tmp', JSON.stringify(data));
  await fs.rename(file + '.tmp', file);
}

export async function run({ config, dataDir, fetchers = { fetchFeed, fetchGithub }, now = new Date(), token = process.env.GITHUB_TOKEN }) {
  const existing = await loadMonths(dataDir);

  const jobs = [
    ...config.feeds.map(feed => ({ name: feed.name, go: () => fetchers.fetchFeed(feed, now) })),
    ...(config.github?.topics?.length ? [{ name: 'GitHub', go: () => fetchers.fetchGithub(config.github, token, now) }] : []),
  ];
  const results = await Promise.allSettled(jobs.map(j => j.go()));
  const failed = [];
  const incoming = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') incoming.push(...r.value);
    else {
      failed.push(jobs[i].name);
      console.warn(`[skip] ${jobs[i].name}: ${r.reason?.message ?? r.reason}`);
    }
  });

  const cutoff = new Date(now - (config.maxAgeDays ?? 30) * 86400000).toISOString();
  const fresh = incoming.filter(i => i.date >= cutoff);

  const count = m => Object.values(m).reduce((n, items) => n + items.length, 0);
  const { months, changed } = mergeItems(existing, fresh);

  await fs.mkdir(dataDir, { recursive: true });
  for (const k of changed) await writeJson(path.join(dataDir, `${k}.json`), months[k]);
  await writeJson(path.join(dataDir, 'index.json'), {
    updated: now.toISOString(),
    months: Object.keys(months).sort().reverse(),
  });

  return { added: count(months) - count(existing), failed };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = JSON.parse(await fs.readFile('config.json', 'utf8'));
  run({ config, dataDir: 'data' })
    .then(r => console.log(`added ${r.added} items; failed sources: ${r.failed.join(', ') || 'none'}`))
    .catch(e => { console.error(e.message); process.exit(1); });
}
