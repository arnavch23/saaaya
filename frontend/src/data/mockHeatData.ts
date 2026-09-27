import type { RiskLevel, Ward } from '../types/heat'

export const citySummary = { city: 'Pune', temperature: 41, humidity: 68, windSpeed: 5, thermalRisk: 'High', highRiskWards: 12, totalWards: 75, healthRisk: 'Elevated' }

const paths = ['M33 13 74 5 92 29 72 54 38 48Z','M79 6 120 10 133 38 105 57 91 29Z','M124 12 164 28 160 57 132 64 133 38Z','M165 31 203 39 211 69 178 77 160 57Z','M30 51 72 54 82 82 56 103 25 83Z','M73 54 105 57 120 87 82 82Z','M106 59 143 65 149 99 120 87Z','M144 65 178 77 174 110 149 99Z','M178 78 211 70 230 102 201 124 174 110Z','M19 86 56 104 59 135 27 142 7 113Z','M57 105 83 83 108 116 91 146 59 135Z','M84 83 120 88 138 122 108 116Z','M121 88 149 100 158 135 138 122Z','M150 100 174 111 190 146 158 135Z','M175 112 202 125 209 159 190 146Z','M27 144 59 136 79 168 48 186 20 171Z','M59 136 91 147 105 179 79 168Z','M92 147 123 140 140 174 105 179Z','M124 140 158 136 172 168 140 174Z','M159 136 190 147 197 177 172 168Z','M190 148 209 160 226 191 197 177Z','M48 187 79 169 97 201 67 218 38 208Z','M79 169 105 180 122 209 97 201Z','M106 180 140 175 155 205 122 209Z','M140 175 172 169 185 201 155 205Z','M172 169 198 178 211 208 185 201Z','M198 178 226 192 231 220 211 208Z']
const riskCycle: RiskLevel[] = ['Moderate','High','Very High','Extreme','High','Moderate','High','Very High','High','Low','High','Extreme','Very High','High','Moderate','Low','High','Very High','Extreme','High','Moderate','Low','High','Very High','High','Moderate','Low']
export const wards: Ward[] = paths.map((path, index) => {
  const id = index + 1; const risk = riskCycle[index]
  return { id, name: `Ward ${String(id).padStart(2,'0')}`, temperature: 38 + (index % 5), humidity: 41 + ((index * 7) % 34), windSpeed: 3 + (index % 7), thermalRisk: risk, wbgt: 27 + (risk === 'Extreme' ? 5 : risk === 'Very High' ? 4 : risk === 'High' ? 3 : risk === 'Moderate' ? 2 : 1), population: `${(28 + index * 1.4).toFixed(1)}K`, outdoorWorkers: `${(4.5 + index * .45).toFixed(1)}K`, elderlyPopulation: `${(3.2 + index * .28).toFixed(1)}K`, healthRisk: risk === 'Extreme' || risk === 'Very High' ? 'High' : risk === 'High' ? 'Elevated' : 'Moderate', path }
})

export const forecast = [
  { day: 'Today', risk: 'High' as RiskLevel, temperature: 41 }, { day: 'Tomorrow', risk: 'Very High' as RiskLevel, temperature: 42 }, { day: '+2 days', risk: 'Extreme' as RiskLevel, temperature: 43 }, { day: '+3 days', risk: 'High' as RiskLevel, temperature: 40 }, { day: '+4 days', risk: 'Moderate' as RiskLevel, temperature: 38 },
]
export const recommendations = [
  { priority: 'Priority action', title: 'Prepare cooling centres', text: '3 high-risk wards are expected to reach extreme thermal stress within 48 hours.', wards: 'Ward 17, 23, 31', action: 'View plan' },
  { priority: 'Priority action', title: 'Issue outdoor-worker advisory', text: 'Peak thermal stress is expected between 12 PM and 4 PM.', wards: '12 high-risk wards', action: 'Prepare advisory' },
  { priority: 'Readiness', title: 'Prepare healthcare facilities', text: 'High-risk wards may experience increased heat-related emergency visits.', wards: 'Ward 17, 23, 31', action: 'Notify facilities' },
  { priority: 'Readiness', title: 'Increase drinking-water availability', text: 'Prioritize high-exposure locations near transit and worksites.', wards: 'Ward 09, 17, 23', action: 'View locations' },
]
export const alerts = [
  { title: 'Extreme thermal stress expected', wards: 'Ward 17, Ward 23', time: 'Tomorrow · 12 PM–4 PM', status: 'Pending municipal action' },
  { title: 'High-risk outdoor exposure', wards: 'Ward 31', time: 'Today · 12 PM–4 PM', status: 'Advisory ready' },
]
