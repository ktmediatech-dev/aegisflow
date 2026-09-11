import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { platformQuery } from './platformDb.js';

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME || 'Platform Admin';

  if (!email || !password) {
    throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in .env first');
  }

  const existing = await platformQuery(`SELECT 1 FROM platform_admins WHERE email = $1`, [email]);
  if (existing.rows.length) {
    console.log(`Platform admin ${email} already exists.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await platformQuery(
    `INSERT INTO platform_admins (email, password_hash, name) VALUES ($1, $2, $3)`,
    [email, passwordHash, name]
  );

  console.log(`Platform admin created: ${email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
