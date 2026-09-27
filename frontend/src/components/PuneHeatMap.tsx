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
export type MapFocusRequest = { wardId: number; token: number };
type Props = { wards: readonly HistoricalWardRisk[]; selected: HistoricalWardRisk; onSelect: (ward: HistoricalWardRisk) => void; riskMetric?: MapMetric; initialFocusOffsetY?: number; focusRequest?: MapFocusRequest | null };
type WardLayerEntry = { layer: L.Layer; ward: HistoricalWardRisk; risk: RiskLevel; htsi: number; health: ReturnType<typeof calculateHealthImpact> };

export function heatMapRiskLevel(ward: HistoricalWardRisk, metric: MapMetric, health?: ReturnType<typeof calculateHealthImpact>): RiskLevel {
  if (metric === "temperature") return ward.temperature >= 40 ? "Extreme" : ward.temperature >= 38 ? "Very High" : ward.temperature >= 36 ? "High" : ward.temperature >= 33 ? "Moderate" : "Low";
  if (metric === "exposure") return (health ?? calculateHealthImpact(ward)).exposure;
  if (metric === "health") return (health ?? calculateHealthImpact(ward)).potentialImpact;
  if (metric === "htsi") return thermalMetrics(ward).htsiRisk;
  return ward.riskLevel;
}

