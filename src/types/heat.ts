export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Very High' | 'Extreme'

export type Ward = {
  id: number; name: string; temperature: number; humidity: number; windSpeed: number; thermalRisk: RiskLevel
  wbgt: number; population: string; outdoorWorkers: string; elderlyPopulation: string; healthRisk: string; path: string
}
