# AI News Hub — Design

## Intent
A public, English-only website on GitHub Pages that automatically collects AI news, AI tools and trending AI GitHub repos in one place, so visitors can scan what's new without checking many sites. The owner sets it up once and it keeps itself fresh.

## Goals
- Fetch new items automatically on a schedule the owner controls.
- One fast page: filter by News / Tools / Repos, search, newest first, works on phones.
- Owner can add/remove sources by editing one config file.
- Visitors can browse past items (history), not just the latest.

## Non-goals
- Translation / multilingual (dropped by owner; English only).
- Accounts, comments, voting, per-item pages, SEO-optimized per-language pages.
- Visitor-configurable refresh (static site has no server).

## Anti-goals
- One broken source must never break the update or blank the site: each source is fetched independently; failures are logged and skipped, existing data is kept.

## Approaches considered
1. **One static page + JSON data written by a scheduled GitHub Action** — chosen. Least code, no build step, easy to maintain.
2. Astro static site generator — better SEO, ~3× the code and a build step. Rejected for now; the JSON can feed it later if needed.

## How it works
- `.github/workflows/update.yml` — runs on `schedule` (cron, default `0 0,12 * * *` = every 12 hours, 00:00 and 12:00 UTC) and a manual "Run workflow" button. Runs `node scripts/fetch.js`, commits `data/` if changed.
- **Refresh interval:** set by editing the `cron:` line in that workflow (default `0 0,12 * * *`, half-daily). GitHub can't read the schedule from another file, so this is the one place. Documented in README.
- `config.json` — sources:
  - `feeds`: RSS/Atom URLs, each tagged `news` or `tools` (defaults: Hugging Face blog, Google AI/DeepMind blogs, OpenAI news, hnrss.org AI-keyword query for news, hnrss Show HN AI query for tools).
  - `github`: search queries (e.g. `topic:llm`, `topic:ai-agents`, pushed in last 7 days, sorted by stars), tagged `repos`. Uses the Action's built-in `GITHUB_TOKEN`.
- **Storage / history:** nothing is ever deleted. Items are stored in one file per month: `data/YYYY-MM.json` (bucketed by the item's date). `data/index.json` lists available months and the last-updated time. Monthly files keep each download small (estimated a few hundred KB) while history grows forever.
- `scripts/fetch.js` — Node 20, built-in `fetch`, `rss-parser` for feeds (only dependency). Fetches all sources in parallel, merges each new item into its month file, de-duplicates by URL across all months, sorts by date desc, writes changed files and `index.json`. Item shape: `{ id, type, title, url, source, date, summary, stars? }`. Repos re-seen later keep their first-seen date but get updated stars.
- `index.html` (+ inline CSS/JS, no framework) — loads `index.json` and the current month file. A **month picker** (from `index.json`) switches to any past month; items are grouped under day headings ("Tue, 18 Nov 2026"). Tabs All/News/Tools/Repos, search box (title + summary + source, within the selected month), cards with title link, source, relative date, short summary, stars for repos. Light/dark via system setting. Shows "last updated" time.
- GitHub Pages serves the repo root from `main`.
- A small `node:test` check covers merge/dedupe/month-bucketing logic.

## Left to the builder
- Exact default feed URLs (verify each is live).
- Visual styling details.
