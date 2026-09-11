-- Every mutating action a platform admin takes on a company (create,
-- suspend/activate, plan change, password reset) is logged here — the
-- companion to the existing per-tenant audit_log, but scoped to actions
-- that touch the whole platform rather than one company's own data.
CREATE TABLE IF NOT EXISTS platform_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
  admin_email  VARCHAR(255),
  action       VARCHAR(100) NOT NULL, -- e.g. 'company.create', 'company.status', 'company.plan', 'user.reset_password'
  company_id   UUID REFERENCES companies(id) ON DELETE SET NULL,
  details      JSONB,
  ip           VARCHAR(64),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_company ON platform_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_created ON platform_audit_log(created_at DESC);
