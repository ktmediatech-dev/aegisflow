// Maker-checker deletions: instead of a route deleting a row directly, it
// files a request here. A second user — anyone holding can_approve on the
// request's module, per the existing per-role permission matrix — must
// approve it before the row is actually removed. The requester can never
// approve their own request.

// Maps a deletion request's "module" tag to the physical table it targets.
// permissionModule is the MODULE_KEYS entry whose can_approve flag gates
// approval — contractors piggyback on "maintenance" the same way their
// read/write routes do, since there's no dedicated MODULE_KEYS entry for them.
export const DELETABLE_MODULES = {
  stations: { table: 'stations', permissionModule: 'stations' },
  fleet: { table: 'fleet_vehicles', permissionModule: 'fleet' },
  contractors: { table: 'contractors', permissionModule: 'maintenance' },
  suppliers: { table: 'suppliers', permissionModule: 'suppliers' },
};

const SELECT_COLUMNS = `id, module, record_id AS "recordId", record_label AS "recordLabel",
  reason, status, requested_by AS "requestedBy", resolved_by AS "resolvedBy",
  resolved_at AS "resolvedAt", created_at AS "createdAt"`;

export async function requestDeletion(pool, { module, recordId, recordLabel, reason, requestedBy }) {
  const { rows } = await pool.query(
    `INSERT INTO deletion_requests (module, record_id, record_label, reason, requested_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SELECT_COLUMNS}`,
    [module, recordId, recordLabel || null, reason || null, requestedBy]
  );
  return rows[0];
}

export async function listDeletionRequests(pool) {
  const { rows } = await pool.query(`SELECT ${SELECT_COLUMNS} FROM deletion_requests ORDER BY created_at DESC`);
  return rows;
}

export async function getDeletionRequest(pool, id) {
  const { rows } = await pool.query(`SELECT ${SELECT_COLUMNS} FROM deletion_requests WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function resolveDeletionRequest(pool, id, { status, resolvedBy }) {
  const { rows } = await pool.query(
    `UPDATE deletion_requests SET status = $1, resolved_by = $2, resolved_at = now()
     WHERE id = $3 AND status = 'pending'
     RETURNING ${SELECT_COLUMNS}`,
    [status, resolvedBy, id]
  );
  return rows[0] || null;
}

export async function canApproveModule(pool, roleId, module) {
  const { rows } = await pool.query(
    `SELECT can_approve FROM permissions WHERE role_id = $1 AND module = $2`,
    [roleId, module]
  );
  return !!rows[0]?.can_approve;
}
