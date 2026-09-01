import type { HeatTrendDay, RiskLevel } from "../types/heat";

export const HEAT_TREND_SCORE_MAX = 100;

export const heatTrendBands: {
  from: number;
  to: number;
  risk: RiskLevel;
  color: string;
}[] = [
  { from: 0, to: 20, risk: "Low", color: "#34a56f" },
  { from: 20, to: 40, risk: "Moderate", color: "#d99b16" },
  { from: 40, to: 60, risk: "High", color: "#e77525" },
  { from: 60, to: 80, risk: "Very High", color: "#e34d45" },
  { from: 80, to: 100, risk: "Extreme", color: "#9f2734" },
];

/**
 * Simulated 7-day city-level heat indication.
 * Kept apart from `mockHeatData` so it can later be replaced by a trend API
 * without changing today's live/overview snapshot.
 */
export const heatTrendDays: HeatTrendDay[] = [
  { date: "2026-08-26", weekday: "Wed", label: "26 Aug", score: 34, risk: "Moderate" },
  { date: "2026-08-27", weekday: "Thu", label: "27 Aug", score: 46, risk: "High" },
  { date: "2026-08-28", weekday: "Fri", label: "28 Aug", score: 55, risk: "High" },
  { date: "2026-08-29", weekday: "Sat", label: "29 Aug", score: 69, risk: "Very High" },
  { date: "2026-08-30", weekday: "Sun", label: "30 Aug", score: 87, risk: "Extreme" },
  { date: "2026-08-31", weekday: "Mon", label: "31 Aug", score: 73, risk: "Very High" },
  { date: "2026-09-01", weekday: "Tue", label: "Today", score: 52, risk: "High" },
];
