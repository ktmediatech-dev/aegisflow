-- Tanker trucks (owned or hired) load/deliver fuel through individually
-- labeled compartments (1, 2, 3, ... — count and capacity vary per truck,
-- some have 3, some have 10+). At loading and again at delivery, each
-- compartment's level is measured with a dipstick (in cm) and converted
-- to liters off that compartment's own calibration chart — recorded here
-- manually rather than computed, since every compartment's chart is
-- physically unique to its shape. Comparing the loading-stage total to
-- the delivery-stage total (already surfaced via transit_logs) is what
-- catches transit loss/pilferage at the compartment level, not just the
-- truck level.

-- Whether the company owns this vehicle outright or hires it in from a
-- third-party transporter for a trip/contract.
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS ownership VARCHAR(10) NOT NULL DEFAULT 'owned'; -- 'owned' | 'hired'
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255); -- transporter/company name when hired

CREATE TABLE IF NOT EXISTS fleet_vehicle_compartments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  compartment_no  INT NOT NULL,          -- 1, 2, 3, ... as physically labeled on the truck
  capacity        NUMERIC(10,2) NOT NULL DEFAULT 0, -- nominal max capacity in liters
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, compartment_no)
);

-- One row per compartment per stage (loading at depot / delivery at
-- station) per trip. A compartment that goes out empty on a given trip
-- still gets a row (is_empty = true) — the delivery note has to account
-- for every compartment, not just the ones carrying product.
CREATE TABLE IF NOT EXISTS compartment_readings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compartment_id UUID NOT NULL REFERENCES fleet_vehicle_compartments(id) ON DELETE CASCADE,
  transit_log_id UUID REFERENCES transit_logs(id) ON DELETE CASCADE,
  stage          VARCHAR(10) NOT NULL, -- 'loading' | 'delivery'
  dip_cm         NUMERIC(8,2),         -- dipstick reading; null when is_empty
  volume_liters  NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_empty       BOOLEAN NOT NULL DEFAULT false,
  recorded_by    VARCHAR(255),
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compartments_vehicle ON fleet_vehicle_compartments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_compartment_readings_compartment ON compartment_readings(compartment_id);
CREATE INDEX IF NOT EXISTS idx_compartment_readings_transit_log ON compartment_readings(transit_log_id);
