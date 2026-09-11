import pg from 'pg';
import 'dotenv/config';
import dev from './devFallback.js';

const { Pool } = pg;

let platformPool = null;
let useFallback = false;

async function ensurePool() {
  if (useFallback) return;
  if (platformPool) return;

  try {
    // Platform tables (companies, platform_admins, directory) live in the
    // "public" schema of the same shared database every tenant schema
    // lives in — see tenantDb.js for why this is one database, not one
    // database per company.
    platformPool = new Pool({
      host: process.env.PG_APP_HOST,
      port: process.env.PG_APP_PORT,
      user: process.env.PG_APP_USER,
      password: process.env.PG_APP_PASSWORD,
      database: process.env.PG_DB_NAME,
      max: 10,
    });

    // quick test connection
    await platformPool.query('SELECT 1');
  } catch (err) {
    // fallback to in-memory dev DB
    console.warn('Postgres unavailable, using dev fallback DB:', err.message || err);
    useFallback = true;
    dev.initDevData();
    platformPool = null;
  }
}

export async function platformQuery(text, params) {
  await ensurePool();
  if (useFallback) return dev.platformQuery(text, params);
  return platformPool.query(text, params);
}

export function isUsingFallback() {
  return useFallback;
}
