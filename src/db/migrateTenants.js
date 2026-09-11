import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TENANT_MIGRATIONS_DIR = path.join(__dirname, 'migrations/tenant');

// Every tenant migration file is written with CREATE TABLE/INDEX IF NOT
// EXISTS, so it's safe to just re-run the full set against every existing
// company's schema — already-applied statements are no-ops, new ones
// create the missing tables. This is the "migration runner" the README
// flags as not yet built: run with `npm run migrate:tenants` after adding
// a new numbered file under migrations/tenant/.
async function main() {
  const migrationSql = fs
    .readdirSync(TENANT_MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => fs.readFileSync(path.join(TENANT_MIGRATIONS_DIR, f), 'utf-8'))
    .join('\n');

  const platformPool = new Pool({
    host: process.env.PG_APP_HOST,
    port: process.env.PG_APP_PORT,
    user: process.env.PG_APP_USER,
    password: process.env.PG_APP_PASSWORD,
    database: process.env.PG_DB_NAME,
  });

  const { rows: companies } = await platformPool.query(`SELECT id, name, schema_name FROM companies`);

  console.log(`Applying tenant migrations to ${companies.length} compan${companies.length === 1 ? 'y' : 'ies'}...`);

  for (const company of companies) {
    // Every company's tables live in its own schema within the same
    // shared database — no separate connection per company needed
    // (unlike the old per-database design), just a different search_path.
    const client = await platformPool.connect();
    try {
      await client.query(`SET search_path TO "${company.schema_name}", public`);
      await client.query(migrationSql);
      console.log(`  ok: ${company.name} (${company.schema_name})`);
    } catch (err) {
      console.error(`  FAILED: ${company.name} (${company.schema_name}):`, err.message || err);
    } finally {
      client.release();
    }
  }

  await platformPool.end();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
