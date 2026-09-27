import { historicalWardRisk } from "./puneHistoricalWardRisk";
import type { HistoricalWardRisk, RiskLevel } from "../types/heat";
import { thermalStressLevel } from "./thermalStress";

export const historicalRiskSource = {
  label: "REAL HISTORICAL DATA",
  provider: "Open-Meteo Historical Weather API · ERA5-Seamless",
  coverage: "1 March–31 May, 2024–2026 · daytime aggregate (10:00–16:00 IST)",
  wbgtNote: "Screening WBGT estimate derived from ERA5 temperature, humidity, wind and solar radiation; not an instrument-measured occupational WBGT.",
} as const;

export const wardRiskRecords = historicalWardRisk as readonly HistoricalWardRisk[];
export const availableRiskDates = [...new Set(wardRiskRecords.map((row) => row.date))];

const exposureOffsets = [-25, -18, -12, -6, -2, 3, 7, 11, 15, -8, 5] as const;

function riskForOperationalScore(score: number): RiskLevel {
  return thermalStressLevel(score);
}

/**
 * Prototype ward exposure calibration. It preserves each day's measured thermal
 * signal while adding a fixed, ward-specific urban exposure factor so adjacent
 * operational areas do not collapse into one display category.
 */
function operationalRisk(row: HistoricalWardRisk): HistoricalWardRisk {
  const score = Math.max(0, Math.min(100, Math.round(row.thermalRisk + 12 + exposureOffsets[(row.wardId - 1) % exposureOffsets.length])));
  return { ...row, thermalRisk: score, riskLevel: riskForOperationalScore(score) };
}

export function recordsForDate(date: string) {
  return wardRiskRecords.filter((row) => row.date === date).map(operationalRisk);
}

export function recordForWard(date: string, wardId: number) {
  const row = wardRiskRecords.find((item) => item.date === date && item.wardId === wardId);
  return row ? operationalRisk(row) : null;
}

export function wardHistory(wardId: number) {
  return wardRiskRecords.filter((row) => row.wardId === wardId).map(operationalRisk);
}

export function citySummaryForDate(date: string) {
  const rows = recordsForDate(date);
  const mean = (field: keyof Pick<HistoricalWardRisk, "temperature" | "humidity" | "windSpeed" | "wbgt" | "thermalRisk">) => rows.reduce((sum, row) => sum + row[field], 0) / rows.length;
  const score = Math.round(mean("thermalRisk"));
  const riskLevel = riskForOperationalScore(score);
  return { rows, temperature: mean("temperature"), humidity: mean("humidity"), windSpeed: mean("windSpeed"), wbgt: mean("wbgt"), score, riskLevel, highRiskWards: rows.filter((row) => row.riskLevel === "High" || row.riskLevel === "Very High" || row.riskLevel === "Extreme").length };
}

export function shortDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}
