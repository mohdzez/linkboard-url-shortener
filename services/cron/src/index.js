'use strict';
// Linkboard cron — a scheduled JOB component. Liftoff runs it on the schedule
// "0 3 * * *" (jobKind: cron). It prunes old links and then exits.
const { Pool } = require('pg');

const pg = new Pool({ connectionString: process.env.DATABASE_URL });
const DAYS = Number(process.env.PRUNE_DAYS || 30);

(async () => {
  try {
    const { rowCount } = await pg.query(
      "DELETE FROM links WHERE created_at < now() - ($1 || ' days')::interval",
      [DAYS],
    );
    console.log(`linkboard-cron: pruned ${rowCount} link(s) older than ${DAYS} days`);
    await pg.end();
    process.exit(0);
  } catch (err) {
    console.error('linkboard-cron failed:', err.message);
    process.exit(1);
  }
})();
