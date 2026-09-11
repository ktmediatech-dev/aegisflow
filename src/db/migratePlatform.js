import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import 'dotenv/config';
import dev from './devFallback.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

// Unlike the original design, this no longer creates the database itself
// (that needed CREATE DATABASE privilege, which this hosting account's
// Postgres user doesn't have — see README's Development Log). PG_DB_NAME
// must already exist, created once via the hosting panel; this just runs
// the platform schema migration against it, in the "public" schema.
async function main() {
  const client = new Client({
    host: process.env.PG_APP_HOST,
    port: process.env.PG_APP_PORT,
    user: process.env.PG_APP_USER,
    password: process.env.PG_APP_PASSWORD,
    database: process.env.PG_DB_NAME,
  });

  try {
    await client.connect();
  } catch (err) {
    console.warn('Postgres unreachable, switching to dev fallback.');
    dev.initDevData();
    process.exit(0);
  }

  // Every *.sql file in migrations/platform/, run in filename order — same
  // pattern as the tenant migrations in provisioning.js, so a future
  // platform-schema change just needs a new numbered file here.
  const migrationsDir = path.join(__dirname, 'migrations/platform');
  const sql = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
    .join('\n');
  await client.query(sql);
  await client.end();

  console.log('Platform schema migration complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
