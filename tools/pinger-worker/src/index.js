// ColdFi keep-alive pinger.
//
// Render's free tier sleeps after ~15 minutes of inactivity and takes
// 30-60s to boot, which made API calls fail at the network layer.
// GitHub Actions cron is throttled to ~40-95 min gaps, so it cannot keep
// the instance warm. This worker pings the backend every 5 minutes instead.

const TARGET_URL = (env) => env.BACKEND_URL || 'https://coldfi.onrender.com/health/live';

async function ping(env) {
  const url = TARGET_URL(env);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'coldfi-keepalive/1.0' },
    });
    return { ok: res.ok, status: res.status, url };
  } catch (err) {
    return { ok: false, status: 0, error: String(err), url };
  }
}

export default {
  // Cron: runs every 5 minutes (free Workers plan supports >= 1 min intervals).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      ping(env).then((r) => {
        if (!r.ok) {
          console.error('keepalive ping failed', JSON.stringify(r));
        }
      })
    );
  },

  // Manual trigger: https://<worker>.workers.dev/ping
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ping') {
      const result = await ping(env);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('ColdFi keep-alive worker is running', { status: 200 });
  },
};
