import dev from '../db/devFallback.js';

(async function(){
  dev.initDevData();
  const pool = dev.getTenantPool('tenant_3');
  const sql = `SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.email = $1`;
  const res = await pool.query(sql, ['it@democo.local']);
  console.log('DEV TENANT QUERY RESULT:', JSON.stringify(res, null, 2));
  const dbg = (await import('../db/devFallback.js')).debugState();
  console.log('DEV STATE:', JSON.stringify(dbg, null, 2));
})();
