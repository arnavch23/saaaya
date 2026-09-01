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

/** Daytime (10:00–16:00 IST) ward aggregate from locally cached ERA5 hourly data. */
export type HistoricalWardRisk = {
  date: string
  time: string
  wardId: number
  wardName: string
  latitude: number
  longitude: number
  temperature: number
  humidity: number
  windSpeed: number
  solarRadiation: number
  wbgt: number
  thermalRisk: number
  riskLevel: RiskLevel
}

/** City-level daily thermal-risk indication (0–100). Separate from live/current-day dashboard values. */
export type HeatTrendDay = {
  date: string
  weekday: string
  label: string
  score: number
  risk: RiskLevel
  period: 'Historical' | 'Today' | 'Forecast'
  maxTemperature: number
  minTemperature: number
  humidity: number
  windSpeed: number
  seasonalDeviation: number
  highRiskWards: number
  priorityAreas: string[]
  healthImpact: string
  recommendedAction: string
  forecastConfidence?: 'High' | 'Moderate' | 'Low'
}
