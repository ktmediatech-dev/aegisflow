import pg from 'pg';
import 'dotenv/config';
import dev from './devFallback.js';
import { isUsingFallback } from './platformDb.js';

const { Pool } = pg;

// Cache of live connection pools, keyed by schema name, so we don't
// re-open a new pool on every request. Pools are created lazily.
const tenantPools = new Map();

/**
 * Returns (and caches) a connection pool scoped to one company's Postgres
 * SCHEMA. Every company shares the single physical PG_DB_NAME database;
 * isolation comes from each pool pinning its session search_path to just
 * that company's schema (plus public) at connect time — a query that
 * doesn't explicitly qualify a table name (nothing in this codebase does)
 * can only ever resolve against that one schema's tables.
 *
 * This was originally "one fully separate physical database per company"
 * (true CREATE DATABASE isolation). Moved to schema-per-company because
 * the production hosting account's Postgres user doesn't have CREATE
 * DATABASE privilege — see the README's Development Log for the full
 * reasoning. The identifier is still called "dbName"/"schemaName"
 * interchangeably in a few call sites to avoid a large mechanical rename
 * across every route file; it now holds a schema name, not a database name.
 */
export function getTenantPool(schemaName) {
  if (!schemaName) {
    throw new Error('getTenantPool called without a schemaName');
  }

  // If platform DB determined we are running in fallback mode, delegate
  // to the in-memory tenant adapter.
  if (isUsingFallback()) {
    return dev.getTenantPool(schemaName);
  }

  if (tenantPools.has(schemaName)) {
    return tenantPools.get(schemaName);
  }

  const pool = new Pool({
    host: process.env.PG_APP_HOST,
    port: process.env.PG_APP_PORT,
    user: process.env.PG_APP_USER,
    password: process.env.PG_APP_PASSWORD,
    database: process.env.PG_DB_NAME,
    // Every connection in this pool resolves unqualified table names
    // against schemaName first. schemaName is always server-generated via
    // slugify() in provisioning.js (lowercase alnum + underscore only),
    // never taken raw from user input, so this is safe to interpolate.
    options: `-c search_path="${schemaName}",public`,
    max: 5,
  });

  tenantPools.set(schemaName, pool);
  return pool;
}

export async function tenantQuery(schemaName, text, params) {
  const pool = getTenantPool(schemaName);
  return pool.query(text, params);
}

// Optional: close idle pools for companies that haven't been used in a
// while, if running with many tenants. Not wired up by default.
export async function closeTenantPool(schemaName) {
  const pool = tenantPools.get(schemaName);
  if (pool) {
    await pool.end();
    tenantPools.delete(schemaName);
  }
}
