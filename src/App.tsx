import { useState } from "react";
import {
  alerts,
  forecast,
  recommendations,
} from "./data/mockHeatData";
import type { HeatLocality, RiskLevel } from "./types/heat";
import { heatLocalities, priorityLocalities } from "./data/mockHeatLocalities";
import { PuneHeatMap } from "./components/PuneHeatMap";
import { HeatTrendPage } from "./components/HeatTrendPage";

type View = "overview" | "heat-trend";

const riskClass = (risk: RiskLevel) =>
  `risk-${risk.toLowerCase().replaceAll(" ", "-")}`;
const Icon = ({ name, size = 18 }: { name: string; size?: number }) => {
  const d: Record<string, string> = {
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    map: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15",
    wards: "M4 20v-7a8 8 0 0 1 16 0v7M2 20h20M8 9a4 4 0 1 1 8 0",
    chart: "M3 3v18h18M7 16l4-5 3 2 5-7",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
    report: "M6 3h9l3 3v15H6zM9 12h6m-6 4h6",
    settings:
      "M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19.4 15a1.8 1.8 0 0 0 .36 2l.05.05-2.1 2.1-.05-.05a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V20h-3v-.1a1.8 1.8 0 0 0-1.1-1.65 1.8 1.8 0 0 0-2 .36l-.05.05-2.1-2.1.05-.05A1.8 1.8 0 0 0 6.6 14.5 1.8 1.8 0 0 0 5 13.4h-.1v-3H5a1.8 1.8 0 0 0 1.65-1.1 1.8 1.8 0 0 0-.36-2l-.05-.05 2.1-2.1.05.05a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 11.5 4V3.9h3V4a1.8 1.8 0 0 0 1.1 1.65 1.8 1.8 0 0 0 2-.36l.05-.05 2.1 2.1-.05.05a1.8 1.8 0 0 0-.36 2A1.8 1.8 0 0 0 21 10.5h.1v3H21a1.8 1.8 0 0 0-1.6 1.5Z",
    refresh: "M20 11a8 8 0 0 0-15-3M4 13a8 8 0 0 0 15 3M5 3v5h5m9 13v-5h-5",
    more: "M6 12h.01M12 12h.01M18 12h.01",
    trend: "M3 17l6-6 4 4 7-8M14 7h7v7",
    collapse: "M15 18 9 12l6-6",
    expand: "M9 18l6-6-6-6",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d[name]} />
    </svg>
  );
};
const RiskTag = ({ risk }: { risk: RiskLevel }) => (
  <span
    className={`risk-label ${riskClass(risk)} inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[.06em]`}
  >
    <i className="h-1.5 w-1.5 rounded-full bg-[var(--risk)]" />
    {risk}
  </span>
);

function navClass(active: boolean, collapsed: boolean) {
  return `relative flex w-full items-center text-[13px] ${collapsed ? "justify-center px-0 py-2" : "gap-2.5 py-[7px] pr-2 pl-3"} ${active ? "font-medium text-ink" : "text-[#5b6b7c] hover:bg-[#f4f6f8] hover:text-ink"}`;
}

