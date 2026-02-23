/**
 * Statistical Process Control (SPC) Calculation Library
 *
 * Supports:
 * - P-chart (proportions — e.g., compliance rates)
 * - U-chart (rates — e.g., events per 1000 transports)
 * - I-MR  (individuals & moving range — continuous data)
 *
 * All functions are pure TypeScript with no DB dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SPCChartType = "p-chart" | "u-chart" | "i-mr";
export type DataType = "proportion" | "rate" | "continuous";

export interface SPCDataPoint {
  period: string;
  value: number;
  numerator?: number;
  denominator?: number;
}

export interface SPCPoint {
  period: string;
  value: number;
  ucl: number;
  lcl: number;
  centerLine: number;
  specialCause: boolean;
  specialCauseRules: string[];
}

export interface SPCMovingRangePoint {
  period: string;
  value: number;
  ucl: number;
  lcl: number;
  centerLine: number;
}

export interface SPCResult {
  chartType: SPCChartType;
  centerLine: number;
  points: SPCPoint[];
  movingRange?: SPCMovingRangePoint[];
  /** Fixed-limit points using average denominator (for P-chart and U-chart only) */
  fixedPoints?: SPCPoint[];
  /**
   * Whether variable control limits are statistically appropriate for this data.
   * True when subgroup sizes (denominators) vary by more than ±25% of the
   * average — the standard threshold from SPC best practice (Wheeler).
   * Only relevant for P-chart and U-chart; always false for I-MR.
   */
  supportsVariableLimits: boolean;
}

