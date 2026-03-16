-- Add source column to MetricDefinition
-- Tracks where the metric originates: internal, nemsqa, gamut, mn-capm
ALTER TABLE "MetricDefinition" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'internal';

-- Add index for filtering by source
CREATE INDEX "MetricDefinition_source_idx" ON "MetricDefinition"("source");
