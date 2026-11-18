# AI News Hub

A public page that collects AI news, AI tools and trending AI GitHub repos automatically, twice a day. Past months stay browsable.

It runs entirely on GitHub: a scheduled GitHub Action fetches the sources, saves new items to `data/`, and publishes the page to GitHub Pages. No server, no API keys.

## Set up

1. Create a GitHub repository and push this folder to its `main` branch.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Go to **Actions → Update news → Run workflow** to fetch and publish the first time.

The page is then live at `https://<your-user>.github.io/<repo>/` and updates itself on schedule.

## Change the refresh interval

Edit the `cron:` line in `.github/workflows/update.yml`. Times are in UTC.

| You want | cron line |
|---|---|
| Every 6 hours | `"0 */6 * * *"` |
| Every 12 hours (default) | `"0 0,12 * * *"` |
| Once a day at 01:00 UTC (08:00 in Vietnam) | `"0 1 * * *"` |

GitHub often starts scheduled runs a few minutes late, and the shortest interval it allows is 5 minutes. In public repositories GitHub pauses schedules after 60 days with no activity. If that happens, re-enable the workflow in the Actions tab.

## Add or remove sources

Edit `config.json`:

- `feeds`: any RSS or Atom feed. Each feed has a `name` (shown on the page), a `url`, and a `type` (`news` or `tools`).
- `github`: repos are found by `topics` and limited to repos created in the last `createdWithinDays` days that have at least `minStars` stars. `perPage` sets the number of repos per topic.
- `maxAgeDays`: feed items older than this are ignored. This stops a feed's full archive from flooding the history.

If a source fails, it is skipped for that run and shown in the Action log. Existing items are never removed.

## History

Items are stored one file per month (`data/2026-11.json`, …), and `data/index.json` lists the months. Nothing is ever deleted. The page has a month picker, and `?month=2026-10` links straight to a month.

## Run locally

```sh
npm install
npm test
npm run fetch                 # fetch now (set GITHUB_TOKEN to avoid GitHub rate limits)
python3 -m http.server 8080   # open http://localhost:8080
```
