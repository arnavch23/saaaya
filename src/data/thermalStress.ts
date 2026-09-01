import type { HistoricalWardRisk, RiskLevel } from "../types/heat";

/**
 * Shared thermal-stress readout for ward, report and future map/alert surfaces.
 * WBGT is the existing ERA5-derived screening value carried with each weather row;
 * HTSI normalises that signal with its four observed weather contributors.
 */
export type ThermalMetrics = {
  wbgt: number;
  htsi: number;
  thermalStress: RiskLevel;
  contributors: { label: "Temperature" | "Humidity" | "Wind cooling" | "Solar radiation"; value: number; display: string; level: RiskLevel }[];
  explanation: string;
};

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

export function thermalMetrics(row: Pick<HistoricalWardRisk, "temperature" | "humidity" | "windSpeed" | "solarRadiation" | "wbgt">): ThermalMetrics {
  const temperature = scale(row.temperature, 28, 43);
  const humidity = scale(row.humidity, 20, 80);
  // Lower wind means less evaporative cooling, so the contribution is inverted.
  const windCooling = 100 - scale(row.windSpeed, 0, 22);
  const solarRadiation = scale(row.solarRadiation, 350, 950);
  const htsi = calculateHTSI(row);
  const contributors = [
    { label: "Temperature" as const, value: Math.round(temperature), display: `${row.temperature.toFixed(1)}°C` },
    { label: "Humidity" as const, value: Math.round(humidity), display: `${row.humidity}%` },
    { label: "Wind cooling" as const, value: Math.round(windCooling), display: `${row.windSpeed.toFixed(1)} km/h` },
    { label: "Solar radiation" as const, value: Math.round(solarRadiation), display: `${row.solarRadiation} W/m²` },
  ].map((contributor) => ({ ...contributor, level: thermalStressLevel(contributor.value) }));
  const leading = [...contributors].sort((a, b) => b.value - a.value).slice(0, 2).map((item) => item.label.toLowerCase());
  const windNote = row.windSpeed <= 8 ? "low wind is reducing evaporative cooling" : row.windSpeed >= 12 ? "stronger wind is providing some cooling" : "wind cooling is limited";
  const explanation = `${leading[0]}${leading[1] ? ` and ${leading[1]}` : ""} are the main current contributors; ${windNote}.`;
  return { wbgt: row.wbgt, htsi, thermalStress: thermalStressLevel(htsi), contributors, explanation };
}
