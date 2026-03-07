# Divisions Without Departments — Known Issues & Edge Cases

**Date:** 2026-03-07
**Context:** Some divisions (e.g., Communications Center, Community Paramedics) operate
without sub-departments (regions). This document records potential issues to watch for
after the fix that allows these divisions to display metrics on the dashboard and scorecard.

## What Changed

The system originally assumed every division has regions (departments) underneath it, and
that all metric data flows upward from region-level entries. Queries everywhere filtered
with `regionId: { not: null }`, which excluded division-level entries entirely.

The fix introduces a pattern: when a division has **no active regions**, the system
fetches division-level entries (`regionId IS NULL, divisionId = X`) instead of
region-level entries.

## Potential Issues

### 1. Double-Counting in "All Divisions" Aggregate

**Risk:** If a division transitions from having no regions to having regions (or vice
versa), there could be a window where both division-level and region-level entries exist
for the same metric and period. The "All Divisions" aggregate could double-count these.

**Mitigation:** The helper function (`getDivisionsWithoutRegions`) checks the current
state of regions. If a division gains regions, its old division-level entries will no
longer be queried — but they remain in the database unused. This is acceptable, but if
someone re-uploads data at the region level AND the old division-level entries exist,
the data is simply not double-counted because the query only uses one path or the other.

**Watch for:** After adding regions to a previously region-less division, verify that
old division-level data does not appear alongside new region-level data.

### 2. Aggregation Is Pass-Through for Single-Entry Divisions

**Behavior:** For divisions without departments, each period has exactly one entry (the
division-level value). The aggregation functions (`aggregateByPeriodWeighted`,
`aggregateValues`) still run, but they operate on a single value per period — effectively
a pass-through. This is correct but worth noting: the "aggregated" value IS the uploaded
value, not an average of multiple sources.

**Watch for:** If someone expects weighted averaging behavior (e.g., proportion metrics
with numerator/denominator), ensure the upload includes proper numerator/denominator
values even for division-level entries. The SPC calculation depends on these.

### 3. Scorecard Division Filter With Mixed Divisions

**Scenario:** A user selects multiple divisions in the scorecard filter — some with
regions, some without. The query now uses an `OR` clause to fetch region-level entries
for divisions with regions AND division-level entries for divisions without regions.

**Watch for:** Verify that the scorecard aggregation correctly handles this mix. The
aggregation should treat each entry equally regardless of whether it came from a region
or a division.

### 4. MetricAssociations Must Exist

**Reminder:** Metrics will only appear on the dashboard for a division if a
`MetricAssociation` record links the metric to that division (with `divisionId` set,
`regionId` null). The upload path stores data but does NOT auto-create associations.

If metrics still don't appear after this fix, check:
```sql
SELECT * FROM MetricAssociation
WHERE divisionId = '<division-id>'
  AND metricDefinitionId = '<metric-id>';
```

### 5. Division Detail Page — Empty Departments Section

**Behavior:** The division detail page returns `departments: division.regions`. For a
division with no regions, this is an empty array `[]`. The UI should handle this
gracefully — no "Departments" heading, no empty breakdown table. Currently the UI
already handles empty arrays, but verify the visual result is clean.

### 6. SPC Charts for Division-Level Data

**Behavior:** For divisions without regions, SPC where clauses now query
`{ divisionId: X, regionId: null }` instead of `{ regionId: { not: null } }`.
The SPC calculation works on the resulting time series regardless of source.
For proportion/rate metrics, the SPC aggregation will sum numerator/denominator
across entries in a period — for division-level data there's only one entry per
period, so the sum IS the value. This is correct.

### 7. Global Metric Pages — Division Breakdown

**Behavior:** The global metric detail page shows a per-division breakdown. For
divisions without regions, the breakdown entry shows the raw division-level values
(no aggregation across regions). This appears alongside divisions that DO aggregate
from regions. The visual presentation is the same, but the semantic meaning differs.

**Watch for:** Users may wonder why a division's breakdown shows a single line
while others show aggregated values. This is expected and correct.
