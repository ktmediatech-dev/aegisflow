-- Fleet/fuel operations schema: stations, fleet vehicles, tank readings,
-- maintenance jobs and transit logs. Run against every tenant database,
-- same as 001_init.sql.

CREATE TABLE IF NOT EXISTS stations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  region        VARCHAR(100),
  manager       VARCHAR(255),
  address       VARCHAR(255),
  phone         VARCHAR(50),
  fuel_types    TEXT[] NOT NULL DEFAULT '{}',
  tanks         INT NOT NULL DEFAULT 0,
  pumps         INT NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'operational', -- operational / maintenance / suspended
  daily_sales   NUMERIC(14,2) NOT NULL DEFAULT 0,
  monthly_sales NUMERIC(14,2) NOT NULL DEFAULT 0,
  last_audit    DATE,
  risk_score    INT NOT NULL DEFAULT 0,
  established   DATE,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate            VARCHAR(50) NOT NULL UNIQUE,
  type             VARCHAR(50) NOT NULL DEFAULT 'Tanker',
  capacity         NUMERIC(12,2) NOT NULL DEFAULT 0,
  fuel             VARCHAR(20),
  driver           VARCHAR(255),
  station          VARCHAR(255), -- denormalized home station name, matches the frontend picker
  status           VARCHAR(20) NOT NULL DEFAULT 'idle', -- in-transit / loading / delivered / idle / maintenance
  mileage          NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_service     DATE,
  next_service     DATE,
  gps_lat          DOUBLE PRECISION,
  gps_lng          DOUBLE PRECISION,
  speed            NUMERIC(6,2) NOT NULL DEFAULT 0,
  insurance_expiry DATE,
  fuel_level       NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tank_readings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id     UUID REFERENCES stations(id) ON DELETE CASCADE,
  station_name   VARCHAR(255),
  tank_no        VARCHAR(20) NOT NULL,
  product        VARCHAR(20) NOT NULL,
  capacity       NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_level  NUMERIC(12,2) NOT NULL DEFAULT 0,
  opening_stock  NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_stock  NUMERIC(12,2) NOT NULL DEFAULT 0,
  received       NUMERIC(12,2) NOT NULL DEFAULT 0,
  sales_volume   NUMERIC(12,2) NOT NULL DEFAULT 0,
  variance       NUMERIC(12,2) NOT NULL DEFAULT 0,
  variance_pct   NUMERIC(6,2) NOT NULL DEFAULT 0,
  reading_date   DATE NOT NULL DEFAULT current_date,
  status         VARCHAR(20) NOT NULL DEFAULT 'normal', -- normal / warning / critical / anomaly
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station               VARCHAR(255), -- denormalized station name; vehicle jobs may leave this blank
  vehicle_id            UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  type                  VARCHAR(100) NOT NULL,
  description           TEXT,
  priority              VARCHAR(20) NOT NULL DEFAULT 'medium', -- critical / high / medium / low
  status                VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled / in-progress / completed / overdue
  contractor_id         UUID, -- FK added once the contractors module ships
  assigned_tech         VARCHAR(255),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_date        DATE,
  estimated_completion  DATE,
  actual_completion     DATE,
  cost                  NUMERIC(14,2) NOT NULL DEFAULT 0,
  invoice_no            VARCHAR(100),
  notes                 TEXT
);

CREATE TABLE IF NOT EXISTS transit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id    UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  plate         VARCHAR(50),
  route         VARCHAR(255),
  product       VARCHAR(20),
  loaded_qty    NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivered_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  transit_loss  NUMERIC(12,2) NOT NULL DEFAULT 0,
  loss_pct      NUMERIC(6,2) NOT NULL DEFAULT 0,
  driver        VARCHAR(255),
  dep_date      DATE,
  arr_date      DATE,
  status        VARCHAR(20) NOT NULL DEFAULT 'completed', -- completed / investigating
  cause_note    TEXT,
  flagged       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_station ON fleet_vehicles(station);
CREATE INDEX IF NOT EXISTS idx_tank_readings_station ON tank_readings(station_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_jobs_vehicle ON maintenance_jobs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_transit_logs_vehicle ON transit_logs(vehicle_id);
