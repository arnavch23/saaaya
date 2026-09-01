import { useMemo, useState } from "react";
import type { RiskLevel } from "../types/heat";
import { puneHeatTrend } from "../data/mockHeatTrend";
import { HeatTrendChart } from "./HeatTrendChart";

const fullDate = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const riskClass = (risk: RiskLevel) => `risk-${risk.toLowerCase().replaceAll(" ", "-")}`;

export function HeatTrendPage({ initialWardId: _initialWardId = 1 }: { initialWardId?: number }) {
  const [selectedDate, setSelectedDate] = useState("2026-09-01");
  const selected = puneHeatTrend.find((day) => day.date === selectedDate) ?? puneHeatTrend[7];
  const historical = useMemo(() => puneHeatTrend.filter((day) => day.period === "Historical"), []);
  const sevenDayAverage = Math.round(historical.reduce((total, day) => total + day.score, 0) / historical.length);
  const peak = puneHeatTrend.reduce((highest, day) => day.score > highest.score ? day : highest, puneHeatTrend[0]);
  const current = puneHeatTrend.find((day) => day.period === "Today")!;
  const trend = current.score > historical[0].score ? "Rising" : "Stable";

  return <main className="heat-trend-page p-4">
    <header className="heat-trend-header">
      <div><p className="heat-trend-eyebrow">Pune · Heat Intelligence · 14-Day Trend</p><h1>Heat Risk Trend</h1><p className="heat-trend-subtitle">City-wide human thermal risk screening for municipal heat-health operations and preparedness.</p></div>
      <span className="simulation-label">Simulated data</span>
    </header>
    <section className="heat-summary" aria-label="Heat risk summary">
      <div><p>Current risk</p><strong className={riskClass(current.risk)}>{current.risk} <span>{current.score}</span></strong></div>
      <div><p>7-day average</p><strong>{sevenDayAverage} <span>/ 100</span></strong></div>
      <div><p>Peak risk</p><strong className={riskClass(peak.risk)}>{peak.score} <span>· {peak.risk}</span></strong></div>
      <div><p>Peak risk date</p><strong>{peak.label}</strong></div>
      <div><p>Overall trend</p><strong>{trend} <span>through outlook</span></strong></div>
    </section>
    <section className="heat-intelligence-layout">
      <article className="panel heat-chart-panel">
        <div className="heat-section-heading"><div><h2>Human thermal risk score</h2><p>Historical observations through today, followed by a simulated seven-day outlook.</p></div><div className="heat-chart-key" aria-label="Trend legend"><span><i className="solid" />Observed</span><span><i className="dashed" />Outlook</span></div></div>
        <div className="heat-chart-scroll"><HeatTrendChart days={puneHeatTrend} selectedDate={selected.date} onSelect={(day) => setSelectedDate(day.date)} /></div>
        <p className="heat-chart-note">Score thresholds: Moderate 20 · High 40 · Very High 60 · Extreme 80. Select a date point to update the briefing.</p>
      </article>
      <aside className="panel daily-intelligence" aria-live="polite">
        <p className="section-kicker">Daily Heat Intelligence</p><h2>{fullDate.format(new Date(`${selected.date}T00:00:00`))}</h2><p className="day-status">{selected.period}{selected.period === "Forecast" ? " · Simulated outlook" : ""}</p>
        <div className={`${riskClass(selected.risk)} risk-readout`}><p>{selected.risk.toUpperCase()}</p><strong>Risk Score {selected.score}</strong></div>
        <dl className="daily-measures"><div><dt>Maximum</dt><dd>{selected.maxTemperature}°C</dd></div><div><dt>Minimum</dt><dd>{selected.minTemperature}°C</dd></div><div><dt>Humidity</dt><dd>{selected.humidity}%</dd></div><div><dt>Wind</dt><dd>{selected.windSpeed} km/h</dd></div></dl>
        <dl className="daily-details"><div><dt>Above seasonal normal</dt><dd>+{selected.seasonalDeviation}°C</dd></div><div><dt>High-risk wards</dt><dd>{selected.highRiskWards} / 75</dd></div><div><dt>Health impact</dt><dd>{selected.healthImpact}</dd></div>{selected.forecastConfidence && <div><dt>Forecast confidence</dt><dd>{selected.forecastConfidence}</dd></div>}</dl>
        <div className="daily-priority"><p>Priority areas</p><strong>{selected.priorityAreas.join(" · ")}</strong></div>
        <div className="daily-action"><p>Recommended municipal action</p><strong>{selected.recommendedAction}</strong></div>
      </aside>
    </section>
  </main>;
}
