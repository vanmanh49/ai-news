# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A public, English-only GitHub Pages site that auto-collects AI news, AI tools and trending AI GitHub repos. No server and no build step: a scheduled GitHub Action fetches sources, commits JSON to `data/`, and deploys `index.html` + `data/` to Pages.

## Commands

```sh
npm install
npm test                                   # node:test, discovers scripts/*.test.js
node --test scripts/lib.test.js            # one file
node --test --test-name-pattern="dedupes"  # one test by name
npm run fetch                              # real fetch into ./data (set GITHUB_TOKEN to avoid GitHub search rate limits)
python3 -m http.server 8080                # view the page at http://localhost:8080
```

There is no linter or bundler. Node ≥ 20 (CI uses 24). ES modules (`"type": "module"`). Only runtime dependency: `rss-parser`.

## Architecture

Data flow: `config.json` → `scripts/fetch.js` → `data/YYYY-MM.json` + `data/index.json` → `index.html`.

- `scripts/lib.js`: pure logic, no I/O. `normalizeUrl` (the item `id`, which is the dedupe key), `cleanText` (strip HTML, ≤200 chars), `monthKey` (UTC), and `mergeItems`. `mergeItems` dedupes by `id` across **all** months. A repo seen again keeps its original date and month and only gets `stars`/`summary` updated. Other existing items are never touched.
- `scripts/sources.js`: maps feed entries and GitHub search results to items, and does the network calls. Feeds are fetched with built-in `fetch` and then `parser.parseString`, not `parseURL`, because `parseURL` broke on compressed responses. Non-http(s) links are rejected, and missing or future dates become the run time. Repos always get `date = now` (first-seen).
- `scripts/fetch.js`: `run({ config, dataDir, fetchers, now, token })` is injectable for tests. It loads every month file first, and a corrupt one throws before anything is written. Sources run under `Promise.allSettled`, so one failure is logged and skipped. Feed items older than `config.maxAgeDays` are dropped, because some feeds carry their whole archive. Only changed month files are written, via `.tmp` + rename. `index.json` is always rewritten.
- `index.html`: a single file with inline CSS and JS and no framework. It loads `index.json`, then one month file. Item data must only reach the DOM via `textContent`, and links are re-checked for http(s), because feed content is untrusted. Within a day, items are shown news → tools → repos, because repos carry the fetch time and would otherwise always sit on top.
- `.github/workflows/update.yml`: cron `0 0,12 * * *` (UTC) + manual dispatch → test → fetch → commit `data/` → deploy Pages. A push to `main` only redeploys and does not fetch. Pages **Source must be "GitHub Actions"**, not "deploy from branch".

## Invariants

- History is never deleted; one file per month. The item shape is `{ id, type, title, url, source, date, summary, stars? }` with `type` ∈ `news | tools | repos`.
- `data/` is generated, but it is the persistent store: it is committed, never hand-edited, and never regenerated from scratch.
- Design and plan live in `docs/superpowers/specs/` and `docs/superpowers/plans/`.
