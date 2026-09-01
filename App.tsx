import { useState } from "react";
import {
  alerts,
  citySummary,
  forecast,
  recommendations,
  wards,
} from "./data/mockHeatData";
import type { RiskLevel, Ward } from "./types/heat";
import { PuneRiskMap } from "./components/PuneRiskMap";

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
    className={`risk-label ${riskClass(risk)} inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[.09em]`}
  >
    <i className="h-1.5 w-1.5 rounded-full bg-[var(--risk)]" />
    {risk}
  </span>
);

function Sidebar() {
  const nav = [
    ["grid", "Overview"],
    ["map", "Heat Map"],
    ["wards", "Wards"],
    ["chart", "Forecast"],
    ["bell", "Alerts"],
    ["report", "Reports"],
    ["settings", "Settings"],
  ];
  return (
    <aside className="fixed inset-y-0 left-0 z-10 flex w-[218px] flex-col border-r border-slate-200 bg-white px-3 py-6">
      <div className="mb-11 px-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-black text-white">
            S
          </span>
          <span className="text-lg font-bold tracking-[-.05em]">SAAYA</span>
        </div>
        <p className="mt-2 text-[10px] font-medium uppercase tracking-[.12em] text-slate-400">
          Heat Health Intelligence
        </p>
      </div>
      <nav className="space-y-1">
        {nav.map(([icon, label]) => (
          <button
            key={label}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${label === "Overview" ? "bg-rose-50 font-semibold text-brand" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
          >
            <Icon name={icon} />
            {label}
          </button>
        ))}
      </nav>
      <div className="mt-auto border-t border-slate-100 px-3 pt-5">
        <p className="text-xs font-semibold text-slate-700">
          Pune Municipal Corporation
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          Municipal coverage · 75 wards
        </p>
      </div>
    </aside>
  );
}
function Header() {
  return (
    <header className="flex h-[72px] items-center justify-end border-b border-slate-200 bg-white px-9">
      <div className="flex items-center gap-7 text-sm">
        <span className="font-medium text-slate-700">
          Pune Municipal Corporation
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <i className="h-2 w-2 rounded-full bg-emerald-500" />
          System operational
        </span>
        <button className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600">
          <Icon name="more" />
        </button>
      </div>
    </header>
  );
}
function Map({
  selected,
  onSelect,
}: {
  selected: Ward;
  onSelect: (ward: Ward) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-[#fbfcfc] p-5 shadow-sm shadow-slate-200/40">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="font-semibold">Pune Human Thermal Risk Map</h2>
          <p className="mt-1 text-xs text-slate-500">
            Risk reflects combined temperature, humidity and wind conditions
          </p>
        </div>
        <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
          SIMULATED DATA
        </span>
      </div>
      <svg
        className="h-[390px] w-full"
        viewBox="0 0 255 235"
        aria-label="Simulated ward-level human thermal risk map"
      >
        {" "}
        <path
          d="M19 84 33 13 120 4 164 28 203 39 230 102 226 191 231 220 155 229 38 208 7 113Z"
          fill="#e9eef0"
          stroke="#d5dfe2"
          strokeWidth="2"
        />
        {wards.map((ward) => (
          <path
            key={ward.id}
            d={ward.path}
            onClick={() => onSelect(ward)}
            className={`${riskClass(ward.thermalRisk)} risk-fill cursor-pointer stroke-white transition-opacity hover:opacity-75 ${selected.id === ward.id ? "stroke-slate-900" : ""}`}
            strokeWidth={selected.id === ward.id ? 2.5 : 1.2}
          >
          <title>{`${ward.name}: ${ward.thermalRisk} thermal risk`}</title>
          </path>
        ))}
        <text
          x="122"
          y="122"
          textAnchor="middle"
          fill="#71808a"
          fontSize="9"
          fontWeight="600"
        >
          PUNE
        </text>
      </svg>
      <div className="absolute bottom-4 left-4 rounded-lg border border-slate-200 bg-white/95 px-3 py-2.5 shadow-sm">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">
          Human Thermal Risk
        </p>
        <div className="flex gap-2">
          {(
            ["Low", "Moderate", "High", "Very High", "Extreme"] as RiskLevel[]
          ).map((r) => (
            <span
              key={r}
              className={`flex items-center gap-1 text-[9px] text-slate-600 ${riskClass(r)}`}
            >
              <i className="h-2 w-2 rounded-full bg-[var(--risk)]" />
              {r}
            </span>
          ))}
        </div>
      </div>
      <p className="absolute bottom-4 right-4 text-[10px] text-slate-400">
        Prototype visualization · ward boundaries simulated
      </p>
    </div>
  );
}
function WardDetails({ ward }: { ward: Ward }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
      <div className="flex items-start justify-between">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">Selected ward</p><h2 className="mt-1 text-xl font-semibold tracking-[-.03em]">{ward.name}</h2></div>
        <RiskTag risk={ward.thermalRisk} />
      </div>
      <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 border-y border-slate-100 py-3 text-center">
        <div>
          <b className="block text-sm">{ward.temperature}°C</b>
          <span className="text-[10px] text-slate-500">Temperature</span>
        </div>
        <div>
          <b className="block text-sm">{ward.humidity}%</b>
          <span className="text-[10px] text-slate-500">Humidity</span>
        </div>
        <div>
          <b className="block text-sm">{ward.windSpeed} km/h</b>
          <span className="text-[10px] text-slate-500">Wind</span>
        </div>
      </div>
      <div className="mt-4 space-y-2.5 text-xs">
        <p className="flex justify-between">
          <span className="text-slate-500">Thermal stress</span>
          <b>WBGT {ward.wbgt}°C</b>
        </p>
        <p className="flex justify-between">
          <span className="text-slate-500">Population</span>
          <b>{ward.population}</b>
        </p>
        <p className="flex justify-between">
          <span className="text-slate-500">Outdoor workers</span>
          <b>{ward.outdoorWorkers}</b>
        </p>
        <p className="flex justify-between">
          <span className="text-slate-500">Elderly population</span>
          <b>{ward.elderlyPopulation}</b>
        </p>
      </div>
      <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs leading-5 text-slate-700">
        <b>Recommended:</b> Activate cooling-centre and outdoor-worker advisory.
      </div>
    </div>
  );
}
function App() {
  const [selected, setSelected] = useState(wards[16]);
  const priority = [wards[16], wards[22], wards[20], wards[24], wards[8]];
  return (
    <>
      <Sidebar />
      <div className="ml-[218px]">
        <Header />
        <main className="mx-auto max-w-[1600px] p-7 xl:p-8">
          <section className="mb-6 flex items-end justify-between">
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">
                Pune · Municipal Coverage · Today
              </p>
              <h1 className="text-[27px] font-semibold tracking-[-.04em]">
                Pune Heat Health Command Center
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Municipal heat-risk overview and early warning
              </p>
            </div>
            <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 hover:border-slate-300">
              Last updated 10 min ago <Icon name="refresh" size={15} />
            </button>
          </section>
          <section className="mb-4 grid grid-cols-[1.45fr_1fr] gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/40 max-[1100px]:grid-cols-1">
            <div>
              <span className="inline-block rounded bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
                PROTOTYPE SIMULATION
              </span>
              <h2 className="mt-3 text-xl font-semibold tracking-[-.035em]">
                Pune is currently under{" "}
                <span className="text-[#d65b24]">HIGH</span> human thermal
                stress
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                Thermal risk is calculated from temperature, humidity and wind
                conditions rather than temperature alone.
              </p>
            </div>
            <div className="grid grid-cols-4 divide-x divide-slate-100 self-center text-center">
              <div>
                <b className="text-xl">41°C</b>
                <span className="mt-1 block text-[10px] text-slate-500">
                  Temperature
                </span>
              </div>
              <div>
                <b className="text-xl">68%</b>
                <span className="mt-1 block text-[10px] text-slate-500">
                  Humidity
                </span>
              </div>
              <div>
                <b className="text-xl">5</b>
                <span className="mt-1 block text-[10px] text-slate-500">
                  km/h wind
                </span>
              </div>
              <div>
                <RiskTag risk="High" />
                <span className="mt-1 block text-[10px] text-slate-500">
                  Human risk
                </span>
              </div>
            </div>
          </section>
          <section className="mb-6 grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2">
            {[
              ["Temperature", "41°C", "+4°C above seasonal normal"],
              [
                "Human Thermal Risk",
                "HIGH",
                "Based on combined environmental stress",
              ],
              [
                "High-Risk Wards",
                "12 / 75",
                "3 wards entered high-risk status today",
              ],
              [
                "Health Impact Risk",
                "ELEVATED",
                "Hospital demand may increase",
              ],
            ].map(([label, value, sub], i) => (
              <article
                key={label}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/30"
              >
                <p className="text-xs text-slate-500">{label}</p>
                <p
                  className={`mt-2 text-xl font-semibold ${i === 1 ? "text-[#d65b24]" : i === 3 ? "text-[#c46b27]" : ""}`}
                >
                  {value}
                </p>
                <p className="mt-1.5 text-[11px] text-slate-400">{sub}</p>
              </article>
            ))}
          </section>
          <section className="grid grid-cols-[minmax(0,7fr)_minmax(290px,3fr)] gap-5 max-[1120px]:grid-cols-1">
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-[#fbfcfc] p-5 shadow-sm shadow-slate-200/40">
              <div className="mb-3 flex items-start justify-between"><div><h2 className="font-semibold">Pune Human Thermal Risk Map</h2><p className="mt-1 text-xs text-slate-500">Risk reflects combined temperature, humidity and wind conditions</p></div><span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">2022 WARD BOUNDARIES</span></div>
              <PuneRiskMap wards={wards} selected={selected} onSelect={setSelected} />
              <div className="absolute bottom-6 left-6 z-1 rounded-lg border border-slate-200 bg-white/95 px-3 py-2.5 shadow-sm"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">Human Thermal Risk</p><div className="flex gap-2">{(["Low", "Moderate", "High", "Very High", "Extreme"] as RiskLevel[]).map((risk) => <span key={risk} className={`${riskClass(risk)} flex items-center gap-1 text-[9px] text-slate-600`}><i className="h-2 w-2 rounded-full bg-[var(--risk)]" />{risk}</span>)}</div></div>
              <p className="absolute bottom-6 right-6 z-1 text-[10px] text-slate-500">2022 DataMeet Pune wards · Risk values simulated</p>
            </div>
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
                <h2 className="font-semibold">Priority Wards</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Areas requiring attention
                </p>
                <div className="mt-3 divide-y divide-slate-100">
                  {priority.map((w, i) => (
                    <button
                      onClick={() => setSelected(w)}
                      className={`flex w-full items-center gap-3 py-3 text-left ${selected.id === w.id ? "rounded bg-slate-50 px-1" : ""}`}
                      key={w.id}
                    >
                      <span className="w-4 text-xs text-slate-400">
                        {i + 1}
                      </span>
                      <i
                        className={`h-2.5 w-2.5 rounded-full ${riskClass(w.thermalRisk)} bg-[var(--risk)]`}
                      />
                      <span className="flex-1 text-sm font-medium">
                        {w.name}
                      </span>
                      <div className="text-right">
                        <RiskTag risk={w.thermalRisk} />
                        <span className="mt-1 block text-[10px] text-slate-400">
                          WBGT {w.wbgt}°C
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <WardDetails ward={selected} />
            </div>
          </section>
          <section className="mt-5 grid grid-cols-[minmax(420px,1fr)_minmax(0,1.35fr)] gap-5 max-[1180px]:grid-cols-1">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold">
                    5-Day Human Thermal Risk Forecast
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Forecast risk, not temperature alone
                  </p>
                </div>
                <span className="text-[10px] text-slate-400">SIMULATED</span>
              </div>
              <div className="mt-5 grid grid-cols-5 gap-3">
                {forecast.map((f, i) => (
                  <div
                    className="flex min-w-0 flex-col items-center"
                    key={f.day}
                  >
                    <div className="flex h-[110px] w-full items-end justify-center border-b border-slate-100">
                      <div
                        className={`${riskClass(f.risk)} w-full max-w-11 rounded-t-md bg-[var(--risk)]`}
                        style={{ height: `${[55, 76, 102, 63, 38][i]}px` }}
                      />
                    </div>
                    <b className="mt-2 whitespace-nowrap text-[10px]">{f.day}</b>
                    <span className={`mt-1 whitespace-nowrap text-[9px] font-bold uppercase tracking-[.06em] ${riskClass(f.risk)} text-[var(--risk)]`}>{f.risk}</span>
                    <span className="mt-0.5 text-[10px] text-slate-400">
                      {f.temperature}°C
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
              <h2 className="font-semibold">Recommended Actions</h2>
              <p className="mt-1 text-xs text-slate-500">
                Prioritized for municipal response
              </p>
              <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
                {recommendations.map((a, i) => (
                  <article className="flex min-h-[144px] flex-col bg-white p-4" key={a.title}>
                    <p className="text-[10px] font-bold uppercase tracking-[.1em] text-brand">
                      {a.priority}
                    </p>
                    <h3 className="mt-1 text-sm font-semibold">{a.title}</h3>
                    <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
                      {a.text}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                      <span className="text-[10px] text-slate-400">
                        {a.wards}
                      </span>
                      <button className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-brand">
                        {a.action} →
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
          <section className="mt-5 grid grid-cols-[1.45fr_1fr] gap-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Active Alerts</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {alerts.map((a) => (
                  <div
                    className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                    key={a.title}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-medium">{a.title}</h3>
                      <span className="rounded bg-amber-100 px-1.5 py-1 text-[9px] font-bold uppercase text-amber-700">
                        Active
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {a.wards} · {a.time}
                    </p>
                    <p className="mt-2 text-[11px] font-medium text-slate-700">
                      {a.status}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-[10px] font-bold uppercase tracking-[.1em] text-slate-400">
                System & data status
              </p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span>Weather inputs</span>
                <span className="text-emerald-600">Updated 10 min ago</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span>Ward risk engine</span>
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <i className="h-2 w-2 rounded-full bg-emerald-500" />
                  Operational
                </span>
              </div>
              <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] leading-4 text-slate-400">
                All readings and recommendations shown are prototype simulation
                data, not live municipal alerts.
              </p>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
export default App;
