'use strict';
// Linkboard dashboard (server-rendered).
// Talks to the API over API_URL, which Liftoff injects from a web -> api
// SERVICE LINK connection on the canvas (the API's private internal address).
const express = require('express');

const PORT = process.env.PORT || 3000;
const API_URL = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const app = express();
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok', apiUrl: API_URL }));

app.get('/', async (_req, res) => {
  let links = [];
  let stats = { links: 0, clicks: 0 };
  let reachable = true;
  try {
    links = await (await fetch(`${API_URL}/api/links`)).json();
    stats = await (await fetch(`${API_URL}/api/stats`)).json();
  } catch (_) {
    reachable = false;
  }
  res.send(page(links, stats, reachable));
});

app.post('/create', async (req, res) => {
  try {
    await fetch(`${API_URL}/api/links`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: req.body.url }),
    });
  } catch (_) {}
  res.redirect('/');
});

app.listen(PORT, () => console.log(`linkboard-web listening on :${PORT}`));

function page(links, stats, reachable) {
  const rows = links.length
    ? links.map((l) => `<tr><td><code>${l.code}</code></td><td class="t">${esc(l.target)}</td><td class="n">${l.clicks}</td></tr>`).join('')
    : `<tr><td colspan="3" class="empty">No links yet — create one above.</td></tr>`;
  const banner = reachable ? '' :
    `<div class="warn">Can't reach the API at <code>${esc(API_URL)}</code>. Wire a <b>web → api</b> service link (env var <code>API_URL</code>) on the canvas.</div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><title>Linkboard</title>
<style>
  :root{--v:#7c5cff;--b:#2b8aef;--bg:#0d0d12;--card:#16161f;--line:#262633;--mut:#9aa0b5;--fg:#f2f2f5}
  *{box-sizing:border-box}body{margin:0;font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--fg)}
  .wrap{max-width:760px;margin:0 auto;padding:42px 20px}
  h1{font-size:30px;letter-spacing:-.02em;margin:0 0 2px}.grad{background:linear-gradient(95deg,var(--v),var(--b));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  p.sub{color:var(--mut);margin:0 0 22px}
  .stats{display:flex;gap:12px;margin-bottom:18px}
  .stat{flex:1;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
  .stat .n{font-size:26px;font-weight:800}.stat .l{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.08em}
  form{display:flex;gap:8px;margin-bottom:18px}
  input{flex:1;background:var(--card);border:1px solid var(--line);border-radius:11px;padding:11px 13px;color:var(--fg);font-size:14px}
  button{background:linear-gradient(95deg,var(--v),var(--b));border:0;color:#fff;font-weight:600;border-radius:11px;padding:0 18px;cursor:pointer}
  table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
  th,td{padding:10px 14px;text-align:left;border-bottom:1px solid var(--line);font-size:13px}
  th{color:var(--mut);text-transform:uppercase;font-size:11px;letter-spacing:.07em}
  td.t{color:var(--mut);max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}td.n{text-align:right;font-weight:700}
  .empty{color:var(--mut);text-align:center}code{font-family:ui-monospace,Consolas,monospace;color:#8fe3ff}
  .warn{background:#3a2a12;border:1px solid #6b4a1a;color:#f3c98a;padding:10px 14px;border-radius:11px;margin-bottom:18px;font-size:13px}
  .foot{color:var(--mut);font-size:12px;margin-top:20px}
</style></head><body><div class="wrap">
  <h1>🚀 <span class="grad">Linkboard</span></h1>
  <p class="sub">A Liftoff demo — short links with click analytics.</p>
  ${banner}
  <div class="stats">
    <div class="stat"><div class="n">${stats.links ?? 0}</div><div class="l">Links</div></div>
    <div class="stat"><div class="n">${stats.clicks ?? 0}</div><div class="l">Total clicks</div></div>
  </div>
  <form method="post" action="/create">
    <input name="url" type="url" placeholder="https://example.com/very/long/url" required/>
    <button type="submit">Shorten</button>
  </form>
  <table><thead><tr><th>Code</th><th>Target</th><th>Clicks</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="foot">Click a short link at <code>/&lt;code&gt;</code> on the API to be redirected and counted.</p>
</div></body></html>`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
