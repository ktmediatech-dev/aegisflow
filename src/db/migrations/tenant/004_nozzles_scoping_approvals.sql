-- Three additions in one pass:
--  1. Master "tanks" entity + nozzles + nozzle meter readings, so
--     individual-tank performance can be reconciled against the
--     throughput of the nozzles drawing from it.
--  2. Per-station user scoping (a Station Manager sees only their station).
--  3. A maker-checker deletion workflow: DELETE requests are recorded here
--     and must be approved by a second user before anything is removed.

-- A tank is a persistent entity a station owns; tank_readings (from
-- 002_fleet_ops.sql) are point-in-time snapshots of one. Kept separate
-- from tank_readings deliberately — existing reading rows are untouched.
CREATE TABLE IF NOT EXISTS tanks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id  UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  tank_no     VARCHAR(20) NOT NULL,
  product     VARCHAR(20) NOT NULL,
  capacity    NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (station_id, tank_no)
);

-- A nozzle draws fuel from exactly one tank. Several nozzles (on
-- different pumps) can draw from the same tank.
CREATE TABLE IF NOT EXISTS nozzles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id  UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  tank_id     UUID NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
  label       VARCHAR(50) NOT NULL, -- e.g. "Pump 2 / Nozzle A"
  product     VARCHAR(20) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per meter reading (a shift or a day). Throughput is
-- closing_meter - opening_meter, computed on read rather than stored,
-- so it stays correct across environments (real Postgres + dev fallback).
CREATE TABLE IF NOT EXISTS nozzle_readings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nozzle_id      UUID NOT NULL REFERENCES nozzles(id) ON DELETE CASCADE,
  reading_date   DATE NOT NULL DEFAULT current_date,
  opening_meter  NUMERIC(14,2) NOT NULL,
  closing_meter  NUMERIC(14,2) NOT NULL,
  recorded_by    VARCHAR(255),
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nozzles_tank ON nozzles(tank_id);
CREATE INDEX IF NOT EXISTS idx_nozzle_readings_nozzle ON nozzle_readings(nozzle_id);

-- Per-station user scoping: a user with station_id set only sees that
-- station's data in station-scoped modules (fleet, tanks, maintenance,
-- stations). NULL means company-wide (the existing default behavior).
ALTER TABLE users ADD COLUMN IF NOT EXISTS station_id UUID REFERENCES stations(id) ON DELETE SET NULL;

-- Maker-checker deletions: a DELETE creates a pending request instead of
-- removing the row. Approval requires can_approve on the request's module
-- (the existing per-role permission matrix), and the approver must not be
-- the same user who filed the request.
CREATE TABLE IF NOT EXISTS deletion_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module        VARCHAR(50) NOT NULL,   -- 'stations' | 'fleet' | 'contractors' | 'suppliers' | ...
  record_id     UUID NOT NULL,
  record_label  VARCHAR(255),           -- human-readable snapshot (e.g. station name) for the review list
  reason        TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / approved / rejected
  requested_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON deletion_requests(status);
