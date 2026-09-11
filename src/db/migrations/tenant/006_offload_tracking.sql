-- Extends the trip workflow (transit_logs + compartment_readings from
-- 005) with the actual depot-to-station offload process:
--   1. Depot in-charge records departure time when loading is submitted.
--   2. Station manager records arrival time on arrival — a separate,
--      explicit step before any dipping happens.
--   3. Station manager captures each receiving tank's OPENING dip/volume
--      before offloading starts.
--   4. Each compartment is dipped and assigned to exactly one tank
--      (never split) — the product must match (PMS only into a PMS tank,
--      AGO only into AGO, BIK only into BIK), enforced in the route, not
--      just the UI.
--   5. If pump sales happen on a tank while it's being offloaded into
--      (discouraged but real), that's captured the normal way — a
--      nozzle_readings meter entry for that window — and subtracted when
--      computing the tank's expected closing volume, so the expected
--      figure is honest about product that left through the pump during
--      the offload, not just what came out of the truck.

ALTER TABLE transit_logs ADD COLUMN IF NOT EXISTS dep_at TIMESTAMPTZ; -- departure, set by depot in-charge
ALTER TABLE transit_logs ADD COLUMN IF NOT EXISTS arr_at TIMESTAMPTZ; -- arrival, set by station manager

-- Product loaded into this compartment (loading-stage rows) and, for
-- delivery-stage rows, which tank it was offloaded into.
ALTER TABLE compartment_readings ADD COLUMN IF NOT EXISTS product VARCHAR(20);
ALTER TABLE compartment_readings ADD COLUMN IF NOT EXISTS tank_id UUID REFERENCES tanks(id) ON DELETE SET NULL;

-- One row per (trip, tank) that received fuel on that trip. Holds the
-- tank's opening dip/volume before offload, the delivered volume (summed
-- from compartment_readings assigned to this tank), any concurrent pump
-- sales, and the resulting expected closing volume — compare that against
-- the tank's next physical dip (tank_readings) to catch loss at the
-- tank, not just the truck.
CREATE TABLE IF NOT EXISTS tank_offload_readings (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transit_log_id                UUID NOT NULL REFERENCES transit_logs(id) ON DELETE CASCADE,
  tank_id                       UUID NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
  opening_dip_cm                NUMERIC(8,2),
  opening_volume_liters         NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivered_volume_liters       NUMERIC(12,2) NOT NULL DEFAULT 0,
  sales_during_offload_liters   NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_closing_volume_liters NUMERIC(12,2) NOT NULL DEFAULT 0,
  recorded_by                   VARCHAR(255),
  recorded_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (transit_log_id, tank_id)
);

CREATE INDEX IF NOT EXISTS idx_tank_offload_transit ON tank_offload_readings(transit_log_id);
CREATE INDEX IF NOT EXISTS idx_compartment_readings_tank ON compartment_readings(tank_id);
