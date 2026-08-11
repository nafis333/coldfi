# ColdFi Keep-Alive Worker

Cloudflare Worker that pings `https://coldfi.onrender.com/health/live` every 5
minutes so the free-tier Render instance never sleeps (GitHub Actions cron is
throttled to ~40-95 min gaps and can't keep it warm).

## Deploy (free, ~2 minutes)

1. Create a free Cloudflare account at https://dash.cloudflare.com/sign-up
2. Install Node.js 18+ (already installed for this repo).
3. Log in once from this folder:

```bash
cd tools/pinger-worker
npx wrangler login
```

4. Deploy:

```bash
npx wrangler deploy
```

That's it — the cron (`*/5 * * * *`) is part of `wrangler.jsonc` and starts
running immediately. The worker shows up under Workers & Pages.

## Verify

- `npx wrangler deploy --dry-run` — compile check only
- Open `https://coldfi-keepalive.<your-subdomain>.workers.dev/ping` in a
  browser — it returns `{"ok":true,"status":200,...}`

## Change the target

The default target is `https://coldfi.onrender.com/health/live` (set in
`wrangler.jsonc` `vars`). Override per environment without editing code:

```bash
npx wrangler secret put BACKEND_URL
```

## Alternative (no code): UptimeRobot

If you'd rather not deploy anything, create a free UptimeRobot account and add
an HTTP(S) monitor for `https://coldfi.onrender.com/health/live` with a
5-minute interval and `coldfi.onrender.com` in the keyword check — same effect.