function Sidebar({
  view,
  onNavigate,
  collapsed,
  onToggle,
}: {
  view: View;
  onNavigate: (view: View) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const nav = [
    ["grid", "Overview"],
    ["map", "Heat Map"],
    ["wards", "Wards"],
    ["chart", "Forecast"],
    ["bell", "Alerts"],
    ["report", "Reports"],
    ["settings", "Settings"],
  ] as const;
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-20 flex flex-col border-r border-[#e4e9ee] bg-white py-3.5 transition-[width] duration-200 ${collapsed ? "w-[60px] px-1.5" : "w-[196px] px-2"}`}
    >
      <div className={`mb-5 ${collapsed ? "flex flex-col items-center gap-2" : "px-1.5"}`}>
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] bg-ink text-[11px] font-semibold tracking-wide text-white">
              S
            </span>
            {!collapsed && (
              <span className="text-[15px] font-semibold tracking-[-.03em]">SAAYA</span>
            )}
          </div>
          {!collapsed && (
            <button
              type="button"
              aria-label="Collapse navigation"
              onClick={onToggle}
              className="grid h-7 w-7 place-items-center rounded-[6px] text-[#8a97a6] hover:bg-[#f4f6f8] hover:text-ink"
            >
              <Icon name="collapse" size={15} />
            </button>
          )}
        </div>
        {collapsed ? (
          <button
            type="button"
            aria-label="Expand navigation"
            onClick={onToggle}
            className="grid h-7 w-7 place-items-center rounded-[6px] text-[#8a97a6] hover:bg-[#f4f6f8] hover:text-ink"
          >
            <Icon name="expand" size={15} />
          </button>
        ) : (
          <p className="mt-1.5 text-[9px] font-medium uppercase tracking-[.14em] text-[#8a97a6]">
            Heat Health Intelligence
          </p>
        )}
      </div>
      <nav className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-0.5">
          {nav.map(([icon, label]) => {
            const active = view === "overview" && label === "Overview";
            return (
              <button
                key={label}
                type="button"
                title={label}
                onClick={label === "Overview" ? () => onNavigate("overview") : undefined}
                className={navClass(active, collapsed)}
              >
                {active && (
                  <span className={`absolute top-1.5 bottom-1.5 w-[2px] bg-ink ${collapsed ? "left-0" : "left-0"}`} />
                )}
                <Icon name={icon} size={16} />
                {!collapsed && label}
              </button>
            );
          })}
        </div>
        <div className="mt-2 border-t border-[#eef1f4] pt-2">
          <button
            type="button"
            title="Heat Trend"
            onClick={() => onNavigate("heat-trend")}
            className={navClass(view === "heat-trend", collapsed)}
          >
            {view === "heat-trend" && (
              <span className="absolute top-1.5 bottom-1.5 left-0 w-[2px] bg-ink" />
            )}
            <Icon name="trend" size={16} />
            {!collapsed && "Heat Trend"}
          </button>
        </div>
      </nav>
      <div className={`mt-auto border-t border-[#eef1f4] pt-3 ${collapsed ? "px-0 text-center" : "px-1.5"}`}>
        {collapsed ? (
          <p className="text-[9px] font-semibold tracking-wide text-[#5b6b7c]">PMC</p>
        ) : (
          <>
            <p className="text-[11px] font-medium text-ink">Pune Municipal Corporation</p>
            <p className="mt-0.5 text-[10px] text-[#8a97a6]">Municipal coverage · 75 wards</p>
          </>
        )}
      </div>
    </aside>
  );
}
function Header() {
  return (
    <header className="flex h-12 items-center justify-between border-b border-[#e4e9ee] bg-white px-5">
      <div>
        <h1 className="text-[13px] font-semibold tracking-[-.02em] text-ink">
          Heat Health Command Center
        </h1>
        <p className="text-[11px] text-[#5b6b7c]">Pune · Municipal coverage · Today</p>
      </div>
      <div className="flex items-center gap-4 text-[12px]">
        <button className="flex items-center gap-1.5 text-[11px] text-[#5b6b7c] hover:text-ink">
          Last updated 10 min ago <Icon name="refresh" size={13} />
        </button>
        <span className="text-[#3d4f61]">Pune Municipal Corporation</span>
        <span className="flex items-center gap-1.5 text-[11px] text-[#5b6b7c]">
          <i className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          System operational
        </span>
        <button className="grid h-7 w-7 place-items-center rounded-[6px] text-[#5b6b7c] hover:bg-[#f4f6f8]">
          <Icon name="more" size={16} />
        </button>
      </div>
    </header>
  );
}
function AreaDetails({ area }: { area: HeatLocality }) {
  return (
    <div className="panel p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-medium uppercase tracking-[.1em] text-[#8a97a6]">
            Selected area
          </p>
          <h2 className="mt-0.5 text-[16px] font-semibold tracking-[-.02em]">{area.locality}</h2>
        </div>
        <RiskTag risk={area.thermalRisk} />
      </div>
      <div className="mt-3 grid grid-cols-3 divide-x divide-[#eef1f4] border-y border-[#eef1f4] py-2 text-center">
        <div>
          <b className="block text-[13px] font-semibold">{area.temperature}°C</b>
          <span className="text-[10px] text-[#5b6b7c]">Temperature</span>
        </div>
        <div>
          <b className="block text-[13px] font-semibold">{area.humidity}%</b>
          <span className="text-[10px] text-[#5b6b7c]">Humidity</span>
        </div>
        <div>
          <b className="block text-[13px] font-semibold">{area.windSpeed} km/h</b>
          <span className="text-[10px] text-[#5b6b7c]">Wind</span>
        </div>
      </div>
      <div className="mt-2.5 space-y-1.5 text-[12px]">
        <p className="flex justify-between">
          <span className="text-[#5b6b7c]">Human thermal risk</span>
          <b className={`${riskClass(area.thermalRisk)} text-[var(--risk)]`}>{area.thermalRisk}</b>
        </p>
        <p className="flex justify-between">
          <span className="text-[#5b6b7c]">Risk intensity</span>
          <b>{Math.round(area.riskIntensity * 100)}</b>
        </p>
        <p className="flex justify-between">
          <span className="text-[#5b6b7c]">Coordinates</span>
          <b className="font-medium tabular-nums">
            {area.latitude.toFixed(3)}, {area.longitude.toFixed(3)}
          </b>
        </p>
      </div>
      <div className="mt-3 border-l-2 border-[#c5ced6] pl-2.5 text-[11px] leading-4 text-[#3d4f61]">
        <b className="font-medium text-ink">Recommended:</b> Activate cooling-centre and outdoor-worker advisory.
      </div>
    </div>
  );
}
function App() {
  const [view, setView] = useState<View>("overview");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [selected, setSelected] = useState(priorityLocalities[0]);
  const toggleNav = () => {
    setNavCollapsed((open) => !open);
    window.setTimeout(() => window.dispatchEvent(new Event("resize")), 220);
  };
  return (
    <>
      <Sidebar
        view={view}
        onNavigate={setView}
        collapsed={navCollapsed}
        onToggle={toggleNav}
      />
      <div
        className={`transition-[margin] duration-200 ${navCollapsed ? "ml-[60px]" : "ml-[196px]"}`}
      >
        <Header />
        {view === "heat-trend" ? (
          <HeatTrendPage />
        ) : (
        <main className="p-4">
          <section className="panel mb-3 flex overflow-hidden max-[1100px]:flex-col">
            <div className="flex min-w-0 flex-1 items-center border-l-[3px] border-l-[#ef7a14] px-4 py-3 max-[1100px]:border-b max-[1100px]:border-[#eef1f4] min-[1101px]:border-r min-[1101px]:border-r-[#eef1f4]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-[.08em] text-[#8a97a6]">
                    Current city status
                  </span>
                  <span className="rounded px-1.5 py-px text-[9px] font-medium uppercase tracking-[.06em] text-[#8a97a6] ring-1 ring-[#e4e9ee]">
                    Prototype simulation
                  </span>
                </div>
                <h2 className="mt-1 text-[22px] font-semibold leading-none tracking-[-.035em]">
                  Pune is under{" "}
                  <span className="text-[#ef7a14]">HIGH</span>{" "}
                  <span className="font-medium text-ink">human thermal stress</span>
                </h2>
                <p className="mt-1.5 max-w-2xl text-[12px] leading-4 text-[#5b6b7c]">
                  Thermal risk is calculated from temperature, humidity and wind conditions rather than temperature alone.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 divide-x divide-[#eef1f4] min-[1101px]:w-[420px]">
              <div className="px-3 py-3 text-center">
                <b className="block text-[16px] font-semibold tabular-nums">41°C</b>
                <span className="mt-0.5 block text-[10px] text-[#5b6b7c]">Temperature</span>
              </div>
              <div className="px-3 py-3 text-center">
                <b className="block text-[16px] font-semibold tabular-nums">68%</b>
                <span className="mt-0.5 block text-[10px] text-[#5b6b7c]">Humidity</span>
              </div>
              <div className="px-3 py-3 text-center">
                <b className="block text-[16px] font-semibold tabular-nums">5</b>
                <span className="mt-0.5 block text-[10px] text-[#5b6b7c]">km/h wind</span>
              </div>
              <div className="flex flex-col items-center justify-center px-3 py-3">
                <RiskTag risk="High" />
                <span className="mt-1 block text-[10px] text-[#5b6b7c]">Human risk</span>
              </div>
            </div>
          </section>
          <section className="panel mb-3 grid grid-cols-4 divide-x divide-[#eef1f4] max-[1100px]:grid-cols-2 max-[1100px]:divide-x-0 max-[1100px]:divide-y">
            {[
              ["Temperature", "41°C", "+4°C above seasonal normal", false],
              ["Human Thermal Risk", "HIGH", "Based on combined environmental stress", true],
              ["High-Risk Wards", "12 / 75", "3 wards entered high-risk status today", false],
              ["Health Impact Risk", "ELEVATED", "Hospital demand may increase", true],
            ].map(([label, value, sub, accent]) => (
              <article key={String(label)} className="px-4 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-[.06em] text-[#8a97a6]">{label}</p>
                <p className={`mt-0.5 text-[18px] font-semibold tabular-nums ${accent ? "text-[#ef7a14]" : "text-ink"}`}>
                  {value}
                </p>
                <p className="mt-0.5 text-[11px] text-[#8a97a6]">{sub}</p>
              </article>
            ))}
          </section>
          <section className="grid grid-cols-[minmax(0,1fr)_280px] gap-3 max-[1120px]:grid-cols-1">
            <div className="panel flex min-h-[440px] flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#eef1f4] px-3 py-2">
                <div>
                  <h2 className="text-[13px] font-semibold">Pune Human Thermal Risk Map</h2>
                  <p className="text-[11px] text-[#5b6b7c]">
                    Ward-level thermal risk zones · GIS operations view
                  </p>
                </div>
                <span className="text-[10px] font-medium uppercase tracking-[.06em] text-[#8a97a6]">
                  Simulated data
                </span>
              </div>
              <div className="relative min-h-[440px] flex-1">
                <PuneHeatMap
                  localities={heatLocalities}
                  selected={selected}
                  onSelect={setSelected}
                />
                <p className="pointer-events-none absolute right-3 bottom-8 z-[500] text-[10px] text-[#5b6b7c]">
                  Simulated ward risk zones · OpenStreetMap
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="panel p-3">
                <h2 className="text-[13px] font-semibold">Priority Areas</h2>
                <p className="text-[11px] text-[#5b6b7c]">Areas requiring attention</p>
                <div className="mt-1.5 divide-y divide-[#eef1f4]">
                  {priorityLocalities.map((area, i) => (
                    <button
                      onClick={() => setSelected(area)}
                      className={`flex w-full items-center gap-2 py-2 text-left ${selected.locality === area.locality ? "bg-[#f7f8fa] px-1" : ""}`}
                      key={area.locality}
                    >
                      <span className="w-3.5 text-[11px] tabular-nums text-[#8a97a6]">
                        {i + 1}
                      </span>
                      <i
                        className={`h-2 w-2 rounded-full ${riskClass(area.thermalRisk)} bg-[var(--risk)]`}
                      />
                      <span className="flex-1 text-[13px] font-medium">
                        {area.locality}
                      </span>
                      <div className="text-right">
                        <RiskTag risk={area.thermalRisk} />
                        <span className="mt-0.5 block text-[10px] tabular-nums text-[#8a97a6]">
                          Intensity {Math.round(area.riskIntensity * 100)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <AreaDetails area={selected} />
            </div>
          </section>
          <section className="mt-3 grid grid-cols-[minmax(380px,1fr)_minmax(0,1.25fr)] gap-3 max-[1180px]:grid-cols-1">
            <div className="panel p-3.5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[13px] font-semibold">5-Day Human Thermal Risk Forecast</h2>
                  <p className="text-[11px] text-[#5b6b7c]">Forecast risk, not temperature alone</p>
                </div>
                <span className="text-[10px] uppercase tracking-[.06em] text-[#8a97a6]">Simulated</span>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {forecast.map((f, i) => (
                  <div className="flex min-w-0 flex-col items-center" key={f.day}>
                    <div className="flex h-[88px] w-full items-end justify-center border-b border-[#eef1f4]">
                      <div
                        className={`${riskClass(f.risk)} w-full max-w-9 rounded-t-[4px] bg-[var(--risk)]`}
                        style={{ height: `${[46, 62, 84, 52, 32][i]}px` }}
                      />
                    </div>
                    <b className="mt-1.5 whitespace-nowrap text-[10px] font-semibold">{f.day}</b>
                    <span className={`mt-0.5 whitespace-nowrap text-[9px] font-semibold uppercase tracking-[.04em] ${riskClass(f.risk)} text-[var(--risk)]`}>{f.risk}</span>
                    <span className="text-[10px] tabular-nums text-[#8a97a6]">
                      {f.temperature}°C
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel p-3.5">
              <h2 className="text-[13px] font-semibold">Recommended Actions</h2>
              <p className="text-[11px] text-[#5b6b7c]">Prioritized for municipal response</p>
              <div className="mt-2.5 grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-[#e4e9ee] bg-[#e4e9ee]">
                {recommendations.map((a) => (
                  <article className="flex min-h-[118px] flex-col bg-white p-3" key={a.title}>
                    <p className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#5b6b7c]">
                      {a.priority}
                    </p>
                    <h3 className="mt-0.5 text-[13px] font-semibold">{a.title}</h3>
                    <p className="mt-1 text-[11px] leading-4 text-[#5b6b7c]">
                      {a.text}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <span className="text-[10px] text-[#8a97a6]">
                        {a.wards}
                      </span>
                      <button className="shrink-0 whitespace-nowrap text-[11px] font-medium text-ink">
                        {a.action} →
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
          <section className="mt-3 grid grid-cols-[1.45fr_1fr] gap-3">
            <div className="panel p-3.5">
              <h2 className="text-[13px] font-semibold">Active Alerts</h2>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {alerts.map((a) => (
                  <div className="rounded-[8px] border border-[#eef1f4] px-3 py-2.5" key={a.title}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[13px] font-medium">{a.title}</h3>
                      <span className="shrink-0 rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-[.05em] text-[#5b6b7c] ring-1 ring-[#e4e9ee]">
                        Active
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#5b6b7c]">
                      {a.wards} · {a.time}
                    </p>
                    <p className="mt-1 text-[11px] text-ink">
                      {a.status}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel p-3.5">
              <p className="text-[9px] font-medium uppercase tracking-[.1em] text-[#8a97a6]">
                System & data status
              </p>
              <div className="mt-2 flex items-center justify-between text-[13px]">
                <span className="text-[#3d4f61]">Weather inputs</span>
                <span className="text-[12px] text-[#5b6b7c]">Updated 10 min ago</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[13px]">
                <span className="text-[#3d4f61]">Ward risk engine</span>
                <span className="flex items-center gap-1.5 text-[12px] text-[#5b6b7c]">
                  <i className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  Operational
                </span>
              </div>
              <p className="mt-3 border-t border-[#eef1f4] pt-2 text-[11px] leading-4 text-[#8a97a6]">
                All readings and recommendations shown are prototype simulation
                data, not live municipal alerts.
              </p>
            </div>
          </section>
        </main>
        )}
      </div>
    </>
  );
}
export default App;
