export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Very High' | 'Extreme'

/** Combined human thermal risk for a lat/lng locality. Ready to be replaced by API rows. */
export type HeatLocality = {
  locality: string
  latitude: number
  longitude: number
  temperature: number
  humidity: number
  windSpeed: number
  thermalRisk: RiskLevel
  /** 0–1 heat-layer weight from thermal risk, not temperature */
  riskIntensity: number
}

export type Ward = {
  id: number; name: string; temperature: number; humidity: number; windSpeed: number; thermalRisk: RiskLevel
  wbgt: number; population: string; outdoorWorkers: string; elderlyPopulation: string; healthRisk: string; path: string
}

/** City-level daily thermal-risk indication (0–100). Separate from live/current-day dashboard values. */
export type HeatTrendDay = {
  date: string
  weekday: string
  label: string
  score: number
  risk: RiskLevel
}
