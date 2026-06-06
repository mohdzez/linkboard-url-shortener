'use strict';
// Linkboard worker — a background WORKER component (no HTTP, no Dockerfile).
// Consumes click events the API pushes onto the Redis "clicks" list and folds
// them into Postgres. Uses DATABASE_URL + REDIS_URL injected by canvas edges.
const { Pool } = require('pg');
const Redis = require('ioredis');

const pg = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

console.log('linkboard-worker: draining the "clicks" queue...');

async function loop() {
  for (;;) {
    try {
      const popped = await redis.brpop('clicks', 5); // [queue, value] or null on timeout
      if (!popped) continue;
      const code = popped[1];
      await pg.query('UPDATE links SET clicks = clicks + 1 WHERE code = $1', [code]);
      console.log('counted click for', code);
    } catch (err) {
      console.error('worker error:', err.message);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

loop();
