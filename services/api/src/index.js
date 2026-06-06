'use strict';
// Linkboard API
// -----------------------------------------------------------------------------
// Reads connection env vars that Liftoff AUTO-INJECTS when you draw edges on the
// canvas:  DATABASE_URL (Postgres), REDIS_URL (Redis), SPACES_* (Spaces bucket).
// SPACES_KEY / SPACES_SECRET / SESSION_SECRET are SECRET vault vars you set.
const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pg = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false })
  : null;

const SPACES = {
  bucket: process.env.SPACES_BUCKET,
  endpoint: process.env.SPACES_ENDPOINT,
  region: process.env.SPACES_REGION || 'us-east-1',
  key: process.env.SPACES_KEY,
  secret: process.env.SPACES_SECRET,
};

const newCode = () => Math.random().toString(36).slice(2, 8);

async function init() {
  await pg.query(`
    CREATE TABLE IF NOT EXISTS links (
      code       TEXT PRIMARY KEY,
      target     TEXT NOT NULL,
      clicks     INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

// --- Health: surfaces which connections are wired up -------------------------
app.get('/health', async (_req, res) => {
  const health = { status: 'ok', db: false, redis: false, spaces: Boolean(SPACES.bucket) };
  try { await pg.query('SELECT 1'); health.db = true; } catch (_) {}
  try { if (redis) { await redis.ping(); health.redis = true; } } catch (_) {}
  res.json(health);
});

app.get('/', (_req, res) =>
  res.json({ name: 'linkboard-api', try: ['/app (dashboard)', '/docs', 'POST /api/links', 'GET /:code'] }));

// --- Create / list / stats ---------------------------------------------------
app.post('/api/links', async (req, res) => {
  const target = req.body.url || req.body.target;
  if (!target || !/^https?:\/\//.test(target)) {
    return res.status(400).json({ error: 'a valid http(s) url is required' });
  }
  const code = newCode();
  await pg.query('INSERT INTO links(code, target) VALUES ($1, $2)', [code, target]);
  res.status(201).json({ code, target, short: `/${code}` });
});

app.get('/api/links', async (_req, res) => {
  const { rows } = await pg.query(
    'SELECT code, target, clicks, created_at FROM links ORDER BY created_at DESC LIMIT 100');
  res.json(rows);
});

app.get('/api/stats', async (_req, res) => {
  const { rows } = await pg.query(
    'SELECT COUNT(*)::int AS links, COALESCE(SUM(clicks), 0)::int AS clicks FROM links');
  res.json(rows[0]);
});

// --- Export to Spaces (falls back to inline CSV if Spaces isn't configured) ---
app.get('/api/export', async (_req, res) => {
  const { rows } = await pg.query('SELECT code, target, clicks FROM links ORDER BY clicks DESC');
  const csv = ['code,target,clicks', ...rows.map((r) => `${r.code},${r.target},${r.clicks}`)].join('\n');
  if (SPACES.bucket && SPACES.key && SPACES.secret && SPACES.endpoint) {
    try {
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: SPACES.region,
        endpoint: SPACES.endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId: SPACES.key, secretAccessKey: SPACES.secret },
      });
      const Key = `exports/links-${Date.now()}.csv`;
      await s3.send(new PutObjectCommand({ Bucket: SPACES.bucket, Key, Body: csv, ContentType: 'text/csv' }));
      return res.json({ uploaded: true, bucket: SPACES.bucket, key: Key });
    } catch (e) {
      return res.json({ uploaded: false, reason: String(e.message || e), csv });
    }
  }
  res.type('text/csv').send(csv);
});

// --- Redirect (single-segment catch-all; must be defined LAST) ---------------
app.get('/:code', async (req, res) => {
  const code = req.params.code;
  let target = null;
  try { if (redis) target = await redis.get(`link:${code}`); } catch (_) {}
  if (!target) {
    const { rows } = await pg.query('SELECT target FROM links WHERE code = $1', [code]);
    if (!rows.length) return res.status(404).send('Short link not found');
    target = rows[0].target;
    try { if (redis) await redis.set(`link:${code}`, target, 'EX', 3600); } catch (_) {}
  }
  // Record the click: enqueue for the worker, or update directly if no Redis.
  try {
    if (redis) await redis.lpush('clicks', code);
    else await pg.query('UPDATE links SET clicks = clicks + 1 WHERE code = $1', [code]);
  } catch (_) {}
  res.redirect(302, target);
});

init()
  .then(() => app.listen(PORT, () => console.log(`linkboard-api listening on :${PORT}`)))
  .catch((err) => { console.error('startup failed:', err); process.exit(1); });
