import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run } from './fetch.js';

const now = new Date('2026-11-18T12:00:00.000Z');
const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'ainews-'));
const read = async (dir, f) => JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
const item = (id, date) => ({ id, type: 'news', title: id, url: id, source: 'Good', date, summary: '' });
const config = feeds => ({ maxAgeDays: 30, feeds, github: { topics: [] } });
const fakeFetchers = byName => ({
  fetchFeed: async feed => { if (byName[feed.name] instanceof Error) throw byName[feed.name]; return byName[feed.name]; },
  fetchGithub: async () => [],
});

const twoItems = [item('https://a.com', '2026-11-10T00:00:00.000Z'), item('https://b.com', '2026-11-11T00:00:00.000Z')];

test('run writes month files and index', async () => {
  const dataDir = await tmp();
  const res = await run({ config: config([{ name: 'Good' }]), dataDir, fetchers: fakeFetchers({ Good: twoItems }), now });
  assert.equal(res.added, 2);
  assert.equal((await read(dataDir, '2026-11.json')).length, 2);
  const index = await read(dataDir, 'index.json');
  assert.deepEqual(index.months, ['2026-11']);
  assert.equal(index.updated, now.toISOString());
});

test('run skips a failing source and keeps others', async () => {
  const dataDir = await tmp();
  const res = await run({
    config: config([{ name: 'Good' }, { name: 'Bad' }]), dataDir, now,
    fetchers: fakeFetchers({ Good: twoItems, Bad: new Error('boom') }),
  });
  assert.deepEqual(res.failed, ['Bad']);
  assert.equal((await read(dataDir, '2026-11.json')).length, 2);
});

test('run aborts on corrupt month file', async () => {
  const dataDir = await tmp();
  await fs.writeFile(path.join(dataDir, '2026-10.json'), '[{');
  await assert.rejects(
    run({ config: config([{ name: 'Good' }]), dataDir, fetchers: fakeFetchers({ Good: twoItems }), now }),
    /2026-10\.json/,
  );
  assert.equal(await fs.readFile(path.join(dataDir, '2026-10.json'), 'utf8'), '[{');
  await assert.rejects(fs.access(path.join(dataDir, '2026-11.json')));
});

test('run is idempotent', async () => {
  const dataDir = await tmp();
  const opts = { config: config([{ name: 'Good' }]), dataDir, fetchers: fakeFetchers({ Good: twoItems }), now };
  await run(opts);
  const before = await fs.readFile(path.join(dataDir, '2026-11.json'), 'utf8');
  const res = await run(opts);
  assert.equal(res.added, 0);
  assert.equal(await fs.readFile(path.join(dataDir, '2026-11.json'), 'utf8'), before);
});

test('run drops feed items older than maxAgeDays', async () => {
  const dataDir = await tmp();
  const old = item('https://old.com', '2026-09-01T00:00:00.000Z');
  const res = await run({ config: config([{ name: 'Good' }]), dataDir, fetchers: fakeFetchers({ Good: [old, ...twoItems] }), now });
  assert.equal(res.added, 2);
  assert.deepEqual((await read(dataDir, 'index.json')).months, ['2026-11']);
});

test('run keeps existing history months in index, newest first', async () => {
  const dataDir = await tmp();
  await fs.writeFile(path.join(dataDir, '2025-01.json'), JSON.stringify([item('https://h.com', '2025-01-05T00:00:00.000Z')]));
  await run({ config: config([{ name: 'Good' }]), dataDir, fetchers: fakeFetchers({ Good: twoItems }), now });
  assert.deepEqual((await read(dataDir, 'index.json')).months, ['2026-11', '2025-01']);
});
