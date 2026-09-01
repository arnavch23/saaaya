import type { HeatTrendDay, HistoricalWardRisk, RiskLevel } from "../types/heat";
import { thermalMetrics, thermalStressLevel } from "./thermalStress";

export type Availability = "MODEL ESTIMATE" | "DATA UNAVAILABLE";
export type HealthImpact = {
  thermalStress: RiskLevel;
  htsi: number;
  exposure: RiskLevel;
  vulnerability: RiskLevel | "Data unavailable";
  potentialImpact: RiskLevel;
  mortalityRisk: RiskLevel;
  responsePriority: RiskLevel;
  priorityPopulation: string;
  explanation: string;
  availability: Availability;
};

export type HealthOutcome = { name: string; note: string };
export const potentialHealthOutcomes: HealthOutcome[] = [
  { name: "Heat exhaustion", note: "Elevated risk during prolonged heat exposure." },
  { name: "Heatstroke", note: "Potential increase during severe heat exposure; requires urgent care." },
  { name: "Dehydration", note: "Elevated risk where water and rest access are limited." },
  { name: "Cardiovascular stress", note: "Heat may increase strain for susceptible people." },
  { name: "Respiratory stress", note: "Heat can worsen stress for susceptible people." },
  { name: "Increased healthcare demand", note: "Healthcare demand may increase during the peak window." },
];

/** Existing operational risk is the only available ward exposure calibration. */
export function calculateExposure(row: Pick<HistoricalWardRisk, "thermalRisk" | "riskLevel">) {
  return { score: row.thermalRisk, level: thermalStressLevel(row.thermalRisk), availability: "MODEL ESTIMATE" as const };
}

/** No ward-level demographic vulnerability dataset has been loaded into SAAYA. */
export function calculateVulnerability() {
  return { level: "Data unavailable" as const, availability: "DATA UNAVAILABLE" as const };
}

function healthImpactFromScores(htsi: number, exposureScore: number) {
  // No demographic vulnerability score is applied until an official ward dataset is loaded.
  return thermalStressLevel(Math.round(htsi * .65 + exposureScore * .35));
}

export function calculateHealthImpact(row: HistoricalWardRisk): HealthImpact {
  const thermal = thermalMetrics(row);
  const exposure = calculateExposure(row);
  // This intentionally does not invent demographic or clinical observations.
  const potentialImpact = healthImpactFromScores(thermal.htsi, exposure.score);
  const priorityPopulation = exposure.level === "High" || exposure.level === "Very High" || exposure.level === "Extreme" ? "People with prolonged outdoor exposure" : "Older residents and people with limited cooling access";
  return {
    thermalStress: thermal.thermalStress,
    htsi: thermal.htsi,
    exposure: exposure.level,
    vulnerability: "Data unavailable",
    potentialImpact,
    mortalityRisk: potentialImpact,
    responsePriority: potentialImpact,
    priorityPopulation,
    explanation: `${thermal.thermalStress} thermal stress combined with ${exposure.level.toLowerCase()} operational exposure indicates ${potentialImpact.toLowerCase()} potential health impact. Demographic vulnerability data is not yet available.`,
    availability: "MODEL ESTIMATE",
  };
}

/** Forecasts do not include demographic or clinical data.  Their existing thermal score is the only forecast thermal input. */
export function calculateForecastHealthImpact(day: HeatTrendDay, exposureScore = day.score) {
  const potentialImpact = healthImpactFromScores(day.score, exposureScore);
  return {
    thermalStress: thermalStressLevel(day.score),
    htsi: day.score,
    exposure: thermalStressLevel(exposureScore),
    vulnerability: calculateVulnerability().level,
    potentialImpact,
    mortalityRisk: potentialImpact,
    responsePriority: potentialImpact,
    availability: "MODEL ESTIMATE" as const,
  };
}

export function healthImpactTrend(rows: HistoricalWardRisk[]) {
  return rows.map((row) => ({ date: row.date, htsi: thermalMetrics(row).htsi, impact: calculateHealthImpact(row).potentialImpact }));
}

export function calculateResponsePriority(row: HistoricalWardRisk) {
  const impact = calculateHealthImpact(row);
  return { score: Math.round((row.thermalRisk + impact.htsi) / 2), level: impact.responsePriority, impact };
}
