import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { platformQuery, isUsingFallback } from '../db/platformDb.js';
import { getTenantPool } from '../db/tenantDb.js';
import dev from '../db/devFallback.js';
import { DEFAULT_ROLES } from '../config/defaultRoles.js';
import { MODULE_KEYS } from '../config/modules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TENANT_MIGRATIONS_DIR = path.join(__dirname, '../db/migrations/tenant');

// Every *.sql file in migrations/tenant/, run in filename order (001_, 002_, ...).
// Adding a new module's tables later is just: drop a new numbered file here.
const TENANT_SCHEMA_SQL = fs
  .readdirSync(TENANT_MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => fs.readFileSync(path.join(TENANT_MIGRATIONS_DIR, f), 'utf-8'))
  .join('\n');

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Creates a new Postgres SCHEMA (inside the one shared PG_DB_NAME database
 * every company lives in) for a company. This — not a separate physical
 * database — is what gives each company its own set of tables now; see
 * tenantDb.js for why. Only needs the regular app user, no elevated
 * CREATE DATABASE privilege.
 */
async function createTenantSchema(schemaName) {
  const pool = getTenantPool(schemaName);
  // getTenantPool's session already has search_path pointed at schemaName,
  // but the schema doesn't exist yet at this point — create it explicitly.
  // Identifiers can't be parameterized — schemaName is generated
  // server-side via slugify() above, never taken raw from user input.
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
}

async function runTenantMigration(schemaName) {
  const pool = getTenantPool(schemaName);
  // If running in dev fallback, tenant schema is synthetic — skip SQL run.
  if (isUsingFallback()) return;
  await pool.query(TENANT_SCHEMA_SQL);
}

async function seedDefaultRoles(schemaName) {
  const pool = getTenantPool(schemaName);

  for (const role of DEFAULT_ROLES) {
    const { rows } = await pool.query(
      `INSERT INTO roles (name, description, is_system) VALUES ($1, $2, $3) RETURNING id`,
      [role.name, role.description, role.isSystem]
    );
    const roleId = rows[0].id;

    for (const moduleKey of MODULE_KEYS) {
      const perm = role.permissions[moduleKey] || { read: false, write: false, approve: false };
      await pool.query(
        `INSERT INTO permissions (role_id, module, can_read, can_write, can_approve)
         VALUES ($1, $2, $3, $4, $5)`,
        [roleId, moduleKey, perm.read, perm.write, perm.approve]
      );
    }
  }
}

/**
 * Full provisioning flow for a brand new company:
 *  1. Generate a unique schema name from the company name
 *  2. Register it in the platform "companies" table
 *  3. Create the tenant's Postgres schema
 *  4. Run the tenant schema migration against it
 *  5. Seed default roles + permissions
 * Returns the created company record.
 */
export async function provisionCompany({ name, plan = 'trial' }) {
  const baseSlug = slugify(name);
  const slug = `${baseSlug}_${Date.now().toString(36)}`; // ensure uniqueness
  const schemaName = `co_${slug}`;

  const { rows } = await platformQuery(
    `INSERT INTO companies (name, slug, schema_name, plan, status)
     VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
    [name, slug, schemaName, plan]
  );
  const company = rows[0];

  try {
    if (isUsingFallback()) {
      // Dev fallback: no schema create or SQL migration; just ensure
      // tenant dataset exists and seed default roles.
      dev.getTenantPool(schemaName); // create in-memory tenant
      await seedDefaultRoles(schemaName);
    } else {
      await createTenantSchema(schemaName);
      await runTenantMigration(schemaName);
      await seedDefaultRoles(schemaName);
    }
  } catch (err) {
    // Roll back the platform-side record if provisioning failed partway,
    // so we don't end up with a "ghost" company pointing at a broken schema.
    await platformQuery(`DELETE FROM companies WHERE id = $1`, [company.id]);
    throw err;
  }

  return company;
}
