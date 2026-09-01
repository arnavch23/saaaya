import type { RiskLevel } from "../types/heat";
import { heatTrendDays } from "../data/mockHeatTrend";
import { HeatTrendChart } from "./HeatTrendChart";

const riskClass = (risk: RiskLevel) =>
  `risk-${risk.toLowerCase().replaceAll(" ", "-")}`;

export function HeatTrendPage() {
  const peak = heatTrendDays.reduce((a, b) => (a.score >= b.score ? a : b));
  const latest = heatTrendDays[heatTrendDays.length - 1];

  return (
    <main className="p-4">
      <section className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-[11px] text-[#5b6b7c]">Pune · Municipal coverage · Last 7 days</p>
          <h1 className="mt-0.5 text-[20px] font-semibold tracking-[-.03em]">Heat Trend</h1>
          <p className="mt-0.5 text-[12px] text-[#5b6b7c]">
            Daily city-level human thermal risk indication
          </p>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-[.06em] text-[#8a97a6]">
          Simulated 7-day series
        </span>
      </section>

      <section className="panel p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-semibold">7-day heat indication</h2>
            <p className="mt-0.5 text-[11px] text-[#5b6b7c]">
              Score reflects combined temperature, humidity and wind stress —
              not the current-day overview snapshot
            </p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[.1em] text-[#8a97a6]">
                Latest
              </p>
              <p className={`mt-0.5 text-[13px] font-semibold ${riskClass(latest.risk)} text-[var(--risk)]`}>
                {latest.risk} · {latest.score}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[.1em] text-[#8a97a6]">
                Peak
              </p>
              <p className={`mt-0.5 text-[13px] font-semibold ${riskClass(peak.risk)} text-[var(--risk)]`}>
                {peak.label} · {peak.risk}
              </p>
            </div>
          </div>
        </div>

        <HeatTrendChart days={heatTrendDays} />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#eef1f4] pt-3">
          <div>
            <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[.1em] text-[#8a97a6]">
              Heat-risk levels
            </p>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  "Low",
                  "Moderate",
                  "High",
                  "Very High",
                  "Extreme",
                ] as RiskLevel[]
              ).map((risk) => (
                <span
                  key={risk}
                  className={`${riskClass(risk)} flex items-center gap-1.5 text-[11px] text-[#3d4f61]`}
                >
                  <i className="h-2 w-2 rounded-[2px] bg-[var(--risk)]" />
                  {risk}
                </span>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-[#8a97a6]">
            Prototype visualization · trend series independent of live KPIs
          </p>
        </div>
      </section>
    </main>
  );
}