export function PuneHeatMap({ wards, selected, onSelect, riskMetric = "operational", initialFocusOffsetY = 0, focusRequest = null }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const mapRef = useRef<L.Map | null>(null);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  const wardsRef = useRef(wards);
  const metricRef = useRef(riskMetric);
  const focusRequestRef = useRef(focusRequest);
  const featureLayersRef = useRef(new Map<number, WardLayerEntry>());
  const wardBoundsRef = useRef(new Map<number, L.LatLngBounds>());
  const cityBoundsRef = useRef<L.LatLngBounds | null>(null);
  const legendRef = useRef<L.Control | null>(null);
  const lastFocusTokenRef = useRef<number | null>(null);
  selectedRef.current = selected;
  onSelectRef.current = onSelect;
  wardsRef.current = wards;
  metricRef.current = riskMetric;
  focusRequestRef.current = focusRequest;

  const focusWard = (wardId: number) => {
    const map = mapRef.current;
    const bounds = wardBoundsRef.current.get(wardId);
    if (!map || !bounds?.isValid()) return;
    const padding: [number, number] = [40, 40];
    const targetZoom = Math.min(14, map.getBoundsZoom(bounds, false, L.point(...padding)));
    const currentZoom = map.getZoom();
    if (map.getBounds().contains(bounds) && currentZoom >= targetZoom - 0.15 && currentZoom <= 14) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      map.fitBounds(bounds, { padding, maxZoom: 14, animate: false });
    } else {
      map.flyToBounds(bounds, { padding, maxZoom: 14, duration: 1, easeLinearity: 0.25 });
    }
  };

  const styleLayers = (metric: MapMetric, selectedWardId: number) => {
    const focused = selectedWardId !== null;
    featureLayersRef.current.forEach((item, wardId) => {
      const health = calculateHealthImpact(item.ward);
      const risk = heatMapRiskLevel(item.ward, metric, health);
      item.risk = risk;
      item.htsi = thermalMetrics(item.ward).htsi;
      item.health = health;
      const isSelected = wardId === selectedWardId;
      const style: L.PathOptions = {
        color: isSelected ? "var(--accent)" : "var(--border)",
        weight: isSelected ? 2.8 : focused ? 0.65 : 0.8,
        opacity: isSelected ? 1 : focused ? 0.52 : 0.8,
        fillColor: heatMapRiskColors[risk],
        fillOpacity: isSelected ? 0.82 : focused ? 0.47 : 0.68,
        lineJoin: "round",
      };
      const path = item.layer as L.Path;
      path.setStyle(style);
      const element = path.getElement();
      if (element) {
        element.setAttribute("aria-pressed", String(isSelected));
        element.setAttribute("aria-label", `Select Ward ${item.ward.wardId}, ${item.ward.wardName}, ${risk} risk${isSelected ? ", selected" : ""}`);
      }
      const tooltip = path.getTooltip();
      if (tooltip) tooltip.setContent(`<strong>Ward ${item.ward.wardId} · ${escapeHtml(item.ward.wardName)}</strong><br/><span>HTSI ${item.htsi}/100 · ${risk} risk</span><br/><span>Temperature ${item.ward.temperature.toFixed(1)}°C · ${escapeHtml(health.exposure)} exposure</span>`);
      if (isSelected) path.bringToFront();
    });
  };

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    setMapStatus("loading");
    let cancelled = false;
    const map = L.map(container.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: true });
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', className: "saaya-basemap", maxZoom: 19 }).addTo(map);
    void fetch("/data/pune-electoral-wards-2022.geojson").then((response) => response.json()).then((geojson: WardCollection) => {
      if (cancelled) return;
      const byId = new Map(wardsRef.current.map((ward) => [ward.wardId, ward]));
      const layerGroup = L.geoJSON(geojson, {
        style: () => ({ color: "var(--border)", weight: 0.8, opacity: 0.8, fillColor: "#94a3b8", fillOpacity: 0.68, lineJoin: "round" }),
        onEachFeature: (feature, layer) => {
          const wardId = (feature as WardFeature).properties.wardnum;
          const ward = byId.get(wardId);
          if (!ward) return;
          const health = calculateHealthImpact(ward);
          const risk = heatMapRiskLevel(ward, metricRef.current, health);
          const entry: WardLayerEntry = { layer, ward, risk, htsi: thermalMetrics(ward).htsi, health };
          featureLayersRef.current.set(wardId, entry);
          if ("getBounds" in layer && typeof layer.getBounds === "function") wardBoundsRef.current.set(wardId, layer.getBounds());
          layer.bindTooltip(`<strong>Ward ${entry.ward.wardId} · ${escapeHtml(entry.ward.wardName)}</strong><br/><span>HTSI ${entry.htsi}/100 · ${entry.risk} risk</span><br/><span>Temperature ${entry.ward.temperature.toFixed(1)}°C · ${escapeHtml(entry.health.exposure)} exposure</span>`, { sticky: true, opacity: .96 });
          const select = () => { onSelectRef.current(entry.ward); focusWard(wardId); };
          layer.on("click", select);
          layer.on("mouseover", () => (layer as L.Path).setStyle({ fillOpacity: .86, weight: wardId === selectedRef.current.wardId ? 3 : 1.5 }));
          layer.on("mouseout", () => {
            const selectedWardId = selectedRef.current.wardId;
            const isSelected = wardId === selectedWardId;
            (layer as L.Path).setStyle({ color: isSelected ? "var(--accent)" : "var(--border)", weight: isSelected ? 2.8 : selectedWardId !== null ? 0.65 : 0.8, opacity: isSelected ? 1 : selectedWardId !== null ? 0.52 : 0.8, fillColor: heatMapRiskColors[entry.risk], fillOpacity: isSelected ? 0.82 : selectedWardId !== null ? 0.47 : 0.68, lineJoin: "round" });
          });
          layer.on("add", () => {
            const element = (layer as L.Path).getElement();
            if (!element) return;
            element.setAttribute("tabindex", "0");
            element.setAttribute("role", "button");
            element.setAttribute("aria-label", `Select Ward ${entry.ward.wardId}, ${entry.ward.wardName}, ${entry.risk} risk`);
            element.addEventListener("keydown", (event) => {
              const keyboardEvent = event as KeyboardEvent;
              if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") { keyboardEvent.preventDefault(); select(); }
            });
          });
        },
      }).addTo(map);
      const cityBounds = layerGroup.getBounds().pad(.04);
      cityBoundsRef.current = cityBounds;
      map.fitBounds(cityBounds);
      if (initialFocusOffsetY !== 0) map.panBy([0, initialFocusOffsetY], { animate: false });
      if (legendRef.current) legendRef.current.remove();
      legendRef.current = addLegend(map, metricRef.current);
      addResetControl(map, cityBoundsRef);
      styleLayers(metricRef.current, selectedRef.current.wardId);
      const pendingFocus = focusRequestRef.current;
      if (pendingFocus) { lastFocusTokenRef.current = pendingFocus.token; focusWard(pendingFocus.wardId); }
      setMapStatus("ready");
    }).catch(() => { if (!cancelled) setMapStatus("error"); });
    return () => { cancelled = true; map.remove(); mapRef.current = null; featureLayersRef.current.clear(); wardBoundsRef.current.clear(); cityBoundsRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const latest = new Map(wards.map((ward) => [ward.wardId, ward]));
    featureLayersRef.current.forEach((item, wardId) => {
      const ward = latest.get(wardId);
      if (ward) item.ward = ward;
    });
    styleLayers(riskMetric, selected.wardId);
    if (focusRequest && focusRequest.token !== lastFocusTokenRef.current) {
      lastFocusTokenRef.current = focusRequest.token;
      focusWard(focusRequest.wardId);
    }
  }, [wards, riskMetric, selected.wardId, focusRequest?.token]);

  useEffect(() => {
    if (!mapRef.current || !legendRef.current) return;
    legendRef.current.remove();
    legendRef.current = addLegend(mapRef.current, riskMetric);
  }, [riskMetric]);

  return <div className="saaya-map-shell"><div ref={container} className="saaya-leaflet h-full min-h-[440px] w-full" role="application" aria-label={`Interactive Pune ward ${riskMetric} map; selected ward ${selected.wardName}`} />{mapStatus !== "ready" && <div className={`map-loading-state ${mapStatus === "error" ? "has-error" : ""}`} role={mapStatus === "error" ? "alert" : "status"}><span className="map-loading-mark" aria-hidden="true">{mapStatus === "error" ? "!" : ""}</span><b>{mapStatus === "error" ? "Ward boundaries unavailable" : "Loading Pune ward boundaries"}</b><small>{mapStatus === "error" ? "The local boundary file could not be loaded." : "Preparing ward geometry and risk layers…"}</small>{mapStatus === "loading" && <div className="map-skeleton-lines" aria-hidden="true"><i /><i /><i /></div>}</div>}</div>;
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }

function addResetControl(map: L.Map, cityBoundsRef: { current: L.LatLngBounds | null }) {
  const control = new L.Control({ position: "topright" });
  control.onAdd = () => {
    const button = L.DomUtil.create("button", "saaya-map-reset") as HTMLButtonElement;
    button.type = "button";
    button.setAttribute("aria-label", "Reset Map to Pune-wide view");
    button.textContent = "Reset Map";
    L.DomEvent.disableClickPropagation(button);
    L.DomEvent.on(button, "click", () => {
      const bounds = cityBoundsRef.current;
      if (!bounds) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) map.fitBounds(bounds, { animate: false });
      else map.flyToBounds(bounds, { duration: 0.7, easeLinearity: 0.25 });
    });
    return button;
  };
  control.addTo(map);
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
  return legend;
}
