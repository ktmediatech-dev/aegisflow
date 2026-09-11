-- Contractors, suppliers, alerts, and a couple of analytics-supporting
-- columns. Run against every tenant database, same as prior migrations.

CREATE TABLE IF NOT EXISTS contractors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  contact          VARCHAR(255),
  email            VARCHAR(255),
  phone            VARCHAR(50),
  speciality       VARCHAR(150),
  region           VARCHAR(100),
  rating           NUMERIC(3,2) NOT NULL DEFAULT 4.0,
  active_jobs      INT NOT NULL DEFAULT 0,
  completed_jobs   INT NOT NULL DEFAULT 0,
  contract_start   DATE,
  contract_expiry  DATE,
  status           VARCHAR(20) NOT NULL DEFAULT 'active', -- active / expiring / inactive
  total_paid       NUMERIC(14,2) NOT NULL DEFAULT 0,
  certifications   TEXT[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(255) NOT NULL,
  short_code          VARCHAR(20),
  contact             VARCHAR(255),
  email               VARCHAR(255),
  phone               VARCHAR(50),
  products            TEXT[] NOT NULL DEFAULT '{}',
  payment_terms       VARCHAR(50),
  credit_limit        NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_balance     NUMERIC(14,2) NOT NULL DEFAULT 0,
  last_delivery       DATE,
  status              VARCHAR(20) NOT NULL DEFAULT 'active', -- active / suspended
  rating              NUMERIC(3,2) NOT NULL DEFAULT 4.0,
  total_purchases     NUMERIC(16,2) NOT NULL DEFAULT 0,
  delivery_lead_time  INT NOT NULL DEFAULT 3,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         VARCHAR(30) NOT NULL, -- fraud / maintenance / tank / fleet / contractor / transit
  severity     VARCHAR(20) NOT NULL DEFAULT 'info', -- critical / high / warning / info
  title        VARCHAR(255) NOT NULL,
  message      TEXT,
  station_id   UUID REFERENCES stations(id) ON DELETE SET NULL,
  station_name VARCHAR(255),
  status       VARCHAR(20) NOT NULL DEFAULT 'active', -- active / acknowledged / dismissed
  assigned_to  VARCHAR(255),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lets Stations optionally set a sales target, so Analytics/Reports can
-- show real efficiency (sales/target) instead of a fabricated number.
ALTER TABLE stations ADD COLUMN IF NOT EXISTS sales_target NUMERIC(14,2);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_contractors_status ON contractors(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
