-- Add trackUpdateDue column to MetricDefinition
-- When true, shows an "Update Due" badge on dashboards if the latest
-- completed period has no data entry.
ALTER TABLE "MetricDefinition" ADD COLUMN "trackUpdateDue" BOOLEAN NOT NULL DEFAULT 0;
