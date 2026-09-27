import type { HistoricalWardRisk, RiskLevel } from "../types/heat";

/**
 * Shared thermal-stress readout for ward, report and future map/alert surfaces.
 * WBGT is the existing ERA5-derived screening value carried with each weather row;
 * HTSI normalises that signal with its four observed weather contributors.
 */
export type ThermalMetrics = {
  wbgt: number;
  utci: number;
  htsi: number;
  htsiRisk: RiskLevel;
  thermalStress: RiskLevel;
  contributors: { label: "Temperature" | "Humidity" | "Wind cooling" | "Solar radiation"; value: number; display: string; level: RiskLevel }[];
  explanation: string;
};

export type PrototypeHealthPrediction = {
  hospitalizationIncrease: number;
  mortalityIncrease: number;
  riskLevel: RiskLevel;
};

export const HTSI_RISK_BANDS: { risk: RiskLevel; min: number; max: number }[] = [
  { risk: "Low", min: 0, max: 30 },
  { risk: "Moderate", min: 31, max: 50 },
  { risk: "High", min: 51, max: 70 },
  { risk: "Very High", min: 71, max: 85 },
  { risk: "Extreme", min: 86, max: 100 },
];

const clamp = (value: number) => Math.max(0, Math.min(100, value));
const scale = (value: number, low: number, high: number) => clamp(((value - low) / (high - low)) * 100);

/** Existing risk labels/thresholds are reused for thermal-stress presentation. */
export function thermalStressLevel(score: number): RiskLevel {
  if (score < 35) return "Low";
  if (score < 50) return "Moderate";
  if (score < 65) return "High";
  if (score < 80) return "Very High";
  return "Extreme";
}

export function htsiRiskLevel(score: number): RiskLevel {
  const boundedScore = Math.round(clamp(score));
  return HTSI_RISK_BANDS.find(({ min, max }) => boundedScore >= min && boundedScore <= max)!.risk;
}

const predictionIncreases: Record<RiskLevel, { hospitalization: [number, number]; mortality: [number, number] }> = {
  Low: { hospitalization: [2, 5], mortality: [1, 2] },
  Moderate: { hospitalization: [5, 10], mortality: [2, 4] },
  High: { hospitalization: [10, 20], mortality: [4, 8] },
  "Very High": { hospitalization: [20, 30], mortality: [8, 15] },
  Extreme: { hospitalization: [30, 45], mortality: [15, 25] },
};

export function prototypeHealthPrediction(htsi: number): PrototypeHealthPrediction {
  const boundedHtsi = clamp(Math.round(htsi));
  const riskLevel = htsiRiskLevel(boundedHtsi);
  const band = HTSI_RISK_BANDS.find((item) => item.risk === riskLevel)!;
  const increases = predictionIncreases[riskLevel];
  const progress = (boundedHtsi - band.min) / Math.max(1, band.max - band.min);
  return {
    hospitalizationIncrease: Math.round(increases.hospitalization[0] + progress * (increases.hospitalization[1] - increases.hospitalization[0])),
    mortalityIncrease: Math.round(increases.mortality[0] + progress * (increases.mortality[1] - increases.mortality[0])),
    riskLevel,
  };
}

/**
 * The dataset supplies the existing ERA5-derived screening WBGT.  Keeping this
 * as a named calculation boundary lets a future observed/instrument WBGT feed
 * replace it without changing any consuming health or response screen.
 */
export function calculateWBGT(row: Pick<HistoricalWardRisk, "wbgt">) {
  return row.wbgt;
}

/** Shared HTSI calculation; do not change its weights without thermal-engine review. */
export function calculateHTSI(row: Pick<HistoricalWardRisk, "temperature" | "humidity" | "windSpeed" | "solarRadiation" | "wbgt">) {
  const temperature = scale(row.temperature, 28, 43);
  const humidity = scale(row.humidity, 20, 80);
  const windCooling = 100 - scale(row.windSpeed, 0, 22);
  const solarRadiation = scale(row.solarRadiation, 350, 950);
  const wbgt = scale(calculateWBGT(row), 21, 34);
  return Math.round(clamp(wbgt * .40 + temperature * .25 + humidity * .18 + windCooling * .10 + solarRadiation * .07));
}

export function calculateUTCI(row: Pick<HistoricalWardRisk, "temperature" | "humidity" | "windSpeed" | "solarRadiation">) {
  const saturationVapourPressure = 6.105 * Math.exp(17.27 * row.temperature / (row.temperature + 237.7));
  const vapourPressure = row.humidity / 100 * saturationVapourPressure;
  const windMetersPerSecond = row.windSpeed / 3.6;
  return Math.round(row.temperature + 0.348 * vapourPressure - 0.70 * windMetersPerSecond + 0.70 * row.solarRadiation / (windMetersPerSecond + 10) - 4.25);
}

export function thermalMetrics(row: Pick<HistoricalWardRisk, "temperature" | "humidity" | "windSpeed" | "solarRadiation" | "wbgt"> & Partial<Pick<HistoricalWardRisk, "riskLevel">>): ThermalMetrics {
  const temperature = scale(row.temperature, 28, 43);
  const humidity = scale(row.humidity, 20, 80);
  // Lower wind means less evaporative cooling, so the contribution is inverted.
  const windCooling = 100 - scale(row.windSpeed, 0, 22);
  const solarRadiation = scale(row.solarRadiation, 350, 950);
  const calculatedHtsi = calculateHTSI(row);
  const categoryBand = row.riskLevel ? HTSI_RISK_BANDS.find(({ risk }) => risk === row.riskLevel) : undefined;
  const htsi = categoryBand ? Math.max(categoryBand.min, Math.min(categoryBand.max, calculatedHtsi)) : calculatedHtsi;
  const contributors = [
    { label: "Temperature" as const, value: Math.round(temperature), display: `${row.temperature.toFixed(1)}°C` },
    { label: "Humidity" as const, value: Math.round(humidity), display: `${row.humidity}%` },
    { label: "Wind cooling" as const, value: Math.round(windCooling), display: `${row.windSpeed.toFixed(1)} km/h` },
    { label: "Solar radiation" as const, value: Math.round(solarRadiation), display: `${row.solarRadiation} W/m²` },
  ].map((contributor) => ({ ...contributor, level: htsiRiskLevel(contributor.value) }));
  const leading = [...contributors].sort((a, b) => b.value - a.value).slice(0, 2).map((item) => item.label.toLowerCase());
  const windNote = row.windSpeed <= 8 ? "low wind is reducing evaporative cooling" : row.windSpeed >= 12 ? "stronger wind is providing some cooling" : "wind cooling is limited";
  const explanation = `${leading[0]}${leading[1] ? ` and ${leading[1]}` : ""} are the main current contributors; ${windNote}.`;
  const htsiRisk = htsiRiskLevel(htsi);
  return { wbgt: row.wbgt, utci: calculateUTCI(row), htsi, htsiRisk, thermalStress: htsiRisk, contributors, explanation };
}
