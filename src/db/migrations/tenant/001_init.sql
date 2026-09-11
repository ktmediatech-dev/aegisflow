-- Tenant database schema. This SQL is run against EVERY new company
-- database at provisioning time. Each company gets its own physical
-- Postgres database with its own copy of these tables — fully isolated.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Roles are per-company so each org can rename/add roles without
-- affecting any other company.
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  is_system   BOOLEAN NOT NULL DEFAULT false, -- true for the seeded default roles
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);

-- One row per (role, module) defining what that role can do in that module.
CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module      VARCHAR(50) NOT NULL, -- e.g. 'hr', 'finance', 'fleet', 'admin'
  can_read    BOOLEAN NOT NULL DEFAULT false,
  can_write   BOOLEAN NOT NULL DEFAULT false,
  can_approve BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (role_id, module)
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  role_id       UUID REFERENCES roles(id) ON DELETE SET NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'active', -- active / disabled
  station_id    UUID, -- optional: scope a Station Manager to one station later
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(100) NOT NULL,   -- e.g. 'user.create', 'role.update'
  module     VARCHAR(50),
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_role ON permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);

-- HR module tables
CREATE TABLE IF NOT EXISTS hr_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  hired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Finance module tables
CREATE TABLE IF NOT EXISTS finance_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(100) NOT NULL UNIQUE,
  vendor VARCHAR(255) NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Procurement module tables
CREATE TABLE IF NOT EXISTS procurement_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(100) NOT NULL UNIQUE,
  supplier VARCHAR(255) NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ordered',
  expected_delivery DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compliance module tables
CREATE TABLE IF NOT EXISTS compliance_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  assigned_to VARCHAR(255),
  priority VARCHAR(50) NOT NULL DEFAULT 'medium',
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);
