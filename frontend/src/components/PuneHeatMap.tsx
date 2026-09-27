import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { HistoricalWardRisk, RiskLevel } from "../types/heat";
import { thermalMetrics } from "../data/thermalStress";
import { calculateHealthImpact } from "../data/healthImpact";

type WardProps = { wardnum: number; Name1?: string; Name2?: string };
type WardFeature = GeoJSON.Feature<GeoJSON.Geometry, WardProps>;
type WardCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, WardProps>;
const levels: RiskLevel[] = ["Low", "Moderate", "High", "Very High", "Extreme"];
export const heatMapRiskColors: Record<RiskLevel, string> = { Low: "#257451", Moderate: "#b67a13", High: "#ca5a1d", "Very High": "#b73335", Extreme: "#68233f" };

export type MapMetric = "operational" | "htsi" | "temperature" | "exposure" | "health";
type Props = { wards: readonly HistoricalWardRisk[]; selected: HistoricalWardRisk; onSelect: (ward: HistoricalWardRisk) => void; riskMetric?: MapMetric; initialFocusOffsetY?: number };

export function heatMapRiskLevel(ward: HistoricalWardRisk, metric: MapMetric, health?: ReturnType<typeof calculateHealthImpact>): RiskLevel {
  if (metric === "temperature") return ward.temperature >= 40 ? "Extreme" : ward.temperature >= 38 ? "Very High" : ward.temperature >= 36 ? "High" : ward.temperature >= 33 ? "Moderate" : "Low";
  if (metric === "exposure") return (health ?? calculateHealthImpact(ward)).exposure;
  if (metric === "health") return (health ?? calculateHealthImpact(ward)).potentialImpact;
  if (metric === "htsi") return thermalMetrics(ward).htsiRisk;
  return ward.riskLevel;
}

export function PuneHeatMap({ wards, selected, onSelect, riskMetric = "operational", initialFocusOffsetY = 0 }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const mapRef = useRef<L.Map | null>(null);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  selectedRef.current = selected;
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    setMapStatus("loading");
    let cancelled = false;
    const map = L.map(container.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: true });
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', className: "saaya-basemap", maxZoom: 19 }).addTo(map);
    void fetch("/data/pune-electoral-wards-2022.geojson").then((response) => response.json()).then((geojson: WardCollection) => {
      if (cancelled) return;
      const byId = new Map(wards.map((ward) => {
        const htsi = thermalMetrics(ward).htsi;
        const health = calculateHealthImpact(ward);
        const risk = heatMapRiskLevel(ward, riskMetric, health);
        return [ward.wardId, { ward, risk, htsi, health }] as const;
      }));
      const style = (risk?: RiskLevel): L.PathOptions => ({ color: "#f8fafc", weight: 0.8, opacity: .8, fillColor: risk ? heatMapRiskColors[risk] : "#94a3b8", fillOpacity: .68, lineJoin: "round" });
      L.geoJSON(geojson, {
        style: (feature) => style(byId.get((feature as WardFeature).properties.wardnum)?.risk),
        onEachFeature: (feature, layer) => {
          const entry = byId.get((feature as WardFeature).properties.wardnum);
          if (!entry) return;
          const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
          const detail = `<span>HTSI ${entry.htsi}/100 · ${entry.risk} risk</span><br/><span>Temperature ${entry.ward.temperature.toFixed(1)}°C · ${escapeHtml(entry.health.exposure)} exposure</span>`;
          layer.bindTooltip(`<strong>Ward ${entry.ward.wardId} · ${escapeHtml(entry.ward.wardName)}</strong><br/>${detail}`, { sticky: true, opacity: .96 });
          layer.on("click", () => onSelectRef.current(entry.ward));
          layer.on("mouseover", () => (layer as L.Path).setStyle({ fillOpacity: .84, weight: 1.5 }));
          layer.on("mouseout", () => (layer as L.Path).setStyle(style(entry.risk)));
        },
      }).addTo(map);
      addLegend(map, riskMetric);
      map.fitBounds(L.geoJSON(geojson).getBounds().pad(.04));
      if (initialFocusOffsetY) map.panBy([0, initialFocusOffsetY], { animate: false });
      setMapStatus("ready");
    }).catch(() => { if (!cancelled) setMapStatus("error"); });
    return () => { cancelled = true; map.remove(); mapRef.current = null; };
  }, [initialFocusOffsetY, riskMetric, wards]);

  return <div className="saaya-map-shell"><div ref={container} className="saaya-leaflet h-full min-h-[440px] w-full" role="application" aria-label={`Interactive Pune ward ${riskMetric} map; selected ward ${selected.wardName}`} />{mapStatus !== "ready" && <div className={`map-loading-state ${mapStatus === "error" ? "has-error" : ""}`} role={mapStatus === "error" ? "alert" : "status"}><span className="map-loading-mark" aria-hidden="true">{mapStatus === "error" ? "!" : ""}</span><b>{mapStatus === "error" ? "Ward boundaries unavailable" : "Loading Pune ward boundaries"}</b><small>{mapStatus === "error" ? "The local boundary file could not be loaded." : "Preparing ward geometry and risk layers…"}</small>{mapStatus === "loading" && <div className="map-skeleton-lines" aria-hidden="true"><i /><i /><i /></div>}</div>}</div>;
}

function addLegend(map: L.Map, metric: MapMetric) {
  const legend = new L.Control({ position: "bottomleft" });
  legend.onAdd = () => {
    const wrap = L.DomUtil.create("div", "saaya-map-legend");
    const label = metric === "temperature" ? "Temperature bands" : metric === "exposure" ? "Exposure bands" : metric === "health" ? "Potential health impact" : "HTSI / ward risk bands";
    wrap.innerHTML = `<p>${label}</p>${levels.map((risk) => `<span><i style="background:${heatMapRiskColors[risk]}"></i>${risk}</span>`).join("")}`;
    L.DomEvent.disableClickPropagation(wrap);
    return wrap;
  };
  legend.addTo(map);
}
