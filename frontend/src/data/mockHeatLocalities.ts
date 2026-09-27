import type { HeatLocality, RiskLevel } from "../types/heat";

/**
 * Simulated Pune locality thermal-risk points for the demo heat layer.
 * Replace this module with API data that includes locality + lat/lng + thermal risk.
 */
export const heatLocalities: HeatLocality[] = [
  { locality: "Kharadi", latitude: 18.5515, longitude: 73.9472, temperature: 42, humidity: 66, windSpeed: 4, thermalRisk: "Very High", riskIntensity: 0.78 },
  { locality: "Hadapsar", latitude: 18.5089, longitude: 73.9259, temperature: 43, humidity: 71, windSpeed: 3, thermalRisk: "Extreme", riskIntensity: 0.93 },
  { locality: "Viman Nagar", latitude: 18.5679, longitude: 73.9143, temperature: 39, humidity: 54, windSpeed: 9, thermalRisk: "Moderate", riskIntensity: 0.38 },
  { locality: "Koregaon Park", latitude: 18.5362, longitude: 73.8939, temperature: 40, humidity: 64, windSpeed: 5, thermalRisk: "High", riskIntensity: 0.58 },
  { locality: "Kothrud", latitude: 18.5074, longitude: 73.8077, temperature: 36, humidity: 47, windSpeed: 12, thermalRisk: "Low", riskIntensity: 0.18 },
  { locality: "Aundh", latitude: 18.558, longitude: 73.8075, temperature: 38, humidity: 56, windSpeed: 8, thermalRisk: "Moderate", riskIntensity: 0.36 },
  { locality: "Baner", latitude: 18.559, longitude: 73.7868, temperature: 41, humidity: 67, windSpeed: 4, thermalRisk: "Very High", riskIntensity: 0.76 },
  { locality: "Wakad", latitude: 18.5993, longitude: 73.7629, temperature: 42, humidity: 73, windSpeed: 3, thermalRisk: "Extreme", riskIntensity: 0.92 },
  { locality: "Shivajinagar", latitude: 18.5304, longitude: 73.8493, temperature: 40, humidity: 63, windSpeed: 5, thermalRisk: "High", riskIntensity: 0.57 },
  { locality: "Swargate", latitude: 18.5018, longitude: 73.8636, temperature: 43, humidity: 74, windSpeed: 3, thermalRisk: "Extreme", riskIntensity: 0.96 },
  { locality: "Pimpri", latitude: 18.628, longitude: 73.8047, temperature: 41, humidity: 68, windSpeed: 5, thermalRisk: "Very High", riskIntensity: 0.74 },
  { locality: "Yerawada", latitude: 18.5642, longitude: 73.889, temperature: 40, humidity: 62, windSpeed: 6, thermalRisk: "High", riskIntensity: 0.54 },
];

export const priorityLocalities: HeatLocality[] = [...heatLocalities]
  .sort((a, b) => b.riskIntensity - a.riskIntensity)
  .slice(0, 5);

export const riskZoneColor: Record<RiskLevel, string> = {
  Low: "#5b9a6e",
  Moderate: "#c9b25a",
  High: "#d08a4a",
  "Very High": "#c46b62",
  Extreme: "#7a5368",
};

export function nearestLocality(
  lat: number,
  lng: number,
  localities: HeatLocality[],
  maxKm = 1.6,
): HeatLocality | null {
  let best: HeatLocality | null = null;
  let bestKm = maxKm;
  for (const loc of localities) {
    const dLat = (loc.latitude - lat) * 111;
    const dLng = (loc.longitude - lng) * 111 * Math.cos((lat * Math.PI) / 180);
    const km = Math.hypot(dLat, dLng);
    if (km < bestKm) {
      bestKm = km;
      best = loc;
    }
  }
  return best;
}