export interface SPCOptions {
  sigmaLevel: 1 | 2 | 3;
  baselineStart?: string; // ISO date or period label
  baselineEnd?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** d₂ constant for n=2 subgroups (moving range of 2 consecutive points) */
const D2 = 1.128;

/** D₄ constant for n=2 subgroups (upper control limit multiplier for MR chart) */
const D4 = 3.267;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBaselineData<T extends { period: string }>(data: T[], options: SPCOptions): T[] {
  if (!options.baselineStart && !options.baselineEnd) return data;

  return data.filter((d) => {
    if (options.baselineStart && d.period < options.baselineStart) return false;
    if (options.baselineEnd && d.period > options.baselineEnd) return false;
    return true;
  });
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Determine whether subgroup sizes vary enough to warrant variable control
 * limits. Per Wheeler's SPC guidance, variable limits are appropriate when
 * any subgroup size falls outside ±25% of the average subgroup size.
 */
function denominatorsVarySignificantly(data: SPCDataPoint[]): boolean {
  const denoms = data.map((d) => d.denominator ?? 1);
  if (denoms.length < 2) return false;
  const avg = denoms.reduce((s, v) => s + v, 0) / denoms.length;
  if (avg === 0) return false;
  return denoms.some((n) => Math.abs(n - avg) / avg > 0.25);
}

// ---------------------------------------------------------------------------
// Special Cause Detection
// ---------------------------------------------------------------------------

function detectSpecialCauses(points: SPCPoint[]): void {
  // Rule 1: Point beyond UCL or LCL
  for (const p of points) {
    if (p.value > p.ucl || p.value < p.lcl) {
      p.specialCause = true;
      p.specialCauseRules.push("Beyond control limits");
    }
  }

  // Rule 2: 8+ consecutive points on same side of center line
  const RUN_LENGTH = 8;
  for (let i = 0; i <= points.length - RUN_LENGTH; i++) {
    const window = points.slice(i, i + RUN_LENGTH);
    const allAbove = window.every((p) => p.value > p.centerLine);
    const allBelow = window.every((p) => p.value < p.centerLine);

    if (allAbove || allBelow) {
      const side = allAbove ? "above" : "below";
      for (const p of window) {
        if (!p.specialCauseRules.includes(`Run of ${RUN_LENGTH}+ ${side} center`)) {
          p.specialCause = true;
          p.specialCauseRules.push(`Run of ${RUN_LENGTH}+ ${side} center`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// P-Chart (Proportions)
// ---------------------------------------------------------------------------

function calculatePChart(data: SPCDataPoint[], options: SPCOptions): SPCResult {
  const z = options.sigmaLevel;
  const baseline = getBaselineData(data, options);

  // Center line: p̄ = Σnumerator / Σdenominator
  const totalNum = baseline.reduce(
    (sum, d) => sum + (d.numerator ?? (d.value * (d.denominator ?? 1)) / 100),
    0
  );
  const totalDen = baseline.reduce((sum, d) => sum + (d.denominator ?? 1), 0);

  // If data has proportions expressed as percentages (0-100), work in that scale
  // Detect: if values are > 1, they're likely percentages
  const isPercentageScale = data.some((d) => d.value > 1);

  let pBar: number;
  if (totalDen > 0) {
    if (isPercentageScale) {
      // Values are 0-100, numerators are counts, denominators are counts
      // p̄ in the same scale as values
      pBar = (totalNum / totalDen) * 100;
    } else {
      pBar = totalNum / totalDen;
    }
  } else {
    // Fallback: average of values
    pBar = baseline.length > 0 ? baseline.reduce((s, d) => s + d.value, 0) / baseline.length : 0;
  }

  // --- Variable limits (per-point denominator) ---
  const points: SPCPoint[] = data.map((d) => {
    const ni = d.denominator ?? 1;
    let ucl: number;
    let lcl: number;

    if (isPercentageScale) {
      const pFrac = pBar / 100;
      const se = Math.sqrt((pFrac * (1 - pFrac)) / ni) * 100;
      ucl = Math.min(pBar + z * se, 100);
      lcl = Math.max(pBar - z * se, 0);
    } else {
      const se = Math.sqrt((pBar * (1 - pBar)) / ni);
      ucl = Math.min(pBar + z * se, 1);
      lcl = Math.max(pBar - z * se, 0);
    }

    return {
      period: d.period,
      value: d.value,
      ucl: round4(ucl),
      lcl: round4(lcl),
      centerLine: round4(pBar),
      specialCause: false,
      specialCauseRules: [],
    };
  });

  detectSpecialCauses(points);

  // --- Fixed limits (average denominator n̄) ---
  const nBar =
    data.length > 0 ? data.reduce((s, d) => s + (d.denominator ?? 1), 0) / data.length : 1;
  let fixedUcl: number;
  let fixedLcl: number;

  if (isPercentageScale) {
    const pFrac = pBar / 100;
    const se = Math.sqrt((pFrac * (1 - pFrac)) / nBar) * 100;
    fixedUcl = Math.min(pBar + z * se, 100);
    fixedLcl = Math.max(pBar - z * se, 0);
  } else {
    const se = Math.sqrt((pBar * (1 - pBar)) / nBar);
    fixedUcl = Math.min(pBar + z * se, 1);
    fixedLcl = Math.max(pBar - z * se, 0);
  }

  const fixedPoints: SPCPoint[] = data.map((d) => ({
    period: d.period,
    value: d.value,
    ucl: round4(fixedUcl),
    lcl: round4(fixedLcl),
    centerLine: round4(pBar),
    specialCause: false,
    specialCauseRules: [],
  }));

  detectSpecialCauses(fixedPoints);

  const supportsVariableLimits = denominatorsVarySignificantly(data);

  return {
    chartType: "p-chart",
    centerLine: round4(pBar),
    points,
    fixedPoints,
    supportsVariableLimits,
  };
}

// ---------------------------------------------------------------------------
// U-Chart (Rates)
// ---------------------------------------------------------------------------

function calculateUChart(data: SPCDataPoint[], options: SPCOptions): SPCResult {
  const z = options.sigmaLevel;
  const baseline = getBaselineData(data, options);

  // Center line: ū = Σevents / Σexposure
  const totalEvents = baseline.reduce((sum, d) => sum + (d.numerator ?? d.value), 0);
  const totalExposure = baseline.reduce((sum, d) => sum + (d.denominator ?? 1), 0);

  const uBar = totalExposure > 0 ? totalEvents / totalExposure : 0;

  // --- Variable limits (per-point denominator) ---
  const points: SPCPoint[] = data.map((d) => {
    const ni = d.denominator ?? 1;
    const se = Math.sqrt(uBar / ni);
    const ucl = uBar + z * se;
    const lcl = Math.max(uBar - z * se, 0);

    return {
      period: d.period,
      value: d.value,
      ucl: round4(ucl),
      lcl: round4(lcl),
      centerLine: round4(uBar),
      specialCause: false,
      specialCauseRules: [],
    };
  });

  detectSpecialCauses(points);

  // --- Fixed limits (average denominator n̄) ---
  const nBar =
    data.length > 0 ? data.reduce((s, d) => s + (d.denominator ?? 1), 0) / data.length : 1;
  const fixedSe = Math.sqrt(uBar / nBar);
  const fixedUcl = uBar + z * fixedSe;
  const fixedLcl = Math.max(uBar - z * fixedSe, 0);

  const fixedPoints: SPCPoint[] = data.map((d) => ({
    period: d.period,
    value: d.value,
    ucl: round4(fixedUcl),
    lcl: round4(fixedLcl),
    centerLine: round4(uBar),
    specialCause: false,
    specialCauseRules: [],
  }));

  detectSpecialCauses(fixedPoints);

  const supportsVariableLimits = denominatorsVarySignificantly(data);

  return {
    chartType: "u-chart",
    centerLine: round4(uBar),
    points,
    fixedPoints,
    supportsVariableLimits,
  };
}

// ---------------------------------------------------------------------------
// I-MR Chart (Individuals & Moving Range)
// ---------------------------------------------------------------------------

function calculateIMR(data: SPCDataPoint[], options: SPCOptions): SPCResult {
  const z = options.sigmaLevel;
  const baseline = getBaselineData(data, options);

  if (data.length === 0) {
    return {
      chartType: "i-mr",
      centerLine: 0,
      points: [],
      movingRange: [],
      supportsVariableLimits: false,
    };
  }

  // Center line: x̄ = mean of baseline values
  const xBar =
    baseline.length > 0 ? baseline.reduce((s, d) => s + d.value, 0) / baseline.length : 0;

  // Moving ranges from baseline
  const baselineMRs: number[] = [];
  for (let i = 1; i < baseline.length; i++) {
    baselineMRs.push(Math.abs(baseline[i].value - baseline[i - 1].value));
  }

  const mrBar =
    baselineMRs.length > 0 ? baselineMRs.reduce((s, v) => s + v, 0) / baselineMRs.length : 0;

  // σ estimate = MR̄ / d₂
  const sigma = mrBar / D2;

  const iUCL = xBar + z * sigma;
  const iLCL = xBar - z * sigma;

  // I-chart points (constant limits)
  const points: SPCPoint[] = data.map((d) => ({
    period: d.period,
    value: d.value,
    ucl: round4(iUCL),
    lcl: round4(iLCL),
    centerLine: round4(xBar),
    specialCause: false,
    specialCauseRules: [],
  }));

  detectSpecialCauses(points);

  // MR chart
  const mrUCL = D4 * mrBar;
  const movingRange: SPCMovingRangePoint[] = [];

  for (let i = 1; i < data.length; i++) {
    const mr = Math.abs(data[i].value - data[i - 1].value);
    movingRange.push({
      period: data[i].period,
      value: round4(mr),
      ucl: round4(mrUCL),
      lcl: 0,
      centerLine: round4(mrBar),
    });
  }

  return {
    chartType: "i-mr",
    centerLine: round4(xBar),
    points,
    movingRange,
    supportsVariableLimits: false,
  };
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Determine the correct SPC chart type based on data type.
 */
export function spcChartTypeForDataType(dataType: DataType): SPCChartType {
  switch (dataType) {
    case "proportion":
      return "p-chart";
    case "rate":
      return "u-chart";
    case "continuous":
      return "i-mr";
  }
}

/**
 * Calculate SPC results for a given data set.
 *
 * @param dataType  The type of data (proportion, rate, continuous)
 * @param data      Array of data points with period, value, and optional numerator/denominator
 * @param options   SPC configuration (sigma level, optional frozen baseline range)
 * @returns         SPC result with center line, control limits, and special cause detection
 */
export function calculateSPC(
  dataType: DataType,
  data: SPCDataPoint[],
  options: SPCOptions = { sigmaLevel: 3 }
): SPCResult {
  if (data.length === 0) {
    const chartType = spcChartTypeForDataType(dataType);
    return { chartType, centerLine: 0, points: [], supportsVariableLimits: false };
  }

  switch (dataType) {
    case "proportion":
      return calculatePChart(data, options);
    case "rate":
      return calculateUChart(data, options);
    case "continuous":
      return calculateIMR(data, options);
  }
}
